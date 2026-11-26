import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const BASE = new URL('../../../assets/', import.meta.url).href;
export const assetURL = (p) => BASE + p;

const manager = new THREE.LoadingManager();
// Character FBX files reference .tga textures that are replaced manually -> silence those requests.
manager.setURLModifier((url) => (/\.(tga|psd)$/i.test(url) ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : url));

const gltf = new GLTFLoader(manager);
const fbx = new FBXLoader(manager);
const tex = new THREE.TextureLoader(manager);
const rgbe = new RGBELoader(manager);

const GLASS = new THREE.MeshStandardMaterial({ color: '#cfd8dc', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, envMapIntensity: 2, depthWrite: false });
const cache = new Map();
function once(key, fn) { if (!cache.has(key)) cache.set(key, fn().catch(e => { cache.delete(key); throw e; })); return cache.get(key); }

export const Assets = {
  progress: { loaded: 0, total: 0 },
  onProgress: null,
  _track(p) {
    this.progress.total++; this.onProgress && this.onProgress(this.progress);
    return p.finally(() => { this.progress.loaded++; this.onProgress && this.onProgress(this.progress); });
  },
  resetProgress() { this.progress = { loaded: 0, total: 0 }; },

  model(id) {
    return this._track(once('m:' + id, async () => {
      const g = await gltf.loadAsync(assetURL(`models/${id}/${id}.gltf`));
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        // Replace transmissive glass (needs an extra full-scene render pass every frame) with cheap glass.
        const fix = (m) => (m && m.transmission > 0) ? GLASS : m;
        o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
        if (o.material === GLASS) o.castShadow = false;
      });
      return g.scene;
    }));
  },
  // Returns a fresh clone (geometry/materials shared).
  async modelInstance(id) {
    const src = await this.model(id);
    return src.clone(true);
  },

  // Pre-baked animation clip (see tools/bake.html); falls back to the original FBX.
  clip(name) {
    return this._track(once('c:' + name, async () => {
      try {
        const r = await fetch(assetURL(`anims/${name}.json`));
        if (!r.ok) throw new Error('no json');
        return THREE.AnimationClip.parse(await r.json());
      } catch {
        const a = await fbx.loadAsync(assetURL(`anims/${name}.fbx`));
        return a.animations[0];
      }
    }));
  },

  fbx(path) { return this._track(once('f:' + path, () => fbx.loadAsync(assetURL(path)))); },

  texture(path, { srgb = true, repeat = null, anisotropy = 8 } = {}) {
    const key = 't:' + path + ':' + srgb + ':' + (repeat ? repeat.join(',') : '');
    return this._track(once(key, async () => {
      const t = await tex.loadAsync(assetURL(path));
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = anisotropy;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
      return t;
    }));
  },

  // PBR texture set -> MeshStandardMaterial. `size` = metres covered by one texture tile.
  async pbr(id, { size = 2, color = null, roughness = 1, normalScale = 1, envIntensity = 1, metalness = 0 } = {}) {
    const key = `pbr:${id}:${size}:${color}:${roughness}:${normalScale}`;
    return once(key, async () => {
      const opt = (p, srgb) => this.texture(`textures/${id}/${p}`, { srgb, repeat: [1, 1] }).catch(() => null);
      const [map, normalMap, roughnessMap] = await Promise.all([opt('diff.jpg', true), opt('nor.jpg', false), opt('rough.jpg', false)]);
      const m = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, roughness, metalness, envMapIntensity: envIntensity });
      if (color) m.color = new THREE.Color(color);
      if (normalMap) m.normalScale.set(normalScale, normalScale);
      m.userData.tileSize = size;
      return m;
    });
  },

  hdri(id) {
    return this._track(once('h:' + id, async () => {
      const t = await rgbe.loadAsync(assetURL(`hdri/${id}.hdr`));
      t.mapping = THREE.EquirectangularReflectionMapping;
      return t;
    }));
  },
};
