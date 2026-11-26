import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Assets } from './assets.js';
import { audio } from '../core/audio.js';

// ---------- helpers ----------
// Re-map BoxGeometry UVs to world-scale metres so tiled PBR textures keep a constant texel size.
export function worldUV(geo, sx, sy, sz, tile = 1, ox = 0, oy = 0, oz = 0) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox, y = pos.getY(i) + oy, z = pos.getZ(i) + oz;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    let u, v;
    if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
  return geo;
}

export function makeBox(w, h, d, mat, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const t = tile || (Array.isArray(mat) ? mat[0].userData.tileSize : mat.userData.tileSize) || 1;
  worldUV(g, w, h, d, t);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

const plainCache = {};
export function plain(color, roughness = 0.8, metalness = 0, extra = {}) {
  const key = color + ':' + roughness + ':' + metalness + JSON.stringify(extra);
  if (!plainCache[key]) plainCache[key] = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return plainCache[key];
}

// ---------- canvas textures ----------
export function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.userData.canvas = c;
  return t;
}

export function paperBG(ctx, w, h, tint = '#efe6d0', age = 0.5) {
  ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(90,60,20,${0.35 * age})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 6 * age; i++) {
    ctx.fillStyle = `rgba(120,80,30,${0.04 + Math.random() * 0.05})`;
    ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 0, Math.PI * 2); ctx.fill();
  }
}

// Draws right-to-left wrapped Arabic text. Returns final y.
export function drawText(ctx, text, x, y, maxW, lineH, font, color = '#1d1a16') {
  ctx.font = font; ctx.fillStyle = color; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); y += lineH; line = w; }
      else line = test;
    }
    ctx.fillText(line, x, y); y += lineH;
  }
  return y;
}

