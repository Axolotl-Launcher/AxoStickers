// 创意工坊 · 编辑器（v2）：左边素材库，中间舞台 + 播放条 + 时间轴 / 代码，右边属性。
// 所有组件代码都在沙盒 iframe 里跑（runner.js）；这里只管界面和工程数据（store.js）。
import CAT from '../../../workshop/catalog.json';
import { $, el, toast, REPO, STYLE_COLORS } from '../util.js';
import { fromRecipe, normalizeProject } from '../engine/project.js';
import { Store, newId, STARTER } from './store.js';
import { Runner } from './runner.js';
import { loadGallery, G } from '../gallery.js';
import { icon, TYPE_ICON } from './icons.js';
import * as lib from './library.js';
import { detectPerf } from '../perf.js';
import { FONT_LIST } from '../engine/fonts.js';
import { createShort, openShort, dropShort, TTL as SHORT_TTL } from './share.js';
import './studio.css';

const ZH = { motion: '动作', face: '表情', prop: '道具', wear: '帽子', fx: '特效', text: '文字', textanim: '文字动画', skin: '皮肤', scene: '场景' };
const TCOLOR = { motion: '#fe3e8c', face: '#ff9f1c', prop: '#24c66c', wear: '#9e66ff', fx: '#18c4d6', text: '#4098ff', scene: '#6b6f80' };
const TIMED = new Set(['motion', 'fx', 'text', 'scene']);
const RAIL = [
  ['templates', '模板', 'grid'], ['text', '文字', 'text'], ['motion', '动作', 'motion'], ['face', '表情', 'face'], ['fx', '特效', 'fx'],
  ['prop', '道具', 'prop'], ['wear', '帽子', 'wear'], ['skin', '皮肤', 'skin'], ['model', '模型', 'model'], ['workshop', '工坊', 'bag'],
];
// 工坊里的分类：多种效果拼起来、代码很多的整帧场景（比如水龙卷）才叫「组件」，别的按它是什么归到对应的一类
const KIND = { scene: '组件', motion: '动作', face: '表情', fx: '特效', textanim: '文字', prop: '道具', wear: '帽子', skin: '皮肤', model: '模型' };
const LINES = ['收到', '已阅', '在摸了', '下次一定', '你说得对', '啊对对对', '也不是不行', '先这样吧', '关我啥事', '好家伙', '绷不住了', '急了', '已老实', '睡了', '开摆', '稳住', '收工', '就这'];
const TEMPLATES = {
  motion: `// 我的动作。a 是美西螈这一帧的状态：a.dx / a.dy 平移（像素），a.sx / a.sy 缩放，a.roll 整体歪（度），
// a.zoom 镜头远近，a.yaw 转身（度）。addrot(a, '骨骼', x, y, z) 给骨骼加旋转（度），
// 骨骼：head body tail top_gills left_gills right_gills leg1 leg2 leg3 leg4。
// this.ls(t, n) = 一圈里正弦 n 次，this.ph(t) = 0..1 的循环进度，this.p = 下面 params 里的参数。
component({
  id: 'my-wiggle', type: 'motion', name: '扭一扭',
  params: {
    amp: { label: '幅度', type: 'number', min: 0, max: 60, default: 24 },
    n: { label: '一圈扭几下', type: 'int', min: 1, max: 8, default: 4 },
  },
  move(a, t) {
    addrot(a, 'head', 0, this.p.amp * this.ls(t, this.p.n));
    addrot(a, 'tail', 0, -this.p.amp * this.ls(t, this.p.n));
    a.roll = 6 * this.ls(t, this.p.n / 2);
  },
});
`,
  fx: `// 我的特效。draw 每帧调三次：layer 是 'back'（美西螈后面）、'front'（前面）、'top'（字上面）。
// this.headPt() 是头顶在画布上的位置（画布 512×512）；icon('名字', 大小) 是像素图标，put 把它贴上去。
component({
  id: 'my-rain-hearts', type: 'fx', name: '爱心雨',
  params: {
    icon: { label: '图标', type: 'icon', default: 'heart' },
    n: { label: '数量', type: 'int', min: 1, max: 30, default: 12 },
  },
  setup() {
    const r = rng(7);
    this.drops = Array.from({ length: this.p.n }, () => ({ x: r.uniform(20, 492), ph: r.random() }));
  },
  draw(ctx, t, layer) {
    if (layer !== 'top') return;
    for (const d of this.drops) {
      const u = mod(t / this.T + d.ph, 1);
      put(ctx, icon(this.p.icon, 4), d.x + 10 * sin(u * 9), -20 + u * 560, 1, 360 * u);
    }
  },
});
`,
  textanim: `// 我的文字动画。xf(i, n, t) 返回第 i 个字（共 n 个）的 [dx, dy, 缩放, 角度, 是否显示]。
component({
  id: 'my-jelly', type: 'textanim', name: '果冻字',
  xf(i, n, t) {
    const k = this.ls(t, 3, -i * 0.7);
    return [0, 4 * k, 1 + 0.08 * k, 3 * this.ls(t, 2, i), true];
  },
});
`,
  skin: `// 我的皮肤。tint(rgb, 部位) 返回新颜色；部位：head body top_gills left_gills right_gills leg1..4 tail face item。
component({
  id: 'my-mint', type: 'skin', name: '薄荷',
  params: {
    body: { label: '身体', type: 'color', default: '#b8f5dc' },
    gill: { label: '鳃和尾巴', type: 'color', default: '#2fd39a' },
    dark: { label: '脚', type: 'color', default: '#1f9e74' },
  },
  tint(rgb, part) { return recolor(rgb, part, this.p); },
});
`,
  prop: `// 我的道具：像素画，一个字符一格，'.' 是空的，palette 写每个字符的颜色。会自动挤成一格厚的方块。
component({
  id: 'my-donut', type: 'prop', name: '甜甜圈',
  sprite: [[
    '..pppp..',
    '.pPPPPp.',
    'pPPwwPPp',
    'pPw..wPp',
    'pPw..wPp',
    'pPPwwPPp',
    '.pPPPPp.',
    '..pppp..',
  ], { p: 'c8783c', P: 'ff86c0', w: 'ffd0e4' }],
});
`,
};

let S = null;                                                // 单例：编辑器状态
// 重画一块面板。焦点在里面的话（点了星星、眼睛、添加…），重画完放回同一个控件上（按 data-ax 和它所在的图层 / 条目找），键盘和读屏不会被甩回页面开头
const focusSel = (a) => {
  const ax = a?.getAttribute?.('data-ax');
  if (!ax) return null;
  const host = a.parentElement?.closest('[data-layer],[data-origin],[data-id]');
  const hs = host ? ['data-layer', 'data-origin', 'data-id', 'data-type'].filter((k) => host.hasAttribute(k)).map((k) => `[${k}="${CSS.escape(host.getAttribute(k))}"]`).join('') : '';
  return `${hs ? `${hs} ` : ''}[data-ax="${CSS.escape(ax)}"]`;
};
const fill = (node, ...kids) => {
  const a = document.activeElement, sel = a && a !== document.body && node.contains(a) ? focusSel(a) : null;
  node.replaceChildren(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
  if (sel && !node.contains(document.activeElement)) node.querySelector(sel)?.focus({ preventScroll: true });
};
const hexOf = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

export function studioActive(on) {
  if (!S) return;
  S.active = on;
  S.runner.post({ type: 'transport', playing: on && S.playing });
  sendVisibility();
  S.mini.hidden = !on || S.stageVisible;
}

export async function openStudio(root, { recipe = null, project = null, shared = null, short = null } = {}) {
  if (!S) build(root);
  if (short) {                                                 // 1 分钟短链接：从中转站取回加密的工程，在这里解开
    const d = dialog('正在打开短链接', [el('div', { class: 'st-loading' }, spinner(), el('span', { text: '从中转站取工程…' }))], [], { closeLabel: '取消' });
    try { shared = await openShort(short); } catch (e) { toast(e.message); shared = null; } finally { d.close(); }
  }
  if (shared) { try { S.store.replace(untrusted(await decodeShare(shared))); toast('打开了分享的工程'); } catch (e) { toast(`分享链接打不开：${e.message}`); } }
  else if (project) S.store.replace(untrusted(project));
  else if (recipe) S.store.replace(fromRecipe(recipe));
  ensureModel();                                               // 草稿 / 打开的工程用的是 Logo 模型：先把模型送进沙盒
  studioActive(true);
}

// 从链接 / 文件 / 工坊作品打开的工程：里面自称 repo:（工坊原件）的组件代码可能被改过，换成 shared: 开头，
// 不会被当成工坊原件显示、存进组件库，也不会和组件库里的工坊原件混成一份
function untrusted(p) {
  if (p && Array.isArray(p.components)) p.components = p.components.map((c) => (c && /^repo:/.test(c.origin) ? { ...c, origin: `shared:${c.origin.slice(5)}` } : c));
  return p;
}

// ---------------- 构建界面 ----------------
// 每个能点的东西都有：看得见的文字或 aria-label（读屏 / 浏览器里的 AI 助手靠它认按钮）、data-ax（稳定的操作名，见 public/llms.txt）
// 要等一会儿的按钮：图标换成转圈、不能连点，做完了打个勾（失败就恢复原样）。job 是 Promise，原样返回
const spinner = (cls = '') => el('i', { class: `st-spin ${cls}`.trim(), 'aria-hidden': 'true' });
async function busy(b, job) {
  if (!(b instanceof HTMLElement) || b.classList.contains('is-busy')) return job;
  const sp = spinner();
  b.classList.add('is-busy'); b.setAttribute('aria-busy', 'true'); b.disabled = true; b.prepend(sp);
  let ok = false;
  try { const v = await job; ok = true; return v; } finally {
    sp.remove(); b.classList.remove('is-busy'); b.removeAttribute('aria-busy'); b.disabled = false;
    if (ok && b.isConnected) { b.classList.add('is-done'); setTimeout(() => b.classList.remove('is-done'), 900); }
  }
}
function btn(label, title, on, { cls = '', ico = null, ax = null, hideLabel = false } = {}) {
  return el('button', { class: `st-btn ${cls} ${ico ? 'has-ico' : ''} ${hideLabel ? 'ico-only' : ''}`.trim(), type: 'button', title, 'aria-label': label, 'data-ax': ax, onclick: on },
    ico ? icon(ico) : null, hideLabel ? null : el('span', { class: 'st-btn-label', text: label }));
}

function build(root) {
  const store = new Store();
  store.onError = (e) => toast(e.message);
  const perf = detectPerf();
  let quality = 'auto';
  try { quality = localStorage.getItem('axo-quality') || 'auto'; } catch { /* 没有 localStorage */ }
  S = { store, catalog: new Map(), errors: [], compileErrors: [], playing: true, speed: 1, frame: 0, N: 48, fps: 15, T: 3.2, onion: false,
    drawer: 'motion', dock: 'timeline', zoom: 'fit', bg: 'white', active: true, stageVisible: true, thumbCache: new Map(),
    models: new Map(), fontsSent: new Set(), perf, quality, favOnly: false, wsTab: 'browse', wsFilter: 'all', repo: null };   // models：送进沙盒的模型 id -> { name, bytes }；fontsSent：送进沙盒的导入字体

  // 顶栏：左边回首页、工程名、自动保存的状态；然后撤销重做、文件（新建 打开 保存 我的工程）、随机；右边是往外拿的：帮助、分享、发布、导出
  const name = el('input', { class: 'st-name', value: store.p.name, placeholder: '给它起个名', maxlength: 40, 'aria-label': '工程名', 'data-ax': 'project-name' });
  name.addEventListener('change', () => store.change((p) => { p.name = name.value.trim(); }));
  S.undoBtn = btn('撤销', '撤销（Ctrl+Z）', () => store.undo(), { ico: 'undo', ax: 'undo', hideLabel: true });
  S.redoBtn = btn('重做', '重做（Ctrl+Shift+Z）', () => store.redo(), { ico: 'redo', ax: 'redo', hideLabel: true });
  S.saved = el('span', { class: 'st-saved', role: 'status', 'data-ax': 'save-state', title: '草稿一改就自动存在这台设备的浏览器里；想长期留着就「存到我的工程」或者「保存」成文件' }, icon('check', 'tiny'), el('span', { text: '已自动保存' }));
  const top = el('header', { class: 'st-top', 'aria-label': '工程' },
    el('a', { class: 'st-back', href: '#/', title: '回图鉴（首页）', 'aria-label': '回图鉴', 'data-ax': 'back' }, icon('home')), name, S.saved,
    el('div', { class: 'st-group-btns st-histbtns' }, S.undoBtn, S.redoBtn),
    el('span', { class: 'st-sep' }),
    el('div', { class: 'st-group-btns st-filebtns', role: 'group', 'aria-label': '文件' },
      btn('新建', '新建一个空工程', async () => { if (await ask('新建工程', '新建会替换掉当前的工程（可以先「存到我的工程」或者「保存」成文件），接着？', '新建')) { store.replace(STARTER()); S.projectKey = null; } }, { ico: 'file', ax: 'new' }),
      btn('打开', '打开 .axo.json 工程文件、.axo.js 组件、模型或字体文件', () => pickFile(), { ico: 'open', ax: 'open' }),
      btn('保存', '把工程存成 .axo.json 文件（Ctrl+S）', () => saveProjectFile(), { ico: 'save', ax: 'save' }),
      btn('我的工程', '存在这台设备浏览器里的工程：存一份、打开、删除', () => showProjects(), { ico: 'folder', ax: 'projects' })),
    btn('随机', '随便拼一张（动作、表情、字都随机）', () => randomize(), { ico: 'dice', ax: 'random', cls: 'st-random' }),
    el('span', { class: 'st-grow' }),
    btn('帮助', '快捷键和给 AI 助手的说明（?）', () => showKeys(), { ico: 'help', ax: 'help', hideLabel: true }),
    btn('分享', '分享链接：完整链接，或者 1 分钟就失效的短链接', () => shareLink(), { ico: 'share', ax: 'share', cls: 'st-share' }),
    btn('发布到工坊', '写好标题和说明，用 GitHub issue 发布，真引擎重新出图', () => publish(), { cls: 'water', ico: 'publish', ax: 'publish' }),
    btn('导出', '导出 GIF / 逐帧 PNG', () => showExport(), { cls: 'primary', ico: 'download', ax: 'export' }));

  // 左：素材栏 + 抽屉
  const rail = el('nav', { class: 'st-rail', 'aria-label': '素材分类' }, ...RAIL.map(([k, label, ico]) =>
    el('button', { class: 'st-railbtn', type: 'button', 'data-k': k, 'data-ax': `drawer:${k}`, 'aria-pressed': String(k === S.drawer), 'aria-label': label, title: label, onclick: () => openDrawer(k) }, icon(ico), el('span', { text: label }))));
  S.drawerTitle = el('h3', { id: 'st-drawer-title' });
  S.drawerCount = el('small', { class: 'st-count' });
  S.search = el('input', { class: 'input st-search', type: 'search', placeholder: '搜一下名字', 'aria-label': '搜索素材', 'data-ax': 'search' });
  S.search.addEventListener('input', () => renderDrawer());
  S.favBtn = el('button', { class: 'st-favfilter', type: 'button', 'aria-pressed': 'false', 'aria-label': '只看收藏', title: '只看收藏', 'data-ax': 'fav-only', onclick: () => { S.favOnly = !S.favOnly; S.favBtn.setAttribute('aria-pressed', String(S.favOnly)); renderDrawer(); } }, icon('star'));
  S.drawerBody = el('div', { class: 'st-drawer-body', role: 'region', 'aria-labelledby': 'st-drawer-title' });
  const drawer = el('aside', { class: 'st-drawer', 'aria-label': '素材' },
    el('div', { class: 'st-drawer-head' }, el('div', { class: 'st-drawer-title' }, S.drawerTitle, S.drawerCount), el('div', { class: 'st-searchrow' }, S.search, S.favBtn)), S.drawerBody);

  // 中：舞台
  S.stageBox = el('div', { class: 'st-stage-box bg-white', role: 'img', 'aria-label': '预览' });
  S.errBadge = el('button', { class: 'st-errbadge', type: 'button', hidden: true, 'data-ax': 'errors', onclick: () => setDock('code') });
  S.bootMsg = el('div', { class: 'st-boot', role: 'status' });
  S.guides = el('div', { class: 'st-guides', hidden: true, 'aria-hidden': 'true' }, el('i', { class: 'v' }), el('i', { class: 'h' }), el('i', { class: 'safe' }));
  S.stageBox.append(S.guides);
  S.stageHint = el('div', { class: 'st-stagehint', 'aria-hidden': 'true' });
  const stage = el('div', { class: 'st-stage' }, S.stageBox, S.errBadge, S.bootMsg, S.stageHint);
  const sel = (title, ax, opts, value, on) => el('select', { class: 'st-mini-select', title, 'aria-label': title, 'data-ax': ax, onchange: (e) => on(e.target.value) },
    ...opts.map(([v, t]) => el('option', { value: v, text: t, selected: v === value ? true : null })));
  const zoomSel = sel('缩放', 'zoom', [['fit', '适应'], ['1', '100%'], ['2', '200%'], ['0.6', '60%（表情实际大小）']], 'fit', (v) => { S.zoom = v; layoutStage(); });
  const bgSel = sel('舞台背景（只影响预览）', 'stage-bg', [['white', '白底'], ['checker', '棋盘格'], ['chat', '聊天气泡·浅'], ['chatdark', '聊天气泡·深']], 'white', (v) => { S.bg = v; S.stageBox.className = `st-stage-box bg-${v}`; });
  const qSel = sel('预览画质（导出总是全画质）', 'quality', [['auto', '画质：自动'], ['smooth', '画质：流畅'], ['sharp', '画质：清晰']], quality, (v) => {
    S.quality = v; try { localStorage.setItem('axo-quality', v); } catch { /* 存不下就只这次 */ }
    S.runner.post({ type: 'quality', choice: v });
  });
  S.perfTag = el('span', { class: 'st-hint st-perf', title: perf.renderer || '' });
  let guidesOn = false;
  try { guidesOn = localStorage.getItem('axo-guides') === '1'; } catch { /* 没有 localStorage */ }
  const guidesBtn = btn('参考线', '显示中心线和表情的安全边距（只在预览里，不会导出）', () => setGuides(!S.guides.hidden ? false : true), { cls: 'small', ico: 'guides', ax: 'guides' });
  const setGuides = (on) => { S.guides.hidden = !on; guidesBtn.setAttribute('aria-pressed', String(on)); try { localStorage.setItem('axo-guides', on ? '1' : '0'); } catch { /* 存不下 */ } };
  setGuides(guidesOn);
  const stagebar = el('div', { class: 'st-stagebar' }, zoomSel, bgSel, qSel, guidesBtn, el('span', { class: 'st-grow' }), S.perfTag);

  // 播放条
  S.playBtn = btn('暂停', '播放 / 暂停（空格）', () => setPlaying(!S.playing), { cls: 'play', ico: 'pause', ax: 'play', hideLabel: true });
  S.counter = el('span', { class: 'st-counter', text: '1 / 48', 'data-ax': 'frame-counter' });
  S.scrub = el('input', { class: 'scrub st-scrub', type: 'range', min: 0, max: 47, value: 0, 'aria-label': '当前帧', 'data-ax': 'scrub' });
  S.scrub.addEventListener('input', () => seek(+S.scrub.value));
  S.speedBtn = btn('1×', '播放速度', () => {
    const sp = [0.25, 0.5, 1, 2]; S.speed = sp[(sp.indexOf(S.speed) + 1) % sp.length];
    S.speedBtn.querySelector('span').textContent = `${S.speed}×`; S.speedBtn.setAttribute('aria-label', `播放速度 ${S.speed}×`);
    S.runner.post({ type: 'transport', speed: S.speed });
  }, { cls: 'small', ax: 'speed' });
  S.onionBtn = btn('洋葱皮', '暂停时叠一层前一帧（O）', () => { S.onion = !S.onion; S.onionBtn.setAttribute('aria-pressed', String(S.onion)); S.runner.post({ type: 'transport', onion: S.onion }); }, { cls: 'small', ico: 'onion', ax: 'onion' });
  S.onionBtn.setAttribute('aria-pressed', 'false');
  const transport = el('div', { class: 'st-transport', role: 'toolbar', 'aria-label': '播放' },
    btn('第一帧', '第一帧（Home）', () => seek(0), { ico: 'first', ax: 'first', hideLabel: true }), btn('上一帧', '上一帧（←）', () => seek(S.frame - 1), { ico: 'prev', ax: 'prev', hideLabel: true }), S.playBtn,
    btn('下一帧', '下一帧（→）', () => seek(S.frame + 1), { ico: 'next', ax: 'next', hideLabel: true }), btn('最后一帧', '最后一帧（End）', () => seek(S.N - 1), { ico: 'last', ax: 'last', hideLabel: true }),
    S.scrub, S.counter, S.speedBtn, S.onionBtn);

  // 底部停靠：时间轴 / 代码
  const tab = (d, label, ico) => el('button', { class: 'st-tab', type: 'button', role: 'tab', 'data-d': d, 'data-ax': `dock:${d}`, onclick: () => setDock(d) }, icon(ico), el('span', { text: label }));
  S.dockTabs = el('div', { class: 'st-docktabs' },
    el('div', { class: 'st-tablist', role: 'tablist', 'aria-label': '时间轴和代码' }, tab('timeline', '时间轴', 'layers'), tab('code', '代码', 'code')),
    el('span', { class: 'st-grow' }),
    btn('加图层', '加一层', (e) => addMenu(e.currentTarget), { cls: 'small', ico: 'plus', ax: 'add-layer-menu' }));
  S.timeline = el('div', { class: 'st-timeline', role: 'region', 'aria-label': '时间轴' });
  S.codePane = el('div', { class: 'st-code', role: 'region', 'aria-label': '代码' });
  const dock = el('section', { class: 'st-dock' }, S.dockTabs, S.timeline, S.codePane);

  const main = el('main', { class: 'st-main' }, stagebar, stage, transport, dock);
  S.inspector = el('aside', { class: 'st-inspector', 'aria-label': '属性' });
  S.mobileTabs = el('div', { class: 'st-mtabs', role: 'tablist', 'aria-label': '面板' }, ...[['drawer', '素材', 'grid'], ['inspector', '属性', 'sliders'], ['timeline', '时间轴', 'layers'], ['code', '代码', 'code']].map(([k, t, ico]) =>
    el('button', { class: 'st-tab', type: 'button', role: 'tab', 'data-m': k, 'data-ax': `panel:${k}`, onclick: () => { setMobile(k); revealPanel(k); } }, icon(ico), el('span', { text: t }))));
  S.mini = el('button', { class: 'mini st-mini', type: 'button', hidden: true, 'aria-label': '回到预览', onclick: () => stage.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, el('span', { text: '预览在上面 ↑' }));
  // 给读屏和浏览器里的 AI 助手：画布里画了什么，用一句话说出来（工程一变就更新）
  S.status = el('p', { class: 'sr-only', 'aria-live': 'polite', 'data-ax': 'status' });

  S.root = el('div', { class: 'studio', 'data-m': 'drawer', 'data-state': 'booting', 'data-perf': perf.tier, 'data-device': perf.device },
    top, el('div', { class: 'st-body' }, rail, drawer, main, S.inspector), S.mobileTabs, S.mini, S.status);
  fill(root, S.root);

  // 沙盒
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const devNoSandbox = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && params.get('nosandbox') === '1';
  S.runner = new Runner(S.stageBox, { sandboxed: !devNoSandbox, src: `sandbox.html?q=${encodeURIComponent(quality)}` });
  S.runner.on('ready', (m) => {
    S.sceneReady = false; bootTries = 0;
    S.bootMsg.hidden = true; S.root.dataset.state = 'ready'; setPerf(m.perf); setCatalog(m.catalog);
    for (const [id, x] of S.models) S.runner.request({ type: 'model', id, bytes: x.bytes.slice(0) }).catch(() => {});   // 沙盒重开过：模型、字体再送一遍
    S.fontsSent = new Set(); ensureFonts();
    if (S.quality !== 'auto') S.runner.post({ type: 'quality', choice: S.quality });   // 沙盒重开过：用舞台上现在选的画质
    sendLibrary(); sendProject(); sendVisibility();
  });
  S.runner.on('perf', (m) => setPerf(m.perf));
  S.runner.on('catalog', (m) => { setCatalog(m.catalog); S.compileErrors = m.errors || []; showErrors(); dropThumbs(); });
  S.runner.on('scene', (m) => { S.sceneReady = true; S.N = m.N; S.fps = m.fps; S.T = m.T; S.scrub.max = m.N - 1; S.errors = m.errors || []; showErrors(); updateCounter(); scheduleFilmstrip(); updateStatus(); });
  S.runner.on('errors', (m) => { S.errors = m.errors || []; showErrors(); });
  S.runner.on('time', (m) => { if (S.playing) { S.frame = m.frame; updateCounter(); } });
  S.runner.on('fatal', (m) => toast('沙盒出错：' + m.message));
  let bootTries = 0;
  S.runner.on('boot-failed', (m) => {
    if (++bootTries <= 1) { S.runner.start(); return; }        // 第一次失败悄悄再试一次（开发时依赖刚重新打包完、第一次请求会失败）
    S.root.dataset.state = 'error';
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);      // 不加沙盒只给本机开发用：网站上 sandbox.html 会拒绝在本站身份下运行
    const restart = (sandboxed) => { bootTries = 1; S.runner.sandboxed = sandboxed; S.root.dataset.state = 'booting'; bootLoader(); S.runner.start(); };
    fill(S.bootMsg, icon('warn', 'big'), el('b', { text: '预览沙盒没能启动' }),
      el('p', { text: `${m?.reason || '没有回应'}。` }),
      el('p', { class: 'st-note', text: '组件代码只在一个不透明来源的沙盒框里跑，拦截类浏览器扩展（广告 / 隐私拦截）有时会把它的请求当成可疑的拦下来：给这个网站关掉它们再重试，或者换个浏览器。' }),
      el('div', { class: 'st-row' }, el('button', { class: 'btn primary', type: 'button', 'data-ax': 'boot-retry', onclick: () => restart(S.runner.sandboxed) }, icon('undo'), '重试'),
        local ? el('button', { class: 'btn', type: 'button', 'data-ax': 'boot-nosandbox', onclick: () => restart(false) }, '不用沙盒直接运行（只在本机）') : null));
    S.bootMsg.hidden = false;
  });
  S.runner.watch(() => { toast('沙盒没响应了，重开一次'); S.runner.start(); });

  store.on((why) => {
    if (why === 'foreign') { setSaved(false); toast('这份草稿在另一个标签页里改过了：这边的改动不再自动保存（想接着用那边的就刷新页面；这边的可以「保存」成文件）'); return; }
    if (why !== 'select') setSaved(!store.foreign);
    if (why === 'select') { renderInspector(); renderTimeline(); loadCode(); updateStatus(); stageHint(); return; }
    if (document.activeElement !== name) name.value = store.p.name;
    sendProject(); renderTimeline(); updateHistory(); ensureModel(); ensureFonts(); updateStatus();
    if (S.quiet !== 'inspector' && S.quiet !== 'all') renderInspector();              // 正在打字 / 拖滑块的那个面板不重建，不然输入框会被换掉、失去焦点
    if (why !== 'change') loadCode();
    if (S.quiet !== 'drawer' && S.quiet !== 'all' && (['text', 'skin', 'model'].includes(S.drawer) || (S.drawer === 'workshop' && (S.wsTab === 'mine' || why !== 'change')))) renderDrawer();
  });
  lib.ready.then(() => { sendLibrary(); renderDrawer(); ensureModel(); ensureFonts(); });
  lib.onChange((why) => { if (why !== 'fav') sendLibrary(); renderDrawer(); });

  // 舞台看不见的时候（手机上往下翻）：挂一个小提示，预览也先不画（省电）
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { S.stageVisible = e.isIntersecting; S.mini.hidden = S.stageVisible || !S.active; sendVisibility(); }, { threshold: 0.05 }).observe(stage);
  window.addEventListener('resize', layoutStage);
  document.addEventListener('keydown', onKey);
  root.addEventListener('dragover', (e) => { e.preventDefault(); S.root.classList.add('dropping'); });
  root.addEventListener('dragleave', (e) => { if (e.target === root || !root.contains(e.relatedTarget)) S.root.classList.remove('dropping'); });
  root.addEventListener('drop', (e) => { e.preventDefault(); S.root.classList.remove('dropping'); for (const f of e.dataTransfer.files) importFile(f); });

  bootLoader(); stageInteract();
  openDrawer(S.drawer); setDock('timeline'); setMobile('drawer');
  renderInspector(); renderTimeline(); updateHistory(); layoutStage(); setPerf(null); updateStatus();
  installApi();
}

