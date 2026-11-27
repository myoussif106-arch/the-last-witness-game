import { $, h, esc, show, KIND_LABEL } from './dom.js';
import { audio } from '../core/audio.js';

// Investigation cork board: pin evidence/statements/people, connect them with red string.
// Meaningful connections (defined per case) produce deductions that feed interrogations
// and the final accusation.
export class BoardUI {
  constructor(inv) { this.inv = inv; this.el = $('#board'); this.active = false; this.sel = null; }

  open() {
    this.active = true; audio.paper();
    show(this.el, true);
    this.render();
    return new Promise(r => (this._resolve = r));
  }
  close() { if (!this.active) return; this.active = false; show(this.el, false); this.inv.g.saveSoon(); this._resolve && this._resolve(); }

  get state() { return this.inv.g.cs.board; }

  render() {
    const inv = this.inv, cs = inv.g.cs;
    this.el.innerHTML = `
      <div class="bhead"><div class="ttl">لوحة التحقيق</div>
        <div class="help">اسحب العناصر من القائمة إلى اللوحة • انقر على بطاقة ثم على أخرى لربطهما بخيط • الروابط الصحيحة تكشف استنتاجات جديدة</div>
        <button class="btn" data-auto>رتّب البطاقات</button><button class="btn" data-clear>إزالة كل الخيوط</button><span class="x-close" style="position:static">✕ إغلاق (B)</span></div>
      <div class="bwrap"><div class="tray scroll"></div><div class="cork"><svg></svg></div></div>`;
    this.cork = this.el.querySelector('.cork'); this.svg = this.el.querySelector('svg');
    this.el.querySelector('.x-close').onclick = () => this.close();
    this.el.querySelector('[data-clear]').onclick = () => { this.state.links = []; this.drawLinks(); audio.paper(); };
    this.el.querySelector('[data-auto]').onclick = () => this.autoArrange();
    this.cork.onclick = (e) => { if (e.target === this.cork) { this.sel = null; this.updateSel(); } };
    this.cork.ondragover = e => e.preventDefault();
    this.cork.ondrop = e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (!id) return; const r = this.cork.getBoundingClientRect(); this.place(id, (e.clientX - r.left - 95) / r.width, (e.clientY - r.top - 20) / r.height); };
    this.renderTray();
    for (const id of Object.keys(this.state.items)) if (inv.g.has(id) || id.startsWith('p_')) this.renderPin(id);
    requestAnimationFrame(() => this.drawLinks());
  }

  renderTray() {
    const inv = this.inv, g = inv.g, d = inv.data;
    const tray = this.el.querySelector('.tray'); tray.innerHTML = '';
    const groups = [
      ['الأدلة', Object.keys(g.cs.evidence)],
      ['الإفادات', Object.keys(g.cs.statements)],
      ['الاستنتاجات', Object.keys(g.cs.deductions)],
      ['الأشخاص', Object.keys(d.people).filter(p => p !== 'salim' && (g.cs.metNpcs[p] || d.people[p].always)).map(p => 'p_' + p)],
    ];
    for (const [label, ids] of groups) {
      if (!ids.length) continue;
      tray.appendChild(h(`<h4>${label}</h4>`));
      for (const id of ids) {
        const info = inv.itemInfo(id);
        const ti = h(`<div class="ti ${this.state.items[id] ? 'placed' : ''}" draggable="true">${esc(info.name)}</div>`);
        ti.ondragstart = e => e.dataTransfer.setData('text/plain', id);
        ti.onclick = () => { if (!this.state.items[id]) this.place(id, 0.1 + Math.random() * 0.7, 0.1 + Math.random() * 0.7); };
        tray.appendChild(ti);
      }
    }
    if (!tray.children.length) tray.innerHTML = '<div style="color:var(--ink-faint);padding:10px">اجمع أدلة وأقوالًا أولًا.</div>';
  }

  place(id, fx, fy) {
    fx = Math.max(0.01, Math.min(0.85, fx)); fy = Math.max(0.02, Math.min(0.82, fy));
    this.state.items[id] = { x: fx, y: fy, r: (Math.random() - 0.5) * 5 };
    const old = this.cork.querySelector(`[data-id="${id}"]`); if (old) old.remove();
    this.renderPin(id); this.renderTray(); this.drawLinks();
    audio.paper(); this.inv.g.saveSoon();
  }

  renderPin(id) {
    const inv = this.inv, info = inv.itemInfo(id), it = this.state.items[id];
    const cls = info.type === 'st' ? 'st' : info.type === 'dd' ? 'dd' : info.type === 'p' ? 'p' : '';
    const img = info.type === 'p' ? inv.portraits[id.slice(2)] : inv.thumbs[id];
    const pin = h(`<div class="pin ${cls}" data-id="${id}" style="--r:${it.r}deg">
      <span class="rm" title="إزالة">✕</span>
      ${img ? `<img src="${img}">` : ''}
      <div class="k">${esc(KIND_LABEL[info.kind] || '')}${info.by ? ' — ' + esc(info.by) : ''}</div>
      <div class="n">${esc(info.name)}</div><div class="s">${esc(info.short || '')}</div></div>`);
    pin.style.left = (it.x * 100) + '%'; pin.style.top = (it.y * 100) + '%';
    pin.querySelector('.rm').onclick = (e) => { e.stopPropagation(); delete this.state.items[id]; this.state.links = this.state.links.filter(l => l[0] !== id && l[1] !== id); pin.remove(); this.renderTray(); this.drawLinks(); };
    let drag = null, moved = false;
    pin.onpointerdown = (e) => {
      if (e.target.classList.contains('rm')) return;
      drag = { x: e.clientX, y: e.clientY, ox: it.x, oy: it.y }; moved = false; pin.setPointerCapture(e.pointerId);
    };
    pin.onpointermove = (e) => {
      if (!drag) return;
      const r = this.cork.getBoundingClientRect();
      const dx = (e.clientX - drag.x) / r.width, dy = (e.clientY - drag.y) / r.height;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) moved = true;
      it.x = Math.max(0, Math.min(0.88, drag.ox + dx)); it.y = Math.max(0, Math.min(0.86, drag.oy + dy));
      pin.style.left = (it.x * 100) + '%'; pin.style.top = (it.y * 100) + '%';
      this.drawLinks();
    };
    pin.onpointerup = () => { if (drag && !moved) this.clickPin(id); drag = null; };
    this.cork.appendChild(pin);
  }

  clickPin(id) {
    if (!this.sel) { this.sel = id; this.updateSel(); audio.click(); return; }
    if (this.sel === id) { this.sel = null; this.updateSel(); return; }
    const a = this.sel; this.sel = null; this.updateSel();
    this.connect(a, id);
  }
  updateSel() { this.cork.querySelectorAll('.pin').forEach(p => p.classList.toggle('sel', p.dataset.id === this.sel)); }

  connect(a, b) {
    const links = this.state.links;
    const idx = links.findIndex(l => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a));
    if (idx >= 0) { links.splice(idx, 1); this.drawLinks(); audio.paper(); return; }
    audio.string();
    const ded = this.inv.findDeduction(a, b);
    if (ded) {
      links.push([a, b, 'ded']);
      const isNew = this.inv.gainDeduction(ded);
      const x = this.inv.data.deductions[ded];
      if (isNew) {
        this.flash(x.name, x.text);
        const ia = this.state.items[a], ib = this.state.items[b];
        if (!this.state.items[ded]) {
          this.state.items[ded] = { x: Math.min(0.85, (ia.x + ib.x) / 2 + 0.02), y: Math.min(0.82, (ia.y + ib.y) / 2 + 0.14), r: (Math.random() - 0.5) * 4 };
          this.renderPin(ded);
          links.push([a, ded, 'ded'], [b, ded, 'ded']);
        }
        this.renderTray();
      } else this.flash('استنتاج معروف', x.name, true);
    } else {
      links.push([a, b, 'weak']);
      this.flash('', 'لا يبدو أن بينهما علاقة واضحة… على الأقل ليس بعد.', true);
    }
    this.drawLinks(); this.inv.g.saveSoon();
  }

  flash(t1, t2, soft = false) {
    const old = this.el.querySelector('.flash'); if (old) old.remove();
    const f = h(`<div class="flash" style="${soft ? 'border-color:rgba(255,255,255,0.2)' : ''}">${t1 ? `<div class="t1">${esc(t1)}</div>` : ''}<div class="t2">${esc(t2)}</div></div>`);
    this.cork.appendChild(f);
    setTimeout(() => f.remove(), soft ? 2200 : 6500);
  }

  center(id) {
    const p = this.cork.querySelector(`[data-id="${id}"]`); if (!p) return null;
    const r = this.cork.getBoundingClientRect(), pr = p.getBoundingClientRect();
    return { x: pr.left - r.left + pr.width / 2, y: pr.top - r.top + 4 };
  }
  drawLinks() {
    if (!this.svg) return;
    let html = '';
    for (const [a, b, t] of this.state.links) {
      const pa = this.center(a), pb = this.center(b); if (!pa || !pb) continue;
      html += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" class="${t}"/>`;
    }
    this.svg.innerHTML = html;
  }

  autoArrange() {
    const ids = Object.keys(this.state.items);
    const order = { p: 0, ev: 1, st: 2, dd: 3 };
    ids.sort((a, b) => order[this.inv.itemInfo(a).type] - order[this.inv.itemInfo(b).type]);
    const cols = Math.max(4, Math.ceil(Math.sqrt(ids.length * 1.6)));
    ids.forEach((id, i) => { const it = this.state.items[id]; it.x = 0.02 + (i % cols) * (0.86 / Math.max(1, cols - 1)); it.y = 0.04 + Math.floor(i / cols) * 0.27; });
    this.render();
  }
}
