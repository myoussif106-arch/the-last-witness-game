import { $, h, esc, show, stars } from './dom.js';
import { audio } from '../core/audio.js';
import { CASES } from '../cases/index.js';
import { QUALITY_LABELS, DEFAULT_SETTINGS } from '../core/settings.js';

export function renderMainMenu(app) {
  const g = app.game;
  const el = $('#menu');
  const cur = g.data.current && CASES.find(c => c.id === g.data.current);
  el.innerHTML = `
    <canvas id="menu-rain" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas>
    <div class="menu-left" style="position:relative">
      <div class="logo-ar">الشاهد<br><span>الأخير</span></div>
      <div class="logo-en">THE LAST WITNESS</div>
      <div class="items">
        <button class="item" data-a="continue" ${g.hasContinue ? '' : 'disabled'}>استكمال التحقيق${cur && g.hasContinue ? `<span class="sub">القضية ${cur.num}: ${esc(cur.title)}</span>` : ''}</button>
        <button class="item" data-a="new">بدء اللعبة</button>
        <button class="item" data-a="cases">اختيار القضية</button>
        <button class="item" data-a="settings">الإعدادات</button>
        <button class="item" data-a="credits">عن اللعبة</button>
        ${window.native ? '<button class="item" data-a="quit">خروج</button>' : ''}
      </div>
      <div class="foot">التقدم يُحفظ تلقائيًا • <span id="ver">${window.native ? 'نسخة سطح المكتب' : 'نسخة اختبار'}</span></div>
    </div>
    <div class="cases scroll" style="position:relative"></div>`;
  const panel = el.querySelector('.cases');
  renderCaseList(app, panel);
  el.querySelectorAll('[data-a]').forEach(b => {
    b.onmouseenter = () => audio.hover();
    b.onclick = () => {
      audio.init(); audio.resume(); audio.click();
      const a = b.dataset.a;
      if (a === 'continue') app.startCase(g.data.current, false);
      else if (a === 'new') {
        const first = CASES[0];
        const cp = g.caseProgress(first.id);
        if (cp.state) { confirmModal('لديك تقدم محفوظ في القضية الأولى. هل تريد البدء من جديد؟ سيُمحى تقدمك في هذه القضية.').then(ok => ok && app.startCase(first.id, true)); return; }
        app.startCase(first.id, true);
      }
      else if (a === 'cases') panel.scrollIntoView({ behavior: 'smooth' });
      else if (a === 'settings') app.openSettings();
      else if (a === 'credits') showCredits();
      else if (a === 'quit') window.native.quit();
    };
  });
  startMenuRain(el.querySelector('#menu-rain'));
  if (window.native && window.native.updateInfo) window.native.updateInfo().then(info => {
    const v = el.querySelector('#ver'); if (v) v.textContent = 'الإصدار ' + info.version;
    if (info.enabled && !updateChecked) { updateChecked = true; checkForUpdates(false); }
  });
}

