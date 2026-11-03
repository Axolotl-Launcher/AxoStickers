// 代码面板（CodeMirror 6，按需加载）：组件源码、补全组件里能直接用的函数和 this 上的东西、报错标在行上。
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript';
import { autocompletion, snippetCompletion } from '@codemirror/autocomplete';
import { setDiagnostics, lintGutter } from '@codemirror/lint';

// 组件作用域里直接能用的（和 engine/api.js 对应）
const GLOBALS = [
  ['component', '注册组件：component({ id, type, name, params, ... })'],
  ['addrot', "addrot(a, '骨骼', x, y, z)：给骨骼加旋转（度）"], ['legmix', "legmix(a, 'leg3', 0..1)：前腿放下↔举起"],
  ['bump', '0→1→0 的鼓包'], ['clamp', 'clamp(x, 0, 1)'], ['lerp', 'lerp(a, b, k)'], ['win', 'win(t, 起, 止, 淡入淡出)'],
  ['easeIn', '缓入'], ['easeOut', '缓出'], ['easeIO', '缓入缓出'], ['easeOutBack', '冲过头再回来'], ['elastic', '弹簧'],
  ['mod', '取模（总是正数）'], ['rng', 'rng(种子)：.random() .uniform(a,b) .choice(arr)'], ['strHash', '字符串哈希'],
  ['icon', "icon('heart', 大小)：像素图标"], ['put', 'put(ctx, 图, x, y, 缩放, 角度, 透明度)'], ['star', 'star(ctx, x, y, r, [r,g,b])'],
  ['sq', 'sq(ctx, x, y, 边长, 填充色, 描边色, 线宽)'], ['rect', 'rect(ctx, x0, y0, x1, y1, 色)'], ['line', 'line(ctx, [[x,y],...], 色, 线宽)'],
  ['ellipse', 'ellipse(ctx, x0, y0, x1, y1, 填充, 描边, 线宽)'], ['polygon', 'polygon(ctx, 点列, 色)'],
  ['recolor', 'recolor(rgb, 部位, {body, gill, dark})：皮肤换色'], ['rgb2hsl', '[r,g,b] → [h,s,l]'], ['hsl2rgb', '[h,s,l] → [r,g,b]'], ['hex', "hex('fe3e8c') → [r,g,b]"],
  ['Ax', '新的美西螈状态'], ['LEGS', "['leg1'..'leg4']"], ['GILLS', '[[鳃, 方向], ...]'], ['BONES', '所有骨骼名'], ['FACES', '内置表情'],
  ['W', '画布宽 512'], ['H', '画布高 512'], ['FPS', '帧率'], ['YAW', '默认朝向 160°'], ['PITCH', '默认俯角 28°'], ['PI', 'π'],
  ['sin', ''], ['cos', ''], ['abs', ''], ['exp', ''], ['sqrt', ''], ['floor', ''], ['round', ''], ['min', ''], ['max', ''], ['atan2', ''], ['hypot', ''],
];
const THIS = [
  ['p', '这一层的参数（params 里声明的）'], ['T', '一圈多少秒'], ['N', '一圈多少帧'], ['FPS', '帧率'],
  ['ls(t, n, ph)', '一圈里正弦 n 次'], ['lc(t, n, ph)', '一圈里余弦 n 次'], ['ph(t, n, off)', '0..1 的循环进度'],
  ['splash(t0, x, n, 力度, 散开)', '在 t0 秒溅一片水花（在 setup 里调用）'], ['hold(a, 道具, {x,y,z,rz,s})', '手里拿个道具'],
  ['wear(a, 帽子)', '戴上'], ['idle(a, t)', '待机动作'], ['headPt([x,y,z])', '头上某点在画布上的位置'], ['eyePts()', '两只眼睛的位置'],
  ['proj([x,y,z])', '世界坐标 → 画布'], ['LAST', '这一帧画过美西螈没有'], ['A', '这一帧的美西螈状态'], ['stage', '整个场景（水面、波纹…）'],
  ['spec', '场景信息：hold（手里的道具）、face'], ['layer', '这一层的设置'],
];
const SNIPPETS = [
  snippetCompletion("move(a, t) {\n\t${}\n},", { label: 'move', detail: '动作：每帧改美西螈', type: 'method' }),
  snippetCompletion("draw(ctx, t, layer) {\n\tif (layer !== 'top') return;\n\t${}\n},", { label: 'draw', detail: '特效：每帧画（back / front / top 三层）', type: 'method' }),
  snippetCompletion("setup() {\n\t${}\n},", { label: 'setup', detail: '开始前跑一次', type: 'method' }),
  snippetCompletion("params: {\n\t${name}: { label: '${名字}', type: 'number', min: 0, max: 10, default: 1 },\n},", { label: 'params', detail: '参数（会自动生成滑块）', type: 'property' }),
];

function complete(ctx) {
  const thisDot = ctx.matchBefore(/this\.\w*/);
  if (thisDot) {
    return { from: thisDot.from + 5, options: THIS.map(([l, d]) => ({ label: l.split('(')[0], detail: l.includes('(') ? l.slice(l.indexOf('(')) : '', info: d, type: l.includes('(') ? 'method' : 'property', apply: l.split('(')[0] })) };
  }
  const w = ctx.matchBefore(/\w+/);
  if (!w || (w.from === w.to && !ctx.explicit)) return null;
  return { from: w.from, options: [...GLOBALS.map(([l, d]) => ({ label: l, info: d, type: /^[A-Z]/.test(l) ? 'constant' : 'function' })), ...SNIPPETS] };
}

export function createEditor(parent, { doc = '', onChange, onRun }) {
  const editable = new Compartment();
  let quiet = false;                                         // set() 换内容（切到别的组件）时为 true：不算用户改了代码
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup, javascript(), lintGutter(),
        javascriptLanguage.data.of({ autocomplete: complete }),
        autocompletion({ activateOnTyping: true }),
        keymap.of([{ key: 'Mod-Enter', run: () => { onRun?.(); return true; } }, { key: 'Mod-s', run: () => { onRun?.(); return true; } }]),
        editable.of(EditorView.editable.of(true)),
        EditorView.updateListener.of((u) => { if (u.docChanged && !quiet) onChange?.(u.state.doc.toString()); }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px', background: '#fff' },
          '.cm-scroller': { fontFamily: 'ui-monospace, "Cascadia Code", Consolas, "Microsoft YaHei UI", monospace', lineHeight: '1.55' },
          '.cm-gutters': { background: '#f5fbff', border: 'none', color: '#9aa5b5' },
          '.cm-activeLine': { background: '#fff3f8' }, '.cm-activeLineGutter': { background: '#ffe3f0' },
          '&.cm-focused': { outline: 'none' },
        }),
      ],
    }),
  });
  return {
    view,
    get value() { return view.state.doc.toString(); },
    set(text) {
      if (text === view.state.doc.toString()) return;
      quiet = true;
      try { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }); } finally { quiet = false; }
    },
    errors(list) {                                           // [{ line, message }]
      const doc = view.state.doc;
      view.dispatch(setDiagnostics(view.state, list.map((e) => {
        const ln = doc.line(Math.min(Math.max(1, e.line || 1), doc.lines));
        return { from: ln.from, to: ln.to, severity: 'error', message: e.message };
      })));
    },
    readOnly(on) { view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!on)) }); },
    focus() { view.focus(); },
  };
}
