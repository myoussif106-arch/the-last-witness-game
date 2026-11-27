import * as THREE from 'three';
import { Assets } from '../../engine/assets.js';
import { makeBox, plain, paperMesh, canvasTexture, persianRugTexture } from '../../engine/world.js';
import { SALIM, rtl, wallHelpers, makeDesk, flatPaper, makeBook, spineRow, makeDialPhone, makeBag } from '../shared.js';

// Layout (metres, top view, north = -Z). Ground floor of an old two-storey villa.
//   Salon    x -6..1  z -6..0   | Study (late husband's)  x 1..6  z -6..-2
//   Kitchen  x -6..1  z 0..3    | Entrance hall           x 1..6  z -2..3
//   Shared stair landing (Seham's flat is upstairs)  x 6..9  z -2..3

export const NPCS = [
  { ...SALIM, position: [3.25, 0, 0.75], rotation: Math.PI / 2 },
  { id: 'afaf', name: 'الأستاذة عفاف', gender: 'f', height: 1.60, position: [-2.45, 0, -3.75], rotation: 1.15, mood: 'sad', seated: true },
  { id: 'medhat', name: 'مدحت', gender: 'm', height: 1.79, position: [-0.45, 0, -4.7], rotation: -1.2, mood: 'calm' },
  { id: 'yasser', name: 'ياسر', gender: 'm', height: 1.76, position: [2.4, 0, -3.1], rotation: 1.2, mood: 'nervous' },
  { id: 'umreda', name: 'أم رضا', gender: 'f', height: 1.62, position: [-1.7, 0, 1.75], rotation: Math.PI / 2, mood: 'nervous' },
  { id: 'seham', name: 'سهام', gender: 'f', height: 1.63, position: [6.9, 0, 1.2], rotation: -0.55, mood: 'calm' },
];

export const PLAYER_START = { x: 5.1, z: 1.4, yaw: Math.PI / 2 };

