import * as THREE from 'three';
import { Assets } from '../../engine/assets.js';
import { makeBox, plain, paperMesh, canvasTexture } from '../../engine/world.js';
import { audio } from '../../core/audio.js';

// Layout (metres, top view, north = -Z). Fifth floor of an office tower.
//   Open-plan accounting  x -8..3.5  z -10..0      | Copy room       x 3.5..8  z -10..-6
//                                                  | Hisham's office x 3.5..8  z -6..0
//   Kitchen  x -8..-3.5  z 0..4 | Reception x -3.5..3.5 z 0..4 | Meeting room x 3.5..8 z 0..4

export const NPCS = [
  { id: 'salim', name: 'الرقيب سليم', gender: 'm', height: 1.81, position: [1.25, 0, 1.7], rotation: -0.75, mood: 'calm',
    texturePatch: { body: patchPoliceUniform } },
  { id: 'noha', name: 'نهى', gender: 'f', height: 1.66, position: [-2.9, 0, 2.55], rotation: Math.PI / 2, mood: 'nervous' },
  { id: 'hisham', name: 'هشام', gender: 'm', height: 1.78, position: [5.8, 0, -4.72], rotation: 0, mood: 'calm', seated: true },
  { id: 'tarek', name: 'طارق', gender: 'm', height: 1.80, position: [-0.35, 0, -3.55], rotation: 0.5, mood: 'nervous',
    patrol: [[-0.35, -3.55, 0.5], [1.4, -2.2, 1.2], [0.2, -6.6, Math.PI]] },
  { id: 'saber', name: 'عم صابر', gender: 'm', height: 1.70, position: [-5.4, 0, 2.55], rotation: Math.PI, mood: 'friendly' },
];

export const PLAYER_START = { x: 0.2, z: 3.25, yaw: 0 };

// Paints the fictional «شرطة» sleeve patches onto the sergeant's uniform texture (same as case 1).
function patchPoliceUniform(ctx, w, h) {
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

// ---------------------------------------------------------------- small procedural props
const rtl = (c, font, color, align = 'right') => { c.font = font; c.fillStyle = color; c.direction = 'rtl'; c.textAlign = align; c.textBaseline = 'middle'; };

function screenTexture(draw) {
  return canvasTexture(640, 400, (c, w, h) => { c.fillStyle = '#0d1b2a'; c.fillRect(0, 0, w, h); draw(c, w, h); });
}
// Monitor on a stand; the screen faces local +z.
function makeMonitor(tex) {
  const g = new THREE.Group();
  const dark = plain('#1a1b1e', 0.45, 0.3);
  const base = makeBox(0.22, 0.015, 0.16, dark); base.position.y = 0.008; g.add(base);
  const neck = makeBox(0.04, 0.2, 0.03, dark); neck.position.set(0, 0.11, -0.04); g.add(neck);
  const bezel = makeBox(0.58, 0.36, 0.03, dark); bezel.position.set(0, 0.36, -0.03); g.add(bezel);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.545, 0.325), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.85, roughness: 0.3 }));
  scr.position.set(0, 0.36, -0.0145); g.add(scr);
  return g;
}
function makeKeyboard() {
  const g = new THREE.Group();
  const k = makeBox(0.44, 0.02, 0.14, plain('#202124', 0.6)); k.position.y = 0.01; g.add(k);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.7, map: canvasTexture(256, 72, (c, w, h) => { c.fillStyle = '#2b2c30'; c.fillRect(0, 0, w, h); c.fillStyle = '#3d3f44'; for (let y = 4; y < h - 6; y += 14) for (let x = 4; x < w - 8; x += 15) c.fillRect(x, y, 12, 11); }) }));
  keys.rotation.x = -Math.PI / 2; keys.position.y = 0.0205; g.add(keys);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), plain('#202124', 0.5)); mouse.scale.set(0.8, 0.45, 1.3); mouse.position.set(0.32, 0.012, 0.02); g.add(mouse);
  return g;
}
// Desk phone with a small display.
function makePhone(displayText) {
  const g = new THREE.Group();
  const body = plain('#26272a', 0.5);
  const base = makeBox(0.2, 0.05, 0.18, body); base.position.y = 0.025; base.rotation.x = -0.15; g.add(base);
  const handset = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.15, 4, 10), body); handset.rotation.z = Math.PI / 2; handset.position.set(-0.05, 0.068, -0.03); g.add(handset);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.04), new THREE.MeshStandardMaterial({ emissive: '#ffffff', emissiveIntensity: 0.9, emissiveMap: canvasTexture(256, 112, (c, w, h) => {
    c.fillStyle = '#9fc9a8'; c.fillRect(0, 0, w, h); rtl(c, 'bold 30px Cairo', '#10301a', 'center'); c.fillText(displayText[0], w / 2, 34); rtl(c, '26px Cairo', '#10301a', 'center'); c.fillText(displayText[1], w / 2, 80);
  }), color: '#000' }));
  disp.rotation.x = -Math.PI / 2 + 0.5; disp.position.set(0.045, 0.058, 0.02); g.add(disp);
  for (let i = 0; i < 12; i++) { const b = makeBox(0.014, 0.006, 0.012, plain('#55575c', 0.5)); b.position.set(0.03 + (i % 3) * 0.022, 0.05 + 0.006, -0.035 + Math.floor(i / 3) * 0.018 - 0.02); g.add(b); }
  return g;
}
// White mug; the gift inscription faces away from the keyboard.
function makeMug() {
  const g = new THREE.Group();
  const tex = canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h);
    rtl(c, 'bold 34px Cairo', '#b8913a', 'center'); c.fillText('إلى الأستاذ هشام', w * 0.25, 48);
    rtl(c, '22px Cairo', '#b8913a', 'center'); c.fillText('مع تحيات فريق الحسابات', w * 0.25, 90);
  });
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.2, clearcoat: 0.8 });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 32, 1, true), mat); cup.position.y = 0.05; g.add(cup);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.035, 0.098, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#f4f1ea', side: THREE.BackSide })); inner.position.y = 0.05; g.add(inner);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.038, 24), plain('#f4f1ea')); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.002; g.add(bottom);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.037, 24), new THREE.MeshPhysicalMaterial({ color: '#2a170c', roughness: 0.1, clearcoat: 1 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.035; g.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), mat); handle.rotation.z = -Math.PI / 2; handle.position.set(0.042, 0.05, 0); g.add(handle);
  return g;
}
// Missing-person style portrait of Sami (case file + desk photo).
function samiPortrait(c, w, h) {
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#8fa3b5'); bg.addColorStop(1, '#5d6e80'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const cx = w / 2;
  c.fillStyle = '#4a5260'; c.beginPath(); c.ellipse(cx, h * 1.02, w * 0.46, h * 0.36, 0, Math.PI, 0); c.fill();          // suit
  c.fillStyle = '#e9e6df'; c.beginPath(); c.moveTo(cx - w * 0.1, h * 0.68); c.lineTo(cx, h * 0.86); c.lineTo(cx + w * 0.1, h * 0.68); c.fill(); // shirt
  c.fillStyle = '#7a2e2e'; c.beginPath(); c.moveTo(cx - 8, h * 0.7); c.lineTo(cx, h * 0.92); c.lineTo(cx + 8, h * 0.7); c.fill();      // tie
  c.fillStyle = '#c99e7c'; c.fillRect(cx - w * 0.07, h * 0.5, w * 0.14, h * 0.18);                                           // neck
  c.beginPath(); c.ellipse(cx, h * 0.4, w * 0.2, h * 0.2, 0, 0, Math.PI * 2); c.fill();                                       // face
  c.fillStyle = '#2a2422'; c.beginPath(); c.ellipse(cx, h * 0.27, w * 0.21, h * 0.1, 0, Math.PI, 0); c.fill();             // hair
  c.fillRect(cx - w * 0.21, h * 0.26, w * 0.05, h * 0.1); c.fillRect(cx + w * 0.16, h * 0.26, w * 0.05, h * 0.1);
  c.strokeStyle = '#2a2422'; c.lineWidth = 3; for (const sx of [-1, 1]) { c.beginPath(); c.arc(cx + sx * w * 0.075, h * 0.4, w * 0.045, 0, Math.PI * 2); c.stroke(); }
  c.beginPath(); c.moveTo(cx - w * 0.03, h * 0.4); c.lineTo(cx + w * 0.03, h * 0.4); c.stroke();
  c.fillStyle = '#2a2422'; c.beginPath(); c.ellipse(cx, h * 0.5, w * 0.06, h * 0.014, 0, 0, Math.PI * 2); c.fill();         // moustache
  c.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 600; i++) c.fillRect(Math.random() * w, Math.random() * h, 1, 1);
}