// 在预览上直接拖：选中了文字就挪那行字，没选中（或者选的是别的图层）就挪模型；滚轮 / 双指捏合缩放。
// 一次拖动只算一步撤销；改动按动画帧合并，拖得再快也不会每个像素都重建一次场景
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function stageHint() {
  const l = S.store.layer();
  S.stageHint.textContent = l?.type === 'text' ? `拖动：挪「${l.text || '这行字'}」 · 滚轮：缩放` : '拖动：挪模型 · 滚轮：缩放（选中文字就挪文字）';
}
function stageInteract() {
  const box = S.stageBox, pts = new Map();
  let drag = null, raf = 0, pending = null;
  const flush = () => { raf = 0; const f = pending; pending = null; if (f) S.store.change(f, { coalesce: `stage:${drag?.t || 'model'}` }); };
  const queue = (f) => { pending = f; raf ||= requestAnimationFrame(flush); };
  const textSel = () => { const l = S.store.layer(); return l?.type === 'text' ? l : null; };
  const begin = (e) => {
    const t = textSel(), M = S.store.p.model, k = 512 / box.getBoundingClientRect().width, [a, b] = [...pts.values()];
    drag = { k, t: t?.id || null, x0: e.clientX, y0: e.clientY, sx: t ? t.x : M.x, sy: t ? t.y : M.y, s0: t ? t.scale : M.scale, d0: b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0, moved: false };
  };
  const scaleTo = (t, s) => queue((p) => {
    if (t) { const l = p.layers.find((x) => x.id === t); if (l) l.scale = clampN(+s.toFixed(3), 0.3, 2); }
    else p.model.scale = clampN(+s.toFixed(3), 0.3, 2.5);
  });
  box.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    try { box.setPointerCapture(e.pointerId); } catch { /* 拿不到捕获也能拖 */ }
    begin(e);
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size >= 2 && drag.d0) { const [a, b] = [...pts.values()]; scaleTo(drag.t, drag.s0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.d0); return; }
    const dx = (e.clientX - drag.x0) * drag.k, dy = (e.clientY - drag.y0) * drag.k;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true; box.classList.add('dragging');
    const { t, sx, sy } = drag;
    queue((p) => {
      if (t) { const l = p.layers.find((x) => x.id === t); if (l) { l.x = clampN(Math.round(sx + dx), -256, 256); l.y = clampN(Math.round(sy + dy), 0, 512); } }
      else { p.model.x = clampN(Math.round(sx + dx), -256, 256); p.model.y = clampN(Math.round(sy + dy), -256, 256); }
    });
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size) { const [id, [x, y]] = [...pts][0]; begin({ pointerId: id, clientX: x, clientY: y }); return; }   // 双指松开一只：接着用剩下那只拖
    if (drag?.moved) S.store.lastKey = null;                   // 下一次拖动另算一步撤销
    drag = null; box.classList.remove('dragging');
  };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  box.addEventListener('wheel', (e) => {
    if (S.zoom !== 'fit' && !e.ctrlKey && !e.altKey) return;   // 放大看的时候滚轮是滚动舞台
    e.preventDefault();
    const t = textSel(), cur = t ? t.scale : S.store.p.model.scale;
    scaleTo(t?.id || null, cur * Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  stageHint();
}

// 启动中的动画：一只在水里上下浮的小美西螈 + 三个点
function bootLoader() {
  fill(S.bootMsg, el('div', { class: 'st-loader', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), el('span', { text: '正在启动预览…' }));
  S.bootMsg.hidden = false;
}
// 顶栏的「已自动保存」：每次改动闪一下；另一个标签页接手了草稿就变成提醒
function setSaved(ok) {
  S.saved.classList.toggle('warn', !ok);
  fill(S.saved, icon(ok ? 'check' : 'warn', 'tiny'), el('span', { text: ok ? '已自动保存' : '没在自动保存' }));
  S.saved.classList.remove('pulse'); void S.saved.offsetWidth; S.saved.classList.add('pulse');
}
function sendVisibility() { S.runner?.post({ type: 'transport', visible: S.active && S.stageVisible }); }
const libComponents = () => lib.list().filter((e) => typeof e.source === 'string');   // 组件库里除了组件代码，还有下载的模型、导入的字体（kind: model / font，存的是字节）
const libModels = () => lib.list().filter((e) => e.kind === 'model');
const libFonts = () => lib.list().filter((e) => e.kind === 'font');
function sendLibrary() { S.runner?.post({ type: 'components', items: libComponents().map((e) => ({ origin: e.origin, source: e.source })) }); }
function setPerf(p) {
  if (p) S.perfInfo = p;
  const x = S.perfInfo || S.perf, q = x.quality?.tier || x.tier;
  S.perfTag.textContent = `${x.gpu === 'hw' ? '显卡加速' : x.gpu === 'sw' ? '软件渲染' : '没有 WebGL'} · ${{ high: '高画质', mid: '标准', low: '省电预览' }[q] || ''}`;
  S.perfTag.dataset.gpu = x.gpu;
}
// 一句话描述当前工程（读屏 / AI 助手看不到画布，靠它）
let statusTimer;
function updateStatus() {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    const p = S.store.p, sel = S.store.layer();
    const parts = p.layers.filter((l) => !l.hidden).map((l) => (l.type === 'text' ? `文字「${l.text}」` : `${ZH[l.type] || l.type} ${nameOf(l.type, l.component)}`));
    S.status.textContent = `工程「${p.name || '未命名'}」：${parts.join('、') || '没有图层'}；${S.N} 帧 ${S.fps} fps；${sel ? `选中了${ZH[sel.type] || sel.type}` : '没选中图层'}${S.errors.length ? `；${S.errors.length} 个组件报错` : ''}。`;
  }, 250);
}
// 面板里的输入框改工程时用：这次改动不重建这个面板（输入框本身已经是新值了）
function quietly(panel, fn) { S.quiet = panel; try { fn(); } finally { S.quiet = null; } }

// 工程用的模型还没送进沙盒：组件库里有就用库里的；没有但工坊里有（打开分享 / 工坊作品时），临时下一份（不存进库）
async function modelBytes(id) {
  const e = libModels().find((x) => x.id === id);
  if (e) return { name: e.name, bytes: e.bytes };
  const c = (await loadRepo().catch(() => [])).find((x) => x.type === 'model' && x.id === id);
  if (!c) return null;
  const r = await fetch(`models/${encodeURIComponent(c.file)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { name: c.name, bytes: await r.arrayBuffer() };
}
const modelLoads = new Map();
function ensureModel(id = S.store.p.model.component) {
  if (id === 'axolotl' || S.models.has(id)) return Promise.resolve(true);
  if (!modelLoads.has(id)) modelLoads.set(id, (async () => {
    try {
      const m = await modelBytes(id);
      if (!m) { toast(`这台设备上没有模型「${id.replace(/^file:/, '')}」：先用原版显示（去「工坊」添加，或者重新载入模型文件）`); return false; }
      const r = await S.runner.request({ type: 'model', id, bytes: m.bytes.slice(0) });
      if (!r.ok) { toast('模型没读出来：' + r.message); return false; }
      S.models.set(id, { name: m.name, bytes: m.bytes, info: `${r.quads} 个面片 · 骨骼 ${r.bones.join(' ') || '无'}` });
      return true;
    } catch (e) { toast(`模型没载进来：${e.message}`); return false; } finally { modelLoads.delete(id); }
  })());
  return modelLoads.get(id);
}

// ---------------- 字体 ----------------
// 工程里文字用到的导入字体送进沙盒（FontFace 吃字节）；这台设备上没有这个字体文件的就先用默认字体画，提示一次
const fontMissing = new Set();
async function ensureFonts(p = S.store.p) {
  for (const id of new Set(p.layers.filter((l) => l.type === 'text' && l.font?.startsWith('font:')).map((l) => l.font))) {
    if (S.fontsSent.has(id)) continue;
    const e = libFonts().find((x) => x.id === id);
    if (!e) { if (lib.loaded() && !fontMissing.has(id)) { fontMissing.add(id); toast(`这台设备上没有字体「${id.slice(5)}」：先用默认字体显示（在「文字」里导入同一个字体文件就好）`); } continue; }
    S.fontsSent.add(id);
    const r = await S.runner.request({ type: 'font', id, bytes: e.bytes.slice(0) }).catch((er) => ({ ok: false, message: er.message }));
    if (!r.ok) { S.fontsSent.delete(id); toast(`字体「${e.name}」没读出来：${r.message}`); }
  }
}
// 字体按钮上用它自己的字体写名字：导入的字体在主页面也注册一份（只用来显示按钮）
const pickFaces = new Map();
function fontCssOf(id) {
  const f = FONT_LIST.find((x) => x.id === id);
  if (f) return f.css;
  if (!pickFaces.has(id)) {
    const e = libFonts().find((x) => x.id === id), fam = `AxoPick${pickFaces.size + 1}`;
    pickFaces.set(id, fam);
    if (e) new FontFace(fam, e.bytes.slice(0)).load().then((face) => document.fonts.add(face)).catch(() => {});
  }
  return `"${pickFaces.get(id)}",AxoSans`;
}
const fontName = (id) => FONT_LIST.find((f) => f.id === id)?.name || libFonts().find((e) => e.id === id)?.name || id.replace(/^font:/, '');
function applyFont(id, all = false) {
  if (all) S.store.change((p) => { for (const l of p.layers) if (l.type === 'text') l.font = id; });
  else applyToText((l) => { l.font = id; });
}
function fontRow() {
  const l = S.store.layer(), cur = (l?.type === 'text' ? l.font : S.store.first('text')?.font) || 'axo';
  const chip = (id, name, desc) => el('button', { class: 'chip st-fontchip', type: 'button', 'aria-pressed': String(cur === id), title: desc, 'aria-label': `字体：${name}`, 'data-ax': `font:${id}`, style: `font-family:${fontCssOf(id)}`, onclick: () => applyFont(id) }, name);
  return el('div', { class: 'st-fonts' },
    el('div', { class: 'chips', role: 'group', 'aria-label': '字体' }, ...FONT_LIST.map((f) => chip(f.id, f.name, f.desc)), ...libFonts().map((e) => chip(e.id, e.name, `导入的字体 · ${e.kb || '?'} KB（只在这台设备上）`))),
    el('div', { class: 'st-row' },
      btn('导入字体', '导入 .ttf / .otf / .woff / .woff2 字体文件（存在这台设备上）', () => pickFile('.ttf,.otf,.woff,.woff2'), { cls: 'small', ico: 'open', ax: 'import-font' }),
      btn('所有文字都用它', '把所有文字图层换成这个字体', () => applyFont(cur, true), { cls: 'small', ax: 'font-all' })),
    cur !== 'axo' ? el('p', { class: 'st-note', text: '工坊出图只认「Axo 黑体」：换了字体导出 GIF 没问题，发布到工坊前要换回来。系统字体在别的设备上可能长得不一样。' }) : null);
}
async function importFont(f) {
  if (f.size > 40 << 20) { toast(`${f.name} 太大了（字体最多 40 MB）`); return; }
  const bytes = await f.arrayBuffer();
  try { await new FontFace('AxoProbe', bytes.slice(0)).load(); } catch { toast(`${f.name} 不是能用的字体文件`); return; }
  const id = `font:${f.name}`.slice(0, 80), name = f.name.replace(/\.(ttf|otf|woff2?)$/i, '');
  await lib.put({ origin: id, kind: 'font', type: 'font', id, name, bytes, from: 'file', kb: Math.round(f.size / 1024) });
  S.fontsSent.delete(id); pickFaces.delete(id);
  applyFont(id);
  toast(`导入了字体「${name}」，用在了选中的文字上（存在这台设备的库里）`);
}

// ---------------- 沙盒通信 ----------------
let sendTimer;
function sendProject() {
  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => S.runner.post({ type: 'project', project: S.store.p }), 60);
}
function setCatalog(list) {
  S.catalog = new Map();
  for (const m of list || []) { if (!S.catalog.has(m.type)) S.catalog.set(m.type, []); S.catalog.get(m.type).push(m); }
  const order = { motion: Object.keys(CAT.motions), fx: Object.keys(CAT.fx), face: Object.keys(CAT.faces), prop: Object.keys(CAT.holds), wear: Object.keys(CAT.wears), textanim: Object.keys(CAT.tmodes) };
  for (const [t, l] of S.catalog) {
    const o = order[t] || [], rank = (m) => (m.origin !== 'builtin' ? -1 : o.includes(m.id) ? o.indexOf(m.id) : 999);
    l.sort((a, b) => rank(a) - rank(b));
  }
  renderDrawer(); renderInspector(); renderTimeline();
}
const metaOf = (type, id) => (S.catalog.get(type) || []).find((m) => m.id === id) || null;
const nameOf = (type, id) => metaOf(type, id)?.name || (type === 'face' ? CAT.faces[id] : null) || id;

function playIcon(on) { S.playBtn.replaceChildren(icon(on ? 'pause' : 'play')); S.playBtn.setAttribute('aria-label', on ? '暂停' : '播放'); S.playBtn.setAttribute('aria-pressed', String(on)); }
function setPlaying(on) {
  S.playing = on;
  playIcon(on);
  S.runner.post(on ? { type: 'transport', playing: true, t: S.frame / S.fps } : { type: 'transport', playing: false, t: S.frame / S.fps });
}
function seek(f) {
  S.frame = ((Math.round(f) % S.N) + S.N) % S.N;
  if (S.playing) { S.playing = false; playIcon(false); }
  S.runner.post({ type: 'transport', playing: false, t: S.frame / S.fps });
  updateCounter();
}
function updateCounter() {
  S.counter.textContent = `${S.frame + 1} / ${S.N} · ${(S.frame / S.fps).toFixed(2)}s`;
  S.scrub.value = S.frame;
  const x = (S.frame + 0.5) / S.N * 100;
  S.timeline.style.setProperty('--play', `${x}%`);
  S.filmCanvases?.forEach((c, i) => c.classList.toggle('on', i === S.frame));
}
function layoutStage() {
  const box = S.stageBox, stage = box.parentElement;
  if (S.zoom === 'fit') { box.style.width = box.style.height = ''; box.classList.add('fit'); return; }
  box.classList.remove('fit');
  const px = Math.round(400 * Number(S.zoom));
  box.style.width = box.style.height = `${px}px`;
  stage.scrollTo?.({ left: (box.offsetWidth - stage.clientWidth) / 2, top: 0 });
}
function updateHistory() { S.undoBtn.disabled = !S.store.past.length; S.redoBtn.disabled = !S.store.future.length; }

let filmTimer, filmSeq = 0;
function scheduleFilmstrip() {
  clearTimeout(filmTimer);
  filmTimer = setTimeout(async () => {
    if (S.dock !== 'timeline') return;
    const n = Math.min(S.N, 48), my = ++filmSeq;              // 晚回来的旧请求不能盖掉新的胶片条
    const r = await S.runner.request({ type: 'filmstrip', n, size: 56 }).catch(() => null);
    if (!r || my !== filmSeq) return;
    S.filmBitmaps = r.bitmaps; drawFilmstrip();
  }, 700);
}
function drawFilmstrip() {
  const strip = S.timeline.querySelector('.tl-film');
  if (!strip || !S.filmBitmaps) return;
  S.filmCanvases = S.filmBitmaps.map((b, i) => {
    const c = el('canvas', { width: 56, height: 56, title: `第 ${i + 1} 帧`, onclick: () => seek(Math.floor(i * S.N / S.filmBitmaps.length)) });
    c.getContext('2d').drawImage(b, 0, 0);
    return c;
  });
  fill(strip, ...S.filmCanvases);
  updateCounter();
}

// ---------------- 错误 ----------------
function showErrors() {
  const all = [...S.compileErrors.map((e) => ({ ...e, key: e.origin })), ...S.errors];
  S.errBadge.hidden = !all.length;
  S.errBadge.textContent = all.length ? `⚠ ${all.length} 个组件出错` : '';
  S.errBadge.title = all.map((e) => `${e.key}：${e.message}${e.line ? `（第 ${e.line} 行）` : ''}`).join('\n');
  if (S.code) {
    const cur = S.codeTarget;
    const mine = cur ? all.filter((e) => e.key === cur.origin || e.key === `${cur.type}:${cur.id}`) : [];
    S.code.errors(mine);
    S.codeErr.textContent = mine.map((e) => `${e.line ? `第 ${e.line} 行：` : ''}${e.message}`).join('；');
    S.codeErr.hidden = !mine.length;
  }
  renderTimeline();
}

// ---------------- 素材抽屉 ----------------
function openDrawer(k) {
  if (!RAIL.some((x) => x[0] === k)) throw new Error(`没有这个分类：${k}（能用 ${RAIL.map((x) => x[0]).join(' / ')}）`);
  S.drawer = k;
  for (const b of S.root.querySelectorAll('.st-railbtn')) b.setAttribute('aria-pressed', String(b.dataset.k === k));
  S.drawerTitle.textContent = RAIL.find((r) => r[0] === k)[1];
  S.search.value = '';
  S.search.hidden = k === 'skin' || k === 'model'; S.favBtn.hidden = k === 'model';   // 皮肤只有十来个，不用搜；收藏开关留着（不然「只看收藏」关不掉）
  renderDrawer();
  S.drawerBody.classList.remove('enter'); void S.drawerBody.offsetWidth; S.drawerBody.classList.add('enter');   // 换分类时内容淡入
  if (matchMedia('(max-width: 900px)').matches) setMobile('drawer');
}

// 用到组件库里的组件：把它的源码一起放进工程，工程就自带了（分享、发布、换台电脑都能打开）
const MAX_SOURCES = 24;                                        // 和 normalizeProject 的上限一样：超了会被截掉，所以先拦下
function addSource(p, origin) {
  if (!origin || p.components.some((c) => c.origin === origin)) return;
  const e = lib.get(origin);
  if (!e) return;
  if (p.components.length >= MAX_SOURCES) {
    throw Object.assign(new Error(`工程最多带 ${MAX_SOURCES} 段组件代码：先在「工坊 · 我的组件库」最下面把用不到的移出工程`), { userFacing: true });
  }
  p.components.push({ origin: e.origin, source: e.source });
}
function bring(p, type, id) {
  const m = metaOf(type, id);
  addSource(p, m ? (m.origin === 'builtin' || m.origin.startsWith('override:') ? null : m.origin) : lib.list().find((e) => e.type === type && e.id === id)?.origin);   // 素材库还没刷新：按组件库找
}
// 等沙盒把新组件编好、发回素材库（最多等 3 秒）
const nextCatalog = () => new Promise((res) => { const off = S.runner.on('catalog', () => { off(); res(); }); setTimeout(() => { off(); res(); }, 3000); });

function useComponent(type, id, add = false) {
  const st = S.store;
  if (type === 'skin') { st.change((p) => { bring(p, 'skin', id); p.skin = { component: id, params: {} }; }); return; }
  const sel = st.layer();
  const single = type === 'face';
  let target = !add && (sel?.type === type ? sel : single || type === 'motion' ? st.first(type) : null);
  if (target && !add) {
    st.change((p) => { bring(p, type, id); const l = p.layers.find((x) => x.id === target.id); l.component = id; l.params = {}; if (type === 'face') l.face = null; });
    st.select(target.id);
  } else {
    const nid = newId(type[0]);
    if (st.change((p) => { bring(p, type, id); p.layers.push({ id: nid, type, component: id }); })) st.select(nid);
  }
}

// 素材库小图：一次重画里要的先攒起来，再一批 12 张地问沙盒（两批之间沙盒能喘口气，手机上不卡）；正在要的不重复要
const thumbWait = new Map();
let thumbFlush = null;
function thumbOf(kind, id) {
  const key = `${kind}:${id}`;
  if (S.thumbCache.has(key)) return Promise.resolve(S.thumbCache.get(key));
  if (!thumbWait.has(key)) {
    let res, rej; const p = new Promise((a, b) => { res = a; rej = b; });
    thumbWait.set(key, { p, res, rej, kind, id, sent: false });
    thumbFlush ||= Promise.resolve().then(flushThumbs);
  }
  return thumbWait.get(key).p;
}
async function flushThumbs() {
  thumbFlush = null;
  const byKind = new Map();
  for (const w of thumbWait.values()) if (!w.sent) { w.sent = true; if (!byKind.has(w.kind)) byKind.set(w.kind, []); byKind.get(w.kind).push(w); }
  const size = S.perfInfo?.quality?.thumb || 96;
  for (const [kind, ws] of byKind) for (let i = 0; i < ws.length; i += 12) {
    const part = ws.slice(i, i + 12);
    try {
      const { bitmaps } = await S.runner.request({ type: 'thumbs', kind, ids: part.map((w) => w.id), size });
      part.forEach((w, k) => { S.thumbCache.set(`${kind}:${w.id}`, bitmaps[k]); thumbWait.delete(`${kind}:${w.id}`); w.res(bitmaps[k]); });
    } catch (e) { for (const w of part) { thumbWait.delete(`${kind}:${w.id}`); w.rej(e); } }
  }
}
// 组件有变化（改了自己的道具、皮肤…）：小图作废，下次重画时重新画
function dropThumbs() { for (const b of S.thumbCache.values()) b?.close?.(); S.thumbCache.clear(); }

const favKey = (type, id) => `${type}:${id}`;
const originTag = (m) => (m.origin === 'builtin' ? null : m.origin.startsWith('repo:') ? '工坊' : m.origin.startsWith('override:') ? '改过' : m.origin.startsWith('shared:') ? '工程自带' : '自己的');
function star(key, label) {
  const on = lib.isFav(key);
  return el('button', { class: 'st-star', type: 'button', 'aria-pressed': String(on), 'aria-label': `${on ? '取消收藏' : '收藏'}：${label}`, title: on ? '取消收藏' : '收藏', 'data-ax': 'fav', onclick: (e) => { e.stopPropagation(); lib.toggleFav(key); } }, icon('star'));
}

// 一个素材：主按钮（点了用上）+ 收藏 + 「再叠一层」。thumb：表情 / 道具 / 帽子 / 皮肤画一张小图
function entry(type, meta, { active, onUse, onAdd, thumb, error }) {
  const tag = originTag(meta);
  const c = thumb ? el('canvas', { width: 96, height: 96, class: 'st-thumb loading', 'aria-hidden': 'true' }) : null;
  const main = el('button', { class: 'st-item-main', type: 'button', 'aria-pressed': String(!!active), title: `${meta.name}（${meta.id}）${meta.description ? '：' + meta.description : ''}`, 'data-ax': 'use', onclick: onUse },
    c,
    el('span', { class: 'st-item-name', text: meta.name }),
    tag ? el('em', { class: 'st-tag', text: tag }) : null, error ? el('em', { class: 'st-tag err', text: '出错' }) : null);
  if (c) thumbOf(thumb, meta.id).then((b) => { if (b) c.getContext('2d').drawImage(b, 0, 0, 96, 96); c.classList.remove('loading'); }).catch(() => c.classList.remove('loading'));
  return el('div', { class: `st-item ${c ? 'thumb' : ''} ${active ? 'on' : ''}`, 'data-ax': 'item', 'data-type': type, 'data-id': meta.id, 'data-origin': meta.origin },
    main, star(favKey(type, meta.id), meta.name),
    onAdd ? el('button', { class: 'st-plus', type: 'button', 'aria-label': `再叠一层：${meta.name}`, title: '再加一层（叠加）', 'data-ax': 'add-layer', onclick: onAdd }, icon('plus')) : null);
}
const match = (m, q) => !q || m.name.toLowerCase().includes(q) || m.id.includes(q);
// 收藏的排在最前面一组；「只看收藏」时只留这一组
function withFavs(type, list, render, rest) {
  const fav = list.filter((m) => lib.isFav(favKey(type, m.id)));
  const out = [];
  if (fav.length) out.push(el('h4', {}, icon('star', 'tiny'), '收藏'), render(fav));
  if (!S.favOnly) out.push(...rest());
  else if (!fav.length) out.push(el('p', { class: 'st-empty', text: '这一类还没有收藏。点素材右上角的星星收藏。' }));
  return out;
}
const grid = (items, cls = 'list') => el('div', { class: `st-grid ${cls}` }, ...items);

async function renderDrawer() {
  if (!S.drawerBody) return;
  const k = S.drawer, q = S.search.value.trim().toLowerCase(), body = S.drawerBody, st = S.store;
  const used = (type) => new Set(st.p.layers.filter((l) => l.type === type).map((l) => l.component));
  const errKeys = new Set(S.errors.map((e) => e.key));
  S.drawerCount.textContent = '';
  const seq = S.drawerSeq = (S.drawerSeq || 0) + 1;
  if (k === 'templates') {
    await loadGallery();
    if (seq !== S.drawerSeq) return;                           // 等的时候换了分类 / 重画过了
    const items = G.items.filter((it) => !it.special && (!q || it.search.includes(q)) && (!S.favOnly || lib.isFav(`tpl:${it.key}`)));
    S.drawerCount.textContent = `${items.length} 张`;
    const card = (it) => el('div', { class: 'st-item thumb tpl', 'data-ax': 'item', 'data-type': 'template', 'data-id': it.key },
      el('button', { class: 'st-item-main', type: 'button', title: it.text, 'data-ax': 'use', onclick: () => S.store.replace(fromRecipe(it)) },
        el('img', { src: it.still, alt: '', loading: 'lazy', decoding: 'async', width: 96, height: 96 }), el('span', { class: 'st-item-name', text: it.text })),
      star(`tpl:${it.key}`, it.text));
    const favs = items.filter((it) => lib.isFav(`tpl:${it.key}`)), rest = S.favOnly ? [] : items.filter((it) => !lib.isFav(`tpl:${it.key}`));
    fill(body,
      el('div', { class: 'st-row' }, btn('空白开始', '从一个空白工程开始', () => S.store.replace(STARTER()), { cls: 'small', ico: 'file', ax: 'blank' }), btn('随机', '随机拼一张', randomize, { cls: 'small', ico: 'dice', ax: 'random' })),
      el('p', { class: 'st-note', text: '正式表情都能当模板：点一下就打开它的配方，改哪儿都行。' }),
      favs.length ? [el('h4', {}, icon('star', 'tiny'), '收藏'), grid(favs.map(card), 'thumbs')] : null,
      rest.length ? grid(rest.slice(0, 120).map(card), 'thumbs') : null,
      rest.length > 120 ? el('p', { class: 'st-note', text: '还有更多，搜一下文字。' }) : null,
      S.favOnly && !favs.length ? el('p', { class: 'st-empty', text: '还没有收藏的模板。' }) : null);
    return;
  }
  if (k === 'text') {
    const texts = st.p.layers.filter((l) => l.type === 'text');
    const anims = (S.catalog.get('textanim') || []).filter((m) => match(m, q));
    const sel = st.layer()?.type === 'text' ? st.layer() : null;
    const animEntry = (m) => entry('textanim', m, { active: sel?.component === m.id, error: errKeys.has(`textanim:${m.id}`), onUse: () => applyToText((l) => { l.component = m.id; }, 'textanim', m.id) });
    fill(body,
      ...texts.map((l) => {
        const inp = el('input', { class: 'input st-textinput', value: l.text, maxlength: 24, placeholder: '写点字', 'aria-label': `文字图层 ${l.id}`, 'data-ax': `text:${l.id}` });
        inp.addEventListener('input', () => quietly('drawer', () => st.change((p) => { p.layers.find((x) => x.id === l.id).text = inp.value; }, { coalesce: `text:${l.id}` })));
        inp.addEventListener('focus', () => st.select(l.id));
        return el('div', { class: 'st-textrow' }, inp, btn('删掉这行字', '删掉这行字', () => st.change((p) => { p.layers = p.layers.filter((x) => x.id !== l.id); }), { ico: 'trash', ax: 'remove-text', hideLabel: true }));
      }),
      btn('再加一行字', '再加一行字', () => { const nid = newId('t'); st.change((p) => p.layers.push({ id: nid, type: 'text', component: 'stay', text: '再来一行', y: 200 + 60 * texts.length, scale: 0.7 })); st.select(nid); }, { cls: 'small', ico: 'plus', ax: 'add-text' }),
      el('p', { class: 'st-note', text: '「/」可以手动换行。选中一行字后，下面的颜色和动画会用在它身上。' }),
      el('h4', { text: '字色' }), styleRow(),
      el('h4', { text: '字体' }), fontRow(),
      el('h4', { text: `文字动画（${anims.length}）` }),
      ...withFavs('textanim', anims, (l) => grid(l.map(animEntry)), () => {
        const own = anims.filter((m) => m.origin !== 'builtin'), base = anims.filter((m) => m.origin === 'builtin');
        return [own.length ? el('h4', { text: '工坊下载 / 自己写的' }) : null, own.length ? grid(own.map(animEntry)) : null, grid(base.map(animEntry))];
      }));
    return;
  }
  if (k === 'skin') {
    const skins = S.catalog.get('skin') || [];
    const sk = (m) => entry('skin', m, { thumb: 'skin', active: st.p.skin.component === m.id, error: errKeys.has(`skin:${m.id}`), onUse: () => useComponent('skin', m.id) });
    fill(body, ...withFavs('skin', skins, (l) => grid(l.map(sk), 'thumbs'), () => [grid(skins.map(sk), 'thumbs')]),
      el('p', { class: 'st-note', text: '皮肤的颜色可以在右边属性里调；想要更花的效果，去「工坊」新建一个皮肤写 tint。' }));
    return;
  }
  if (k === 'workshop') { renderWorkshop(body, q); return; }
  if (k === 'model') {
    const cur = st.p.model.component, mine = libModels();
    const tile = (id, name, desc, extra = null) => el('div', { class: `st-model ${cur === id ? 'on' : ''}`, 'data-ax': 'model-item', 'data-id': id },
      el('button', { class: 'st-model-main', type: 'button', 'aria-pressed': String(cur === id), 'data-ax': `model:${id}`, onclick: (e) => chooseModel(id, e.currentTarget) },
        el('i', { class: 'st-wsico t-model' }, icon('model')), el('span', { class: 'st-model-text' }, el('b', { text: name }), el('small', { text: desc }))), extra);
    const face = el('input', { type: 'checkbox', checked: (st.p.model.face ?? (cur === 'axolotl' || cur === 'logo')) ? true : null, 'data-ax': 'model-face' });
    face.addEventListener('change', () => st.change((p) => { p.model.face = face.checked; }));
    S.drawerCount.textContent = `${mine.length + 1} 个`;
    fill(body,
      tile('axolotl', '原版体素', '内置 · 表情包用的那只：逐像素的方块，鳃和尾巴是 1 像素的薄片'),
      ...mine.map((e) => tile(e.id, e.name, `${e.from === 'repo' ? '工坊 · 能发布' : '载入的文件 · 只在这台设备上'}${e.kb ? ` · ${e.kb} KB` : ''}`,
        btn('删除', `从这台设备上删掉模型「${e.name}」`, () => deleteFromLibrary(e.origin), { cls: 'small danger', ico: 'trash', ax: 'model-remove', hideLabel: true }))),
      cur !== 'axolotl' && !mine.some((e) => e.id === cur) ? tile(cur, S.models.get(cur)?.name || cur.replace(/^file:/, ''), '这个工程用的（不在你的库里）') : null,
      el('div', { class: 'st-row' },
        btn('去工坊找模型', '工坊里的全部模型', () => { S.wsTab = 'browse'; S.wsFilter = 'model'; openDrawer('workshop'); }, { cls: 'small primary', ico: 'bag', ax: 'models-workshop' }),
        btn('载入模型文件', '载入 .glb / .gltf 模型文件（存在这台设备上）', () => pickFile('.glb,.gltf'), { cls: 'small', ico: 'open', ax: 'load-model' })),
      el('label', { class: 'st-field check' }, face, el('span', { text: '在头的正面画表情（别的模型脸不在那儿的话关掉）' })),
      el('h4', {}, icon('move', 'tiny'), '大小和位置'), modelControls('drawer'),
      el('p', { class: 'st-note', text: '工坊里的模型「添加」后存在这台设备的库里，用了也能发布到工坊；自己载入的模型文件也存在库里，但只在这台设备上能用。能用 Blockbench 做的方块模型：节点名叫 head、body、tail、leg1～leg4、top_gills、left_gills、right_gills 的会跟着动作动，其他的跟着身体走。只支持贴图和数据都内嵌在文件里的 .glb / .gltf，模型会自动缩放到和原版差不多大。' }));
    return;
  }
  const list = (S.catalog.get(k) || []).filter((m) => match(m, q));
  S.drawerCount.textContent = `${list.length} 个`;
  const u = used(k);
  const thumbKind = k === 'face' || k === 'prop' || k === 'wear' ? k : null;
  const one = (m) => entry(k, m, { thumb: thumbKind, active: u.has(m.id), error: errKeys.has(`${k}:${m.id}`), onUse: () => useComponent(k, m.id), onAdd: k === 'face' ? null : () => useComponent(k, m.id, true) });
  const view = (l) => grid(l.map(one), thumbKind ? 'thumbs' : 'list');
  const groups = k === 'motion' ? [['身体', (m) => !CAT.motions[m.id]?.prop && !CAT.motions[m.id]?.noHold && !CAT.motions[m.id]?.offscreen],
    ['拿着道具的', (m) => CAT.motions[m.id]?.prop || CAT.motions[m.id]?.noHold], ['中途离开画面的', (m) => CAT.motions[m.id]?.offscreen]] : [['', () => true]];
  fill(body, ...withFavs(k, list, view, () => {
    const own = list.filter((m) => m.origin !== 'builtin');
    return [
      own.length ? el('h4', { text: '工坊下载 / 自己写的' }) : null, own.length ? view(own) : null,
      ...groups.flatMap(([title, f]) => { const g = list.filter((m) => m.origin === 'builtin' && f(m)); return g.length ? [title ? el('h4', { text: title }) : null, view(g)] : []; }),
      el('p', { class: 'st-note', text: k === 'motion' ? '点一下换掉当前动作；点「＋」再叠一个动作上去（比如点头 + 摇尾巴），在时间轴上还能让它只动一段。' : k === 'face' ? '点一下换表情；在右边属性里还能左右眼、嘴分开挑。' : '点一下换掉选中的；「＋」再加一个。' }),
    ];
  }));
}

// 刚载入 / 从工坊拿来的组件：直接用上
function applyNew(type, id) {
  if (!type || !id) return;
  if (type === 'scene') { const nid = newId('s'); if (S.store.change((p) => { bring(p, 'scene', id); p.layers.push({ id: nid, type: 'scene', component: id }); })) S.store.select(nid); }
  else if (type === 'textanim') applyToText((l) => { l.component = id; }, 'textanim', id);
  else useComponent(type, id);
}

let modelPick = 0;                                             // 选模型要等载入：只认最后一次选的
async function chooseModel(id, b = null) {
  const my = ++modelPick;
  const ok = await busy(b, ensureModel(id));
  if (my !== modelPick || !ok) return false;
  const face = libModels().find((e) => e.id === id)?.face ?? S.repo?.find((c) => c.type === 'model' && c.id === id)?.face;
  S.store.change((p) => { p.model = { component: id, face: typeof face === 'boolean' && id !== 'logo' ? face : null }; });
  return true;
}

// 模型整体的大小、位置、角度、左右镜像（素材栏「模型」和工程设置里都有）。panel：在哪个面板里，拖滑块时那个面板不重建
function modelControls(panel) {
  const st = S.store, M = st.p.model;
  const set = (fn, key) => quietly(panel, () => st.change((p) => fn(p.model), { coalesce: `model:${key}` }));
  const flip = btn('左右镜像', '左右翻过来', () => st.change((p) => { p.model.flip = !p.model.flip; }), { cls: 'small', ico: 'flip', ax: 'model-flip' });
  flip.setAttribute('aria-pressed', String(!!M.flip));
  return el('div', { class: 'st-modelctl' },
    control({ label: '大小', min: 0.3, max: 2.5, step: 0.05 }, M.scale, (v) => set((m) => { m.scale = v; }, 'scale'), 'model-scale'),
    control({ label: '左右（像素）', min: -256, max: 256, type: 'int' }, M.x, (v) => set((m) => { m.x = v; }, 'x'), 'model-x'),
    control({ label: '上下（像素）', min: -256, max: 256, type: 'int' }, M.y, (v) => set((m) => { m.y = v; }, 'y'), 'model-y'),
    control({ label: '旋转（度）', min: -180, max: 180, type: 'int' }, M.rot, (v) => set((m) => { m.rot = v; }, 'rot'), 'model-rot'),
    el('div', { class: 'st-row' }, flip,
      btn('复位', '大小、位置、角度、镜像都回到默认', () => st.change((p) => { Object.assign(p.model, { x: 0, y: 0, scale: 1, rot: 0, flip: false }); }), { cls: 'small', ico: 'reset', ax: 'model-reset' })),
    el('p', { class: 'st-note', text: '也可以直接在预览上拖（没选中文字的时候拖的是模型），滚轮或者双指捏合缩放。叠在动作上面：动作照样动，只是整体挪了位置。' }));
}

function styleRow() {
  const l = S.store.layer(), cur = l?.type === 'text' ? l.style : null, mine = /^#[0-9a-f]{6}$/i.test(cur || '');
  const pick = el('input', { type: 'color', value: mine ? cur : '#ff7ab6', 'aria-label': '自己挑字色', 'data-ax': 'style:custom' });
  pick.addEventListener('input', () => {                       // 拖颜色盘时一直在变：合并成一步撤销，这一块不重建（不然颜色盘会关掉）
    const t = S.store.layer()?.type === 'text' ? S.store.layer() : S.store.first('text');
    if (t) quietly('all', () => S.store.change((p) => { p.layers.find((x) => x.id === t.id).style = pick.value; }, { coalesce: `style:${t.id}` }));
    else applyToText((x) => { x.style = pick.value; });
  });
  return el('div', { class: 'style-picks', role: 'group', 'aria-label': '字色' }, ...Object.entries(CAT.styles).map(([k, zh]) => {
    const [c, d] = STYLE_COLORS[k];
    return el('button', { class: 'swatch', type: 'button', title: zh + '字', 'aria-label': `${zh}字`, 'data-ax': `style:${k}`, 'aria-pressed': String(cur === k), style: `--c:${c};--d:${d}`, onclick: () => applyToText((x) => { x.style = k; }) });
  }), el('label', { class: `swatch custom ${mine ? 'on' : ''}`, title: '自己挑颜色（描边和阴影自动配）', style: mine ? `--c:${cur}` : null }, pick));
}
function applyToText(fn, type, id) {
  const st = S.store;
  let l = st.layer();
  if (l?.type !== 'text') l = st.first('text');
  if (!l) { const nid = newId('t'); st.change((p) => { p.layers.push({ id: nid, type: 'text', component: 'stay', text: '美西螈' }); }); l = st.layer(nid); }
  st.change((p) => { if (type) bring(p, type, id); fn(p.layers.find((x) => x.id === l.id)); });
  st.select(l.id);
}

// ---------------- 工坊：大家 PR 进来的组件（全部列出来）+ 这台设备上的组件库 ----------------
// 「添加」= 下载到这台设备的组件库（浏览器缓存 / IndexedDB），之后在它那一类里就能用；「删除」= 从浏览器里真的删掉
async function loadRepo() {
  if (S.repo) return S.repo;
  try {
    const r = await fetch('components/index.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    S.repo = await r.json();
    if (!Array.isArray(S.repo)) throw new Error('index.json 格式不对');
  } catch (e) { S.repo = null; throw new Error(`工坊没加载出来（${e.message}）`); }
  return S.repo;
}
const repoOrigin = (c) => `repo:${c.file}`;

async function addFromRepo(c, use = false) {
  if (c.type === 'model') return addModelFromRepo(c, use);
  try {
    const r = await fetch(`components/${encodeURIComponent(c.file)}`, { cache: 'no-store' });     // 不进浏览器的 HTTP 缓存：组件库里那份就是唯一的一份
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const source = await r.text();
    const compiled = nextCatalog();
    markJustAdded(repoOrigin(c));
    await lib.put({ origin: repoOrigin(c), source, from: 'repo', file: c.file, id: c.id, type: c.type, name: c.name, author: c.author, version: c.version, description: c.description });
    toast(`「${c.name}」已经下载到组件库${c.type === 'scene' ? '：在「工坊 · 我的组件库」里点「用上」' : `：在「${KIND[c.type] || c.type}」里就能找到`}`);
    if (use) { await compiled; applyNew(c.type, c.id); }      // 等沙盒编完再用
  } catch (e) { toast(`没下载下来：${e.message}`); throw e; }   // 按钮那边吞掉，axo.workshop.add() 能拿到失败
}

// 工坊里的模型：下载 .glb、先让沙盒读一遍（读不出来就不存），再存进库
async function addModelFromRepo(c, use = false) {
  try {
    if (!/^[\w.-]+\.glb$/.test(c.file || '')) throw new Error('模型文件名不对');
    const r = await fetch(`models/${encodeURIComponent(c.file)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const bytes = await r.arrayBuffer();
    const m = await S.runner.request({ type: 'model', id: c.id, bytes: bytes.slice(0) });
    if (!m.ok) throw new Error(`模型读不出来：${m.message}`);
    S.models.set(c.id, { name: c.name, bytes, info: `${m.quads} 个面片` });
    markJustAdded(repoOrigin(c));
    await lib.put({ origin: repoOrigin(c), kind: 'model', type: 'model', id: c.id, name: c.name, bytes, face: !!c.face, from: 'repo', file: c.file, author: c.author, version: c.version, description: c.description, kb: Math.round(bytes.byteLength / 1024) });
    toast(`模型「${c.name}」已经下载到库里：在「模型」里就能换上`);
    if (use) await chooseModel(c.id);
  } catch (e) { toast(`没下载下来：${e.message}`); throw e; }
}
// 刚添加的那张卡片闪一下（列表会重画，按钮上的转圈跟着没了，靠这个让人看到加上了）
function markJustAdded(origin) { S.justAdded = origin; clearTimeout(S.justTimer); S.justTimer = setTimeout(() => { S.justAdded = null; }, 1500); }

// 真的删掉：组件库（IndexedDB）里删掉这一条；当前工程里用到它的图层一起拿掉（文字只换回默认动画，字留着）
async function deleteFromLibrary(origin, { confirmFirst = true } = {}) {
  const e = lib.get(origin), st = S.store;
  if (e?.kind === 'model' || e?.kind === 'font') {                // 模型 / 字体：用到它的地方换回默认的
    const n = e.kind === 'model' ? Number(st.p.model.component === e.id) : st.p.layers.filter((l) => l.font === e.id).length;
    const what = e.kind === 'model' ? '模型' : '字体';
    if (confirmFirst && !await ask(`删除${what}「${e.name}」`, `会从这台设备浏览器的库里彻底删掉${n ? `，当前工程${e.kind === 'model' ? '会换回原版模型' : `里用到它的 ${n} 行字会换回默认字体`}` : ''}。${e.from === 'repo' ? '工坊里的原件不受影响，想要可以再添加。' : '想再用得重新载入文件。'}`, '删除', 'danger')) return false;
    if (n) st.change((p) => { if (e.kind === 'model') p.model = { component: 'axolotl', face: null }; else for (const l of p.layers) if (l.font === e.id) delete l.font; });
    if (e.kind === 'model') S.models.delete(e.id); else { S.fontsSent.delete(e.id); pickFaces.delete(e.id); }
    try { await lib.remove(origin); } catch (er) { toast(`没删掉：${er.message}`); return false; }
    toast(`删掉了${what}「${e.name}」`);
    return true;
  }
  let defs = [...S.catalog.values()].flat().filter((m) => m.origin === origin);
  if (!defs.length && e) { const d = lib.describe(e.source); defs = [{ type: e.type || d.type, id: e.id || d.id }]; }   // 编译失败的组件不在素材库里：按组件库里记的类型和 id 找
  const hits = (l) => defs.some((m) => (m.type === l.type || (m.type === 'textanim' && l.type === 'text')) && m.id === l.component);
  const n = st.p.layers.filter(hits).length + (defs.some((m) => m.type === 'skin' && m.id === st.p.skin.component) ? 1 : 0);
  const name = e?.name || origin;
  if (confirmFirst && !await ask(`删除「${name}」`, `会从这台设备浏览器的组件库里彻底删掉${n ? `，当前工程里用到它的 ${n} 处也会一起拿掉` : ''}。工坊里的原件不受影响，想要可以再添加。`, '删除', 'danger')) return false;
  // 先改工程（草稿是同步存的），再删组件库：中途关掉页面，最多是组件库里还剩一条，不会出现「删了的组件又回到工程里」
  if (n || st.p.components.some((c) => c.origin === origin)) {
    st.change((p) => {
      p.components = p.components.filter((c) => c.origin !== origin);
      p.layers = p.layers.filter((l) => l.type === 'text' || !hits(l));
      for (const l of p.layers) if (l.type === 'text' && hits(l)) l.component = 'stay';
      if (defs.some((m) => m.type === 'skin' && m.id === p.skin.component)) p.skin = { component: 'lucy', params: {} };
    });
  }
  try { await lib.remove(origin); } catch (er) { toast(`没删掉：${er.message}`); return false; }
  toast(`删掉了「${name}」`);
  return true;
}

function useFromLibrary(e) {
  if (!e) { toast('组件库里已经没有它了（可能在别的标签页里删了）'); return; }
  const d = lib.describe(e.source);
  if (!S.store.change((p) => addSource(p, e.origin))) return;
  applyNew(e.type || d.type, e.id || d.id);
  toast(`用上了「${e.name || d.name || d.id}」`);
}

function renderWorkshop(body, q) {
  const tabs = el('div', { class: 'st-seg', role: 'tablist', 'aria-label': '工坊' }, ...[['browse', '工坊里的全部'], ['mine', '我的组件库']].map(([k, t]) =>
    el('button', { type: 'button', role: 'tab', 'aria-selected': String(S.wsTab === k), 'data-ax': `workshop-tab:${k}`, onclick: () => { S.wsTab = k; renderDrawer(); } }, t)));
  if (S.wsTab === 'mine') { fill(body, tabs, ...renderLibrary(q)); return; }
  const kinds = ['all', 'fav', 'added', 'scene', 'model', 'motion', 'fx', 'textanim', 'face', 'prop', 'wear', 'skin'];
  const label = { all: '全部', fav: '收藏', added: '已添加', ...KIND };
  const filters = el('div', { class: 'chips st-filters', role: 'group', 'aria-label': '分类' }, ...kinds.map((k) =>
    el('button', { class: 'chip small', type: 'button', 'aria-pressed': String(S.wsFilter === k), 'data-ax': `workshop-filter:${k}`, onclick: () => { S.wsFilter = k; renderDrawer(); } }, k === 'fav' ? icon('star', 'tiny') : null, label[k])));
  const listBox = el('div', { class: 'st-wslist', 'aria-busy': 'true' }, ...Array.from({ length: 4 }, () => el('div', { class: 'st-wscard skeleton', 'aria-hidden': 'true' }, el('i'), el('b'), el('span'))));
  fill(body, tabs, filters, listBox);
  loadRepo().then((repo) => {
    if (S.drawer !== 'workshop' || S.wsTab !== 'browse') return;
    const f = S.wsFilter;
    const items = repo.filter((c) => (!q || `${c.name} ${c.id} ${c.description} ${c.author}`.toLowerCase().includes(q))
      && (f === 'all' || (f === 'fav' ? lib.isFav(favKey(c.type, c.id)) : f === 'added' ? lib.has(repoOrigin(c)) : c.type === f))
      && (!S.favOnly || lib.isFav(favKey(c.type, c.id))));
    S.drawerCount.textContent = `${items.length} / ${repo.length} 个`;
    listBox.removeAttribute('aria-busy');
    fill(listBox, items.length ? el('div', { class: 'st-wslist', role: 'list', 'aria-label': '工坊里的组件和模型' }, ...items.map(wsCard)) : el('p', { class: 'st-empty', text: repo.length ? '没有符合条件的。' : '工坊里还没有组件。' }),
      el('p', { class: 'st-note' }, '工坊就是仓库里的 workshop/components（组件）和 workshop/models（模型）文件夹，大家用 PR 往里加。自己写的组件在代码面板里「提交到工坊」就能开 PR。'));
  }).catch(() => { listBox.removeAttribute('aria-busy'); fill(listBox, el('p', { class: 'st-empty', text: '工坊没加载出来，过会儿再试。' }), btn('重试', '重新加载', () => { S.repo = null; renderDrawer(); }, { cls: 'small', ax: 'retry' })); });
}

function wsCard(c) {
  const added = lib.has(repoOrigin(c)), kind = KIND[c.type] || c.type, model = c.type === 'model';
  const use = model ? (e) => chooseModel(c.id, e.currentTarget) : () => useFromLibrary(lib.get(repoOrigin(c)));
  return el('article', { class: `st-wscard ${added ? 'added' : ''} ${added && S.justAdded === repoOrigin(c) ? 'just' : ''}`, role: 'listitem', 'data-ax': 'workshop-item', 'data-type': c.type, 'data-id': c.id, 'data-file': c.file, 'aria-label': `${kind}：${c.name}` },
    el('div', { class: 'st-wshead' },
      el('i', { class: `st-wsico t-${c.type}` }, icon(TYPE_ICON[c.type] || 'fx')),
      el('div', { class: 'st-wstitle' }, el('b', { text: c.name }), el('small', { text: [kind, c.author && `by ${c.author}`, c.version && `v${c.version}`, c.kb && `${c.kb} KB`].filter(Boolean).join(' · ') })),
      star(favKey(c.type, c.id), c.name)),
    c.description ? el('p', { class: 'st-wsdesc', text: c.description }) : null,
    el('div', { class: 'st-row' }, added
      ? [btn(model ? '换上' : '用上', model ? '换成这个模型' : '用到当前工程里', use, { cls: 'small primary', ico: 'check', ax: 'workshop-use' }),
        c.version && lib.get(repoOrigin(c))?.version && lib.get(repoOrigin(c)).version !== c.version
          ? btn(`更新到 v${c.version}`, '工坊里有新版本：下载新版本替换库里这份', (e) => busy(e.currentTarget, addFromRepo(c)).catch(() => {}), { cls: 'small', ico: 'download', ax: 'workshop-update' }) : null,
        btn('删除', '从这台设备的库里删掉', (e) => busy(e.currentTarget, deleteFromLibrary(repoOrigin(c))), { cls: 'small danger', ico: 'trash', ax: 'workshop-remove' })]
      : [btn('添加', '下载到这台设备的库', (e) => busy(e.currentTarget, addFromRepo(c)).catch(() => {}), { cls: 'small primary', ico: 'download', ax: 'workshop-add' }),
        btn(model ? '添加并换上' : '添加并用上', '下载并马上用到当前工程', (e) => busy(e.currentTarget, addFromRepo(c, true)).catch(() => {}), { cls: 'small', ico: 'plus', ax: 'workshop-add-use' })]));
}

function renderLibrary(q) {
  const st = S.store;
  const items = libComponents().filter((e) => !q || `${e.name} ${e.id} ${e.origin}`.toLowerCase().includes(q)).filter((e) => !S.favOnly || lib.isFav(favKey(e.type, e.id)));
  const assets = [...libModels(), ...libFonts()].filter((e) => !q || `${e.name} ${e.id}`.toLowerCase().includes(q));
  S.drawerCount.textContent = `${items.length + assets.length} 个`;
  const assetRow = (e) => el('div', { class: 'st-libitem', 'data-ax': 'library-item', 'data-origin': e.origin, 'data-type': e.kind, 'data-id': e.id },
    el('div', { class: 'st-wshead' },
      el('i', { class: `st-wsico t-${e.kind}` }, icon(e.kind === 'model' ? 'model' : 'text')),
      el('div', { class: 'st-wstitle' }, el('b', { text: e.name || e.id, style: e.kind === 'font' ? `font-family:${fontCssOf(e.id)}` : null }), el('small', { text: [e.kind === 'model' ? '模型' : '字体', e.from === 'repo' ? '工坊下载' : '从文件载入', e.kb && `${e.kb} KB`].filter(Boolean).join(' · ') }))),
    el('div', { class: 'st-row' },
      e.kind === 'model' ? btn('换上', '换成这个模型', (ev) => chooseModel(e.id, ev.currentTarget), { cls: 'small primary', ico: 'check', ax: 'library-use' })
        : btn('用上', '用到选中的文字', () => applyFont(e.id), { cls: 'small primary', ico: 'check', ax: 'library-use' }),
      btn('删除', '从这台设备上彻底删掉', () => deleteFromLibrary(e.origin), { cls: 'small danger', ico: 'trash', ax: 'library-remove', hideLabel: true })));
  const newSel = el('select', { class: 'select', 'aria-label': '新建组件', 'data-ax': 'new-component', onchange: (e) => { if (e.target.value) newComponent(e.target.value); e.target.value = ''; } },
    el('option', { value: '', text: '＋ 新建组件…' }), ...Object.keys(TEMPLATES).map((t) => el('option', { value: t, text: `新建${ZH[t]}` })));
  const byKind = new Map();
  for (const e of items) { const k = e.type === 'scene' ? 'scene' : e.type || 'other'; if (!byKind.has(k)) byKind.set(k, []); byKind.get(k).push(e); }
  const row = (e) => el('div', { class: 'st-libitem', 'data-ax': 'library-item', 'data-origin': e.origin, 'data-type': e.type, 'data-id': e.id },
    el('div', { class: 'st-wshead' },
      el('i', { class: `st-wsico t-${e.type}` }, icon(TYPE_ICON[e.type] || 'fx')),
      el('div', { class: 'st-wstitle' }, el('b', { text: e.name || e.id || e.origin }), el('small', { text: [KIND[e.type] || e.type, { repo: '工坊下载', mine: '自己写的', file: '从文件载入' }[e.from] || ''].filter(Boolean).join(' · ') })),
      star(favKey(e.type, e.id), e.name || e.id)),
    el('div', { class: 'st-row' },
      btn('用上', '用到当前工程里', () => useFromLibrary(e), { cls: 'small primary', ico: 'check', ax: 'library-use' }),
      btn('下载', '下载成 .axo.js 文件', () => download(new Blob([e.source], { type: 'text/javascript' }), `${e.origin.replace(/^\w+:/, '').replace(/\.axo\.js$/, '')}.axo.js`), { cls: 'small', ico: 'download', ax: 'library-download', hideLabel: true }),
      e.from !== 'repo' ? btn('提交到工坊', '开一个 PR 把它加进工坊', () => proposeComponent(e.source, e.id || e.origin.replace(/^\w+:/, '')), { cls: 'small', ico: 'publish', ax: 'library-propose' }) : null,
      btn('删除', '从这台设备上彻底删掉', () => deleteFromLibrary(e.origin), { cls: 'small danger', ico: 'trash', ax: 'library-remove', hideLabel: true })));
  const inProject = st.p.components.filter((c) => !lib.has(c.origin)).map((c) => el('li', {}, el('code', { text: c.origin }),
    btn('存到组件库', '存到这台设备的组件库（当成自己的组件）', () => lib.put({ origin: /^(mine|file):/.test(c.origin) ? c.origin : `mine:${lib.describe(c.source).id || c.origin.split(':').pop()}`, source: c.source, from: 'mine' }).then(() => toast('存进组件库了')).catch((er) => toast(`没存上：${er.message}`)), { cls: 'small', ax: 'project-component-save' }),
    btn('移出工程', '从这个工程里拿掉这段代码', () => st.dropComponent(c.origin), { cls: 'small', ax: 'project-component-drop' })));
  const order = ['scene', 'motion', 'fx', 'textanim', 'face', 'prop', 'wear', 'skin'];
  return [
    el('div', { class: 'st-row' }, btn('载入组件文件…', '载入 .axo.js 组件文件', () => pickFile('.js,.axo.js,text/javascript'), { cls: 'small primary', ico: 'open', ax: 'load-component' }), newSel),
    el('p', { class: 'st-note', text: '这里是存在这台设备浏览器里的组件：从工坊下载的、自己写的、从文件载入的。下载的动作 / 特效 / 文字动画会出现在对应的那一类里；整帧的场景组件（比如水龙卷）在这里点「用上」。' }),
    ...[...byKind.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b)).flatMap((k) => [el('h4', { text: `${KIND[k] || '其他'}（${byKind.get(k).length}）` }), el('div', { class: 'st-wslist' }, ...byKind.get(k).map(row))]),
    items.length ? null : el('p', { class: 'st-empty', text: S.favOnly ? '组件库里没有收藏的。' : '组件库是空的：去「工坊里的全部」添加，或者新建一个。' }),
    assets.length && !S.favOnly ? [el('h4', { text: `模型和字体（${assets.length}）` }), el('div', { class: 'st-wslist' }, ...assets.map(assetRow))] : null,
    inProject.length ? [el('h4', { text: '这个工程自带、但不在组件库里的代码' }), el('ul', { class: 'st-list' }, ...inProject)] : null,
  ];
}

// ---------------- 图层菜单 ----------------
function addMenu(anchor) {
  const menu = el('div', { class: 'st-menu', role: 'menu' }, ...['motion', 'fx', 'text', 'prop', 'wear'].map((t) => el('button', { type: 'button', role: 'menuitem', onclick: () => {
    menu.remove();
    if (t === 'text') { const nid = newId('t'); S.store.change((p) => p.layers.push({ id: nid, type: 'text', component: 'stay', text: '新的一行', y: 300, scale: 0.7 })); S.store.select(nid); return; }
    openDrawer(t); toast(`在左边「${ZH[t]}」里点「＋」加一层`);
  } }, `＋ ${ZH[t]}`)));
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = `${Math.min(r.left, innerWidth - 180)}px`; menu.style.top = `${r.bottom + 4 + scrollY}px`;
  anchor.setAttribute('aria-expanded', 'true');
  const close = () => { menu.remove(); anchor.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', off); };
  const off = (e) => { if (!menu.contains(e.target)) close(); };
  menu.addEventListener('keydown', (e) => {                    // Esc 关掉、上下键挑
    const items = [...menu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { close(); anchor.focus(); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); e.preventDefault(); }
  });
  menu.querySelector('button')?.focus();
  setTimeout(() => document.addEventListener('click', off));
}

// ---------------- 时间轴 ----------------
function renderTimeline() {
  if (!S.timeline || S.dock !== 'timeline') return;
  const st = S.store, N = S.N, errKeys = new Set(S.errors.map((e) => e.key));
  const ticks = el('div', { class: 'tl-ticks' }, ...Array.from({ length: N }, (_, i) => el('i', { class: i % 5 === 0 ? 'major' : '' })));
  const ruler = el('div', { class: 'tl-ruler', title: '点或拖来定位' }, ticks);
  const scrubAt = (e) => { const r = ruler.getBoundingClientRect(); seek(Math.floor(((e.clientX - r.left) / r.width) * N)); };
  ruler.addEventListener('pointerdown', (e) => { ruler.setPointerCapture(e.pointerId); scrubAt(e); ruler.onpointermove = scrubAt; });
  ruler.addEventListener('pointerup', () => { ruler.onpointermove = null; });
  const rows = st.p.layers.map((l, idx) => {
    const sel = st.selected === l.id, timed = TIMED.has(l.type);
    const label = el('button', { class: 'tl-label', type: 'button', onclick: () => st.select(sel ? null : l.id), title: '选中这一层', 'aria-pressed': String(sel), 'data-ax': 'layer-select' },
      el('i', { class: 'tl-dot', style: `background:${TCOLOR[l.type] || '#999'}` }),
      el('span', { text: l.type === 'text' ? `「${l.text || '…'}」` : nameOf(l.type, l.component) }),
      el('small', { text: ZH[l.type] || l.type }), errKeys.has(`${l.type}:${l.component}`) ? el('em', { class: 'st-tag err', text: '!' }) : null);
    const eye = el('button', { class: 'tl-eye', type: 'button', title: l.hidden ? '显示' : '隐藏', 'aria-label': `${l.hidden ? '显示' : '隐藏'}${ZH[l.type] || ''}「${l.type === 'text' ? l.text : nameOf(l.type, l.component)}」`, 'aria-pressed': String(!l.hidden), 'data-ax': 'layer-visible', onclick: () => st.change((p) => { const x = p.layers[idx]; x.hidden = !x.hidden; }) }, icon(l.hidden ? 'eyeoff' : 'eye'));
    const bar = el('div', { class: `tl-bar ${timed ? '' : 'static'}`, style: `left:${l.start * 100}%;width:${(l.end - l.start) * 100}%;--c:${TCOLOR[l.type] || '#999'}` },
      timed ? el('i', { class: 'h l' }) : null, timed ? el('i', { class: 'h r' }) : null,
      l.strength !== 1 && timed ? el('small', { text: `×${l.strength}` }) : null);
    const track = el('div', { class: 'tl-track' }, bar);
    if (timed) dragBar(bar, track, l);
    track.addEventListener('pointerdown', (e) => { if (e.target === track) st.select(l.id); });
    return el('div', { class: `tl-row ${sel ? 'sel' : ''} ${l.hidden ? 'off' : ''}`, 'data-ax': 'layer', 'data-layer': l.id, 'data-type': l.type, 'data-component': l.component }, eye, label, track);
  });
  fill(S.timeline,
    el('div', { class: 'tl-row tl-head' }, el('span'), el('span', { class: 'tl-label static', text: `${S.N} 帧 · ${S.fps} fps` }), el('div', { class: 'tl-film' })),
    el('div', { class: 'tl-row tl-head' }, el('span'), el('span', { class: 'tl-label static', text: '' }), ruler),
    ...rows,
    rows.length ? null : el('p', { class: 'st-note', text: '还没有图层，从左边素材里点一个。' }));
  drawFilmstrip(); updateCounter();
}
function dragBar(bar, track, l) {
  bar.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();                   // 先不选中：选中会重画时间轴，正在拖的条就没了。松手时再选
    const r = track.getBoundingClientRect(), mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'm';
    const x0 = e.clientX, s0 = l.start, e0 = l.end, step = 1 / S.N;
    const snap = (v) => Math.round(v / step) * step;
    bar.setPointerCapture(e.pointerId);
    bar.onpointermove = (ev) => {
      const d = (ev.clientX - x0) / r.width;
      let s = s0, en = e0;
      if (mode === 'l') s = Math.min(snap(s0 + d), e0 - step);
      else if (mode === 'r') en = Math.max(snap(e0 + d), s0 + step);
      else { const w = e0 - s0; s = snap(Math.min(Math.max(0, s0 + d), 1 - w)); en = s + w; }
      s = Math.max(0, s); en = Math.min(1, en);
      bar.style.left = `${s * 100}%`; bar.style.width = `${(en - s) * 100}%`;
      bar.dataset.s = s; bar.dataset.e = en;
    };
    bar.onpointerup = bar.onpointercancel = (ev) => {
      bar.onpointermove = bar.onpointerup = bar.onpointercancel = null;
      if (bar.dataset.s !== undefined && ev.type === 'pointerup') {
        const s = +bar.dataset.s, en = +bar.dataset.e;
        S.store.change((p) => { const x = p.layers.find((y) => y.id === l.id); x.start = s; x.end = en; });
      }
      S.store.select(l.id);
    };
  });
}