export async function buildLevel(world, ctx) {
  const { scene } = world;
  const T = (id, o) => Assets.pbr(id, o);
  const { wallX, wallZ } = wallHelpers(world);
  const [parquet, marble, kitchenTiles, plaster, salonWall, studyWall, kitchenWall, concrete, wood] = await Promise.all([
    T('herringbone_parquet', { size: 1.6, roughness: 0.55 }),
    T('marble_01', { size: 1.4, roughness: 0.3 }),
    T('floor_tiles_06', { size: 0.9, roughness: 0.4 }),
    T('painted_plaster_wall', { size: 2.5, color: '#e9e1d0', normalScale: 0.5 }),
    T('beige_wall_002', { size: 2.5, color: '#c9b79a', normalScale: 0.5 }),
    T('beige_wall_001', { size: 2.5, color: '#8f9c86', normalScale: 0.5 }),
    T('beige_wall_001', { size: 2.5, color: '#e6e2cf', normalScale: 0.4 }),
    T('concrete_wall_008', { size: 3, color: '#9a948a' }),
    T('kitchen_wood', { size: 1.2, roughness: 0.55, color: '#6b4a30' }),
  ]);
  const stairWall = await T('painted_plaster_wall', { size: 2.5, color: '#b9b3a4', normalScale: 0.6 });
  const ceiling = plain('#ece6da', 0.95);
  const exterior = concrete;

  // ---------------- floors ----------------
  world.floor(-6, -6, 1, 0, parquet, { ceiling });
  world.floor(1, -6, 6, -2, parquet, { ceiling });
  world.floor(-6, 0, 1, 3, kitchenTiles, { ceiling, surface: 'tile' });
  world.floor(1, -2, 6, 3, marble, { ceiling, surface: 'tile' });
  world.floor(6, -2, 9, 3, marble, { ceiling: plain('#d9d4c8', 0.95), surface: 'tile', ceilingH: 3.4 });

  // ---------------- walls ----------------
  const DOOR = 0.92, DOORH = 2.1;
  wallX(-6, -6, 1, exterior, salonWall, [{ at: 1.9, w: 1.2, h: 1.5, sill: 0.9 }]);
  wallX(-6, 1, 6, exterior, studyWall, [{ at: 1.9, w: 1.2, h: 1.5, sill: 0.9 }]);
  wallZ(-6, -6, 0, salonWall, exterior, [{ at: 2.2, w: 1.2, h: 1.5, sill: 0.9 }]);
  wallZ(-6, 0, 3, kitchenWall, exterior);
  wallX(3, -6, 1, kitchenWall, exterior, [{ at: 2.6, w: 1.0, h: 1.0, sill: 1.15 }]);
  wallX(3, 1, 6, plaster, exterior);
  wallX(0, -6, 1, salonWall, kitchenWall);
  wallZ(1, -6, -2, studyWall, salonWall);
  wallZ(1, -2, 3, plaster, salonWall, [{ at: 0.2, w: 1.6, h: 2.3 }, { at: 3.4, w: DOOR, h: DOORH }]);
  wallX(-2, 1, 6, studyWall, plaster, [{ at: 3.2, w: DOOR, h: DOORH }]);
  wallZ(6, -6, -2, exterior, studyWall);
  wallZ(6, -2, 3, stairWall, plaster, [{ at: 1.9, w: DOOR, h: DOORH }]);
  // landing (taller stairwell)
  world.wall(6, -2, 9, -2, exterior, stairWall, [], { h: 3.4 });
  world.wall(6, 3, 9, 3, stairWall, exterior, [], { h: 3.4 });
  world.wall(9, -2, 9, 3, exterior, stairWall, [{ at: 2.6, w: 0.9, h: 1.2, sill: 1.6 }], { h: 3.4 });
  // kitchen corner blocker over the hall wall pieces above the doors is handled by the wall builder

  // ---------------- doors ----------------
  const doorWood = await T('kitchen_wood', { size: 1.5, color: '#5b3a22', roughness: 0.55 });
  const front = world.door({ x: 6, z: -2 + 1.9, rot: -Math.PI / 2, w: DOOR, swing: -1.6, mat: doorWood, label: 'باب الشقة' });
  front.setOpenInstant(true);
  world.door({ x: 1 + 3.2, z: -2, rot: 0, w: DOOR, swing: -1.5, mat: doorWood, label: 'باب المكتب' }).setOpenInstant(true);
  world.door({ x: 1, z: -2 + 3.4, rot: -Math.PI / 2, w: DOOR, swing: 1.6, mat: plain('#e6e0d2', 0.5), label: 'باب المطبخ' }).setOpenInstant(true);

  // ---------------- windows ----------------
  const salonWin = world.window({ x: -3.5, z: -6, rot: Math.PI, w: 1.2, h: 1.5, sill: 0.9 });
  world.window({ x: 3.5, z: -6, rot: Math.PI, w: 1.2, h: 1.5, sill: 0.9 });
  world.window({ x: -6, z: -3.2, rot: -Math.PI / 2, w: 1.2, h: 1.5, sill: 0.9 });
  world.window({ x: -2.9, z: 3, rot: 0, w: 1.0, h: 1.0, sill: 1.15 });
  world.window({ x: 9, z: -2 + 3.05, rot: Math.PI / 2, w: 0.9, h: 1.2, sill: 1.6 });
  // the salon window stands ajar: a tilted casement leaf
  { const leaf = new THREE.Group(); leaf.position.set(-3.5 + 0.58, 0.9, -6 + 0.02); scene.add(leaf);
    const frame = plain('#dcd6cb', 0.5);
    for (const [w, h, x, y] of [[0.04, 1.5, 0, 0.75], [0.04, 1.5, -0.56, 0.75], [0.58, 0.04, -0.28, 0.02], [0.58, 0.04, -0.28, 1.48]]) { const b = makeBox(w, h, 0.04, frame); b.position.set(x, y, 0); leaf.add(b); }
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 1.44), new THREE.MeshStandardMaterial({ color: '#9fb0bf', transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false })); gl.position.set(-0.28, 0.75, 0); leaf.add(gl);
    leaf.rotation.y = 0.55; }
  // Seham's balcony above the salon window (outside)
  { const bal = new THREE.Group(); bal.position.set(-3.5, 3.05, -6.75); scene.add(bal);
    const slab = makeBox(2.4, 0.16, 1.3, exterior); bal.add(slab);
    for (let i = 0; i < 13; i++) { const r = makeBox(0.025, 0.85, 0.025, plain('#2a2a2a', 0.4, 0.7)); r.position.set(-1.15 + i * 0.19, 0.5, -0.62); bal.add(r); }
    const blanket = makeBox(0.5, 0.55, 0.02, plain('#7a4b3a', 1)); blanket.position.set(0.5, -0.12, 0.66); blanket.rotation.x = 0.1; bal.add(blanket); }

  const DT = (o, fallback) => (o ? new THREE.Box3().setFromObject(o).max.y : fallback);

  // ================= SALON =================
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), new THREE.MeshStandardMaterial({ map: persianRugTexture(3, ['#5e1f1f', '#22304a', '#c9a86a', '#3a4a2e']), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-3.4, 0.004, -3.2); rug.receiveShadow = true; scene.add(rug);
  world.surfaces.unshift({ x0: -5.1, z0: -4.5, x1: -1.7, z1: -1.9, type: 'carpet' });
  await world.prop('Sofa_01', { pos: [-5.35, 0, -3.1], rot: Math.PI / 2, scale: 1.05 });
  await world.prop('throw_pillows_01', { pos: [-5.4, 0.42, -3.1], rot: Math.PI / 2, collide: false, scale: 0.9 });
  const coffee = await world.prop('CoffeeTable_01', { pos: [-4.0, 0, -3.1], rot: Math.PI / 2, scale: 0.85 });
  const coffeeTop = DT(coffee, 0.45);
  await world.prop('tea_set_01', { pos: [-4.05, coffeeTop, -2.85], rot: 0.4, collide: false, scale: 0.6 });
  await world.prop('ArmChair_01', { pos: [-2.45, 0, -3.75], rot: 1.15, collide: false });
  world.physics.addCircle(-2.45, -3.75, 0.45);
  const side = await world.prop('side_table_01', { pos: [-2.15, 0, -4.75], rot: 0.3 });
  const sideTop = DT(side, 0.55);
  // biscuit tin with the first five letters
  const tin = new THREE.Group(); tin.position.set(-2.12, sideTop, -4.72); scene.add(tin);
  { const tinTex = canvasTexture(512, 96, (c, w, h) => { c.fillStyle = '#1f4a6e'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9b25a'; for (let x = 0; x < w; x += 64) { c.beginPath(); c.arc(x + 32, h / 2, 18, 0, 7); c.fill(); } });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 28), new THREE.MeshStandardMaterial({ map: tinTex, metalness: 0.6, roughness: 0.35 })); body.position.y = 0.04; tin.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.015, 28), plain('#d9b25a', 0.3, 0.8)); lid.position.set(0.06, 0.09, 0.1); lid.rotation.x = 0.5; tin.add(lid);
    for (let i = 0; i < 5; i++) { const e = makeBox(0.16, 0.003, 0.1, plain('#f2efe6', 0.9)); e.position.set(0, 0.06 + i * 0.004, 0); e.rotation.y = i * 0.25; tin.add(e); } }
  world.interactable(tin, { id: 'ev_letters', evidence: 'ev_letters', label: 'علبة البسكويت' });
  ctx.inspectModels.ev_letters = () => { const g = tin.clone(true); g.position.set(0, 0, 0); g.scale.setScalar(2.4); return g; };
  // the sixth letter on the rug by the armchair (blue paper with cut-out words)
  const letterTex = (w, h) => canvasTexture(w, h, (c) => {
    c.fillStyle = '#b9d0e6'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.25)'; for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 1);
    const words = [['حكاية', '#1a1a1a', '#f3e9c9'], ['مظاريف', '#9b1d1d', '#fff'], ['94', '#111', '#e9d27a'], ['أنا', '#203a8a', '#fff'], ['أعرف', '#111', '#f0f0f0'], ['السبت', '#fff', '#c62828'], ['سيعرف', '#111', '#e7e2d6'], ['الحي', '#1b5e20', '#fff'], ['كله', '#111', '#f8e6b0'], ['لا', '#111', '#fff'], ['تبيعي', '#4a148c', '#f3e5f5'], ['البيت', '#111', '#ffe082']];
    let x = w - 20, y = 40;
    for (const [t, fg, bg] of words) {
      const size = 26 + ((t.length * 7) % 14); c.font = `bold ${size}px ${t.length % 2 ? 'Cairo' : 'Amiri'}`;
      const tw = c.measureText(t).width + 12;
      if (x - tw < 20) { x = w - 20; y += 52; }
      c.save(); c.translate(x - tw / 2, y); c.rotate((t.length % 3 - 1) * 0.05);
      c.fillStyle = bg; c.fillRect(-tw / 2, -size * 0.65, tw, size * 1.3); rtl(c, c.font, fg, 'center'); c.fillText(t, 0, 2); c.restore();
      x -= tw + 8;
    }
  });
  const letter6 = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.27), new THREE.MeshStandardMaterial({ map: letterTex(420, 540), roughness: 0.9, side: THREE.DoubleSide }));
  letter6.rotation.x = -Math.PI / 2; letter6.rotation.z = 0.7; letter6.position.set(-1.85, 0.008, -3.25); scene.add(letter6);
  world.interactable(letter6, { id: 'ev_letter6', evidence: 'ev_letter6', label: 'الرسالة السادسة' });
  ctx.inspectModels.ev_letter6 = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.54), new THREE.MeshStandardMaterial({ map: letterTex(840, 1080), roughness: 0.9, side: THREE.DoubleSide })); return m; };
  // window sill with sunflower seed shells
  const seeds = new THREE.Group(); seeds.position.set(-3.5, 0.9 - 0.02, -6 + 0.08); scene.add(seeds);
  { const shell = plain('#ece6d6', 0.8), stripe = plain('#3b3b3b', 0.8);
    for (let i = 0; i < 46; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), i % 4 ? shell : stripe); s.scale.set(1.6, 0.4, 0.8); s.position.set((Math.random() - 0.5) * 1.0, 0.002, (Math.random() - 0.5) * 0.14); s.rotation.y = Math.random() * 3; seeds.add(s); } }
  world.zone(-3.5, 1.05, -5.9, 1.2, 0.35, 0.3, { id: 'ev_seeds', evidence: 'ev_seeds', label: 'حافة الشباك' });
  ctx.inspectModels.ev_seeds = () => { const g = seeds.clone(true); g.position.set(0, 0, 0); g.scale.setScalar(3); const sill = makeBox(1.1, 0.03, 0.2, plain('#d8d2c4', 0.4)); sill.position.y = -0.016; g.add(sill); return g; };
  void salonWin;
  // Medhat's briefcase on the sofa
  const brief = new THREE.Group(); brief.position.set(-5.2, 0.45, -2.3); brief.rotation.y = 0.3; scene.add(brief);
  { const lth = plain('#151515', 0.45, 0.2);
    const b = world.rounded(0.44, 0.09, 0.32, 0.02, lth); b.position.y = 0.045; brief.add(b);
    const lid = world.rounded(0.44, 0.02, 0.32, 0.01, lth); lid.position.set(0, 0.17, -0.15); lid.rotation.x = -1.2; brief.add(lid);
    const folder = makeBox(0.3, 0.012, 0.22, plain('#2e6b3a', 0.7)); folder.position.set(0, 0.095, 0.02); brief.add(folder);
    const lbl = paperMesh({ w: 0.12, h: 0.04, lines: 'احتياطي', hand: true, tint: '#fff', px: 140 }); lbl.rotation.x = -Math.PI / 2; lbl.position.set(0, 0.102, 0.02); brief.add(lbl); }
  world.interactable(brief, { id: 'ev_petition', evidence: 'ev_petition', label: 'حقيبة مدحت' });
  // radio + console, grandfather clock, husband portrait, chandelier
  const cons = await world.prop('ClassicConsole_01', { pos: [0.72, 0, -3.0], rot: -Math.PI / 2, scale: 0.8 });
  const consTop = DT(cons, 0.8);
  const radio = new THREE.Group(); radio.position.set(0.72, consTop, -3.05); radio.rotation.y = -Math.PI / 2; scene.add(radio);
  { const body = world.rounded(0.42, 0.24, 0.16, 0.03, await T('kitchen_wood', { size: 0.6, color: '#7a4a28', roughness: 0.4 })); body.position.y = 0.12; radio.add(body);
    const grill = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), plain('#c9b48a', 0.9)); grill.position.set(-0.08, 0.12, 0.081); radio.add(grill);
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb347', emissiveIntensity: 0.7 })); dial.position.set(0.12, 0.15, 0.081); radio.add(dial); }
  world.interactable(radio, { id: 'f_radio', label: 'راديو قديم', action: () => 'راديو خشبي قديم على محطة البرنامج العام. الأستاذة عفاف تقول إنها تسمعه حين لا يأتي ياسر. صوته خافت، لكن الشباك المفتوح يحمل كل صوت إلى الحديقة.' });
  await world.prop('vintage_grandfather_clock_01', { pos: [0.55, 0, -5.55], rot: -Math.PI / 2 - 0.3 });
  ctx.clockPos = new THREE.Vector3(0.55, 1.6, -5.55);
  const portrait = new THREE.Group(); portrait.position.set(-5.92, 1.7, -4.6); portrait.rotation.y = Math.PI / 2; scene.add(portrait);
  { const fr = makeBox(0.5, 0.62, 0.03, plain('#7a5a2a', 0.35, 0.6)); portrait.add(fr);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.54), new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTexture(210, 270, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8a7b63'); g.addColorStop(1, '#4a3f30'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2b2620'; c.beginPath(); c.ellipse(w / 2, h, w * 0.45, h * 0.35, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#c4a483'; c.beginPath(); c.ellipse(w / 2, h * 0.42, w * 0.18, h * 0.17, 0, 0, 7); c.fill();
      c.fillStyle = '#d9d6cf'; c.beginPath(); c.ellipse(w / 2, h * 0.3, w * 0.19, h * 0.07, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#3a3128'; c.fillRect(w / 2 - 22, h * 0.48, 44, 5);
    }) })); img.position.z = 0.016; portrait.add(img); }
  world.interactable(portrait, { id: 'f_portrait', label: 'صورة على الجدار', action: () => 'صورة بالأبيض والأسود لرجل وقور بشارب كثيف: الأستاذ محمود الشناوي، زوج عفاف، مدرس التاريخ. تحتها ورقة صغيرة: «1938 — 2018».' });
  const chand = await world.prop('Chandelier_02', { pos: [-3.3, 2.15, -3.1], rot: 0, collide: false, scale: 0.85 });
  void chand;
  world.spot(-3.3, 2.75, -3.1, -3.2, 0, -3.4, { color: '#ffcf96', intensity: 26, angle: 1.2, penumbra: 0.85, distance: 9 });
  await world.prop('potted_plant_02', { pos: [-5.5, 0, -5.5], rot: 0.5 });
  await world.prop('ornate_mirror_01', { pos: [-0.9, 1.6, -0.08], rot: Math.PI, collide: false, scale: 1.0 });
  // reading chair (Yasser's) by the armchair
  await world.prop('dining_chair_02', { pos: [-3.2, 0, -4.7], rot: 0.5 });

  // ================= STUDY =================
  world.point(3.5, 2.5, -4.0, { color: '#ffe2bc', intensity: 4.5, distance: 7 });
  const deskWood = await T('kitchen_wood', { size: 1, color: '#4a2f1c', roughness: 0.45 });
  const desk = makeDesk(world, { x: 3.4, z: -4.55, rot: Math.PI, w: 1.5, d: 0.75, h: 0.76, mat: deskWood });
  // sitter faces north (window); drawers are on the sitter's side (+z in world)
  const DTOP = desk.top;
  await world.prop('WoodenChair_01', { pos: [3.4, 0, -3.75], rot: Math.PI, scale: 1 });
  // typewriter
  const tw = new THREE.Group(); tw.position.set(3.35, DTOP, -4.7); scene.add(tw);
  { const dark = plain('#202322', 0.35, 0.4);
    const base = world.rounded(0.42, 0.12, 0.34, 0.03, dark); base.position.y = 0.06; tw.add(base);
    const carriage = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 16), plain('#111', 0.3)); carriage.rotation.z = Math.PI / 2; carriage.position.set(0, 0.15, -0.1); tw.add(carriage);
    const paper = paperMesh({ w: 0.2, h: 0.14, lines: 'مذكرات معلمة\nالفصل الأول', tint: '#f3efe2', px: 200 }); paper.position.set(0, 0.23, -0.12); paper.rotation.x = -0.25; tw.add(paper);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) { const key = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 10), plain('#e8e2d0', 0.5)); key.position.set(-0.17 + k * 0.038, 0.12 + r * 0.008, 0.06 + r * 0.025); tw.add(key); } }
  world.interactable(tw, { id: 'f_typewriter', label: 'آلة كاتبة', action: () => 'آلة كاتبة عربية قديمة، كانت للمرحوم. فيها ورقة بعنوان «مذكرات معلمة — الفصل الأول» بخط عفاف المطبوع. الرسائل المجهولة لم تُكتب بها: كلماتها مقصوصة من مجلات.' });
  // reading log, contract, will (inside a book)
  const logBook = new THREE.Group(); logBook.position.set(2.85, DTOP, -4.4); logBook.rotation.y = 0.25; scene.add(logBook);
  { const c = makeBox(0.2, 0.008, 0.27, plain('#2b5c8a', 0.7)); c.position.y = 0.004; logBook.add(c);
    const lbl = paperMesh({ w: 0.16, h: 0.07, lines: 'مذكرات معلّمة', hand: true, tint: '#fff', px: 200 }); lbl.rotation.x = -Math.PI / 2; lbl.position.y = 0.0085; logBook.add(lbl); }
  world.interactable(logBook, { id: 'ev_reading_log', evidence: 'ev_reading_log', label: 'كراسة زرقاء' });
  const contract = flatPaper(scene, { w: 0.21, h: 0.297, title: 'عقد بيع ابتدائي', lines: 'البائعة: عفاف الشناوي\nالمشتري: الرواد للتطوير العقاري\nالبند السابع: التسليم خاليًا من الشاغلين', tint: '#f4f2ec', px: 300 }, 3.85, DTOP, -4.45, -0.15);
  world.interactable(contract, { id: 'ev_contract', evidence: 'ev_contract', label: 'عقد على المكتب' });
  { const gl = new THREE.Group(); gl.position.set(3.9, DTOP + 0.01, -4.5); scene.add(gl);
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 18), plain('#222', 0.3, 0.6)); l.rotation.x = Math.PI / 2; l.position.x = sx * 0.028; gl.add(l); } }
  const ayyam = makeBook('#7a2a1e', 0.15, 0.03, 0.22, 'الأيام'); ayyam.position.set(2.75, DTOP, -4.85); ayyam.rotation.y = 0.4; scene.add(ayyam);
  { const peek = paperMesh({ w: 0.08, h: 0.05, lines: 'وصية', hand: true, tint: '#f7f2e3', px: 100 }); peek.rotation.x = -Math.PI / 2; peek.position.set(0.04, 0.031, -0.12); ayyam.add(peek); }
  world.interactable(ayyam, { id: 'ev_will', evidence: 'ev_will', label: 'كتاب «الأيام»' });
  await world.prop('desk_lamp_arm_01', { pos: [4.0, DTOP, -4.8], rot: -0.6, collide: false });
  world.spot(3.9, 1.25, -4.75, 3.4, DTOP, -4.5, { color: '#ffc985', intensity: 4, angle: 0.9, penumbra: 0.7, distance: 3, shadow: false });
  // drawers: [left pedestal top, mid, bottom, right top, mid, bottom] — after rot π, index 0..2 are on world +x side
  const lighterDrawer = desk.drawers[3], evictionDrawer = desk.drawers[0];
  lighterDrawer.position.z -= 0.12; // left ajar
  { const box = new THREE.Group(); box.position.z = 0.2; lighterDrawer.add(box);
    const folder = makeBox(0.24, 0.006, 0.3, plain('#c9a86a', 0.8)); folder.position.y = -0.06; box.add(folder);
    const lig = makeBox(0.035, 0.055, 0.012, plain('#c9cdd2', 0.2, 1)); lig.rotation.x = -Math.PI / 2; lig.position.set(0.03, -0.052, 0.0); box.add(lig); }
  world.interactable(lighterDrawer, { id: 'ev_lighter', evidence: 'ev_lighter', label: 'درج مفتوح قليلًا' });
  ctx.inspectModels.ev_lighter = () => {
    const g = new THREE.Group();
    const folder = makeBox(0.24, 0.008, 0.31, plain('#c9a86a', 0.8)); g.add(folder);
    const t = paperMesh({ w: 0.2, h: 0.06, lines: 'أوراق البيت — الأصول', tint: '#e8d9b0', px: 220 }); t.rotation.x = -Math.PI / 2; t.position.set(0, 0.005, -0.08); g.add(t);
    const lig = new THREE.Group(); lig.position.set(0.04, 0.03, 0.06); g.add(lig);
    const body = makeBox(0.038, 0.06, 0.013, plain('#c9cdd2', 0.2, 1)); lig.add(body);
    const eng = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.02), new THREE.MeshStandardMaterial({ transparent: true, map: canvasTexture(96, 64, (c, w, h) => { c.font = 'italic bold 30px serif'; c.fillStyle = '#6b6f75'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M. Sh.', w / 2, h / 2); }) })); eng.position.z = 0.0067; lig.add(eng);
    g.scale.setScalar(2.6); return g;
  };
  world.interactable(evictionDrawer, { id: 'ev_eviction', evidence: 'ev_eviction', label: 'درج المكتب' });
  // locked glass cabinet with the 1990s diaries
  const cab = new THREE.Group(); cab.position.set(5.72, 0, -4.2); cab.rotation.y = -Math.PI / 2; scene.add(cab);
  { const frame = deskWood;
    const back = makeBox(0.9, 1.6, 0.03, frame); back.position.set(0, 0.95, -0.18); cab.add(back);
    for (const sx of [-1, 1]) { const s = makeBox(0.03, 1.6, 0.38, frame); s.position.set(sx * 0.45, 0.95, 0); cab.add(s); }
    const top = makeBox(0.96, 0.04, 0.42, frame); top.position.y = 1.77; cab.add(top);
    const base = makeBox(0.96, 0.15, 0.42, frame); base.position.y = 0.075; cab.add(base);
    for (const y of [0.55, 1.05, 1.5]) { const sh = makeBox(0.88, 0.02, 0.34, frame); sh.position.y = y; cab.add(sh); }
    const yrs = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
    const r1 = spineRow(yrs(1990, 1995), { dust: 0.28 }); r1.position.set(0, 1.06, 0); cab.add(r1);
    const r2 = spineRow(yrs(1996, 2000), { dust: 0.28 }); r2.position.set(-0.05, 0.56, 0); cab.add(r2);
    const dust = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.32), new THREE.MeshStandardMaterial({ color: '#b8b2a6', transparent: true, opacity: 0.35, roughness: 1 })); dust.rotation.x = -Math.PI / 2; dust.position.set(0, 1.065 + 0.253, 0); cab.add(dust);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.4), new THREE.MeshPhysicalMaterial({ color: '#dfe8ea', roughness: 0.05, transparent: true, opacity: 0.15, depthWrite: false })); glass.position.set(0, 0.95, 0.19); cab.add(glass);
    const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), plain('#c9a96a', 0.3, 1)); lock.rotation.x = Math.PI / 2; lock.position.set(0.4, 0.95, 0.2); cab.add(lock); }
  world.physics.addBox(5.72, -4.2, 0.2, 0.48, 0, 0, 1.8);
  world.interactable(cab, { id: 'ev_diary94', evidence: 'ev_diary94', label: 'خزانة زجاجية مقفلة' });
  // open bookshelf with the 1979–1989 diaries (the ones read aloud)
  const shelf = await world.prop('wooden_bookshelf_worn', { pos: [2.1, 0, -5.72], rot: 0 });
  const shelfBox = shelf ? new THREE.Box3().setFromObject(shelf) : null;
  { const row = spineRow(Array.from({ length: 11 }, (_, i) => String(1979 + i)), { colors: ['#2e4a33', '#3d2a1d', '#5b2420'] });
    row.position.set(2.1, shelfBox ? shelfBox.min.y + (shelfBox.max.y - shelfBox.min.y) * 0.52 : 1.0, -5.62); scene.add(row);
    world.interactable(row, { id: 'f_diaries', label: 'يوميات الثمانينيات', action: () => 'دفاتر يوميات بغلاف قماشي، من 1979 حتى 1989، بلا غبار. بين صفحات 84 شريط قماش أحمر: هنا توقف ياسر يوم الاثنين.', note: 'يوميات 1979–1989 على الرف المفتوح، تُقرأ في الجلسات. ياسر توقف عند 84.' }); }
  await world.prop('book_encyclopedia_set_01', { pos: [2.1, shelfBox ? shelfBox.min.y + (shelfBox.max.y - shelfBox.min.y) * 0.78 : 1.5, -5.6], rot: 0, collide: false, scale: 0.9 });
  await world.prop('fancy_picture_frame_01', { pos: [1.08, 1.6, -3.8], rot: Math.PI / 2, collide: false, scale: 1.1 });

  // ================= KITCHEN =================
  world.point(-2.6, 2.5, 1.5, { color: '#f4f0ff', intensity: 4, distance: 7 });
  const marbleTop = await T('marble_01', { size: 1.2, roughness: 0.3 });
  { const run = makeBox(3.4, 0.88, 0.6, wood); run.position.set(-3.9, 0.44, 2.68); scene.add(run);
    const top = makeBox(3.44, 0.04, 0.64, marbleTop); top.position.set(-3.9, 0.9, 2.66); scene.add(top);
    world.physics.addBox(-3.9, 2.68, 1.72, 0.32, 0, 0, 0.92);
    const sink = makeBox(0.5, 0.02, 0.4, plain('#b9bcbd', 0.2, 1)); sink.position.set(-2.9, 0.925, 2.66); scene.add(sink); }
  await world.prop('vintage_electric_kettle', { pos: [-4.6, 0.92, 2.7], rot: Math.PI, collide: false, scale: 0.85 });
  await world.prop('jug_01', { pos: [-5.1, 0.92, 2.65], rot: 0.4, collide: false });
  // receipt book in the counter drawer
  const kDrawer = new THREE.Group(); kDrawer.position.set(-4.4, 0.75, 2.37); scene.add(kDrawer);
  { const f = makeBox(0.5, 0.14, 0.02, wood); kDrawer.add(f); const hnd = makeBox(0.14, 0.015, 0.02, plain('#9a9ea3', 0.3, 1)); hnd.position.z = -0.02; kDrawer.add(hnd); }
  world.interactable(kDrawer, { id: 'ev_receipt', evidence: 'ev_receipt', label: 'درج المطبخ' });
  // fridge with Seham's note
  const fridge = world.rounded(0.7, 1.75, 0.66, 0.04, new THREE.MeshPhysicalMaterial({ color: '#e5e1d6', roughness: 0.3, clearcoat: 0.5 }));
  fridge.position.set(-5.55, 0.875, 0.55); scene.add(fridge);
  world.physics.addBox(-5.55, 0.55, 0.34, 0.34, 0, 0, 1.75);
  const note = paperMesh({ w: 0.11, h: 0.13, lines: 'أم رضا\nالمجلات على السلم\nخديها\n— سهام', hand: true, tint: '#b9d0e6', px: 160, fontScale: 1.0 });
  note.rotation.y = Math.PI / 2; note.position.set(-5.19, 1.3, 0.5); scene.add(note);
  { const mag = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), plain('#d32f2f', 0.4)); mag.position.set(-5.18, 1.37, 0.5); scene.add(mag); }
  world.interactable(note, { id: 'ev_note', evidence: 'ev_note', label: 'ورقة على الثلاجة' });
  // table, chairs and Umm Reda's bag with the magazine bundle
  await world.prop('round_wooden_table_01', { pos: [-3.3, 0, 1.15], rot: 0, fit: { h: 0.74 } });
  await world.prop('dining_chair_02', { pos: [-4.1, 0, 1.15], rot: Math.PI / 2 });
  await world.prop('dining_chair_02', { pos: [-2.5, 0, 1.15], rot: -Math.PI / 2 });
  const umBag = makeBag('#3b3f5c', 0.44, 0.34, 0.2, world); umBag.position.set(-3.15, 0.74, 1.0); umBag.rotation.y = 0.2; scene.add(umBag);
  const magTex = canvasTexture(256, 340, (c, w, h) => {
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#b71c1c'; c.fillRect(0, 0, w, 64);
    rtl(c, 'bold 34px Cairo', '#fff', 'center'); c.fillText('حديث المدينة', w / 2, 34);
    c.fillStyle = '#7f9db3'; c.fillRect(20, 80, w - 40, 170);
    c.fillStyle = '#fff'; c.fillRect(w - 170, h - 60, 150, 40); rtl(c, '13px Cairo', '#111'); c.fillText('سهام عبد الحميد — الدور الأول', w - 26, h - 40);
  });
  const mags = new THREE.Group(); mags.position.set(0, 0.34, 0); umBag.add(mags);
  for (let i = 0; i < 6; i++) { const m = makeBox(0.21, 0.006, 0.28, i === 5 ? [plain('#ddd'), plain('#ddd'), new THREE.MeshStandardMaterial({ map: magTex, roughness: 0.4 }), plain('#ddd'), plain('#ddd'), plain('#ddd')] : plain(['#c9c2b0', '#d7d0c0', '#bfb8a6'][i % 3], 0.7)); m.position.y = i * 0.007; m.rotation.x = -1.2; m.position.z = -0.02; mags.add(m); }
  world.interactable(umBag, { id: 'ev_magazine', evidence: 'ev_magazine', label: 'حقيبة أم رضا' });
  ctx.inspectModels.ev_magazine = () => {
    const g = new THREE.Group();
    const holeTex = canvasTexture(512, 680, (c, w, h) => {
      c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c62828'; c.fillRect(30, 40, w - 60, 120); rtl(c, 'bold 64px Cairo', '#fff', 'center'); c.fillText('عروض', w * 0.68, 100);
      c.fillStyle = '#1b1b1b'; c.fillRect(70, 62, 170, 76);
      c.fillStyle = '#d6d0c4'; for (let y = 200; y < h - 40; y += 26) c.fillRect(40, y, w - 80 - (y % 52), 10);
      c.fillStyle = '#1b1b1b'; c.fillRect(300, 330, 120, 34); c.fillRect(90, 470, 90, 30); c.fillRect(260, 560, 140, 30);
    });
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ map: holeTex, roughness: 0.5, side: THREE.DoubleSide })); g.add(page);
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ map: magTex, roughness: 0.4 })); cover.rotation.y = Math.PI; cover.position.z = -0.003; g.add(cover);
    return g;
  };

  // ================= ENTRANCE HALL =================
  world.point(3.5, 2.5, 0.6, { color: '#ffe0b8', intensity: 4.5, distance: 7 });
  const tableH = await world.prop('ClassicConsole_01', { pos: [5.72, 0, -1.2], rot: -Math.PI / 2, scale: 0.75 });
  const phone = makeDialPhone(); phone.position.set(5.72, DT(tableH, 0.75), -1.25); phone.rotation.y = -Math.PI / 2; scene.add(phone);
  world.interactable(phone, { id: 'f_phone', label: 'هاتف قديم', action: () => 'هاتف بقرص دوار. بجانبه مفكرة أرقام بخط عفاف: «مدحت — سهام — ياسر — الإسعاف». رقم سهام مكتوب بالحبر الأحمر ومرسوم حوله قلب صغير.' });
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(256, 160, (c, w, h) => { c.fillStyle = '#6d4c33'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3e2a1b'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20); rtl(c, 'bold 34px Cairo', '#d9c29a', 'center'); c.fillText('أهلًا', w / 2, h / 2); }) }));
  mat.rotation.x = -Math.PI / 2; mat.rotation.z = Math.PI / 2; mat.position.set(5.5, 0.006, 0.36); scene.add(mat);
  world.interactable(mat, { id: 'f_doormat', label: 'تحت الباب', action: () => 'الفتحة بين الباب والأرض عريضة بما يكفي لظرف. من يقف على السلم يستطيع أن يدسه دون أن يُسمع.' });
  const rack = new THREE.Group(); rack.position.set(1.45, 0, 2.6); scene.add(rack);
  { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.8, 12), plain('#3b2a1c', 0.5)); pole.position.y = 0.9; rack.add(pole);
    const shawl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.7, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#5a3d5c', roughness: 1, side: THREE.DoubleSide })); shawl.position.y = 1.35; rack.add(shawl); }
  world.physics.addCircle(1.45, 2.6, 0.2);
  // key hooks by the door
  const keys = new THREE.Group(); keys.position.set(5.92, 1.5, 1.6); keys.rotation.y = -Math.PI / 2; scene.add(keys);
  { const board = makeBox(0.36, 0.14, 0.02, wood); keys.add(board);
    const brass = plain('#c9a96a', 0.3, 1);
    for (let i = 0; i < 4; i++) { const hk = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), brass); hk.rotation.x = Math.PI / 2; hk.position.set(-0.12 + i * 0.08, 0, 0.02); keys.add(hk); if (i !== 1) { const k = makeBox(0.012, 0.05, 0.003, brass); k.position.set(-0.12 + i * 0.08, -0.035, 0.022); keys.add(k); } }
    const lb = paperMesh({ w: 0.3, h: 0.035, lines: 'الشقة — البوابة — المكتب — السطح', tint: '#fff', px: 280 }); lb.position.set(0, 0.09, 0.012); keys.add(lb); }
  world.interactable(keys, { id: 'f_keys', label: 'لوحة المفاتيح', action: () => 'أربعة خطافات: الشقة، البوابة، المكتب، السطح. خطاف البوابة فارغ — عفاف تقول إن مفتاحها في حقيبة يدها. للبوابة ثلاث نسخ فقط: معها، ومع سهام، ومع أم رضا.', note: 'للبوابة الخارجية ثلاثة مفاتيح: عفاف، سهام، أم رضا.' });

  // ================= LANDING / STAIRS =================
  world.point(7.5, 3.0, 0.5, { color: '#ffd9a0', intensity: 4, distance: 7 });
  const steps = await T('marble_01', { size: 1, roughness: 0.35, color: '#d8d0c2' });
  for (let i = 0; i < 11; i++) { const s = makeBox(1.2, 0.17 * (i + 1), 0.3, steps); s.position.set(8.3, 0.085 * (i + 1), 2.65 - i * 0.3); scene.add(s); }
  { const upper = makeBox(1.2, 0.08, 1.2, steps); upper.position.set(8.3, 1.87, -1.25); scene.add(upper); }
  world.physics.addBox(8.3, 0.55, 0.62, 2.55, 0, 0, 2);
  const railMat = plain('#2e2620', 0.5, 0.3);
  { const rail = makeBox(0.05, 0.05, 3.5, railMat); rail.position.set(7.68, 1.95, 1.15); rail.rotation.x = 0.515; scene.add(rail);
    for (let i = 0; i < 11; i++) { const b = makeBox(0.02, 0.9, 0.02, plain('#2b2b2b', 0.4, 0.8)); b.position.set(7.68, 0.17 * (i + 1) + 0.45, 2.65 - i * 0.3); scene.add(b); } }
  world.zone(8.3, 1.0, 1.2, 1.2, 2, 2.6, { id: 'f_stairs', label: 'السلم إلى الدور الأول', action: () => 'السلم يصعد إلى شقة سهام. على الدرجة الأولى مربع نظيف وسط الغبار، كأن رزمة كانت موضوعة هنا ورُفعت اليوم.', note: 'على الدرجة الأولى للسلم أثر رزمة رُفعت اليوم — مكان المجلات التي تتركها سهام لأم رضا.' });
  const mailbox = new THREE.Group(); mailbox.position.set(6.12, 1.3, -1.2); mailbox.rotation.y = Math.PI / 2; scene.add(mailbox);
  { const b = makeBox(0.32, 0.4, 0.12, plain('#55623f', 0.5, 0.4)); mailbox.add(b);
    for (const [y, t] of [[0.1, 'الدور الأرضي — الشناوي'], [-0.08, 'الدور الأول — س. عبد الحميد']]) { const l = paperMesh({ w: 0.26, h: 0.04, lines: t, tint: '#fff', px: 260 }); l.position.set(0, y, 0.061); mailbox.add(l); } }
  world.interactable(mailbox, { id: 'f_mailbox', label: 'صندوق البريد', action: () => 'صندوقا بريد. في صندوق سهام إشعار من مجلة «حديث المدينة»: «اشتراككم السنوي يتجدد في يناير». الرسائل المجهولة لم تمر بالبريد أبدًا: لا طوابع، ولا أختام.' });
  await world.prop('potted_plant_01', { pos: [6.45, 0, 2.6], rot: 1.1 });

  // ================= ambient =================
  const moon = world.spot(-3.5, 4.0, -11, -3.5, 0, -3.5, { color: '#8fa8d6', intensity: 30, angle: 0.55, penumbra: 0.6, distance: 16, shadow: false });
  ctx.lightningLights.push(moon);
  scene.add(new THREE.HemisphereLight('#c8d0e0', '#3a3028', 0.33));
  scene.fog = new THREE.FogExp2('#0b0c10', 0.01);
  ctx.surfaceAt = (x, z) => world.surfaceAt(x, z);
  return ctx;
}