// A sheet of paper in the world with Arabic text on it.
export function paperMesh({ w = 0.21, h = 0.297, lines = '', title = '', hand = false, tint = '#efe6d0', px = 512, fontScale = 1 } = {}) {
  const ph = Math.round(px * h / w);
  const tex = canvasTexture(px, ph, (ctx) => {
    paperBG(ctx, px, ph, tint, 0.6);
    let y = px * 0.08;
    const pad = px * 0.08;
    if (title) y = drawText(ctx, title, px - pad, y, px - pad * 2, px * 0.065 * fontScale, `bold ${Math.round(px * 0.05 * fontScale)}px Amiri, serif`) + px * 0.02;
    drawText(ctx, lines, px - pad, y, px - pad * 2, px * (hand ? 0.07 : 0.055) * fontScale,
      hand ? `${Math.round(px * 0.05 * fontScale)}px "Aref Ruqaa", serif` : `${Math.round(px * 0.037 * fontScale)}px Amiri, serif`, hand ? '#1b2a4a' : '#1d1a16');
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  return m;
}

export function persianRugTexture(seed = 1, colors = ['#6b1a1a', '#1f2a44', '#c9a86a', '#2e4a3a']) {
  return canvasTexture(1024, 1536, (ctx, w, h) => {
    const [base, border, accent, alt] = colors;
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 6;
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = i % 2 ? accent : border; ctx.lineWidth = 30 - i * 6; ctx.strokeRect(30 + i * 34, 30 + i * 34, w - 60 - i * 68, h - 60 - i * 68); }
    ctx.fillStyle = border; ctx.fillRect(200, 200, w - 400, h - 400);
    ctx.fillStyle = base; ctx.fillRect(220, 220, w - 440, h - 440);
    ctx.save(); ctx.translate(w / 2, h / 2);
    for (let r = 0; r < 8; r++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = r % 2 ? accent : alt;
      ctx.beginPath(); ctx.ellipse(0, 120, 50, 140, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = border; ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(0, 0, 45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    for (let i = 0; i < 160; i++) { ctx.fillStyle = [accent, alt, border][i % 3]; const x = 240 + Math.random() * (w - 480), y = 240 + Math.random() * (h - 480); ctx.fillRect(x, y, 8, 8); }
    // wear
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 40; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    ctx.putImageData(img, 0, 0);
  });
}

// ---------- World builder ----------
export class World {
  constructor(scene, physics) {
    this.scene = scene; this.physics = physics;
    this.interactables = [];
    this.doors = [];
    this.updaters = [];
    this.surfaces = []; // {x0,z0,x1,z1,type}
    this.wallH = 2.9; this.wallT = 0.14;
    this.lights = [];
  }

  add(o) { this.scene.add(o); return o; }

  surfaceAt(x, z) {
    for (const s of this.surfaces) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s.type;
    return 'wood';
  }

  floor(x0, z0, x1, z1, mat, { y = 0, ceiling = null, surface = 'wood', ceilingH = this.wallH } = {}) {
    const w = x1 - x0, d = z1 - z0;
    const f = makeBox(w, 0.1, d, mat); f.position.set((x0 + x1) / 2, y - 0.05, (z0 + z1) / 2); f.castShadow = false;
    // world UV continuity for floors
    worldUV(f.geometry, w, 0.1, d, mat.userData.tileSize || 1, (x0 + x1) / 2, 0, (z0 + z1) / 2);
    this.add(f);
    if (ceiling) {
      const c = makeBox(w, 0.1, d, ceiling); c.position.set((x0 + x1) / 2, y + ceilingH + 0.05, (z0 + z1) / 2); c.castShadow = false;
      this.add(c);
    }
    this.surfaces.push({ x0, z0, x1, z1, type: surface });
    return f;
  }

  // Wall from (x0,z0) to (x1,z1) — must be axis aligned. matA faces +normal side (left of direction), matB other side.
  // openings: [{at, w, h, sill}] measured from the start point along the wall.
  wall(x0, z0, x1, z1, matA, matB = matA, openings = [], { h = this.wallH, trim = true } = {}) {
    const alongX = Math.abs(z1 - z0) < 1e-6;
    const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const dir = alongX ? Math.sign(x1 - x0) : Math.sign(z1 - z0);
    const T = this.wallT;
    const pieces = [];
    const ops = [...openings].sort((a, b) => a.at - b.at);
    let cur = 0;
    for (const o of ops) {
      if (o.at > cur) pieces.push([cur, o.at, 0, h]);
      if (o.sill > 0) pieces.push([o.at, o.at + o.w, 0, o.sill]);
      if (o.h < h) pieces.push([o.at, o.at + o.w, (o.sill || 0) + o.h, h]);
      cur = o.at + o.w;
    }
    if (cur < len) pieces.push([cur, len, 0, h]);
    const group = new THREE.Group();
    for (const [a, b, y0, y1] of pieces) {
      const pl = b - a, ph = y1 - y0;
      if (pl < 0.001 || ph < 0.001) continue;
      // materials order for box: +x,-x,+y,-y,+z,-z
      const edge = matA;
      let mats, geo;
      if (alongX) {
        geo = new THREE.BoxGeometry(pl, ph, T);
        // +z side vs -z side; "left of direction" when going +x is -z
        const left = dir > 0 ? matA : matB, right = dir > 0 ? matB : matA;
        mats = [edge, edge, edge, edge, right, left];
      } else {
        geo = new THREE.BoxGeometry(T, ph, pl);
        const left = dir > 0 ? matA : matB, right = dir > 0 ? matB : matA; // going +z, left is +x
        mats = [left, right, edge, edge, edge, edge];
      }
      const mid = (a + b) / 2 * dir;
      const cx = alongX ? x0 + mid : x0, cz = alongX ? z0 : z0 + mid;
      worldUV(geo, 0, 0, 0, matA.userData.tileSize || 1.5, cx, (y0 + y1) / 2, cz);
      const m = new THREE.Mesh(geo, mats);
      m.position.set(cx, (y0 + y1) / 2, cz);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      if (y0 < 1.8) this.physics.addBox(cx, cz, alongX ? pl / 2 : T / 2, alongX ? T / 2 : pl / 2, 0, y0, y1, 'wall');
    }
    if (trim) this._trims(group, x0, z0, x1, z1, alongX, dir, len, ops, h);
    this.add(group);
    return group;
  }

  _trims(group, x0, z0, x1, z1, alongX, dir, len, ops, h) {
    const base = plain('#e9e4da', 0.6), crown = plain('#efebe3', 0.6);
    const T = this.wallT;
    // baseboards between door openings, both sides
    let cur = 0; const segs = [];
    for (const o of ops) { if (!(o.sill > 0)) { if (o.at > cur) segs.push([cur, o.at]); cur = o.at + o.w; } }
    if (cur < len) segs.push([cur, len]);
    for (const side of [-1, 1]) {
      for (const [a, b] of segs) {
        const pl = b - a; if (pl < 0.05) continue;
        const g = alongX ? new THREE.BoxGeometry(pl, 0.1, 0.018) : new THREE.BoxGeometry(0.018, 0.1, pl);
        const m = new THREE.Mesh(g, base); m.receiveShadow = true;
        const mid = (a + b) / 2 * dir;
        m.position.set(alongX ? x0 + mid : x0 + side * (T / 2 + 0.009), 0.05, alongX ? z0 + side * (T / 2 + 0.009) : z0 + mid);
        group.add(m);
      }
      const g = alongX ? new THREE.BoxGeometry(len, 0.08, 0.05) : new THREE.BoxGeometry(0.05, 0.08, len);
      const c = new THREE.Mesh(g, crown);
      c.position.set(alongX ? x0 + len / 2 * dir : x0 + side * (T / 2 + 0.025), h - 0.04, alongX ? z0 + side * (T / 2 + 0.025) : z0 + len / 2 * dir);
      group.add(c);
    }
  }

  // Hinged door. hinge at (x,z), closed rotation `rot` (door extends along local +x), opens by `swing` radians.
  door({ x, z, rot = 0, w = 0.9, h = 2.08, swing = -1.7, mat, locked = false, lockedMsg = '', label = 'باب', onOpen = null, number = null, frameMat = null }) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0, z); pivot.rotation.y = rot;
    const leaf = new THREE.Group(); pivot.add(leaf);
    const panel = makeBox(w - 0.02, h - 0.01, 0.045, mat, 1); panel.position.set(w / 2, h / 2, 0); leaf.add(panel);
    // raised panels for detail
    const inset = plain('#000', 1); inset.visible = false;
    for (const [py, ph] of [[h * 0.72, h * 0.36], [h * 0.27, h * 0.38]]) {
      for (const sz of [1, -1]) {
        const p = makeBox(w * 0.66, ph, 0.012, mat, 1); p.position.set(w / 2, py, 0.028 * sz); leaf.add(p);
      }
    }
    const brass = plain('#b08d57', 0.3, 1);
    for (const sz of [1, -1]) {
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24), brass); rose.rotation.x = Math.PI / 2; rose.position.set(w - 0.08, 1.0, 0.03 * sz); leaf.add(rose);
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.12, 12), brass); lever.rotation.z = Math.PI / 2; lever.position.set(w - 0.13, 1.0, 0.06 * sz); leaf.add(lever);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 12), brass); neck.rotation.x = Math.PI / 2; neck.position.set(w - 0.08, 1.0, 0.045 * sz); leaf.add(neck);
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.006), plain('#222', 0.5, 0.8)); key.position.set(w - 0.08, 0.9, 0.025 * sz); leaf.add(key);
    }
    if (number) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.9, map: canvasTexture(128, 86, (c, W, H) => { c.fillStyle = '#b8925a'; c.fillRect(0, 0, W, H); c.fillStyle = '#2a1d0e'; c.font = 'bold 56px Cairo'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(number, W / 2, H / 2 + 4); }) }));
      plate.position.set(w / 2, 1.6, 0.04); leaf.add(plate);
    }
    // frame
    const fm = frameMat || plain('#efebe3', 0.55);
    const T = this.wallT + 0.04;
    const jambs = [[-0.03, h / 2, 0.06, h + 0.06], [w + 0.03, h / 2, 0.06, h + 0.06]];
    const frame = new THREE.Group(); frame.position.copy(pivot.position); frame.rotation.y = rot;
    for (const [fx, fy, fw, fh] of jambs) { const j = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, T), fm); j.position.set(fx, fy, 0); j.castShadow = true; frame.add(j); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.06, T), fm); top.position.set(w / 2, h + 0.03, 0); frame.add(top);
    this.add(frame);
    this.add(pivot);
    const collider = this.physics.addBox(0, 0, w / 2, 0.05, 0, 0, h, 'door');
    const d = { pivot, leaf, w, rot, swing, open: false, angle: 0, target: 0, locked, lockedMsg, collider, label, onOpen };
    const setCol = () => {
      const a = rot + d.angle;
      const cx = x + Math.cos(a) * w / 2, cz = z - Math.sin(a) * w / 2;
      this.physics.setBoxTransform(collider, cx, cz, a);
    };
    setCol();
    d.toggle = (force) => {
      if (d.locked) { audio.locked(); return false; }
      d.open = force !== undefined ? force : !d.open;
      d.target = d.open ? swing : 0;
      audio.door(d.open);
      if (d.open && d.onOpen) d.onOpen();
      return true;
    };
    d.setOpenInstant = (o) => { d.open = o; d.target = d.angle = o ? swing : 0; leaf.rotation.y = d.angle; setCol(); };
    this.updaters.push((dt) => {
      if (Math.abs(d.target - d.angle) > 0.001) {
        d.angle += (d.target - d.angle) * Math.min(1, dt * 4.5);
        leaf.rotation.y = d.angle; setCol();
      }
    });
    this.doors.push(d);
    this.interactable(leaf, {
      id: 'door_' + this.doors.length, label: () => (d.open ? 'إغلاق ' : 'فتح ') + label, verb: '',
      action: () => { if (!d.toggle()) return d.lockedMsg || 'الباب مقفل.'; },
    });
    return d;
  }

  // Window with frame, glass and a rainy night city behind it.
  window({ x, z, rot = 0, w = 1.2, h = 1.4, sill = 0.9 }) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const frameMat = plain('#dcd6cb', 0.5);
    const T = this.wallT + 0.03;
    const parts = [[0, sill + h / 2, w + 0.1, 0.06, 'v'], [0, sill + h / 2, 0.05, h, 'mid']];
    for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, h + 0.1, T), frameMat); s.position.set(sx * (w / 2 + 0.03), sill + h / 2, 0); g.add(s); }
    for (const sy of [sill - 0.03, sill + h + 0.03]) { const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.06, T), frameMat); s.position.set(0, sy, 0); g.add(s); }
    const mull = new THREE.Mesh(new THREE.BoxGeometry(0.045, h, 0.06), frameMat); mull.position.set(0, sill + h / 2, 0); g.add(mull);
    const trans = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.06), frameMat); trans.position.set(0, sill + h * 0.72, 0); g.add(trans);
    const sillBoard = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.04, 0.26), plain('#d8d2c4', 0.4)); sillBoard.position.set(0, sill - 0.04, -0.06); sillBoard.castShadow = true; g.add(sillBoard);
    // latch (interactable)
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.03), plain('#9c8458', 0.35, 1)); latch.position.set(0.05, sill + h * 0.45, -0.05); g.add(latch);
    // glass with animated rain
    const rainTex = this.rainTexture();
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#7f8b99', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, envMapIntensity: 2.2, normalMap: rainTex, normalScale: new THREE.Vector2(0.8, 0.8), depthWrite: false }));
    glass.position.set(0, sill + h / 2, 0); g.add(glass);
    // night city backdrop
    const city = this.cityTexture();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 6, h * 4), new THREE.MeshBasicMaterial({ map: city, toneMapped: true, fog: false }));
    back.position.set(0, sill + h / 2 - 0.4, 6); back.rotation.y = Math.PI; g.add(back);
    // rain streaks outside
    const N = 220, pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const px = (Math.random() - 0.5) * w * 2.4, py = Math.random() * 4, pz = 0.4 + Math.random() * 2.5; pos.set([px, py, pz, px - 0.01, py - 0.18, pz], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#9fb3c8', transparent: true, opacity: 0.35 }));
    rain.position.y = sill - 1; g.add(rain);
    this.updaters.push((dt) => {
      const a = rg.attributes.position.array;
      for (let i = 0; i < N; i++) { const o = i * 6; a[o + 1] -= dt * 9; a[o + 4] -= dt * 9; if (a[o + 4] < 0) { a[o + 1] += 4; a[o + 4] += 4; } }
      rg.attributes.position.needsUpdate = true;
      rainTex.offset.y += dt * 0.05;
    });
    this.add(g);
    return { group: g, latch };
  }

  rainTexture() {
    if (this._rainTex) return this._rainTex;
    const t = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = 'rgb(128,128,255)'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 1 + Math.random() * 3.5;
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        g.addColorStop(0, 'rgb(90,90,255)'); g.addColorStop(1, 'rgb(170,170,255)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.3, 0, 0, Math.PI * 2); ctx.fill();
        if (Math.random() < 0.15) { ctx.strokeStyle = 'rgba(100,100,255,0.6)'; ctx.lineWidth = r * 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 4, y + 10 + Math.random() * 30); ctx.stroke(); }
      }
    }, false);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
    return (this._rainTex = t);
  }

  cityTexture() {
    if (this._city) return this._city;
    return (this._city = canvasTexture(1024, 512, (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#05070c'); sky.addColorStop(0.6, '#0d1420'); sky.addColorStop(1, '#1c1a1c');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      for (let layer = 0; layer < 3; layer++) {
        let x = 0;
        while (x < w) {
          const bw = 40 + Math.random() * 110, bh = h * (0.25 + Math.random() * 0.45) * (1 - layer * 0.15);
          const shade = 10 + layer * 8;
          ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
          ctx.fillRect(x, h - bh, bw, bh);
          for (let wy = h - bh + 10; wy < h - 10; wy += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 12) {
            if (Math.random() < 0.22 - layer * 0.05) { const warm = Math.random() < 0.7; ctx.fillStyle = warm ? `rgba(255,${180 + Math.random() * 50 | 0},110,${0.5 + Math.random() * 0.4})` : 'rgba(170,200,255,0.6)'; ctx.fillRect(wx, wy, 6, 8); }
          }
          x += bw + Math.random() * 10;
        }
      }
      ctx.fillStyle = 'rgba(120,130,150,0.08)'; for (let i = 0; i < 400; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 1, 12);
    }));
  }

  // Place a glTF prop model. opts: {pos:[x,y,z], rot, scale, collide, fitHeight, fitWidth}
  async prop(id, { pos = [0, 0, 0], rot = 0, scale = 1, collide = true, fit = null, shrink = 0.02, castShadow = true, parent = null } = {}) {
    let m;
    try { m = await Assets.modelInstance(id); } catch (e) { console.warn('model missing', id); return null; }
    const holder = new THREE.Group();
    holder.add(m);
    if (fit) { // scale to fit a given size in metres: {h} or {w}
      const b = new THREE.Box3().setFromObject(m); const s = new THREE.Vector3(); b.getSize(s);
      const f = fit.h ? fit.h / s.y : fit.w ? fit.w / Math.max(s.x, s.z) : 1;
      m.scale.multiplyScalar(f);
    }
    m.scale.multiplyScalar(scale);
    holder.position.set(...pos); holder.rotation.y = rot;
    m.traverse(o => { if (o.isMesh) { o.castShadow = castShadow; o.receiveShadow = true; } });
    (parent || this.scene).add(holder);
    holder.updateMatrixWorld(true);
    if (collide) this._oriCollider(holder, shrink);
    return holder;
  }

  // oriented footprint collider for rotated props
  _oriCollider(holder, shrink = 0.02) {
    const inner = holder.children[0];
    const rot = holder.rotation.y;
    holder.rotation.y = 0; holder.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(inner);
    holder.rotation.y = rot; holder.updateMatrixWorld(true);
    if (b.isEmpty()) return;
    const lx = (b.min.x + b.max.x) / 2 - holder.position.x, lz = (b.min.z + b.max.z) / 2 - holder.position.z;
    const c = Math.cos(rot), s = Math.sin(rot);
    const wx = holder.position.x + lx * c + lz * s, wz = holder.position.z - lx * s + lz * c;
    return this.physics.addBox(wx, wz, Math.max(0.03, (b.max.x - b.min.x) / 2 - shrink), Math.max(0.03, (b.max.z - b.min.z) / 2 - shrink), rot, b.min.y, b.max.y, 'prop');
  }

  // Register an interactable. obj: mesh/group; def: {id,label,action,evidence?,...}
  interactable(obj, def) {
    // non-enumerable so Object3D.clone() (which JSON-copies userData) skips it
    obj.traverse(o => { Object.defineProperty(o.userData, 'interact', { value: def, enumerable: false, configurable: true, writable: true }); });
    def.object = obj;
    this.interactables.push(def);
    return def;
  }

  // Invisible interaction volume.
  zone(x, y, z, w, h, d, def, rot = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, z); m.rotation.y = rot;
    this.add(m);
    return this.interactable(m, def);
  }

  // Lights ---------------------------------------------------------
  spot(x, y, z, tx, ty, tz, { color = '#ffd9a8', intensity = 30, angle = 1.0, penumbra = 0.7, distance = 12, shadow = true, decay = 2 } = {}) {
    const l = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
    l.position.set(x, y, z); l.target.position.set(tx, ty, tz);
    l.userData.wantsShadow = shadow;
    l.castShadow = shadow; l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; l.shadow.mapSize.set(1024, 1024); l.shadow.camera.near = 0.1;
    this.add(l); this.add(l.target); this.lights.push(l);
    return l;
  }
  point(x, y, z, { color = '#ffcf9a', intensity = 4, distance = 7, decay = 2 } = {}) {
    const l = new THREE.PointLight(color, intensity, distance, decay);
    l.position.set(x, y, z); l.castShadow = false;
    this.add(l); this.lights.push(l);
    return l;
  }

  update(dt) { for (const u of this.updaters) u(dt); }

  // Rounded white appliance etc.
  rounded(w, h, d, r, mat) { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); m.castShadow = true; m.receiveShadow = true; return m; }
}
