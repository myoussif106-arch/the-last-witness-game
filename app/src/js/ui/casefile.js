import { $, h, esc, show, KIND_LABEL } from './dom.js';
import { audio } from '../core/audio.js';

// The in-game case folder: evidence, people, statements, deductions, notes, status.
export class CaseFileUI {
  constructor(inv) { this.inv = inv; this.el = $('#casefile'); this.active = false; this.tab = 'evidence'; this.sel = {}; }

  open(tab) {
    if (tab) this.tab = tab;
    this.active = true; audio.paper();
    show(this.el, true);
    this.render();
    return new Promise(r => (this._resolve = r));
  }
  close() {
    if (!this.active) return;
    const ta = this.el.querySelector('textarea'); if (ta) { this.inv.g.cs.notes = ta.value; this.inv.g.saveSoon(); }
    this.active = false; show(this.el, false); audio.paper();
    this._resolve && this._resolve();
  }

  render() {
    const inv = this.inv, g = inv.g, cs = g.cs, d = inv.data;
    const ev = Object.keys(cs.evidence), st = Object.keys(cs.statements), dd = Object.keys(cs.deductions);
    const met = Object.keys(d.people).filter(p => cs.metNpcs[p] || p === 'hassan');
    const tabs = [['status', 'حالة التحقيق', ''], ['evidence', 'الأدلة', ev.length], ['people', 'الأشخاص', met.length], ['statements', 'الأقوال', st.length], ['deductions', 'الاستنتاجات', dd.length], ['notes', 'ملاحظات المحقق', '']];
    this.el.innerHTML = `<div class="folder">
      <div class="x-close">✕ إغلاق (Tab)</div>
      <div class="fhead"><div class="ttl">${esc(d.meta.title)}<small>ملف القضية رقم ${inv.caseMeta.num}</small></div>
      ${tabs.map(([k, l, c]) => `<div class="ftab ${k === this.tab ? 'on' : ''}" data-t="${k}">${l}${c !== '' ? `<span class="cnt">(${c})</span>` : ''}</div>`).join('')}</div>
      <div class="fbody"></div></div>`;
    this.el.querySelector('.x-close').onclick = () => this.close();
    this.el.querySelectorAll('.ftab').forEach(t => t.onclick = () => { audio.paper(); this.tab = t.dataset.t; this.render(); });
    const body = this.el.querySelector('.fbody');
    const T = this.tab;
    if (T === 'evidence') this.listDetail(body, ev, id => {
      const e = d.evidence[id]; return { n: e.name, s: e.short, html: `
        ${inv.thumbs[id] ? `<img class="portrait" src="${inv.thumbs[id]}">` : ''}
        <h3>${esc(e.name)}</h3><div class="meta">${KIND_LABEL[e.kind]} — ${esc(e.where)}</div>
        <p>${esc(e.text)}</p>
        ${(cs.evidence[id].details || []).map(did => { const dt = e.details.find(x => x.id === did); return dt ? `<div class="stmt"><b style="color:var(--gold)">${esc(dt.label)}:</b> ${esc(dt.text)}</div>` : ''; }).join('')}
        ${e.doc ? `<div class="stmt" style="font-family:var(--doc);white-space:pre-wrap">${esc(e.doc.body)}</div>` : ''}
        ${id === 'ev_notepad' && cs.evidence[id].details.includes('rubbed') ? `<div class="stmt" style="font-family:var(--hand);font-size:20px;white-space:pre-wrap">${esc(e.rub)}</div>` : ''}
        <div style="margin-top:18px"><button class="btn" data-reinspect="${id}">افحص مرة أخرى</button></div>` };
    }, 'لم تجد أي دليل بعد. فتّش المكان وتفاعل مع الأشياء بزر E.');
    else if (T === 'people') this.listDetail(body, met, id => {
      const p = d.people[id];
      const says = Object.keys(cs.statements).filter(s => d.statements[s].by === id);
      return { n: p.name, s: p.role, html: `
        ${inv.portraits[id] ? `<img class="portrait" src="${inv.portraits[id]}">` : ''}
        <h3>${esc(p.name)}</h3><div class="meta">${esc(p.role)} — ${p.age} عامًا ${p.suspect ? '— <span style="color:var(--red-hi)">مشتبه به</span>' : ''}</div>
        <p>${esc(p.bio)}</p>
        <div class="meta" style="margin-top:14px">أقواله المسجلة</div>
        ${says.length ? says.map(s => this.stmtHTML(s)).join('') : '<div class="empty" style="padding:8px;text-align:right">لم يُسجَّل له شيء بعد.</div>'}` };
    }, '');
    else if (T === 'statements') this.listDetail(body, met.filter(p => Object.keys(cs.statements).some(s => d.statements[s].by === p)), id => {
      const p = d.people[id]; const says = Object.keys(cs.statements).filter(s => d.statements[s].by === id);
      return { n: p.name, s: says.length + ' إفادة', html: `<h3>أقوال ${esc(p.name)}</h3><div class="meta">${esc(p.role)}</div>${says.map(s => this.stmtHTML(s)).join('')}` };
    }, 'لم تسجّل أي أقوال بعد. تحدّث إلى الموجودين.');
    else if (T === 'deductions') this.listDetail(body, dd, id => {
      const x = d.deductions[id]; return { n: x.name, s: x.contradiction ? 'تناقض' : 'استنتاج', html: `<h3>${esc(x.name)}</h3><div class="meta">${x.contradiction ? 'تناقض مكشوف' : 'استنتاج من لوحة التحقيق'}</div><p>${esc(x.text)}</p>
        <div class="meta">بُني على:</div>${[...x.a, ...x.b].filter(i => g.has(i)).map(i => `<div class="stmt">${esc(inv.itemInfo(i).name)}</div>`).join('')}` };
    }, 'لا استنتاجات بعد. افتح لوحة التحقيق (B) واربط بين الأدلة والإفادات.');
    else if (T === 'notes') {
      body.innerHTML = `<div class="list scroll" style="width:430px"><div class="meta" style="color:var(--gold);margin-bottom:6px">سجل المحقق</div>${cs.log.slice().reverse().map(l => `<div class="log-item">${esc(l.text)}</div>`).join('') || '<div class="empty">لا شيء بعد.</div>'}</div>
        <div class="detail" style="padding:20px"><div class="meta" style="color:var(--gold);margin-bottom:8px">ملاحظاتك الخاصة (تُحفظ تلقائيًا)</div><textarea placeholder="اكتب أفكارك هنا...">${esc(cs.notes)}</textarea></div>`;
      const ta = body.querySelector('textarea'); ta.onkeydown = e => e.stopPropagation(); ta.oninput = () => { cs.notes = ta.value; g.saveSoon(1500); };
    } else if (T === 'status') {
      const total = Object.keys(d.evidence).length;
      const objs = d.objectives.map(o => ({ ...o, ok: o.done(g) }));
      const lies = Object.keys(cs.flags).filter(f => f.startsWith('lie:')).length;
      body.innerHTML = `<div class="detail scroll">
        <h3>${esc(d.meta.title)}</h3><div class="meta">${esc(d.meta.location)} — ${esc(d.meta.time)}</div>
        <div class="prog"><div class="b"><div class="v">${ev.length}<small style="font-size:16px;color:var(--ink-dim)">/${total}</small></div><div class="l">أدلة مكتشفة</div></div>
        <div class="b"><div class="v">${st.length}</div><div class="l">إفادات مسجلة</div></div>
        <div class="b"><div class="v">${dd.length}</div><div class="l">استنتاجات</div></div>
        <div class="b"><div class="v">${lies}</div><div class="l">أكاذيب مكشوفة</div></div></div>
        <div class="meta">مهام التحقيق</div>
        ${objs.map(o => `<div class="stmt" style="border-color:${o.ok ? 'var(--green)' : 'var(--gold)'};${o.ok ? 'opacity:.6;text-decoration:line-through' : ''}">${esc(o.text)}</div>`).join('')}
        <div class="meta" style="margin-top:20px">ملخص القضية</div>
        <p style="font-family:var(--doc);font-size:19px">${d.meta.intro.map(esc).join(' ')}</p>
        ${cs.accusations.length ? `<div class="meta">محاولات الاتهام: ${cs.accusations.length} — أفضل نتيجة: ${Math.max(...cs.accusations.map(a => a.score))}/100</div>` : ''}
        <div style="margin-top:20px;display:flex;gap:10px"><button class="btn" data-open-board>افتح لوحة التحقيق</button>
        ${ev.length >= 4 ? '<button class="btn danger" data-accuse>قدّم استنتاجك النهائي</button>' : '<span style="color:var(--ink-faint);align-self:center;font-size:14px">اجمع أدلة أكثر قبل تقديم الاتهام.</span>'}</div>
      </div>`;
      body.querySelector('[data-open-board]').onclick = () => { this.next = 'board'; this.close(); };
      const ac = body.querySelector('[data-accuse]'); if (ac) ac.onclick = () => { this.next = 'accuse'; this.close(); };
    }
    body.querySelectorAll('[data-reinspect]').forEach(b => b.onclick = () => { this.next = 'inspect:' + b.dataset.reinspect; this.close(); });
  }

  stmtHTML(s) {
    const st = this.inv.data.statements[s];
    const proven = this.inv.g.cs.flags['lie:' + s];
    return `<div class="stmt ${proven ? 'lie' : ''}">«${esc(st.text)}»${proven ? '<span class="tag">ثبت أنها كاذبة</span>' : ''}</div>`;
  }

  listDetail(body, ids, fn, emptyText) {
    if (!ids.length) { body.innerHTML = `<div class="empty" style="flex:1">${esc(emptyText)}</div>`; return; }
    const T = this.tab;
    if (!ids.includes(this.sel[T])) this.sel[T] = ids[ids.length - 1];
    const list = h('<div class="list scroll"></div>'); const det = h('<div class="detail scroll"></div>');
    for (const id of ids) {
      const x = fn(id);
      const li = h(`<div class="li ${id === this.sel[T] ? 'on' : ''}"><div class="n">${esc(x.n)}</div><div class="s">${esc(x.s)}</div></div>`);
      li.onclick = () => { audio.click(); this.sel[T] = id; this.render(); };
      list.appendChild(li);
    }
    det.innerHTML = fn(this.sel[T]).html;
    body.append(list, det);
  }
}
