// 编辑器的图标：24×24、2px 描边的一套 SVG（不用表情符号和字形，各系统长得一样，读屏也不会念出怪字）。
const NS = 'http://www.w3.org/2000/svg';
const P = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  text: 'M5 7V5h14v2M12 5v14M9 19h6',
  motion: 'M4.5 12a7.5 7.5 0 0 1 13.2-4.9M19.5 12a7.5 7.5 0 0 1-13.2 4.9M18 3.5v4h-4M6 20.5v-4h4',
  face: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  fx: 'M11 3l1.7 5.1L18 10l-5.3 1.9L11 17l-1.7-5.1L4 10l5.3-1.9zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  prop: 'M14 6l4 4M4 20l9.5-9.5M11.5 4.5l2-2 8 8-2 2z',
  wear: 'M3 8.5l4.5 3.5L12 5l4.5 7L21 8.5 19 19H5z',
  skin: 'M12 3a9 9 0 0 0 0 18c1 0 1.6-.7 1.6-1.6 0-1.1-1-1.5-1-2.5 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.3 17 3 12 3zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
  model: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  bag: 'M5 8h14l-1.2 12H6.2zM9 8V6.5a3 3 0 0 1 6 0V8',
  back: 'M15 5l-7 7 7 7',
  home: 'M4 11l8-7 8 7M6 9.5V20h4.5v-5.5h3V20H18V9.5',
  folder: 'M3 7V5.5h6l2 2h10V19H3zM3 10h18',
  guides: 'M12 3v18M3 12h18M6 6h3M6 6v3M18 6h-3M18 6v3M6 18h3M6 18v-3M18 18h-3M18 18v-3',
  move: 'M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5',
  flip: 'M12 3v18M9 7L4 17h5zM15 7l5 10h-5z',
  reset: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5',
  palette: 'M12 3a9 9 0 0 0 0 18c1 0 1.6-.7 1.6-1.6 0-1.1-1-1.5-1-2.5 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.3 17 3 12 3z',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  plus: 'M12 5v14M5 12h14',
  file: 'M14 3H6v18h12V7zM14 3v4h4M12 11v6M9 14h6',
  open: 'M3 19V5.5h6l2 2h8V10M3 19l3-8.5h15L18 19z',
  save: 'M5 3h11l3 3v15H5zM8 3v5h8V3M8 21v-7h8v7',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 15.5h.01M12 12h.01M15.5 8.5h.01M8.5 15.5h.01',
  share: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5M12 16.5h.01',
  publish: 'M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 10.6 3.8 3.8 0 0 1 17.5 18M12 12v8M9 15l3-3 3 3',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  play: 'M7.5 4.8v14.4L19 12z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  first: 'M6 5v14M18 6l-8 6 8 6z',
  last: 'M18 5v14M6 6l8 6-8 6z',
  prev: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM4 4l16 16',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  trash: 'M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  onion: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM15 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
  warn: 'M12 3.5L21.5 20h-19zM12 10v4.5M12 17.5h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  check: 'M5 12.5l4.5 4.5L19 7',
  sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  close: 'M6 6l12 12M18 6L6 18',
  gauge: 'M4.5 18a8.5 8.5 0 1 1 15 0M12 14l4-5',
  robot: 'M12 3.5v3M7 8.5h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM9 13.5h.01M15 13.5h.01M9.5 17h5',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  copy: 'M8.5 8.5h11v11h-11zM5 15.5V4.5h11',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
};
const SOLID = new Set(['play', 'pause']);

export function icon(name, cls = '') {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
  s.setAttribute('class', `ico ${SOLID.has(name) ? 'solid' : ''} ${cls}`.trim());
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', P[name] || P.more);
  s.append(p);
  return s;
}

// 每种组件的图标和颜色（素材库、工坊卡片、时间轴都用）
export const TYPE_ICON = { motion: 'motion', face: 'face', fx: 'fx', textanim: 'text', text: 'text', prop: 'prop', wear: 'wear', skin: 'skin', scene: 'cube', model: 'model' };
