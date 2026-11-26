import * as THREE from 'three';
import { Assets } from '../../engine/assets.js';
import { makeBox, plain, paperMesh, canvasTexture, persianRugTexture, worldUV, drawText, paperBG } from '../../engine/world.js';
import { audio } from '../../core/audio.js';

// Layout (metres, top view, north = -Z):
//   Apartment 12: x -6..6, z -10..0     Landing: x -3..3, z 0..4
//   Kitchen  x -6..-1.5  z -4..0   | Hall x -1.5..1.5 z -4..0 | Study x 1.5..6 z -4..0
//   Bedroom  x -6..-1.5  z -10..-4 | Living room x -1.5..6 z -10..-4

export const NPCS = [
  { id: 'salim', name: 'الرقيب سليم', gender: 'm', height: 1.81, position: [1.05, 0, 1.35], rotation: -0.4, mood: 'calm',
    texturePatch: { body: patchPoliceUniform } },
  { id: 'karim', name: 'كريم', gender: 'm', height: 1.76, position: [-0.95, 0, 2.5], rotation: 0.9, mood: 'friendly' },
  { id: 'hassan', name: 'الأستاذ حسن', gender: 'm', height: 1.70, position: [4.0, 0, -7.25], rotation: -Math.PI / 2, mood: 'sad', seated: true },
  { id: 'nader', name: 'نادر', gender: 'm', height: 1.83, position: [0.3, 0, -8.6], rotation: Math.PI, mood: 'nervous',
    patrol: [[0.3, -8.7, Math.PI], [0.6, -5.6, 0.6], [-0.2, -7.4, Math.PI * 0.8]] },
  { id: 'mona', name: 'منى', gender: 'f', height: 1.63, position: [-3.0, 0, -3.05], rotation: 0.5, mood: 'nervous' },
];

export const PLAYER_START = { x: 0.2, z: 3.45, yaw: 0 };

