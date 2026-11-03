// 内置组件：动作 / 特效 / 文字动画 / 皮肤来自 src/components/**.axo.js 源码；表情、道具、帽子是引擎数据，
// 在这里包成组件（代码面板里看到的是它们的数据，改了就是一个新组件）。
import CAT from '../../../workshop/catalog.json';
import { E } from './core.js';
import { Registry, compile } from './components.js';

const SOURCES = import.meta.glob('../components/**/*.axo.js', { query: '?raw', import: 'default', eager: true });

export const ICONS = [...new Set([...Object.keys(E.icon), ...Object.keys(E.spr)])].filter((k) => k !== 'confetti');

export function builtinRegistry() {
  const reg = new Registry();
  for (const [path, src] of Object.entries(SOURCES)) {
    for (const def of compile(src, path.replace(/^.*components\//, ''))) reg.put(def, src, 'builtin');
  }
  for (const [id, face] of Object.entries(E.faces)) reg.put({ id, type: 'face', name: CAT.faces[id] || id, face }, null, 'builtin');
  for (const [id, [rows, pal]] of Object.entries(E.spr)) reg.put({ id, type: 'prop', name: CAT.holds[id] || CAT.icons[id] || id, sprite: [rows, pal] }, null, 'builtin');
  for (const [id, boxes] of Object.entries(E.blk)) reg.put({ id, type: 'prop', name: CAT.holds[id] || id, boxes }, null, 'builtin');
  for (const [id, boxes] of Object.entries(E.gear)) reg.put({ id, type: 'wear', name: CAT.wears[id] || id, boxes }, null, 'builtin');
  return reg;
}

// 表情可以拆开拼：眼睛 / 嘴的名字列表
export const EYES = Object.keys(E.eyes);
export const MOUTHS = Object.keys(E.mouths);