// ---------------- 属性面板 ----------------
function control(spec, value, onInput, key) {
  const t = spec.type || 'number', ax = `field:${key}`;
  if (t === 'bool') {
    const c = el('input', { type: 'checkbox', checked: value ? true : null, 'data-ax': ax });
    c.addEventListener('change', () => onInput(c.checked ? 1 : 0));
    return el('label', { class: 'st-field check' }, c, el('span', { text: spec.label || key }));
  }
  if (t === 'select') {
    const s = el('select', { class: 'select', 'data-ax': ax }, ...(spec.options || []).map(([v, l]) => el('option', { value: JSON.stringify(v), text: l, selected: JSON.stringify(v) === JSON.stringify(value) ? true : null })));
    s.addEventListener('change', () => onInput(JSON.parse(s.value)));
    return el('label', { class: 'st-field' }, el('span', { text: spec.label || key }), s);
  }
  if (t === 'color') {
    const c = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff', 'data-ax': ax });
    c.addEventListener('input', () => onInput(c.value));
    return el('label', { class: 'st-field row' }, el('span', { text: spec.label || key }), c);
  }
  if (t === 'icon') {
    const s = el('select', { class: 'select', 'data-ax': ax }, ...iconList().map((k) => el('option', { value: k, text: `${CAT.icons[k] || CAT.holds[k] || k}（${k}）`, selected: k === value ? true : null })));
    s.addEventListener('change', () => onInput(s.value));
    return el('label', { class: 'st-field' }, el('span', { text: spec.label || key }), s);
  }
  if (t === 'text') {
    const i = el('input', { class: 'input', value: value ?? '', 'data-ax': ax });
    i.addEventListener('input', () => onInput(i.value));
    return el('label', { class: 'st-field' }, el('span', { text: spec.label || key }), i);
  }
  const min = spec.min ?? 0, max = spec.max ?? 100, step = t === 'int' ? 1 : spec.step ?? (max - min > 20 ? 1 : 0.01);
  const r = el('input', { type: 'range', min, max, step, value: value ?? spec.default ?? min, class: 'st-range', 'aria-label': spec.label || key, 'data-ax': `${ax}:range` });
  const n = el('input', { type: 'number', min, max, step, value: value ?? spec.default ?? min, class: 'st-num', 'aria-label': `${spec.label || key}（数值）`, 'data-ax': ax });
  r.addEventListener('input', () => { n.value = r.value; onInput(Number(r.value)); });
  n.addEventListener('change', () => { r.value = n.value; onInput(Number(n.value)); });
  return el('label', { class: 'st-field' }, el('span', { text: spec.label || key }), el('div', { class: 'st-rangebox' }, r, n));
}
function iconList() {
  const props = (S.catalog.get('prop') || []).map((m) => m.id);
  return [...new Set(['heart', 'star', 'flower', 'note', 'mail', 'money', 'diamond', 'question', 'exclaim', 'check', 'cross', 'thumb', 'plus1', 'bulb', 'snow', 'leaf', 'flame', 'drop', 'clock', 'bug', 'skull', 'ghost', 'swirl', 'z', 'cloud', 'dark', 'moon', 'sun', 'creeper', 'lemon', 'pin', 'arrow', 'brokenheart', ...props])];
}
const group = (title, ...kids) => el('section', { class: 'st-group' }, el('h3', { text: title }), ...kids);

