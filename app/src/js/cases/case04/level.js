import * as THREE from 'three';
import { Assets } from '../../engine/assets.js';
import { makeBox, plain, paperMesh, canvasTexture, persianRugTexture } from '../../engine/world.js';
import { game } from '../../game/state.js';
import { SALIM, rtl, wallHelpers, makeDesk, flatPaper, makeDialPhone, makeBag } from '../shared.js';

// Layout (metres, top view, north = -Z). Third floor of an old seafront hotel.
//   Rooms (north side, z -4.6..0):  307 x -7.6..-4.2 | 308 x -4.2..-0.8 | 309 x -0.8..3.6 | 310 x 3.6..7
//   Corridor x -10..8, z 0..2.2 (lift at the west end, fire-hose cabinet by the lift)
//   Service alcove x 0..2.6, z 2.2..3.6 | Service stairs x 8..10, z -0.6..3

export const NPCS = [
  { ...SALIM, position: [5.7, 0, 1.0], rotation: Math.PI / 2 },
  { id: 'nadine', name: 'نادين', gender: 'f', height: 1.68, position: [4.3, 0, 1.7], rotation: -Math.PI / 2 - 0.4, mood: 'nervous' },
  { id: 'rehab', name: 'رحاب', gender: 'f', height: 1.62, position: [0.55, 0, 2.75], rotation: Math.PI - 0.2, mood: 'nervous' },
  { id: 'hazem', name: 'حازم', gender: 'm', height: 1.78, position: [-2.7, 0, 1.25], rotation: Math.PI / 2, mood: 'nervous' },
  { id: 'sherif', name: 'شريف', gender: 'm', height: 1.80, position: [-6.2, 0, 1.2], rotation: Math.PI / 2 - 0.2, mood: 'calm' },
  { id: 'adel', name: 'عادل', gender: 'm', height: 1.74, position: [-8.7, 0, 0.9], rotation: Math.PI / 2 + 0.3, mood: 'nervous' },
];

export const PLAYER_START = { x: 7.3, z: 1.1, yaw: Math.PI / 2 };

const ROOMS = { r307: [-7.6, -4.2], r308: [-4.2, -0.8], r309: [-0.8, 3.6], r310: [3.6, 7.0] };

