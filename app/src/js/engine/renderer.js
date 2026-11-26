import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { QUALITY } from '../core/settings.js';

// Cinematic grading: vignette, film grain, gentle teal/orange split toning, subtle chromatic fringe.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.42 }, grain: { value: 0.045 },
    flash: { value: 0 }, desat: { value: 0 }, aspect: { value: 1.7 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vignette, grain, flash, desat, aspect; varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float d = length(c * vec2(aspect/1.7, 1.0));
      vec2 off = c * 0.0025 * d;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      float l = dot(col, vec3(0.299,0.587,0.114));
      // split toning: shadows teal, highlights warm
      vec3 shadowTint = vec3(0.86, 0.98, 1.06);
      vec3 highTint = vec3(1.06, 1.0, 0.9);
      col *= mix(shadowTint, highTint, smoothstep(0.05, 0.7, l));
      col = mix(col, vec3(l), 0.12 + desat);
      col += flash * vec3(0.55, 0.62, 0.8);
      float v = smoothstep(0.85, 0.2, d);
      col *= mix(1.0 - vignette, 1.0, v);
      float n = rand(vUv * vec2(1920.0,1080.0) + fract(time) * 100.0) - 0.5;
      col += n * grain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Renderer {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    r.domElement.id = 'gl';
    this.quality = 'high';
    this.postfx = true;
    this.flash = 0;
    window.addEventListener('resize', () => this.resize());
  }

  setup(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.buildComposer();
    this.resize();
  }

  buildComposer() {
    const q = QUALITY[this.quality];
    const r = this.renderer;
    r.setPixelRatio(Math.min((window.devicePixelRatio || 1) * q.pixelRatio, q.maxPR));
    const size = r.getSize(new THREE.Vector2());
    const composer = this.composer = new EffectComposer(r);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = null;
    if (q.ao && this.postfx) {
      const ao = this.ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.85;
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1 });
      composer.addPass(ao);
    }
    if (q.bloom && this.postfx) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.6, 0.86);
      composer.addPass(this.bloom);
    }
    composer.addPass(new OutputPass());
    if (this.postfx) {
      this.grade = new ShaderPass(GradeShader);
      composer.addPass(this.grade);
    } else this.grade = null;
    if (q.aa) composer.addPass(new SMAAPass(size.x * r.getPixelRatio(), size.y * r.getPixelRatio()));
  }

  applySettings(settings) {
    this.quality = settings.quality;
    this.postfx = settings.postfx;
    const q = QUALITY[this.quality];
    this.renderer.shadowMap.enabled = settings.shadows;
    if (this.scene) {
      let n = 0;
      this.scene.traverse(o => {
        if (o.isLight && o.userData.wantsShadow) {
          o.castShadow = settings.shadows && n < q.shadowLights;
          if (o.castShadow) { n++; o.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } }
        }
      });
      this.scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(mm => mm.needsUpdate = true); } });
      this.buildComposer();
      this.resize();
    }
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.composer) this.composer.setSize(w, h);
    if (this.grade) this.grade.uniforms.aspect.value = w / h;
  }

  render(dt) {
    if (!this.scene) return;
    if (this.grade) {
      this.grade.uniforms.time.value += dt;
      this.flash = Math.max(0, this.flash - dt * 2.5);
      this.grade.uniforms.flash.value = this.flash * this.flash;
    }
    if (this.postfx) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