function renderInspector() {
  if (!S.inspector) return;
  const st = S.store, l = st.layer();
  if (!l) { renderProjectInspector(); return; }
  const set = (fn, key) => quietly('inspector', () => st.change((p) => fn(p.layers.find((x) => x.id === l.id)), { coalesce: `${l.id}:${key}` }));
  const idx = st.p.layers.indexOf(l);
  const metas = l.type === 'text' ? (S.catalog.get('textanim') || []) : (S.catalog.get(l.type) || []);
  const meta = metaOf(l.type === 'text' ? 'textanim' : l.type, l.component);
  const comp = el('select', { class: 'select', 'data-ax': 'field:component' }, ...metas.map((m) => el('option', { value: m.id, text: m.name, selected: m.id === l.component ? true : null })));
  comp.addEventListener('change', () => st.change((p) => { bring(p, l.type === 'text' ? 'textanim' : l.type, comp.value); const x = p.layers.find((y) => y.id === l.id); x.component = comp.value; x.params = {}; }));
  const kids = [
    el('div', { class: 'st-insphead', 'data-ax': 'inspector', 'data-layer': l.id }, el('i', { class: 'tl-dot', style: `background:${TCOLOR[l.type]}` }), el('b', { text: ZH[l.type] }),
      el('span', { class: 'st-grow' }),
      btn('往上挪', '往上挪（先画）', () => moveLayer(idx, -1), { ico: 'up', ax: 'layer-up', hideLabel: true }),
      btn('往下挪', '往下挪（后画）', () => moveLayer(idx, 1), { ico: 'down', ax: 'layer-down', hideLabel: true }),
      btn('复制一层', '复制一层（Ctrl+D）', () => duplicateLayer(l), { ico: 'copy', ax: 'layer-duplicate', hideLabel: true }),
      btn('删掉这一层', '删掉（Delete）', () => { st.change((p) => { p.layers.splice(idx, 1); }); st.select(null); }, { cls: 'danger', ico: 'trash', ax: 'layer-delete', hideLabel: true }),
      btn('取消选中', '取消选中，看工程设置', () => st.select(null), { ico: 'close', ax: 'deselect', hideLabel: true })),
  ];
  if (l.type === 'text') {
    const inp = el('input', { class: 'input st-textinput', value: l.text, maxlength: 24, 'aria-label': '文字', 'data-ax': 'inspector-text' });
    inp.addEventListener('input', () => set((x) => { x.text = inp.value; }, 'text'));
    kids.push(group('文字', inp, el('p', { class: 'st-note', text: '「/」手动换行。' }), styleRow(),
      el('div', { class: 'st-field' }, el('span', { text: '字体' }), fontRow()),
      el('label', { class: 'st-field' }, el('span', { text: '动画' }), comp),
      control({ label: '上下位置', min: 0, max: 512, type: 'int' }, l.y, (v) => set((x) => { x.y = v; }, 'y'), 'y'),
      control({ label: '左右位置', min: -256, max: 256, type: 'int' }, l.x, (v) => set((x) => { x.x = v; }, 'x'), 'x'),
      control({ label: '大小', min: 0.3, max: 2, step: 0.05 }, l.scale, (v) => set((x) => { x.scale = v; }, 'scale'), 'scale')));
  } else if (l.type === 'face') {
    const f = l.face || metaOf('face', l.component)?.face || {};
    const part = (key, label, options) => {
      const s = el('select', { class: 'select', 'data-ax': `field:${key}` }, ...options.map(([v, t]) => el('option', { value: v, text: t, selected: (f[key] || options[0][0]) === v ? true : null })));
      s.addEventListener('change', () => set((x) => { x.face = { ...(x.face || f), [key]: s.value }; }, key));
      return el('label', { class: 'st-field' }, el('span', { text: label }), s);
    };
    const EYE = { open: '睁眼', closed: '闭眼', happy: '眯眼笑', squeeze: '使劲闭', star: '星星眼', big: '大眼', tiny: '小眼', angry: '生气', sad: '难过', heart: '爱心眼', cry: '哭', teary: '泪汪汪', meh: '无语', flat: '一条线', sleep: '睡着', up: '往上看', side: '斜眼', money: '钱眼', x: '叉叉眼', dizzy: '转圈眼', wink: '眨一只' };
    const MOUTH = { normal: '普通', smile: '微笑', o: '张嘴 O', flat: '一字', frown: '撇嘴', wavy: '波浪嘴', shout: '大喊', w: 'w 嘴', tongue: '吐舌', grin: '咧嘴笑', drool: '流口水', eat: '吃东西', none: '没有嘴' };
    const eyes = Object.entries(EYE).map(([v, t]) => [v, `${t}（${v}）`]);
    const mouths = Object.entries(MOUTH).map(([v, t]) => [v, `${t}（${v}）`]);
    const blush = el('input', { type: 'checkbox', checked: f.blush ? true : null, 'data-ax': 'field:blush' });
    blush.addEventListener('change', () => set((x) => { x.face = { ...(x.face || f), blush: blush.checked }; }, 'blush'));
    const blink = el('input', { type: 'checkbox', checked: l.blink !== false ? true : null, 'data-ax': 'field:blink' });
    blink.addEventListener('change', () => set((x) => { x.blink = blink.checked; }, 'blink'));
    kids.push(group('表情', el('label', { class: 'st-field' }, el('span', { text: '预设' }), comp),
      el('p', { class: 'st-note', text: '下面可以拆开拼：左眼、右眼、嘴各挑各的。' }),
      part('L', '左眼（画面右边）', eyes), part('R', '右眼（画面左边）', eyes), part('mouth', '嘴', mouths),
      el('label', { class: 'st-field check' }, blush, el('span', { text: '腮红' })), el('label', { class: 'st-field check' }, blink, el('span', { text: '会眨眼（只有睁眼时）' })),
      l.face ? el('button', { class: 'st-btn small', type: 'button', onclick: () => set((x) => { x.face = null; }, 'reset') }, '回到预设') : null));
  } else {
    kids.push(group(nameOf(l.type, l.component), el('label', { class: 'st-field' }, el('span', { text: '组件' }), comp),
      meta?.description ? el('p', { class: 'st-note', text: meta.description }) : null,
      el('div', { class: 'st-row' }, el('button', { class: 'st-btn small', type: 'button', onclick: () => setDock('code') }, '看 / 改代码'))));
  }
  if (l.type === 'wear') {                                     // 帽子默认戴在它本来的位置；这里可以挪、缩放、转
    const q = l.params || {}, def = { gx: 0, gy: 0, gz: 0, gs: 1, rx: 0, ry: 0, rz: 0 };
    const lab = { gx: '左右', gy: '上下', gz: '前后', gs: '大小', rx: '前后翻', ry: '左右转', rz: '歪' };
    const rg = { gx: [-12, 12], gy: [-8, 14], gz: [-14, 14], gs: [0.3, 2.5], rx: [-90, 90], ry: [-180, 180], rz: [-90, 90] };
    kids.push(group('戴在哪', ...Object.keys(def).map((k) => control({ label: lab[k], min: rg[k][0], max: rg[k][1], step: k === 'gs' ? 0.02 : 0.5 }, q[k] ?? def[k], (v) => set((x) => { x.params = { ...x.params, [k]: v }; }, k), k)),
      el('div', { class: 'st-row' }, btn('复位', '回到帽子本来的位置', () => set((x) => { x.params = {}; }, 'reset'), { cls: 'small', ico: 'reset', ax: 'wear-reset' })),
      el('p', { class: 'st-note', text: '单位是模型像素（头大约 8 像素宽）。默认就是帽子本来戴的位置。' })));
  }
  if (l.type === 'prop') {
    const q = l.params || {}, sprite = !!metaOf('prop', l.component)?.sprite;
    const def = { x: 4.8, y: 7.4, z: -13, rx: 0, ry: 0, rz: -10, s: sprite ? 0.62 : 0.9 };
    const lab = { x: '左右', y: '上下', z: '前后', rx: '前后翻', ry: '左右转', rz: '歪', s: '大小' };
    const rng = { x: [-12, 12], y: [-4, 16], z: [-22, 4], rx: [-180, 180], ry: [-180, 180], rz: [-180, 180], s: [0.2, 2] };
    kids.push(group('拿在哪', ...Object.keys(def).map((k) => control({ label: lab[k], min: rng[k][0], max: rng[k][1], step: k === 's' ? 0.02 : 0.1 }, q[k] ?? def[k], (v) => set((x) => { x.params = { ...x.params, [k]: v }; }, k), k)),
      el('p', { class: 'st-note', text: '单位是模型像素，脸在 z = -10，头顶 y = 9。动作是「挥工具」「看书」这类时，道具由动作自己拿。' })));
  }
  if (meta?.params && Object.keys(meta.params).length && l.type !== 'prop') {
    kids.push(group('参数', ...Object.entries(meta.params).filter(([, sp]) => !sp.hidden).map(([k, sp]) =>
      control(sp, l.params?.[k] ?? sp.default, (v) => set((x) => { x.params = { ...x.params, [k]: v }; }, `p:${k}`), k))));
  }
  if (TIMED.has(l.type)) {
    kids.push(group('时间和强度',
      control({ label: l.type === 'motion' ? '强度（0 = 不动，2 = 加倍）' : '不透明度', min: 0, max: l.type === 'motion' ? 2 : 1, step: 0.05 }, l.strength, (v) => set((x) => { x.strength = v; }, 'strength'), 'strength'),
      control({ label: '从第几帧开始', min: 0, max: S.N - 1, type: 'int' }, Math.round(l.start * S.N), (v) => set((x) => { x.start = Math.min(v / S.N, x.end - 1 / S.N); }, 'start'), 'start'),
      control({ label: '到第几帧结束', min: 1, max: S.N, type: 'int' }, Math.round(l.end * S.N), (v) => set((x) => { x.end = Math.max(v / S.N, x.start + 1 / S.N); }, 'end'), 'end'),
      el('p', { class: 'st-note', text: '时间轴上也能直接拖条的两头。只动一段的动作，两头会自然过渡。' })));
  }
  fill(S.inspector, ...kids);
}
// 复制 / 粘贴一层（Ctrl+D / Ctrl+C / Ctrl+V）：新 id，插在原来那层（或者选中的那层）后面
function duplicateLayer(l) { pasteLayer(l, S.store.p.layers.indexOf(l) + 1); }
function pasteLayer(src, at = null) {
  const st = S.store, nid = newId(src.type[0]), sel = st.layer();
  const i = at ?? (sel ? st.p.layers.indexOf(sel) + 1 : st.p.layers.length);
  if (st.change((p) => { bring(p, src.type === 'text' ? 'textanim' : src.type, src.component); p.layers.splice(i, 0, { ...structuredClone(src), id: nid }); })) st.select(nid);
}
function moveLayer(i, d) {
  const j = i + d;
  S.store.change((p) => { if (j < 0 || j >= p.layers.length) return; [p.layers[i], p.layers[j]] = [p.layers[j], p.layers[i]]; });
}

