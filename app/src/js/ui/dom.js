export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const show = (el, on = true) => el.classList.toggle('hidden', !on);
export const KIND_LABEL = { object: 'دليل مادي', document: 'مستند', observation: 'ملاحظة', statement: 'إفادة', deduction: 'استنتاج', person: 'شخص' };
export const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
export const wait = (ms) => new Promise(r => setTimeout(r, ms));
