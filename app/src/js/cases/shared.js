// Helpers shared by the levels of cases 3 and later.
import * as THREE from 'three';
import { makeBox, plain, paperMesh, canvasTexture } from '../engine/world.js';

// Paints the fictional «شرطة» sleeve patches onto the sergeant's uniform texture.
export function patchPoliceUniform(ctx, w, h) {
  const s = w / 2048;
  const cover = (x, y, ww, hh, sx, sy) => ctx.drawImage(ctx.canvas, sx * s, sy * s, ww * s, hh * s, x * s, y * s, ww * s, hh * s);
  cover(222, 1012, 156, 116, 222, 1190);
  cover(1664, 982, 160, 162, 1664, 1180);
  const patch = (cx, cy, r) => {
    ctx.save(); ctx.translate(cx * s, cy * s); ctx.scale(s, s);
    ctx.fillStyle = '#1b2a4a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r - 7, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e8c574'; ctx.font = `bold ${Math.round(r * 0.55)}px Cairo`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText('شرطة', 0, 2);
    ctx.restore();
  };
  patch(298, 1070, 50); patch(1742, 1063, 56);
}

export const SALIM = { id: 'salim', name: 'الرقيب سليم', gender: 'm', height: 1.81, mood: 'calm', texturePatch: { body: patchPoliceUniform } };

export const rtl = (c, font, color, align = 'right') => { c.font = font; c.fillStyle = color; c.direction = 'rtl'; c.textAlign = align; c.textBaseline = 'middle'; };

// Wall/opening helpers bound to a world.
export function wallHelpers(world) {
  return {
    wallX: (z, x0, x1, north, south, ops = []) => world.wall(x0, z, x1, z, north, south, ops),
    wallZ: (x, z0, z1, east, west, ops = []) => world.wall(x, z0, x, z1, east, west, ops),
  };
}

// Emissive ceiling panel / lamp disc (cheap: no real light).
export function ceilingPanel(scene, x, z, w = 0.6, d = 1.2, y = 2.885, color = '#f4f7ff', intensity = 1.6) {
  const p = makeBox(w, 0.03, d, new THREE.MeshStandardMaterial({ color: '#fff', emissive: color, emissiveIntensity: intensity }));
  p.castShadow = false; p.position.set(x, y, z); scene.add(p); return p;
}

// Simple box desk with drawer pedestals. Returns { group, top, drawers[] } — drawers on the sitter's side (-z local).
export function makeDesk(world, { x, z, rot = 0, w = 1.5, d = 0.75, h = 0.76, mat }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; world.scene.add(g);
  const top = makeBox(w, 0.045, d, mat); top.position.y = h - 0.022; g.add(top);
  const modesty = makeBox(w * 0.5, 0.45, 0.025, mat); modesty.position.set(0, h - 0.3, d / 2 - 0.04); g.add(modesty);
  const pw = w * 0.26;
  const drawers = [];
  const knobMat = plain('#b58f4f', 0.3, 1);
  for (const sx of [-1, 1]) {
    const p = makeBox(pw, h - 0.05, d - 0.04, mat); p.position.set(sx * (w / 2 - pw / 2), (h - 0.05) / 2, 0); g.add(p);
    for (let i = 0; i < 3; i++) {
      const dr = new THREE.Group(); dr.position.set(sx * (w / 2 - pw / 2), h - 0.16 - i * 0.22, -(d / 2 - 0.01)); g.add(dr);
      const face = makeBox(pw - 0.04, 0.18, 0.02, mat); dr.add(face);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), knobMat); knob.position.z = -0.02; dr.add(knob);
      drawers.push(dr);
    }
  }
  world.physics.addBox(x, z, w / 2 + 0.02, d / 2 + 0.02, rot, 0, h);
  return { group: g, top: h, drawers };
}

// A paper sheet lying flat.
export function flatPaper(scene, opts, x, y, z, rz = 0) {
  const p = paperMesh(opts); p.rotation.x = -Math.PI / 2; p.rotation.z = rz; p.position.set(x, y + 0.002, z); scene.add(p); return p;
}

// Hard-cover book (closed).
export function makeBook(color = '#5a2a1e', w = 0.16, h = 0.035, d = 0.23, title = '') {
  const g = new THREE.Group();
  const cover = makeBox(w, h, d, plain(color, 0.6)); cover.position.y = h / 2; g.add(cover);
  const pages = makeBox(w - 0.008, h - 0.008, d - 0.01, plain('#efe6d0', 0.9)); pages.position.set(0.004, h / 2, 0); g.add(pages);
  if (title) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, d * 0.25), new THREE.MeshStandardMaterial({ transparent: true, map: canvasTexture(256, 72, (c, W, H) => { rtl(c, 'bold 34px Amiri', '#e0c27a', 'center'); c.fillText(title, W / 2, H / 2); }) }));
    t.rotation.x = -Math.PI / 2; t.position.y = h + 0.001; g.add(t);
  }
  return g;
}

// A row of book spines with Arabic year labels (diaries etc.).
export function spineRow(labels, { colors = ['#3d2a1d', '#5b2420', '#23384f', '#2e4a33'], w = 0.05, h = 0.25, d = 0.19, dust = 0 } = {}) {
  const g = new THREE.Group();
  labels.forEach((lb, i) => {
    const col = colors[i % colors.length];
    const tex = canvasTexture(64, 320, (c, W, H) => {
      c.fillStyle = col; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, 4, H); c.fillRect(W - 4, 0, 4, H);
      c.save(); c.translate(W / 2, H / 2); c.rotate(-Math.PI / 2); rtl(c, 'bold 30px Cairo', '#e3c98a', 'center'); c.fillText(lb, 0, 2); c.restore();
      if (dust) { c.fillStyle = `rgba(190,185,175,${dust})`; c.fillRect(0, 0, W, H); }
    });
    const side = plain(col, 0.7);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, plain('#d9cfb8'), side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }), side]);
    b.position.set((i - (labels.length - 1) / 2) * (w + 0.004), h / 2, 0); b.castShadow = true; g.add(b);
  });
  return g;
}

// Old dial telephone.
export function makeDialPhone(color = '#1d1d1f') {
  const g = new THREE.Group();
  const m = plain(color, 0.35, 0.1);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 20), m); base.position.y = 0.04; base.scale.z = 0.8; g.add(base);
  const hs = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.16, 4, 10), m); hs.rotation.z = Math.PI / 2; hs.position.y = 0.11; g.add(hs);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20), plain('#d8d2c2', 0.4)); dial.position.set(0, 0.07, 0.055); dial.rotation.x = 1.0; g.add(dial);
  return g;
}

// Handbag / carry bag.
export function makeBag(color = '#3a2a22', w = 0.38, h = 0.28, d = 0.14, world) {
  const g = new THREE.Group();
  const leather = plain(color, 0.7);
  const b = world.rounded(w, h, d, 0.03, leather); b.position.y = h / 2; g.add(b);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(w * 0.36, 0.011, 6, 20, Math.PI), leather); strap.position.y = h; g.add(strap);
  return g;
}

export { makeBox, plain, paperMesh, canvasTexture };
