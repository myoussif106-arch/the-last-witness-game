import * as THREE from 'three';
import { Assets } from '../../engine/assets.js';
import { makeBox, plain, paperMesh, canvasTexture } from '../../engine/world.js';
import { SALIM, rtl, wallHelpers, makeDesk, flatPaper } from '../shared.js';

// Layout (metres, top view, north = -Z). An old pharmacy after closing time.
//   Shop        x -4.5..4.5  z -2..4   (shop front with glass and a half-lowered shutter on z = 4)
//   Back room   x -4.5..4.5  z -7..-2  (store, lab bench, small office corner) — doorway at x 3.2..4.1

export const NPCS = [
  { ...SALIM, position: [0.9, 0, 2.1], rotation: -0.3 },
  { id: 'mostafa', name: 'مصطفى', gender: 'm', height: 1.77, position: [-3.4, 0, 2.7], rotation: Math.PI / 2 - 0.2, mood: 'sad' },
  { id: 'fathi', name: 'عم فتحي', gender: 'm', height: 1.70, position: [3.1, 0, 3.0], rotation: -Math.PI / 2 - 0.2, mood: 'nervous' },
  { id: 'reem', name: 'د. ريم', gender: 'f', height: 1.65, position: [-1.0, 0, -0.45], rotation: 0.15, mood: 'nervous' },
  { id: 'wael', name: 'د. وائل', gender: 'm', height: 1.79, position: [1.8, 0, -4.3], rotation: 0.8, mood: 'calm' },
  { id: 'nahed', name: 'ناهد', gender: 'f', height: 1.63, position: [-3.35, 0, -4.1], rotation: Math.PI / 2, mood: 'calm', seated: true },
];

export const PLAYER_START = { x: 0.0, z: 3.35, yaw: 0 };

