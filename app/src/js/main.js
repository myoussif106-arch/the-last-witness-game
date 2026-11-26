import { Renderer } from './engine/renderer.js';
import { audio } from './core/audio.js';
import { game } from './game/state.js';
import { Investigation } from './game/investigation.js';
import { CASES, loadCase } from './cases/index.js';
import { renderMainMenu, renderSettings, renderPause } from './ui/menus.js';
import { $, show, wait, esc } from './ui/dom.js';

class App {
  constructor() {
    this.game = game;
    this.params = new URLSearchParams(location.search);
    this.debugNoLock = this.params.has('nolock');
    this.renderer = new Renderer($('#stage'));
    this.inv = null;
    this.last = performance.now();
  }

  async init() {
    await document.fonts.load('20px Cairo'); await document.fonts.load('20px "Reem Kufi"');
    await Promise.all([document.fonts.load('20px Amiri'), document.fonts.load('20px "Aref Ruqaa"'), document.fonts.load('bold 20px Amiri')]).catch(() => {});
    await this.game.load();
    this.applySettings();
    this.toMenu(true);
    requestAnimationFrame(t => this.loop(t));
    // first user gesture unlocks audio
    const unlock = () => { audio.init(); audio.resume(); this.applySettings(); if (!this.inv) audio.startMusic('menu'); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    window.addEventListener('beforeunload', () => { if (this.inv) this.inv.savePose(); this.game.saveNow(); });
    if (this.params.get('autostart')) this.startCase(this.params.get('autostart'), this.params.has('fresh'));
    window.addEventListener('keydown', e => { if (e.code === 'Escape') this.escHeld = true; }, true);
    window.addEventListener('keyup', e => { if (e.code === 'Escape') { this.escHeld = false; const f = this.onEscUp; this.onEscUp = null; if (f) setTimeout(f, 60); } }, true);
    window.__app = this;
  }

  applySettings(changed) {
    const s = this.game.settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, ambient: s.ambient });
    if (this.inv) this.inv.applySettings();
    if (changed === 'quality' || changed === 'shadows' || changed === 'postfx') this.renderer.applySettings(s);
    if (changed === 'fullscreen' && window.native) window.native.setFullscreen(s.fullscreen);
    this.game.saveSoon(1000);
  }

  toMenu(first = false) {
    if (this.inv) { this.inv.stop(); this.inv = null; }
    this.renderer.scene = null;
    show($('#stage'), false);
    for (const id of ['#pause', '#intro', '#loading', '#result', '#accuse']) show($(id), false);
    show($('#menu'), true);
    renderMainMenu(this);
    if (!first) { audio.stopMusic(); setTimeout(() => audio.startMusic('menu'), 600); }
  }

  openSettings() { renderSettings(this, () => {}); }

  openPause() {
    if (!this.inv || this.paused) return;
    this.paused = true;
    this.inv.suspend('pause');
    renderPause(this, this.inv);
  }

  async startCase(id, fresh) {
    const meta = CASES.find(c => c.id === id);
    const mod = await loadCase(id);
    if (!mod) return;
    audio.init(); audio.resume(); audio.stopMusic();
    show($('#menu'), false);
    // loading screen
    const L = $('#loading');
    L.querySelector('.load-case').textContent = `القضية ${meta.num}: ${meta.title}`;
    L.querySelector('.load-tip').textContent = mod.loadingTips[Math.floor(Math.random() * mod.loadingTips.length)];
    const bar = L.querySelector('.load-bar div'); bar.style.width = '0%';
    show(L, true);
    const isNew = fresh || !this.game.caseProgress(id).state;
    this.game.startCase(id, fresh);
    const inv = new Investigation(this, mod, meta);
    show($('#stage'), true);
    try {
      await inv.load(p => { bar.style.width = Math.round(100 * p.loaded / Math.max(1, p.total)) + '%'; });
    } catch (e) {
      console.error(e);
      L.querySelector('.load-tip').textContent = 'حدث خطأ أثناء تحميل القضية: ' + e.message;
      return;
    }
    bar.style.width = '100%';
    this.inv = inv;
    await wait(300);
    show(L, false);
    if (isNew && !this.params.has('skipintro')) await this.playIntro(meta, mod.data.meta);
    $('#fade').classList.add('on');
    inv.start();
    await wait(80);
    $('#fade').classList.remove('on');
  }

  playIntro(meta, cm) {
    const el = $('#intro');
    el.innerHTML = `<div class="wrap"><div class="cnum">القضية ${meta.num}</div><div class="ctitle">${esc(cm.title)}</div><div class="cmeta">${esc(cm.location)} — ${esc(cm.time)}</div>${cm.intro.map(t => `<p>${esc(t)}</p>`).join('')}</div><div class="skip">انقر للمتابعة</div>`;
    show(el, true);
    audio.startMusic('investigation');
    return new Promise(res => {
      const ps = [...el.querySelectorAll('p')];
      let i = 0, done = false;
      const next = () => { if (i < ps.length) { ps[i++].classList.add('on'); audio.typeTick(); } };
      const iv = setInterval(() => { next(); if (i >= ps.length) clearInterval(iv); }, 1900);
      setTimeout(next, 600);
      const finish = () => {
        if (i < ps.length) { ps.forEach(p => p.classList.add('on')); i = ps.length; clearInterval(iv); return; }
        if (done) return; done = true; el.onclick = null; window.removeEventListener('keydown', key);
        $('#fade').classList.add('on'); setTimeout(() => { show(el, false); audio.stopMusic(); res(); }, 800);
      };
      const key = (e) => { if (['Space', 'Enter', 'Escape', 'KeyE'].includes(e.code)) finish(); };
      el.onclick = finish; window.addEventListener('keydown', key);
    });
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (this.inv && this.inv.mode !== 'stopped' && this.renderer.scene) {
      this.inv.update(dt);
      this.renderer.render(dt);
    }
    requestAnimationFrame(tt => this.loop(tt));
  }
}

const app = new App();
app.init().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;bottom:0;left:0;color:#f88;z-index:999">${e.stack}</pre>`); });
