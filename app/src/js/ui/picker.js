import { h, esc, KIND_LABEL } from './dom.js';
import { audio } from '../core/audio.js';

// Generic evidence / statement / deduction picker.
// items: [{id, type:'ev'|'st'|'dd'|'p', kind, name, short, thumb, lie}]
export function openPicker({ title, desc = '', items, multi = false, max = 1, preselect = [], confirmText = 'تأكيد', cancelText = 'إلغاء' }) {
  return new Promise(resolve => {
    const sel = new Set(preselect);
    const filters = [['all', 'الكل'], ['ev', 'الأدلة'], ['st', 'الإفادات'], ['dd', 'الاستنتاجات']].filter(([k]) => k === 'all' || items.some(i => i.type === k));
    let filter = 'all';
    const root = h(`<div class="picker"><div class="box panel">
      <h3>${esc(title)}</h3><div class="desc">${esc(desc)}</div>
      <div class="ftabs seg">${filters.map(([k, l]) => `<button data-f="${k}" class="${k === 'all' ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="grid scroll"></div>
      <div style="display:flex;gap:10px;margin-top:16px;align-items:center">
        ${multi ? `<button class="btn primary ok">${esc(confirmText)}</button>` : ''}
        <button class="btn cancel">${esc(cancelText)}</button>
        ${multi ? `<span class="count" style="color:var(--ink-dim);font-size:14px"></span>` : ''}
      </div></div></div>`);
    const grid = root.querySelector('.grid');
    const render = () => {
      grid.innerHTML = '';
      const list = items.filter(i => filter === 'all' || i.type === filter);
      if (!list.length) grid.innerHTML = '<div style="color:var(--ink-faint);padding:20px">لا شيء هنا بعد.</div>';
      for (const it of list) {
        const c = h(`<div class="card ${it.type} ${sel.has(it.id) ? 'sel' : ''}">
          ${it.thumb ? `<img class="thumb" src="${it.thumb}">` : ''}
          ${it.lie ? '<span class="lie">ثبت كذبها</span>' : ''}
          <div class="k">${esc(KIND_LABEL[it.kind] || '')}${it.by ? ' — ' + esc(it.by) : ''}</div>
          <div class="n">${esc(it.name)}</div><div class="s">${esc(it.short || '')}</div></div>`);
        c.onmouseenter = () => audio.hover();
        c.onclick = () => {
          audio.click();
          if (!multi) { close(it.id); return; }
          if (sel.has(it.id)) sel.delete(it.id); else if (sel.size < max) sel.add(it.id);
          render();
        };
        grid.appendChild(c);
      }
      const cnt = root.querySelector('.count'); if (cnt) cnt.textContent = `${sel.size} / ${max}`;
    };
    root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; root.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); render(); });
    const close = (v) => { root.remove(); window.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e) => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(multi ? null : null); } };
    window.addEventListener('keydown', onKey, true);
    root.querySelector('.cancel').onclick = () => { audio.click(); close(null); };
    const ok = root.querySelector('.ok'); if (ok) ok.onclick = () => { audio.click(); close([...sel]); };
    document.body.appendChild(root);
    render();
  });
}