function renderCaseList(app, panel) {
  const g = app.game;
  panel.innerHTML = '<h2>ملفات القضايا</h2><div class="case-list"></div>';
  const list = panel.querySelector('.case-list');
  for (const c of CASES) {
    const cp = g.caseProgress(c.id);
    const locked = !cp.unlocked;
    const soon = !c.module;
    const st = locked ? '🔒 مغلقة' : soon ? 'قيد الإعداد' : cp.solved ? `<span class="stars">${stars(cp.bestRating || 0)}</span><br>محلولة — ${cp.bestScore}/100` : cp.state ? 'قيد التحقيق' : 'جديدة';
    const card = h(`<div class="case-card ${locked ? 'locked' : ''} ${soon ? 'soon' : ''}">
      <div class="num">${c.num}</div>
      <div><div class="ttl">${esc(c.title)}</div><div class="tz">${locked ? 'حلّ القضية السابقة لفتح هذا الملف.' : esc(c.teaser)}</div>
        <div class="diff">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= c.difficulty ? 'on' : ''}"></i>`).join('')}</div></div>
      <div class="st">${st}</div></div>`);
    if (!locked) card.onclick = () => { audio.init(); audio.resume(); audio.click(); caseDialog(app, c); };
    card.onmouseenter = () => !locked && audio.hover();
    list.appendChild(card);
  }
}

function caseDialog(app, c) {
  const g = app.game, cp = g.caseProgress(c.id);
  if (!c.module) {
    modal(`<h3 style="font-family:var(--title);font-size:28px;margin:0">القضية ${c.num}: ${esc(c.title)}</h3><p style="font-size:17px;line-height:1.9;color:var(--ink-dim)">${esc(c.teaser)}</p><p style="color:var(--gold)">ملف هذه القضية ما زال قيد الإعداد وسيُضاف في تحديث قادم.</p>`, [['حسنًا', 'primary', () => {}]]);
    return;
  }
  const btns = [];
  if (cp.state) btns.push(['استكمال التحقيق', 'primary', () => app.startCase(c.id, false)]);
  btns.push([cp.state ? 'إعادة القضية من البداية' : 'ابدأ التحقيق', cp.state ? '' : 'primary', () => { if (!cp.state) return app.startCase(c.id, true); confirmModal('سيُمحى تقدمك الحالي في هذه القضية. متأكد؟').then(ok => ok && app.startCase(c.id, true)); }]);
  if (cp.solved && cp.summary) btns.push(['ملخص القضية', '', () => showSummary(c, cp)]);
  btns.push(['إلغاء', '', () => {}]);
  modal(`<h3 style="font-family:var(--title);font-size:30px;margin:0">القضية ${c.num}: ${esc(c.title)}</h3>
    <p style="font-size:17px;line-height:1.9;color:var(--ink-dim)">${esc(c.teaser)}</p>
    ${cp.solved ? `<p style="color:var(--gold)">${stars(cp.bestRating || 0)} أفضل نتيجة: ${cp.bestScore}/100 — المحاولات: ${cp.attempts}</p>` : ''}`, btns);
}

function showSummary(c, cp) {
  const s = cp.summary;
  modal(`<h3 style="font-family:var(--title);font-size:30px;margin:0">ملخص القضية ${c.num}: ${esc(c.title)}</h3>
    <p style="color:var(--gold)">${stars(s.rating)} ${esc(s.label)} — ${s.score}/100</p>
    <div style="font-family:var(--doc);font-size:19px;line-height:1.9;background:var(--paper);color:var(--paper-ink);padding:16px 22px;margin-bottom:12px">${esc(s.story)}</div>
    <div style="font-family:var(--doc);font-size:17px;line-height:1.85;color:var(--ink-dim)">${(s.truth || []).map(esc).join('<br>')}</div>`, [['إغلاق', 'primary', () => {}]], 820);
}

export function modal(html, buttons, width = 640) {
  const m = h(`<div class="picker" style="z-index:70"><div class="box panel scroll" style="width:min(${width}px,90vw)">${html}<div class="btns" style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"></div></div></div>`);
  const bw = m.querySelector('.btns');
  for (const [t, cls, fn] of buttons) { const b = h(`<button class="btn ${cls}">${esc(t)}</button>`); b.onclick = () => { audio.click(); m.remove(); fn(); }; bw.appendChild(b); }
  document.body.appendChild(m);
  return m;
}

export function confirmModal(text) {
  return new Promise(res => modal(`<p style="font-size:19px;line-height:1.9;margin:0">${esc(text)}</p>`, [['نعم، تابع', 'danger', () => res(true)], ['إلغاء', '', () => res(false)]], 560));
}

// ---------------------------------------------------------------- updates
let updateChecked = false;
export async function checkForUpdates(manual) {
  if (!window.native || !window.native.checkUpdate) return;
  const wait = manual ? modal('<p style="font-size:18px;margin:0">جارٍ البحث عن تحديثات…</p>', [], 480) : null;
  const r = await window.native.checkUpdate();
  if (wait) wait.remove();
  if (r.error) { if (manual) modal(`<p style="font-size:18px;line-height:1.9;margin:0">تعذّر الاتصال بخادم التحديثات. تأكد من اتصالك بالإنترنت وحاول لاحقًا.</p>`, [['حسنًا', 'primary', () => {}]], 520); return; }
  if (!r.available) { if (manual) modal(`<p style="font-size:18px;line-height:1.9;margin:0">لديك أحدث إصدار من اللعبة (${esc(r.current)}).</p>`, [['حسنًا', 'primary', () => {}]], 480); return; }
  const mb = Math.max(1, Math.round(r.size / 1048576));
  modal(`<h3 style="font-family:var(--ui);font-weight:800;font-size:26px;margin:0 0 6px">يتوفر تحديث جديد</h3>
    <p style="color:var(--gold);margin:0 0 10px">الإصدار ${esc(r.version)} — حجم التنزيل نحو ${mb} ميجابايت</p>
    ${r.notes ? `<p style="font-size:16.5px;line-height:1.9;white-space:pre-wrap;color:var(--ink-dim)">${esc(r.notes)}</p>` : ''}
    <p style="font-size:15px;color:var(--ink-dim)">تقدمك المحفوظ لن يتأثر.</p>`,
    [['حدّث الآن', 'primary', () => runUpdate(r)], ['لاحقًا', '', () => {}]], 620);
}

