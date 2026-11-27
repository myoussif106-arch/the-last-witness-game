import { $, h, esc, show, KIND_LABEL, stars, wait } from './dom.js';
import { audio } from '../core/audio.js';
import { Telemetry } from '../core/telemetry.js';

export function scoreAccusation(data, answers, chosen) {
  const A = data.accusation;
  const parts = [];
  let total = 0;
  for (const q of A.questions) {
    const ok = answers[q.id] === q.correct;
    parts.push({ label: q.q, got: ok ? q.points : 0, max: q.points, ok });
    total += ok ? q.points : 0;
  }
  const E = A.evidence;
  let ep = 0; const hitGroups = [], missedGroups = [];
  for (const gr of E.groups) { if (gr.items.some(i => chosen.includes(i))) { ep += E.perGroup; hitGroups.push(gr.label); } else missedGroups.push(gr.label); }
  const mis = chosen.filter(i => E.misleading.includes(i));
  ep = Math.max(0, Math.min(E.points, ep) - mis.length * E.penalty);
  parts.push({ label: 'الأدلة', got: ep, max: E.points, ok: ep >= E.points * 0.6 });
  total += ep;
  const suspectOk = answers.suspect === A.questions.find(q => q.critical).correct;
  if (!suspectOk) total = Math.min(total, 25);
  const passed = suspectOk && total >= A.passScore;
  const rating = !passed ? 0 : total >= 90 ? 3 : total >= 72 ? 2 : 1;
  const label = !suspectOk ? 'اتهام خاطئ' : !passed ? 'أدلة غير كافية' : ['', 'مقبول', 'جيد جدًا', 'ممتاز'][rating];
  return { total, parts, passed, rating, label, suspectOk, hitGroups, missedGroups, misleading: mis };
}

export class AccuseUI {
  constructor(inv) { this.inv = inv; this.el = $('#accuse'); this.res = $('#result'); }

  open() {
    const inv = this.inv, A = inv.data.accusation;
    this.answers = {}; this.chosen = []; this.step = 0;
    this.steps = [...A.questions.map(q => ({ type: 'q', q })), { type: 'ev' }, { type: 'review' }];
    show(this.el, true);
    this.render();
    return new Promise(r => (this._resolve = r));
  }
  close(v) { show(this.el, false); this._resolve && this._resolve(v); }

  render() {
    const inv = this.inv, A = inv.data.accusation, s = this.steps[this.step];
    const N = this.steps.length;
    this.el.innerHTML = `<div class="box panel"><div class="steps">${this.steps.map((_, i) => `<i class="${i <= this.step ? 'on' : ''}"></i>`).join('')}</div><div class="body scroll"></div>
      <div class="nav"><div style="display:flex;gap:10px"><button class="btn" data-back>${this.step ? 'السابق' : 'تراجع عن الاتهام'}</button></div><div class="nxt"></div></div></div>`;
    const body = this.el.querySelector('.body'), nxt = this.el.querySelector('.nxt');
    this.el.querySelector('[data-back]').onclick = () => { audio.click(); if (this.step) { this.step--; this.render(); } else this.close(null); };
    if (s.type === 'q') {
      body.innerHTML = `<h2>${esc(s.q.q)}</h2><div class="sub">الخطوة ${this.step + 1} من ${N}</div><div class="opts"></div>`;
      const opts = body.querySelector('.opts');
      for (const o of s.q.options) {
        const img = s.q.id === 'suspect' ? inv.portraits[o.id] : null;
        const b = h(`<button class="opt ${this.answers[s.q.id] === o.id ? 'sel' : ''}">${img ? `<img src="${img}">` : ''}<span>${esc(o.t)}</span></button>`);
        b.onclick = () => { audio.click(); this.answers[s.q.id] = o.id; this.step++; this.render(); };
        opts.appendChild(b);
      }
    } else if (s.type === 'ev') {
      const max = A.evidence.max;
      body.innerHTML = `<h2>ما الأدلة التي تثبت اتهامك؟</h2><div class="sub">اختر حتى ${max} عناصر من ملف القضية. الأدلة غير المرتبطة أو المضللة تُضعف موقفك أمام النيابة.</div><div class="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px"></div>`;
      const grid = body.querySelector('.grid');
      const items = inv.itemsForPicker({ includePeople: false });
      const draw = () => {
        grid.innerHTML = '';
        for (const it of items) {
          const c = h(`<div class="card ${it.type} ${this.chosen.includes(it.id) ? 'sel' : ''}">${it.thumb ? `<img class="thumb" src="${it.thumb}">` : ''}${it.lie ? '<span class="lie">ثبت كذبها</span>' : ''}<div class="k">${esc(KIND_LABEL[it.kind] || '')}${it.by ? ' — ' + esc(it.by) : ''}</div><div class="n">${esc(it.name)}</div><div class="s">${esc(it.short || '')}</div></div>`);
          c.onclick = () => { audio.click(); const i = this.chosen.indexOf(it.id); if (i >= 0) this.chosen.splice(i, 1); else if (this.chosen.length < max) this.chosen.push(it.id); draw(); cnt.textContent = `${this.chosen.length} / ${max}`; };
          grid.appendChild(c);
        }
      };
      const cnt = h(`<span style="color:var(--ink-dim);margin-left:14px">${this.chosen.length} / ${max}</span>`);
      draw();
      const go = h('<button class="btn primary">التالي</button>'); go.onclick = () => { audio.click(); this.step++; this.render(); };
      nxt.append(cnt, go);
    } else {
      const story = A.narrate(this.answers);
      body.innerHTML = `<h2>روايتك لما حدث</h2><div class="sub">هذه هي القصة التي ستقدمها. راجعها جيدًا: لا تراجع بعد التقديم.</div>
        <div class="story">${esc(story)}</div>
        <div class="sub" style="margin-top:18px">الأدلة المقدمة:</div>
        <div class="chosen">${this.chosen.map(i => `<span>${esc(inv.itemInfo(i).name)}</span>`).join('') || '<span style="border-color:var(--red)">لا أدلة!</span>'}</div>`;
      const go = h('<button class="btn danger" style="font-size:20px;padding:12px 34px">قدّم الاتهام</button>');
      go.onclick = () => { audio.click(); this.submit(story); };
      nxt.appendChild(go);
    }
  }