function renderProjectInspector() {
  const st = S.store, P = st.p;
  const set = (fn, key) => quietly('inspector', () => st.change(fn, { coalesce: `proj:${key}` }));
  const skinMeta = metaOf('skin', P.skin.component);
  const skinSel = el('select', { class: 'select' }, ...(S.catalog.get('skin') || []).map((m) => el('option', { value: m.id, text: m.name, selected: m.id === P.skin.component ? true : null })));
  skinSel.addEventListener('change', () => st.change((p) => { p.skin = { component: skinSel.value, params: {} }; }));
  const bgSel = el('select', { class: 'select', 'data-ax': 'field:background' }, ...[['white', '白色'], ['transparent', '透明（GIF 背景透明）'], ['color', '纯色'], ['gradient', '上下渐变']].map(([v, t]) => el('option', { value: v, text: t, selected: v === P.background.mode ? true : null })));
  bgSel.addEventListener('change', () => st.change((p) => { p.background.mode = bgSel.value; }));
  fill(S.inspector, 
    el('div', { class: 'st-insphead' }, el('b', { text: '工程设置' }), el('span', { class: 'st-grow' }), el('small', { class: 'st-note', text: '选中图层看它的属性' })),
    group('画面',
      control({ label: '导出尺寸（像素）', min: 120, max: 800, type: 'int' }, P.size, (v) => set((p) => { p.size = v; }, 'size'), 'size'),
      control({ label: '帧率', min: 6, max: 30, type: 'int' }, P.fps, (v) => set((p) => { p.fps = v; }, 'fps'), 'fps'),
      control({ label: '一圈多少帧', min: 8, max: 120, type: 'int' }, P.frames, (v) => set((p) => { p.frames = v; }, 'frames'), 'frames'),
      el('p', { class: 'st-note', text: `一圈 ${(P.frames / P.fps).toFixed(2)} 秒。正式表情是 48 帧 15 fps。` }),
      el('label', { class: 'st-field' }, el('span', { text: '背景' }), bgSel),
      P.background.mode === 'color' || P.background.mode === 'gradient' ? control({ label: P.background.mode === 'gradient' ? '上面的颜色' : '背景色', type: 'color' }, P.background.color, (v) => set((p) => { p.background.color = v; }, 'bgc'), 'bgc') : null,
      P.background.mode === 'gradient' ? control({ label: '下面的颜色', type: 'color' }, P.background.color2 || '#ffe3f0', (v) => set((p) => { p.background.color2 = v; }, 'bgc2'), 'bgc2') : null),
    group('皮肤', el('label', { class: 'st-field' }, el('span', { text: '皮肤' }), skinSel),
      ...Object.entries(skinMeta?.params || {}).map(([k, sp]) => control(sp, P.skin.params?.[k] ?? sp.default, (v) => set((p) => { p.skin.params = { ...p.skin.params, [k]: v }; }, `skin:${k}`), k))),
    group('镜头',
      control({ label: '朝向（度）', min: -180, max: 540, type: 'int' }, P.camera.yaw, (v) => set((p) => { p.camera.yaw = v; }, 'yaw'), 'yaw'),
      control({ label: '俯视（度）', min: -30, max: 80, type: 'int' }, P.camera.pitch, (v) => set((p) => { p.camera.pitch = v; }, 'pitch'), 'pitch'),
      control({ label: '远近', min: 0.4, max: 2.5, step: 0.02 }, P.camera.zoom, (v) => set((p) => { p.camera.zoom = v; }, 'zoom'), 'zoom'),
      control({ label: '透视', min: 0, max: 0.5, step: 0.01 }, P.camera.persp, (v) => set((p) => { p.camera.persp = v; }, 'persp'), 'persp')),
    group('水面',
      control({ type: 'bool', label: '有水' }, P.water.on ? 1 : 0, (v) => set((p) => { p.water.on = !!v; }, 'won'), 'won'),
      control({ label: '水面高度', min: 250, max: 512, type: 'int' }, P.water.level, (v) => set((p) => { p.water.level = v; }, 'wl'), 'wl'),
      control({ label: '波浪', min: 0, max: 3, step: 0.05 }, P.water.calm, (v) => set((p) => { p.water.calm = v; }, 'calm'), 'calm'),
      control({ type: 'color', label: '水的颜色' }, P.water.color, (v) => set((p) => { p.water.color = v; }, 'wc'), 'wc'),
      control({ type: 'bool', label: '气泡' }, P.water.bubbles ? 1 : 0, (v) => set((p) => { p.water.bubbles = !!v; }, 'wb'), 'wb'),
      control({ type: 'bool', label: '波纹' }, P.water.ripples ? 1 : 0, (v) => set((p) => { p.water.ripples = !!v; }, 'wr'), 'wr')),
    group('待机（每个动作底下都有它）',
      control({ label: '抬头', min: -30, max: 50, type: 'int' }, P.idle.look, (v) => set((p) => { p.idle.look = v; }, 'look'), 'look'),
      control({ label: '鳃扇动', min: 0, max: 3, step: 0.05 }, P.idle.gill, (v) => set((p) => { p.idle.gill = v; }, 'gill'), 'gill'),
      control({ label: '尾巴摆', min: 0, max: 3, step: 0.05 }, P.idle.tail, (v) => set((p) => { p.idle.tail = v; }, 'tail'), 'tail'),
      control({ label: '划水', min: 0, max: 3, step: 0.05 }, P.idle.paddle, (v) => set((p) => { p.idle.paddle = v; }, 'paddle'), 'paddle'),
      control({ label: '上下浮', min: 0, max: 20, step: 0.5 }, P.idle.bob, (v) => set((p) => { p.idle.bob = v; }, 'bob'), 'bob')),
    group('模型的大小和位置', modelControls('inspector')),
    group('随机', control({ label: '随机种子（气泡、星星的位置）', min: 0, max: 999, type: 'int' }, P.seed, (v) => set((p) => { p.seed = v; }, 'seed'), 'seed')));
}