function kamalPortrait(c, w, h) {
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#a89a86'); bg.addColorStop(1, '#6d604f'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const cx = w / 2;
  c.fillStyle = '#3b3530'; c.beginPath(); c.ellipse(cx, h * 1.02, w * 0.46, h * 0.36, 0, Math.PI, 0); c.fill();
  c.fillStyle = '#efe9dc'; c.beginPath(); c.moveTo(cx - w * 0.09, h * 0.68); c.lineTo(cx, h * 0.84); c.lineTo(cx + w * 0.09, h * 0.68); c.fill();
  c.fillStyle = '#c29a78'; c.fillRect(cx - w * 0.07, h * 0.5, w * 0.14, h * 0.18);
  c.beginPath(); c.ellipse(cx, h * 0.4, w * 0.2, h * 0.21, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d8d5cf'; c.beginPath(); c.ellipse(cx, h * 0.25, w * 0.19, h * 0.07, 0, Math.PI, 0); c.fill();
  c.fillRect(cx - w * 0.21, h * 0.25, w * 0.04, h * 0.1); c.fillRect(cx + w * 0.17, h * 0.25, w * 0.04, h * 0.1);
  c.fillStyle = '#d8d5cf'; c.beginPath(); c.ellipse(cx, h * 0.5, w * 0.07, h * 0.016, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#2a2018'; c.lineWidth = 2; for (const sx of [-1, 1]) { c.beginPath(); c.arc(cx + sx * w * 0.075, h * 0.41, w * 0.04, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 600; i++) c.fillRect(Math.random() * w, Math.random() * h, 1, 1);
}

export async function buildLevel(world, ctx) {
  const { scene } = world;
  const T = (id, o) => Assets.pbr(id, o);
  const { wallX, wallZ } = wallHelpers(world);
  const [runner, roomCarpet, tiles, concrete, wallpaper, roomWall, stairWall, wood] = await Promise.all([
    T('dirty_carpet', { size: 1.2, color: '#8a2e2e' }),
    T('dirty_carpet', { size: 1.4, color: '#c7b9a0' }),
    T('large_grey_tiles', { size: 1.4, roughness: 0.4 }),
    T('concrete_wall_008', { size: 3, color: '#8a8780' }),
    T('beige_wall_002', { size: 2.2, color: '#c8b48a', normalScale: 0.6 }),
    T('painted_plaster_wall', { size: 2.5, color: '#e2d8c4', normalScale: 0.5 }),
    T('concrete_wall_008', { size: 2.5, color: '#a7a196' }),
    T('kitchen_wood', { size: 1.2, roughness: 0.5, color: '#5b3a24' }),
  ]);
  const ceiling = plain('#ebe5d8', 0.95);
  const exterior = concrete;

  // ---------------- floors ----------------
  world.floor(-10, 0, 8, 2.2, runner, { ceiling, surface: 'carpet' });
  for (const [x0, x1] of Object.values(ROOMS)) world.floor(x0, -4.6, x1, 0, roomCarpet, { ceiling, surface: 'carpet' });
  world.floor(0, 2.2, 2.6, 3.6, tiles, { ceiling, surface: 'tile' });
  world.floor(8, -0.6, 10, 3, concrete, { ceiling: plain('#cfcac0', 0.95), surface: 'tile' });

  // ---------------- walls ----------------
  const DOOR = 0.92, DOORH = 2.1;
  const doorAt = { r307: -5.3, r308: -1.9, r309: 2.4, r310: 3.8 };
  wallX(0, -10, 8, roomWall, wallpaper, Object.values(doorAt).map(x => ({ at: x + 10, w: DOOR, h: DOORH })));
  wallX(-4.6, -7.6, 7.0, exterior, roomWall, Object.values(ROOMS).map(([a, b]) => ({ at: (a + b) / 2 - 0.65 + 7.6, w: 1.3, h: 1.5, sill: 0.85 })));
  for (const x of [-7.6, -4.2, -0.8, 3.6, 7.0]) wallZ(x, -4.6, 0, roomWall, roomWall);
  wallX(2.2, -10, 8, wallpaper, exterior, [{ at: 10, w: 2.6, h: 2.4 }, ...[-6.0, -2.8, 4.6].map(x => ({ at: x + 10, w: DOOR, h: DOORH }))]);
  wallZ(0, 2.2, 3.6, wallpaper, wallpaper); wallZ(2.6, 2.2, 3.6, wallpaper, wallpaper);
  wallX(3.6, 0, 2.6, wallpaper, exterior);
  wallZ(-10, 0, 2.2, wallpaper, exterior);
  wallZ(8, 0, 2.2, stairWall, wallpaper, [{ at: 0.65, w: DOOR, h: DOORH }]);
  wallZ(8, -0.6, 0, stairWall, exterior); wallZ(8, 2.2, 3, stairWall, exterior);
  wallX(-0.6, 8, 10, exterior, stairWall); wallX(3, 8, 10, stairWall, exterior);
  wallZ(10, -0.6, 3, exterior, stairWall, [{ at: 1.2, w: 1.0, h: 1.2, sill: 1.2 }]);

  // ---------------- doors ----------------
  const doorMat = await T('kitchen_wood', { size: 1.5, color: '#4a2c18', roughness: 0.45 });
  const frameMat = plain('#3a2414', 0.5);
  const roomDoor = (key, num, open, opts = {}) => {
    const d = world.door({ x: doorAt[key], z: 0, rot: 0, w: DOOR, swing: 1.5, mat: doorMat, frameMat, label: 'باب الغرفة ' + num, number: String(num), ...opts });
    if (open) d.setOpenInstant(true);
    return d;
  };
  const d307 = roomDoor('r307', 307, false, { locked: true, lockedMsg: 'غرفة شريف رضوان. لا يمكن دخولها دون موافقته — اسأله.' });
  world.updaters.push(() => { d307.locked = !game.flag('r307_open'); });
  roomDoor('r308', 308, true); roomDoor('r309', 309, true); roomDoor('r310', 310, true);
  // rooms across the corridor (other guests) — closed
  for (const [x, n] of [[-6.0, 312], [-2.8, 314], [4.6, 316]]) world.door({ x: x + DOOR, z: 2.2, rot: Math.PI, w: DOOR, swing: -1.5, mat: doorMat, frameMat, label: 'باب الغرفة ' + n, number: String(n), locked: true, lockedMsg: 'غرفة نزلاء آخرين. الشرطة سألتهم: لم يسمعوا شيئًا.' });
  world.door({ x: 8, z: 0.65, rot: -Math.PI / 2, w: DOOR, swing: -1.5, mat: plain('#7d8287', 0.5, 0.4), label: 'باب سلم الخدمة' }).setOpenInstant(true);
  // police tape across 309's doorway is not used: the room is open for the investigation

  // ---------------- windows (storm over the sea) ----------------
  for (const [a, b] of Object.values(ROOMS)) world.window({ x: (a + b) / 2, z: -4.6, rot: Math.PI, w: 1.3, h: 1.5, sill: 0.85 });
  world.window({ x: 10, z: -0.6 + 1.7, rot: Math.PI / 2, w: 1.0, h: 1.2, sill: 1.2 });

  const DT = (o, f) => (o ? new THREE.Box3().setFromObject(o).max.y : f);

  // ================= CORRIDOR =================
  world.point(-4.5, 2.55, 1.1, { color: '#ffd7a0', intensity: 4.5, distance: 8 });
  world.point(3.0, 2.55, 1.1, { color: '#ffd7a0', intensity: 4.5, distance: 8 });
  for (const x of [-7.2, -3.3, -0.6, 3.3, 6.9]) { const s = await world.prop('industrial_wall_sconce', { pos: [x, 1.85, 2.13], rot: Math.PI, collide: false, scale: 0.8 }); void s; }
  for (let x = -9; x < 8; x += 2.4) { const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 20), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffe2b0', emissiveIntensity: 1.3 })); lamp.position.set(x, 2.88, 1.1); scene.add(lamp); }
  // lift at the west end
  const lift = new THREE.Group(); lift.position.set(-9.93, 0, 1.1); lift.rotation.y = Math.PI / 2; scene.add(lift);
  { const brass = new THREE.MeshPhysicalMaterial({ color: '#b08d57', roughness: 0.35, metalness: 1 });
    for (const sx of [-1, 1]) { const d = makeBox(0.52, 2.1, 0.02, brass); d.position.set(sx * 0.265, 1.05, 0.015); lift.add(d); }
    const top = makeBox(1.3, 0.14, 0.05, frameMat); top.position.set(0, 2.17, 0.02); lift.add(top);
    for (const sx of [-1, 1]) { const j = makeBox(0.08, 2.2, 0.05, frameMat); j.position.set(sx * 0.6, 1.1, 0.02); lift.add(j); }
    const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveIntensity: 0.9, emissiveMap: canvasTexture(300, 72, (c, w, h) => { c.fillStyle = '#1a1006'; c.fillRect(0, 0, w, h); rtl(c, 'bold 40px Cairo', '#ffb347', 'center'); c.fillText('3', w / 2, h / 2 + 2); }) })); ind.position.set(0, 2.42, 0.03); lift.add(ind); }
  world.interactable(lift, { id: 'f_lift', label: 'المصعد', action: () => 'مصعد نحاسي قديم. البواب يقول إن أحدًا لم ينزل به إلى البهو بحقيبة بعد العاشرة. وكاميرا البهو تؤكد ذلك.' });
  // fire-hose cabinet by the lift (the hidden case)
  const hose = new THREE.Group(); hose.position.set(-8.75, 0.95, 2.12); hose.rotation.y = Math.PI; scene.add(hose);
  { const red = plain('#a3171a', 0.45, 0.2);
    const box = makeBox(0.7, 0.8, 0.22, red); hose.add(box);
    const inner = makeBox(0.64, 0.74, 0.01, plain('#2a0a0a', 0.8)); inner.position.z = 0.1; hose.add(inner);
    const reel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 10, 24), plain('#c2b8a0', 0.8)); reel.position.set(0, 0, 0.06); hose.add(reel);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.18, 10), plain('#b08d57', 0.3, 1)); nozzle.rotation.z = 0.6; nozzle.position.set(0.2, -0.25, 0.07); hose.add(nozzle);
    const caseEdge = makeBox(0.2, 0.07, 0.04, plain('#6b4226', 0.6)); caseEdge.position.set(-0.2, -0.33, 0.04); hose.add(caseEdge);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), new THREE.MeshPhysicalMaterial({ color: '#dfe8ea', roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false })); glass.position.z = 0.115; hose.add(glass);
    const sign = paperMesh({ w: 0.5, h: 0.08, lines: 'خرطوم الحريق — اكسر عند الطوارئ', tint: '#fff', px: 360, fontScale: 1.1 }); sign.position.set(0, 0.48, 0.112); hose.add(sign); }
  world.physics.addBox(-8.75, 2.05, 0.36, 0.13, 0, 0, 1.4);
  world.interactable(hose, { id: 'ev_case', evidence: 'ev_case', label: 'خزانة خرطوم الحريق' });
  ctx.inspectModels.ev_case = () => {
    const g = new THREE.Group();
    const lth = plain('#6b4226', 0.55);
    const body = world.rounded(0.34, 0.08, 0.24, 0.015, lth); g.add(body);
    const lid = world.rounded(0.34, 0.02, 0.24, 0.01, lth); lid.position.set(0, 0.11, -0.11); lid.rotation.x = -1.3; g.add(lid);
    const velvet = makeBox(0.31, 0.01, 0.21, plain('#3b0f1e', 1)); velvet.position.y = 0.041; g.add(velvet);
    const gold = new THREE.MeshPhysicalMaterial({ color: '#e2b84f', metalness: 1, roughness: 0.25 });
    for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.004, 28), gold); c.position.set(-0.12 + (i % 6) * 0.048, 0.048, -0.05 + Math.floor(i / 6) * 0.09); g.add(c); }
    const cuff = new THREE.Group(); cuff.position.set(0.24, -0.03, 0.08); g.add(cuff);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 20), gold); cuff.add(face);
    const eng = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.012), new THREE.MeshStandardMaterial({ transparent: true, map: canvasTexture(64, 48, (c, w, h) => { rtl(c, 'bold 26px Amiri', '#5a4310', 'center'); c.fillText('ش.ر', w / 2, h / 2); }) })); eng.rotation.x = -Math.PI / 2; eng.position.y = 0.0025; cuff.add(eng);
    g.scale.setScalar(2.4); return g;
  };
  // runner rug, console, painting, ice machine
  { const r = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.1), new THREE.MeshStandardMaterial({ map: (() => { const t = persianRugTexture(7, ['#5a1515', '#1d2a40', '#c9a86a', '#2e4a3a']); t.repeat?.set?.(1, 1); return t; })(), roughness: 1 }));
    r.rotation.x = -Math.PI / 2; r.position.set(-1, 0.004, 1.1); scene.add(r); }
  const ice = new THREE.Group(); ice.position.set(6.2, 0, 1.95); scene.add(ice);
  { const b = world.rounded(0.6, 1.1, 0.45, 0.03, plain('#c9ccd0', 0.35, 0.6)); b.position.y = 0.55; ice.add(b);
    const lbl = paperMesh({ w: 0.3, h: 0.08, lines: 'ثلج — مجانًا للنزلاء', tint: '#e8f1f8', px: 240 }); lbl.position.set(0, 0.9, -0.231); lbl.rotation.y = Math.PI; ice.add(lbl); }
  world.physics.addBox(6.2, 1.95, 0.31, 0.24, 0, 0, 1.1);
  world.interactable(ice, { id: 'f_ice', label: 'آلة الثلج', action: () => 'آلة ثلج بجوار سلم الخدمة. الدرج المعدني فيها جاف تمامًا ولم يُستعمل الليلة. من قال إنه خرج ليأخذ ثلجًا لم يقف هنا.', note: 'آلة الثلج في آخر الممر جافة: لم يأخذ منها أحد ثلجًا الليلة.' });
  const painting = new THREE.Group(); painting.position.set(-4.4, 1.6, 2.12); painting.rotation.y = Math.PI; scene.add(painting);
  { const fr = makeBox(1.1, 0.7, 0.03, plain('#8a6a32', 0.35, 0.7)); painting.add(fr);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshStandardMaterial({ roughness: 0.7, map: canvasTexture(500, 300, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9b27a'); g.addColorStop(0.55, '#e9d2a2'); g.addColorStop(0.56, '#3d6d8a'); g.addColorStop(1, '#244a63'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#efe6d0'; c.fillRect(60, 120, 260, 45); c.fillStyle = '#3a3020'; c.fillRect(350, 60, 12, 110); c.fillRect(330, 60, 52, 14); }) })); img.position.z = 0.016; painting.add(img); }
  world.interactable(painting, { id: 'f_painting', label: 'لوحة قديمة', action: () => 'لوحة زيتية لكورنيش الإسكندرية في الأربعينيات، وقلعة قايتباي في الخلفية. لوحة نحاسية صغيرة تحتها: «فندق الكورنيش — منذ 1937».' });

  // ================= SERVICE ALCOVE =================
  world.point(1.8, 2.6, 3.2, { color: '#f1f3ff', intensity: 1.6, distance: 4 });
  const stDesk = makeBox(1.4, 0.9, 0.5, wood); stDesk.position.set(1.3, 0.45, 3.32); scene.add(stDesk);
  world.physics.addBox(1.3, 3.32, 0.72, 0.27, 0, 0, 0.9);
  const term = new THREE.Group(); term.position.set(1.5, 0.9, 3.3); term.rotation.y = Math.PI; scene.add(term);
  { const scrTex = canvasTexture(512, 320, (c, w, h) => { c.fillStyle = '#0d1b2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#1e4466'; c.fillRect(0, 0, w, 40); rtl(c, 'bold 22px Cairo', '#fff'); c.fillText('نظام الأقفال — الطابق 3', w - 14, 21);
      rtl(c, '19px Cairo', '#bfe0ff'); ['309 — 9:55 م — بطاقة النزيل', '309 — 10:48 م — البطاقة الرئيسية', '307 — 10:52 م — بطاقة النزيل', '308 — 11:31 م — بطاقة النزيل', '309 — 11:40 م — البطاقة الرئيسية'].forEach((t, i) => { if (i === 1) { c.fillStyle = '#5a1f1f'; c.fillRect(10, 62 + i * 46, w - 20, 36); rtl(c, 'bold 19px Cairo', '#ffd3d3'); } else rtl(c, '19px Cairo', '#bfe0ff'); c.fillText(t, w - 20, 80 + i * 46); }); });
    const dark = plain('#1a1b1e', 0.45, 0.3);
    const neck = makeBox(0.04, 0.2, 0.03, dark); neck.position.set(0, 0.1, -0.03); term.add(neck);
    const bez = makeBox(0.5, 0.32, 0.03, dark); bez.position.set(0, 0.34, -0.02); term.add(bez);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.29), new THREE.MeshStandardMaterial({ map: scrTex, emissive: '#fff', emissiveMap: scrTex, emissiveIntensity: 0.85 })); scr.position.set(0, 0.34, -0.004); term.add(scr); }
  world.interactable(term, { id: 'ev_keylog', evidence: 'ev_keylog', label: 'حاسوب محطة الخدمة' });
  // housekeeping cart with the master-card chain
  const cart = new THREE.Group(); cart.position.set(2.05, 0, 2.55); cart.rotation.y = -0.3; scene.add(cart);
  { const metal = plain('#9a9ea3', 0.4, 0.8);
    for (const y of [0.15, 0.55, 0.95]) { const s = makeBox(0.9, 0.03, 0.45, plain('#e9e4d8', 0.6)); s.position.y = y; cart.add(s); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = makeBox(0.025, 1.0, 0.025, metal); p.position.set(sx * 0.44, 0.5, sz * 0.21); cart.add(p); }
    for (let i = 0; i < 6; i++) { const tw = makeBox(0.26, 0.06, 0.2, plain(i % 2 ? '#f5f2ea' : '#e8e2d2', 1)); tw.position.set(-0.28 + (i % 3) * 0.28, 0.6 + Math.floor(i / 3) * 0.065, 0); cart.add(tw); }
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 6, 16), metal); chain.position.set(0.46, 0.85, 0); chain.rotation.y = Math.PI / 2; cart.add(chain);
    const card = makeBox(0.003, 0.054, 0.085, plain('#c9a24a', 0.4, 0.6)); card.position.set(0.47, 0.76, 0); cart.add(card); }
  world.physics.addBox(2.05, 2.55, 0.48, 0.26, -0.3, 0, 1);
  world.interactable(cart, { id: 'f_cart', label: 'عربة التنظيف', action: () => 'عربة رحاب. على جانبها سلسلة معدنية تتدلى منها البطاقة الرئيسية الذهبية. السلسلة قصيرة، والبطاقة تنفصل عنها بمشبك. أي يد تمر بجانب العربة تستطيع أن تأخذها في ثانية.', note: 'البطاقة الرئيسية معلقة في عربة التنظيف بمشبك، وتُنزع منه في ثانية.' });

  // ================= SERVICE STAIRS =================
  world.point(9.0, 2.5, 1.2, { color: '#e8f0ff', intensity: 2.5, distance: 5 });
  const stairMat = plain('#8f8a80', 0.8);
  for (let i = 0; i < 7; i++) { const s = makeBox(1.0, 0.17, 0.3, stairMat); s.position.set(9.4, -0.09 - i * 0.17, 1.6 - i * 0.3); scene.add(s); }
  { const pit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.4, 2.1), new THREE.MeshStandardMaterial({ color: '#060606', roughness: 1, side: THREE.BackSide })); pit.position.set(9.4, -0.7, 0.75); scene.add(pit); }
  world.physics.addBox(9.4, 0.7, 0.55, 1.2, 0, 0, 1);
  { const rail = makeBox(0.04, 0.04, 2.2, plain('#3b3b3b', 0.4, 0.7)); rail.position.set(8.88, 0.95, 0.75); scene.add(rail); }
  const tin = new THREE.Group(); tin.position.set(8.35, 0, 2.6); scene.add(tin);
  { const can = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.09, 18), plain('#7b7d80', 0.4, 0.8)); can.position.y = 0.045; tin.add(can);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 8), plain(i % 2 ? '#f1ede4' : '#e6d6b8', 0.8)); b.rotation.z = Math.PI / 2; b.rotation.y = i; b.position.set((i - 1.5) * 0.02, 0.092, (i % 2) * 0.02); tin.add(b); const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0047, 0.0047, 0.006, 8), plain('#c2577a', 0.6)); tip.rotation.z = Math.PI / 2; tip.rotation.y = i; tip.position.set((i - 1.5) * 0.02 + Math.cos(i) * 0.012, 0.092, (i % 2) * 0.02 - Math.sin(i) * 0.012); tin.add(tip); } }
  world.interactable(tin, { id: 'ev_butts', evidence: 'ev_butts', label: 'علبة صفيح على البسطة' });
  ctx.inspectModels.ev_butts = () => { const g = tin.clone(true); g.position.set(0, 0, 0); g.scale.setScalar(4); return g; };
  { const sign = paperMesh({ w: 0.4, h: 0.12, lines: 'ممنوع التدخين — للعاملين فقط', tint: '#fff', px: 320, fontScale: 1.2 }); sign.position.set(9.0, 1.6, 2.92); sign.rotation.y = Math.PI; scene.add(sign); }

  // ================= ROOMS =================
  const bedTop = 0.6;
  const bed = async (x, z, rot) => { const b = await world.prop('GothicBed_01', { pos: [x, 0, z], rot, scale: 0.9 }); return b; };
  const roomLight = (x, z, intensity = 4) => world.point(x, 2.45, z, { color: '#ffdcae', intensity, distance: 6 });
  const suitcase = (x, z, rot, color = '#2a2d33') => { const s = world.rounded(0.48, 0.66, 0.24, 0.04, plain(color, 0.5, 0.1)); s.position.set(x, 0.33, z); s.rotation.y = rot; scene.add(s); world.physics.addBox(x, z, 0.25, 0.13, rot, 0, 0.66); return s; };

  // ---- 309 (crime scene) ----
  roomLight(1.4, -2.2, 5);
  await bed(2.6, -2.6, -Math.PI / 2);
  await world.prop('ClassicNightstand_01', { pos: [3.2, 0, -4.15], rot: -Math.PI / 2, scale: 0.9 });
  await world.prop('ArmChair_01', { pos: [0.2, 0, -1.9], rot: Math.PI / 2 + 0.5, scale: 0.95 });
  { const blanket = makeBox(0.6, 0.02, 0.4, plain('#6f2b2b', 1)); blanket.position.set(0.15, 0.5, -1.85); blanket.rotation.set(0.2, 0.6, 0.1); scene.add(blanket); }
  const tbl = await world.prop('round_wooden_table_01', { pos: [1.0, 0, -1.3], rot: 0, fit: { h: 0.62 }, scale: 0.7 });
  const tT = DT(tbl, 0.62);
  const tray = new THREE.Group(); tray.position.set(1.0, tT, -1.3); scene.add(tray);
  { const silver = plain('#c7c9cc', 0.25, 1);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 32), silver); plate.position.y = 0.006; tray.add(plate);
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12), plain('#f2efe8', 0.25)); pot.scale.y = 1.1; pot.position.set(-0.06, 0.085, -0.04); tray.add(pot);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.08, 8), plain('#f2efe8', 0.25)); spout.rotation.z = -0.9; spout.position.set(0.01, 0.09, -0.04); tray.add(spout);
    for (const [cx, cz, full] of [[0.08, 0.06, false], [0.1, -0.08, true]]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.065, 18, 1, true), plain('#f7f4ee', 0.2)); cup.material = cup.material.clone(); cup.material.side = THREE.DoubleSide; cup.position.set(cx, 0.045, cz); tray.add(cup); const bot = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), plain(full ? '#8a5a1e' : '#e9e6df', 0.5)); bot.rotation.x = -Math.PI / 2; bot.position.set(cx, full ? 0.07 : 0.014, cz); tray.add(bot); }
    const mint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), plain('#3d7a3a', 0.8)); mint.position.set(0.1, 0.074, -0.07); tray.add(mint); }
  world.interactable(tray, { id: 'ev_tray', evidence: 'ev_tray', label: 'صينية الشاي' });
  ctx.inspectModels.ev_tray = () => { const g = tray.clone(true); g.position.set(0, 0, 0); g.scale.setScalar(2.2); return g; };
  const slip = paperMesh({ w: 0.08, h: 0.12, lines: 'خدمة الغرف\n307 ← 309\nش. رضوان', tint: '#f5e68a', px: 140, fontScale: 1.1 });
  slip.rotation.x = -Math.PI / 2; slip.rotation.z = 0.4; slip.position.set(1.12, tT + 0.016, -1.42); scene.add(slip);
  world.interactable(slip, { id: 'ev_slip', evidence: 'ev_slip', label: 'ورقة صفراء تحت الإبريق' });
  const desk9 = makeDesk(world, { x: 0.1, z: -4.15, rot: 0, w: 1.1, d: 0.55, h: 0.74, mat: wood });
  const book = new THREE.Group(); book.position.set(0.0, desk9.top, -4.1); book.rotation.y = 0.2; scene.add(book);
  { const cv = makeBox(0.26, 0.012, 0.18, plain('#3a2216', 0.6)); cv.position.y = 0.006; book.add(cv);
    const pg = paperMesh({ w: 0.12, h: 0.17, lines: 'شريف ر. — 2.1\nقلت 3 أو لا بيع\nحازم — لا', hand: true, tint: '#f4eedc', px: 200 }); pg.rotation.x = -Math.PI / 2; pg.position.set(-0.062, 0.0125, 0); book.add(pg); }
  world.interactable(book, { id: 'ev_notebook', evidence: 'ev_notebook', label: 'مفكرة جلدية' });
  // connecting door 308|309 (309 side, bolted)
  const conn = new THREE.Group(); conn.position.set(-0.8 + 0.08, 0, -2.6); conn.rotation.y = Math.PI / 2; scene.add(conn);
  { const leaf = makeBox(0.85, 2.05, 0.03, doorMat); leaf.position.y = 1.025; conn.add(leaf);
    const brass = plain('#c9a24a', 0.3, 1);
    const plate = makeBox(0.04, 0.12, 0.01, brass); plate.position.set(0.32, 1.1, 0.02); conn.add(plate);
    const bolt = makeBox(0.16, 0.02, 0.02, brass); bolt.position.set(0.39, 1.1, 0.035); conn.add(bolt);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), brass); knob.position.set(0.33, 1.13, 0.05); conn.add(knob); }
  world.interactable(conn, { id: 'ev_connect', evidence: 'ev_connect', label: 'الباب الواصل' });
  ctx.inspectModels.ev_connect = () => { const g = conn.clone(true); g.position.set(0, -1.1, 0); g.rotation.set(0, 0, 0); return g; };
  { const safe = makeBox(0.42, 0.35, 0.38, plain('#2d2f33', 0.4, 0.6)); safe.position.set(3.35, 0.18, -0.55); scene.add(safe);
    const sdoor = makeBox(0.02, 0.33, 0.36, plain('#3a3c40', 0.4, 0.6)); sdoor.position.set(3.05, 0.18, -0.38); sdoor.rotation.y = 1.2; scene.add(sdoor);
    world.interactable(safe, { id: 'f_safe', label: 'خزنة الغرفة', action: () => 'خزنة الغرفة مفتوحة وفارغة، ولم تُستعمل أصلًا: الشاشة تقول «لا رمز مسجل». حازم يقول إن عمه لا يثق بخزائن الفنادق.' }); }

  // ---- 308 (Hazem) ----
  roomLight(-2.5, -2.2);
  await bed(-3.2, -2.6, Math.PI / 2);
  { const wet = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshPhysicalMaterial({ color: '#3a2a22', roughness: 0.05, transparent: true, opacity: 0.35 })); wet.rotation.x = -Math.PI / 2; wet.position.set(-3.7, 0.006, -0.55); scene.add(wet); }
  const stand = new THREE.Group(); stand.position.set(-3.75, 0, -0.55); scene.add(stand);
  { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.8, 12), plain('#2b1d14', 0.5)); pole.position.y = 0.9; stand.add(pole);
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, 1.0, 12, 1, true), new THREE.MeshPhysicalMaterial({ color: '#2a2f38', roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide })); coat.position.set(0, 1.2, 0.04); stand.add(coat); }
  world.physics.addCircle(-3.75, -0.55, 0.22);
  world.interactable(stand, { id: 'ev_coat', evidence: 'ev_coat', label: 'معطف مبلل' });
  const hz = suitcase(-3.6, -3.9, 0.3, '#1f3b4d');
  { const iou = paperMesh({ w: 0.12, h: 0.16, lines: 'إيصال أمانة\n150,000', tint: '#f4f1e6', px: 160 }); iou.rotation.x = -Math.PI / 2; iou.position.set(-3.6, 0.665, -3.9); iou.rotation.z = 0.3; scene.add(iou);
    world.interactable(hz, { id: 'ev_iou', evidence: 'ev_iou', label: 'حقيبة سفر حازم' }); world.interactable(iou, { id: 'ev_iou_p', evidence: 'ev_iou', label: 'ورقة مطوية' }); }
  { const cards = new THREE.Group(); cards.position.set(-3.0, 0.62, -2.3); scene.add(cards); for (let i = 0; i < 6; i++) { const c = makeBox(0.06, 0.002, 0.09, plain('#f4f1ea', 0.6)); c.position.set(i * 0.015, i * 0.002, 0); c.rotation.y = i * 0.3; cards.add(c); }
    world.interactable(cards, { id: 'f_cards', label: 'أوراق لعب', action: () => 'أوراق كوتشينة متناثرة على السرير، وورقة واحدة ممزقة نصفين. على ظهرها ختم: «مقهى الأمراء».' }); }
  // connecting door (308 side: plain panel)
  { const p = makeBox(0.03, 2.05, 0.85, doorMat); p.position.set(-0.8 - 0.08, 1.025, -2.6); scene.add(p); }

  // ---- 307 (Sherif) ----
  roomLight(-5.9, -2.2);
  await bed(-5.2, -2.6, -Math.PI / 2);
  const desk7 = makeDesk(world, { x: -7.28, z: -2.3, rot: Math.PI / 2, w: 1.1, d: 0.55, h: 0.74, mat: wood });
  const pad = flatPaper(scene, { w: 0.12, h: 0.17, lines: '', tint: '#f7f5ee', px: 160 }, -7.25, desk7.top, -2.15, 0.1);
  { const logo = paperMesh({ w: 0.1, h: 0.025, lines: 'فندق الكورنيش', tint: '#f7f5ee', px: 160 }); logo.rotation.x = -Math.PI / 2; logo.rotation.z = 0.1; logo.position.set(-7.25, desk7.top + 0.004, -2.21); scene.add(logo); }
  world.interactable(pad, { id: 'ev_buyer', evidence: 'ev_buyer', label: 'مفكرة الفندق' });
  const ph7 = makeDialPhone('#e9e4d8'); ph7.position.set(-7.3, desk7.top, -2.65); ph7.rotation.y = Math.PI / 2; scene.add(ph7);
  await world.prop('WoodenChair_01', { pos: [-6.75, 0, -2.3], rot: -Math.PI / 2 });
  const shirt = new THREE.Group(); shirt.position.set(-6.48, 0.55, -2.3); shirt.rotation.y = Math.PI / 2; scene.add(shirt);
  { const cloth = plain('#f4f4f2', 0.9);
    const torso = world.rounded(0.42, 0.55, 0.04, 0.02, cloth); torso.position.y = 0.32; shirt.add(torso);
    for (const sx of [-1, 1]) { const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.5, 10), cloth); sl.position.set(sx * 0.24, 0.25, 0.02); sl.rotation.z = sx * 0.12; shirt.add(sl); }
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.004, 14), new THREE.MeshPhysicalMaterial({ color: '#e2b84f', metalness: 1, roughness: 0.25 })); cuff.rotation.x = Math.PI / 2; cuff.position.set(-0.27, 0.02, 0.05); shirt.add(cuff); }
  world.interactable(shirt, { id: 'ev_shirt', evidence: 'ev_shirt', label: 'قميص أبيض' });
  ctx.inspectModels.ev_shirt = () => { const g = shirt.clone(true); g.position.set(0, -0.3, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1.6); return g; };
  const bin = new THREE.Group(); bin.position.set(-7.3, 0, -1.35); scene.add(bin);
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.3, 18, 1, true), plain('#2b2b2b', 0.5, 0.3)); b.material = b.material.clone(); b.material.side = THREE.DoubleSide; b.position.y = 0.15; bin.add(b);
    for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), plain('#f2f2ee', 1)); t.position.set((i - 1.5) * 0.05, 0.22, (i % 2) * 0.04); bin.add(t); }
    const blister = makeBox(0.06, 0.004, 0.1, plain('#cfd3d8', 0.3, 0.9)); blister.position.set(0.02, 0.27, -0.03); blister.rotation.set(0.4, 0.3, 0); bin.add(blister); }
  world.physics.addCircle(-7.3, -1.35, 0.14);
  world.interactable(bin, { id: 'ev_pills', evidence: 'ev_pills', label: 'سلة المهملات' });
  ctx.inspectModels.ev_pills = () => {
    const g = new THREE.Group();
    const base = makeBox(0.1, 0.004, 0.16, plain('#cfd3d8', 0.3, 0.9)); g.add(base);
    for (let i = 0; i < 10; i++) { const torn = i < 4; const b = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), plain(torn ? '#8f9399' : '#e9edf1', 0.2, torn ? 0.2 : 0.9)); b.position.set(-0.025 + (i % 2) * 0.05, 0.002, -0.06 + Math.floor(i / 2) * 0.03); b.scale.y = torn ? 0.3 : 0.8; g.add(b); }
    const lbl = paperMesh({ w: 0.09, h: 0.05, lines: 'شريف رضوان\nزولبيديم 10 مجم', tint: '#ffffff', px: 160 }); lbl.rotation.x = -Math.PI / 2; lbl.position.set(0, 0.003, 0.11); g.add(lbl);
    g.scale.setScalar(3.4); return g;
  };
  suitcase(-4.6, -4.0, -0.2, '#3a2a1e');

  // ---- 310 (Nadine) ----
  roomLight(5.3, -2.2);
  await bed(5.95, -2.6, -Math.PI / 2);
  suitcase(4.0, -4.0, 0.4, '#7a2f4a');
  const vanity = new THREE.Group(); vanity.position.set(3.9, 0, -1.7); vanity.rotation.y = Math.PI / 2; scene.add(vanity);
  { const top = makeBox(0.9, 0.05, 0.45, plain('#e8e2d6', 0.25)); top.position.y = 0.85; vanity.add(top);
    const cab = makeBox(0.86, 0.8, 0.42, wood); cab.position.y = 0.4; vanity.add(cab);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.06, 24), plain('#f4f4f2', 0.15)); basin.position.set(-0.15, 0.87, 0); vanity.add(basin);
    const mirror = makeBox(0.8, 0.7, 0.02, new THREE.MeshPhysicalMaterial({ color: '#c9d2d8', metalness: 1, roughness: 0.05 })); mirror.position.set(0, 1.55, -0.21); vanity.add(mirror);
    const lens = new THREE.Group(); lens.position.set(0.22, 0.875, 0.05); vanity.add(lens);
    for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 16), plain(sx < 0 ? '#2e86c1' : '#27ae60', 0.4)); c.position.x = sx * 0.017; lens.add(c); }
    const glasses = new THREE.Group(); glasses.position.set(0.32, 0.88, -0.05); vanity.add(glasses);
    for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 18), plain('#222', 0.3)); r.rotation.x = Math.PI / 2; r.position.x = sx * 0.028; glasses.add(r); }
    const arm = makeBox(0.06, 0.003, 0.004, plain('#222', 0.3)); arm.position.set(0.07, 0, 0.02); arm.rotation.y = 0.8; glasses.add(arm); }
  world.physics.addBox(3.9, -1.7, 0.24, 0.46, Math.PI / 2, 0, 0.9);
  world.interactable(vanity, { id: 'ev_lenses', evidence: 'ev_lenses', label: 'رف الحوض' });
  ctx.inspectModels.ev_lenses = () => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 16), plain(sx < 0 ? '#2e86c1' : '#27ae60', 0.4)); c.position.x = sx * 0.017; g.add(c); const l = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 6, 0, Math.PI * 2, 0, 0.8), new THREE.MeshPhysicalMaterial({ color: '#cfe8f5', transparent: true, opacity: 0.6, roughness: 0.05 })); l.position.set(sx * 0.017, 0.009, 0); g.add(l); }
    const gl = new THREE.Group(); gl.position.set(0, 0, 0.06); g.add(gl);
    for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 18), plain('#222', 0.3)); r.rotation.x = Math.PI / 2; r.position.x = sx * 0.028; gl.add(r); }
    const arm = makeBox(0.06, 0.003, 0.004, plain('#222', 0.3)); arm.position.set(0.07, 0, 0.02); arm.rotation.y = 0.8; gl.add(arm);
    const rx = paperMesh({ w: 0.07, h: 0.05, lines: 'قِصر نظر\n−6.5', tint: '#fff', px: 120 }); rx.rotation.x = -Math.PI / 2; rx.position.set(0.07, 0, -0.03); g.add(rx);
    g.scale.setScalar(4); return g;
  };

  // ================= ambient =================
  const moon = world.spot(1.4, 4.5, -10, 1.4, 0, -2.4, { color: '#8fa8d6', intensity: 30, angle: 0.5, penumbra: 0.6, distance: 16, shadow: false });
  ctx.lightningLights.push(moon);
  scene.add(new THREE.HemisphereLight('#c8d0e0', '#3a3028', 0.34));
  scene.fog = new THREE.FogExp2('#0b0c10', 0.01);
  { const c = document.createElement('canvas'); c.width = 240; c.height = 288; kamalPortrait(c.getContext('2d'), 240, 288); ctx.portraits = { kamal: c.toDataURL('image/jpeg', 0.85) }; }
  ctx.surfaceAt = (x, z) => world.surfaceAt(x, z);
  return ctx;
}
