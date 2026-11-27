import * as THREE from 'three';
import { Assets, assetURL } from '../engine/assets.js';
import { voiceKey } from '../core/voicekey.js';
import { Physics } from '../engine/physics.js';
import { Player } from '../engine/player.js';
import { World } from '../engine/world.js';
import { Character } from '../engine/character.js';
import { audio } from '../core/audio.js';
import { HUD } from '../ui/hud.js';
import { DialogueUI } from '../ui/dialogue.js';
import { InspectUI } from '../ui/inspect.js';
import { CaseFileUI } from '../ui/casefile.js';
import { BoardUI } from '../ui/board.js';
import { AccuseUI } from '../ui/accuse.js';
import { $, show, wait } from '../ui/dom.js';

const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();

// Runtime of one case: 3D scene, NPCs, interaction and all investigation UIs.
export class Investigation {
  constructor(app, caseModule, caseMeta) {
    this.app = app; this.mod = caseModule; this.data = caseModule.data; this.caseMeta = caseMeta;
    this.g = app.game; this.renderer = app.renderer; this.settings = app.game.settings;
    this.thumbs = {}; this.portraits = {}; this.pendingDetails = {};
    this.characters = {};
    this.mode = 'loading';
    this.hud = new HUD();
    this.dialogue = new DialogueUI(this);
    this.inspect = new InspectUI(this);
    this.casefile = new CaseFileUI(this);
    this.board = new BoardUI(this);
    this.accuse = new AccuseUI(this);
    this.doneObjectives = new Set();
    this.senseT = 0; this.senseCd = 0; this.senseMarks = [];
    this.saveT = 0;
    this._onKey = this.onKey.bind(this);
    this._onLock = this.onLockChange.bind(this);
  }