// ---------------- 代码面板 ----------------
function setDock(d) {
  S.dock = d;
  for (const b of S.dockTabs.querySelectorAll('.st-tab')) b.setAttribute('aria-selected', String(b.dataset.d === d));
  S.timeline.hidden = d !== 'timeline'; S.codePane.hidden = d !== 'code';
  if (d === 'timeline') { renderTimeline(); scheduleFilmstrip(); }
  if (d === 'code') loadCode();
  if (matchMedia('(max-width: 900px)').matches) setMobile(d);
}
// 手机 / 平板竖屏：面板在舞台下面，点了页签要滚过去才看得见
function revealPanel(k) {
  const target = { drawer: '.st-drawer', inspector: '.st-inspector', timeline: '.st-dock', code: '.st-dock' }[k];
  requestAnimationFrame(() => S.root.querySelector(target)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
}
function setMobile(k) {
  S.root.dataset.m = k;
  for (const b of S.mobileTabs.querySelectorAll('.st-tab')) b.setAttribute('aria-selected', String(b.dataset.m === k));
  if ((k === 'timeline' || k === 'code') && S.dock !== k) setDock(k);
}

let codeMod = null, codeTimer;
async function ensureEditor() {
  if (S.code) return S.code;
  S.codeHead = el('div', { class: 'st-codehead' });
  S.codeErr = el('div', { class: 'st-codeerr', hidden: true });
  const host = el('div', { class: 'st-codehost' });
  fill(S.codePane, S.codeHead, host, S.codeErr);
  codeMod ||= await import('./code.js');
  S.code = codeMod.createEditor(host, {
    onChange: (src) => { clearTimeout(codeTimer); codeTimer = setTimeout(() => runCode(src), 600); },
    onRun: () => { clearTimeout(codeTimer); runCode(S.code.value); },
  });
  return S.code;
}
// 这个组件在工程里「改过」的那一份：内置 / 工坊组件改了存成 override:类型:id；自己的组件（mine: / file:）直接改工程里那份
function ownCopy(type, id) {
  const comps = S.store.p.components, m = metaOf(type, id);
  return comps.find((c) => c.origin === `override:${type}:${id}`)
    || (m && /^(mine|file):/.test(m.origin) ? comps.find((c) => c.origin === m.origin && c.source !== lib.get(m.origin)?.source) : null) || null;
}
async function loadCode() {
  if (S.dock !== 'code') return;
  clearTimeout(codeTimer);                                     // 还没跑的改动属于上一个组件：作废
  const ed = await ensureEditor();
  const l = S.store.layer();
  let type, id;
  if (l) { type = l.type === 'text' ? 'textanim' : l.type; id = l.component; } else { type = 'skin'; id = S.store.p.skin.component; }
  const r = await S.runner.request({ type: 'source', ctype: type, id });
  const m = metaOf(type, id), own = ownCopy(type, id);
  const editOrigin = own ? own.origin : m && /^(mine|file):/.test(m.origin) ? m.origin : `override:${type}:${id}`;
  S.codeTarget = { type, id, origin: editOrigin, r };
  ed.set(own ? own.source : r.source || `// 没找到组件 ${type}:${id} 的源码`);
  ed.readOnly(!own && !r.source);                               // 找不到源码时别让人在提示文字上改（改了会被当成组件存进工程）
  codeHead();
  showErrors();
}
// 代码面板的标题栏：改过没有、能不能还原。改代码之后也要更新（不重新载入编辑器里的内容）
function codeHead() {
  const t = S.codeTarget, ed = S.code;
  if (!t || !ed) return;
  const { type, id, r } = t, own = ownCopy(type, id), name = nameOf(type, id);
  fill(S.codeHead,
    el('span', { class: 'st-codetitle' }, el('b', { text: `${ZH[type]}「${name}」` }), el('small', { text: own ? ' · 这个工程里改过' : r.builtin ? ' · 内置（改了只影响这个工程）' : ` · ${r.origin || ''}${r.origin ? '（改了只影响这个工程）' : ''}` })),
    el('span', { class: 'st-grow' }),
    btn('运行', '运行（Ctrl+Enter）', () => runCode(ed.value), { cls: 'small primary', ico: 'play', ax: 'code-run' }),
    own && (own.origin.startsWith('override:') || lib.get(own.origin)) ? btn('还原', '丢掉这个工程里的改动', () => revertCode(own), { cls: 'small', ico: 'undo', ax: 'code-revert' }) : null,
    btn('另存为组件', '存到这台设备的组件库', () => saveAsMine(ed.value, type), { cls: 'small', ico: 'save', ax: 'code-save-as' }),
    btn('下载', '下载成 .axo.js 文件', () => download(new Blob([ed.value], { type: 'text/javascript' }), `${id}.axo.js`), { cls: 'small', ico: 'download', ax: 'code-download', hideLabel: true }),
    btn('提交到工坊', '开一个 PR 把它加进工坊', () => proposeComponent(ed.value, id), { cls: 'small', ico: 'publish', ax: 'code-propose' }));
}
// 还原：改过的内置组件撤掉、换回内置的；改过的工坊 / 组件库组件撤掉 override，沙盒会把组件库那份重新编进来；自己的组件换回组件库里那份
async function revertCode(own) {
  const { type, id } = S.codeTarget, done = nextCatalog();
  if (own.origin.startsWith('override:')) {
    const builtin = metaOf(type, id)?.origin === 'builtin' || S.codeTarget.r.builtin;
    S.store.dropComponent(own.origin);
    if (builtin) S.runner.post({ type: 'remove', ctype: type, id });
  } else {
    const e = lib.get(own.origin);
    if (e) S.store.putComponent(own.origin, e.source);
  }
  await done; loadCode();
}
function runCode(src) {
  const t = S.codeTarget;
  if (!t) return;
  S.store.putComponent(t.origin, src);
  setTimeout(codeHead);                                        // 「改过」和「还原」马上出现
}
async function saveAsMine(src, type) {
  const m = /id:\s*['"]([^'"]+)['"]/.exec(src), n = /name:\s*['"]([^'"]+)['"]/.exec(src);
  const got = await askText('另存为组件', [['id（小写字母、数字、- 和 _）', m ? `my-${m[1].replace(/^my-/, '')}` : 'my-thing'], ['中文名', n ? `${n[1]}（我的）` : '']]);
  if (!got) return;
  const [id, nm] = got;
  if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(id)) { toast('id 只能用小写字母、数字、- 和 _'); return; }
  const name = nm || id;
  const out = src.replace(/id:\s*['"][^'"]+['"]/, `id: '${id}'`).replace(/name:\s*['"][^'"]+['"]/, `name: '${name.replace(/'/g, '’')}'`);
  const origin = `mine:${id}`;
  try { await lib.put({ origin, name, type, id, source: out, from: 'mine' }); } catch (e) { toast(`没存上：${e.message}`); return; }
  S.store.putComponent(origin, out);
  const l = S.store.layer();
  if (l && (l.type === type || (l.type === 'text' && type === 'textanim'))) S.store.change((p) => { p.layers.find((x) => x.id === l.id).component = id; });
  toast(`存好了：「${name}」。在「工坊 · 我的组件库」里能下载、提交到工坊`);
  loadCode();
}
function newComponent(type) {
  const src = TEMPLATES[type];
  const id = /id:\s*'([^']+)'/.exec(src)[1], origin = `mine:${id}-${Date.now().toString(36).slice(-4)}`;
  const fixed = src.replace(/id:\s*'([^']+)'/, (x, a) => `id: '${a}-${origin.slice(-4)}'`);
  const nid = /id:\s*'([^']+)'/.exec(fixed)[1];
  S.store.putComponent(origin, fixed);
  lib.put({ origin, name: /name:\s*'([^']+)'/.exec(fixed)[1], type, id: nid, source: fixed, from: 'mine' });
  if (type === 'skin') S.store.change((p) => { p.skin = { component: nid, params: {} }; });
  else {
    const lt = type === 'textanim' ? 'text' : type, lid = newId(lt[0]);
    S.store.change((p) => { p.layers.push(lt === 'text' ? { id: lid, type: 'text', component: nid, text: '新动画' } : { id: lid, type: lt, component: nid }); });
    S.store.select(lid);
  }
  setDock('code');
}

// ---------------- 我的工程：存在这台设备浏览器里的工程（和组件库同一个 IndexedDB，kind: project），带一张小图 ----------------
const libProjects = () => lib.list().filter((e) => e.kind === 'project');
async function saveToProjects(asNew = false) {
  const p = S.store.p;
  let thumb = null;
  try { thumb = (await S.runner.request({ type: 'export', format: 'png', size: 120 })).bytes; } catch { /* 没有小图也能存 */ }
  const origin = !asNew && S.projectKey && lib.has(S.projectKey) ? S.projectKey : `project:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await lib.put({ origin, kind: 'project', type: 'project', id: origin.slice(8), name: p.name || defaultTitle(p), project: structuredClone(p), thumb });
  S.projectKey = origin;
  return origin;
}
function showProjects() {
  const urls = [], list = el('div', { class: 'st-projgrid', 'data-ax': 'projects-list' });
  const card = (e) => {
    const url = e.thumb ? URL.createObjectURL(new Blob([e.thumb], { type: 'image/png' })) : null;
    if (url) urls.push(url);
    return el('article', { class: `st-projcard ${e.origin === S.projectKey ? 'on' : ''}`, 'data-ax': 'project-item', 'data-origin': e.origin },
      url ? el('img', { src: url, alt: '', width: 120, height: 120 }) : el('div', { class: 'st-projblank' }, icon('file')),
      el('b', { text: e.name || '未命名' }), el('small', { text: new Date(e.at).toLocaleString() }),
      el('div', { class: 'st-row' },
        btn('打开', `打开「${e.name}」`, async () => {
          if (e.origin !== S.projectKey && !await ask(`打开「${e.name}」`, '会替换掉当前的工程（当前这个可以先存进来）。', '打开')) return;
          S.store.replace(e.project); S.projectKey = e.origin; d.close(); toast(`打开了「${e.name}」`);
        }, { cls: 'small primary', ico: 'open', ax: 'project-open' }),
        btn('删除', `删掉「${e.name}」`, async () => {
          if (!await ask(`删除「${e.name}」`, '会从这台设备的浏览器里彻底删掉。', '删除', 'danger')) return;
          try { await lib.remove(e.origin); } catch (er) { toast(`没删掉：${er.message}`); return; }
          if (S.projectKey === e.origin) S.projectKey = null;
          draw();
        }, { cls: 'small danger', ico: 'trash', ax: 'project-remove', hideLabel: true })));
  };
  const draw = () => { const items = libProjects(); fill(list, items.length ? items.map(card) : el('p', { class: 'st-empty', text: '还没有存过：点下面的「存到我的工程」把当前这个存进来。' })); };
  const save = (asNew) => async () => { try { await saveToProjects(asNew); toast('存好了'); } catch (er) { toast(`没存上：${er.message}`); } draw(); return true; };
  const d = dialog('我的工程', [el('p', { class: 'st-note', text: '存在这台设备的浏览器里，换台设备就没有了：要带走的话「保存」成文件，或者用「分享」链接。' }), list], [
    [S.projectKey && lib.has(S.projectKey) ? '保存当前（覆盖）' : '存到我的工程', save(false), 'primary', 'project-save'],
    ['另存一份', save(true), '', 'project-save-new'],
  ], { onClose: () => urls.forEach((u) => URL.revokeObjectURL(u)) });
  draw();
}

// ---------------- 文件 / 分享 / 发布 / 导出 ----------------
function download(blob, name) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function saveProjectFile() {
  const p = S.store.p;
  download(new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' }), `${p.name || '美西螈'}.axo.json`);
}
function pickFile(accept = '.js,.json,.axo,.glb,.gltf,.ttf,.otf,.woff,.woff2,application/json,text/javascript') {
  const i = el('input', { type: 'file', accept, multiple: true });
  i.addEventListener('change', () => { for (const f of i.files) importFile(f); });
  i.click();
}
async function importFile(f) {
  if (/\.(ttf|otf|woff2?)$/i.test(f.name)) { await importFont(f); return; }
  if (/\.(glb|gltf)$/i.test(f.name)) {
    if (f.size > 4 << 20) { toast(`${f.name} 太大了（模型上限 4 MB）`); return; }
    const id = `file:${f.name}`.slice(0, 80), bytes = await f.arrayBuffer(), my = ++modelPick;
    const r = await S.runner.request({ type: 'model', id, bytes: bytes.slice(0) }).catch((e) => ({ ok: false, message: e.message }));
    if (!r.ok) { toast(`模型没读出来：${r.message}`); return; }
    const info = `${r.quads} 个面片 · 骨骼 ${r.bones.join(' ') || '无'}`;
    S.models.set(id, { name: f.name, bytes, info });
    await lib.put({ origin: id, kind: 'model', type: 'model', id, name: f.name.replace(/\.(glb|gltf)$/i, ''), bytes, face: false, from: 'file', info, kb: Math.round(f.size / 1024) });   // 存进库：刷新页面也还在
    if (my !== modelPick) return;                                // 载入期间又选了别的模型：以后选的为准
    S.store.change((p) => { p.model = { component: id, face: false }; });
    openDrawer('model');
    toast(`换上了 ${f.name}`);
    return;
  }
  if (f.size > 300000) { toast(`${f.name} 太大了`); return; }
  const text = await f.text();
  if (/\.json$/i.test(f.name)) {
    try { const p = JSON.parse(text); S.store.replace(p.v === 2 || p.layers ? normalizeProject(p) : fromRecipe(p)); toast(`打开了 ${f.name}`); } catch (e) { toast(`${f.name} 不是工程文件：${e.message}`); }
    return;
  }
  if (/\.js$/i.test(f.name) || text.includes('component(')) {
    if (!await ask(`载入组件「${f.name}」`, '组件是别人写的代码，会在预览沙盒里运行（碰不到这个网页和你的数据，但只载入你信任的来源）。载入后存在这台设备的组件库里。', '载入')) return;
    const s = lib.describe(text), name = s.name || f.name;
    const origin = `file:${s.type && s.id ? `${s.type}:${s.id}` : f.name.replace(/\.axo\.js$|\.js$/i, '')}`;   // 按组件本身（类型 + id）区分，同名文件不会互相顶掉
    const old = lib.get(origin);
    if (old && old.source !== text && !await ask(`替换「${old.name || s.id}」`, '组件库里已经有一个同样 id 的组件了，用这个文件替换它？', '替换')) return;
    const compiled = nextCatalog();
    try { await lib.put({ origin, name, type: s.type || '', source: text, from: 'file' }); } catch (e) { toast(`没存进组件库：${e.message}`); return; }
    await compiled;
    const err = S.compileErrors.find((e) => e.origin === origin);
    if (err || !metaOf(s.type, s.id)) { toast(`「${name}」没编译过${err ? `：${err.message}${err.line ? `（第 ${err.line} 行）` : ''}` : '（文件里没找到 component({...})）'}。已经存进组件库，在代码面板里改好再用`); return; }
    applyNew(s.type, s.id);
    toast(`载入并用上了「${name}」（也存进了「我的组件库」）`);
    return;
  }
  toast(`不认识 ${f.name}：能拖进来的是 .axo.json 工程、.axo.js 组件、.glb / .gltf 模型、.ttf / .otf / .woff2 字体`);
}

async function encodeShare(p) {
  const json = new TextEncoder().encode(JSON.stringify(p));
  if (!('CompressionStream' in window)) { let s = ''; for (let i = 0; i < json.length; i += 0x8000) s += String.fromCharCode(...json.subarray(i, i + 0x8000)); return 'j' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }   // 分块：一次展开太多会爆栈
  const buf = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return 'z' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const SHARE_MAX = 400000, SHARE_OUT_MAX = 1 << 20;            // 链接最多 40 万字符，解压出来最多 1 MB（再大就是压缩炸弹）
async function decodeShare(code) {
  if (code.length > SHARE_MAX) throw new Error('分享链接太长了');
  const raw = atob(code.slice(1).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  let out = bytes;
  if (code[0] === 'z') {
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((n += value.length) > SHARE_OUT_MAX) { reader.cancel(); throw new Error('分享的工程太大了'); }
      parts.push(value);
    }
    out = new Uint8Array(n); let o = 0; for (const v of parts) { out.set(v, o); o += v.length; }
  }
  return normalizeProject(JSON.parse(new TextDecoder().decode(out)));
}
const siteUrl = () => `${location.origin}${location.pathname}`;
// 只在这台设备上的东西（导入的字体、载入的模型文件）：别人打开链接时会换成默认的
function localOnly(p) {
  const out = [];
  if (p.model.component.startsWith('file:')) out.push(`模型「${p.model.component.slice(5)}」`);
  for (const id of new Set(p.layers.filter((l) => l.type === 'text' && l.font?.startsWith('font:')).map((l) => l.font))) out.push(`字体「${fontName(id)}」`);
  return out;
}
async function copyText(text, input) {
  try { await navigator.clipboard.writeText(text); return true; } catch { input?.select(); return false; }   // 复制不了（没权限）：选中输入框，自己按 Ctrl+C
}
async function shareLink() {
  const p = S.store.p, code = await encodeShare(p), long = `${siteUrl()}#/editor?s=${code}`;
  if (code.length > SHARE_MAX) {                               // 打开链接时会被拒绝（防压缩炸弹的上限）：别给一个打不开的链接
    dialog('工程太大了，放不进链接', [el('p', { text: `压缩后还有 ${Math.round(code.length / 1000)} K 个字符，链接最多 ${SHARE_MAX / 1000} K。点「保存」存成 .axo.json 文件发给对方，对方拖进编辑器就能打开；或者在「工坊 · 我的组件库」里把用不到的组件代码移出工程。` })], [['保存成文件', () => saveProjectFile(), 'primary']]);
    return;
  }
  const field = (value, ax, label) => el('input', { class: 'input st-linkin', value, readonly: true, 'aria-label': label, 'data-ax': ax, onfocus: (e) => e.target.select() });
  const longIn = field(long, 'share-url', '完整链接');
  const copyBtn = (input, what) => btn('复制', `复制${what}`, async (e) => { const ok = await copyText(input.value, input); const b = e.currentTarget; b.classList.add('is-done'); setTimeout(() => b.classList.remove('is-done'), 900); toast(ok ? `${what}复制好了` : '没能自动复制：已经选中了，按 Ctrl+C'); }, { cls: 'small', ico: 'copy', ax: `copy-${input.dataset.ax}` });
  const shortBox = el('div', { class: 'st-shortbox', 'data-ax': 'share-short' });
  const makeShort = async (b) => {
    let made;
    try { made = await busy(b, createShort(code)); } catch (e) { toast(`短链接没生成：${e.message}`); return; }
    const url = `${siteUrl()}#/e/${made.key}`, shortIn = field(url, 'share-short-url', '1 分钟短链接');
    const left = el('b', { class: 'st-countdown', 'data-ax': 'share-short-left' }), bar = el('i');
    fill(shortBox, el('div', { class: 'st-linkrow' }, shortIn, copyBtn(shortIn, '短链接')),
      el('div', { class: 'st-ttl' }, el('span', { class: 'st-ttlbar' }, bar), left));
    copyText(url, shortIn).then((ok) => ok && toast('短链接复制好了：1 分钟内发给对方'));
    const tick = () => {
      const s = Math.max(0, Math.ceil((made.expires - Date.now()) / 1000));
      left.textContent = s ? `还剩 ${s} 秒` : '已经失效了';
      bar.style.transform = `scaleX(${s / SHORT_TTL})`;
      if (s) return;
      clearInterval(timer); shortIn.disabled = true; shortBox.classList.add('expired'); dropShort(made);
      shortBox.append(btn('再生成一个', '再生成一个 1 分钟短链接', (e) => makeShort(e.currentTarget), { cls: 'small', ico: 'share', ax: 'share-short-again' }));
    };
    const timer = setInterval(tick, 250); tick();
  };
  fill(shortBox, btn('生成 1 分钟短链接', '短链接 1 分钟后失效', (e) => makeShort(e.currentTarget), { cls: 'small primary', ico: 'share', ax: 'share-make-short' }));
  const local = localOnly(p);
  dialog('分享工程', [
    el('h4', { text: '完整链接（一直有效）' }),
    el('div', { class: 'st-linkrow' }, longIn, copyBtn(longIn, '完整链接')),
    el('p', { class: 'st-note', text: `${long.length.toLocaleString()} 个字符：工程整个装在链接里，不经过任何服务器。${long.length > 6000 ? '有点长，有的聊天软件会截断，那就用短链接。' : ''}` }),
    el('h4', { text: '短链接（1 分钟内有效）' }), shortBox,
    el('p', { class: 'st-note', text: '工程先在你的浏览器里加密，再交给公开的中转站 ntfy.sh 存一下（它只看得到乱码，密钥只在链接里）。1 分钟后链接就打不开了，到时间这个页面还开着的话也会请中转站删掉。' }),
    local.length ? el('p', { class: 'st-warn', text: `${local.join('、')} 只在你这台设备上：别人打开时会换成默认的。` }) : null,
  ], []);
}