function fouadPortrait(c, w, h) {
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#9fb0a2'); bg.addColorStop(1, '#5f6f63'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const cx = w / 2;
  c.fillStyle = '#f2f2ee'; c.beginPath(); c.ellipse(cx, h * 1.02, w * 0.47, h * 0.37, 0, Math.PI, 0); c.fill(); // white coat
  c.fillStyle = '#4a5a6e'; c.beginPath(); c.moveTo(cx - w * 0.08, h * 0.68); c.lineTo(cx, h * 0.86); c.lineTo(cx + w * 0.08, h * 0.68); c.fill();
  c.fillStyle = '#bf9470'; c.fillRect(cx - w * 0.07, h * 0.5, w * 0.14, h * 0.18);
  c.beginPath(); c.ellipse(cx, h * 0.4, w * 0.2, h * 0.21, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#9b9690'; c.beginPath(); c.ellipse(cx, h * 0.24, w * 0.18, h * 0.06, 0, Math.PI, 0); c.fill();
  c.fillStyle = '#6e6a66'; c.beginPath(); c.ellipse(cx, h * 0.51, w * 0.08, h * 0.02, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 3; c.strokeRect(cx - w * 0.15, h * 0.37, w * 0.12, h * 0.07); c.strokeRect(cx + w * 0.03, h * 0.37, w * 0.12, h * 0.07);
  c.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 600; i++) c.fillRect(Math.random() * w, Math.random() * h, 1, 1);
}

// The 2014 crime-scene photograph (shown in the image viewer).
function crimePhoto(w = 1200, h = 800) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = '#4b3a2a'; x.fillRect(0, 0, w, h);
  // back wall with shelves
  x.fillStyle = '#8c7a5e'; x.fillRect(0, 0, w, h * 0.55);
  for (let s = 0; s < 3; s++) { x.fillStyle = '#5b3f26'; x.fillRect(0, 60 + s * 120, w * 0.62, 12); for (let i = 0; i < 26; i++) { x.fillStyle = ['#c0392b', '#2e86c1', '#f4f1ea', '#27ae60', '#e1b12c'][(i * 7 + s) % 5]; x.fillRect(12 + i * 27, 72 + s * 120 - 54, 22, 54); } }
  // brass set shelf (one gap)
  x.fillStyle = '#5b3f26'; x.fillRect(w * 0.68, 210, w * 0.3, 12);
  const brass = (bx, r, hh) => { x.fillStyle = '#9c7a3a'; x.beginPath(); x.moveTo(bx - r, 210); x.lineTo(bx - r * 0.7, 210 - hh); x.lineTo(bx + r * 0.7, 210 - hh); x.lineTo(bx + r, 210); x.fill(); };
  brass(w * 0.71, 18, 26); brass(w * 0.75, 20, 34); brass(w * 0.8, 24, 40); brass(w * 0.855, 28, 48); brass(w * 0.91, 30, 52);
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.setLineDash([6, 6]); x.lineWidth = 3; x.beginPath(); x.ellipse(w * 0.96, 205, 30, 8, 0, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
  // counter
  x.fillStyle = '#6b4a2c'; x.fillRect(0, h * 0.55, w * 0.7, 60); x.fillStyle = '#d9d2c2'; x.fillRect(0, h * 0.55 - 10, w * 0.7, 12);
  for (const [cx, full] of [[w * 0.3, true], [w * 0.38, false]]) { x.fillStyle = '#f3f0e8'; x.beginPath(); x.moveTo(cx - 18, h * 0.55 - 10); x.lineTo(cx - 14, h * 0.55 - 44); x.lineTo(cx + 14, h * 0.55 - 44); x.lineTo(cx + 18, h * 0.55 - 10); x.fill(); x.fillStyle = full ? '#3a2412' : '#8a6a4a'; x.fillRect(cx - 13, h * 0.55 - 44, 26, 5); }
  // floor + fallen clock
  x.fillStyle = '#3a2e26'; x.fillRect(0, h * 0.62, w, h * 0.38);
  for (let i = 0; i < 10; i++) { x.strokeStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.moveTo(0, h * 0.62 + i * 34); x.lineTo(w, h * 0.62 + i * 34); x.stroke(); }
  const ccx = w * 0.62, ccy = h * 0.82;
  x.fillStyle = '#efe9d8'; x.beginPath(); x.ellipse(ccx, ccy, 80, 56, 0.15, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#2a2018'; x.lineWidth = 8; x.stroke();
  x.save(); x.translate(ccx, ccy); x.scale(1, 0.7); x.rotate(0.15);
  x.strokeStyle = '#111'; x.lineWidth = 6; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.sin(Math.PI * 2 * 11.87 / 12) * 42, -Math.cos(Math.PI * 2 * 11.87 / 12) * 42); x.stroke();
  x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.sin(Math.PI * 2 * 52 / 60) * 64, -Math.cos(Math.PI * 2 * 52 / 60) * 64); x.stroke();
  for (let i = 0; i < 12; i++) { x.fillStyle = '#111'; x.fillRect(Math.sin(i * Math.PI / 6) * 66 - 2, -Math.cos(i * Math.PI / 6) * 66 - 2, 5, 5); }
  x.restore();
  x.strokeStyle = 'rgba(230,240,255,0.7)'; x.lineWidth = 2; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(ccx - 70 + i * 18, ccy - 40); x.lineTo(ccx - 50 + i * 15, ccy + 30); x.stroke(); }
  // evidence markers
  const mark = (mx, my, n) => { x.fillStyle = '#f1c40f'; x.beginPath(); x.moveTo(mx - 16, my + 14); x.lineTo(mx, my - 18); x.lineTo(mx + 16, my + 14); x.fill(); x.fillStyle = '#111'; x.font = 'bold 18px Cairo'; x.textAlign = 'center'; x.fillText(n, mx, my + 10); };
  mark(ccx + 110, ccy, '1'); mark(w * 0.34, h * 0.48, '2'); mark(w * 0.96, 250, '3');
  // flash + vignette + date stamp
  const vg = x.createRadialGradient(w * 0.45, h * 0.45, h * 0.2, w * 0.5, h * 0.5, h * 0.95); vg.addColorStop(0, 'rgba(255,250,235,0.18)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)'); x.fillStyle = vg; x.fillRect(0, 0, w, h);
  x.fillStyle = '#ff8a2a'; x.font = 'bold 34px monospace'; x.textAlign = 'right'; x.fillText("15 03 '14", w - 30, h - 30);
  return c;
}