async function runUpdate(r) {
  const m = modal(`<h3 style="font-family:var(--ui);font-weight:800;font-size:24px;margin:0 0 14px">جارٍ تنزيل الإصدار ${esc(r.version)}</h3>
    <div class="load-bar"><div style="width:0%"></div></div><p class="pct" style="color:var(--ink-dim);margin-top:10px">0%</p>`, [], 560);
  const bar = m.querySelector('.load-bar div'), pct = m.querySelector('.pct');
  const res = await window.native.downloadUpdate(p => { bar.style.width = Math.round(p * 100) + '%'; pct.textContent = Math.round(p * 100) + '%'; });
  m.remove();
  if (res && res.error) { modal(`<p style="font-size:18px;line-height:1.9;margin:0">فشل التحديث: ${esc(res.error)}<br>حاول مرة أخرى لاحقًا.</p>`, [['حسنًا', 'primary', () => {}]], 560); return; }
  modal(`<p style="font-size:19px;line-height:1.9;margin:0">اكتمل التحديث إلى الإصدار ${esc(r.version)}. ستُعاد تشغيل اللعبة الآن.</p>`, [['إعادة التشغيل', 'primary', () => window.native.restartForUpdate()]], 520);
}

function showCredits() {
  modal(`<h3 style="font-family:var(--title);font-size:30px;margin:0 0 10px">الشاهد الأخير</h3>
  <p style="line-height:1.9;color:var(--ink-dim)">لعبة تحقيق ثلاثية الأبعاد من منظور الشخص الأول.</p>
  <p style="line-height:1.95;font-size:16px">أنت محقق تُستدعى إلى أماكن الجرائم الغامضة: شقق مغلقة، مكاتب، فنادق، وقصور قديمة.
  تفحّص المكان بنفسك، اجمع الأدلة، استجوب الشهود والمشتبه بهم، وواجههم بما وجدت.
  اربط الخيوط على لوحة التحقيق، اكشف الأكاذيب والتناقضات، ثم قدّم اتهامك: من الفاعل؟ وكيف؟ ولماذا؟</p>
  <p style="line-height:1.95;font-size:16px">كل قضية قصة مستقلة بأماكنها وشخصياتها وأسرارها، وتزداد الصعوبة من قضية إلى أخرى،
  حتى تصل إلى القضية الأخيرة حيث تلتقي كل الخيوط عند شاهد واحد.</p>
  <p style="color:var(--ink-dim);font-size:14px">التحكم: الفأرة للنظر • W A S D للحركة • Shift للإسراع • C للانحناء • E للتفاعل • Tab ملف القضية • B لوحة التحقيق • F حاسة المحقق • Esc إيقاف مؤقت</p>`, [['إغلاق', 'primary', () => {}], ...(window.native && window.native.checkUpdate ? [['البحث عن تحديثات', '', () => checkForUpdates(true)]] : [])], 720);
}

let rainRAF = 0;
function startMenuRain(cv) {
  cancelAnimationFrame(rainRAF);
  const ctx = cv.getContext('2d');
  const drops = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.4, l: 10 + Math.random() * 22 }));
  let lightning = 0;
  const loop = () => {
    if (!document.body.contains(cv) || $('#menu').classList.contains('hidden')) return;
    cv.width = cv.clientWidth; cv.height = cv.clientHeight;
    const W = cv.width, H = cv.height;
    if (Math.random() < 0.002) lightning = 1;
    ctx.fillStyle = `rgba(180,200,230,${lightning * 0.15})`; ctx.fillRect(0, 0, W, H); lightning *= 0.9;
    ctx.strokeStyle = 'rgba(170,190,215,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of drops) {
      d.y += 0.012 * d.s; d.x -= 0.0015 * d.s; if (d.y > 1) { d.y = -0.05; d.x = Math.random() * 1.1; }
      ctx.moveTo(d.x * W, d.y * H); ctx.lineTo(d.x * W - 3, d.y * H + d.l * d.s);
    }
    ctx.stroke();
    rainRAF = requestAnimationFrame(loop);
  };
  loop();
}

