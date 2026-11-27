// On-screen controls for phones: a movement joystick (left), drag-to-look (right side)
// and buttons for the keyboard actions (interact, case file, board, detective sense, pause).
import { h, show } from './dom.js';
import { audio } from '../core/audio.js';

export class TouchControls {
  constructor(app) {
    this.app = app;
    this.el = h(`<div id="touch">
      <div class="look"></div>
      <div class="stick"><div class="knob"></div></div>
      <button class="tbtn act hidden"><span class="ic">✋</span><span class="lb"></span></button>
      <div class="tbar">
        <button class="tbtn sm" data-k="pause" aria-label="إيقاف">⏸</button>
        <button class="tbtn sm" data-k="file">ملف القضية</button>
        <button class="tbtn sm" data-k="board">لوحة التحقيق</button>
        <button class="tbtn sm" data-k="sense">حاسة المحقق</button>
      </div>
    </div>`);
    document.body.appendChild(this.el);
    this.stick = this.el.querySelector('.stick'); this.knob = this.el.querySelector('.knob');
    this.act = this.el.querySelector('.act'); this.actLabel = this.act.querySelector('.lb');
    this.move = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this._bindStick(); this._bindLook();
    this.act.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); const inv = this.app.inv; if (inv && inv.mode === 'play') inv.tryInteract(); });
    this.el.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation(); audio.click();
      const inv = this.app.inv; if (!inv || inv.mode !== 'play') return;
      const k = b.dataset.k;
      if (k === 'pause') this.app.openPause();
      else if (k === 'file') inv.openCaseFile();
      else if (k === 'board') inv.openBoard();
      else if (k === 'sense') inv.detectiveSense();
    }));
    this.setVisible(false);
  }

  setVisible(on) { show(this.el, on); if (!on) this._resetStick(); }

  setTarget(label) {
    show(this.act, !!label);
    if (label) this.actLabel.textContent = label;
  }

  _resetStick() { this.move.x = this.move.y = 0; this.knob.style.transform = ''; this.stickId = null; }

  _bindStick() {
    const R = 55;
    const update = (e) => {
      const r = this.stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.move.x = dx / R; this.move.y = -dy / R;
    };
    this.stick.addEventListener('pointerdown', (e) => { e.preventDefault(); this.stickId = e.pointerId; this.stick.setPointerCapture(e.pointerId); update(e); });
    this.stick.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) update(e); });
    const end = (e) => { if (e.pointerId === this.stickId) this._resetStick(); };
    this.stick.addEventListener('pointerup', end); this.stick.addEventListener('pointercancel', end);
  }

  _bindLook() {
    const look = this.el.querySelector('.look');
    let id = null, last = null;
    look.addEventListener('pointerdown', (e) => { id = e.pointerId; last = { x: e.clientX, y: e.clientY }; look.setPointerCapture(e.pointerId); });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      this.lookDelta.x += e.clientX - last.x; this.lookDelta.y += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    });
    const end = (e) => { if (e.pointerId === id) id = null; };
    look.addEventListener('pointerup', end); look.addEventListener('pointercancel', end);
  }

  // consumed by the player each frame
  takeLook() { const d = { ...this.lookDelta }; this.lookDelta.x = this.lookDelta.y = 0; return d; }
}