// Shelf unit packed with medicine boxes (one texture per row).
function medShelf(world, { x, z, rot = 0, w = 2.4, h = 2.4, d = 0.38, rows = 6, mat }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; world.scene.add(g);
  const back = makeBox(w, h, 0.03, mat); back.position.set(0, h / 2, -d / 2 + 0.015); g.add(back);
  for (const sx of [-1, 1]) { const s = makeBox(0.04, h, d, mat); s.position.set(sx * (w / 2 - 0.02), h / 2, 0); g.add(s); }
  const boxTex = (seed) => canvasTexture(1024, 128, (c, W, H) => {
    let px = 4, i = seed;
    while (px < W - 10) { const bw = 40 + ((i * 37) % 50); const bh = 70 + ((i * 53) % 50); const col = ['#c0392b', '#2e86c1', '#f4f1ea', '#27ae60', '#e1b12c', '#8e44ad', '#ecf0f1', '#d35400'][(i * 5) % 8];
      c.fillStyle = '#2b1d12'; c.fillRect(px, 0, bw + 4, H); c.fillStyle = col; c.fillRect(px, H - bh, bw, bh); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px, H - bh, 3, bh);
      c.fillStyle = col === '#f4f1ea' || col === '#ecf0f1' ? '#2e86c1' : '#fff'; c.fillRect(px + 6, H - bh + 12, bw - 12, 8); px += bw + 3; i++; }
  });
  for (let r = 0; r < rows; r++) {
    const y = 0.12 + r * (h - 0.2) / rows;
    const sh = makeBox(w - 0.06, 0.025, d, mat); sh.position.set(0, y, 0); g.add(sh);
    const row = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 0.22), new THREE.MeshStandardMaterial({ map: boxTex(r * 11 + Math.round(x * 3)), roughness: 0.6 }));
    row.position.set(0, y + 0.125, d / 2 - 0.06); g.add(row);
  }
  const top = makeBox(w + 0.06, 0.08, d + 0.04, mat); top.position.y = h + 0.04; g.add(top);
  world.physics.addBox(x, z, w / 2, d / 2, rot, 0, h);
  return g;
}

