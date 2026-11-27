import * as THREE from 'three';
import { Assets, assetURL } from './assets.js';

// Realistic human NPC:
//  - PBR skin/cloth materials from the original texture sets
//  - motion-captured idle / talk / listen / walk / sit animations with cross-fading
//  - text-driven lip sync using the avatar's 15 viseme blendshapes
//  - blinking, eye saccades, mood-based facial expressions, procedural head/eye look-at

const VISEMES = ['AA_VI_00_Sil', 'AA_VI_01_PP', 'AA_VI_02_FF', 'AA_VI_03_TH', 'AA_VI_04_DD', 'AA_VI_05_KK', 'AA_VI_06_CH',
  'AA_VI_07_SS', 'AA_VI_08_nn', 'AA_VI_09_RR', 'AA_VI_10_aa', 'AA_VI_11_E', 'AA_VI_12_I', 'AA_VI_13_O', 'AA_VI_14_U'];

// Arabic letters -> viseme index
const LETTER_VISEME = {};
const setV = (chars, v) => { for (const c of chars) LETTER_VISEME[c] = v; };
setV('بمپ', 1); setV('فڤ', 2); setV('ثذظ', 3); setV('تدطض', 4); setV('كقگغخ', 5); setV('شجچ', 6);
setV('سصز', 7); setV('نل', 8); setV('ر', 9); setV('اآأإىةهعحء', 10); setV('ي', 12); setV('ئ', 11); setV('وؤ', 14);
const VOWEL_MARKS = { 'َ': 10, 'ُ': 13, 'ِ': 12 };

const MOODS = {
  calm: {},
  friendly: { AK_44_MouthSmileLeft: 0.3, AK_45_MouthSmileRight: 0.3, AK_07_CheekSquintLeft: 0.15, AK_08_CheekSquintRight: 0.15 },
  nervous: { AK_03_BrowInnerUp: 0.55, AK_21_EyeWideLeft: 0.2, AK_22_EyeWideRight: 0.2, AK_36_MouthPressLeft: 0.25, AK_37_MouthPressRight: 0.25 },
  angry: { AK_01_BrowDownLeft: 0.7, AK_02_BrowDownRight: 0.7, AK_50_NoseSneerLeft: 0.25, AK_51_NoseSneerRight: 0.25, AK_36_MouthPressLeft: 0.35, AK_37_MouthPressRight: 0.35, AK_19_EyeSquintLeft: 0.2, AK_20_EyeSquintRight: 0.2 },
  sad: { AK_03_BrowInnerUp: 0.65, AK_30_MouthFrownLeft: 0.45, AK_31_MouthFrownRight: 0.45, AK_11_EyeLookDownLeft: 0.2, AK_12_EyeLookDownRight: 0.2 },
  shocked: { AK_21_EyeWideLeft: 0.6, AK_22_EyeWideRight: 0.6, AK_04_BrowOuterUpLeft: 0.6, AK_05_BrowOuterUpRight: 0.6, AK_03_BrowInnerUp: 0.4, AK_25_JawOpen: 0.12 },
  suspicious: { AK_19_EyeSquintLeft: 0.35, AK_20_EyeSquintRight: 0.35, AK_01_BrowDownLeft: 0.3, AK_33_MouthLeft: 0.15 },
};
export const MOOD_LABELS = { calm: 'هادئ', friendly: 'متعاون', nervous: 'متوتر', angry: 'غاضب', sad: 'حزين', shocked: 'مصدوم', suspicious: 'متحفّظ' };