export async function buildLevel(world, ctx) {
  const { scene } = world;
  const T = (id, o) => Assets.pbr(id, o);
  const [laminate, greyTiles, plaster, carpet, concrete, kitchenWood] = await Promise.all([
    T('laminate_floor_02', { size: 2.0, roughness: 0.6 }),
    T('large_grey_tiles', { size: 1.6, roughness: 0.4 }),
    T('beige_wall_001', { size: 2.5, color: '#ece9e1', normalScale: 0.4 }),
    T('dirty_carpet', { size: 1.4, color: '#b4bcc6' }),
    T('concrete_wall_008', { size: 3, color: '#8a8780' }),
    T('kitchen_wood', { size: 1.2, roughness: 0.6, color: '#8b6a48' }),
  ]);
  const accent = await T('beige_wall_001', { size: 2.5, color: '#4a6178', normalScale: 0.4 });
  const execWall = await T('beige_wall_002', { size: 2.5, color: '#ddd0b6', normalScale: 0.5 });
  const kitchenWall = await T('beige_wall_002', { size: 2.5, color: '#d4ddd2', normalScale: 0.4 });
  const splashTiles = await T('floor_tiles_06', { size: 0.6, roughness: 0.3 });
  const ceilingMat = plain('#eceae4', 0.95);
  const exterior = concrete;

  // ---------------- floors & ceilings ----------------
  world.floor(-8, -10, 3.5, 0, laminate, { ceiling: ceilingMat });
  world.floor(-3.5, 0, 3.5, 4, greyTiles, { ceiling: ceilingMat, surface: 'tile' });
  world.floor(-8, 0, -3.5, 4, greyTiles, { ceiling: ceilingMat, surface: 'tile' });
  world.floor(3.5, 0, 8, 4, laminate, { ceiling: ceilingMat });
  world.floor(3.5, -6, 8, 0, carpet, { ceiling: ceilingMat, surface: 'carpet' });
  world.floor(3.5, -10, 8, -6, greyTiles, { ceiling: ceilingMat, surface: 'tile' });

  // ---------------- walls ----------------
  const wallX = (z, x0, x1, north, south, ops = []) => world.wall(x0, z, x1, z, north, south, ops);
  const wallZ = (x, z0, z1, east, west, ops = []) => world.wall(x, z0, x, z1, east, west, ops);
  const DOOR = 0.92, DOORH = 2.1;
  // north exterior with windows (open plan + copy room)
  wallX(-10, -8, 3.5, exterior, plaster, [{ at: 1.4, w: 1.4, h: 1.6, sill: 0.8 }, { at: 4.8, w: 1.4, h: 1.6, sill: 0.8 }, { at: 8.2, w: 1.4, h: 1.6, sill: 0.8 }]);
  wallX(-10, 3.5, 8, exterior, plaster);
  // south exterior (kitchen, reception with elevator, meeting room)
  wallX(4, -8, -3.5, kitchenWall, exterior);
  wallX(4, -3.5, 3.5, accent, exterior);
  wallX(4, 3.5, 8, plaster, exterior);
  // west exterior
  wallZ(-8, -10, 0, plaster, exterior, [{ at: 4.2, w: 1.4, h: 1.6, sill: 0.8 }]);
  wallZ(-8, 0, 4, kitchenWall, exterior);
  // east exterior
  wallZ(8, -10, -6, exterior, plaster);
  wallZ(8, -6, 0, exterior, execWall, [{ at: 2.3, w: 1.4, h: 1.6, sill: 0.8 }]);
  wallZ(8, 0, 4, exterior, plaster, [{ at: 1.3, w: 1.4, h: 1.6, sill: 0.8 }]);
  // z=0: open plan | kitchen, reception (wide opening), meeting room
  wallX(0, -8, -3.5, plaster, kitchenWall, [{ at: 2.3, w: DOOR, h: DOORH }]);
  wallX(0, -3.5, 3.5, plaster, plaster, [{ at: 2.1, w: 2.8, h: 2.5 }]);
  wallX(0, 3.5, 8, execWall, plaster);
  // x=-3.5: kitchen | reception
  wallZ(-3.5, 0, 4, plaster, kitchenWall);
  // x=3.5: east rooms
  wallZ(3.5, -10, -6, plaster, plaster, [{ at: 1.0, w: DOOR, h: DOORH }]);
  wallZ(3.5, -6, 0, execWall, plaster, [{ at: 0.6, w: 2.0, h: 1.25, sill: 0.95 }, { at: 3.8, w: DOOR, h: DOORH }]);
  wallZ(3.5, 0, 4, plaster, accent, [{ at: 1.2, w: DOOR, h: DOORH }]);
  // z=-6: copy room | Hisham's office
  wallX(-6, 3.5, 8, plaster, execWall);

  // glass partition into Hisham's office (with half-closed blinds)
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#dfe8ea', roughness: 0.05, transparent: true, opacity: 0.14, envMapIntensity: 2, depthWrite: false });
  { const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.25), glassMat); gl.rotation.y = Math.PI / 2; gl.position.set(3.5, 0.95 + 0.625, -6 + 0.6 + 1.0); scene.add(gl);
    const slat = plain('#d7d2c6', 0.6);
    for (let i = 0; i < 9; i++) { const s = makeBox(0.06, 0.008, 1.96, slat); s.position.set(3.56, 2.12 - i * 0.07, -4.4); s.rotation.z = 0.9; scene.add(s); } }

  // ---------------- doors ----------------
  const doorWood = await T('kitchen_wood', { size: 1.5, color: '#6b4a30', roughness: 0.6 });
  const paintedDoor = plain('#e2ded5', 0.5);
  world.door({ x: -8 + 2.3, z: 0, rot: 0, w: DOOR, swing: 1.6, mat: paintedDoor, label: 'باب المطبخ' }).setOpenInstant(true);
  world.door({ x: 3.5, z: -10 + 1.0, rot: -Math.PI / 2, w: DOOR, swing: -1.6, mat: paintedDoor, label: 'باب غرفة التصوير' });
  world.door({ x: 3.5, z: -6 + 3.8, rot: -Math.PI / 2, w: DOOR, swing: 1.6, mat: doorWood, label: 'باب مكتب المدير المالي' }).setOpenInstant(true);
  world.door({ x: 3.5, z: 1.2, rot: -Math.PI / 2, w: DOOR, swing: -1.6, mat: paintedDoor, label: 'باب غرفة الاجتماعات' });
  // name plate next to Hisham's door
  { const p = paperMesh({ w: 0.3, h: 0.1, lines: 'هشام البنا — المدير المالي', tint: '#c9a86a', px: 300, fontScale: 1.3 }); p.rotation.y = -Math.PI / 2; p.position.set(3.42, 1.55, -1.75); scene.add(p); }

  // ---------------- windows (night city + drizzle) ----------------
  const winN = [-5.9, -2.5, 0.9].map(x => world.window({ x, z: -10, rot: Math.PI, w: 1.4, h: 1.6, sill: 0.8 }));
  world.window({ x: -8, z: -5.1, rot: -Math.PI / 2, w: 1.4, h: 1.6, sill: 0.8 });
  world.window({ x: 8, z: -3.0, rot: Math.PI / 2, w: 1.4, h: 1.6, sill: 0.8 });
  world.window({ x: 8, z: 2.0, rot: Math.PI / 2, w: 1.4, h: 1.6, sill: 0.8 });
  void winN;

  // ceiling light panels (emissive; real lights are few)
  const panelMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#f4f7ff', emissiveIntensity: 1.6 });
  const panel = (x, z, w = 0.6, d = 1.2) => { const p = makeBox(w, 0.03, d, panelMat); p.castShadow = false; p.position.set(x, 2.885, z); scene.add(p); };

  // ================= RECEPTION =================
  panel(-1.2, 2.0, 1.2, 0.6); panel(1.2, 2.0, 1.2, 0.6);
  world.point(0, 2.55, 2.0, { color: '#fff1dc', intensity: 6, distance: 8 });
  // main elevator (south wall)
  const elev = (x, z, rot, label, display) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    const steel = new THREE.MeshPhysicalMaterial({ color: '#8d9297', roughness: 0.38, metalness: 1 });
    const frame = plain('#5d6166', 0.4, 0.8);
    for (const sx of [-1, 1]) { const d = makeBox(0.55, 2.1, 0.02, steel); d.position.set(sx * 0.277, 1.05, 0.015); g.add(d); }
    const top = makeBox(1.3, 0.12, 0.05, frame); top.position.set(0, 2.16, 0.02); g.add(top);
    for (const sx of [-1, 1]) { const j = makeBox(0.07, 2.2, 0.05, frame); j.position.set(sx * 0.6, 1.1, 0.02); g.add(j); }
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveIntensity: 1, emissiveMap: canvasTexture(240, 80, (c, w, h) => { c.fillStyle = '#100'; c.fillRect(0, 0, w, h); rtl(c, 'bold 52px Cairo', '#ff5a3a', 'center'); c.fillText(display, w / 2, h / 2 + 3); }) }));
    disp.position.set(0, 2.38, 0.03); g.add(disp);
    const btn = makeBox(0.09, 0.2, 0.02, frame); btn.position.set(0.78, 1.15, 0.02); g.add(btn);
    const sign = paperMesh({ w: 0.5, h: 0.09, lines: label, tint: '#d9dcdf', px: 400, fontScale: 1.4 }); sign.position.set(0, 2.55, 0.03); g.add(sign);
    return g;
  };
  const mainElev = elev(0.2, 3.92, Math.PI, 'المصعد الرئيسي', '5');
  world.interactable(mainElev, { id: 'f_elev_main', label: 'المصعد الرئيسي', action: () => 'المصعد الرئيسي يفتح أمام مكتب الاستقبال مباشرة. من يستعمله لا بد أن يمر أمام نهى.' });
  // company logo on the accent wall
  { const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.42), new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.3, metalness: 0.6, map: canvasTexture(768, 216, (c, w, h) => { c.clearRect(0, 0, w, h); rtl(c, 'bold 96px Cairo', '#d8b56a', 'center'); c.fillText('النخبة', w / 2, 86); rtl(c, '38px Cairo', '#e8e2d2', 'center'); c.fillText('للاستيراد والتوريدات', w / 2, 170); }) }));
    logo.rotation.y = Math.PI; logo.position.set(-2.1, 1.95, 3.92); scene.add(logo); }
  // reception counter (runs along z, receptionist on the west side)
  const counterMat = await T('kitchen_wood', { size: 1.2, color: '#5b3d26', roughness: 0.45 });
  const counter = new THREE.Group(); counter.position.set(-1.95, 0, 2.3); scene.add(counter);
  { const front = makeBox(0.08, 1.08, 2.0, counterMat); front.position.set(0.26, 0.54, 0); counter.add(front);
    const top = makeBox(0.42, 0.04, 2.08, plain('#d9d4c9', 0.25)); top.position.set(0.14, 1.1, 0); counter.add(top);
    const work = makeBox(0.5, 0.04, 1.9, counterMat); work.position.set(-0.08, 0.76, 0); counter.add(work);
    const side = makeBox(0.6, 1.08, 0.06, counterMat); side.position.set(0, 0.54, 1.0); counter.add(side); }
  world.physics.addBox(-1.95, 2.3, 0.33, 1.03, 0, 0, 1.1);
  // phone with missed call (on the high counter top)
  const phone = makePhone(['مكالمة فائتة (1)', '1:14 م — البرق للشحن']);
  phone.position.set(-1.78, 1.12, 1.75); phone.rotation.y = Math.PI / 2; scene.add(phone);
  const sticky = paperMesh({ w: 0.075, h: 0.075, lines: 'أ. نهى\nالبرق 1:14\nلا أحد رد', hand: true, tint: '#f6e27a', px: 160, fontScale: 1.1 });
  sticky.rotation.x = -Math.PI / 2; sticky.rotation.z = Math.PI / 2 + 0.2; sticky.position.set(-1.7, 1.123, 1.93); scene.add(sticky);
  world.interactable(phone, { id: 'ev_missed', evidence: 'ev_missed', label: 'هاتف الاستقبال' });
  world.interactable(sticky, { id: 'ev_missed_note', evidence: 'ev_missed', label: 'ورقة صفراء' });
  ctx.inspectModels.ev_missed = () => { const g = makePhone(['مكالمة فائتة (1)', '1:14 م — البرق للشحن']); const s = sticky.clone(); s.position.set(0.02, 0.003, 0.15); s.rotation.set(-Math.PI / 2, 0, 0.2); g.add(s); return g; };
  // sign-in book (open) on the counter
  const book = new THREE.Group(); book.position.set(-1.8, 1.12, 2.75); book.rotation.y = Math.PI / 2; scene.add(book);
  { const cover = makeBox(0.46, 0.01, 0.32, plain('#1f3b2c', 0.7)); book.add(cover);
    const lp = paperMesh({ w: 0.22, h: 0.3, title: 'دفتر الحضور', lines: 'سامي فؤاد  8:55  —\nطارق عادل  9:10\nهشام البنا  9:30', tint: '#f3efe2', px: 300 });
    lp.rotation.x = -Math.PI / 2; lp.position.set(0.11, 0.007, 0); book.add(lp);
    const rp = paperMesh({ w: 0.22, h: 0.3, title: 'الزوار', lines: 'البرق للشحن 1:40\nشركة السلام 2:25 — 3:35', tint: '#f3efe2', px: 300 });
    rp.rotation.x = -Math.PI / 2; rp.position.set(-0.11, 0.007, 0); book.add(rp);
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 8), plain('#1c3f8a', 0.4)); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.6; pen.position.set(0.05, 0.012, 0.1); book.add(pen); }
  world.interactable(book, { id: 'ev_signin', evidence: 'ev_signin', label: 'دفتر الحضور والزوار' });
  // receptionist's monitor + chair
  { const m = makeMonitor(screenTexture((c, w, h) => { rtl(c, 'bold 34px Cairo', '#cfe3f5', 'center'); c.fillText('نظام الزوار', w / 2, 60); c.fillStyle = '#1e3550'; for (let i = 0; i < 6; i++) c.fillRect(40, 110 + i * 42, w - 80, 30); }));
    m.position.set(-2.2, 0.78, 2.0); m.rotation.y = -Math.PI / 2 + 0.15; m.scale.setScalar(0.85); scene.add(m); }
  await world.prop('modern_arm_chair_01', { pos: [-2.85, 0, 1.5], rot: Math.PI / 2 + 0.3, scale: 0.9 });
  // key cabinet on the wall behind reception
  const keyCab = new THREE.Group(); keyCab.position.set(-3.42, 1.45, 1.05); keyCab.rotation.y = Math.PI / 2; scene.add(keyCab);
  { const box = makeBox(0.5, 0.45, 0.06, plain('#6d5236', 0.6)); keyCab.add(box);
    const back = makeBox(0.44, 0.39, 0.01, plain('#e6dfcf', 0.9)); back.position.z = 0.031; keyCab.add(back);
    const brass = plain('#d1ad62', 0.25, 1);
    for (let i = 0; i < 8; i++) {
      const hx = -0.16 + (i % 4) * 0.107, hy = 0.09 - Math.floor(i / 4) * 0.17;
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), brass); hook.rotation.x = Math.PI / 2; hook.position.set(hx, hy, 0.05); keyCab.add(hook);
      if (i === 5) continue; // archive key missing
      const k = new THREE.Group(); k.position.set(hx, hy - 0.04, 0.045); keyCab.add(k);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 14), brass); ring.position.y = 0.025; k.add(ring);
      const blade = makeBox(0.012, 0.05, 0.003, brass); k.add(blade);
      const tag = makeBox(0.03, 0.022, 0.002, plain(['#c0392b', '#2e86c1', '#27ae60', '#f1c40f'][i % 4], 0.6)); tag.position.set(0.018, 0.0, 0.003); k.add(tag);
    }
    const label = paperMesh({ w: 0.07, h: 0.03, lines: 'أرشيف B2', tint: '#fff', px: 120, fontScale: 1.2 }); label.position.set(-0.16 + 1 * 0.107, 0.09 - 0.17 - 0.06, 0.037); keyCab.add(label);
    const log = paperMesh({ w: 0.21, h: 0.28, title: 'سجل المفاتيح', lines: 'الاجتماعات — طارق 2:20\nأرشيف B2 — هشام 1:05 — ـــ', tint: '#f3efe2', px: 300 });
    log.position.set(0, -0.42, 0.01); keyCab.add(log); }
  world.interactable(keyCab, { id: 'ev_keylog', evidence: 'ev_keylog', label: 'لوحة المفاتيح والسجل' });
  ctx.inspectModels.ev_keylog = () => keyCab.clone(true);
  // waiting area
  await world.prop('sofa_02', { pos: [2.35, 0, 3.5], rot: Math.PI });
  await world.prop('modern_coffee_table_01', { pos: [2.35, 0, 2.55], rot: Math.PI / 2 });
  await world.prop('potted_plant_01', { pos: [-3.0, 0, 3.55], rot: 0.4 });
  await world.prop('potted_plant_01', { pos: [3.05, 0, 0.45], rot: 1.2, scale: 0.9 });
  { const mags = paperMesh({ w: 0.21, h: 0.28, title: 'مجلة الاقتصاد', lines: 'الاستيراد في عام صعب', tint: '#e8eef4', px: 256 }); mags.rotation.x = -Math.PI / 2; mags.rotation.z = 0.3; mags.position.set(2.3, 0.395, 2.6); scene.add(mags); }

  // ================= OPEN-PLAN ACCOUNTING =================
  panel(-4.2, -3.0); panel(-1.0, -3.0); panel(-4.2, -7.2); panel(-1.0, -7.2); panel(2.2, -5.0);
  world.point(-2.6, 2.5, -3.6, { color: '#f2f4ff', intensity: 5, distance: 8 });
  world.point(-2.6, 2.5, -7.8, { color: '#f2f4ff', intensity: 4, distance: 8 });
  // focused light over Sami's desk (casts the office's main shadows)
  world.spot(-3.6, 2.8, -3.6, -4.2, 0.7, -5.0, { color: '#fff4e2', intensity: 14, angle: 0.75, penumbra: 0.8, distance: 7 });
  // cold city light through the windows (lightning flashes)
  const moon = world.spot(-2.5, 4.0, -14, -2.5, 0, -6.5, { color: '#8fa8d6', intensity: 40, angle: 0.6, penumbra: 0.6, distance: 18, shadow: false });
  ctx.lightningLights.push(moon);

  const DESK_TOP = 0.79;
  const desk = (x, z, rot = 0) => world.prop('metal_office_desk', { pos: [x, 0, z], rot });
  // row 1: Sami (west) and Tarek (east); sitters face north (-z)
  const SAMI = { x: -4.2, z: -5.0 }, TAREK = { x: -1.6, z: -5.0 };
  await desk(SAMI.x, SAMI.z, Math.PI);
  await desk(TAREK.x, TAREK.z, Math.PI);
  await desk(-4.2, -8.2, Math.PI);
  await desk(-1.6, -8.2, Math.PI);
  // low divider between the rows
  { const div = makeBox(4.6, 0.45, 0.04, plain('#3e5266', 0.9)); div.position.set(-2.9, DESK_TOP + 0.22, -5.5); scene.add(div); }
  const onDesk = (o, x, z, rot = 0) => { o.position.set(x, DESK_TOP, z); o.rotation.y = rot; scene.add(o); return o; };
  const DT = DESK_TOP;

  // --- Sami's desk ---
  const samiScreen = screenTexture((c, w, h) => {
    c.fillStyle = '#f2f4f7'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1f4e79'; c.fillRect(0, 0, w, 44); rtl(c, 'bold 24px Cairo', '#fff'); c.fillText('البريد — سامي فؤاد', w - 20, 23);
    c.fillStyle = '#dde4ec'; c.fillRect(w - 150, 44, 150, h - 44);
    rtl(c, '20px Cairo', '#1d2a38'); ['الوارد', 'الصادر', 'المحذوفات'].forEach((t, i) => { if (i === 1) { c.fillStyle = '#b9cde2'; c.fillRect(w - 150, 64 + i * 40, 150, 34); rtl(c, 'bold 20px Cairo', '#1d2a38'); } else rtl(c, '20px Cairo', '#1d2a38'); c.fillText(t, w - 20, 82 + i * 40); });
    rtl(c, 'bold 22px Cairo', '#1d2a38'); c.fillText('الموضوع: استقالة', w - 175, 80);
    rtl(c, '18px Cairo', '#4a5868'); c.fillText('إلى: الحاج منير العطار — الثلاثاء 2:52 م', w - 175, 112);
    rtl(c, '20px Cairo', '#1d2a38');
    ['أعتذر عن الاستمرار في العمل لظروف خاصة.', 'سأسافر لفترة، فلا تبحثوا عني.', 'أرجو تسوية مستحقاتي.', 'سامي'].forEach((t, i) => c.fillText(t, w - 175, 160 + i * 34));
  });
  const samiMon = onDesk(makeMonitor(samiScreen), SAMI.x, SAMI.z - 0.12, 0);
  world.interactable(samiMon, { id: 'ev_computer', evidence: 'ev_computer', label: 'حاسوب سامي' });
  onDesk(makeKeyboard(), SAMI.x, SAMI.z + 0.18, 0);
  const mug = onDesk(makeMug(), SAMI.x + 0.36, SAMI.z + 0.2, Math.PI);
  world.interactable(mug, { id: 'ev_mug', evidence: 'ev_mug', label: 'كوب قهوة' });
  ctx.inspectModels.ev_mug = () => { const m = makeMug(); m.scale.setScalar(4); return m; };
  // planner (open leather diary)
  const planner = new THREE.Group(); onDesk(planner, SAMI.x - 0.5, SAMI.z + 0.12, 0.15);
  { const leather = makeBox(0.36, 0.012, 0.25, plain('#4a2a1a', 0.7)); leather.position.y = 0.006; planner.add(leather);
    const pg = paperMesh({ w: 0.17, h: 0.23, lines: 'الاثنين — الفجر؟؟ 14\nالثلاثاء — هـ. آخر مهلة\nالأربعاء — الحاج منير', hand: true, tint: '#f7f2e3', px: 256 }); pg.rotation.x = -Math.PI / 2; pg.position.set(-0.088, 0.0125, 0); planner.add(pg);
    const pg2 = paperMesh({ w: 0.17, h: 0.23, lines: 'مراجعة الربع الثالث', hand: true, tint: '#f7f2e3', px: 256 }); pg2.rotation.x = -Math.PI / 2; pg2.position.set(0.088, 0.0125, 0); planner.add(pg2); }
  world.interactable(planner, { id: 'ev_planner', evidence: 'ev_planner', label: 'مفكرة سامي' });
  // hotel booking + family photo
  const booking = paperMesh({ w: 0.21, h: 0.297, title: 'فندق الشعاب — تأكيد حجز', lines: 'باسم: سامي فؤاد\n2 بالغين + 2 أطفال\n18 — 23 يناير', tint: '#f4f6f2', px: 300 });
  booking.rotation.x = -Math.PI / 2; booking.rotation.z = -0.25; onDesk(booking, SAMI.x - 0.62, SAMI.z - 0.22, 0); booking.position.y = DT + 0.002;
  world.interactable(booking, { id: 'ev_brochure', evidence: 'ev_brochure', label: 'ورقة حجز' });
  const photo = new THREE.Group(); onDesk(photo, SAMI.x + 0.62, SAMI.z - 0.2, -0.35);
  { const f = makeBox(0.16, 0.12, 0.012, plain('#2b2622', 0.5)); f.position.y = 0.065; f.rotation.x = -0.15; photo.add(f);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTexture(280, 200, (c, w, h) => {
      const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#7fb6d8'); sky.addColorStop(0.55, '#cfe6ef'); sky.addColorStop(0.56, '#e9d7a8'); sky.addColorStop(1, '#d7c08c'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
      const fig = (x, s, col) => { c.fillStyle = col; c.fillRect(x - 12 * s, h - 110 * s, 24 * s, 80 * s); c.fillStyle = '#c99e7c'; c.beginPath(); c.arc(x, h - 122 * s, 13 * s, 0, Math.PI * 2); c.fill(); };
      fig(80, 1, '#3a4a6a'); fig(130, 0.95, '#a44a5a'); fig(175, 0.6, '#e2a13a'); fig(210, 0.55, '#3f8a5a');
    }) }));
    img.position.set(0, 0.065, 0.0065); img.rotation.x = -0.15; photo.add(img); }
  world.interactable(photo, { id: 'f_photo_sami', label: 'صورة عائلية', action: () => 'سامي مع زوجته وطفليه على شاطئ البحر، الجميع يضحك. في زاوية الإطار ورقة صغيرة بخط طفل: «بابا، لا تتأخر».' });
  { const tea = makeBox(0.12, 0.07, 0.07, plain('#4f8a4a', 0.6)); onDesk(tea, SAMI.x + 0.66, SAMI.z + 0.15, 0.3); tea.position.y = DT + 0.035; }
  // Sami's chair with his jacket
  await world.prop('modern_arm_chair_01', { pos: [SAMI.x, 0, SAMI.z + 0.95], rot: Math.PI + 0.12, scale: 0.9 });
  const jacket = new THREE.Group(); jacket.position.set(SAMI.x + 0.03, 0, SAMI.z + 1.5); jacket.rotation.y = 0.12; scene.add(jacket);
  const cloth = new THREE.MeshStandardMaterial({ color: '#5b5f66', roughness: 0.95 });
  { const torso = world.rounded(0.5, 0.6, 0.06, 0.03, cloth); torso.position.set(0, 0.6, 0); torso.rotation.x = -0.12; jacket.add(torso);
    const collar = world.rounded(0.44, 0.07, 0.2, 0.03, cloth); collar.position.set(0, 0.92, -0.07); jacket.add(collar);
    const seam = makeBox(0.012, 0.5, 0.005, plain('#3f4248', 0.9)); seam.position.set(0, 0.6, 0.035); seam.rotation.x = -0.12; jacket.add(seam);
    for (const sx of [-1, 1]) { const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.55, 10), cloth); sl.position.set(sx * 0.27, 0.6, 0.0); sl.rotation.z = sx * 0.06; sl.castShadow = true; jacket.add(sl); } }
  world.interactable(jacket, { id: 'ev_jacket', evidence: 'ev_jacket', label: 'سترة على الكرسي' });
  ctx.inspectModels.ev_jacket = () => {
    const g = jacket.clone(true); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
    const wallet = makeBox(0.11, 0.02, 0.09, plain('#3b2418', 0.55)); wallet.position.set(-0.12, 0.42, 0.12); g.add(wallet);
    const keys = new THREE.Group(); keys.position.set(0.12, 0.42, 0.12); g.add(keys);
    const fob = makeBox(0.035, 0.06, 0.014, plain('#151515', 0.4)); keys.add(fob);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 6, 16), plain('#ccc', 0.2, 1)); ring.position.y = 0.045; keys.add(ring);
    const tag = makeBox(0.04, 0.04, 0.004, new THREE.MeshStandardMaterial({ map: canvasTexture(64, 64, (c) => { c.fillStyle = '#7fb6d8'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#c99e7c'; c.beginPath(); c.arc(22, 30, 8, 0, 7); c.arc(42, 34, 7, 0, 7); c.fill(); }) })); tag.position.set(0.03, 0.07, 0); keys.add(tag);
    return g;
  };
  // Sami's drawer pedestal (forged invoice)
  const ped = (x, z, rot, mat) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    const body = makeBox(0.4, 0.56, 0.5, mat); body.position.y = 0.3; g.add(body);
    const faces = [];
    for (let i = 0; i < 3; i++) { const f = makeBox(0.37, 0.16, 0.015, mat); f.position.set(0, 0.48 - i * 0.18, 0.256); g.add(f); const hnd = makeBox(0.12, 0.012, 0.02, plain('#9a9ea3', 0.3, 1)); hnd.position.set(0, 0.52 - i * 0.18, 0.27); g.add(hnd); faces.push(f); }
    const wheel = makeBox(0.36, 0.04, 0.46, plain('#222')); wheel.position.y = 0.02; g.add(wheel);
    world.physics.addBox(x, z, 0.21, 0.26, rot, 0, 0.6);
    return { g, faces };
  };
  const pedMat = plain('#7d8389', 0.5, 0.4);
  const samiPed = ped(SAMI.x - 0.62, SAMI.z + 0.45, 0, pedMat);
  samiPed.faces[0].position.z += 0.07; // top drawer left ajar
  world.interactable(samiPed.g, { id: 'ev_forged', evidence: 'ev_forged', label: 'أدراج مكتب سامي' });

  // --- Tarek's desk ---
  const lockTex = (name) => screenTexture((c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1f3b5a'); gr.addColorStop(1, '#0b1520'); c.fillStyle = gr; c.fillRect(0, 0, w, h); rtl(c, 'bold 70px Cairo', '#e7edf3', 'center'); c.fillText('9:14', w / 2, 140); rtl(c, '26px Cairo', '#b9c7d4', 'center'); c.fillText(name, w / 2, 230); c.fillText('مقفل — أدخل كلمة المرور', w / 2, 275); });
  onDesk(makeMonitor(lockTex('طارق عادل')), TAREK.x, TAREK.z - 0.12, 0);
  onDesk(makeKeyboard(), TAREK.x, TAREK.z + 0.18, 0);
  await world.prop('modern_arm_chair_01', { pos: [TAREK.x + 0.1, 0, TAREK.z + 1.0], rot: Math.PI - 0.3, scale: 0.9 });
  const warning = paperMesh({ w: 0.21, h: 0.297, title: 'إنذار كتابي', lines: 'السيد / طارق عادل\nبناءً على تقرير رئيس الحسابات\nسامي فؤاد...', tint: '#f1efe8', px: 300 });
  warning.rotation.x = -Math.PI / 2; warning.rotation.z = 0.4; onDesk(warning, TAREK.x + 0.55, TAREK.z + 0.1, 0); warning.position.y = DT + 0.002;
  world.interactable(warning, { id: 'ev_warning', evidence: 'ev_warning', label: 'ورقة مجعدة' });
  await world.prop('potted_plant_04', { pos: [TAREK.x + 0.62, DT, TAREK.z + 0.02], collide: false, scale: 0.9 });
  // Tarek's bag on the floor with the interview card
  const bag = new THREE.Group(); bag.position.set(TAREK.x + 0.75, 0, TAREK.z + 0.85); bag.rotation.y = -0.5; scene.add(bag);
  { const leather = plain('#2c2420', 0.7);
    const b = world.rounded(0.4, 0.3, 0.12, 0.03, leather); b.position.y = 0.15; bag.add(b);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20, Math.PI), leather); strap.position.y = 0.3; bag.add(strap);
    const card = paperMesh({ w: 0.12, h: 0.08, lines: 'شركة الأفق\nالثلاثاء 1:15', tint: '#ffffff', px: 200, fontScale: 1.2 }); card.position.set(0.08, 0.31, 0.065); card.rotation.z = 0.2; bag.add(card); }
  world.physics.addCircle(bag.position.x, bag.position.z, 0.2);
  world.interactable(bag, { id: 'ev_interview', evidence: 'ev_interview', label: 'حقيبة طارق' });

  // --- empty desks (row 2) ---
  onDesk(makeMonitor(lockTex('منى رشاد')), -4.2, -8.32, 0);
  onDesk(makeMonitor(lockTex('كريم حسني')), -1.6, -8.32, 0);
  await world.prop('modern_arm_chair_01', { pos: [-4.2, 0, -7.3], rot: Math.PI + 0.4, scale: 0.9 });
  await world.prop('modern_arm_chair_01', { pos: [-1.5, 0, -7.25], rot: Math.PI - 0.2, scale: 0.9 });
  { const b = await world.prop('binder_notebook', { pos: [-4.5, DT, -8.0], rot: 0.3, collide: false }); void b; }
  await world.prop('stationery_supplies', { pos: [-1.2, DT + 0.07, -8.0], rot: 0.5, collide: false });
  await world.prop('vintage_stapler', { pos: [-2.0, DT + 0.01, -7.95], rot: 1.2, collide: false });
  // filing cabinets, plants, water cooler, wall clock
  await world.prop('drawer_cabinet', { pos: [-7.7, 0, -7.6], rot: Math.PI / 2, scale: 0.9 });
  await world.prop('drawer_cabinet', { pos: [-7.7, 0, -2.6], rot: Math.PI / 2, scale: 0.9 });
  await world.prop('potted_plant_01', { pos: [-7.4, 0, -9.4], rot: 0.2 });
  await world.prop('potted_plant_01', { pos: [3.0, 0, -9.4], rot: 2.2 });
  const cooler = new THREE.Group(); cooler.position.set(2.95, 0, -0.6); scene.add(cooler);
  { const body = world.rounded(0.32, 1.0, 0.32, 0.03, plain('#e8e8e4', 0.4)); body.position.y = 0.5; cooler.add(body);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.45, 20), new THREE.MeshPhysicalMaterial({ color: '#9cc8e8', transparent: true, opacity: 0.45, roughness: 0.05 })); bottle.position.y = 1.25; cooler.add(bottle);
    for (const [c, x] of [['#2e86c1', -0.06], ['#c0392b', 0.06]]) { const t = makeBox(0.03, 0.04, 0.03, plain(c, 0.4)); t.position.set(x, 0.75, 0.17); cooler.add(t); } }
  world.physics.addCircle(2.95, -0.6, 0.2);
  world.interactable(cooler, { id: 'f_cooler', label: 'مبرّد الماء', action: () => 'مبرّد ماء نصف ممتلئ. بجانبه أكواب ورقية وسلة صغيرة. لا شيء يلفت النظر.' });
  await world.prop('wall_clock', { pos: [-0.5, 2.25, -9.92], rot: 0, collide: false, scale: 1.4 });
  ctx.clockPos = new THREE.Vector3(-0.5, 2.25, -9.9);
  await world.prop('fire_alarm', { pos: [-7.92, 1.5, -1.0], rot: Math.PI / 2, collide: false });

  // ================= COPY ROOM =================
  panel(5.8, -8.0, 1.2, 0.6);
  world.point(5.8, 2.5, -8.0, { color: '#eef3ff', intensity: 3.5, distance: 6 });
  const copier = new THREE.Group(); copier.position.set(6.4, 0, -9.55); scene.add(copier);
  { const grey = plain('#c9cbc8', 0.5), dark = plain('#3a3c3f', 0.5);
    const base = makeBox(1.0, 0.95, 0.65, grey); base.position.y = 0.475; copier.add(base);
    const top = makeBox(0.9, 0.12, 0.55, dark); top.position.y = 1.01; copier.add(top);
    const lid = makeBox(0.85, 0.05, 0.5, grey); lid.position.y = 1.1; copier.add(lid);
    const ctrl = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveIntensity: 0.9, emissiveMap: canvasTexture(220, 100, (c, w, h) => { c.fillStyle = '#2b5f8a'; c.fillRect(0, 0, w, h); rtl(c, 'bold 26px Cairo', '#fff', 'center'); c.fillText('جاهز', w / 2, 34); rtl(c, '20px Cairo', '#d7e6f2', 'center'); c.fillText('نسخ اليوم: 214', w / 2, 72); }) }));
    ctrl.rotation.x = -0.7; ctrl.position.set(0.3, 1.0, 0.3); copier.add(ctrl);
    for (let i = 0; i < 3; i++) { const tray = makeBox(0.8, 0.02, 0.4, dark); tray.position.set(0, 0.25 + i * 0.22, 0.33); copier.add(tray); } }
  world.physics.addBox(6.4, -9.55, 0.52, 0.34, 0, 0, 1.15);
  world.interactable(copier, { id: 'f_copier', label: 'آلة التصوير', action: () => 'آلة تصوير كبيرة. في سجل الاستخدام: يوم الاثنين، 186 نسخة من حساب «سامي ف.» بعد انتهاء الدوام. سامي كان ينسخ شيئًا كبيرًا.', note: 'سامي نسخ 186 ورقة مساء الاثنين بعد انتهاء الدوام.' });
  ctx.humSources.push(() => new THREE.Vector3(6.4, 0.8, -9.5));
  // shredder with red cardboard strips behind a clear window
  const shredder = new THREE.Group(); shredder.position.set(4.25, 0, -7.0); shredder.rotation.y = Math.PI / 2; scene.add(shredder);
  const strips = new THREE.Group();
  { const body = plain('#2d2f33', 0.45);
    const bin = makeBox(0.42, 0.62, 0.32, body); bin.position.y = 0.31; shredder.add(bin);
    const head = makeBox(0.44, 0.12, 0.34, plain('#1c1d20', 0.4)); head.position.y = 0.68; shredder.add(head);
    const slot = makeBox(0.3, 0.004, 0.01, plain('#000')); slot.position.set(0, 0.742, 0); shredder.add(slot);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshPhysicalMaterial({ color: '#cfe0e8', transparent: true, opacity: 0.25, roughness: 0.05 })); win.position.set(0, 0.32, 0.162); shredder.add(win);
    strips.position.set(0, 0.1, 0.0); shredder.add(strips);
    for (let i = 0; i < 70; i++) { const red = i % 4 === 0; const s = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 0.12 + Math.random() * 0.12), plain(red ? '#a8231f' : (i % 3 ? '#f1eee6' : '#e2ddd0'), 0.9)); s.material.side = THREE.DoubleSide; s.position.set((Math.random() - 0.5) * 0.36, Math.random() * 0.36, 0.1 + Math.random() * 0.05); s.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); strips.add(s); }
    const lid = paperMesh({ w: 0.2, h: 0.06, lines: 'سلة الورق — تُفرغ يوم الخميس', tint: '#ffffff', px: 220, fontScale: 1.1 }); lid.position.set(0, 0.55, 0.163); shredder.add(lid); }
  world.physics.addBox(4.25, -7.0, 0.18, 0.23, Math.PI / 2, 0, 0.75);
  world.interactable(shredder, { id: 'ev_shredder', evidence: 'ev_shredder', label: 'آلة التمزيق' });
  ctx.inspectModels.ev_shredder = () => { const g = strips.clone(true); g.scale.setScalar(2.2); return g; };
  await world.prop('steel_frame_shelves_02', { pos: [7.6, 0, -7.4], rot: -Math.PI / 2 });
  await world.prop('cardboard_box_01', { pos: [7.55, 0, -8.5], rot: 0.3 });
  await world.prop('cardboard_box_01', { pos: [7.5, 0.34, -8.45], rot: -0.2, collide: false, scale: 0.9 });

  // ================= HISHAM'S OFFICE =================
  panel(5.75, -3.0, 1.2, 0.6);
  world.point(5.75, 2.5, -2.8, { color: '#ffe8c8', intensity: 7.5, distance: 8 });
  const deskWood = await T('kitchen_wood', { size: 1, color: '#4e3220', roughness: 0.45 });
  const hDesk = new THREE.Group(); hDesk.position.set(5.8, 0, -3.65); scene.add(hDesk);
  const HD_TOP = 0.77;
  { const top = makeBox(1.7, 0.05, 0.85, deskWood); top.position.y = HD_TOP - 0.025; hDesk.add(top);
    const modesty = makeBox(0.85, 0.5, 0.03, deskWood); modesty.position.set(0, 0.45, 0.38); hDesk.add(modesty);
    for (const sx of [-1, 1]) { const p = makeBox(0.42, HD_TOP - 0.05, 0.8, deskWood); p.position.set(sx * 0.62, (HD_TOP - 0.05) / 2, 0); hDesk.add(p); } }
  world.physics.addBox(5.8, -3.65, 0.86, 0.44, 0, 0, HD_TOP);
  // drawers on Hisham's side (-z); top right one is locked
  const hDrawer = new THREE.Group(); hDrawer.position.set(0.62, 0.6, -0.41); hDesk.add(hDrawer);
  { const face = makeBox(0.38, 0.17, 0.02, deskWood); hDrawer.add(face);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), plain('#c9a96a', 0.3, 1)); knob.position.z = -0.02; hDrawer.add(knob);
    const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.01, 12), plain('#c9a96a', 0.3, 1)); lock.rotation.x = Math.PI / 2; lock.position.set(0, 0.055, -0.012); hDrawer.add(lock);
    const box = new THREE.Group(); box.position.z = 0.2; hDrawer.add(box);
    const bottom = makeBox(0.36, 0.01, 0.38, deskWood); bottom.position.y = -0.07; box.add(bottom);
    const hp = new THREE.Group(); hp.position.set(-0.06, -0.055, 0); box.add(hp);
    const phoneBody = world.rounded(0.075, 0.012, 0.15, 0.008, plain('#2a5b9a', 0.4)); hp.add(phoneBody);
    const archKey = new THREE.Group(); archKey.position.set(0.1, -0.06, 0.03); box.add(archKey);
    const brass = plain('#d1ad62', 0.25, 1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 14), brass); ring.rotation.x = Math.PI / 2; archKey.add(ring);
    const blade = makeBox(0.012, 0.004, 0.07, brass); blade.position.z = 0.05; archKey.add(blade);
    const tag = paperMesh({ w: 0.05, h: 0.025, lines: 'أرشيف B2', tint: '#fff', px: 100, fontScale: 1.2 }); tag.rotation.x = -Math.PI / 2; tag.position.set(-0.04, 0.003, -0.01); archKey.add(tag); }
  for (let i = 1; i < 3; i++) { const f = makeBox(0.38, 0.17, 0.02, deskWood); f.position.set(0.62, 0.6 - i * 0.2, -0.41); hDesk.add(f); const f2 = f.clone(); f2.position.x = -0.62; hDesk.add(f2); }
  { const f = makeBox(0.38, 0.17, 0.02, deskWood); f.position.set(-0.62, 0.6, -0.41); hDesk.add(f); }
  world.updaters.push(dt => { hDrawer.position.z += ((ctx.flags.hdOpen ? -0.72 : -0.41) - hDrawer.position.z) * Math.min(1, dt * 4); });
  world.interactable(hDrawer, {
    id: 'ev_hisham_drawer', evidence: 'ev_hisham_drawer',
    label: () => ctx.flags.hdOpen ? 'تفحّص ما في الدرج' : 'الدرج المقفل',
    blocked: g => g.flag('warrant') ? null : g.flag('hisham_refused')
      ? 'الدرج مقفل، وهشام رفض أن يفتحه. ستحتاج إذنًا من النيابة — الرقيب سليم قد يساعدك.'
      : 'الدرج العلوي مقفل بالمفتاح. الدرج درج هشام — اطلب منه أن يفتحه أولًا.',
    before: () => { if (!ctx.flags.hdOpen) { ctx.flags.hdOpen = true; audio.door(true); return 'delay'; } },
  });
  ctx.inspectModels.ev_hisham_drawer = () => {
    const g = new THREE.Group();
    const p = world.rounded(0.075, 0.012, 0.15, 0.008, plain('#2a5b9a', 0.4)); g.add(p);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.13), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveIntensity: 0.8, emissiveMap: canvasTexture(130, 260, (c, w, h) => { samiPortrait(c, w, h); rtl(c, 'bold 34px Cairo', '#fff', 'center'); c.fillText('1:40', w / 2, 40); }) }));
    scr.rotation.x = -Math.PI / 2; scr.position.y = 0.0065; g.add(scr);
    const key = new THREE.Group(); key.position.set(0.1, 0, 0.02); g.add(key);
    const brass = plain('#d1ad62', 0.25, 1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 14), brass); ring.rotation.x = Math.PI / 2; key.add(ring);
    const blade = makeBox(0.012, 0.004, 0.07, brass); blade.position.z = 0.05; key.add(blade);
    const tag = paperMesh({ w: 0.05, h: 0.025, lines: 'أرشيف B2', tint: '#fff', px: 100, fontScale: 1.2 }); tag.rotation.x = -Math.PI / 2; tag.position.set(-0.04, 0.003, -0.01); key.add(tag);
    g.scale.setScalar(2.5); return g;
  };
  // Hisham's chair (he is seated in it) and visitor chairs
  await world.prop('modern_arm_chair_01', { pos: [5.8, 0, -4.72], rot: 0, collide: false });
  await world.prop('dining_chair_02', { pos: [5.35, 0, -2.6], rot: Math.PI + 0.2 });
  await world.prop('dining_chair_02', { pos: [6.3, 0, -2.6], rot: Math.PI - 0.2 });
  // desk items
  { const m = makeMonitor(screenTexture((c, w, h) => { c.fillStyle = '#f4f6f8'; c.fillRect(0, 0, w, h); c.fillStyle = '#2c6e49'; c.fillRect(0, 0, w, 40); rtl(c, 'bold 22px Cairo', '#fff'); c.fillText('الميزانية الربعية.xlsx', w - 16, 21); c.strokeStyle = '#cfd6dd'; for (let y = 60; y < h; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let x = 0; x < w; x += 90) { c.beginPath(); c.moveTo(x, 40); c.lineTo(x, h); c.stroke(); } rtl(c, '16px Cairo', '#333'); for (let r = 0; r < 12; r++) for (let k = 0; k < 6; k++) c.fillText(String((r * 7919 + k * 104729) % 90000 + 1000), w - 10 - k * 90, 73 + r * 26); }));
    m.position.set(6.35, HD_TOP, -3.85); m.rotation.y = Math.PI + 0.45; scene.add(m); }
  { const plate = new THREE.Group(); plate.position.set(5.8, HD_TOP, -3.32); scene.add(plate);
    const b = makeBox(0.3, 0.07, 0.05, plain('#2b2b2b', 0.3, 0.5)); b.position.y = 0.035; b.rotation.x = -0.3; plate.add(b);
    const t = paperMesh({ w: 0.28, h: 0.055, lines: 'هشام البنا — المدير المالي', tint: '#d7b46a', px: 300, fontScale: 1.35 }); t.position.set(0, 0.04, 0.027); t.rotation.x = -0.3; plate.add(t); }
  const hPhone = makePhone(['', '']); hPhone.position.set(5.95, HD_TOP, -3.55); hPhone.rotation.y = Math.PI; scene.add(hPhone);
  { const files = makeBox(0.3, 0.06, 0.24, plain('#1f3b5a', 0.6)); files.position.set(5.15, HD_TOP + 0.03, -3.55); files.rotation.y = 0.2; scene.add(files);
    const lbl = paperMesh({ w: 0.2, h: 0.05, lines: 'الميزانية — الربع الثالث', tint: '#fff', px: 200 }); lbl.rotation.x = -Math.PI / 2; lbl.position.set(5.15, HD_TOP + 0.061, -3.55); lbl.rotation.z = 0.2; scene.add(lbl); }
  await world.prop('desk_lamp_arm_01', { pos: [5.05, HD_TOP, -3.95], rot: 0.8, collide: false });
  world.spot(5.1, 1.3, -3.9, 5.5, HD_TOP, -3.6, { color: '#ffc985', intensity: 5, angle: 0.9, penumbra: 0.7, distance: 3.5, shadow: false });
  // cabinet + photo of the Fajr opening
  await world.prop('drawer_cabinet', { pos: [4.5, 0, -5.68], rot: 0, scale: 0.85 });
  const opening = new THREE.Group(); opening.position.set(7.15, 1.6, -5.92); scene.add(opening);
  { const fr = makeBox(0.5, 0.36, 0.02, plain('#b8913a', 0.3, 0.8)); opening.add(fr);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTexture(440, 300, (c, w, h) => {
      c.fillStyle = '#d9d2c2'; c.fillRect(0, 0, w, h); c.fillStyle = '#1d5d3a'; c.fillRect(0, 30, w, 50); rtl(c, 'bold 30px Cairo', '#fff', 'center'); c.fillText('افتتاح مؤسسة الفجر للتوريدات', w / 2, 56);
      const man = (x, col) => { c.fillStyle = col; c.fillRect(x - 28, 150, 56, 150); c.fillStyle = '#c99e7c'; c.beginPath(); c.arc(x, 128, 24, 0, 7); c.fill(); };
      man(150, '#2f2f35'); man(290, '#3c3c44');
      c.strokeStyle = '#c0392b'; c.lineWidth = 6; c.beginPath(); c.moveTo(60, 210); c.lineTo(380, 210); c.stroke();
    }) }));
    img.position.z = 0.012; opening.add(img); }
  world.interactable(opening, { id: 'f_fajr_photo', label: 'صورة على الجدار', action: () => 'صورة مؤطرة بإطار مذهّب: هشام يقص شريط افتتاح «مؤسسة الفجر للتوريدات» بجانب رجل يشبهه قليلًا. على الإطار بطاقة صغيرة: «مع أيمن — يوم الافتتاح».', note: 'في مكتب هشام صورة له وهو يفتتح مؤسسة الفجر مع رجل اسمه أيمن.' });
  // coat stand with Hisham's dusty jacket
  const stand = new THREE.Group(); stand.position.set(7.55, 0, -0.5); scene.add(stand);
  { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.8, 12), plain('#2b1d14', 0.5)); pole.position.y = 0.9; stand.add(pole);
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.95, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#2d3442', roughness: 0.95, side: THREE.DoubleSide })); coat.position.set(0, 1.25, 0.05); stand.add(coat);
    const dust = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.25), new THREE.MeshStandardMaterial({ color: '#a19a8e', transparent: true, opacity: 0.55, roughness: 1 })); dust.position.set(-0.12, 1.15, 0.13); dust.rotation.y = -0.6; stand.add(dust); }
  world.physics.addCircle(7.55, -0.5, 0.22);
  world.interactable(stand, { id: 'f_hisham_coat', label: 'سترة هشام على المشجب', action: () => 'سترة كحلية فاخرة. على كمها الأيمن غبار رمادي ناعم لم يُنفض كله، كغبار الأماكن المغلقة منذ زمن. مكتب كهذا لا غبار فيه.', note: 'على كم سترة هشام غبار رمادي ناعم، كغبار مخزن مهجور.' });
  await world.prop('potted_plant_01', { pos: [4.0, 0, -0.5], rot: 0.7, scale: 0.9 });

  // ================= MEETING ROOM =================
  panel(5.75, 2.0, 1.2, 0.6);
  world.point(5.75, 2.5, 2.0, { color: '#fff1dc', intensity: 3.5, distance: 6 });
  const mtTable = new THREE.Group(); mtTable.position.set(5.9, 0, 2.0); scene.add(mtTable);
  { const top = makeBox(2.4, 0.05, 1.1, plain('#e8e4da', 0.35)); top.position.y = 0.75; mtTable.add(top);
    for (const sx of [-1, 1]) { const leg = makeBox(0.08, 0.72, 0.9, plain('#2b2b2b', 0.4, 0.6)); leg.position.set(sx * 0.95, 0.36, 0); mtTable.add(leg); } }
  world.physics.addBox(5.9, 2.0, 1.2, 0.55, 0, 0, 0.78);
  for (const [x, z, r] of [[5.3, 1.2, 0], [6.5, 1.2, 0.1], [5.3, 2.8, Math.PI], [6.5, 2.8, Math.PI - 0.1]]) await world.prop('dining_chair_02', { pos: [x, 0, z], rot: r });
  { const cups = makeBox(0.08, 0.1, 0.08, plain('#f2f2f2', 0.3)); cups.position.set(6.4, 0.825, 1.85); scene.add(cups); }
  const wb = new THREE.Group(); wb.position.set(5.9, 1.45, 3.92); wb.rotation.y = Math.PI; scene.add(wb);
  { const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.02), [plain('#aaa'), plain('#aaa'), plain('#aaa'), plain('#aaa'), new THREE.MeshStandardMaterial({ roughness: 0.25, map: canvasTexture(800, 450, (c, w, h) => {
      c.fillStyle = '#f7f7f5'; c.fillRect(0, 0, w, h);
      rtl(c, 'bold 40px "Aref Ruqaa", Cairo', '#1c3f8a'); c.fillText('الثلاثاء 2:30 — شركة السلام (أ. فريد)', w - 40, 70);
      rtl(c, '34px "Aref Ruqaa", Cairo', '#1c3f8a'); c.fillText('مراجعة حسابات الربع الثالث — طارق', w - 40, 140);
      rtl(c, '34px "Aref Ruqaa", Cairo', '#b03030'); c.fillText('ـ فرق 4,200 في كشف سبتمبر', w - 40, 220); c.fillText('ـ يُرسل التقرير الخميس', w - 40, 280);
    }) }), plain('#aaa')]); wb.add(board); }
  world.interactable(wb, { id: 'f_whiteboard', label: 'السبورة البيضاء', action: () => 'على السبورة بخط طارق: «الثلاثاء 2:30 — شركة السلام (أ. فريد) — مراجعة حسابات الربع الثالث». وتحتها ملاحظات أرقام لم تُمسح بعد.', note: 'سبورة غرفة الاجتماعات تؤكد اجتماع طارق مع شركة السلام الساعة 2:30.' });

  // ================= KITCHEN =================
  panel(-5.75, 2.0, 1.2, 0.6);
  world.point(-5.75, 2.5, 2.0, { color: '#eef4ff', intensity: 4, distance: 6 });
  const svc = elev(-7.92, 2.1, Math.PI / 2, 'مصعد الخدمة', 'B2');
  world.interactable(svc, { id: 'f_elev_service', label: 'مصعد الخدمة', action: () => 'مصعد الخدمة. ينزل حتى الجراج B1 ومخازن البدروم B2. المؤشر فوق الباب ما زال يقول B2: آخر من استعمله نزل إلى هناك. ولا أحد في الاستقبال يرى هذا الباب.', note: 'مصعد الخدمة بجوار المطبخ ينزل حتى البدروم B2، ولا يُرى من الاستقبال. آخر رحلة له كانت إلى B2.' });
  const kitchenTop = await T('marble_01', { size: 1.2, roughness: 0.35 });
  const kRun = makeBox(2.9, 0.88, 0.6, kitchenWood); kRun.position.set(-5.75, 0.44, 3.68); scene.add(kRun);
  const kTop = makeBox(2.94, 0.04, 0.64, kitchenTop); kTop.position.set(-5.75, 0.9, 3.66); scene.add(kTop);
  world.physics.addBox(-5.75, 3.68, 1.45, 0.3, 0, 0, 0.92);
  const upper = makeBox(2.9, 0.6, 0.35, kitchenWood); upper.position.set(-5.75, 1.95, 3.8); scene.add(upper);
  const splash = makeBox(2.9, 0.72, 0.02, splashTiles); splash.position.set(-5.75, 1.28, 3.92); scene.add(splash);
  { const sink = makeBox(0.5, 0.02, 0.4, plain('#b9bcbd', 0.2, 1)); sink.position.set(-6.4, 0.925, 3.66); scene.add(sink);
    const fau = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 16, Math.PI), plain('#ccc', 0.15, 1)); fau.position.set(-6.4, 1.0, 3.88); scene.add(fau); }
  await world.prop('vintage_electric_kettle', { pos: [-5.2, 0.92, 3.68], rot: Math.PI, collide: false, scale: 0.85 });
  // copper coffee pot + cardamom jar
  { const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.1, 20), plain('#b5652f', 0.3, 1)); pot.position.set(-4.75, 0.97, 3.6); scene.add(pot);
    const hd = makeBox(0.16, 0.012, 0.015, plain('#2b1d14', 0.5)); hd.position.set(-4.63, 1.0, 3.6); scene.add(hd); }
  const jar = new THREE.Group(); jar.position.set(-4.5, 0.92, 3.72); scene.add(jar);
  { const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 20), new THREE.MeshPhysicalMaterial({ color: '#d8e6c8', transparent: true, opacity: 0.5, roughness: 0.05 })); glass.position.y = 0.065; jar.add(glass);
    const seeds = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.09, 20), plain('#7d9a4a', 0.9)); seeds.position.y = 0.046; jar.add(seeds);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 20), plain('#c0392b', 0.5)); lid.position.y = 0.14; jar.add(lid);
    const lbl = paperMesh({ w: 0.08, h: 0.04, lines: 'قهوة أ. هشام', hand: true, tint: '#fff', px: 120 }); lbl.position.set(0, 0.07, -0.051); lbl.rotation.y = Math.PI; jar.add(lbl); }
  world.interactable(jar, { id: 'f_cardamom', label: 'برطمان هيل', action: () => 'برطمان هيل مطحون، عليه ورقة بخط عم صابر: «قهوة أ. هشام فقط». لا أحد غيره في الشركة يشرب القهوة بالهيل.', note: 'قهوة هشام وحده تُعدّ بالهيل.' });
  { const mugs = [[-5.0, '#c0392b'], [-5.15, '#2e86c1'], [-6.0, '#f1f1f1']]; for (const [x, c] of mugs) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.032, 0.09, 16), plain(c, 0.3)); m.position.set(x, 0.965, 3.55); scene.add(m); } }
  const fridge = world.rounded(0.7, 1.8, 0.66, 0.04, new THREE.MeshPhysicalMaterial({ color: '#e9e7e1', roughness: 0.25, clearcoat: 0.6 }));
  fridge.position.set(-3.95, 0.9, 3.6); scene.add(fridge);
  world.physics.addBox(-3.95, 3.6, 0.36, 0.34, 0, 0, 1.8);
  await world.prop('round_wooden_table_01', { pos: [-5.6, 0, 1.05], rot: 0, fit: { h: 0.74 } });
  await world.prop('dining_chair_02', { pos: [-6.35, 0, 1.0], rot: Math.PI / 2 });
  await world.prop('dining_chair_02', { pos: [-4.85, 0, 1.0], rot: -Math.PI / 2 });

  // ================= ambient =================
  const hemi = new THREE.HemisphereLight('#c8d4e6', '#3a3430', 0.35); scene.add(hemi);
  scene.fog = new THREE.FogExp2('#0b0c10', 0.01);
  ctx.humSources.push(() => new THREE.Vector3(-2.6, 2.85, -5));

  // portrait for the missing man in the case file / board
  { const c = document.createElement('canvas'); c.width = 240; c.height = 288; samiPortrait(c.getContext('2d'), 240, 288); ctx.portraits = { sami: c.toDataURL('image/jpeg', 0.85) }; }

  ctx.surfaceAt = (x, z) => world.surfaceAt(x, z);
  return ctx;
}

// Restores level state from the save (drawer already opened).
export function restore(g, ctx) {
  if (g.has('ev_hisham_drawer')) ctx.flags.hdOpen = true;
}