export async function buildLevel(world, ctx) {
  const { scene } = world;
  const T = (id, o) => Assets.pbr(id, o);
  const { wallX, wallZ } = wallHelpers(world);
  const [floorTiles, backFloor, plaster, greenWall, concrete, wood, darkWood] = await Promise.all([
    T('floor_tiles_06', { size: 0.8, roughness: 0.45 }),
    T('concrete_wall_008', { size: 2, color: '#7d786f' }),
    T('painted_plaster_wall', { size: 2.5, color: '#e3dccb', normalScale: 0.5 }),
    T('beige_wall_001', { size: 2.5, color: '#7e9a88', normalScale: 0.5 }),
    T('concrete_wall_008', { size: 3, color: '#8a8780' }),
    T('kitchen_wood', { size: 1.2, roughness: 0.5, color: '#6b4528' }),
    T('kitchen_wood', { size: 1.2, roughness: 0.45, color: '#3d2716' }),
  ]);
  const ceiling = plain('#e6e1d4', 0.95);
  const exterior = concrete;

  // ---------------- floors ----------------
  world.floor(-4.5, -2, 4.5, 4, floorTiles, { ceiling, surface: 'tile' });
  world.floor(-4.5, -7, 4.5, -2, backFloor, { ceiling: plain('#d1ccbf', 0.95), surface: 'tile' });

  // ---------------- walls ----------------
  wallX(4, -4.5, 4.5, plaster, exterior, [{ at: 0.4, w: 3.2, h: 1.8, sill: 0.55 }, { at: 3.95, w: 1.1, h: 2.2 }, { at: 5.4, w: 2.7, h: 1.8, sill: 0.55 }]);
  wallX(-7, -4.5, 4.5, exterior, plaster, [{ at: 3.8, w: 1.2, h: 0.6, sill: 1.9 }]);
  wallZ(-4.5, -2, 4, greenWall, exterior);
  wallZ(-4.5, -7, -2, plaster, exterior);
  wallZ(4.5, -2, 4, exterior, greenWall);
  wallZ(4.5, -7, -2, exterior, plaster);
  wallX(-2, -4.5, 4.5, greenWall, plaster, [{ at: 7.7, w: 0.95, h: 2.15 }]);

  // ---------------- shop front: windows, glass door, half-lowered shutter ----------------
  world.window({ x: -2.5, z: 4, rot: 0, w: 3.2, h: 1.8, sill: 0.55 });
  world.window({ x: 2.25, z: 4, rot: 0, w: 2.7, h: 1.8, sill: 0.55 });
  const glassDoor = new THREE.Group(); glassDoor.position.set(0.0, 0, 4.0); scene.add(glassDoor);
  { const fr = plain('#2b2b2b', 0.4, 0.7);
    for (const [w, h, x, y] of [[0.05, 2.2, -0.53, 1.1], [0.05, 2.2, 0.53, 1.1], [1.1, 0.05, 0, 2.18], [1.1, 0.1, 0, 0.05], [1.1, 0.04, 0, 1.0]]) { const b = makeBox(w, h, 0.05, fr); b.position.set(x, y, 0); glassDoor.add(b); }
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 2.1), new THREE.MeshStandardMaterial({ color: '#8fa0ad', transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false })); gl.position.y = 1.1; glassDoor.add(gl);
    const sign = paperMesh({ w: 0.36, h: 0.14, lines: 'مغلق — نعود صباحًا', tint: '#f6efe0', px: 300, fontScale: 1.4 }); sign.position.set(0, 1.45, -0.03); sign.rotation.y = Math.PI; glassDoor.add(sign); }
  world.physics.addBox(0, 4, 0.55, 0.05, 0, 0, 2.2);
  world.interactable(glassDoor, { id: 'f_door', label: 'باب الصيدلية', action: () => 'باب زجاجي، وخلفه الصاج الحديدي نازل إلى نصفه، كما أنزله مصطفى تلك الليلة. من الداخل لا يُرى الشارع إلا من فوق حافته: الرصيف المبلل، وكشك عم فتحي على الناصية.' });
  { const corr = canvasTexture(256, 256, (c, w, h) => { c.fillStyle = '#6b6e72'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = '#878a8e'; c.fillRect(0, y, w, 6); c.fillStyle = '#4c4f53'; c.fillRect(0, y + 12, w, 3); } });
    corr.wrapS = corr.wrapT = THREE.RepeatWrapping; corr.repeat.set(4, 4);
    const shutter = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshStandardMaterial({ map: corr, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
    shutter.position.set(0, 2.05, 4.35); scene.add(shutter); }
  // street lamp + kiosk silhouette outside
  const street = world.spot(2.5, 4.2, 7.5, 0.5, 0, 2.5, { color: '#ffb35c', intensity: 22, angle: 0.7, penumbra: 0.7, distance: 12, shadow: false });
  ctx.lightningLights.push(street);
  { const kiosk = makeBox(1.2, 2.2, 1.0, plain('#2a3a2a', 0.8)); kiosk.position.set(4.2, 1.1, 8.5); scene.add(kiosk);
    const kl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); kl.position.set(4.2, 1.5, 7.99); kl.rotation.y = Math.PI; scene.add(kl);
    const pave = makeBox(12, 0.1, 6, plain('#2a2a2c', 0.2, 0.1)); pave.position.set(0, -0.05, 7.2); scene.add(pave); }

  // ================= SHOP =================
  world.point(-1.5, 2.6, 1.2, { color: '#f3f6ff', intensity: 4.5, distance: 8 });
  world.point(2.6, 2.6, 1.6, { color: '#fff1da', intensity: 3.5, distance: 7 });
  world.spot(-0.6, 2.85, 0.2, -0.6, 1.0, 0.8, { color: '#fff4e2', intensity: 10, angle: 0.8, penumbra: 0.8, distance: 5 });
  for (const [x, z] of [[-1.8, 1.2], [1.8, 1.2], [-1.8, -4.5], [1.8, -4.5]]) { const p = makeBox(0.25, 0.03, 1.2, new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#eef4ff', emissiveIntensity: 1.4 })); p.position.set(x, 2.885, z); p.castShadow = false; scene.add(p); }
  // shelves behind the counter and on the walls
  medShelf(world, { x: -2.3, z: -1.75, w: 3.8, h: 2.5, rows: 7, mat: darkWood });
  medShelf(world, { x: 1.7, z: -1.75, w: 2.2, h: 2.5, rows: 7, mat: darkWood });
  medShelf(world, { x: -4.25, z: 0.3, rot: Math.PI / 2, w: 2.0, h: 2.2, rows: 6, mat: darkWood });
  // apothecary jars on top of the back shelf
  for (let i = 0; i < 7; i++) { const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.26, 18), new THREE.MeshPhysicalMaterial({ color: ['#2e86c1', '#c0392b', '#27ae60', '#8e44ad'][i % 4], transparent: true, opacity: 0.55, roughness: 0.05 })); jar.position.set(-3.8 + i * 0.5, 2.71, -1.75); scene.add(jar); }
  // counter (front glass display)
  const counter = new THREE.Group(); counter.position.set(-0.5, 0, 0.8); scene.add(counter);
  { const body = makeBox(5.2, 0.95, 0.6, wood); body.position.y = 0.475; counter.add(body);
    const top = makeBox(5.3, 0.04, 0.68, plain('#d9d2c2', 0.25)); top.position.y = 0.97; counter.add(top);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 0.5), new THREE.MeshPhysicalMaterial({ color: '#dfe8ea', roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false })); glass.position.set(0, 0.6, 0.305); counter.add(glass); }
  world.physics.addBox(-0.5, 0.8, 2.6, 0.32, 0, 0, 1);
  const CT = 0.99;
  // old cash register
  const till = new THREE.Group(); till.position.set(1.4, CT, 0.75); till.rotation.y = Math.PI; scene.add(till);
  { const b = world.rounded(0.42, 0.22, 0.36, 0.02, plain('#5a5f63', 0.4, 0.6)); b.position.y = 0.11; till.add(b);
    const drawer = makeBox(0.4, 0.08, 0.34, plain('#454a4e', 0.4, 0.6)); drawer.position.set(0, 0.04, -0.1); till.add(drawer);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#7cff9a', emissiveIntensity: 0.6 })); disp.position.set(0, 0.25, 0.1); disp.rotation.x = -0.4; till.add(disp); }
  world.interactable(till, { id: 'f_till', label: 'درج النقود', action: () => 'درج النقود القديم ما زال يعمل. في 2014 وُجد مفتوحًا وفارغًا، وعليه بصمات مصطفى — المساعد الذي كان يفتحه عشرين مرة في اليوم. لا شيء غير ذلك.', note: 'بصمات مصطفى على درج النقود طبيعية: كان يفتحه طوال اليوم بحكم عمله.' });
  // the old case file on the counter: box + separate documents
  const box = new THREE.Group(); box.position.set(-1.8, CT, 0.8); box.rotation.y = 0.15; scene.add(box);
  { const b = makeBox(0.36, 0.26, 0.28, plain('#b9a27a', 0.9)); b.position.y = 0.13; box.add(b);
    const lid = makeBox(0.38, 0.04, 0.3, plain('#a8916a', 0.9)); lid.position.set(-0.05, 0.02, 0.32); lid.rotation.y = 0.4; box.add(lid);
    const lbl = paperMesh({ w: 0.24, h: 0.1, lines: 'محضر 2117 / 2014\nقسم الجمالية', tint: '#f2ead6', px: 240, fontScale: 1.2 }); lbl.position.set(0, 0.14, 0.141); box.add(lbl); }
  world.interactable(box, { id: 'ev_file', evidence: 'ev_file', label: 'صندوق ملف القضية' });
  const fathiDoc = flatPaper(scene, { w: 0.21, h: 0.297, title: 'محضر سماع أقوال', lines: 'فتحي عبد العال — حارس\nركب الميكروباص 11:05...\n«تعالى حالًا، الدفتر قدامي»\nعربية فضي...', tint: '#ece4cf', px: 300 }, -1.2, CT, 0.72, -0.2);
  { const note = paperMesh({ w: 0.08, h: 0.03, lines: 'غير مؤثر', hand: true, tint: '#ece4cf', px: 120 }); note.rotation.x = -Math.PI / 2; note.rotation.z = -0.2; note.position.set(-1.12, CT + 0.004, 0.86); scene.add(note); }
  world.interactable(fathiDoc, { id: 'ev_fathi2014', evidence: 'ev_fathi2014', label: 'أقوال عم فتحي' });
  const phoneDoc = flatPaper(scene, { w: 0.21, h: 0.297, title: 'بيان مكالمات', lines: '06:12 م — 3 د\n08:40 م — 1 د\n11:34 م — منزل فؤاد — 4 د', tint: '#f3f1ea', px: 300 }, -0.7, CT, 0.78, 0.12);
  world.interactable(phoneDoc, { id: 'ev_phone2014', evidence: 'ev_phone2014', label: 'سجل المكالمات' });
  const photoCanvas = crimePhoto();
  ctx.images.ev_photo = photoCanvas;
  const photoTex = new THREE.CanvasTexture(photoCanvas); photoTex.colorSpace = THREE.SRGBColorSpace;
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshStandardMaterial({ map: photoTex, roughness: 0.3 }));
  photo.rotation.x = -Math.PI / 2; photo.rotation.z = 0.35; photo.position.set(-0.25, CT + 0.004, 0.9); scene.add(photo);
  world.interactable(photo, { id: 'ev_photo', evidence: 'ev_photo', label: 'صورة فوتوغرافية' });
  // wall clock (current) behind the counter
  await world.prop('wall_clock', { pos: [-0.6, 2.72, -1.55], rot: 0, collide: false, scale: 1.2 });
  ctx.clockPos = new THREE.Vector3(-0.6, 2.7, -1.6);
  // wall photo 2012 (silver car)
  const wp = new THREE.Group(); wp.position.set(-4.42, 1.65, 2.6); wp.rotation.y = Math.PI / 2; scene.add(wp);
  const wpTex = canvasTexture(480, 320, (c, w, h) => {
    const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#b8c7d2'); sky.addColorStop(1, '#d9d2c0'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7a5a3a'; c.fillRect(0, 40, w, 120); c.fillStyle = '#1f5d3a'; c.fillRect(30, 50, 260, 40); rtl(c, 'bold 26px Cairo', '#fff', 'center'); c.fillText('صيدلية الشفاء', 160, 72);
    c.fillStyle = '#b8bec4'; c.beginPath(); c.moveTo(250, 290); c.lineTo(270, 230); c.lineTo(330, 200); c.lineTo(420, 200); c.lineTo(460, 240); c.lineTo(470, 290); c.fill();
    c.fillStyle = '#9fb5c8'; c.fillRect(300, 210, 120, 30); c.fillStyle = '#1f5d3a'; c.fillRect(400, 215, 18, 18);
    c.fillStyle = '#222'; c.beginPath(); c.arc(300, 292, 20, 0, 7); c.arc(430, 292, 20, 0, 7); c.fill();
    const man = (x, coat, s = 1) => { c.fillStyle = coat; c.fillRect(x - 22 * s, 170, 44 * s, 120); c.fillStyle = '#c29a78'; c.beginPath(); c.arc(x, 150, 18 * s, 0, 7); c.fill(); };
    man(110, '#f3f3ef'); man(210, '#2a2a30');
    c.strokeStyle = '#c0392b'; c.lineWidth = 5; c.beginPath(); c.moveTo(60, 215); c.lineTo(170, 215); c.stroke();
    rtl(c, 'bold 18px Cairo', '#222', 'center'); c.fillText('تجديد صيدلية الشفاء — 2012', w / 2, h - 12);
  });
  { const fr = makeBox(0.62, 0.44, 0.03, plain('#3b2a1a', 0.4)); wp.add(fr);
    const im = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.38), new THREE.MeshStandardMaterial({ map: wpTex, roughness: 0.5 })); im.position.z = 0.016; wp.add(im); }
  world.interactable(wp, { id: 'ev_wallphoto', evidence: 'ev_wallphoto', label: 'صورة قديمة على الجدار' });
  ctx.inspectModels.ev_wallphoto = () => { const g = wp.clone(true); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1.6); return g; };
  // brass mortar set on the east wall
  const brassSet = new THREE.Group(); brassSet.position.set(4.3, 1.45, 1.9); brassSet.rotation.y = -Math.PI / 2; scene.add(brassSet);
  { const shelf = makeBox(1.3, 0.04, 0.26, darkWood); brassSet.add(shelf);
    const old = new THREE.MeshPhysicalMaterial({ color: '#8a6a32', metalness: 1, roughness: 0.45 });
    const shiny = new THREE.MeshPhysicalMaterial({ color: '#d9a85a', metalness: 1, roughness: 0.22 });
    const mortar = (x, r, h, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.75, h, 24, 1, true), mat); m.material = mat; m.position.set(x, 0.02 + h / 2, 0); brassSet.add(m); const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.8, 0.02, 24), mat); b.position.set(x, 0.03, 0); brassSet.add(b); };
    mortar(-0.52, 0.04, 0.06, old); mortar(-0.38, 0.05, 0.08, old); mortar(-0.22, 0.06, 0.1, old); mortar(-0.03, 0.075, 0.12, old); mortar(0.18, 0.085, 0.14, old);
    mortar(0.43, 0.11, 0.18, shiny);
    const pestle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.28, 12), shiny); pestle.position.set(0.46, 0.2, 0.03); pestle.rotation.z = 0.5; brassSet.add(pestle); }
  world.interactable(brassSet, { id: 'ev_mortar', evidence: 'ev_mortar', label: 'طقم الهون النحاسي' });
  ctx.inspectModels.ev_mortar = () => { const g = brassSet.clone(true); g.position.set(0, -0.1, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1.4); return g; };
  // coat rack with Fathi's wet jacket and badge
  const rack = new THREE.Group(); rack.position.set(-0.95, 0, 3.55); scene.add(rack);
  { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.8, 12), plain('#2b1d14', 0.5)); pole.position.y = 0.9; rack.add(pole);
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.9, 12, 1, true), new THREE.MeshPhysicalMaterial({ color: '#3d3a2c', roughness: 0.4, clearcoat: 0.5, side: THREE.DoubleSide })); coat.position.set(0, 1.25, 0.02); rack.add(coat);
    const badge = makeBox(0.07, 0.045, 0.004, plain('#1f5d3a', 0.5)); badge.position.set(0.06, 1.38, 0.2); badge.rotation.x = -0.15; rack.add(badge); }
  world.physics.addCircle(-0.95, 3.55, 0.2);
  world.interactable(rack, { id: 'ev_badge', evidence: 'ev_badge', label: 'سترة على المشجب' });
  ctx.inspectModels.ev_badge = () => {
    const g = new THREE.Group();
    const card = makeBox(0.09, 0.058, 0.004, plain('#f4f1ea', 0.4)); g.add(card);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.056), new THREE.MeshStandardMaterial({ map: canvasTexture(352, 224, (c, w, h) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f5d3a'; c.fillRect(0, 0, w, 54); rtl(c, 'bold 26px Cairo', '#fff', 'center'); c.fillText('صيدليات الحلواني — الأمن', w / 2, 28); c.fillStyle = '#c29a78'; c.fillRect(w - 100, 74, 76, 96); rtl(c, 'bold 24px Cairo', '#222'); c.fillText('فتحي عبد العال', w - 116, 98); rtl(c, '20px Cairo', '#444'); c.fillText('حارس ليلي', w - 116, 132); c.fillText('منذ: مايو 2014', w - 116, 166); }) }));
    face.position.z = 0.0021; g.add(face); g.scale.setScalar(5); return g;
  };
  // waiting bench + scale
  await world.prop('dining_chair_02', { pos: [-3.9, 0, 3.4], rot: Math.PI - 0.3 });
  const scale = new THREE.Group(); scale.position.set(3.9, 0, 3.5); scene.add(scale);
  { const base = makeBox(0.4, 0.08, 0.45, plain('#d0d3d6', 0.4, 0.6)); base.position.y = 0.04; scale.add(base);
    const col = makeBox(0.06, 1.2, 0.06, plain('#d0d3d6', 0.4, 0.6)); col.position.set(0, 0.64, -0.18); scale.add(col);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 24), plain('#f4f4f2', 0.3)); dial.rotation.x = Math.PI / 2; dial.position.set(0, 1.3, -0.16); scale.add(dial); }
  world.physics.addBox(3.9, 3.45, 0.22, 0.25, 0, 0, 1.3);
  world.interactable(scale, { id: 'f_scale', label: 'ميزان قديم', action: () => 'ميزان أشخاص بعملة معدنية، من أيام كان الناس يزنون أنفسهم في الصيدلية. عليه ملصق قديم: «د. فؤاد — صحتك أمانة».' });

  // ================= BACK ROOM =================
  world.point(0.0, 2.55, -4.6, { color: '#f2f5ff', intensity: 4, distance: 8 });
  // tall cabinet where the register was hidden (boxes on top)
  const cab = await world.prop('vintage_cabinet_01', { pos: [-3.9, 0, -6.55], rot: 0, scale: 1.0 });
  const cabTop = cab ? new THREE.Box3().setFromObject(cab).max.y : 2.0;
  for (let i = 0; i < 2; i++) await world.prop('cardboard_box_01', { pos: [-4.15 + i * 0.5, cabTop, -6.55], rot: i * 0.4, collide: false, scale: 0.8 });
  world.zone(-3.9, cabTop + 0.25, -6.4, 1.1, 0.5, 0.6, { id: 'f_cabtop', label: 'فوق الدولاب', action: () => 'كراتين فارغة متربة فوق الدولاب العالي، وبينها فراغ بحجم دفتر حيث وجدت ريم الكيس. من خبأ الدفتر هنا كان طويلًا بما يكفي ليصل دون كرسي.', note: 'الدفتر كان مخبأً فوق الدولاب العالي في المخزن، خلف كراتين فارغة.' });
  // steel shelves with stock
  await world.prop('steel_frame_shelves_02', { pos: [-1.2, 0, -6.7], rot: 0 });
  await world.prop('steel_frame_shelves_02', { pos: [3.9, 0, -5.4], rot: -Math.PI / 2 });
  // lab bench with the register
  const bench = new THREE.Group(); bench.position.set(1.2, 0, -6.35); scene.add(bench);
  { const top = makeBox(2.2, 0.05, 0.75, plain('#e8e4d8', 0.3)); top.position.y = 0.9; bench.add(top);
    const body = makeBox(2.1, 0.86, 0.68, wood); body.position.y = 0.43; bench.add(body);
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14 + (i % 2) * 0.06, 14), new THREE.MeshPhysicalMaterial({ color: ['#8b4513', '#2e86c1', '#f4f1ea'][i % 3], transparent: true, opacity: 0.7, roughness: 0.1 })); b.position.set(0.55 + i * 0.1, 0.99, -0.22); bench.add(b); }
    const mortarL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.08, 18), plain('#e9e6df', 0.3)); mortarL.position.set(-0.8, 0.965, -0.15); bench.add(mortarL); }
  world.physics.addBox(1.2, -6.35, 1.1, 0.38, 0, 0, 0.93);
  const reg = new THREE.Group(); reg.position.set(0.9, 0.925, -6.2); reg.rotation.y = 0.12; scene.add(reg);
  { const cov = makeBox(0.48, 0.02, 0.34, plain('#2f5c3a', 0.7)); cov.position.y = 0.01; reg.add(cov);
    const pL = paperMesh({ w: 0.22, h: 0.32, title: 'سجل الأدوية المخدرة', lines: 'ترامادول — الصارف: د. وائل\nترامادول — الصارف: د. وائل\nترامادول — الصارف: د. وائل', tint: '#efe8d4', px: 300 }); pL.rotation.x = -Math.PI / 2; pL.position.set(0.115, 0.021, 0); reg.add(pL);
    const pR = paperMesh({ w: 0.22, h: 0.32, lines: '14 مارس\n47 روشتة مزورة\nمواجهة و. الليلة', hand: true, tint: '#efe8d4', px: 300 }); pR.rotation.x = -Math.PI / 2; pR.position.set(-0.115, 0.021, 0); reg.add(pR);
    const bag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), new THREE.MeshStandardMaterial({ color: '#e8eef2', transparent: true, opacity: 0.25, roughness: 0.3, side: THREE.DoubleSide })); bag.rotation.x = -Math.PI / 2; bag.position.set(0.32, 0.004, 0.12); bag.rotation.z = 0.5; reg.add(bag); }
  world.interactable(reg, { id: 'ev_register', evidence: 'ev_register', label: 'دفتر أخضر قديم' });
  await world.prop('desk_lamp_arm_01', { pos: [0.1, 0.925, -6.5], rot: 0.6, collide: false });
  world.spot(0.2, 1.5, -6.4, 0.9, 0.92, -6.2, { color: '#ffd9a8', intensity: 4, angle: 0.8, penumbra: 0.7, distance: 3, shadow: false });
  // invoice box on the floor by the shelves
  const inv = await world.prop('cardboard_box_01', { pos: [2.6, 0, -3.0], rot: 0.5, scale: 1.0 });
  const invTop = inv ? new THREE.Box3().setFromObject(inv).max.y : 0.4;
  { const papers = new THREE.Group(); papers.position.set(2.6, invTop + 0.005, -3.0); papers.rotation.y = 0.5; scene.add(papers);
    for (let i = 0; i < 6; i++) { const p = makeBox(0.2, 0.004, 0.14, plain(['#efe3b9', '#f4f1e6', '#e9dcae'][i % 3], 0.9)); p.position.set((i % 3 - 1) * 0.06, i * 0.005, (i % 2) * 0.04); p.rotation.y = i * 0.3; papers.add(p); }
    if (inv) world.interactable(inv, { id: 'ev_invoice', evidence: 'ev_invoice', label: 'صندوق فواتير قديمة' });
    world.interactable(papers, { id: 'ev_invoice_p', evidence: 'ev_invoice', label: 'فواتير قديمة' }); }
  // small office corner (Nahed) with the insurance papers
  const desk = makeDesk(world, { x: -2.45, z: -4.1, rot: Math.PI / 2, w: 1.2, d: 0.6, h: 0.75, mat: darkWood });
  await world.prop('modern_arm_chair_01', { pos: [-3.35, 0, -4.1], rot: Math.PI / 2, collide: false, scale: 0.9 });
  world.physics.addCircle(-3.35, -4.1, 0.4);
  { const ledger = makeBox(0.3, 0.03, 0.22, plain('#5b2420', 0.6)); ledger.position.set(-2.4, desk.top + 0.015, -3.85); ledger.rotation.y = 0.3; scene.add(ledger);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 16), plain('#f4f1ea', 0.3)); cup.position.set(-2.35, desk.top + 0.04, -4.45); scene.add(cup); }
  world.interactable(desk.drawers[1], { id: 'ev_insurance', evidence: 'ev_insurance', label: 'درج المكتب' });
  // old safe
  { const safe = makeBox(0.6, 0.8, 0.55, plain('#3a4a3a', 0.45, 0.6)); safe.position.set(-4.1, 0.4, -2.5); scene.add(safe);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20), plain('#c9a24a', 0.3, 1)); dial.rotation.z = Math.PI / 2; dial.position.set(-3.79, 0.5, -2.5); scene.add(dial);
    world.physics.addBox(-4.1, -2.5, 0.3, 0.28, 0, 0, 0.8);
    world.interactable(safe, { id: 'f_safe', label: 'خزنة قديمة', action: () => 'خزنة حديدية خضراء من أيام التأسيس. ريم تقول إن رقمها السري لا يعرفه أحد منذ وفاة د. فؤاد، ولم تُفتح منذ 2014.' }); }

  // ================= ambient =================
  scene.add(new THREE.HemisphereLight('#c8d0e0', '#3a3028', 0.33));
  scene.fog = new THREE.FogExp2('#0b0c10', 0.012);
  { const c = document.createElement('canvas'); c.width = 240; c.height = 288; fouadPortrait(c.getContext('2d'), 240, 288); ctx.portraits = { fouad: c.toDataURL('image/jpeg', 0.85) }; }
  ctx.surfaceAt = (x, z) => world.surfaceAt(x, z);
  return ctx;
}
