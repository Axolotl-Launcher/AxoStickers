// 给组件代码的每个循环加一道保险：一次调用里跑太久就抛错，免得 while (true) 把整个页面卡死。
// 顺便用 acorn 做语法检查，报错带行号。
//   - 插进循环里的检查函数是一个名字随机、不可改写的全局函数（LOOP），组件代码没法把它换掉或者遮住；
//   - 组件回调都用 bounded() 包着：嵌套调用只能把期限提前，不能推后；
//   - 不在回调里的代码（定时器、await 之后接着跑的）按「一个任务」算：任务不让出线程超过 1 秒就抛错；
//   - eval / new Function / 字符串定时器造出来的代码也先插好保险再跑（lockEval，沙盒页面启动时调用）。
// 这道保险防的是写错的死循环，不是安全边界：真正隔开组件代码的是沙盒 iframe 和 CSP，
// 存心卡死页面的代码最后还有看门狗（编辑器重开沙盒）和出图的超时兜底。
import { parse } from 'acorn';

export const GUARD = { until: Infinity, free: 0 };
const TOO_LONG = '一个循环跑了太久，像是死循环（已停下这个组件）';
const tick = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
if (tick) { tick.port1.onmessage = () => { GUARD.free = 0; }; tick.port1.unref?.(); }   // 任务让出线程以后才会收到：说明上一段没卡住
function check() {
  const now = performance.now();
  if (GUARD.until !== Infinity) { if (now > GUARD.until) throw new Error(TOO_LONG); return; }
  if (!tick) return;
  if (!GUARD.free) { GUARD.free = now; tick.port2.postMessage(0); return; }
  if (now - GUARD.free > 1000) throw new Error(TOO_LONG);
}
export const LOOP = `__axoLoop_${Math.random().toString(36).slice(2, 10)}`;
Object.defineProperty(globalThis, LOOP, { value: check, writable: false, configurable: false, enumerable: false });

// 在 ms 毫秒的期限里跑 fn（嵌套时取更早的那个期限，跑完恢复外面的）
export function bounded(ms, fn) {
  const prev = GUARD.until;
  GUARD.until = Math.min(prev, performance.now() + ms);
  try { return fn(); } finally { GUARD.until = prev; }
}

// 返回插好保险的源码；语法错误抛出 { message, line }
export function instrument(src) {
  let ast;
  try {
    ast = parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowReturnOutsideFunction: false });
  } catch (e) {
    const err = new Error(`语法错误：${e.message.replace(/\s*\(\d+:\d+\)$/, '')}`); err.line = e.loc?.line; throw err;
  }
  const edits = [], call = `${LOOP}();`;                      // [位置, 插入的文本]
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (/^(For|ForIn|ForOf|While|DoWhile)Statement$/.test(node.type)) {
      const b = node.body;
      if (b.type === 'BlockStatement') edits.push([b.start + 1, call]);
      else { edits.push([b.start, `{${call}`]); edits.push([b.end, '}']); }
    }
    // 每个函数一进来也查一次：没有循环的无限链（queueMicrotask / then / await 递归）会饿死页面，靠这个停下来
    if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type)) {
      const b = node.body;
      if (b.type === 'BlockStatement') {
        let at = b.start + 1;                                 // 插在 "use strict" 这类指令后面，别改变函数的严格模式
        for (const st of b.body) { if (st.type === 'ExpressionStatement' && st.directive !== undefined) at = st.end; else break; }
        edits.push([at, call]);
      } else { edits.push([b.start, `(${LOOP}(), `]); edits.push([b.end, ')']); }
    }
    for (const k in node) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v.type === 'string' && k !== 'loc') visit(v);
    }
  };
  visit(ast);
  edits.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [pos, text] of edits) out = out.slice(0, pos) + text + out.slice(pos);
  return out;
}

// 沙盒页面里：把能「从字符串造代码」的口子都换成先插保险的版本（改不回去）
export function lockEval() {
  if (globalThis.__axoLocked) return;
  const Real = Function, realEval = globalThis.eval, fix = (o, k, value) => Object.defineProperty(o, k, { value, writable: false, configurable: false });
  const wrap = (proto, head) => {
    const W = function (...args) {
      const body = args.length ? String(args[args.length - 1]) : '', params = args.slice(0, -1).map(String).join(',');
      return Real(`return (${instrument(`(${head} anonymous(${params}\n) {\n${body}\n})`)})`)();
    };
    W.prototype = proto;
    fix(proto, 'constructor', W);
    return W;
  };
  fix(globalThis, 'Function', wrap(Real.prototype, 'function'));
  wrap(Object.getPrototypeOf(async function () {}), 'async function');
  wrap(Object.getPrototypeOf(function* () {}), 'function*');
  wrap(Object.getPrototypeOf(async function* () {}), 'async function*');
  fix(globalThis, 'eval', (s) => (typeof s === 'string' ? realEval(instrument(s)) : s));
  for (const k of ['setTimeout', 'setInterval']) {
    const real = globalThis[k];
    fix(globalThis, k, (f, ...a) => real(typeof f === 'function' ? f : () => { throw new Error('不支持用字符串当定时器代码'); }, ...a));
  }
  fix(globalThis, '__axoLocked', true);
}