const ANIM_SETS = {
  m: {
    idle: { calm: 'm_idle_neutral_01', friendly: 'm_idle_neutral_02', nervous: 'm_idle_nervous_01', angry: 'm_idle_angry_01', sad: 'm_idle_neutral_01', shocked: 'm_idle_nervous_01', suspicious: 'm_idle_look_around_01' },
    talk: { calm: 'm_gestic_talk_neutral_01', friendly: 'm_gestic_talk_neutral_02', nervous: 'm_gestic_talk_nervous_01', angry: 'm_gestic_talk_angry_01', sad: 'm_gestic_talk_sad_01', shocked: 'm_gestic_talk_nervous_01', suspicious: 'm_gestic_talk_neutral_01' },
    listen: { calm: 'm_gestic_listen_neutral_01', friendly: 'm_gestic_listen_neutral_01', nervous: 'm_gestic_listen_nervous_01', angry: 'm_gestic_listen_deny_01', sad: 'm_gestic_listen_neutral_01', shocked: 'm_gestic_listen_nervous_01', suspicious: 'm_gestic_listen_deny_01' },
    walk: 'm_walk_neutral_01',
  },
  f: {
    idle: { calm: 'f_idle_neutral_01', friendly: 'f_idle_neutral_01', nervous: 'f_idle_nervous_01', angry: 'f_idle_nervous_01', sad: 'f_idle_neutral_01', shocked: 'f_idle_nervous_01', suspicious: 'f_idle_look_around_01' },
    talk: { calm: 'f_gestic_talk_neutral_01', friendly: 'f_gestic_talk_neutral_01', nervous: 'f_gestic_talk_nervous_01', angry: 'f_gestic_talk_nervous_01', sad: 'f_gestic_talk_sad_01', shocked: 'f_gestic_talk_nervous_01', suspicious: 'f_gestic_talk_neutral_01' },
    listen: { calm: 'f_gestic_listen_neutral_01', friendly: 'f_gestic_listen_neutral_01', nervous: 'f_gestic_listen_nervous_01', angry: 'f_gestic_listen_deny_01', sad: 'f_gestic_listen_neutral_01', shocked: 'f_gestic_listen_nervous_01', suspicious: 'f_gestic_listen_deny_01' },
    walk: 'f_idle_neutral_01',
  },
  seated: {
    idle: { _: 'm_sit_chair_idle_neutral_01' },
    talk: { _: 'm_sit_chair_gestic_thoughtful', nervous: 'm_sit_chair_gestic_shrug_01', sad: 'm_sit_chair_gestic_shrug_01' },
    listen: { _: 'm_sit_chair_breathe_01' },
  },
};

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

// Loads a colour texture and lets the case edit it on a canvas (e.g. replace real-world insignia).
function patchedTexture(url, fn) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); fn(ctx, c.width, c.height);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = true; t.anisotropy = 8; res(t);
    };
    img.onerror = rej; img.src = url;
  });
}

function fixMaterial(name, id, patches = {}) {
  const sem = name.replace(/^[a-z]*\d+_/i, '');
  const base = `characters/${id}/${sem}`;
  const m = new THREE.MeshStandardMaterial({ name, roughness: 0.62, metalness: 0, envMapIntensity: 0.7 });
  // glasses use one "<name>_opacity_color" map (frame colour + lens cut-out) without a separate _color map
  const isGlasses = sem === 'glasses';
  const colorBase = isGlasses ? base + '_opacity' : base;
  const isOpacity = /opacity/.test(sem) || isGlasses;
  const isSkin = sem === 'head';
  (patches[sem] ? patchedTexture(assetURL(colorBase + '_color.jpg'), patches[sem]) : Assets.texture(colorBase + '_color.jpg'))
    .then(t => { m.map = t; m.needsUpdate = true; }).catch(() => {});
  if (!isOpacity) Assets.texture(base + '_normal.jpg', { srgb: false }).then(t => { m.normalMap = t; m.normalScale.set(isSkin ? 0.7 : 1, isSkin ? 0.7 : 1); m.needsUpdate = true; }).catch(() => {});
  if (!isOpacity) Assets.texture(base + '_specular.jpg', { srgb: false }).then(t => {
    // Specular maps are converted to roughness on the fly (bright = glossy).
    m.roughnessMap = t; m.needsUpdate = true;
  }).catch(() => {});
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = ${isSkin ? '0.6' : '0.85'};
      #ifdef USE_ROUGHNESSMAP
        vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
        roughnessFactor = clamp(${isSkin ? '0.82' : '0.98'} - texelRoughness.g * ${isSkin ? '0.45' : '0.3'}, ${isSkin ? '0.42' : '0.66'}, 1.0);
      #endif`);
  };
  if (isOpacity) {
    m.alphaTest = 0.45; m.side = THREE.DoubleSide; m.roughness = 0.7;
    Assets.texture(colorBase + '_color_alpha.jpg', { srgb: false }).then(t => { m.alphaMap = t; m.needsUpdate = true; }).catch(() => {});
  }
  return m;
}

