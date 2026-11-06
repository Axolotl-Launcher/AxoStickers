// 自绘的下拉框（uiSelect）和菜单（openMenu）：各平台长得一样，和网站一个调；键盘、读屏照常能用。
// 弹层用 popover 放进顶层，在 <dialog> 里打开也盖得住；它挂在触发它的弹窗里（模态弹窗外面的东西是点不动的）。
// 打开期间每帧跟着触发它的按钮走（滚动、重排都跟得上）；按钮被重画掉了就自己关上。
import { el } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
function svg(d, cls) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', cls);
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.append(p);
  return s;
}
const chevron = () => svg('M6 9l6 6 6-6', 'ui-chev');
const tick = () => svg('M5 12.5l4.5 4.5L19 7', 'ui-tick');
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
let uid = 0;

// ---------------- 弹层 ----------------
let cur = null;                                                // 正开着的那个：{ pop, anchor, close }
export function closePopups() { cur?.close(); }

function place(anchor, pop, side) {
  const r = anchor.getBoundingClientRect(), m = 8;
  pop.style.maxHeight = '';
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const below = innerHeight - r.bottom - m, above = r.top - m;
  let top = r.bottom + 4;
  if (h > below && above > below) { top = Math.max(m, r.top - 4 - h); pop.style.maxHeight = `${above - 4}px`; }
  else if (h > below) pop.style.maxHeight = `${below - 4}px`;
  const left = side === 'end' ? r.right - w : r.left;
  pop.style.left = `${Math.round(Math.min(Math.max(m, left), innerWidth - w - m))}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function show(anchor, pop, { side = 'start', onClose, focusOut = true } = {}) {
  cur?.close();
  (anchor.closest('dialog') || document.body).append(pop);
  pop.setAttribute('popover', 'manual');
  try { pop.showPopover(); } catch { pop.classList.add('no-popover'); }
  place(anchor, pop, side);
  anchor.setAttribute('aria-expanded', 'true');
  let raf = 0, last = '';
  const follow = () => {
    if (!anchor.isConnected) { close(); return; }
    const r = anchor.getBoundingClientRect(), k = `${r.left},${r.top},${r.width}`;
    if (k !== last) { last = k; place(anchor, pop, side); }
    raf = requestAnimationFrame(follow);
  };
  raf = requestAnimationFrame(follow);
  const outside = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); };
  const blur = (e) => { if (focusOut && e.relatedTarget && !pop.contains(e.relatedTarget) && e.relatedTarget !== anchor) close(); };
  document.addEventListener('pointerdown', outside, true);
  pop.addEventListener('focusout', blur); anchor.addEventListener('focusout', blur);
  addEventListener('resize', close);
  function close() {
    if (cur?.pop !== pop) return;
    cur = null;
    cancelAnimationFrame(raf);
    document.removeEventListener('pointerdown', outside, true);
    anchor.removeEventListener('focusout', blur);
    removeEventListener('resize', close);
    anchor.setAttribute('aria-expanded', 'false');
    try { pop.hidePopover(); } catch { /* 不支持 popover */ }
    pop.remove();
    onClose?.();
  }
  cur = { pop, anchor, close };
  return close;
}

// ---------------- 下拉框 ----------------
// options：[[值, 文字, 右边的小字?], …]。返回一个按钮：.value 读写当前值（写不触发 change，和原生 <select> 一样），
// 选了别的会派发 change 事件、调 onChange(值)。弹出来的每一项带 data-value，自动化工具点它就行。
// prefix：按钮上值前面的小字（「缩放 适应」），弹出来的选项里不重复
export function uiSelect({ options, value, label, prefix = null, ax = null, cls = '', title = null, onChange = null }) {
  const opts = options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1], hint: o[2] } : o));
  let val = opts.some((o) => same(o.value, value)) ? value : opts[0]?.value;
  const text = el('span', { class: 'ui-select-text' });
  const b = el('button', { class: `ui-select ${cls}`.trim(), type: 'button', role: 'combobox', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label, title: title ?? (prefix ? label : null), 'data-ax': ax },
    prefix ? el('span', { class: 'ui-select-pre', text: prefix }) : null, text, chevron());
  const render = () => { text.textContent = opts.find((o) => same(o.value, val))?.label ?? ''; };
  Object.defineProperty(b, 'value', { get: () => val, set: (v) => { val = v; render(); } });
  b.options = opts;
  render();

  let pop = null, active = -1, close = null, typed = '', typedAt = 0, space = false;   // space：空格按下去已经处理过了，松开时浏览器补的那下 click 不算
  const items = () => [...pop.querySelectorAll('.ui-opt')];
  const setActive = (i, scroll = true) => {
    const list = items();
    active = Math.max(0, Math.min(list.length - 1, i));
    list.forEach((x, j) => x.classList.toggle('active', j === active));
    b.setAttribute('aria-activedescendant', list[active]?.id || '');
    if (scroll) list[active]?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (i) => {
    const o = opts[i];
    close?.();
    if (!o || same(o.value, val)) return;
    val = o.value; render();
    b.dispatchEvent(new Event('change', { bubbles: true }));
    onChange?.(val);
  };
  const open = () => {
    if (close) return;
    const id = `ui-lb-${++uid}`;
    pop = el('div', { class: 'ui-pop ui-listbox', role: 'listbox', id, 'aria-label': label || '' }, ...opts.map((o, i) =>
      el('div', { class: 'ui-opt', role: 'option', id: `${id}-${i}`, 'aria-selected': String(same(o.value, val)), 'data-value': typeof o.value === 'string' ? o.value : JSON.stringify(o.value),
        onpointerdown: (e) => e.preventDefault(),                // 焦点留在按钮上
        onpointermove: () => { if (active !== i) setActive(i, false); },
        onclick: () => pick(i) },
      el('span', { class: 'ui-opt-label', text: o.label }), o.hint != null ? el('small', { text: o.hint }) : null, tick())));
    pop.style.minWidth = `${b.offsetWidth}px`;
    b.setAttribute('aria-controls', id);
    close = show(b, pop, { onClose: () => { close = null; pop = null; b.removeAttribute('aria-activedescendant'); } });
    setActive(Math.max(0, opts.findIndex((o) => same(o.value, val))));
  };
  b.addEventListener('click', (e) => { if (space && e.detail === 0) return; if (close) close(); else open(); });
  b.addEventListener('keyup', (e) => { if (e.key === ' ') setTimeout(() => { space = false; }); });
  b.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === ' ') space = true;
    if (!close) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { open(); e.preventDefault(); e.stopPropagation(); }
      return;
    }
    const n = opts.length;
    if (k === 'ArrowDown') setActive(active + 1);
    else if (k === 'ArrowUp') setActive(active - 1);
    else if (k === 'Home') setActive(0);
    else if (k === 'End') setActive(n - 1);
    else if (k === 'PageDown') setActive(active + 8);
    else if (k === 'PageUp') setActive(active - 8);
    else if (k === 'Enter' || k === ' ') pick(active);
    else if (k === 'Escape') close();
    else if (k === 'Tab') { close(); return; }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey) {      // 打字跳到开头对得上的那一项
      const now = performance.now();
      typed = now - typedAt > 600 ? k.toLowerCase() : typed + k.toLowerCase(); typedAt = now;
      const i = opts.findIndex((o, j) => j > (typed.length > 1 ? active - 1 : active) && String(o.label).toLowerCase().startsWith(typed));
      const j = i >= 0 ? i : opts.findIndex((o) => String(o.label).toLowerCase().startsWith(typed));
      if (j >= 0) setActive(j);
    } else return;
    e.preventDefault(); e.stopPropagation();
  });
  return b;
}

// ---------------- 菜单 ----------------
// items：{ label, kbd?, ax?, on, checked?（true / false 表示是勾选项）, radio?, disabled?, danger? }、'-'（分隔线）、{ heading }（小标题）。
// 焦点进菜单里，上下键挑、回车点、Esc 关；onKey 给菜单栏用（左右键换到旁边那个菜单）。
export function openMenu(anchor, items, { label = '', side = 'start', onKey = null, focus = true } = {}) {
  const list = items.filter(Boolean);
  const menu = el('div', { class: 'ui-pop ui-menu', role: 'menu', 'aria-label': label });
  for (const it of list) {
    if (it === '-') { menu.append(el('div', { class: 'ui-sep', role: 'separator' })); continue; }
    if (it.heading) { menu.append(el('div', { class: 'ui-heading', role: 'presentation', text: it.heading })); continue; }
    const role = it.checked === undefined ? 'menuitem' : it.radio ? 'menuitemradio' : 'menuitemcheckbox';
    menu.append(el('button', { class: `ui-item ${it.danger ? 'danger' : ''}`.trim(), type: 'button', role, tabindex: '-1', 'data-ax': it.ax || null,
      'aria-checked': it.checked === undefined ? null : String(!!it.checked), disabled: it.disabled ? true : null,
      onclick: () => { const back = menu.contains(document.activeElement); close(); if (back) anchor.focus({ preventScroll: true }); it.on?.(); } },   // 键盘用户：焦点回到打开菜单的按钮（动作要是开了弹窗，弹窗再把焦点拿走）
    el('span', { class: 'ui-check' }, it.checked ? tick() : null), el('span', { class: 'ui-item-label', text: it.label }), it.kbd ? el('kbd', { text: it.kbd }) : null));
  }
  const btns = () => [...menu.querySelectorAll('.ui-item:not(:disabled)')];
  menu.addEventListener('keydown', (e) => {
    const all = btns(), i = all.indexOf(document.activeElement), k = e.key;
    if (k === 'ArrowDown') all[(i + 1) % all.length]?.focus();
    else if (k === 'ArrowUp') all[(i - 1 + all.length) % all.length]?.focus();
    else if (k === 'Home') all[0]?.focus();
    else if (k === 'End') all.at(-1)?.focus();
    else if (k === 'Escape') { close(); anchor.focus(); }
    else if (k === 'Tab') { close(); return; }
    else if ((k === 'ArrowLeft' || k === 'ArrowRight') && onKey) onKey(k);
    else return;
    e.preventDefault(); e.stopPropagation();
  });
  menu.addEventListener('pointermove', (e) => { const b = e.target.closest('.ui-item'); if (b && !b.disabled && document.activeElement !== b) b.focus({ preventScroll: true }); });
  const close = show(anchor, menu, { side });
  if (focus) btns()[0]?.focus({ preventScroll: true });
  return close;
}
export const menuOpenFor = (anchor) => cur?.anchor === anchor;

// ---------------- 滑块 ----------------
// 原生滑块的轨道没有「已经划过的那段」：用 --f（0～1）给样式画出来。程序里改了 value 也要调一次
export function syncRange(r) {
  const min = +r.min || 0, max = r.max === '' ? 100 : +r.max, v = +r.value;
  r.style.setProperty('--f', max > min ? String((v - min) / (max - min)) : '0');
}
document.addEventListener('input', (e) => { if (e.target instanceof HTMLInputElement && e.target.type === 'range') syncRange(e.target); }, true);