// 发布前先按工坊机器人的规矩查一遍（和 workshop/tools/workshop.py 的 validate_project 一致），免得提交了才被打回来
const PUB = { bytes: 60000, components: 8, component: 40000, layers: 40, texts: 4, text: 16, frames: 96 };
const PUB_TEXT = new RegExp(`^[${CAT.text.chars}/ ]*$`);
function preflight(p, json) {
  const out = [], size = (s) => new Blob([s]).size, texts = p.layers.filter((l) => l.type === 'text');
  if (!texts.some((l) => l.text.trim() && !l.hidden)) out.push('至少要有一行文字（表情包嘛）');
  if (texts.length > PUB.texts) out.push(`文字图层最多 ${PUB.texts} 个，现在有 ${texts.length} 个`);
  for (const l of texts) {
    const n = [...l.text.replace(/[/ ]/g, '')].length;
    if (n > PUB.text) out.push(`「${l.text}」太长了：最多 ${PUB.text} 个字`);
    else if (!PUB_TEXT.test(l.text)) out.push(`「${l.text}」里有工坊不支持的字符：只能用${CAT.text.hint.split('：').pop()}，用 / 换行`);
    if (!(l.style in CAT.styles) && !/^#[0-9a-f]{6}$/i.test(l.style)) out.push(`「${l.text}」的字色不对：用内置的那几种，或者自己挑一个颜色`);
  }
  if (p.layers.length > PUB.layers) out.push(`图层最多 ${PUB.layers} 个`);
  if (p.frames > PUB.frames) out.push(`工坊最多 ${PUB.frames} 帧，现在是 ${p.frames} 帧（右边「工程设置」里改）`);
  if (p.model.component !== 'axolotl' && !(S.repo || []).some((c) => c.type === 'model' && c.id === p.model.component) && p.model.component !== 'logo') out.push('自己载入的模型只在你的浏览器里，发不上去：先在「模型」里换成原版或工坊里的模型');
  for (const l of texts) if (l.font && l.font !== 'axo') { out.push(`「${l.text}」用的字体是「${fontName(l.font)}」：工坊出图只认「Axo 黑体」（在「文字 · 字体」里换回来）`); break; }
  if (p.components.length > PUB.components) out.push(`工程最多带 ${PUB.components} 段组件代码，现在有 ${p.components.length} 段`);
  for (const c of p.components) if (size(c.source) > PUB.component) out.push(`组件代码「${c.origin}」超过 ${PUB.component / 1000} KB`);
  if (size(json) > PUB.bytes) out.push(`工程太大了（${Math.round(size(json) / 1000)} KB，最多 ${PUB.bytes / 1000} KB）`);
  if (S.errors.length || S.compileErrors.length) out.push('预览里还有组件报错（看左上角的红色角标）：出图时有报错就不会发布');
  return out;
}

// 投稿链接：GitHub 的 issue 表单能用网址参数预先填好（标题、说明、工程）；授权的复选框填不了，要在 GitHub 上勾
const ISSUE_URL_MAX = 7500;
function publishUrl(p, { title, description = '' }) {
  const json = JSON.stringify(p);
  const base = `https://github.com/${REPO}/issues/new?template=workshop.yml&title=${encodeURIComponent(`[工坊] ${title}`)}${description ? `&description=${encodeURIComponent(description)}` : ''}`;
  const full = `${base}&project=${encodeURIComponent(json)}`;
  return { url: full.length <= ISSUE_URL_MAX ? full : base, fits: full.length <= ISSUE_URL_MAX, json, problems: preflight(p, json) };
}
const defaultTitle = (p) => (p.layers.find((l) => l.type === 'text' && l.text && !l.hidden)?.text || p.name || '美西螈').replace(/\//g, ' ').trim();

// 发布到工坊：在这个页面里写好标题、说明，看一眼预览和检查结果；「确定投稿」打开已经填好的 GitHub 表单
async function publish() {
  const p = S.store.p;
  await loadRepo().catch(() => {});                            // 检查模型能不能发布要用工坊清单
  const titleIn = el('input', { class: 'input', value: defaultTitle(p), maxlength: 40, 'aria-label': '标题', 'data-ax': 'publish-title' });
  const descIn = el('textarea', { class: 'input', rows: 2, maxlength: 140, placeholder: '可选：一句话介绍这张表情（显示在作品详情里）', 'aria-label': '说明', 'data-ax': 'publish-desc' });
  const agree = el('input', { type: 'checkbox', 'data-ax': 'publish-agree' });
  const checks = el('ul', { class: 'st-checks', 'data-ax': 'publish-checks', 'aria-live': 'polite' });
  const prev = el('figure', { class: 'st-pubprev', 'aria-busy': 'true' }, el('div', { class: 'st-loading' }, spinner(), el('span', { text: '出一张预览…' })));
  const count = el('small', { class: 'st-count' });
  let previewOk = null, d;
  const refresh = () => {
    const title = titleIn.value.trim(), info = publishUrl(p, { title: title || defaultTitle(p), description: descIn.value.trim() });
    const items = [
      ...info.problems.map((t) => [false, t]),
      ...(info.problems.length ? [] : [[true, `工程 ${Math.round(new Blob([info.json]).size / 1000)} KB · ${p.frames} 帧 · ${p.layers.length} 个图层${p.components.length ? ` · 带 ${p.components.length} 段组件代码（出图时在沙盒里跑，维护者也会看）` : ''}`]]),
      previewOk === false ? [false, '预览出图时组件报错了：工坊出图有报错就不会发布'] : null,
      agree.checked ? null : [false, '还没勾下面的「同意按 GPL-3.0-only 发布」（到 GitHub 上还要再勾一次）'],
    ].filter(Boolean);
    fill(checks, ...items.map(([ok, t]) => el('li', { class: ok ? 'ok' : 'bad' }, icon(ok ? 'check' : 'warn', 'tiny'), el('span', { text: t }))));
    count.textContent = `${[...titleIn.value].length} / 40`;
    const go = d?.querySelector('[data-ax="publish-go"]');
    if (go) go.disabled = !!info.problems.length || previewOk === false || !agree.checked || !title;
    return info;
  };
  for (const x of [titleIn, descIn]) x.addEventListener('input', refresh);
  agree.addEventListener('change', refresh);
  d = dialog('发布到工坊', [
    el('div', { class: 'st-pub' }, prev,
      el('div', { class: 'st-pubform' },
        el('label', { class: 'st-field' }, el('span', {}, '标题 ', count), titleIn),
        el('label', { class: 'st-field' }, el('span', { text: '说明' }), descIn),
        el('h4', { text: '检查' }), checks,
        el('label', { class: 'st-field check' }, agree, el('span', { text: '我同意这张表情（包括工程里带的组件代码）按 GPL-3.0-only 发布' })))),
    el('p', { class: 'st-note', text: '「确定投稿」会打开填好的 GitHub 发布表单（要登录 GitHub），在那边勾上「授权」点 Create 就行。提交后 GitHub Actions 在断网的容器里用同一个引擎重新出图，几分钟后出现在「工坊作品」，别人给 issue 点 👍 就是点赞。' }),
  ], [
    ['确定投稿', async () => {
      const info = refresh();
      if (!info.fits) {
        if (await copyText(info.json)) toast('工程太大放不进链接：已经复制好了，粘贴到表单的「工程」那一栏');
        else { const ta = el('textarea', { class: 'input', rows: 6, readonly: true, 'aria-label': '工程 JSON', 'data-ax': 'publish-json' }); ta.value = info.json; dialog('复制工程', [el('p', { text: '工程太大放不进链接，浏览器又不让自动复制：全选下面的内容复制，粘贴到 GitHub 表单的「工程」那一栏。' }), ta], []); setTimeout(() => ta.select()); }
      }
      window.open(info.url, '_blank', 'noopener');
      return true;
    }, 'primary', 'publish-go'],
    ['复制工程', async () => { toast(await copyText(JSON.stringify(p)) ? '工程 JSON 复制好了' : '没能复制'); return true; }, '', 'publish-copy'],
  ], { closeLabel: '取消' });
  refresh();
  try {                                                         // 预览：和工坊出图一样从第一帧开始，小一点、快一点
    const r = await S.runner.request({ type: 'export', format: 'gif', size: 200, colors: 64, maxKb: 400 });
    previewOk = !(r.errors || []).length;
    const url = URL.createObjectURL(new Blob([r.bytes], { type: r.mime }));
    fill(prev, el('img', { src: url, alt: '投稿预览', width: 200, height: 200 }), el('figcaption', { text: previewOk ? '预览（工坊会按 400px 重新出图）' : '预览里组件报错了' }));
    d.addEventListener('close', () => URL.revokeObjectURL(url));
  } catch (e) { fill(prev, el('p', { class: 'st-warn', text: `预览没出来：${e.message}` })); }
  prev.removeAttribute('aria-busy');
  refresh();
}

function proposeComponent(src, id) {
  const name = `${String(id).replace(/[^a-z0-9_-]/gi, '-')}.axo.js`;
  const header = /^\/\*\s*@axo/.test(src) ? '' : `/* @axo ${JSON.stringify({ id: (/id:\s*['"]([^'"]+)['"]/.exec(src) || [])[1] || id, type: (/type:\s*['"](\w+)['"]/.exec(src) || [])[1] || '', name: (/name:\s*['"]([^'"]+)['"]/.exec(src) || [])[1] || id, author: '你的 GitHub 名字', version: '1.0.0', description: '一句话说明' })} */\n`;
  const body = header + src;
  const url = `https://github.com/${REPO}/new/main/workshop/components?filename=${encodeURIComponent(name)}&value=${encodeURIComponent(body)}`;
  dialog('提交到工坊', [
    el('p', { text: '工坊就是仓库里的 workshop/components 文件夹。提交后 GitHub 会帮你 fork 一份并开一个 PR，维护者看过合并后，所有人都能在「工坊」里看到、添加。' }),
    el('p', { class: 'st-note', text: '文件开头的 /* @axo {...} */ 是工坊的说明卡（名字、分类、作者、说明），记得把作者和说明改成你的。' }),
    url.length > 6000 ? el('p', { class: 'st-warn', text: '代码有点长，放不进链接：先下载文件，再在打开的页面里上传。' }) : null,
  ], [
    url.length > 6000
      ? ['下载并打开上传页', () => { download(new Blob([body], { type: 'text/javascript' }), name); window.open(`https://github.com/${REPO}/upload/main/workshop/components`, '_blank', 'noopener'); }, 'primary']
      : ['在 GitHub 上新建文件', () => window.open(url, '_blank', 'noopener'), 'primary'],
    ['只下载文件', () => download(new Blob([body], { type: 'text/javascript' }), name)],
  ]);
}

function dialog(title, body, actions, { closeLabel = '关掉', onClose } = {}) {
  const d = el('dialog', { class: 'st-dialog', 'aria-label': title, 'data-ax': 'dialog' });
  d.append(el('h2', { text: title }), ...body.flat().filter(Boolean),
    el('div', { class: 'st-dlgactions' }, ...actions.map(([t, f, cls, ax]) => el('button', { class: `btn ${cls || ''}`, type: 'button', 'data-ax': ax || 'dialog-action', onclick: async (e) => {
      const b = e.currentTarget, v = f(b), keep = v instanceof Promise ? await busy(b, v) : v;   // 要等的（导出…）按钮上转圈，做完之前点不了第二次
      if (keep !== true) d.close();
    } }, t)),
      el('button', { class: 'btn', type: 'button', 'data-ax': 'dialog-close', onclick: () => d.close() }, closeLabel)));
  d.addEventListener('close', () => { onClose?.(); d.remove(); });
  document.body.append(d); d.showModal();
  return d;
}
// 网页里的「确定 / 取消」和输入框：不用浏览器自带的 confirm / prompt（会挡住页面，自动化工具和 AI 助手点不动）
function ask(title, text, ok = '确定', cls = 'primary') {
  return new Promise((res) => { let v = false; dialog(title, [el('p', { text })], [[ok, () => { v = true; }, cls, 'dialog-ok']], { closeLabel: '取消', onClose: () => res(v) }); });
}
function askText(title, fields) {
  return new Promise((res) => {
    let v = null;
    const inputs = fields.map(([label, value]) => el('input', { class: 'input', value: value ?? '', 'aria-label': label, 'data-ax': `dialog-input:${label}` }));
    const d = dialog(title, fields.map(([label], i) => el('label', { class: 'st-field' }, el('span', { text: label }), inputs[i])),
      [['确定', () => { v = inputs.map((i) => i.value.trim()); }, 'primary', 'dialog-ok']], { closeLabel: '取消', onClose: () => res(v) });
    for (const i of inputs) i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); d.querySelector('[data-ax="dialog-ok"]').click(); } });   // 回车 = 确定（输入法选字时的回车不算）
    setTimeout(() => inputs[0]?.select());
  });
}

function showExport() {
  const P = S.store.p;
  let format = 'gif', size = P.size, colors = 0, maxKb = 1000, loops = 3;
  const presets = [['原尺寸', P.size, 1000], ['微信表情 240', 240, 500], ['高清 800', 800, 4000]];
  const presetBox = el('div', { class: 'chips' }, ...presets.map(([t, s, kb], i) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(i === 0), onclick: (e) => {
    size = s; maxKb = kb; sizeIn.value = s; kbIn.value = kb;
    for (const c of presetBox.children) c.setAttribute('aria-pressed', String(c === e.currentTarget));
  } }, `${t}（${s}px）`)));
  const fmt = el('select', { class: 'select', 'data-ax': 'export-format' }, ...[['gif', 'GIF 动图'], ['video', '视频（MP4 / WebM，发朋友圈、短视频用）'], ['png-zip', '逐帧 PNG（zip）'], ['png', '当前这一帧 PNG']].map(([v, t]) => el('option', { value: v, text: t })));
  const loopIn = el('input', { class: 'input', type: 'number', min: 1, max: 10, value: loops, 'data-ax': 'export-loops' });
  loopIn.addEventListener('change', () => { loops = Math.max(1, Math.min(10, Math.round(+loopIn.value) || 3)); loopIn.value = loops; });
  const loopRow = el('label', { class: 'st-field', hidden: true }, el('span', { text: '视频里循环几遍（录的时候按真实时间走，别切走这个标签页）' }), loopIn);
  fmt.addEventListener('change', () => { format = fmt.value; loopRow.hidden = format !== 'video'; });
  const sizeIn = el('input', { class: 'input', type: 'number', min: 64, max: 800, value: size, 'data-ax': 'export-size' });
  sizeIn.addEventListener('change', () => { size = Math.max(64, Math.min(800, Math.round(+sizeIn.value) || 400)); sizeIn.value = size; });   // 写回真正会用的值
  const colSel = el('select', { class: 'select', 'data-ax': 'export-colors' }, ...[[0, '自动（64 色起，超大小就降）'], [256, '256 色'], [128, '128'], [64, '64'], [32, '32'], [16, '16']].map(([v, t]) => el('option', { value: v, text: t })));
  colSel.addEventListener('change', () => { colors = +colSel.value; });
  const kbIn = el('input', { class: 'input', type: 'number', min: 100, max: 8000, value: maxKb, 'data-ax': 'export-maxkb' });
  kbIn.addEventListener('change', () => { maxKb = Math.max(100, Math.min(8000, Math.round(+kbIn.value) || 1000)); kbIn.value = maxKb; });
  let lastUrl = null;
  const bar = el('div', { class: 'progress', hidden: true }, el('i'));
  const result = el('div', { class: 'st-result' });
  dialog('导出', [
    el('h4', { text: '预设' }), presetBox,
    el('div', { class: 'two' }, el('label', { class: 'st-field' }, el('span', { text: '格式' }), fmt), el('label', { class: 'st-field' }, el('span', { text: '边长（像素）' }), sizeIn)),
    el('div', { class: 'two' }, el('label', { class: 'st-field' }, el('span', { text: '颜色数' }), colSel), el('label', { class: 'st-field' }, el('span', { text: '大小上限（KB）' }), kbIn)),
    loopRow,
    el('p', { class: 'st-note', text: `${P.frames} 帧 · ${P.fps} fps · 第一帧是封面${P.background.mode === 'transparent' ? ' · 透明背景' : ''}` }),
    bar, result,
  ], [['开始导出', async () => {
    bar.hidden = false; bar.firstElementChild.style.width = '0%'; fill(result, el('p', { class: 'st-note', text: '一帧一帧地画…' }));
    if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null; }
    try {
      const r = await S.runner.request({ type: 'export', format, size, colors: colors || undefined, maxKb, loops }, (p) => { bar.firstElementChild.style.width = `${Math.round(p * 100)}%`; });
      const blob = new Blob([r.bytes], { type: r.mime }), url = lastUrl = URL.createObjectURL(blob);
      const ext = format === 'gif' ? 'gif' : format === 'png' ? 'png' : format === 'video' ? (r.mime.includes('mp4') ? 'mp4' : 'webm') : 'zip', fname = `${P.name || '美西螈'}.${ext}`;
      fill(result, 
        format === 'video' ? el('video', { src: url, class: 'st-resultimg', controls: true, loop: true, autoplay: true, muted: true, playsinline: true, 'aria-label': '导出的视频' })
          : format !== 'png-zip' ? el('img', { src: url, alt: '导出的结果', class: 'st-resultimg' }) : null,
        el('p', { class: 'st-note', text: `${Math.round(blob.size / 1024)} KB · 电脑上点下载；手机微信里长按图片保存。` }),
        el('div', { class: 'st-row' }, el('a', { class: 'btn primary', href: url, download: fname }, '下载'),
          navigator.canShare?.({ files: [new File([blob], fname, { type: r.mime })] }) ? el('button', { class: 'btn', type: 'button', onclick: () => navigator.share({ files: [new File([blob], fname, { type: r.mime })] }).catch(() => {}) }, '分享') : null));
    } catch (e) { fill(result, el('p', { class: 'st-warn', text: '导出失败：' + e.message })); }
    bar.hidden = true;
    return true;
  }, 'primary', 'export-start']], { onClose: () => lastUrl && URL.revokeObjectURL(lastUrl) });
}

