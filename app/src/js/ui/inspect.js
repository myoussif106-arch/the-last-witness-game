import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { $, h, esc, show, KIND_LABEL } from './dom.js';
import { audio } from '../core/audio.js';
import { paperBG, drawText } from '../engine/world.js';

// Close-up evidence examination: rotate/zoom 3D objects, read documents, zoom images,
// pencil-rub indented paper, reveal hidden details and file the evidence.
export class InspectUI {
  constructor(inv) {
    this.inv = inv;
    this.el = $('#inspect');
    this.active = false;
    this.renderer = null;
  }

  _ensureRenderer() {
    if (this.renderer) return;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const key = new THREE.DirectionalLight('#fff1dc', 2.2); key.position.set(2, 3, 2); this.scene.add(key);
    const rim = new THREE.DirectionalLight('#9fb6ff', 1.2); rim.position.set(-3, 1, -2); this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.25));
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);
  }

  async open(evId, { model = null, image = null, isNew = false } = {}) {
    const inv = this.inv, g = inv.g;
    const ev = inv.data.evidence[evId];
    this.active = true; this.evId = evId;
    audio.paper();
    this.el.innerHTML = `
      <div class="view"></div>
      <div class="side scroll">
        <div class="kind">${esc(KIND_LABEL[ev.kind] || '')}${isNew ? '<span class="newtag">جديد</span>' : ''}</div>
        <h2>${esc(ev.name)}</h2><div class="where">${esc(ev.where)}</div>
        <div class="txt">${esc(ev.text)}</div>
        <div class="details"></div>
        <div class="actions"></div>
      </div>`;
    show(this.el, true);
    const view = this.el.querySelector('.view');
    this._tmpDetails = [...(inv.pendingDetails[evId] || [])];
    this._renderDetails();
    const actions = this.el.querySelector('.actions');
    let resolveClose; const closed = new Promise(r => (resolveClose = r));
    const close = () => { this._stop(); this.active = false; show(this.el, false); window.removeEventListener('keydown', onKey, true); resolveClose(); };
    const onKey = (e) => { if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); e.stopPropagation(); if (addBtn && !g.cs.evidence[evId]) addBtn.click(); else close(); } };
    let addBtn = null;
    if (!g.cs.evidence[evId]) {
      addBtn = h('<button class="btn primary">أضف إلى ملف القضية</button>');
      addBtn.onclick = () => { inv.gainEvidence(evId, this.thumb); this._renderDetails(); addBtn.remove(); addBtn = null; this.el.querySelector('.kind').insertAdjacentHTML('beforeend', '<span class="newtag" style="background:#3c6a3a">أُضيف إلى الملف</span>'); };
      actions.appendChild(addBtn);
    }
    const closeBtn = h('<button class="btn">إغلاق</button>'); closeBtn.onclick = () => { audio.click(); close(); };
    actions.appendChild(closeBtn);
    setTimeout(() => window.addEventListener('keydown', onKey, true), 150);

    // ---- view modes
    this.thumb = null;
    if (ev.view === 'doc') this._doc(view, ev);
    else if (ev.view === 'rub') this._rub(view, ev);
    else if (ev.view === 'image' && image) this._image(view, image);
    else if (model) this._3d(view, model);
    else this._image(view, null);
    return closed;
  }

  _renderDetails() {
    const g = this.inv.g, ev = this.inv.data.evidence[this.evId];
    const wrap = this.el.querySelector('.details'); wrap.innerHTML = '';
    const got = (g.cs.evidence[this.evId] && g.cs.evidence[this.evId].details) || this._tmpDetails || (this._tmpDetails = []);
    for (const d of ev.details || []) {
      if (got.includes(d.id)) wrap.appendChild(h(`<div class="det"><b>${esc(d.label)}</b>${esc(d.text)}</div>`));
      else if (!d.hidden) {
        const b = h(`<button class="det-btn">🔍 ${esc(d.label)}</button>`);
        b.onclick = () => { audio.click(); this.reveal(d.id); };
        wrap.appendChild(b);
      }
    }
  }

  reveal(detailId) {
    const g = this.inv.g;
    if (g.cs.evidence[this.evId]) {
      if (g.revealDetail(this.evId, detailId)) { audio.evidence(); this.inv.hud.toast('evidence', 'تفصيل جديد', this.inv.data.evidence[this.evId].name); }
    } else {
      (this._tmpDetails ||= []).includes(detailId) || this._tmpDetails.push(detailId);
      this.inv.pendingDetails[this.evId] = this._tmpDetails;
      audio.evidence();
    }
    if (this.onSpin) this.onSpin();
    this._renderDetails();
  }

  _3d(view, obj) {
    this._ensureRenderer();
    const r = this.renderer;
    r.domElement.className = 'i3d';
    view.appendChild(r.domElement);
    view.appendChild(h('<div class="vhint">اسحب بالفأرة لتدوير الدليل • عجلة الفأرة للتكبير</div>'));
    while (this.pivot.children.length) this.pivot.remove(this.pivot.children[0]);
    obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0);
    const holder = new THREE.Group(); holder.add(obj); this.pivot.add(holder);
    const box = new THREE.Box3().setFromObject(holder); const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
    obj.position.sub(c);
    const rad = Math.max(s.x, s.y, s.z) * 0.6 || 0.2;
    this.dist = rad / Math.tan(THREE.MathUtils.degToRad(15)) * 1.15; this.minD = this.dist * 0.35; this.maxD = this.dist * 2;
    this.rot = { x: 0.35, y: -0.6 }; this.target = { ...this.rot };
    this.onSpin = () => { this.target.y += Math.PI; };
    const size = () => { const w = view.clientWidth, hh = view.clientHeight; r.setSize(w, hh, false); this.camera.aspect = w / hh; this.camera.updateProjectionMatrix(); };
    size(); this._resize = size; window.addEventListener('resize', size);
    let drag = null;
    r.domElement.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; r.domElement.setPointerCapture(e.pointerId); };
    r.domElement.onpointermove = e => { if (!drag) return; this.target.y += (e.clientX - drag.x) * 0.01; this.target.x += (e.clientY - drag.y) * 0.01; this.target.x = Math.max(-1.4, Math.min(1.4, this.target.x)); drag = { x: e.clientX, y: e.clientY }; };
    r.domElement.onpointerup = () => { drag = null; };
    r.domElement.onwheel = e => { this.dist = Math.max(this.minD, Math.min(this.maxD, this.dist * (e.deltaY > 0 ? 1.1 : 0.9))); };
    let first = true;
    const loop = () => {
      if (!this.active) return;
      this.rot.x += (this.target.x - this.rot.x) * 0.15; this.rot.y += (this.target.y - this.rot.y) * 0.15;
      if (!drag) this.target.y += 0.0025;
      this.pivot.rotation.set(this.rot.x, this.rot.y, 0);
      this.camera.position.set(0, 0, this.dist); this.camera.lookAt(0, 0, 0);
      r.render(this.scene, this.camera);
      if (first) { first = false; try { this.thumb = r.domElement.toDataURL('image/jpeg', 0.7); this.inv.thumbs[this.evId] ||= this.thumb; } catch {} }
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  _image(view, canvas) {
    const wrap = h('<div class="imgwrap"></div>'); view.appendChild(wrap);
    if (canvas) {
      const img = new Image(); img.src = canvas.toDataURL(); this.thumb = img.src; this.inv.thumbs[this.evId] ||= img.src;
      img.style.background = '#6a2c1d'; img.style.padding = '20px';
      wrap.appendChild(img);
      let z = 1; wrap.onwheel = e => { z = Math.max(1, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1))); img.style.transform = `scale(${z})`; };
      view.appendChild(h('<div class="vhint">عجلة الفأرة للتكبير</div>'));
    }
  }

  _doc(view, ev) {
    const wrap = h('<div class="docwrap"></div>'); view.appendChild(wrap);
    const d = ev.doc;
    const paper = h(`<div class="doc-paper ${d.hand ? 'hand' : ''}">${d.title ? `<h4>${esc(d.title)}</h4>` : ''}${esc(d.body)}</div>`);
    wrap.appendChild(paper);
    let z = 1; wrap.onwheel = e => { z = Math.max(0.8, Math.min(1.8, z * (e.deltaY > 0 ? 0.92 : 1.08))); paper.style.transform = `scale(${z})` + (d.hand ? ' rotate(-1.2deg)' : ''); };
    view.appendChild(h('<div class="vhint">عجلة الفأرة للتكبير</div>'));
  }

  // Pencil rubbing reveals the indentation of what was written on the missing page above.
  _rub(view, ev) {
    const g = this.inv.g;
    const already = g.cs.evidence[this.evId] && g.cs.evidence[this.evId].details.includes('rubbed');
    const wrap = h('<div class="docwrap"><div class="rub-wrap"><canvas></canvas></div></div>'); view.appendChild(wrap);
    const hint = h(`<div class="vhint">${already ? 'الكتابة ظاهرة الآن' : 'اضغط واسحب بالفأرة لتظليل الورقة بالقلم الرصاص'}</div>`); view.appendChild(hint);
    const W = 720, H = 1000;
    const cv = wrap.querySelector('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const base = document.createElement('canvas'); base.width = W; base.height = H; paperBG(base.getContext('2d'), W, H, '#f6f2e6', 0.25);
    const bctx = base.getContext('2d'); bctx.strokeStyle = 'rgba(90,120,170,0.25)'; for (let y = 140; y < H; y += 56) { bctx.beginPath(); bctx.moveTo(40, y); bctx.lineTo(W - 40, y); bctx.stroke(); }
    const text = document.createElement('canvas'); text.width = W; text.height = H;
    const tctx = text.getContext('2d');
    tctx.lineWidth = 2.2; drawText(tctx, ev.rub, W - 60, 110, W - 120, 92, '50px "Aref Ruqaa", serif', '#000');
    const mask = document.createElement('canvas'); mask.width = W; mask.height = H; const mctx = mask.getContext('2d');
    const graphite = document.createElement('canvas'); graphite.width = W; graphite.height = H; const gctx = graphite.getContext('2d');
    const gfx = gctx.createImageData(W, H);
    for (let i = 0; i < gfx.data.length; i += 4) { const v = 70 + Math.random() * 50; gfx.data[i] = v; gfx.data[i + 1] = v; gfx.data[i + 2] = v + 6; gfx.data[i + 3] = 215; }
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tmpc = tmp.getContext('2d');
    const draw = () => {
      ctx.drawImage(base, 0, 0);
      tmpc.globalCompositeOperation = 'source-over'; tmpc.clearRect(0, 0, W, H); tmpc.putImageData(gfx, 0, 0);
      tmpc.globalCompositeOperation = 'destination-in'; tmpc.drawImage(mask, 0, 0);
      tmpc.globalCompositeOperation = 'destination-out'; tmpc.drawImage(text, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    };
    if (already) { mctx.fillStyle = '#000'; mctx.fillRect(30, 60, W - 60, 560); }
    draw();
    // faint indentation visible at grazing angle
    ctx.globalAlpha = 0.05; ctx.drawImage(text, 0, 0); ctx.globalAlpha = 1;
    let down = false, last = null, revealed = already;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    const stroke = (p) => {
      mctx.fillStyle = 'rgba(0,0,0,0.55)';
      const steps = last ? Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / 8) : 1;
      for (let i = 0; i <= steps; i++) {
        const x = last ? last.x + (p.x - last.x) * i / steps : p.x, y = last ? last.y + (p.y - last.y) * i / steps : p.y;
        mctx.beginPath(); mctx.ellipse(x, y, 34, 16, -0.5, 0, Math.PI * 2); mctx.fill();
      }
      last = p;
    };
    let raf = 0;
    cv.onpointerdown = e => { down = true; last = null; cv.setPointerCapture(e.pointerId); stroke(pos(e)); };
    cv.onpointermove = e => {
      if (!down) return; stroke(pos(e));
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); if (!revealed) check(); });
      if (Math.random() < 0.3) audio.paper();
    };
    cv.onpointerup = () => { down = false; };
    const check = () => {
      const d = mctx.getImageData(40, 80, W - 80, 520).data; let on = 0, n = 0;
      for (let i = 3; i < d.length; i += 4 * 97) { n++; if (d[i] > 100) on++; }
      if (on / n > 0.55) { revealed = true; hint.textContent = 'ظهرت الكتابة!'; this.reveal('rubbed'); this.inv.g.log('ظلّلت ورقة المذكرة فظهرت كتابة الأستاذ حسن عن خاتم ليلى.'); }
    };
    this.thumb = null;
  }

  _stop() {
    cancelAnimationFrame(this._raf);
    if (this._resize) window.removeEventListener('resize', this._resize);
    this.onSpin = null; this._tmpDetails = null;
  }
}
