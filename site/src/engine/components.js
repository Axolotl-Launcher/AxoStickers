// 组件系统：组件是一段脚本，里面调用 component({...}) 注册一个或几个组件。
// 内置的动作 / 特效 / 文字动画在 src/components/**.axo.js，和用户写的、从文件载入的、组件库里的走同一条路：
// 源码 -> compile() -> Registry。辅助函数（addrot、bump、icon、put…）直接在作用域里，this 是这一层的上下文（见 scene.js）。
import * as API from './api.js';
import { instrument, bounded } from './loopguard.js';

const RealFunction = Function;                                  // 沙盒启动后全局的 Function 会被换成插保险的版本（lockEval）；编译自己已经插过了，用原版，行号也准

export const TYPES = {
  motion: '动作', fx: '特效', textanim: '文字动画', prop: '道具', wear: '帽子', face: '表情', skin: '皮肤', scene: '场景',
};
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

export class ComponentError extends Error {
  constructor(msg, line) { super(msg); this.line = line; }
}

export function lineOf(err) {                                   // new Function 的函数体从第 3 行开始，再加我们那行 "use strict"
  const m = /<anonymous>:(\d+):\d+|axo-component[^:]*:(\d+):\d+/.exec(String(err && err.stack));
  return m ? Math.max(1, +(m[1] || m[2]) - 3) : null;
}

// 编译一段组件源码，返回其中注册的组件定义（不放进 Registry）。guard: 给循环加保险 + 用 acorn 查语法
export function compile(src, origin = 'component', { guard = false } = {}) {
  if (typeof src !== 'string' || src.length > 200000) throw new ComponentError('组件源码太大了（上限 200 KB）');
  const found = [];
  const component = (def) => {
    if (!def || typeof def !== 'object') throw new ComponentError('component() 要传一个对象');
    if (!ID_RE.test(def.id || '')) throw new ComponentError(`组件 id 要是小写字母、数字、- 或 _：${def.id}`);
    if (!TYPES[def.type]) throw new ComponentError(`不认识的组件类型 ${def.type}（可选：${Object.keys(TYPES).join(' / ')}）`);
    found.push(def);
  };
  const names = Object.keys(API);
  let code = src, fn;
  if (guard) { try { code = instrument(src); } catch (e) { throw new ComponentError(e.message, e.line); } }
  try {
    fn = new RealFunction(...names, 'component', `"use strict";\n${code}\n//# sourceURL=axo-component-${origin.replace(/[^\w.-]/g, '_')}.js`);
  } catch (e) {
    throw new ComponentError(`语法错误：${e.message}`, lineOf(e));
  }
  try {
    bounded(1000, () => fn(...names.map((k) => API[k]), component));
  } catch (e) {
    throw new ComponentError(e instanceof ComponentError ? e.message : `运行出错：${e.message}`, e.line || lineOf(e));
  }
  if (!found.length) throw new ComponentError('这段代码里没有调用 component({...})');
  return found;
}

function mergeParams(base = {}, own = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(own)])) out[k] = { ...(base[k] || {}), ...(own[k] || {}) };
  return out;
}

export class Registry {
  constructor() { this.items = new Map(); this.listeners = new Set(); this.version = 0; }   // key = `${type}:${id}`；version 每改一次 +1
  key(type, id) { return `${type}:${id}`; }

  // 放进一个组件（同类型同 id 的会被覆盖：改代码、载入同名组件都靠这个）
  put(def, source, origin = 'builtin') {
    this.items.set(this.key(def.type, def.id), { def, source, origin }); this.version++;
    for (const f of this.listeners) f(def.type, def.id);
  }
  load(src, origin) {
    const defs = compile(src, origin);
    for (const d of defs) this.put(d, src, origin);
    return defs;
  }
  remove(type, id) { this.items.delete(this.key(type, id)); this.version++; for (const f of this.listeners) f(type, id); }
  entry(type, id) { return this.items.get(this.key(type, id)) || null; }
  has(type, id) { return this.items.has(this.key(type, id)); }

  // 解析 extends 链：参数逐项合并，方法和字段子覆盖父
  get(type, id, seen = new Set()) {
    const e = this.entry(type, id);
    if (!e) return null;
    const d = e.def;
    if (!d.extends || seen.has(id)) return d;
    seen.add(id);
    const base = this.get(type, d.extends, seen);
    if (!base) return d;
    return { ...base, ...d, params: mergeParams(base.params, d.params), base: base.id };
  }
  list(type) {
    return [...this.items.values()].filter((e) => e.def.type === type).map((e) => ({ ...e, def: this.get(type, e.def.id) }));
  }
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
}

// 参数默认值 + 用户值，按类型收拾一下
export function resolveParams(def, values = {}) {
  const out = {};
  for (const [k, spec] of Object.entries(def.params || {})) {
    let v = k in values ? values[k] : spec.default;
    if (spec.type === 'int' || spec.type === 'number') {
      v = Number(v); if (!Number.isFinite(v)) v = Number(spec.default) || 0;
      if (spec.min !== undefined) v = Math.max(spec.min, v);
      if (spec.max !== undefined) v = Math.min(spec.max, v);
      if (spec.type === 'int') v = Math.round(v);
    } else if (spec.type === 'bool') v = v ? 1 : 0;
    else if (spec.type === 'select') { const ok = (spec.options || []).some(([o]) => o === v); if (!ok) v = spec.default; }
    else if (spec.type === 'color' || spec.type === 'icon' || spec.type === 'text') v = String(v ?? spec.default ?? '');
    out[k] = v;
  }
  for (const [k, v] of Object.entries(values)) if (!(k in out)) out[k] = v;   // 组件没声明的也传进去（自定义组件可能会用）
  return out;
}

// 把数据型的内置组件（道具、帽子、表情、皮肤）变成可读、可改的源码
export function sourceFor(def) {
  const body = JSON.stringify({ ...def }, null, 2)
    .replace(/"(\w+)":/g, '$1:').replace(/\[\s+([^[\]{}]*?)\s+\]/g, (m, x) => `[${x.replace(/\s+/g, ' ')}]`);
  return `// ${TYPES[def.type]}「${def.name}」\ncomponent(${body});\n`;
}