function showKeys() {
  dialog('快捷键和自动化', [el('table', { class: 'st-keys' }, ...[
    ['空格', '播放 / 暂停'], ['← / →', '上一帧 / 下一帧'], ['Shift + ← / →', '跳 10 帧'], ['Home / End', '第一帧 / 最后一帧'],
    ['Ctrl + Z / Ctrl + Shift + Z', '撤销 / 重做'], ['Delete', '删掉选中的图层'], ['Esc', '取消选中'], ['O', '洋葱皮'],
    ['Ctrl + D', '复制选中的图层'], ['Ctrl + C / Ctrl + V', '复制 / 粘贴图层（可以贴到别的工程里）'], ['[ / ]', '选中的图层往上 / 往下挪'],
    ['在预览上拖', '挪选中的文字；没选中文字就挪模型'], ['滚轮 / 双指捏合', '缩放选中的文字或者模型'], ['Alt + 方向键', '一像素一像素地微调（加 Shift 一次 10 像素）'],
    ['Ctrl + S', '保存工程文件（在代码里是「运行」）'], ['Ctrl + Enter', '运行代码'], ['拖文件进来', '打开工程 / 载入组件'],
  ].map(([k, v]) => el('tr', {}, el('td', {}, el('kbd', { text: k })), el('td', { text: v })))),
  el('h4', {}, icon('robot', 'tiny'), ' 给 AI 助手 / 自动化脚本'),
  el('p', { class: 'st-note', text: '能在页面里执行 JavaScript 的工具可以直接调 window.axo（比点按钮稳）：axo.help() 看全部接口，axo.state() 看当前状态，axo.layers.add(\'motion\', \'hop\') 加图层，axo.export() 导出 GIF。只能点按钮的工具：每个按钮都有中文名字和 data-ax 操作名。完整说明在网站根目录的 llms.txt。' }),
  el('a', { href: 'llms.txt', target: '_blank', rel: 'noopener' }, '打开 llms.txt')], []);
}

// ---------------- 给 AI 助手 / 自动化脚本的接口：window.axo ----------------
// 浏览器里能执行 JavaScript 的 AI 工具直接调这些，比找按钮、拖滑块稳；每个函数都返回普通的 JSON 数据（或 Promise）。完整说明见 public/llms.txt。
const LAYER_TYPES = ['motion', 'face', 'prop', 'wear', 'fx', 'text', 'scene'];
function installApi() {
  const st = S.store, prevHelp = typeof window.axo?.help === 'function' ? window.axo.help : null;
  const need = (type, id) => {                                  // 组件得真的有：不然换上了才在报错里看到
    const t = type === 'text' ? 'textanim' : type;
    if (!metaOf(t, id)) throw new Error(`没有组件 ${t}:${id}（axo.catalog('${t}') 看能用的）`);
  };
  const range = (p, l) => {                                     // 时间段：0～1，开始在结束前面
    const s = p.start ?? l?.start ?? 0, e = p.end ?? l?.end ?? 1;
    if (!(s >= 0 && e <= 1 && s < e)) throw new Error(`时间段不对：start ${s}、end ${e}（要 0 ≤ start < end ≤ 1）`);
  };
  const layerInfo = (l) => ({ id: l.id, type: l.type, component: l.component, ...(l.type === 'text' ? { text: l.text, style: l.style, font: l.font || 'axo' } : {}), start: l.start, end: l.end, strength: l.strength, hidden: !!l.hidden, params: l.params || {} });
  const metaInfo = (m) => ({ type: m.type, id: m.id, name: m.name, origin: m.origin, favorite: lib.isFav(favKey(m.type, m.id)), params: m.params || {}, description: m.description || '' });
  // 预览沙盒启动、并且第一个工程建好（收到 scene）才算好；沙盒没起来 / 工程建失败就报错，别让调用的一直等
  const ready = () => new Promise((res, rej) => {
    if (S.sceneReady) { res(api); return; }
    if (S.root.dataset.state === 'error') { rej(new Error('预览沙盒没能启动（看预览区的说明，可以点「重试」）')); return; }
    const offs = [];
    const done = () => offs.forEach((f) => f());
    offs.push(S.runner.on('scene', () => { done(); res(api); }));
    offs.push(S.runner.on('boot-failed', (m) => setTimeout(() => { if (S.root.dataset.state === 'error') { done(); rej(new Error(`预览沙盒没能启动：${m?.reason || '没有回应'}`)); } })));   // 第一次失败编辑器会自己重试，真放弃了才算
    offs.push(S.runner.on('fatal', (m) => { if (!S.sceneReady) { done(); rej(new Error(`工程没建起来：${m.message}`)); } }));
  });
  const findRepo = async (key) => (await loadRepo()).find((c) => c.file === key || c.id === key || repoOrigin(c) === key);
  const api = {
    version: 2,
    help: () => [
      'axo.ready() → 等预览沙盒启动好', 'axo.state() → 播放状态、选中、报错、设备档位', 'axo.project.get() / set(工程) / summary()',
      'axo.catalog(类型?) → 能用的组件（motion face fx textanim prop wear skin scene）', 'axo.use(类型, id, { add }) → 换上 / 叠一层',
      'axo.layers.list() / add(类型, 组件, 属性) / update(id, 改动) / remove(id) / select(id) / move(id, ±1)', 'axo.text(文字, 图层id?) → 改字',
      'axo.workshop.list() / add(id 或文件名, { use }) / remove(origin) / library()', 'axo.favorites.list() / toggle(\'类型:id\', 开关?)',
      'axo.models.list() / use(id) → 模型（原版、工坊里下载的、载入的文件）；axo.models.transform({ x, y, scale, rot, flip }) → 模型整体的位置 / 大小 / 角度 / 镜像', 'axo.fonts.list() / use(字体id, { all, layer })',
      'axo.projects.list() / save({ asNew }) / open(origin) / remove(origin) → 存在这台设备浏览器里的「我的工程」',
      'axo.play() / pause() / seek(帧)', 'axo.export({ format: \'gif\'|\'video\'|\'png-zip\'|\'png\', size, colors, maxKb, loops }) → { url, kb, mime, blob }（video 按真实时间录，loops 遍）',
      'axo.share({ short }) → { long, short?, expires? }（short: true 生成 1 分钟短链接）', 'axo.publishUrl({ title, description }) → { url, problems }（不打开，只给链接）',
      'axo.open(\'motion\'|\'workshop\'|…) 打开素材栏；axo.dock(\'timeline\'|\'code\')', '说明：llms.txt',
      ...(prevHelp ? ['', '网站其他部分：', prevHelp()] : []),
    ].join('\n'),
    ready,
    state: () => ({ ready: S.root.dataset.state === 'ready', playing: S.playing, frame: S.frame, frames: S.N, fps: S.fps, drawer: S.drawer, dock: S.dock,
      selected: st.selected, errors: [...S.compileErrors.map((e) => ({ key: e.origin, message: e.message, line: e.line })), ...S.errors], perf: S.perfInfo || S.perf, status: S.status.textContent }),
    project: {
      get: () => structuredClone(st.p),
      set: (p) => {
        if (!p || typeof p !== 'object' || Array.isArray(p) || (p.layers !== undefined && !Array.isArray(p.layers))) throw new Error('工程要是一个对象，layers 是图层数组（axo.project.get() 看格式）');
        st.replace(p); return api.project.summary();
      },
      summary: () => ({ name: st.p.name, size: st.p.size, fps: st.p.fps, frames: st.p.frames, model: st.p.model.component, skin: st.p.skin.component, background: st.p.background.mode, layers: st.p.layers.map(layerInfo), components: st.p.components.map((c) => c.origin) }),
    },
    catalog: (type) => (type ? (S.catalog.get(type) || []) : [...S.catalog.values()].flat()).map(metaInfo),
    use: (type, id, { add = false } = {}) => { need(type, id); if (type === 'textanim') applyToText((l) => { l.component = id; }, 'textanim', id); else if (type === 'scene') applyNew('scene', id); else useComponent(type, id, add); return api.project.summary(); },
    text: (text, id) => {
      const l = id ? st.layer(id) : st.first('text');
      if (id && l?.type !== 'text') throw new Error(`没有文字图层 ${id}（axo.layers.list() 看有哪些）`);
      if (!l) return api.layers.add('text', 'stay', { text });
      st.change((p) => { p.layers.find((x) => x.id === l.id).text = String(text); }); return l.id;
    },
    layers: {
      list: () => st.p.layers.map(layerInfo),
      add: (type, component, props = {}) => {
        if (type === 'textanim') type = 'text';                   // 文字动画是文字图层的组件
        if (!LAYER_TYPES.includes(type)) throw new Error(`图层类型只能是 ${LAYER_TYPES.join(' / ')}（文字动画用 text）`);
        need(type, component); range(props);
        const id = props.id || newId(type[0]);
        if (st.layer(id)) throw new Error(`已经有图层 ${id} 了`);
        if (!st.change((p) => { bring(p, type === 'text' ? 'textanim' : type, component); p.layers.push({ ...(type === 'text' ? { text: '美西螈' } : {}), ...props, id, type, component }); })) throw new Error('没加上（看页面上的提示）');
        st.select(id); return id;
      },
      update: (id, patch) => {
        const l0 = st.layer(id);
        if (!l0) throw new Error(`没有图层 ${id}`);
        const { type, ...rest } = patch;
        if (type && type !== l0.type && !(type === 'textanim' && l0.type === 'text')) throw new Error('图层类型不能直接改：删掉这一层再加一层');
        if (rest.component) need(l0.type, rest.component);
        range(rest, l0);
        if (!st.change((p) => { const l = p.layers.find((x) => x.id === id); if (rest.component) bring(p, l.type === 'text' ? 'textanim' : l.type, rest.component); Object.assign(l, rest, { id }); })) throw new Error('没改成（看页面上的提示）');
        return layerInfo(st.layer(id));
      },
      remove: (id) => { if (!st.layer(id)) throw new Error(`没有图层 ${id}`); st.change((p) => { p.layers = p.layers.filter((x) => x.id !== id); }); if (st.selected === id) st.select(null); return true; },
      select: (id = null) => { st.select(id); return id; },
      move: (id, d) => { const i = st.p.layers.findIndex((x) => x.id === id); if (i >= 0) moveLayer(i, d); return api.layers.list().map((l) => l.id); },
    },
    workshop: {
      list: async () => (await loadRepo()).map((c) => ({ ...c, kind: KIND[c.type] || c.type, added: lib.has(repoOrigin(c)), origin: repoOrigin(c), favorite: lib.isFav(favKey(c.type, c.id)) })),
      add: async (key, { use = false } = {}) => { const c = await findRepo(key); if (!c) throw new Error(`工坊里没有 ${key}`); await addFromRepo(c, use); return repoOrigin(c); },
      remove: async (key) => {
        const c = lib.has(key) ? null : await findRepo(key), origin = c ? repoOrigin(c) : key;
        if (!lib.has(origin)) throw new Error(`库里没有 ${key}（axo.workshop.library() 看有哪些）`);
        return deleteFromLibrary(origin, { confirmFirst: false });
      },
      library: () => lib.list().map(({ source, bytes, ...e }) => ({ ...e, kind: e.kind || 'component', bytes: source ? source.length : bytes?.byteLength || 0 })),
    },
    models: {
      list: () => [{ id: 'axolotl', name: '原版体素', from: 'builtin' }, ...libModels().map((e) => ({ id: e.id, name: e.name, from: e.from }))].map((m) => ({ ...m, current: st.p.model.component === m.id })),
      use: async (id) => { if (!await chooseModel(id)) throw new Error(`模型 ${id} 没换上（库里没有？先 axo.workshop.add('${id}')）`); return api.project.summary(); },
      transform: (patch = {}) => {                              // { x, y, scale, rot, flip }：模型整体的位置（像素）、大小、角度、镜像
        const lim = { x: [-256, 256], y: [-256, 256], scale: [0.3, 2.5], rot: [-180, 180] };
        for (const [k, v] of Object.entries(patch)) {
          if (k === 'flip') continue;
          if (!lim[k]) throw new Error(`不认识的 ${k}（能用 x y scale rot flip）`);
          if (!(typeof v === 'number' && v >= lim[k][0] && v <= lim[k][1])) throw new Error(`${k} 要在 ${lim[k][0]}～${lim[k][1]} 之间`);
        }
        st.change((p) => { Object.assign(p.model, patch, 'flip' in patch ? { flip: !!patch.flip } : {}); });
        const { x, y, scale, rot, flip } = st.p.model; return { x, y, scale, rot, flip };
      },
    },
    fonts: {
      list: () => [...FONT_LIST.map((f) => ({ id: f.id, name: f.name, note: f.desc })), ...libFonts().map((e) => ({ id: e.id, name: e.name, note: '导入的' }))],
      use: (id, { all = false, layer = null } = {}) => {
        if (!FONT_LIST.some((f) => f.id === id) && !libFonts().some((e) => e.id === id)) throw new Error(`没有字体 ${id}（axo.fonts.list() 看能用的）`);
        if (layer) { if (!st.change((p) => { const l = p.layers.find((x) => x.id === layer && x.type === 'text'); if (!l) throw Object.assign(new Error(`没有文字图层 ${layer}`), { userFacing: true }); l.font = id; })) throw new Error(`没有文字图层 ${layer}`); } else applyFont(id, all);
        return api.layers.list().filter((l) => l.type === 'text');
      },
    },
    favorites: { list: () => lib.favList(), toggle: (key, on) => lib.toggleFav(key, on) },
    projects: {
      list: () => libProjects().map((e) => ({ origin: e.origin, name: e.name, at: new Date(e.at).toISOString(), current: e.origin === S.projectKey })),
      save: async ({ asNew = false } = {}) => saveToProjects(asNew),
      open: (origin) => { const e = lib.get(origin); if (e?.kind !== 'project') throw new Error(`没有存过的工程 ${origin}（axo.projects.list() 看有哪些）`); st.replace(e.project); S.projectKey = origin; return api.project.summary(); },
      remove: async (origin) => { if (lib.get(origin)?.kind !== 'project') throw new Error(`没有存过的工程 ${origin}`); await lib.remove(origin); if (S.projectKey === origin) S.projectKey = null; return true; },
    },
    play: () => { setPlaying(true); return true; }, pause: () => { setPlaying(false); return true; }, seek: (f) => { seek(f); return S.frame; },
    export: async ({ format = 'gif', size, colors, maxKb, loops } = {}) => {
      if (!['gif', 'png-zip', 'png', 'video'].includes(format)) throw new Error(`不支持的格式 ${format}（能用 gif / png-zip / png / video）`);
      const r = await S.runner.request({ type: 'export', format, size, colors, maxKb, loops });
      const blob = new Blob([r.bytes], { type: r.mime });
      return { blob, url: URL.createObjectURL(blob), kb: Math.round(blob.size / 1024), mime: r.mime, errors: r.errors || [] };   // url 用完了 URL.revokeObjectURL(url)
    },
    share: async ({ short = false } = {}) => {
      const code = await encodeShare(st.p), out = { long: `${siteUrl()}#/editor?s=${code}` };
      if (short) { const m = await createShort(code); Object.assign(out, { short: `${siteUrl()}#/e/${m.key}`, expires: new Date(m.expires).toISOString() }); setTimeout(() => dropShort(m), m.expires - Date.now()); }
      return out;
    },
    publishUrl: async ({ title, description = '' } = {}) => { await loadRepo().catch(() => {}); const { url, fits, problems } = publishUrl(st.p, { title: title || defaultTitle(st.p), description }); return { url, fits, problems, note: fits ? '打开这个链接，在 GitHub 上勾「授权」再提交' : '工程放不进链接：打开后把 axo.project.get() 的 JSON 粘贴到「工程」栏' }; },
    open: (k) => { openDrawer(k); return k; },
    dock: (d) => { if (!['timeline', 'code'].includes(d)) throw new Error('dock 只能是 timeline 或 code'); setDock(d); return d; },
  };
  window.axo = Object.assign(window.axo || {}, api, { studio: ready });
}

function randomize() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const ids = (t) => (S.catalog.get(t) || []).filter((m) => m.origin === 'builtin').map((m) => m.id);
  const mo = pick(ids('motion')), off = CAT.motions[mo]?.offscreen;
  const anims = ids('textanim').filter((a) => !(off && ['pop', 'type', 'slam'].includes(a)));
  const layers = [{ id: 'm', type: 'motion', component: mo }, { id: 'f', type: 'face', component: pick(ids('face')) },
    { id: 't', type: 'text', component: Math.random() < 0.4 ? 'stay' : pick(anims), text: pick(LINES), style: pick(Object.keys(CAT.styles)) }];
  if (Math.random() < 0.8) layers.push({ id: 'x', type: 'fx', component: pick(ids('fx')) });
  if (CAT.motions[mo]?.prop || Math.random() < 0.15) layers.push({ id: 'p', type: 'prop', component: CAT.motions[mo]?.prop || pick(Object.keys(CAT.holds)) });
  if (Math.random() < 0.3) layers.push({ id: 'w', type: 'wear', component: pick(ids('wear')) });
  if (Math.random() < 0.2) layers.splice(1, 0, { id: 'm2', type: 'motion', component: pick(ids('motion')), strength: 0.6 });
  S.store.replace({ ...S.store.p, name: layers[2].text, layers, skin: Math.random() < 0.25 ? { component: pick(ids('skin')), params: {} } : { component: 'lucy', params: {} } });
}

function onKey(e) {
  if (!S?.active || e.defaultPrevented) return;
  if (e.target.closest('input, textarea, select, .cm-editor, dialog')) return;
  const k = e.key, mod = e.ctrlKey || e.metaKey;
  if (k === ' ') { setPlaying(!S.playing); e.preventDefault(); }
  else if (k === 'ArrowLeft' && !e.altKey) { seek(S.frame - (e.shiftKey ? 10 : 1)); e.preventDefault(); }
  else if (k === 'ArrowRight' && !e.altKey) { seek(S.frame + (e.shiftKey ? 10 : 1)); e.preventDefault(); }
  else if (k === 'Home') seek(0);
  else if (k === 'End') seek(S.N - 1);
  else if (mod && k.toLowerCase() === 'z') { (e.shiftKey ? S.store.redo() : S.store.undo()); e.preventDefault(); }
  else if (mod && k.toLowerCase() === 'y') { S.store.redo(); e.preventDefault(); }
  else if (mod && k.toLowerCase() === 's') { saveProjectFile(); e.preventDefault(); }
  else if (mod && k.toLowerCase() === 'd' && S.store.layer()) { duplicateLayer(S.store.layer()); e.preventDefault(); }
  else if (mod && k.toLowerCase() === 'c' && S.store.layer() && !String(getSelection?.() || '')) { S.clip = structuredClone(S.store.layer()); toast('复制了这一层：Ctrl+V 粘贴'); }
  else if (mod && k.toLowerCase() === 'v' && S.clip) { pasteLayer(S.clip); e.preventDefault(); }
  else if ((k === '[' || k === ']') && S.store.layer()) { moveLayer(S.store.p.layers.indexOf(S.store.layer()), k === '[' ? -1 : 1); }
  else if (e.altKey && k.startsWith('Arrow')) {                 // Alt + 方向键：微调选中的文字（没选中文字就挪模型），加 Shift 一次 10 像素
    const n = e.shiftKey ? 10 : 1, dx = k === 'ArrowLeft' ? -n : k === 'ArrowRight' ? n : 0, dy = k === 'ArrowUp' ? -n : k === 'ArrowDown' ? n : 0, l = S.store.layer();
    S.store.change((p) => {
      const t = l?.type === 'text' ? p.layers.find((x) => x.id === l.id) : null;
      if (t) { t.x = clampN(t.x + dx, -256, 256); t.y = clampN(t.y + dy, 0, 512); } else { p.model.x = clampN(p.model.x + dx, -256, 256); p.model.y = clampN(p.model.y + dy, -256, 256); }
    }, { coalesce: 'nudge' });
    e.preventDefault();
  }
  else if ((k === 'Delete' || k === 'Backspace') && S.store.selected) { const id = S.store.selected; S.store.change((p) => { p.layers = p.layers.filter((l) => l.id !== id); }); S.store.select(null); }
  else if (k === 'Escape') S.store.select(null);
  else if ((k === 'o' || k === 'O') && !mod) S.onionBtn.click();
  else if (k === '?') showKeys();
}