export class Character {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.gender = def.gender || 'm';
    this.seated = !!def.seated;
    this.mood = def.mood || 'calm';
    this.state = 'idle';
    this.root = new THREE.Group();
    this.root.name = 'npc_' + def.id;
    this.actions = {};
    this.morphs = {};
    this.morphTargets = {};
    this.lookTarget = null; this.lookWeight = 0;
    this.speech = null;
    this.blinkT = 2; this.blink = 0;
    this.sacT = 1; this.sac = new THREE.Vector2();
    this.turnTarget = null;
    this.patrol = def.patrol || null; this.patrolIdx = 0; this.patrolWait = 2; this.walking = false;
    this.paused = false;
  }

  async load() {
    const src = await Assets.fbx(`characters/${this.id}/model.fbx`);
    // FBXLoader returns one object per file; clone it via SkeletonUtils-free path (we load each avatar once).
    const model = this.model = src;
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const fixed = mats.map(mm => fixMaterial(mm.name, this.id, this.def.texturePatch));
        o.material = Array.isArray(o.material) ? fixed : fixed[0];
        if (o.morphTargetDictionary) { this.mesh = o; }
      }
    });
    model.scale.setScalar(1); model.position.set(0, 0, 0); model.rotation.set(0, 0, 0);
    if (!model.userData.h0) { model.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(model); model.userData.h0 = box.max.y - box.min.y; }
    const s = (this.def.height || 1.75) / model.userData.h0;
    model.scale.setScalar(s);
    this.root.add(model);
    // morph lookup
    if (this.mesh) {
      for (const [k, i] of Object.entries(this.mesh.morphTargetDictionary)) this.morphs[k.replace(/^blendShape1\./, '')] = i;
    }
    this.bones = {};
    model.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.head = this.bones.Bip01_Head; this.neck = this.bones.Bip01_Neck;
    this.eyes = [this.bones.Bip01_LEye, this.bones.Bip01_REye].filter(Boolean);
    this.mixer = new THREE.AnimationMixer(model);
    this.pelvisRest = this.bones.Bip01_Pelvis ? this.bones.Bip01_Pelvis.position.length() : 1;
    this.restQuat = {};
    for (const [n, b] of Object.entries(this.bones)) this.restQuat[n] = b.quaternion.clone();

    // preload animation clips
    const set = this.seated ? ANIM_SETS.seated : ANIM_SETS[this.gender];
    const names = new Set();
    for (const k of ['idle', 'talk', 'listen']) for (const v of Object.values(set[k])) names.add(v);
    if (!this.seated) names.add(ANIM_SETS[this.gender].walk);
    await Promise.all([...names].map(n => this._clip(n).catch(e => console.warn('anim', n, e))));
    this.root.position.set(...(this.def.position || [0, 0, 0]));
    this.root.rotation.y = this.def.rotation || 0;
    this.homeRot = this.root.rotation.y;
    this._play(this._animFor('idle'), 0);
    // head forward axis in head-local space (character faces +Z)
    model.updateMatrixWorld(true);
    if (this.head) {
      this.head.getWorldQuaternion(_q1);
      this.root.getWorldQuaternion(_q2);
      const fwdWorld = new THREE.Vector3(0, 0, 1).applyQuaternion(_q2);
      this.headFwdLocal = fwdWorld.applyQuaternion(_q1.invert()).normalize();
    }
    return this;
  }

  async _clip(name) {
    if (this.actions[name]) return this.actions[name];
    const src = await Assets.clip(name);
    const tracks = [];
    let ratio = 1;
    const pelvisTrack = src.tracks.find(t => t.name === 'Bip01_Pelvis.position');
    if (pelvisTrack) { const v = pelvisTrack.values; ratio = this.pelvisRest / Math.max(1e-3, Math.hypot(v[0], v[1], v[2])); }
    for (const t of src.tracks) {
      const [bone, prop] = t.name.split('.');
      if (!this.bones[bone]) continue;
      if (prop === 'scale') continue;
      if (prop === 'position') {
        if (bone !== 'Bip01_Pelvis') continue;
        const c = t.clone(); for (let i = 0; i < c.values.length; i++) c.values[i] *= ratio; tracks.push(c); continue;
      }
      // facial bones: let blendshapes drive the face
      if (/Eye|Mouth|Lip|Jaw|Brow|Cheek|Masseter|Nose|Tongue|Caninus/.test(bone)) continue;
      tracks.push(t);
    }
    const clip = new THREE.AnimationClip(name, src.duration, tracks);
    const action = this.mixer.clipAction(clip);
    this.actions[name] = action;
    return action;
  }

  _animFor(state) {
    if (state === 'walk') return ANIM_SETS[this.gender].walk;
    const set = this.seated ? ANIM_SETS.seated : ANIM_SETS[this.gender];
    const m = set[state];
    return m[this.mood] || m._ || m.calm;
  }

  _play(name, fade = 0.45) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    // start at a random phase so several NPCs never move in sync
    if (!this.current) next.time = Math.random() * next.getClip().duration;
    next.play();
    if (this.current && fade > 0) this.current.crossFadeTo(next, fade, true);
    else if (this.current) this.current.stop();
    this.current = next;
  }

  setState(state) { this.state = state; if (!this.walking) this._play(this._animFor(state)); }
  setMood(mood) { if (!MOODS[mood]) return; this.mood = mood; this._play(this._animFor(this.state)); }

  // Lip-sync a line of text; `cps` = characters per second (matches the subtitle typewriter).
  // With a recorded voice, pass its duration and a loudness function: the mouth shapes are
  // spread over the audio and opened/closed by the actual loudness of the voice.
  speak(text, cps = 16, voice = null) {
    const seq = [];
    for (const ch of text) {
      if (VOWEL_MARKS[ch] !== undefined) { if (seq.length) seq[seq.length - 1].v = VOWEL_MARKS[ch]; continue; }
      if (/\s/.test(ch)) { seq.push({ v: 0, w: 0.2 }); continue; }
      if (/[.,،؛:!؟?…"«»\-]/.test(ch)) { seq.push({ v: 0, w: 0 }, { v: 0, w: 0 }); continue; }
      const v = LETTER_VISEME[ch];
      seq.push({ v: v === undefined ? 10 : v, w: v === 10 || v === 13 || v === 14 ? 1 : 0.75 });
    }
    if (voice) cps = seq.length / Math.max(0.3, voice.duration * 0.96);
    this.speech = { seq, t: 0, cps, level: voice ? voice.level : null, amp: 0 };
    this.setState('talk');
  }
  stopSpeaking() { this.speech = null; if (this.state === 'talk') this.setState('listen'); }
  get speaking() { return !!this.speech; }

  _setMorph(name, w) { const i = this.morphs[name]; if (i !== undefined) this.morphTargets[i] = (this.morphTargets[i] || 0) + w; }

  faceTowards(pos) { this.turnTarget = Math.atan2(pos.x - this.root.position.x, pos.z - this.root.position.z); }
  returnHome() { this.turnTarget = this.homeRot; }

  update(dt, camera) {
    if (!this.mixer) return;
    // --- patrol walking
    if (this.patrol && !this.paused && !this.seated) this._updatePatrol(dt);
    // --- turning
    if (this.turnTarget !== null && !this.seated) {
      let d = this.turnTarget - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * Math.min(1, dt * 3.5);
      if (Math.abs(d) < 0.01) this.turnTarget = null;
    }
    this.mixer.update(dt);

    // --- face
    this.morphTargets = {};
    const moodW = MOODS[this.mood] || {};
    for (const [k, w] of Object.entries(moodW)) this._setMorph(k, w);
    // blink
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2 + Math.random() * 4; }
    if (this.blink > 0) {
      const b = Math.sin((1 - this.blink) * Math.PI);
      this._setMorph('AK_09_EyeBlinkLeft', b); this._setMorph('AK_10_EyeBlinkRight', b);
      this.blink = Math.max(0, this.blink - dt * 6.5);
    }
    // saccades
    this.sacT -= dt;
    if (this.sacT <= 0) { this.sac.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.25); this.sacT = 0.6 + Math.random() * 2.2; }
    if (this.sac.x > 0) { this._setMorph('AK_15_EyeLookOutLeft', this.sac.x); this._setMorph('AK_14_EyeLookInRight', this.sac.x); }
    else { this._setMorph('AK_13_EyeLookInLeft', -this.sac.x); this._setMorph('AK_16_EyeLookOutRight', -this.sac.x); }
    // speech
    if (this.speech) {
      const sp = this.speech; sp.t += dt * sp.cps;
      const i = Math.floor(sp.t), f = sp.t - i;
      if (i >= sp.seq.length) { this.stopSpeaking(); }
      else {
        const a = sp.seq[i], b = sp.seq[i + 1] || { v: 0, w: 0 };
        const ease = f * f * (3 - 2 * f);
        let k = 0.6, jaw = 0.1;
        if (sp.level) { sp.amp += (sp.level() - sp.amp) * Math.min(1, dt * 25); k = 0.15 + sp.amp * 0.75; jaw = 0.04 + sp.amp * 0.2; }
        if (a.v) this._setMorph(VISEMES[a.v], a.w * (1 - ease) * k);
        if (b.v) this._setMorph(VISEMES[b.v], b.w * ease * k);
        const open = ((a.v === 10 || a.v === 13 ? a.w : a.w * 0.4) * (1 - ease) + (b.v === 10 || b.v === 13 ? b.w : b.w * 0.4) * ease);
        this._setMorph('AK_25_JawOpen', open * jaw);
      }
    }
    if (this.mesh) {
      const inf = this.mesh.morphTargetInfluences;
      for (let i = 0; i < inf.length; i++) {
        const target = Math.min(1, this.morphTargets[i] || 0);
        inf[i] += (target - inf[i]) * Math.min(1, dt * (this.speech ? 22 : 10));
      }
    }

    // --- procedural head / eye look-at (applied on top of the animation)
    const wantLook = this.lookTarget ? 1 : 0;
    this.lookWeight += (wantLook - this.lookWeight) * Math.min(1, dt * 3);
    if (this.head && this.headFwdLocal && this.lookWeight > 0.01) {
      const target = this.lookTarget || (camera && camera.position);
      if (target) this._lookAt(target, this.lookWeight);
    }
  }

  _lookAt(target, weight) {
    const head = this.head;
    head.updateWorldMatrix(true, false);
    head.getWorldPosition(_v1);
    head.getWorldQuaternion(_q1);
    const cur = _v2.copy(this.headFwdLocal).applyQuaternion(_q1).normalize();
    const want = new THREE.Vector3().subVectors(target, _v1).normalize();
    // clamp angle
    const ang = cur.angleTo(want);
    const maxAng = 1.1;
    if (ang > 1e-4) {
      let t = Math.min(1, maxAng / ang);
      if (ang > 1.9) t *= Math.max(0, 1 - (ang - 1.9) / 0.6); // too far behind: give up gradually
      const full = _q2.setFromUnitVectors(cur, want);
      const delta = _q3.identity().slerp(full, t * weight);
      // distribute: neck 40%, head 60%
      const neckPart = new THREE.Quaternion().identity().slerp(delta, 0.4);
      const headPart = new THREE.Quaternion().identity().slerp(delta, 0.6);
      for (const [bone, part] of [[this.neck, neckPart], [head, headPart]]) {
        if (!bone) continue;
        const pw = new THREE.Quaternion(); bone.parent.getWorldQuaternion(pw);
        const bw = new THREE.Quaternion(); bone.getWorldQuaternion(bw);
        const nw = part.multiply(bw);
        bone.quaternion.copy(pw.invert().multiply(nw));
        bone.updateWorldMatrix(false, true);
      }
    }
  }

  _updatePatrol(dt) {
    const p = this.patrol;
    if (this.patrolWait > 0) {
      this.patrolWait -= dt;
      if (this.walking && this.patrolWait > 0) { this.walking = false; this._play(this._animFor(this.state), 0.5); }
      return;
    }
    const wp = p[this.patrolIdx];
    const dx = wp[0] - this.root.position.x, dz = wp[1] - this.root.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) { this.patrolIdx = (this.patrolIdx + 1) % p.length; this.patrolWait = 3 + Math.random() * 4; this.turnTarget = wp[2] !== undefined ? wp[2] : null; return; }
    if (!this.walking) { this.walking = true; this._play(this._animFor('walk'), 0.5); }
    this.turnTarget = Math.atan2(dx, dz);
    let d = this.turnTarget - this.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    const speed = Math.abs(d) > 0.6 ? 0.15 : 0.95;
    const step = Math.min(dist, speed * dt);
    this.root.position.x += Math.sin(this.root.rotation.y) * step;
    this.root.position.z += Math.cos(this.root.rotation.y) * step;
    if (this.collider) { this.collider.x = this.root.position.x; this.collider.z = this.root.position.z; }
  }

  stopPatrol() { this.paused = true; if (this.walking) { this.walking = false; this._play(this._animFor(this.state), 0.4); } }
  resumePatrol() { this.paused = false; this.patrolWait = 1.5; }

  headPosition(out = new THREE.Vector3()) { if (this.head) this.head.getWorldPosition(out); else out.copy(this.root.position).setY(1.6); return out; }
}
