import { $, h, esc, show, wait } from './dom.js';
import { audio } from '../core/audio.js';
import { MOOD_LABELS } from '../engine/character.js';
import { openPicker } from './picker.js';

// Interrogation interface + dialogue engine.
export class DialogueUI {
  constructor(inv) {
    this.inv = inv; // Investigation
    this.el = $('#dialogue');
    this.active = false;
    this._advance = null;
    this.el.addEventListener('mousedown', (e) => { if (e.target.closest('.choices') || e.button !== 0) return; this._advance && this._advance(); });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (['Space', 'Enter', 'KeyE'].includes(e.code) && this._advance) { e.preventDefault(); this._advance(); }
      if (this._choiceKeys && /^Digit[1-9]$/.test(e.code)) { const n = +e.code.slice(5) - 1; this._choiceKeys[n] && this._choiceKeys[n](); }
      if (e.code === 'Escape' && this._choiceKeys && this._endFn) { e.preventDefault(); this._endFn(); }
    });
  }

  get g() { return this.inv.g; }

  async open(npcId) {
    const inv = this.inv, g = this.g;
    const data = inv.data.dialogue[npcId];
    const person = inv.data.people[npcId];
    const ch = inv.characters[npcId];
    if (!data || !ch) return;
    this.active = true; this.npcId = npcId; this.ch = ch; this.data = data;
    this.el.innerHTML = `
      <div class="who"><div class="nm">${esc(person.name)}</div><div class="rl">${esc(person.role)}${person.age ? ' — ' + person.age + ' عامًا' : ''}</div><div class="mood"></div></div>
      <div class="sub"></div><div class="cont"></div><div class="choices"></div>`;
    show(this.el, true);
    this.sub = this.el.querySelector('.sub'); this.cont = this.el.querySelector('.cont');
    this.choicesEl = this.el.querySelector('.choices'); this.moodEl = this.el.querySelector('.mood');
    if (g.cs.moods[npcId]) ch.setMood(g.cs.moods[npcId]);
    this._updateMood();
    await inv.enterDialogue(ch);
    await this.play(data.greet(g));
    if (data.afterGreet) data.afterGreet(g);
    if (!g.cs.metNpcs[npcId]) { g.cs.metNpcs[npcId] = true; g.saveSoon(); inv.refreshObjectives(); }
    this._closing = false;
    while (this.active && !this._closing) await this.menu();
    this.close();
  }

  _updateMood() {
    const m = this.ch.mood;
    this.moodEl.className = 'mood ' + m;
    this.moodEl.textContent = 'الحالة: ' + (MOOD_LABELS[m] || m);
  }

  setMood(m) {
    if (!m) return;
    this.ch.setMood(m);
    this.g.cs.moods[this.npcId] = m;
    this._updateMood();
  }

  // Plays a list of [speaker, text, mood?] lines with typewriter + lip sync.
  async play(lines) {
    if (!lines) return;
    show(this.choicesEl, false);
    for (const [spk, text, mood] of lines) {
      if (!this.active) return;
      if (mood && spk === 'npc') this.setMood(mood);
      const name = spk === 'npc' ? this.inv.data.people[this.npcId].name : spk === 'me' ? 'أنت' : '';
      this.sub.className = 'sub ' + (spk === 'me' ? 'me' : spk === 'narr' ? 'narr' : '');
      this.sub.innerHTML = (name ? `<span class="spk">${esc(name)}</span>` : '') + '<span class="tx"></span>';
      const tx = this.sub.querySelector('.tx');
      const cps = 15 * (this.inv.settings.textSpeed || 1);
      if (spk === 'npc') this.ch.speak(text, cps); else this.ch.setState('listen');
      this.cont.textContent = '';
      await this._typewrite(tx, text, spk === 'npc' ? cps : cps * 2.2);
      this.cont.innerHTML = 'انقر أو اضغط <kbd>Space</kbd> للمتابعة';
      await new Promise(r => { this._advance = () => { this._advance = null; r(); }; });
      this.ch.stopSpeaking();
      audio.click();
    }
    this.ch.setState('listen');
    this.cont.textContent = '';
  }

  _typewrite(el, text, cps) {
    return new Promise(res => {
      let i = 0, done = false;
      const chars = [...text];
      const finish = () => { if (done) return; done = true; el.textContent = text; clearInterval(iv); this._advance = null; res(); };
      this._advance = finish;
      const iv = setInterval(() => {
        i++;
        el.textContent = chars.slice(0, i).join('');
        if (i % 3 === 0) audio.typeTick();
        if (i >= chars.length) finish();
      }, 1000 / cps);
    });
  }

  async menu() {
    const g = this.g, data = this.data, npc = this.npcId;
    const topics = data.topics.filter(t => !t.when || t.when(g));
    this.sub.innerHTML = '';
    this.choicesEl.innerHTML = '';
    show(this.choicesEl, true);
    this._choiceKeys = [];
    let picked = null;
    const add = (label, cls, fn) => {
      const n = this._choiceKeys.length + 1;
      const b = h(`<button class="choice ${cls}"><span class="n">${n}</span>${esc(label)}</button>`);
      const go = () => { picked = fn; resolve(); };
      b.onclick = () => { audio.click(); go(); };
      b.onmouseenter = () => audio.hover();
      this._choiceKeys.push(go);
      this.choicesEl.appendChild(b);
    };
    let resolve; const p = new Promise(r => (resolve = r));
    for (const t of topics) {
      const seen = g.topicDone(npc, t.id);
      add(t.q, (t.accent ? 'accent ' : '') + (seen && !t.repeatable ? 'seen' : seen ? '' : 'new'), () => this.askTopic(t));
    }
    if (npc !== 'salim' || true) add('قدّم دليلًا أو إفادة…', 'special', () => this.present());
    this._endFn = () => { picked = () => { this._closing = true; }; resolve(); };
    add('إنهاء الحديث', '', () => { this._closing = true; });
    await p;
    this._choiceKeys = null; this._endFn = null;
    show(this.choicesEl, false);
    if (picked) await picked();
  }

  async askTopic(t) {
    const g = this.g, inv = this.inv;
    const lines = t.dynamic ? t.dynamic(g) : t.lines;
    await this.play([['me', t.q], ...lines]);
    g.markTopic(this.npcId, t.id);
    for (const s of t.gives || []) inv.gainStatement(s);
    if (t.mood) this.setMood(t.mood);
    const api = { openAccusation: () => { this._closing = true; inv.pendingAccusation = true; } };
    if (t.effect) t.effect(g, api);
    inv.refreshObjectives();
  }

  async present() {
    const inv = this.inv, g = this.g;
    const id = await openPicker({ title: 'واجه ' + inv.data.people[this.npcId].name, desc: 'اختر دليلًا أو إفادة لتعرضها عليه.', items: inv.itemsForPicker({ includePeople: false }) });
    if (!id) return;
    const pr = this.data.present;
    let r = pr[id];
    if (r && !Array.isArray(r) && r.when && !r.when(g)) {
      const alt = Object.keys(pr).find(k => k.startsWith(id + '__'));
      r = alt ? pr[alt] : null;
    }
    const isDefault = !r;
    if (!r) r = pr._default;
    if (Array.isArray(r)) r = { lines: r };
    const item = inv.itemInfo(id);
    const firstTime = !g.flag(`presented:${this.npcId}:${id}`);
    await this.play([['me', `انظر إلى هذا: ${item.name}.`], ...r.lines.slice(0, r.contradiction && firstTime ? 0 : undefined)]);
    if (r.contradiction && firstTime) {
      this.contradiction();
      inv.hud.toast('deduction', 'تناقض!', inv.itemInfo(r.contradiction).name || 'كذبة مكشوفة');
      g.log(`كشفت تناقضًا في أقوال ${inv.data.people[this.npcId].name}.`);
      await wait(1100);
      await this.play(r.lines);
    }
    g.setFlag(`presented:${this.npcId}:${id}`);
    if (r.mood) this.setMood(r.mood);
    for (const s of r.gives || []) inv.gainStatement(s);
    if (r.flag) g.setFlag(r.flag);
    if (r.contradiction && firstTime) g.cs.flags['lie:' + r.contradiction] = true;
    if (!isDefault) inv.refreshObjectives();
  }

  contradiction() {
    audio.contradiction();
    const s = h('<div class="contra">تناقض!</div>');
    this.el.appendChild(s);
    this.inv.renderer.flash = 0.35;
    setTimeout(() => s.remove(), 1600);
  }

  close() {
    if (!this.active) return;
    this.active = false;
    show(this.el, false);
    if (this.ch) this.ch.stopSpeaking();
    this.inv.exitDialogue(this.ch);
    if (this.inv.pendingAccusation) { this.inv.pendingAccusation = false; this.inv.openAccusation(); }
  }
}