  async submit(story) {
    const inv = this.inv;
    const r = scoreAccusation(inv.data, this.answers, this.chosen);
    show(this.el, false);
    const record = { t: Date.now(), answers: { ...this.answers }, evidence: [...this.chosen], score: r.total, rating: r.rating, label: r.label, passed: r.passed, story,
      summary: { score: r.total, rating: r.rating, label: r.label, story, truth: inv.data.accusation.truth } };
    inv.g.recordAccusation(record);
    Telemetry.track('accusation', inv.caseMeta.id, { score: r.total, passed: r.passed, rating: r.rating, suspect_ok: r.suspectOk, attempt: inv.g.cs.accusations.length });
    inv.refreshObjectives();
    await this.showResult(r, story);
  }

  async speakConfession(lines) {
    this._confessionToken = {};
    const token = this._confessionToken;
    await wait(1800);
    for (const [npc, text] of lines) {
      if (token !== this._confessionToken || this.res.classList.contains('hidden')) return;
      const buf = await this.inv.voiceBuffer(npc, text);
      if (!buf) return;
      await audio.playVoice(buf).ended;
      await wait(500);
    }
  }

  async showResult(r, story) {
    const inv = this.inv, A = inv.data.accusation;
    audio.stopMusic();
    audio.stinger(r.passed);
    const wrongText = !r.suspectOk ? A.wrong[this.answers.suspect] : null;
    this.res.innerHTML = `<div class="box scroll">
      <div class="stamp ${r.passed ? 'ok' : 'bad'}">${r.passed ? 'القضية محلولة' : !r.suspectOk ? 'اتهام خاطئ' : 'القضية لم تصمد'}</div>
      <div class="rating">${r.passed ? `<span class="stars">${stars(r.rating)}</span>التقييم: ${esc(r.label)}` : esc(r.label)} — ${r.total} / 100</div>
      <div class="score">${r.parts.map(p => `<div class="b"><div class="v ${p.ok ? 'ok' : 'no'}">${p.got}/${p.max}</div><div class="l">${esc(p.label)}</div></div>`).join('')}</div>
      ${r.passed ? `
        <h3>ما حدث فعلًا</h3><div class="story">${A.truth.map(t => `<p>${esc(t)}</p>`).join('')}</div>
        <h3>اعتراف ${esc(inv.data.people[A.questions[0].correct].name)}</h3>
        ${A.confession.map(([, t]) => `<div class="confess">«${esc(t)}»</div>`).join('')}
        ${r.missedGroups.length || r.misleading.length ? `<h3>ملاحظات على ملفك</h3><div class="missed">${r.missedGroups.length ? 'جوانب لم تدعمها بالأدلة: ' + r.missedGroups.map(esc).join('، ') + '.' : ''} ${r.misleading.length ? '<br>أدلة مضللة أضعفت ملفك: ' + r.misleading.map(i => esc(inv.itemInfo(i).name)).join('، ') + '.' : ''}</div>` : ''}
      ` : `
        <h3>نتيجة قرارك</h3>
        <div class="story"><p>${esc(wrongText || 'المتهم كان الشخص الصحيح، لكن روايتك وأدلتك لم تصمد أمام النيابة. أُفرج عنه لعدم كفاية الأدلة، وأُعيد الملف إليك.')}</p></div>
        <div class="missed" style="margin-top:12px">يمكنك العودة إلى مسرح التحقيق ومراجعة الأدلة والأقوال، ثم تقديم اتهام جديد. أفضل تقييم ممكن يتطلب استنتاجًا منطقيًا كاملًا.</div>
      `}
      <div class="actions"></div></div>`;
    show(this.res, true);
    if (r.passed) this.speakConfession(A.confession);
    const actions = this.res.querySelector('.actions');
    return new Promise(resolve => {
      const btn = (t, cls, fn) => { const b = h(`<button class="btn ${cls}">${t}</button>`); b.onclick = () => { audio.click(); audio.stopVoice(); this._confessionToken = null; show(this.res, false); fn(); resolve(); this.close(true); }; actions.appendChild(b); };
      if (r.passed) {
        btn('العودة إلى القائمة الرئيسية', 'primary', () => inv.app.toMenu());
        btn('أكمل استكشاف المكان', '', () => inv.resume());
      } else {
        btn('أعد النظر في الأدلة', 'primary', () => inv.resume());
        btn('القائمة الرئيسية', '', () => inv.app.toMenu());
      }
    });
  }
}
