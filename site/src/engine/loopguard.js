// 给组件代码的每个循环加一道保险：一次调用里跑太久就抛错，免得 while (true) 把整个页面卡死。
// 顺便用 acorn 做语法检查，报错带行号。
import { parse } from 'acorn';

export const GUARD = { until: Infinity };
export function __loop() {
  if (performance.now() > GUARD.until) throw new Error('一个循环跑了太久，像是死循环（已停下这个组件）');
}

// 返回插好保险的源码；语法错误抛出 { message, line }
export function instrument(src) {
  let ast;
  try {
    ast = parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowReturnOutsideFunction: false });
  } catch (e) {
    const err = new Error(`语法错误：${e.message.replace(/\s*\(\d+:\d+\)$/, '')}`); err.line = e.loc?.line; throw err;
  }
  const edits = [];                                           // [位置, 插入的文本]
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (/^(For|ForIn|ForOf|While|DoWhile)Statement$/.test(node.type)) {
      const b = node.body;
      if (b.type === 'BlockStatement') edits.push([b.start + 1, '__loop();']);
      else { edits.push([b.start, '{__loop();']); edits.push([b.end, '}']); }
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