// ---------------------------------------------------------------- settings
export function renderSettings(app, onClose) {
  const s = app.game.settings;
  const el = $('#settings');
  let tab = 'audio';
  const draw = () => {
    el.innerHTML = `<div class="box panel scroll"><h2>الإعدادات</h2>
      <div class="tabs">${[['audio', 'الصوت'], ['controls', 'التحكم'], ['graphics', 'الرسومات'], ['game', 'اللعب']].map(([k, l]) => `<div class="tab ${k === tab ? 'on' : ''}" data-t="${k}">${l}</div>`).join('')}</div>
      <div class="rows"></div>
      <div class="settings-actions"><button class="btn primary" data-close>حفظ وإغلاق</button><button class="btn" data-reset>استعادة الافتراضي</button>${tab === 'game' ? '<button class="btn danger" data-wipe>حذف كل التقدم</button>' : ''}</div></div>`;
    el.querySelectorAll('.tab').forEach(t => t.onclick = () => { audio.click(); tab = t.dataset.t; draw(); });
    const rows = el.querySelector('.rows');
    const slider = (key, label, min, max, step, fmt = v => Math.round(v * 100) + '%') => {
      const r = h(`<div class="row"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}"><div class="val">${fmt(s[key])}</div></div>`);
      const inp = r.querySelector('input'); inp.oninput = () => { s[key] = +inp.value; r.querySelector('.val').textContent = fmt(s[key]); app.applySettings(); };
      rows.appendChild(r);
    };
    const seg = (key, label, opts) => {
      const r = h(`<div class="row"><label>${label}</label><div class="seg">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div><div></div></div>`);
      r.querySelectorAll('button').forEach(b => b.onclick = () => { audio.click(); const v = b.dataset.v; s[key] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; draw(); app.applySettings(key); });
      rows.appendChild(r);
    };
    if (tab === 'audio') {
      slider('master', 'الصوت العام', 0, 1, 0.01); slider('music', 'الموسيقى', 0, 1, 0.01); slider('sfx', 'المؤثرات', 0, 1, 0.01); slider('ambient', 'أصوات البيئة', 0, 1, 0.01);
    } else if (tab === 'controls') {
      slider('sensitivity', 'حساسية الفأرة', 0.2, 3, 0.05, v => v.toFixed(2)); seg('invertY', 'عكس المحور الرأسي', [[false, 'لا'], [true, 'نعم']]); seg('headBob', 'اهتزاز الكاميرا أثناء المشي', [[true, 'مفعّل'], [false, 'معطّل']]);
      rows.appendChild(h(`<div class="row" style="grid-template-columns:1fr"><div style="color:var(--ink-dim);line-height:2;font-size:15px">W A S D: الحركة • Shift: الإسراع • C: الانحناء • E: التفاعل والتحدث • Tab: ملف القضية • B: لوحة التحقيق • F: حاسة المحقق • Esc: إيقاف مؤقت • Space/E/نقرة: متابعة الحوار • 1-9: اختيار سؤال</div></div>`));
    } else if (tab === 'graphics') {
      seg('quality', 'جودة الرسومات', Object.entries(QUALITY_LABELS)); seg('shadows', 'الظلال', [[true, 'مفعّلة'], [false, 'معطّلة']]); seg('postfx', 'المؤثرات السينمائية', [[true, 'مفعّلة'], [false, 'معطّلة']]);
      slider('fov', 'مجال الرؤية', 55, 95, 1, v => Math.round(v) + '°');
      if (window.native) seg('fullscreen', 'ملء الشاشة', [[true, 'نعم'], [false, 'لا']]);
    } else {
      slider('textSpeed', 'سرعة نص الحوار', 0.5, 2.5, 0.1, v => v.toFixed(1) + '×'); seg('hints', 'تلميحات المساعدة', [[true, 'مفعّلة'], [false, 'معطّلة']]);
    }
    el.querySelector('[data-close]').onclick = () => { audio.click(); show(el, false); app.game.saveNow(); onClose && onClose(); };
    el.querySelector('[data-reset]').onclick = () => { audio.click(); Object.assign(s, DEFAULT_SETTINGS); app.applySettings('quality'); draw(); };
    const wipe = el.querySelector('[data-wipe]');
    if (wipe) wipe.onclick = async () => { if (!(await confirmModal('سيُحذف كل تقدمك في جميع القضايا نهائيًا. هل أنت متأكد؟'))) return; await app.game.resetAll(); show(el, false); if (app.inv) app.toMenu(); else app.toMenu(true); };
  };
  draw();
  show(el, true);
}

export function renderPause(app, inv) {
  const el = $('#pause');
  el.innerHTML = `<div class="box"><h2>إيقاف مؤقت</h2>
    <button class="btn primary" data-a="resume">متابعة التحقيق</button>
    <button class="btn" data-a="file">ملف القضية</button>
    <button class="btn" data-a="board">لوحة التحقيق</button>
    <button class="btn" data-a="settings">الإعدادات</button>
    <button class="btn" data-a="menu">حفظ والعودة إلى القائمة</button>
    ${window.native ? '<button class="btn danger" data-a="quit">حفظ والخروج من اللعبة</button>' : ''}</div>`;
  show(el, true);
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    audio.click();
    const a = b.dataset.a;
    if (a === 'settings') { renderSettings(app, () => {}); return; }
    show(el, false); app.paused = false;
    if (a === 'resume') inv.resume();
    else if (a === 'file') { inv.mode = 'play'; inv.openCaseFile(); }
    else if (a === 'board') { inv.mode = 'play'; inv.openBoard(); }
    else if (a === 'menu') app.toMenu();
    else if (a === 'quit') { inv.stop(); await app.game.saveNow(); window.native.quit(); }
  });
}
