import { $, esc, show } from './dom.js';

export class HUD {
  constructor() {
    this.el = $('#hud');
    this.prompt = $('#prompt');
    this.cross = $('#crosshair');
    this.toasts = $('#toasts');
    this.obj = $('#objectives');
    this.hintEl = $('#hint');
    this.obs = $('#observation');
    this.saveEl = $('#saveflag');
    this._hintTimer = null;
  }
  show(on) { show(this.el, on); }
  setPrompt(def, label, isEvidence, collected) {
    if (!def) { show(this.prompt, false); this.cross.className = ''; return; }
    this.prompt.querySelector('.txt').innerHTML = esc(label) + (isEvidence && !collected ? ' <span class="tag">دليل محتمل</span>' : collected ? ' <span class="tag">في الملف</span>' : '');
    show(this.prompt, true);
    this.cross.className = 'active' + (isEvidence && !collected ? ' evidence' : '');
  }
  toast(kind, title, text) {
    const cls = kind === 'deduction' ? 'ded' : kind === 'statement' ? 'stmt' : '';
    const t = document.createElement('div');
    t.className = 'toast ' + cls;
    t.innerHTML = `<div class="t1">${esc(title)}</div><div class="t2">${esc(text)}</div>`;
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), 5200);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }
  hint(text, ms = 6000) {
    this.hintEl.innerHTML = text;
    show(this.hintEl, true);
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => show(this.hintEl, false), ms);
  }
  objectives(caseTitle, list) {
    this.obj.innerHTML = `<div class="case">${esc(caseTitle)}</div><div class="head">مهام التحقيق</div>` +
      list.map(o => `<div class="obj ${o.done ? 'done' : ''}">${esc(o.text)}</div>`).join('');
  }
  observation(text) {
    return new Promise(res => {
      this.obs.querySelector('.obs-text').textContent = text;
      show(this.obs, true);
      const done = () => { show(this.obs, false); window.removeEventListener('keydown', key, true); this.obs.removeEventListener('click', done); res(); };
      const key = (e) => { if (['KeyE', 'Space', 'Enter', 'Escape'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); done(); } };
      setTimeout(() => { window.addEventListener('keydown', key, true); this.obs.addEventListener('click', done); }, 200);
    });
  }
  saved() { show(this.saveEl, true); clearTimeout(this._sv); this._sv = setTimeout(() => show(this.saveEl, false), 1800); }
}