  async load(onProgress) {
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#07080a');
    const camera = this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.05, 80);
    this.physics = new Physics();
    this.world = new World(scene, this.physics);
    this.player = new Player(camera, this.renderer.renderer.domElement, this.physics);
    this.player.touch = this.app.touch || null;
    this.applySettings();
    Assets.resetProgress(); Assets.onProgress = onProgress;
    try { const env = await Assets.hdri(this.mod.hdri); scene.environment = env; scene.environmentIntensity = 0.35; } catch (e) { console.warn(e); }
    // recorded character voices (assets/voice/<case>/index.json); the game stays silent-but-subtitled without them
    this.voiceIndex = await fetch(assetURL(`voice/${this.mod.id}/index.json`)).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
    this.ctx = { flags: {}, inspectModels: {}, images: {}, humSources: [], lightningLights: [], clockPos: null };
    await this.mod.buildLevel(this.world, this.ctx); // characters
    await Promise.all(this.mod.npcs.map(async def => {
      const c = new Character({ ...def });
      await c.load();
      scene.add(c.root);
      this.characters[def.id] = c;
      c.collider = this.physics.addCircle(def.position[0], def.position[2], def.seated ? 0.45 : 0.28, 'npc');
      // invisible interaction capsule
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, def.seated ? 1.3 : 1.8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      cap.position.y = def.seated ? 0.65 : 0.9;
      c.root.add(cap);
      this.world.interactable(cap, { id: 'npc_' + def.id, npc: def.id, label: () => 'تحدّث إلى ' + this.data.people[def.id].name });
    }));
    this.renderer.setup(scene, camera);
    this.renderer.applySettings(this.settings);
    // ray targets: interactables plus every solid static mesh (so walls block interaction)
    this.interactMeshes = [];
    scene.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (o.userData.interact || (m && !m.transparent && m.visible !== false)) this.interactMeshes.push(o);
    });
    this.player.surfaceAt = this.ctx.surfaceAt || (() => 'wood');
    // restore state
    const cs = this.g.cs;
    if (cs.player) this.player.setPose(cs.player.x, cs.player.z, cs.player.yaw, 0);
    else this.player.setPose(this.mod.playerStart.x, this.mod.playerStart.z, this.mod.playerStart.yaw);
    for (const [i, open] of Object.entries(cs.doors || {})) if (this.world.doors[i]) this.world.doors[i].setOpenInstant(open);
    if (this.mod.restore) this.mod.restore(this.g, this.ctx);
    for (const [id, m] of Object.entries(cs.moods || {})) if (this.characters[id]) this.characters[id].setMood(m);
    // warm up a frame then capture portraits
    try { await this.renderer.renderer.compileAsync(scene, camera); } catch (e) { console.warn(e); }
    this.renderer.render(0.016);
    await this.capturePortraits(); this.captureThumbs();
    Object.assign(this.portraits, this.ctx.portraits || {}); // people without a 3D character (e.g. a missing person)
    return this;
  }

  applySettings() {
    const s = this.settings;
    if (this.player) { this.player.sensitivity = s.sensitivity; this.player.invertY = s.invertY; this.player.headBob = s.headBob; }
    if (this.camera) { this.baseFov = s.fov; if (this.mode !== 'dialogue') { this.camera.fov = s.fov; this.camera.updateProjectionMatrix(); } }
  }

  async capturePortraits() {
    const r = this.renderer.renderer, gl = r.domElement;
    const cam = new THREE.PerspectiveCamera(22, gl.width / gl.height, 0.05, 20);
    // brighten the ambient term instead of adding lights (adding lights forces shader recompiles)
    let hemi = null; this.scene.traverse(o => { if (o.isHemisphereLight) hemi = o; });
    const hemiI = hemi ? hemi.intensity : 0; if (hemi) hemi.intensity = 1.1;
    const c2 = document.createElement('canvas'); c2.width = 240; c2.height = 288;
    const x2 = c2.getContext('2d');
    for (const [id, ch] of Object.entries(this.characters)) {
      ch.update(0.016, this.camera);
      ch.root.updateMatrixWorld(true);
      const head = ch.headPosition(new THREE.Vector3());
      const fwd = new THREE.Vector3(Math.sin(ch.root.rotation.y), 0, Math.cos(ch.root.rotation.y));
      cam.position.copy(head).addScaledVector(fwd, 1.3).add(new THREE.Vector3(0, 0.06, 0));
      cam.lookAt(head.x, head.y + 0.04, head.z);
      r.render(this.scene, cam);
      const hh = gl.height, ww = hh * (240 / 288);
      x2.drawImage(gl, (gl.width - ww) / 2, 0, ww, hh, 0, 0, 240, 288);
      this.portraits[id] = c2.toDataURL('image/jpeg', 0.85);
    }
    if (hemi) hemi.intensity = hemiI;
  }

  captureThumbs() {
    // generic thumbnails for documents (paper look)
    for (const [id, e] of Object.entries(this.data.evidence)) {
      if (e.view !== 'doc' && e.view !== 'rub') continue;
      const c = document.createElement('canvas'); c.width = 240; c.height = 140; const x = c.getContext('2d');
      x.fillStyle = e.doc && e.doc.hand ? '#fbf7dc' : '#efe6d0'; x.fillRect(0, 0, 240, 140);
      x.fillStyle = 'rgba(40,30,20,0.75)'; x.font = (e.doc && e.doc.hand ? '20px "Aref Ruqaa"' : 'bold 17px Amiri'); x.direction = 'rtl'; x.textAlign = 'right';
      const t = e.doc ? (e.doc.title || e.doc.body.split('\n')[0]) : e.name;
      x.fillText(t.slice(0, 30), 228, 34);
      x.fillStyle = 'rgba(40,30,20,0.25)'; for (let y = 56; y < 130; y += 16) x.fillRect(20, y, 200 - (y % 3) * 20, 3);
      this.thumbs[id] = c.toDataURL('image/jpeg', 0.8);
    }
  }

  // ------------------------------------------------------------------ lifecycle
  start() {
    window.addEventListener('keydown', this._onKey);
    document.addEventListener('pointerlockchange', this._onLock);
    audio.startRain(this.mod.rain ?? 1);
    audio.startMusic('investigation');
    if (this.ctx.clockPos) audio.addClock(() => this.ctx.clockPos);
    for (const p of this.ctx.humSources) audio.addHum(p, 100, 0.02);
    audio.onLightning = () => { this.renderer.flash = 1; for (const l of this.ctx.lightningLights) { const base = l.intensity; l.intensity = base * 6; setTimeout(() => (l.intensity = base), 140); } };
    this.hud.show(true);
    this.refreshObjectives(true);
    this.resume();
    this.firstHints();
    this.unsub = this.g.on((t) => { if (t === 'saved') this.hud.saved(); });
  }

  stop() {
    window.removeEventListener('keydown', this._onKey);
    document.removeEventListener('pointerlockchange', this._onLock);
    this.savePose(); this.g.saveNow();
    audio.stopAmbience(); audio.stopMusic(); audio.onLightning = null;
    this.player.enabled = false; this.player.unlock();
    this.hud.show(false);
    if (this.app.touch) this.app.touch.setVisible(false);
    for (const el of ['#dialogue', '#inspect', '#casefile', '#board', '#accuse', '#result', '#letterbox']) show($(el), false);
    this.unsub && this.unsub();
    this.mode = 'stopped';
  }

  firstHints() {
    if (!this.settings.hints) return;
    if (!this.g.cs.seenHints.move) {
      this.g.cs.seenHints.move = true;
      const msg = this.app.touch
        ? 'استخدم عصا الحركة في أسفل اليسار للمشي، واسحب بإصبعك على يمين الشاشة للنظر. اقترب من الرقيب سليم واضغط زر التفاعل للتحدث.'
        : 'حرّك الفأرة للنظر، واستخدم <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> للحركة. اقترب من الرقيب سليم واضغط <kbd>E</kbd> للتحدث.';
      setTimeout(() => this.hud.hint(msg, 9000), 1200);
    }
  }
  hintOnce(key, html, ms = 7000) {
    if (!this.settings.hints || this.g.cs.seenHints[key]) return;
    this.g.cs.seenHints[key] = true; this.hud.hint(html, ms);
  }

  resume() {
    this.mode = 'play';
    show($('#letterbox'), false);
    this.hud.show(true);
    this.player.enabled = true;
    if (this.app.touch) this.app.touch.setVisible(true);
    this.requestLock();
  }
  requestLock() {
    if (this.app.debugNoLock) { show($('#clicklock'), false); return; }
    // If Esc closed the UI, wait for the key to be released: Chromium treats a held Esc as "exit pointer lock".
    if (this.app.escHeld) { this.app.onEscUp = () => { if (this.mode === 'play') this.requestLock(); }; return; }
    this.player.lock();
    setTimeout(() => { if (this.mode === 'play' && !this.player.locked) { show($('#clicklock'), true); $('#clicklock').onclick = () => { show($('#clicklock'), false); this.player.lock(); }; } }, 250);
  }
  suspend(mode) {
    this.mode = mode;
    this.player.enabled = false;
    if (this.app.touch) this.app.touch.setVisible(false);
    this._expectUnlock = true;
    this.player.unlock();
    this.hud.setPrompt(null);
    show($('#clicklock'), false);
  }
  onLockChange() {
    if (this.player.locked) { show($('#clicklock'), false); this._expectUnlock = false; return; }
    if (this.mode === 'play' && !this._expectUnlock && !this.app.debugNoLock) this.app.openPause();
    this._expectUnlock = false;
  }

  onKey(e) {
    if (this.mode === 'play') {
      if (e.code === 'KeyE') this.tryInteract();
      else if (e.code === 'Tab') { e.preventDefault(); this.openCaseFile(); }
      else if (e.code === 'KeyB') this.openBoard();
      else if (e.code === 'KeyF') this.detectiveSense();
      else if (e.code === 'Escape' && this.app.debugNoLock) this.app.openPause();
    } else if (this.mode === 'casefile' && (e.code === 'Tab' || e.code === 'Escape')) { e.preventDefault(); if (document.activeElement && document.activeElement.tagName === 'TEXTAREA' && e.code === 'Tab') return; this.casefile.close(); }
    else if (this.mode === 'board' && (e.code === 'KeyB' || e.code === 'Escape')) { e.preventDefault(); this.board.close(); }
  }

  // ------------------------------------------------------------------ interaction
  currentTarget() {
    _ray.setFromCamera({ x: 0, y: 0 }, this.camera);
    _ray.far = 2.4;
    const hits = _ray.intersectObjects(this.interactMeshes, false);
    // first hit wins; invisible interaction volumes slightly in front of a wall still count
    for (const h of hits) {
      const def = h.object.userData.interact;
      if (def) return def;
      const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
      if (m && m.visible !== false) return null;
    }
    return null;
  }

  async tryInteract() {
    const def = this.target;
    if (!def || this.busy) return;
    this.busy = true;
    try { await this.interact(def); } finally { this.busy = false; }
  }

  async interact(def) {
    const g = this.g;
    if (def.npc) { this.suspend('dialogue'); await this.dialogue.open(def.npc); return; }
    if (def.blocked) { const msg = def.blocked(g); if (msg) { await this.observe(msg); return; } }
    if (def.before) { const r = def.before(); if (r === 'delay') return; }
    if (def.evidence) { await this.inspectEvidence(def.evidence, false, def); return; }
    if (def.action) {
      const text = def.action();
      if (text) {
        if (def.note && !g.flag('note:' + def.id)) { g.setFlag('note:' + def.id); g.log(def.note); this.hud.toast('evidence', 'ملاحظة في سجل المحقق', def.note); }
        await this.observe(text);
      }
    }
  }

  async observe(text) {
    this.suspend('observe');
    audio.paper();
    await this.hud.observation(text);
    this.resume();
  }

  async inspectEvidence(id, reinspect = false, def = null) {
    this.suspend('inspect');
    const factory = this.ctx.inspectModels[id];
    let model = null;
    try {
      if (factory) model = await factory();
      else if (def && def.object) { model = def.object.clone(true); }
      else { const d = this.world.interactables.find(x => x.evidence === id); if (d) model = d.object.clone(true); }
    } catch (e) { console.warn(e); }
    if (model) model.traverse(o => { if (o.isMesh && o.material && o.material.visible === false) o.visible = false; });
    this.hud.show(false);
    await this.inspect.open(id, { model, image: this.ctx.images[id], isNew: !this.g.cs.evidence[id] });
    this.hud.show(true);
    this.resume();
  }

  gainEvidence(id, thumb) {
    const g = this.g;
    if (!g.addEvidence(id)) return false;
    if (thumb) this.thumbs[id] = thumb;
    for (const d of this.pendingDetails[id] || []) g.revealDetail(id, d);
    delete this.pendingDetails[id];
    const e = this.data.evidence[id];
    audio.evidence();
    this.hud.toast('evidence', 'دليل جديد في ملف القضية', e.name);
    g.log('عثرت على: ' + e.name + ' — ' + e.short);
    this.refreshObjectives();
    this.hintOnce('ev1', 'أُضيف الدليل إلى ملف القضية. اضغط <kbd>Tab</kbd> في أي وقت لمراجعة الأدلة والأقوال.');
    if (Object.keys(g.cs.evidence).length + Object.keys(g.cs.statements).length >= 5) this.hintOnce('board', 'لديك ما يكفي لتبدأ الربط. اضغط <kbd>B</kbd> لفتح لوحة التحقيق، وصِل بين دليلين بخيط.', 8000);
    return true;
  }
  gainStatement(id) {
    const g = this.g;
    if (!g.addStatement(id)) return false;
    const s = this.data.statements[id];
    this.hud.toast('statement', 'إفادة مسجلة — ' + this.data.people[s.by].name, s.text.length > 70 ? s.text.slice(0, 68) + '…' : s.text);
    this.hintOnce('st1', 'الأقوال المهمة تُسجل تلقائيًا. خلال الحوار، استخدم «قدّم دليلًا أو إفادة» لمواجهة أي شخص بما تعرفه.', 8000);
    this.refreshObjectives();
    return true;
  }
  gainDeduction(id) {
    const g = this.g;
    if (!g.addDeduction(id)) return false;
    const d = this.data.deductions[id];
    audio.deduction();
    this.hud.toast('deduction', d.contradiction ? 'تناقض مكشوف' : 'استنتاج جديد', d.name);
    g.log('استنتاج: ' + d.text);
    for (const s of [...d.a, ...d.b]) if (this.data.statements[s] && this.data.statements[s].lie && d.contradiction) g.cs.flags['lie:' + s] = true;
    this.hintOnce('dd1', 'الاستنتاجات تُضاف إلى الملف، ويمكنك مواجهة المشتبه بهم بها وتقديمها كأدلة في الاتهام النهائي.', 8000);
    this.refreshObjectives();
    return true;
  }

  async voiceBuffer(npc, text) {
    const e = this.voiceIndex && this.voiceIndex[voiceKey(npc, text)];
    if (!e) return null;
    audio.init();
    return audio.loadVoice(assetURL(`voice/${this.mod.id}/${e.file}`));
  }

  findDeduction(a, b) {
    for (const [id, d] of Object.entries(this.data.deductions)) {
      if ((d.a.includes(a) && d.b.includes(b)) || (d.a.includes(b) && d.b.includes(a))) return id;
    }
    return null;
  }

  itemInfo(id) {
    const d = this.data;
    if (d.evidence[id]) { const e = d.evidence[id]; return { id, type: 'ev', kind: e.kind, name: e.name, short: e.short, thumb: this.thumbs[id] }; }
    if (d.statements[id]) { const s = d.statements[id]; return { id, type: 'st', kind: 'statement', name: s.text.length > 60 ? s.text.slice(0, 58) + '…' : s.text, short: '', by: d.people[s.by].name, lie: !!this.g.cs.flags['lie:' + id] }; }
    if (d.deductions[id]) { const x = d.deductions[id]; return { id, type: 'dd', kind: 'deduction', name: x.name, short: x.text }; }
    if (id.startsWith('p_')) { const p = d.people[id.slice(2)]; return { id, type: 'p', kind: 'person', name: p.name, short: p.role }; }
    return { id, type: '?', name: id };
  }
  itemsForPicker() {
    const cs = this.g.cs;
    return [...Object.keys(cs.evidence), ...Object.keys(cs.statements), ...Object.keys(cs.deductions)].map(id => this.itemInfo(id));
  }

  refreshObjectives(silent = false) {
    const list = this.data.objectives.map(o => ({ id: o.id, text: o.text, done: o.done(this.g) }));
    for (const o of list) if (o.done && !this.doneObjectives.has(o.id)) { this.doneObjectives.add(o.id); if (!silent) this.hud.toast('', 'مهمة منجزة', o.text); }
    const pending = list.filter(o => !o.done).slice(0, 3);
    this.hud.objectives(this.data.meta.title, pending.length ? pending : [{ text: 'القضية مغلقة', done: false }]);
  }

  // ------------------------------------------------------------------ UIs
  async openCaseFile(tab) {
    if (this.mode !== 'play') return;
    this.suspend('casefile'); this.hud.show(false);
    this.casefile.next = null;
    await this.casefile.open(tab);
    const next = this.casefile.next; this.casefile.next = null;
    // chained actions from inside the case file (no pointer re-lock in between)
    if (next === 'board') { this.mode = 'play'; return this.openBoard(); }
    if (next === 'accuse') return this.openAccusation();
    if (next && next.startsWith('inspect:')) return this.inspectEvidence(next.slice(8), true);
    this.hud.show(true); this.resume();
  }
  async openBoard() { if (this.mode !== 'play' && this.mode !== 'casefile') return; this.suspend('board'); this.hud.show(false); await this.board.open(); this.hud.show(true); this.resume(); }
  async openAccusation() {
    this.suspend('accuse'); this.hud.show(false);
    const r = await this.accuse.open();
    if (r === null) { this.hud.show(true); this.resume(); }
  }

  async enterDialogue(ch) {
    this.hud.show(false);
    show($('#letterbox'), true);
    ch.stopPatrol();
    const head = ch.headPosition(new THREE.Vector3());
    if (!ch.seated) ch.faceTowards(this.camera.position);
    ch.lookTarget = this.camera.position;
    const p = this.player;
    const dx = head.x - this.camera.position.x, dy = head.y - this.camera.position.y, dz = head.z - this.camera.position.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy - 0.05, Math.hypot(dx, dz));
    this.camTween = { y0: p.yaw, p0: p.pitch, y1: p.yaw + Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)), p1: pitch, f0: this.camera.fov, f1: Math.max(30, Math.min(48, 70 * Math.hypot(dx, dz) / 3.2)), t: 0 };
    await wait(450);
  }
  exitDialogue(ch) {
    if (ch) { ch.lookTarget = null; if (!ch.seated && !ch.patrol) ch.returnHome(); ch.resumePatrol(); ch.setState('idle'); }
    this.camTween = { y0: this.player.yaw, p0: this.player.pitch, y1: this.player.yaw, p1: this.player.pitch * 0.3, f0: this.camera.fov, f1: this.baseFov, t: 0 };
    this.g.saveSoon();
    if (!this.pendingAccusation && this.mode === 'dialogue') this.resume();
  }

  detectiveSense() {
    if (this.senseCd > 0) return;
    this.senseCd = 8; this.senseT = 4;
    audio.deduction();
    for (const m of this.senseMarks) this.scene.remove(m);
    this.senseMarks = [];
    const seen = new Set();
    const tex = this._ringTex || (this._ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 20, 64, 64, 62); gr.addColorStop(0, 'rgba(255,220,140,0)'); gr.addColorStop(0.7, 'rgba(255,210,120,0.9)'); gr.addColorStop(1, 'rgba(255,210,120,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })());
    for (const d of this.world.interactables) {
      if (d.npc || seen.has(d.evidence || d.id)) continue;
      if (d.evidence && this.g.cs.evidence[d.evidence]) continue;
      if (!d.evidence && this.g.flag('note:' + d.id)) continue;
      if (String(d.id).startsWith('door_')) continue;
      const b = new THREE.Box3().setFromObject(d.object); const c = b.getCenter(_v.clone());
      if (c.distanceTo(this.camera.position) > 7) continue;
      seen.add(d.evidence || d.id);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: d.evidence ? '#ffd27a' : '#9cc0e0', transparent: true, depthTest: false, opacity: 0 }));
      s.position.copy(c); s.scale.setScalar(d.evidence ? 0.35 : 0.25); s.renderOrder = 999;
      this.scene.add(s); this.senseMarks.push(s);
    }
    this.renderer.flash = 0.15;
    this.hud.toast('', 'حاسة المحقق', this.senseMarks.length ? 'تركيزك يلتقط تفاصيل قريبة تستحق الفحص.' : 'لا شيء لافت في الجوار.');
  }

  savePose() {
    if (!this.g.cs) return;
    this.g.cs.player = { x: +this.player.pos.x.toFixed(2), z: +this.player.pos.z.toFixed(2), yaw: +this.player.yaw.toFixed(3) };
    this.g.cs.doors = Object.fromEntries(this.world.doors.map((d, i) => [i, d.open]));
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    if (this.mode === 'stopped' || this.mode === 'loading') return;
    const cam = this.camera;
    this.player.update(dt);
    if (this.camTween) {
      const t = this.camTween; t.t = Math.min(1, t.t + dt * 2.2); const e = t.t * t.t * (3 - 2 * t.t);
      this.player.yaw = t.y0 + (t.y1 - t.y0) * e; this.player.pitch = t.p0 + (t.p1 - t.p0) * e;
      cam.fov = t.f0 + (t.f1 - t.f0) * e; cam.updateProjectionMatrix();
      this.player.apply(dt, 0);
      if (t.t >= 1) this.camTween = null;
    }
    this.world.update(dt);
    // NPCs glance at the player when close
    for (const ch of Object.values(this.characters)) {
      if (this.mode !== 'dialogue' || this.dialogue.ch !== ch) {
        const d = ch.root.position.distanceTo(cam.position);
        ch.lookTarget = d < 3.2 ? cam.position : null;
      }
      ch.update(dt, cam);
    }
    if (this.mode === 'play') {
      const t = this.currentTarget();
      this.target = t;
      if (t) {
        const label = typeof t.label === 'function' ? t.label() : t.label;
        this.hud.setPrompt(t, label, !!t.evidence, !!(t.evidence && this.g.cs.evidence[t.evidence]));
        if (this.app.touch) this.app.touch.setTarget(label);
      } else { this.hud.setPrompt(null); if (this.app.touch) this.app.touch.setTarget(null); }
      this.g.cs.elapsed += dt;
      this.saveT += dt;
      if (this.saveT > 8) { this.saveT = 0; this.savePose(); this.g.saveSoon(100); }
    }
    // detective sense markers
    if (this.senseCd > 0) this.senseCd -= dt;
    if (this.senseT > 0) {
      this.senseT -= dt;
      const a = Math.min(1, Math.min(this.senseT, 4 - this.senseT) * 2);
      for (const m of this.senseMarks) { m.material.opacity = a * (0.6 + Math.sin(performance.now() / 180) * 0.25); }
      if (this.senseT <= 0) { for (const m of this.senseMarks) this.scene.remove(m); this.senseMarks = []; }
    }
    cam.getWorldDirection(_v);
    audio.updateListener(cam.position, _v);
  }
}