// Paints the fictional «شرطة» sleeve patches onto the sergeant's uniform texture.
function patchPoliceUniform(ctx, w, h) {
  const s = w / 2048;
  const cover = (x, y, ww, hh, sx, sy) => ctx.drawImage(ctx.canvas, sx * s, sy * s, ww * s, hh * s, x * s, y * s, ww * s, hh * s);
  cover(222, 1012, 156, 116, 222, 1190);   // flag -> plain sleeve fabric
  cover(1664, 982, 160, 162, 1664, 1180);  // emblem -> plain sleeve fabric
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

export async function buildLevel(world, ctx) {
  const { scene } = world;
  const T = (id, o) => Assets.pbr(id, o);
  const [parquet, worn, marble, tiles, wallWarm, wallBeige, wallPlaster, concrete, carpet, kitchenWood] = await Promise.all([
    T('herringbone_parquet', { size: 1.6, roughness: 0.9 }),
    T('wood_floor_worn', { size: 2.2 }),
    T('marble_01', { size: 1.4, roughness: 0.6 }),
    T('floor_tiles_06', { size: 1.2, roughness: 0.7 }),
    T('beige_wall_001', { size: 2.5, color: '#d9cdb8', normalScale: 0.6 }),
    T('beige_wall_002', { size: 2.5, color: '#c7c2a8', normalScale: 0.6 }),
    T('painted_plaster_wall', { size: 2.5, color: '#9fae9a', normalScale: 0.6 }),
    T('concrete_wall_008', { size: 3, color: '#8a8780' }),
    T('dirty_carpet', { size: 1.5 }),
    T('kitchen_wood', { size: 1.2, roughness: 0.8 }),
  ]);
  const ceilingMat = plain('#e8e4dc', 0.95);
  const stairWall = await T('beige_wall_002', { size: 2.5, color: '#8f9a86', normalScale: 0.6 });
  const roseWall = await T('painted_plaster_wall', { size: 2.5, color: '#c9b3a6', normalScale: 0.5 });
  const studyWall = await T('painted_plaster_wall', { size: 2.5, color: '#8c9886', normalScale: 0.6 });
  const exterior = concrete;

  // ---------------- floors & ceilings ----------------
  world.floor(-3, 0, 1.85, 4, marble, { ceiling: ceilingMat, surface: 'tile' });
  world.floor(1.85, 0, 3, 0.6, marble, { ceiling: ceilingMat, surface: 'tile' });
  { const c = makeBox(1.15, 0.1, 3.4, ceilingMat); c.position.set(2.42, 2.95, 2.3); scene.add(c); }
  world.floor(-1.5, -4, 1.5, 0, parquet, { ceiling: ceilingMat });
  world.floor(-1.5, -10, 6, -4, parquet, { ceiling: ceilingMat });
  world.floor(1.5, -4, 6, 0, worn, { ceiling: ceilingMat });
  world.floor(-6, -4, -1.5, 0, tiles, { ceiling: ceilingMat, surface: 'tile' });
  world.floor(-6, -10, -1.5, -4, parquet, { ceiling: ceilingMat });

  // ---------------- walls ----------------
  const wallX = (z, x0, x1, north, south, ops = []) => world.wall(x0, z, x1, z, north, south, ops);
  const wallZ = (x, z0, z1, east, west, ops = []) => world.wall(x, z0, x, z1, east, west, ops);
  const DOOR = 0.92, DOORH = 2.1;
  // apartment south wall (landing side)
  wallX(0, -6, -3, wallBeige, exterior);
  wallX(0, -3, -1.5, wallBeige, stairWall);
  wallX(0, -1.5, 1.5, wallWarm, stairWall, [{ at: 1.5 - DOOR / 2, w: DOOR, h: DOORH }]);
  wallX(0, 1.5, 3, studyWall, stairWall);
  wallX(0, 3, 6, studyWall, exterior);
  // north exterior wall with windows
  wallX(-10, -6, -1.5, exterior, roseWall, [{ at: 1.65, w: 1.2, h: 1.45, sill: 0.85 }]);
  wallX(-10, -1.5, 6, exterior, wallWarm, [{ at: 1.4, w: 1.2, h: 1.6, sill: 0.75 }, { at: 4.9, w: 1.2, h: 1.6, sill: 0.75 }]);
  // west exterior wall
  wallZ(-6, -10, -4, roseWall, exterior);
  wallZ(-6, -4, 0, wallBeige, exterior);
  // east exterior wall
  wallZ(6, -10, -4, exterior, wallWarm);
  wallZ(6, -4, 0, exterior, studyWall, [{ at: 1.6, w: 1.0, h: 1.3, sill: 0.95 }]);
  // interior
  wallZ(-1.5, -4, 0, wallWarm, wallBeige, [{ at: 1.35, w: DOOR, h: DOORH }]);          // hall | kitchen
  wallZ(1.5, -4, 0, studyWall, wallWarm, [{ at: 0.95, w: DOOR, h: DOORH }]);           // study | hall
  wallX(-4, -6, -1.5, roseWall, wallBeige);                                            // bedroom | kitchen
  wallX(-4, -1.5, 1.5, wallWarm, wallWarm, [{ at: 0.7, w: 1.6, h: 2.35 }]);            // living | hall archway
  wallX(-4, 1.5, 6, wallWarm, studyWall);                                              // living | study
  wallZ(-1.5, -10, -4, wallWarm, roseWall, [{ at: 2.55, w: DOOR, h: DOORH }]);         // living | bedroom
  // landing walls
  wallZ(-3, 0, 4, stairWall, exterior, [{ at: 1.75, w: DOOR, h: DOORH }]);
  wallZ(3, 0, 4, exterior, stairWall);
  wallX(4, -3, 3, stairWall, exterior);

  // archway trim
  const archTrim = plain('#efebe3', 0.55);
  for (const x of [-0.82, 0.82]) { const j = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.38, 0.2), archTrim); j.position.set(x, 1.19, -4); scene.add(j); }
  { const t = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.07, 0.2), archTrim); t.position.set(0, 2.38, -4); scene.add(t); }

  // ---------------- doors ----------------
  const doorWood = await T('kitchen_wood', { size: 1.5, color: '#7a5636', roughness: 0.7 });
  const paintedDoor = plain('#e6e0d4', 0.5);
  const entrance = world.door({ x: -DOOR / 2, z: 0, rot: 0, w: DOOR, swing: 1.75, mat: doorWood, label: 'باب الشقة 12', number: '12' });
  entrance.setOpenInstant(true);
  ctx.entranceDoor = entrance;
  world.door({ x: -3, z: 1.75 + DOOR, rot: Math.PI / 2, w: DOOR, mat: doorWood, label: 'باب الشقة 11', number: '11', locked: true, lockedMsg: 'شقة 11 مقفلة. الرقيب سليم قال إن الجيران مسافرون منذ أسبوع.' });
  world.door({ x: -1.5, z: -4 + 1.35, rot: -Math.PI / 2, w: DOOR, swing: -1.6, mat: paintedDoor, label: 'باب المطبخ' });
  world.door({ x: 1.5, z: -4 + 0.95 + DOOR, rot: Math.PI / 2, w: DOOR, swing: -1.6, mat: paintedDoor, label: 'باب المكتب' });
  world.door({ x: -1.5, z: -10 + 2.55 + DOOR, rot: Math.PI / 2, w: DOOR, swing: 1.6, mat: paintedDoor, label: 'باب غرفة النوم' });

  // ---------------- windows ----------------
  const winLiving1 = world.window({ x: 0.5, z: -10, rot: Math.PI, w: 1.2, h: 1.6, sill: 0.75 });
  const winLiving2 = world.window({ x: 4.0, z: -10, rot: Math.PI, w: 1.2, h: 1.6, sill: 0.75 });
  world.window({ x: -3.75, z: -10, rot: Math.PI, w: 1.2, h: 1.45, sill: 0.85 });
  world.window({ x: 6, z: -1.9, rot: Math.PI / 2, w: 1.0, h: 1.3, sill: 0.95 });
  // curtains
  const curtainMat = new THREE.MeshStandardMaterial({ color: '#5a2e2a', roughness: 0.95, side: THREE.DoubleSide });
  for (const cx of [0.5, 4.0]) for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(0.45, 2.3, 12, 1);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 40) * 0.035);
    g.computeVertexNormals();
    const c = new THREE.Mesh(g, curtainMat); c.position.set(cx + s * 0.78, 1.55, -9.85); c.castShadow = true; scene.add(c);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 5.2, 8), plain('#8b6b3f', 0.3, 1)); rod.rotation.z = Math.PI / 2; rod.position.set(2.25, 2.72, -9.85); scene.add(rod);

  // ================= LANDING =================
  // stairwell down (east side), blocked by police tape
  const stepMat = marble;
  for (let i = 0; i < 9; i++) {
    const s = makeBox(1.15, 0.17, 0.3, stepMat); s.position.set(2.42, -0.09 - i * 0.17, 0.75 + i * 0.3); scene.add(s);
  }
  const pit = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.8, 2.9), new THREE.MeshStandardMaterial({ color: '#050505', roughness: 1, side: THREE.BackSide }));
  pit.position.set(2.42, -0.9, 2.05); scene.add(pit);
  // re-floor: the landing floor was full width; overlay a dark opening by hiding part with steps on top
  const railMat = plain('#3a2a1e', 0.5, 0.2);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 3.0), railMat); rail.position.set(1.82, 0.95, 2.1); rail.castShadow = true; scene.add(rail);
  for (let i = 0; i < 11; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.95, 0.025), plain('#2b2b2b', 0.4, 0.8)); b.position.set(1.82, 0.47, 0.65 + i * 0.29); scene.add(b); }
  world.physics.addBox(1.82, 2.1, 0.05, 1.5, 0, 0, 1, 'rail');
  world.physics.addBox(2.4, 0.55, 0.6, 0.05, 0, 0, 1, 'tape');
  // police tape
  const tapeTex = canvasTexture(512, 32, (c, w, h) => { c.fillStyle = '#f2c81f'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = 'bold 20px Cairo'; c.direction = 'rtl'; c.textBaseline = 'middle'; for (let x = 0; x < w; x += 170) c.fillText('ممنوع الاقتراب — الشرطة', x + 160, h / 2); });
  tapeTex.wrapS = THREE.RepeatWrapping; tapeTex.repeat.x = 1.5;
  const tape = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.07), new THREE.MeshStandardMaterial({ map: tapeTex, side: THREE.DoubleSide, roughness: 0.6 }));
  tape.position.set(2.42, 0.9, 0.58); tape.rotation.z = 0.05; tape.material.side = THREE.FrontSide; scene.add(tape);
  const tape2 = tape.clone(); tape2.position.y = 0.55; tape2.rotation.z = -0.07; scene.add(tape2);
  world.interactable(tape, { id: 'f_tape', label: 'شريط الشرطة', action: () => 'الدرج مغلق بشريط الشرطة. لا أحد يصعد أو ينزل حتى ننتهي.' });

  // notice board on west landing wall
  const board = new THREE.Group(); board.position.set(-2.92, 1.5, 3.25); board.rotation.y = Math.PI / 2; scene.add(board);
  const cork = canvasTexture(512, 384, (c, w, h) => { c.fillStyle = '#9a6a3c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${60 + Math.random() * 80},${40 + Math.random() * 40},20,0.5)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.75, 0.03), [plain('#4a3220'), plain('#4a3220'), plain('#4a3220'), plain('#4a3220'), new THREE.MeshStandardMaterial({ map: cork, roughness: 1 }), plain('#4a3220')]);
  board.add(boardMesh);
  const flyers = [
    { x: 0.22, y: 0.08, r: -0.05, title: 'إعلان — مفقودات', body: 'فُقد خاتم زمرد أخضر محفور في داخله «ل.م 1998».\nمكافأة مجزية.\nليلى منصور — شقة 7', ev: true },
    { x: -0.25, y: 0.15, r: 0.04, title: 'اجتماع السكان', body: 'يوم السبت بعد العصر في مدخل العمارة لمناقشة صيانة المصعد.' },
    { x: -0.24, y: -0.18, r: -0.03, title: 'تنبيه', body: 'يُمنع ترك أكياس القمامة على الدرج.\nالإدارة' },
    { x: 0.27, y: -0.24, r: 0.06, title: '', body: 'الحارس متاح من 7 صباحًا حتى 11 مساءً.\nللطوارئ: الغرفة أسفل الدرج.' },
  ];
  let ringFlyer;
  for (const f of flyers) {
    const p = paperMesh({ w: f.ev ? 0.28 : 0.22, h: f.ev ? 0.36 : 0.26, title: f.title, lines: f.body, tint: f.ev ? '#f3efe2' : '#e9e2cc', px: 400, fontScale: 1.2 });
    p.position.set(f.x, f.y, 0.02); p.rotation.z = f.r; board.add(p);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), plain('#b11', 0.4)); pin.position.set(f.x, f.y + (f.ev ? 0.16 : 0.11), 0.03); board.add(pin);
    if (f.ev) ringFlyer = p;
  }
  world.interactable(ringFlyer, { id: 'ev_notice', evidence: 'ev_notice', label: 'إعلان على اللوحة' });
  world.interactable(boardMesh, { id: 'f_board', label: 'لوحة إعلانات العمارة', action: () => 'لوحة إعلانات العمارة. إعلانات قديمة عن الصيانة والقمامة... وإعلان واحد مختلف.' });

  // electrical cabinet (south wall) — hinged door reveals the hidden watch
  // local +z points into the landing (north); the box is hollow so the opened door shows its contents
  const cab = new THREE.Group(); cab.position.set(-2.0, 1.25, 3.93); cab.rotation.y = Math.PI; scene.add(cab);
  const metal = plain('#7d827c', 0.45, 0.6);
  const CW = 0.62, CH = 0.82, CD = 0.18;
  const innerBack = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, 0.01), plain('#2a2c2a', 0.8)); innerBack.position.z = 0.005; cab.add(innerBack);
  for (const [w, h, x, y] of [[0.01, CH, -CW / 2, 0], [0.01, CH, CW / 2, 0], [CW, 0.01, 0, CH / 2], [CW, 0.01, 0, -CH / 2]]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, CD), metal); s.position.set(x, y, CD / 2); s.castShadow = true; cab.add(s);
  }
  for (let i = 0; i < 3; i++) { const meter = makeBox(0.13, 0.2, 0.08, plain('#d8d8d0', 0.4)); meter.position.set(-0.18 + i * 0.18, 0.18, 0.05); cab.add(meter); const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), plain('#111', 0.3)); dial.position.set(-0.18 + i * 0.18, 0.22, 0.092); cab.add(dial); }
  const breakers = makeBox(0.45, 0.08, 0.06, plain('#222', 0.6)); breakers.position.set(0, -0.08, 0.04); cab.add(breakers);
  const rag = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 1), plain('#6b6b66', 1)); rag.scale.set(1.3, 0.6, 0.9); rag.position.set(0.12, -0.3, 0.07); cab.add(rag);
  const cabDoorPivot = new THREE.Group(); cabDoorPivot.position.set(-CW / 2, 0, CD + 0.01); cab.add(cabDoorPivot);
  const cabDoor = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, 0.02), metal); cabDoor.position.set(CW / 2, 0, 0); cabDoor.castShadow = true; cabDoorPivot.add(cabDoor);
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.12), new THREE.MeshStandardMaterial({ map: canvasTexture(128, 110, (c, w, h) => { c.fillStyle = '#f2c81f'; c.beginPath(); c.moveTo(w / 2, 5); c.lineTo(w - 5, h - 5); c.lineTo(5, h - 5); c.closePath(); c.fill(); c.fillStyle = '#111'; c.font = 'bold 50px Cairo'; c.textAlign = 'center'; c.fillText('!', w / 2, h - 22); }), transparent: true }));
  warn.position.set(CW / 2, 0.2, 0.012); cabDoorPivot.add(warn);
  world.updaters.push(dt => { cabDoorPivot.rotation.y += ((ctx.flags.cabOpen ? -1.9 : 0) - cabDoorPivot.rotation.y) * Math.min(1, dt * 4); });
  world.interactable(cabDoor, { id: 'ev_cabinet', label: () => ctx.flags.cabOpen ? 'تفحّص ما خلف العدادات' : 'افتح خزانة الكهرباء', evidence: 'ev_cabinet',
    before: () => { if (!ctx.flags.cabOpen) { ctx.flags.cabOpen = true; audio.door(true); return 'delay'; } } });
  world.interactable(rag, { id: 'ev_cabinet_rag', label: 'شيء ملفوف بقماشة', evidence: 'ev_cabinet' });
  const cabCollider = world.physics.addBox(-2.0, 3.85, 0.31, 0.1, 0, 0.8, 1.7);

  // Karim's toolbox, boots, broom, trash, wet sign
  const toolbox = await world.prop('metal_toolbox', { pos: [-2.25, 0, 3.35], rot: 0.4 });
  world.interactable(toolbox, { id: 'ev_toolbox', evidence: 'ev_toolbox', label: 'صندوق عدة كريم',
    blocked: g => !g.flag('toolbox_allowed') ? 'صندوق عدة كريم. من الأفضل أن تستأذن صاحبه قبل أن تفتحه.' : null });
  const boots = await world.prop('rubber_boots', { pos: [2.3, 0, 0.25], rot: 0.15, fit: { w: 0.62 }, collide: false });
  if (boots) {
    // the model holds a clean and a dirty pair side by side: keep only the dirty (wet) pair, centred
    const keep = [];
    boots.traverse(o => { if (o.isMesh) { if (/dirt/.test(o.name)) keep.push(o); else o.visible = false; } });
    const inner = boots.children[0]; const bb = new THREE.Box3(); keep.forEach(k => bb.expandByObject(k));
    const c = bb.getCenter(new THREE.Vector3()); boots.worldToLocal(c); inner.position.x -= c.x; inner.position.z -= c.z;
    boots.position.set(-0.55, 0, 3.72); boots.rotation.y = 0.25;
    world.interactable(boots, { id: 'ev_boots', evidence: 'ev_boots', label: 'حذاء مطاطي مبلل' });
  }
  const wetPuddle = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35 }));
  wetPuddle.rotation.x = -Math.PI / 2; wetPuddle.position.set(-0.55, 0.003, 3.72); scene.add(wetPuddle);
  await world.prop('plastic_broom', { pos: [-2.75, 0, 0.9], rot: Math.PI / 2, collide: false });
  // Arabic wet-floor A-frame sign
  const signTex = canvasTexture(256, 400, (c, w, h) => {
    c.fillStyle = '#f2c81f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#111'; c.fillRect(0, 0, w, 14); c.fillRect(0, h - 14, w, 14);
    c.direction = 'rtl'; c.textAlign = 'center'; c.font = 'bold 52px Cairo'; c.fillText('احذر!', w / 2, 82);
    c.beginPath(); c.moveTo(w / 2, 115); c.lineTo(w / 2 + 70, 235); c.lineTo(w / 2 - 70, 235); c.closePath(); c.lineWidth = 10; c.stroke();
    c.font = 'bold 70px Cairo'; c.fillText('!', w / 2, 225);
    c.font = 'bold 40px Cairo'; c.fillText('أرضية', w / 2, 300); c.fillText('مبللة', w / 2, 350);
  });
  const sign = new THREE.Group(); sign.position.set(1.45, 0, 0.75); sign.rotation.y = -0.6; scene.add(sign);
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.45 });
  const plasticY = plain('#e8bd1a', 0.45);
  for (const s of [1, -1]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.012), [plasticY, plasticY, plasticY, plasticY, s > 0 ? signMat : plasticY, s > 0 ? plasticY : signMat]);
    board.position.set(0, 0.3, s * 0.09); board.rotation.x = -s * 0.28; board.castShadow = true; sign.add(board);
  }
  world.physics.addCircle(1.45, 0.75, 0.2);
  world.interactable(sign, { id: 'f_sign', label: 'لافتة «أرضية مبللة»', action: () => 'لافتة «احذر، أرضية مبللة». وضعها كريم عند أعلى الدرج بعد أن غسل المدخل.' });
  // trash bin (procedural metal can with burnt paper)
  const bin = new THREE.Group(); bin.position.set(-2.6, 0, 0.45); scene.add(bin);
  const binMat = plain('#545a5c', 0.5, 0.8);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.5, 24, 1, true), binMat); can.position.y = 0.25; can.castShadow = true; bin.add(can);
  const canIn = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.145, 0.49, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#202020', side: THREE.BackSide })); canIn.position.y = 0.25; bin.add(canIn);
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), plain('#1a1714', 1)); ash.rotation.x = -Math.PI / 2; ash.position.y = 0.33; bin.add(ash);
  for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + Math.random() * 0.05, 0.04 + Math.random() * 0.04), plain(i % 3 ? '#2a2420' : '#d8cfb8', 1)); p.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.6, 0, Math.random() * 3); p.position.set((Math.random() - 0.5) * 0.18, 0.335 + Math.random() * 0.02, (Math.random() - 0.5) * 0.18); bin.add(p); }
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.06), plain('#0d0d0d', 0.6)); cover.rotation.x = -Math.PI / 2; cover.rotation.z = 0.4; cover.position.set(0.03, 0.345, 0); bin.add(cover);
  world.physics.addCircle(-2.6, 0.45, 0.18);
  world.interactable(bin, { id: 'ev_trash', evidence: 'ev_trash', label: 'سلة المهملات' });
  // landing lights: wall sconce + flickering bulb
  const sconce = await world.prop('industrial_wall_sconce', { pos: [0, 1.95, 3.93], rot: Math.PI, collide: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffe2b0', emissiveIntensity: 3 }));
  bulb.position.set(0, 2.72, 1.8); scene.add(bulb);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16), plain('#111')); cord.position.set(0, 2.82, 1.8); scene.add(cord);
  const landingSpot = world.spot(0, 2.68, 1.8, 0, 0, 1.8, { color: '#ffe1b8', intensity: 9, angle: 1.25, penumbra: 0.9, distance: 9 });
  const landingFill = world.point(0, 2.05, 3.55, { color: '#ffc994', intensity: 4.5, distance: 7 });
  let flickT = 0;
  world.updaters.push(dt => {
    flickT -= dt;
    if (flickT < 0) {
      const off = Math.random() < 0.12;
      landingSpot.intensity = off ? 1.5 : 8 + Math.random() * 2;
      bulb.material.emissiveIntensity = off ? 0.3 : 3;
      flickT = off ? 0.05 + Math.random() * 0.12 : 0.3 + Math.random() * 3;
    }
  });
  ctx.humSources.push(() => new THREE.Vector3(0, 2.7, 1.8));

  // ================= HALL =================
  const hallLight = world.point(0, 2.5, -2, { color: '#ffd2a0', intensity: 3.2, distance: 6 });
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f5ecd8', emissive: '#ffd9a0', emissiveIntensity: 1.2, side: THREE.DoubleSide }));
  pendant.rotation.x = Math.PI; pendant.position.set(0, 2.7, -2); scene.add(pendant);
  await world.prop('hanging_picture_frame_02', { pos: [-1.41, 1.65, -1.0], rot: Math.PI / 2, collide: false });
  await world.prop('potted_plant_02', { pos: [1.1, 0, -0.55], rot: 0, scale: 0.8 });
  // coat rack
  const rack = new THREE.Group(); rack.position.set(-1.15, 0, -0.45); scene.add(rack);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.8, 12), plain('#3b2a1c', 0.5)); pole.position.y = 0.9; pole.castShadow = true; rack.add(pole);
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.9, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#3e3a33', roughness: 1, side: THREE.DoubleSide })); coat.position.set(0.05, 1.25, 0); coat.castShadow = true; rack.add(coat);
  world.physics.addCircle(-1.15, -0.45, 0.2);
  world.interactable(coat, { id: 'f_coat', label: 'معطف الأستاذ حسن', action: () => 'معطف صوفي ما زال رطبًا من المطر. في جيبه تذكرة من مقهى النجمة: «طاولة 4 — 8:52 مساءً». الأستاذ حسن كان في المقهى فعلًا.', note: 'معطف حسن رطب، وفي جيبه فاتورة من مقهى النجمة الساعة 8:52 مساءً.' });

  // ================= LIVING ROOM =================
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshStandardMaterial({ map: persianRugTexture(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2; rug.position.set(2.1, 0.004, -7.8); rug.receiveShadow = true; scene.add(rug);
  world.surfaces.unshift({ x0: 0.4, z0: -9.1, x1: 3.8, z1: -6.5, type: 'carpet' });
  await world.prop('Sofa_01', { pos: [2.1, 0, -9.35], rot: 0, scale: 1.12 });
  await world.prop('throw_pillows_01', { pos: [2.1, 0.42, -9.4], rot: 0, collide: false, scale: 0.9 });
  const coffee = await world.prop('CoffeeTable_01', { pos: [2.1, 0, -7.9], rot: 0, scale: 0.85 });
  const tableTop = coffee ? new THREE.Box3().setFromObject(coffee).max.y : 0.45;
  await world.prop('tea_set_01', { pos: [2.45, tableTop, -7.85], rot: 0.2, collide: false, scale: 0.6 });
  await world.prop('ArmChair_01', { pos: [4.05, 0, -7.25], rot: -Math.PI / 2 });
  await world.prop('side_table_01', { pos: [4.15, 0, -8.35], rot: 0 });
  await world.prop('vintage_grandfather_clock_01', { pos: [5.72, 0, -9.35], rot: -Math.PI / 2 });
  ctx.clockPos = new THREE.Vector3(5.72, 1.6, -9.35);
  const console1 = await world.prop('ClassicConsole_01', { pos: [-1.2, 0, -8.6], rot: Math.PI / 2, scale: 0.8 });
  const mirror = await world.prop('ornate_mirror_01', { pos: [-1.42, 1.75, -8.6], rot: Math.PI / 2, collide: false, scale: 1.2 });
  if (mirror) mirror.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.envMapIntensity = 0.35; } });
  await world.prop('brass_vase_01', { pos: [-1.2, 0.76, -9.05], rot: 0, collide: false, scale: 0.6 });
  await world.prop('potted_plant_02', { pos: [-1.0, 0, -4.6], rot: 0.5 });
  await world.prop('fancy_picture_frame_01', { pos: [5.92, 1.65, -7.3], rot: -Math.PI / 2, collide: false, scale: 1.4 });
  const chand = await world.prop('Chandelier_02', { pos: [2.1, 2.05, -7.6], rot: 0, collide: false });
  // living lights
  const livingSpot = world.spot(2.1, 2.7, -7.6, 2.1, 0, -7.6, { color: '#ffcf96', intensity: 34, angle: 1.25, penumbra: 0.85, distance: 10 });
  // floor lamp next to armchair
  const lamp = new THREE.Group(); lamp.position.set(4.9, 0, -8.6); scene.add(lamp);
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 10), plain('#8b6b3f', 0.3, 1)); lampPole.position.y = 0.75; lamp.add(lampPole);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 24), plain('#8b6b3f', 0.3, 1)); lampBase.position.y = 0.015; lamp.add(lampBase);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#efe0c0', emissive: '#ffcf8a', emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.9 })); shade.position.y = 1.55; lamp.add(shade);
  world.point(4.9, 1.5, -8.6, { color: '#ffbf7a', intensity: 2.2, distance: 4.5 });
  world.physics.addCircle(4.9, -8.6, 0.17);
  // moonlight through living windows
  const moon = world.spot(2.2, 4.5, -14.5, 2.2, 0, -6.5, { color: '#8fa8d6', intensity: 60, angle: 0.55, penumbra: 0.6, distance: 20 });
  ctx.lightningLights.push(moon);

  // Ashtray + cigarette + bank letter on the coffee table
  const ashtray = new THREE.Group(); ashtray.position.set(1.65, tableTop, -7.75); scene.add(ashtray);
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.025, 28), new THREE.MeshPhysicalMaterial({ color: '#c9b98f', roughness: 0.15, metalness: 0.9 })); tray.position.y = 0.0125; tray.castShadow = true; ashtray.add(tray);
  const butt = new THREE.Group(); butt.position.set(0.02, 0.03, 0); butt.rotation.set(0, 0.6, Math.PI / 2 - 0.15); ashtray.add(butt);
  const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.02, 10), plain('#c8a24a', 0.4, 0.4)); filter.position.y = 0.01; butt.add(filter);
  const paperPart = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.015, 10), plain('#eee', 0.8)); paperPart.position.y = -0.007; butt.add(paperPart);
  const ashBit = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), plain('#555', 1)); ashBit.scale.y = 0.3; ashBit.position.set(-0.02, 0.026, 0.02); ashtray.add(ashBit);
  world.interactable(ashtray, { id: 'ev_ashtray', evidence: 'ev_ashtray', label: 'منفضة السجائر' });
  const bank = paperMesh({ w: 0.21, h: 0.297, title: 'بنك الاتحاد التجاري — إنذار نهائي', lines: 'السيد / نادر سمير الشامي\nالمبلغ المتأخر: 40,000\nمستحق خلال خمسة عشر يومًا.', tint: '#f4f2ec', px: 420 });
  bank.rotation.x = -Math.PI / 2; bank.rotation.z = 0.35; bank.position.set(2.0, tableTop + 0.003, -8.05); scene.add(bank);
  world.interactable(bank, { id: 'ev_bank', evidence: 'ev_bank', label: 'ورقة رسمية' });

  // Glass display cabinet (vitrine)
  const vit = new THREE.Group(); vit.position.set(5.68, 0, -5.4); vit.rotation.y = -Math.PI / 2; scene.add(vit);
  const vitWood = await T('kitchen_wood', { size: 1, color: '#5a3a22', roughness: 0.55 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#dfe8ea', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 2.5, depthWrite: false });
  const VW = 1.1, VH = 1.85, VD = 0.42;
  const vb = makeBox(VW, 0.5, VD, vitWood); vb.position.y = 0.25; vit.add(vb);
  const vtop = makeBox(VW + 0.04, 0.05, VD + 0.04, vitWood); vtop.position.y = VH + 0.025; vit.add(vtop);
  for (const sx of [-1, 1]) { const post = makeBox(0.04, VH - 0.5, 0.04, vitWood); post.position.set(sx * (VW / 2 - 0.02), 0.5 + (VH - 0.5) / 2, VD / 2 - 0.02); vit.add(post); const postB = post.clone(); postB.position.z = -VD / 2 + 0.02; vit.add(postB); }
  const back = makeBox(VW, VH - 0.5, 0.02, vitWood); back.position.set(0, 0.5 + (VH - 0.5) / 2, -VD / 2 + 0.01); vit.add(back);
  const velvet = plain('#5b1220', 1);
  for (const sy of [0.95, 1.38]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(VW - 0.06, 0.015, VD - 0.04), glassMat); sh.position.set(0, sy, 0); vit.add(sh); }
  const front = new THREE.Mesh(new THREE.PlaneGeometry(VW - 0.06, VH - 0.52), glassMat); front.position.set(0, 0.5 + (VH - 0.5) / 2, VD / 2 - 0.005); vit.add(front);
  for (const sx of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(VD - 0.04, VH - 0.52), glassMat); side.rotation.y = Math.PI / 2; side.position.set(sx * (VW / 2 - 0.005), 0.5 + (VH - 0.5) / 2, 0); vit.add(side); }
  // contents: empty open watch box (shelf 2), medals, prayer beads
  const box = new THREE.Group(); box.position.set(-0.2, 1.39, 0.02); vit.add(box);
  const boxBase = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.12), plain('#1c2a4a', 0.9)); boxBase.position.y = 0.02; box.add(boxBase);
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.1), velvet); cushion.position.y = 0.04; box.add(cushion);
  const dent = new THREE.Mesh(new THREE.CircleGeometry(0.028, 20), plain('#2b0710', 1)); dent.rotation.x = -Math.PI / 2; dent.position.y = 0.046; box.add(dent);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.12), plain('#1c2a4a', 0.9)); lid.position.set(0, 0.07, -0.06); lid.rotation.x = -1.2; lid.geometry.translate(0, 0, 0.06); box.add(lid);
  const gold = new THREE.MeshPhysicalMaterial({ color: '#d4a63a', roughness: 0.25, metalness: 1 });
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 32), gold); m.rotation.x = Math.PI / 2 - 0.25; m.position.set(0.08 + i * 0.1, 0.995, 0.03); vit.add(m);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), plain('#222', 0.6)); st.position.set(0.08 + i * 0.1, 0.97, 0.01); vit.add(st);
  }
  for (let i = 0; i < 33; i++) { const a = i / 33 * Math.PI * 2; const bead = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), plain('#c8c8c8', 0.2, 1)); bead.position.set(0.25 + Math.cos(a) * 0.06, 1.395, 0.05 + Math.sin(a) * 0.04); vit.add(bead); }
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.16), plain(['#4a2b1b', '#1d3326', '#5a4a2a', '#2a2a3a'][k], 0.8)); b.position.set(-0.4 + k * 0.045, 0.62, 0); vit.add(b); }
  vit.traverse(o => { if (o.isMesh) { o.castShadow = o.material !== glassMat; o.receiveShadow = true; } });
  world.physics.addBox(5.68, -5.4, VD / 2, VW / 2, 0, 0, 2);
  world.interactable(vit, { id: 'ev_vitrine', evidence: 'ev_vitrine', label: 'الخزانة الزجاجية' });
  ctx.inspectModels.ev_vitrine = () => vit.clone(true);

  // window latch evidence
  world.interactable(winLiving2.latch, { id: 'ev_window', evidence: 'ev_window', label: 'مزلاج النافذة' });
  world.interactable(winLiving1.latch, { id: 'ev_window_b', evidence: 'ev_window', label: 'مزلاج النافذة' });

  // ================= STUDY =================
  const studyRug = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), new THREE.MeshStandardMaterial({ map: persianRugTexture(2, ['#3b2a20', '#6a2c1d', '#b89a64', '#24352a']), roughness: 1 }));
  studyRug.rotation.x = -Math.PI / 2; studyRug.position.set(2.95, 0.004, -2.45); scene.add(studyRug);
  world.surfaces.unshift({ x0: 2.0, z0: -3.1, x1: 3.9, z1: -1.8, type: 'carpet' });
  // boot prints on the rug (decal)
  const printTex = canvasTexture(256, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const sole = (cx, cy, s, rot) => {
      c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(s, s);
      c.fillStyle = 'rgba(25,18,12,0.55)';
      c.beginPath(); c.ellipse(0, -60, 38, 62, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(0, 55, 30, 40, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(230,230,220,0.35)'; c.lineWidth = 4;
      for (let y = -110; y < 90; y += 14) { c.beginPath(); for (let x = -36; x <= 36; x += 12) c.lineTo(x, y + ((x / 12) % 2 ? 6 : 0)); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 30; i++) c.fillRect((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 220, 3, 3);
      c.restore();
    };
    sole(90, 360, 0.85, 0.1); sole(170, 140, 0.85, 0.05);
  });
  const prints = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.84), new THREE.MeshStandardMaterial({ map: printTex, transparent: true, roughness: 0.25, metalness: 0.1, depthWrite: false }));
  prints.rotation.x = -Math.PI / 2; prints.rotation.z = -Math.PI / 2 - 0.15; prints.position.set(2.75, 0.008, -2.4); scene.add(prints);
  world.interactable(prints, { id: 'ev_print', evidence: 'ev_print', label: 'أثر على السجادة' });
  ctx.images.ev_print = printTex.userData.canvas;

  // procedural desk with drawers
  const desk = new THREE.Group(); desk.position.set(4.55, 0, -2.3); desk.rotation.y = -Math.PI / 2; scene.add(desk);
  const deskWood = await T('kitchen_wood', { size: 1, color: '#6a4528', roughness: 0.5 });
  const top = makeBox(1.5, 0.05, 0.75, deskWood); top.position.y = 0.76; desk.add(top);
  const pedestals = {};
  for (const sx of [-1, 1]) {
    const ped = makeBox(0.42, 0.72, 0.7, deskWood); ped.position.set(sx * 0.52, 0.37, 0); desk.add(ped);
    for (let i = 0; i < 3; i++) {
      const drw = new THREE.Group(); drw.position.set(sx * 0.52, 0.6 - i * 0.22, 0.351); desk.add(drw);
      const face = makeBox(0.38, 0.19, 0.02, deskWood); drw.add(face);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), plain('#b08d57', 0.3, 1)); knob.position.z = 0.02; drw.add(knob);
      pedestals[sx + ':' + i] = drw;
    }
  }
  // the right drawer (from the sitter's view) is pulled open and empty
  const openDrawer = pedestals['-1:0'];
  openDrawer.position.z += 0.32;
  const drawerBox = new THREE.Group(); drawerBox.position.z = -0.17; openDrawer.add(drawerBox);
  const dBottom = makeBox(0.36, 0.01, 0.34, deskWood); dBottom.position.y = -0.08; drawerBox.add(dBottom);
  for (const [w, d, x, z] of [[0.36, 0.01, 0, -0.17], [0.01, 0.34, -0.18, 0], [0.01, 0.34, 0.18, 0]]) { const s = makeBox(w, 0.14, d, deskWood); s.position.set(x, -0.01, z); drawerBox.add(s); }
  const dust = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.28), new THREE.MeshStandardMaterial({ map: canvasTexture(128, 128, (c, w, h) => { c.fillStyle = '#8a7f72'; c.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(200,190,175,${Math.random() * 0.5})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } c.fillStyle = '#5d4a36'; c.fillRect(28, 22, 72, 88); }), roughness: 1 }));
  dust.rotation.x = -Math.PI / 2; dust.position.y = -0.074; drawerBox.add(dust);
  world.interactable(openDrawer, { id: 'ev_drawer', evidence: 'ev_drawer', label: 'الدرج المفتوح' });
  world.physics.addBox(4.55, -2.3, 0.4, 0.78, 0, 0, 0.8);
  ctx.inspectModels.ev_drawer = () => { const g = new THREE.Group(); const c = openDrawer.clone(true); c.position.set(0, 0, 0); g.add(c); return g; };
  // desk items
  const deskTop = 0.785;
  const deskItem = (id, lx, lz, rot = 0, scale = 1) => world.prop(id, { pos: [0, 0, 0], rot, collide: false, scale, parent: desk }).then(h => { if (h) h.position.set(lx, deskTop, lz); return h; });
  await deskItem('desk_lamp_arm_01', 0.55, -0.2, 0.6);
  await deskItem('magnifying_glass_01', -0.35, 0.15, 1.2);
  await deskItem('round_spectacles', -0.15, 0.22, 0.4);
  await deskItem('book_encyclopedia_set_01', 0.5, -0.28, Math.PI, 0.7);
  const notepad = new THREE.Group(); notepad.position.set(0.05, deskTop, 0.1); notepad.rotation.y = 0.1; desk.add(notepad);
  const padBack = makeBox(0.16, 0.012, 0.22, plain('#3a2c22', 0.9)); padBack.position.y = 0.006; notepad.add(padBack);
  const padPaper = paperMesh({ w: 0.15, h: 0.21, lines: '', tint: '#f6f2e6', px: 256 }); padPaper.rotation.x = -Math.PI / 2; padPaper.position.y = 0.0135; notepad.add(padPaper);
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 6), plain('#d6a72a', 0.6)); pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.4; pencil.position.set(0.12, 0.006, 0.05); notepad.add(pencil);
  world.interactable(notepad, { id: 'ev_notepad', evidence: 'ev_notepad', label: 'مفكرة على المكتب' });
  const chair = await world.prop('dining_chair_02', { pos: [5.25, 0, -2.3], rot: -Math.PI / 2 });
  const deskLamp = world.spot(4.4, 1.25, -2.15, 4.5, 0.75, -2.3, { color: '#ffc985', intensity: 7, angle: 0.9, penumbra: 0.7, distance: 4 });
  const studyCeil = world.point(3.75, 2.6, -2, { color: '#ffd8a8', intensity: 3.2, distance: 6 });
  // bookshelf with year-labelled notebooks (flavour clue)
  const shelf = await world.prop('wooden_bookshelf_worn', { pos: [3.1, 0, -3.66], rot: 0 });
  if (shelf) {
    // find the shelf boards by casting rays downward, then fill them with books
    const sb = new THREE.Box3().setFromObject(shelf);
    const rc = new THREE.Raycaster(); const meshes = []; shelf.traverse(o => o.isMesh && meshes.push(o));
    const levels = [];
    rc.set(new THREE.Vector3(3.1, sb.max.y - 0.05, -3.62), new THREE.Vector3(0, -1, 0));
    for (const hit of rc.intersectObjects(meshes)) if (hit.face && hit.face.normal.y > 0.5 && !levels.some(l => Math.abs(l - hit.point.y) < 0.08)) levels.push(hit.point.y);
    const bookColors = ['#4a2b1b', '#1d3326', '#5a1e1e', '#2a2a3a', '#6b5a3a', '#3b3b2b', '#7a6a50', '#20304a'];
    const bookGeo = new THREE.BoxGeometry(1, 1, 1);
    levels.sort((a, b) => b - a).forEach((y, li) => {
      if (li === 0 && y > sb.max.y - 0.15) return; // top surface
      let x = sb.min.x + 0.1;
      const end = sb.max.x - 0.1;
      const notebooks = li === 2;
      while (x < end) {
        if (!notebooks && Math.random() < 0.12) { x += 0.1 + Math.random() * 0.15; continue; }
        const bw = notebooks ? 0.032 : 0.025 + Math.random() * 0.03, bh = notebooks ? 0.22 : 0.18 + Math.random() * 0.1;
        const b = new THREE.Mesh(bookGeo, plain(notebooks ? '#121212' : bookColors[Math.floor(Math.random() * bookColors.length)], 0.7));
        b.scale.set(bw, bh, notebooks ? 0.17 : 0.15 + Math.random() * 0.05);
        b.position.set(x + bw / 2, y + bh / 2, -3.62);
        b.rotation.z = !notebooks && Math.random() < 0.08 ? 0.18 : 0;
        b.castShadow = true; b.receiveShadow = true; scene.add(b);
        x += bw + 0.002;
        if (notebooks && x > sb.min.x + 0.45) break;
      }
    });
    world.interactable(shelf, { id: 'f_shelf', label: 'رفوف الكتب', action: () => 'كتب عن الأحجار الكريمة وصياغة الذهب. على رف واحد دفاتر سوداء متطابقة، على كعب كل منها سنة: من 2014 حتى العام الماضي. دفتر هذا العام غير موجود.', note: 'الأستاذ حسن يحتفظ بدفتر أسود لكل سنة. دفتر هذه السنة هو المسروق.' });
  }
  await world.prop('wall_clock', { pos: [1.59, 2.05, -1.2], rot: Math.PI / 2, collide: false, scale: 1.3 });

  // ================= KITCHEN =================
  const counterTop = await T('marble_01', { size: 1.2, roughness: 0.35 });
  const cabinetMat = await T('kitchen_wood', { size: 1.2, color: '#9c8a6e', roughness: 0.7 });
  const runZ0 = -3.0, runZ1 = -0.2;
  const run = makeBox(0.6, 0.86, runZ1 - runZ0, cabinetMat); run.position.set(-5.7, 0.43, (runZ0 + runZ1) / 2); scene.add(run);
  const ctop = makeBox(0.64, 0.04, runZ1 - runZ0 + 0.02, counterTop); ctop.position.set(-5.68, 0.88, (runZ0 + runZ1) / 2); scene.add(ctop);
  for (let z = runZ0 + 0.3; z < runZ1; z += 0.6) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.8, 0.005), plain('#4a3f32')); line.position.set(-5.399, 0.45, z + 0.3); scene.add(line);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.1), plain('#aaa', 0.3, 1)); handle.position.set(-5.39, 0.75, z); scene.add(handle);
  }
  world.physics.addBox(-5.7, (runZ0 + runZ1) / 2, 0.32, (runZ1 - runZ0) / 2, 0, 0, 0.9);
  const upper = makeBox(0.35, 0.7, runZ1 - runZ0, cabinetMat); upper.position.set(-5.82, 1.95, (runZ0 + runZ1) / 2); scene.add(upper);
  // backsplash tiles
  const splash = makeBox(0.02, 0.62, runZ1 - runZ0, tiles); splash.position.set(-5.92, 1.21, (runZ0 + runZ1) / 2); scene.add(splash);
  // sink
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.5), plain('#b9bcbd', 0.2, 1)); sink.position.set(-5.68, 0.905, -1.2); scene.add(sink);
  const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 16, Math.PI), plain('#ccc', 0.15, 1)); faucet.position.set(-5.9, 1.0, -1.2); faucet.rotation.y = Math.PI / 2; scene.add(faucet);
  // stove
  const stoveTop = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.56), plain('#111', 0.3, 0.3)); stoveTop.position.set(-5.68, 0.905, -2.4); scene.add(stoveTop);
  for (const [dx, dz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 20), plain('#333', 0.5, 0.8)); b.rotation.x = Math.PI / 2; b.position.set(-5.68 + dx, 0.92, -2.4 + dz); scene.add(b); }
  await world.prop('vintage_electric_kettle', { pos: [-5.7, 0.9, -1.8], rot: Math.PI / 2, collide: false, scale: 0.85 });
  // fridge (north-west corner) with Mona's note
  const fridge = world.rounded(0.7, 1.8, 0.68, 0.04, new THREE.MeshPhysicalMaterial({ color: '#e9e7e1', roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  fridge.position.set(-5.6, 0.9, -3.58); scene.add(fridge);
  const fHandle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.03), plain('#bbb', 0.2, 1)); fHandle.position.set(-5.24, 1.15, -3.35); scene.add(fHandle);
  const fSplit = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.01, 0.66), plain('#999')); fSplit.position.set(-5.248, 1.3, -3.58); scene.add(fSplit);
  world.physics.addBox(-5.6, -3.58, 0.36, 0.35, 0, 0, 1.8);
  const note = paperMesh({ w: 0.15, h: 0.19, lines: 'أستاذ حسن،\nاضطررت للخروج الساعة 4 لأن ابني مريض.\nسامحني.\n— منى', hand: true, tint: '#fbf7dc', px: 300, fontScale: 1.25 });
  note.position.set(-5.246, 1.45, -3.5); note.rotation.y = Math.PI / 2; note.rotation.z = 0.04; scene.add(note);
  const magnet = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), plain('#c0392b', 0.4)); magnet.rotation.z = Math.PI / 2; magnet.position.set(-5.24, 1.53, -3.5); scene.add(magnet);
  world.interactable(note, { id: 'ev_fridge', evidence: 'ev_fridge', label: 'ورقة على الثلاجة' });
  world.interactable(fridge, { id: 'f_fridge', label: 'الثلاجة', action: () => 'خضار، لبن، وعلبة دواء للضغط باسم حسن الشامي. لا شيء غير عادي.' });
  // kitchen table
  await world.prop('round_wooden_table_01', { pos: [-3.7, 0, -1.6], rot: 0, fit: { h: 0.76 } });
  await world.prop('dining_chair_02', { pos: [-3.7, 0, -0.75], rot: Math.PI });
  await world.prop('dining_chair_02', { pos: [-2.85, 0, -1.6], rot: -Math.PI / 2 });
  await world.prop('jug_01', { pos: [-3.8, 0.76, -1.7], rot: 0.3, collide: false, scale: 0.8 });
  await world.prop('lemon', { pos: [-3.55, 0.81, -1.45], collide: false });
  await world.prop('lemon', { pos: [-3.5, 0.81, -1.55], rot: 1, collide: false });
  // fluorescent kitchen light
  const tube = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.2), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#eef6ff', emissiveIntensity: 2.2 })); tube.position.set(-3.75, 2.86, -2); scene.add(tube);
  world.point(-3.75, 2.6, -2, { color: '#e8f0ff', intensity: 4.5, distance: 6 });

  // ================= BEDROOM =================
  await world.prop('GothicBed_01', { pos: [-3.9, 0, -8.95], rot: 0 });
  await world.prop('ClassicNightstand_01', { pos: [-5.1, 0, -9.65], rot: 0 });
  await world.prop('alarm_clock_01', { pos: [-5.0, 0.7, -9.65], rot: 0.3, collide: false });
  const wardrobe = await world.prop('vintage_cabinet_01', { pos: [-5.63, 0, -5.6], rot: Math.PI / 2, scale: 0.85 });
  if (wardrobe) world.interactable(wardrobe, { id: 'f_safe', label: 'خزانة الملابس', action: () => 'بين الملابس خزنة حديدية صغيرة، مقفلة وسليمة. لا خدش عليها. من سرق الساعة لم يقترب منها.', note: 'الخزنة في غرفة النوم سليمة تمامًا — اللص لم يبحث عن المال.' });
  // framed photo on the nightstand
  const photoTex = canvasTexture(256, 320, (c, w, h) => {
    c.fillStyle = '#d8d0bd'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2722'; c.fillRect(14, 14, w - 28, h - 28);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8b8478'); g.addColorStop(1, '#4b463e'); c.fillStyle = g; c.fillRect(20, 20, w - 40, h - 40);
    c.fillStyle = '#2a2622'; c.beginPath(); c.ellipse(90, 120, 28, 34, 0, 0, Math.PI * 2); c.fill(); c.fillRect(55, 150, 70, 150);
    c.beginPath(); c.ellipse(170, 130, 25, 30, 0, 0, Math.PI * 2); c.fill(); c.fillRect(140, 158, 62, 140);
    c.fillStyle = '#c9a54a'; c.beginPath(); c.arc(128, 200, 8, 0, Math.PI * 2); c.fill();
  });
  const photo = new THREE.Group(); photo.position.set(-5.25, 0.7, -9.6); photo.rotation.y = 0.35; scene.add(photo);
  const pf = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.01), plain('#3b2a1c', 0.5)); pf.position.y = 0.085; pf.rotation.x = -0.15; photo.add(pf);
  const pimg = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.15), new THREE.MeshStandardMaterial({ map: photoTex, roughness: 0.4 })); pimg.position.set(0, 0.085, 0.0065); pimg.rotation.x = -0.15; photo.add(pimg);
  world.interactable(photo, { id: 'f_photo', label: 'صورة قديمة', action: () => 'صورة بالأبيض والأسود: رجل مسن يقدم ساعة جيب لشاب في ثوب التخرج. على ظهرها بخط باهت: «حسن وأبي — 1971».' });
  world.point(-4.4, 1.6, -8.4, { color: '#ffc58e', intensity: 2.6, distance: 6 });
  const bedLampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.16, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#efe0c0', emissive: '#ffc070', emissiveIntensity: 0.8, side: THREE.DoubleSide })); bedLampShade.position.set(-5.2, 0.95, -9.75); scene.add(bedLampShade);

  // ================= ambient =================
  const hemi = new THREE.HemisphereLight('#9fb0c8', '#2a2018', 0.25); scene.add(hemi);
  scene.fog = new THREE.FogExp2('#0b0c10', 0.012);

  // hidden watch model for inspection
  ctx.inspectModels.ev_cabinet = async () => { const w = await Assets.modelInstance('vintage_pocket_watch'); const g = new THREE.Group(); w.scale.setScalar(6); g.add(w); const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 1), plain('#6b6b66', 1)); r.scale.set(1.6, 0.25, 1.2); r.position.y = -0.2; g.add(r); return g; };
  ctx.inspectModels.ev_toolbox = async () => { const t = await Assets.modelInstance('metal_toolbox'); const g = new THREE.Group(); g.add(t); const key = makeKey(); key.position.set(0.05, 0.4, 0.05); key.scale.setScalar(3); g.add(key); return g; };
  ctx.inspectModels.ev_lock = () => { const g = new THREE.Group(); const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 40), plain('#b08d57', 0.25, 1)); rose.rotation.x = Math.PI / 2; g.add(rose); const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 32), plain('#c9a96a', 0.15, 1)); cyl.rotation.x = Math.PI / 2; cyl.position.z = 0.04; g.add(cyl); const slot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.01), plain('#111')); slot.position.z = 0.085; g.add(slot); const oil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshPhysicalMaterial({ color: '#5a4310', roughness: 0, transmission: 0.3, clearcoat: 1 })); oil.position.set(0.02, -0.06, 0.085); g.add(oil); return g; };
  ctx.inspectModels.ev_ashtray = () => ashtray.clone(true);
  ctx.inspectModels.ev_trash = () => bin.clone(true);
  ctx.inspectModels.ev_window = () => winLiving2.group.children.find(o => o === winLiving2.latch).clone();
  ctx.inspectModels.ev_boots = () => boots ? boots.clone(true) : new THREE.Group();

  // door lock evidence zone (landing side of door 12)
  world.zone(0.38, 1.0, 0.12, 0.25, 0.3, 0.15, { id: 'ev_lock', evidence: 'ev_lock', label: 'قفل الباب' });
  world.zone(0.38, 1.0, -0.12, 0.25, 0.3, 0.15, { id: 'ev_lock_in', evidence: 'ev_lock', label: 'قفل الباب' });

  // ambient audio sources
  ctx.surfaceAt = (x, z) => world.surfaceAt(x, z);
  return ctx;
}

export function makeKey() {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: '#e3bf6a', roughness: 0.2, metalness: 1 });
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.007, 10, 24), brass); g.add(bow);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.008, 0.004), brass); blade.position.x = 0.05; g.add(blade);
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006 + (i % 2) * 0.004, 0.004), brass); t.position.set(0.035 + i * 0.012, -0.007, 0); g.add(t); }
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.009), plain('#e8e2c8', 0.9)); tape.position.set(0, 0, 0); tape.scale.set(1, 0.6, 1); g.add(tape);
  return g;
}
