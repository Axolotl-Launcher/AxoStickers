// 创意工坊 · 编辑器（v2）：左边素材库，中间舞台 + 播放条 + 时间轴 / 代码，右边属性。
// 所有组件代码都在沙盒 iframe 里跑（runner.js）；这里只管界面和工程数据（store.js）。
import CAT from '../../../workshop/catalog.json';
import { $, el, toast, REPO, STYLE_COLORS } from '../util.js';
import { fromRecipe, normalizeProject } from '../engine/project.js';
import { Store, newId, STARTER } from './store.js';
import { Runner } from './runner.js';
import { loadGallery, G } from '../gallery.js';
import './studio.css';

const ZH = { motion: '动作', face: '表情', prop: '道具', wear: '帽子', fx: '特效', text: '文字', textanim: '文字动画', skin: '皮肤', scene: '场景' };
const TCOLOR = { motion: '#fe3e8c', face: '#ff9f1c', prop: '#24c66c', wear: '#9e66ff', fx: '#18c4d6', text: '#4098ff', scene: '#6b6f80' };
const TIMED = new Set(['motion', 'fx', 'text', 'scene']);
const RAIL = [
  ['templates', '模板', '▦'], ['text', '文字', '字'], ['motion', '动作', '↻'], ['face', '表情', '◕'], ['fx', '特效', '✦'],
  ['prop', '道具', '⚒'], ['wear', '帽子', '♛'], ['skin', '皮肤', '◐'], ['model', '模型', '⬢'], ['mine', '组件', '{ }'],
];
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
const fill = (node, ...kids) => node.replaceChildren(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
const hexOf = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

export function studioActive(on) {
  if (!S) return;
  S.active = on;
  S.runner.post({ type: 'transport', playing: on && S.playing });
  S.mini.hidden = !on || S.stageVisible;
}

export async function openStudio(root, { recipe = null, project = null, shared = null } = {}) {
  if (!S) build(root);
  if (shared) { try { S.store.replace(await decodeShare(shared)); toast('打开了分享的工程'); } catch { toast('分享链接坏了'); } }
  else if (project) S.store.replace(project);
  else if (recipe) S.store.replace(fromRecipe(recipe));
  ensureModel();                                               // 草稿 / 打开的工程用的是 Logo 模型：先把模型送进沙盒
  studioActive(true);
}

// ---------------- 构建界面 ----------------
function build(root) {
  const store = new Store();
  S = { store, catalog: new Map(), errors: [], compileErrors: [], playing: true, speed: 1, frame: 0, N: 48, fps: 15, T: 3.2, onion: false,
    drawer: 'motion', dock: 'timeline', zoom: 'fit', bg: 'white', active: true, stageVisible: true, thumbCache: new Map(),
    models: new Map() };                                     // 载入过的模型：id -> { name, bytes }

  // 顶栏
  const name = el('input', { class: 'st-name', value: store.p.name, placeholder: '给它起个名', maxlength: 40, 'aria-label': '工程名' });
  name.addEventListener('change', () => store.change((p) => { p.name = name.value.trim(); }));
  const btn = (label, title, on, cls = '') => el('button', { class: `st-btn ${cls}`, type: 'button', title, onclick: on }, label);
  S.undoBtn = btn('↶', '撤销（Ctrl+Z）', () => store.undo(), 'icon');
  S.redoBtn = btn('↷', '重做（Ctrl+Shift+Z）', () => store.redo(), 'icon');
  const top = el('header', { class: 'st-top' },
    el('a', { class: 'st-back', href: '#/', title: '回图鉴' }, '←'), name, S.undoBtn, S.redoBtn,
    el('span', { class: 'st-sep' }),
    btn('新建', '新建一个空工程', () => { if (confirm('新建会丢掉当前没保存的改动，接着？')) store.replace(STARTER()); }),
    btn('打开', '打开 .axo.json 工程文件，或者 .axo.js 组件', () => pickFile()),
    btn('保存', '把工程存成文件（Ctrl+S）', () => saveProjectFile()),
    btn('🎲', '随便来一张', () => randomize(), 'icon'),
    btn('分享', '复制一个能打开这个工程的链接', () => shareLink()),
    btn('?', '快捷键', () => showKeys(), 'icon'),
    el('span', { class: 'st-grow' }),
    btn('发布到工坊', '用 GitHub issue 发布，真引擎重新出图', () => publish(), 'water'),
    btn('导出', '导出 GIF / 逐帧 PNG', () => showExport(), 'primary'));

  // 左：素材栏 + 抽屉
  const rail = el('nav', { class: 'st-rail', 'aria-label': '素材' }, ...RAIL.map(([k, label, ico]) =>
    el('button', { class: 'st-railbtn', type: 'button', 'data-k': k, 'aria-pressed': String(k === S.drawer), onclick: () => openDrawer(k) }, el('i', { text: ico }), el('span', { text: label }))));
  S.drawerTitle = el('h3'); S.search = el('input', { class: 'input st-search', type: 'search', placeholder: '搜一下' });
  S.search.addEventListener('input', () => renderDrawer());
  S.drawerBody = el('div', { class: 'st-drawer-body' });
  const drawer = el('aside', { class: 'st-drawer' }, el('div', { class: 'st-drawer-head' }, S.drawerTitle, S.search), S.drawerBody);

  // 中：舞台
  S.stageBox = el('div', { class: 'st-stage-box bg-white' });
  S.errBadge = el('button', { class: 'st-errbadge', type: 'button', hidden: true, onclick: () => setDock('code') });
  S.bootMsg = el('div', { class: 'st-boot', text: '正在启动沙盒…' });
  const stage = el('div', { class: 'st-stage' }, S.stageBox, S.errBadge, S.bootMsg);
  const zoomSel = el('select', { class: 'st-mini-select', title: '缩放', onchange: (e) => { S.zoom = e.target.value; layoutStage(); } },
    ...[['fit', '适应'], ['1', '100%'], ['2', '200%'], ['0.6', '60%（表情实际大小）']].map(([v, t]) => el('option', { value: v, text: t })));
  const bgSel = el('select', { class: 'st-mini-select', title: '舞台背景（只影响预览）', onchange: (e) => { S.bg = e.target.value; S.stageBox.className = `st-stage-box bg-${S.bg}`; } },
    ...[['white', '白底'], ['checker', '棋盘格'], ['chat', '聊天气泡·浅'], ['chatdark', '聊天气泡·深']].map(([v, t]) => el('option', { value: v, text: t })));
  const stagebar = el('div', { class: 'st-stagebar' }, zoomSel, bgSel, el('span', { class: 'st-grow' }), el('span', { class: 'st-hint', text: '组件都在沙盒里跑' }));

  // 播放条
  S.playBtn = btn('❚❚', '播放 / 暂停（空格）', () => setPlaying(!S.playing), 'icon play');
  S.counter = el('span', { class: 'st-counter', text: '1 / 48' });
  S.scrub = el('input', { class: 'scrub st-scrub', type: 'range', min: 0, max: 47, value: 0, 'aria-label': '帧' });
  S.scrub.addEventListener('input', () => seek(+S.scrub.value));
  S.speedBtn = btn('1×', '播放速度', () => { const sp = [0.25, 0.5, 1, 2]; S.speed = sp[(sp.indexOf(S.speed) + 1) % sp.length]; S.speedBtn.textContent = `${S.speed}×`; S.runner.post({ type: 'transport', speed: S.speed }); }, 'small');
  S.onionBtn = btn('洋葱皮', '暂停时叠一层前一帧（O）', () => { S.onion = !S.onion; S.onionBtn.setAttribute('aria-pressed', String(S.onion)); S.runner.post({ type: 'transport', onion: S.onion }); }, 'small');
  const transport = el('div', { class: 'st-transport' },
    btn('⏮', '第一帧（Home）', () => seek(0), 'icon'), btn('◀', '上一帧（←）', () => seek(S.frame - 1), 'icon'), S.playBtn,
    btn('▶', '下一帧（→）', () => seek(S.frame + 1), 'icon'), btn('⏭', '最后一帧（End）', () => seek(S.N - 1), 'icon'),
    S.scrub, S.counter, S.speedBtn, S.onionBtn);

  // 底部停靠：时间轴 / 代码
  S.dockTabs = el('div', { class: 'st-docktabs', role: 'tablist' },
    el('button', { class: 'st-tab', type: 'button', 'data-d': 'timeline', onclick: () => setDock('timeline') }, '时间轴'),
    el('button', { class: 'st-tab', type: 'button', 'data-d': 'code', onclick: () => setDock('code') }, '代码'),
    el('span', { class: 'st-grow' }),
    el('button', { class: 'st-btn small', type: 'button', title: '加一层', onclick: (e) => addMenu(e.currentTarget) }, '＋ 图层'));
  S.timeline = el('div', { class: 'st-timeline' });
  S.codePane = el('div', { class: 'st-code' });
  const dock = el('section', { class: 'st-dock' }, S.dockTabs, S.timeline, S.codePane);

  const main = el('main', { class: 'st-main' }, stagebar, stage, transport, dock);
  S.inspector = el('aside', { class: 'st-inspector', 'aria-label': '属性' });
  S.mobileTabs = el('div', { class: 'st-mtabs' }, ...[['drawer', '素材'], ['inspector', '属性'], ['timeline', '时间轴'], ['code', '代码']].map(([k, t]) =>
    el('button', { class: 'st-tab', type: 'button', 'data-m': k, onclick: () => setMobile(k) }, t)));
  S.mini = el('button', { class: 'mini st-mini', type: 'button', hidden: true, 'aria-label': '回到预览', onclick: () => stage.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, el('span', { text: '预览在上面 ↑' }));

  S.root = el('div', { class: 'studio', 'data-m': 'drawer' }, top, el('div', { class: 'st-body' }, rail, drawer, main, S.inspector), S.mobileTabs, S.mini);
  fill(root, S.root);

  // 沙盒
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const devNoSandbox = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && params.get('nosandbox') === '1';
  S.runner = new Runner(S.stageBox, { sandboxed: !devNoSandbox });
  S.runner.on('ready', (m) => {
    S.bootMsg.hidden = true; setCatalog(m.catalog);
    for (const [id, x] of S.models) S.runner.request({ type: 'model', id, bytes: x.bytes.slice(0) });   // 沙盒重开过：模型再送一遍
    sendProject();
  });
  S.runner.on('catalog', (m) => { setCatalog(m.catalog); S.compileErrors = m.errors || []; showErrors(); });
  S.runner.on('scene', (m) => { S.N = m.N; S.fps = m.fps; S.T = m.T; S.scrub.max = m.N - 1; S.errors = m.errors || []; showErrors(); updateCounter(); scheduleFilmstrip(); });
  S.runner.on('errors', (m) => { S.errors = m.errors || []; showErrors(); });
  S.runner.on('time', (m) => { if (S.playing) { S.frame = m.frame; updateCounter(); } });
  S.runner.on('fatal', (m) => toast('沙盒出错：' + m.message));
  S.runner.on('boot-failed', () => {
    S.bootMsg.hidden = false;
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);      // 不加沙盒只给本机开发用：网站上 sandbox.html 会拒绝在本站身份下运行
    fill(S.bootMsg, el('b', { text: '预览沙盒没能启动' }), el('p', { text: local ? '可能被浏览器扩展拦下了（沙盒的请求来源是 null）。本机开发可以不用沙盒直接跑。' : '可能被浏览器扩展拦下了（沙盒的请求来源是 null）。换个浏览器，或者给这个网站关掉拦截类扩展再试试。' }),
      local ? el('button', { class: 'btn', type: 'button', text: '不用沙盒直接运行', onclick: () => { S.runner.sandboxed = false; S.runner.start(); S.bootMsg.textContent = '正在启动…'; } }) : null);
  });
  S.runner.watch(() => { toast('沙盒没响应了，重开一次'); S.runner.start(); });

  store.on((why) => {
    if (why === 'foreign') { toast('这份草稿在另一个标签页里改过了：这边的改动不再自动保存（想接着用那边的就刷新页面；这边的可以「保存」成文件）'); return; }
    if (why === 'mine') { if (S.drawer === 'mine') renderDrawer(); return; }
    if (why === 'select') { renderInspector(); renderTimeline(); loadCode(); return; }
    if (document.activeElement !== name) name.value = store.p.name;
    sendProject(); renderTimeline(); updateHistory(); ensureModel();
    if (S.quiet !== 'inspector') renderInspector();              // 正在打字 / 拖滑块的那个面板不重建，不然输入框会被换掉、失去焦点
    if (why !== 'change') loadCode();
    if (S.quiet !== 'drawer' && ['text', 'skin', 'mine', 'model'].includes(S.drawer)) renderDrawer();
  });

  // 舞台看不见的时候（手机上往下翻）挂一个小提示
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { S.stageVisible = e.isIntersecting; S.mini.hidden = S.stageVisible || !S.active; }, { threshold: 0.2 }).observe(stage);
  window.addEventListener('resize', layoutStage);
  document.addEventListener('keydown', onKey);
  root.addEventListener('dragover', (e) => { e.preventDefault(); S.root.classList.add('dropping'); });
  root.addEventListener('dragleave', (e) => { if (e.target === root || !root.contains(e.relatedTarget)) S.root.classList.remove('dropping'); });
  root.addEventListener('drop', (e) => { e.preventDefault(); S.root.classList.remove('dropping'); for (const f of e.dataTransfer.files) importFile(f); });

  openDrawer(S.drawer); setDock('timeline'); setMobile('drawer');
  renderInspector(); renderTimeline(); updateHistory(); layoutStage();
}

// 面板里的输入框改工程时用：这次改动不重建这个面板（输入框本身已经是新值了）
function quietly(panel, fn) { S.quiet = panel; try { fn(); } finally { S.quiet = null; } }

// 工程用到了网站自带的 Logo 模型、但这个页面还没载入过（打开分享 / 工坊作品 / 草稿时）：载入并送进沙盒
let modelLoading = null;
function ensureModel(id = S.store.p.model.component) {
  if (id !== 'logo' || S.models.has('logo')) return Promise.resolve();
  return modelLoading ||= (async () => {
    try {
      const bytes = await (await fetch('models/axolotl_logo.glb')).arrayBuffer();
      S.models.set('logo', { name: 'Logo 版', bytes });
      const r = await S.runner.request({ type: 'model', id: 'logo', bytes: bytes.slice(0) });
      if (!r.ok) toast('模型没读出来：' + r.message);
    } catch { toast('Logo 模型没下载下来'); } finally { modelLoading = null; }
  })();
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

function setPlaying(on) {
  S.playing = on;
  S.playBtn.textContent = on ? '❚❚' : '▶';
  S.runner.post(on ? { type: 'transport', playing: true, t: S.frame / S.fps } : { type: 'transport', playing: false, t: S.frame / S.fps });
}
function seek(f) {
  S.frame = ((Math.round(f) % S.N) + S.N) % S.N;
  if (S.playing) { S.playing = false; S.playBtn.textContent = '▶'; }
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
  S.drawer = k;
  for (const b of S.root.querySelectorAll('.st-railbtn')) b.setAttribute('aria-pressed', String(b.dataset.k === k));
  S.drawerTitle.textContent = RAIL.find((r) => r[0] === k)[1];
  S.search.value = '';
  S.search.hidden = k === 'text' || k === 'skin';
  renderDrawer();
  if (matchMedia('(max-width: 900px)').matches) setMobile('drawer');
}

function useComponent(type, id, add = false) {
  const st = S.store;
  if (type === 'skin') { st.change((p) => { p.skin = { component: id, params: {} }; }); return; }
  const sel = st.layer();
  const single = type === 'face';
  let target = !add && (sel?.type === type ? sel : single || type === 'motion' ? st.first(type) : null);
  if (target && !add) {
    st.change((p) => { const l = p.layers.find((x) => x.id === target.id); l.component = id; l.params = {}; if (type === 'face') l.face = null; });
    st.select(target.id);
  } else {
    const nid = newId(type[0]);
    st.change((p) => { p.layers.push({ id: nid, type, component: id }); });
    st.select(nid);
  }
}

async function thumbs(kind, ids) {
  const want = ids.filter((id) => !S.thumbCache.has(`${kind}:${id}`));
  if (want.length) {
    const { bitmaps } = await S.runner.request({ type: 'thumbs', kind, ids: want, size: 96 });
    want.forEach((id, i) => S.thumbCache.set(`${kind}:${id}`, bitmaps[i]));
  }
  return ids.map((id) => S.thumbCache.get(`${kind}:${id}`));
}
function tile(meta, { kind, active, onUse, onAdd }) {
  const c = el('canvas', { width: 96, height: 96, class: 'st-thumb' });
  const t = el('button', { class: 'st-tile', type: 'button', title: `${meta.name}（${meta.id}）`, 'aria-pressed': String(!!active), onclick: onUse },
    c, el('span', { text: meta.name }), meta.origin !== 'builtin' ? el('em', { text: meta.origin.startsWith('repo') ? '库' : '自' }) : null);
  const wrap = el('div', { class: 'st-tilewrap' }, t, onAdd ? el('button', { class: 'st-add', type: 'button', title: '再加一层（叠加）', onclick: onAdd }, '＋') : null);
  if (kind) thumbs(kind, [meta.id]).then(([b]) => { if (b) c.getContext('2d').drawImage(b, 0, 0); }).catch(() => {});
  return wrap;
}
function chip(meta, { active, onUse, onAdd, error }) {
  return el('span', { class: 'st-chipwrap' },
    el('button', { class: 'chip', type: 'button', 'aria-pressed': String(!!active), title: `${meta.name}（${meta.id}）${meta.description ? '：' + meta.description : ''}`, onclick: onUse },
      meta.name, meta.origin !== 'builtin' ? el('em', { class: 'st-tag', text: meta.origin.startsWith('repo') ? '库' : '自' }) : null, error ? el('em', { class: 'st-tag err', text: '!' }) : null),
    onAdd ? el('button', { class: 'st-chipadd', type: 'button', title: '再加一层（叠加）', onclick: onAdd }, '＋') : null);
}
const match = (m, q) => !q || m.name.toLowerCase().includes(q) || m.id.includes(q);

async function renderDrawer() {
  if (!S.drawerBody) return;
  const k = S.drawer, q = S.search.value.trim().toLowerCase(), body = S.drawerBody, st = S.store;
  const used = (type) => new Set(st.p.layers.filter((l) => l.type === type).map((l) => l.component));
  const errKeys = new Set(S.errors.map((e) => e.key));
  if (k === 'templates') {
    await loadGallery();
    const items = G.items.filter((it) => !it.special && (!q || it.search.includes(q)));
    fill(body, 
      el('div', { class: 'st-row' }, el('button', { class: 'btn small', type: 'button', onclick: () => S.store.replace(STARTER()) }, '空白开始'), el('button', { class: 'btn small', type: 'button', onclick: randomize }, '🎲 随机')),
      el('p', { class: 'st-note', text: `${items.length} 张正式表情都能当模板：点一下就打开它的配方，改哪儿都行。` }),
      el('div', { class: 'st-tiles' }, ...items.slice(0, 120).map((it) => el('button', { class: 'st-tile tpl', type: 'button', title: it.text, onclick: () => S.store.replace(fromRecipe(it)) },
        el('img', { src: it.still, alt: '', loading: 'lazy', width: 96, height: 96 }), el('span', { text: it.text })))),
      items.length > 120 ? el('p', { class: 'st-note', text: '还有更多，搜一下文字。' }) : null);
    return;
  }
  if (k === 'text') {
    const texts = st.p.layers.filter((l) => l.type === 'text');
    const anims = S.catalog.get('textanim') || [];
    fill(body, 
      ...texts.map((l) => {
        const inp = el('input', { class: 'input st-textinput', value: l.text, maxlength: 24, placeholder: '写点字', 'aria-label': '文字' });
        inp.addEventListener('input', () => quietly('drawer', () => st.change((p) => { p.layers.find((x) => x.id === l.id).text = inp.value; }, { coalesce: `text:${l.id}` })));
        inp.addEventListener('focus', () => st.select(l.id));
        return el('div', { class: 'st-textrow' }, inp, el('button', { class: 'st-btn icon', type: 'button', title: '删掉这行字', onclick: () => st.change((p) => { p.layers = p.layers.filter((x) => x.id !== l.id); }) }, '×'));
      }),
      el('button', { class: 'btn small', type: 'button', onclick: () => { const nid = newId('t'); st.change((p) => p.layers.push({ id: nid, type: 'text', component: 'stay', text: '再来一行', y: 200 + 60 * texts.length, scale: 0.7 })); st.select(nid); } }, '＋ 再加一行字'),
      el('p', { class: 'st-note', text: '「/」可以手动换行。选中一行字后，下面的颜色和动画会用在它身上。' }),
      el('h4', { text: '字色' }), styleRow(),
      el('h4', { text: '文字动画' }),
      el('div', { class: 'chips' }, ...anims.map((m) => chip(m, { active: st.layer()?.type === 'text' && st.layer().component === m.id, onUse: () => applyToText((l) => { l.component = m.id; }) }))));
    return;
  }
  if (k === 'skin') {
    const skins = S.catalog.get('skin') || [];
    fill(body, el('div', { class: 'st-tiles' }, ...skins.map((m) => tile(m, { kind: 'skin', active: st.p.skin.component === m.id, onUse: () => useComponent('skin', m.id) }))),
      el('p', { class: 'st-note', text: '皮肤的颜色可以在右边属性里调；想要更花的效果，去「组件」新建一个皮肤写 tint。' }));
    return;
  }
  if (k === 'mine') { renderMine(body); return; }
  if (k === 'model') {
    const cur = st.p.model.component;
    const mtile = (id, name, desc) => el('button', { class: 'st-model', type: 'button', 'aria-pressed': String(cur === id), onclick: () => chooseModel(id) }, el('b', { text: name }), el('small', { text: desc }));
    const face = el('input', { type: 'checkbox', checked: (st.p.model.face ?? (cur === 'axolotl' || cur === 'logo')) ? true : null });
    face.addEventListener('change', () => st.change((p) => { p.model.face = face.checked; }));
    fill(body,
      mtile('axolotl', '原版体素', '表情包用的那只：逐像素的方块，鳃和尾巴是 1 像素的薄片'),
      mtile('logo', 'Logo 版', 'Axolotl Launcher 图标同款，加厚过的鳃和尾巴'),
      ...[...S.models].filter(([id]) => id.startsWith('file:')).map(([id, x]) => mtile(id, x.name, `载入的模型 · ${x.info || ''}`)),
      el('button', { class: 'btn small', type: 'button', onclick: () => pickFile('.glb,.gltf') }, '载入模型文件（.glb / .gltf）'),
      el('label', { class: 'st-field check' }, face, el('span', { text: '在头的正面画表情（别的模型脸不在那儿的话关掉）' })),
      el('p', { class: 'st-note', text: '能用 Blockbench 做的方块模型：节点名叫 head、body、tail、leg1～leg4、top_gills、left_gills、right_gills 的会跟着动作动，其他的跟着身体走。只支持贴图和数据都内嵌在文件里的 .glb / .gltf（带单独 .bin 或贴图文件的 .gltf 载不进来，导出时选 .glb 或勾上内嵌），模型会自动缩放到和原版差不多大。载入的模型只在你这台电脑上用，发布到工坊只支持上面两个内置模型。' }));
    return;
  }
  const list = (S.catalog.get(k) || []).filter((m) => match(m, q));
  if (k === 'face' || k === 'prop' || k === 'wear') {
    const u = used(k);
    fill(body, el('div', { class: 'st-tiles' }, ...list.map((m) => tile(m, { kind: k, active: u.has(m.id), onUse: () => useComponent(k, m.id), onAdd: k === 'face' ? null : () => useComponent(k, m.id, true) }))));
    return;
  }
  const u = used(k);
  const groups = k === 'motion' ? [['身体', (m) => !CAT.motions[m.id]?.prop && !CAT.motions[m.id]?.noHold && !CAT.motions[m.id]?.offscreen],
    ['拿着道具的', (m) => CAT.motions[m.id]?.prop || CAT.motions[m.id]?.noHold], ['中途离开画面的', (m) => CAT.motions[m.id]?.offscreen]] : [['', () => true]];
  const custom = list.filter((m) => m.origin !== 'builtin');
  fill(body, 
    custom.length ? el('h4', { text: '自己的 / 组件库的' }) : null,
    custom.length ? el('div', { class: 'chips' }, ...custom.map((m) => chip(m, { active: u.has(m.id), error: errKeys.has(`${k}:${m.id}`), onUse: () => useComponent(k, m.id), onAdd: () => useComponent(k, m.id, true) }))) : null,
    ...groups.flatMap(([title, f]) => {
      const g = list.filter((m) => m.origin === 'builtin' && f(m));
      return g.length ? [title ? el('h4', { text: title }) : null, el('div', { class: 'chips' }, ...g.map((m) => chip(m, { active: u.has(m.id), error: errKeys.has(`${k}:${m.id}`), onUse: () => useComponent(k, m.id), onAdd: () => useComponent(k, m.id, true) })))] : [];
    }),
    el('p', { class: 'st-note', text: k === 'motion' ? '点一下换掉当前动作；点「＋」再叠一个动作上去（比如点头 + 摇尾巴），在时间轴上还能让它只动一段。' : '点一下换掉选中的特效；「＋」再加一个。' }));
}

// 刚载入 / 从组件库拿来的组件：直接用上
function applyNew(type, id) {
  if (!type || !id) return;
  if (type === 'scene') { const nid = newId('s'); S.store.change((p) => { p.layers.push({ id: nid, type: 'scene', component: id }); }); S.store.select(nid); }
  else if (type === 'textanim') applyToText((l) => { l.component = id; });
  else useComponent(type, id);
}
const sniff = (src) => ({ id: (/id:\s*['"]([^'"]+)['"]/.exec(src) || [])[1], type: (/type:\s*['"](\w+)['"]/.exec(src) || [])[1], name: (/name:\s*['"]([^'"]+)['"]/.exec(src) || [])[1] });

let modelPick = 0;                                             // 选模型要等载入：只认最后一次选的
async function chooseModel(id) {
  const my = ++modelPick;
  await ensureModel(id);
  if (my !== modelPick || (id === 'logo' && !S.models.has('logo'))) return;
  S.store.change((p) => { p.model = { component: id, face: null }; });
}

function styleRow() {
  return el('div', { class: 'style-picks' }, ...Object.entries(CAT.styles).map(([k, zh]) => {
    const [c, d] = STYLE_COLORS[k];
    const l = S.store.layer();
    return el('button', { class: 'swatch', type: 'button', title: zh + '字', 'aria-pressed': String(l?.type === 'text' && l.style === k), style: `--c:${c};--d:${d}`, onclick: () => applyToText((x) => { x.style = k; }) });
  }));
}
function applyToText(fn) {
  const st = S.store;
  let l = st.layer();
  if (l?.type !== 'text') l = st.first('text');
  if (!l) { const nid = newId('t'); st.change((p) => { p.layers.push({ id: nid, type: 'text', component: 'stay', text: '美西螈' }); }); l = st.layer(nid); }
  st.change((p) => fn(p.layers.find((x) => x.id === l.id)));
  st.select(l.id);
}

function renderMine(body) {
  const st = S.store;
  const fileBtn = el('button', { class: 'btn small primary', type: 'button', onclick: () => pickFile() }, '载入组件文件…');
  const newSel = el('select', { class: 'select', onchange: (e) => { if (e.target.value) newComponent(e.target.value); e.target.value = ''; } },
    el('option', { value: '', text: '＋ 新建组件…' }), ...Object.keys(TEMPLATES).map((t) => el('option', { value: t, text: `新建${ZH[t]}` })));
  const mine = st.mine.map((m) => el('div', { class: 'st-mine' },
    el('div', {}, el('b', { text: m.name || m.origin }), el('small', { text: ` ${ZH[m.type] || ''} · ${m.origin}` })),
    el('div', { class: 'st-row' },
      el('button', { class: 'st-btn small', type: 'button', onclick: () => { st.putComponent(m.origin, m.source); const s = sniff(m.source); applyNew(s.type, s.id); toast(`用上了「${m.name || s.name || s.id}」`); } }, '用'),
      el('button', { class: 'st-btn small', type: 'button', onclick: () => download(new Blob([m.source], { type: 'text/javascript' }), `${m.origin.replace(/^\w+:/, '')}.axo.js`) }, '下载'),
      el('button', { class: 'st-btn small', type: 'button', onclick: () => proposeComponent(m.source, m.origin.replace(/^\w+:/, '')) }, '提交到组件库'),
      el('button', { class: 'st-btn small', type: 'button', onclick: () => { if (confirm('从这台设备上删掉这个组件？')) { st.removeMine(m.origin); renderDrawer(); } } }, '删'))));
  const inProject = st.p.components.map((c) => el('li', {}, el('code', { text: c.origin }),
    el('button', { class: 'st-btn small', type: 'button', onclick: () => st.dropComponent(c.origin) }, '移出工程')));
  fill(body, 
    el('div', { class: 'st-row' }, fileBtn, newSel),
    el('p', { class: 'st-note', text: '组件是一段 JavaScript：动作、特效、文字动画、皮肤、道具都能写。它们只在预览沙盒里跑，碰不到这个网页。别人的组件文件（.axo.js）拖进来就能用。' }),
    el('h4', { text: '组件库（仓库里大家 PR 进来的）' }), S.repoList || el('p', { class: 'st-note', text: '加载中…' }),
    el('h4', { text: '我的组件（存在这台设备上）' }), mine.length ? el('div', {}, ...mine) : el('p', { class: 'st-note', text: '还没有。新建一个，或者在代码面板里把改过的组件「另存为」。' }),
    el('h4', { text: '这个工程自带的组件代码' }), inProject.length ? el('ul', { class: 'st-list' }, ...inProject) : el('p', { class: 'st-note', text: '没有（只用了内置组件）。' }));
  if (!S.repoList) loadRepo();
}

async function loadRepo() {
  try {
    const r = await fetch('components/index.json', { cache: 'no-cache' });
    const list = r.ok ? await r.json() : [];
    S.repoList = list.length ? el('div', {}, ...list.map((c) => el('div', { class: 'st-mine' },
      el('div', {}, el('b', { text: c.name }), el('small', { text: ` ${ZH[c.type] || c.type} · by ${c.author || '?'}` }), c.description ? el('p', { class: 'st-note', text: c.description }) : null),
      el('div', { class: 'st-row' }, el('button', { class: 'st-btn small', type: 'button', onclick: async () => {
        const src = await (await fetch(`components/${c.file}`)).text();
        S.store.putComponent(`repo:${c.file}`, src);
        applyNew(c.type, c.id);
        toast(`用上了组件库里的「${c.name}」`);
      } }, '用'))))) : el('p', { class: 'st-note', text: '组件库还是空的。' });
  } catch { S.repoList = el('p', { class: 'st-note', text: '组件库没加载出来。' }); }
  if (S.drawer === 'mine') renderDrawer();
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
  setTimeout(() => document.addEventListener('click', function off(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', off); } }));
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
    const label = el('button', { class: 'tl-label', type: 'button', onclick: () => st.select(sel ? null : l.id), title: '选中这一层' },
      el('i', { class: 'tl-dot', style: `background:${TCOLOR[l.type] || '#999'}` }),
      el('span', { text: l.type === 'text' ? `「${l.text || '…'}」` : nameOf(l.type, l.component) }),
      el('small', { text: ZH[l.type] || l.type }), errKeys.has(`${l.type}:${l.component}`) ? el('em', { class: 'st-tag err', text: '!' }) : null);
    const eye = el('button', { class: 'tl-eye', type: 'button', title: l.hidden ? '显示' : '隐藏', 'aria-pressed': String(!l.hidden), onclick: () => st.change((p) => { const x = p.layers[idx]; x.hidden = !x.hidden; }) }, l.hidden ? '◌' : '●');
    const bar = el('div', { class: `tl-bar ${timed ? '' : 'static'}`, style: `left:${l.start * 100}%;width:${(l.end - l.start) * 100}%;--c:${TCOLOR[l.type] || '#999'}` },
      timed ? el('i', { class: 'h l' }) : null, timed ? el('i', { class: 'h r' }) : null,
      l.strength !== 1 && timed ? el('small', { text: `×${l.strength}` }) : null);
    const track = el('div', { class: 'tl-track' }, bar);
    if (timed) dragBar(bar, track, l);
    track.addEventListener('pointerdown', (e) => { if (e.target === track) st.select(l.id); });
    return el('div', { class: `tl-row ${sel ? 'sel' : ''} ${l.hidden ? 'off' : ''}` }, eye, label, track);
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
    e.preventDefault(); e.stopPropagation(); S.store.select(l.id);
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
    bar.onpointerup = () => {
      bar.onpointermove = bar.onpointerup = null;
      if (bar.dataset.s === undefined) return;
      const s = +bar.dataset.s, en = +bar.dataset.e;
      S.store.change((p) => { const x = p.layers.find((y) => y.id === l.id); x.start = s; x.end = en; });
    };
  });
}

// ---------------- 属性面板 ----------------
function control(spec, value, onInput, key) {
  const t = spec.type || 'number';
  if (t === 'bool') {
    const c = el('input', { type: 'checkbox', checked: value ? true : null });
    c.addEventListener('change', () => onInput(c.checked ? 1 : 0));
    return el('label', { class: 'st-field check' }, c, el('span', { text: spec.label || key }));
  }
  if (t === 'select') {
    const s = el('select', { class: 'select' }, ...(spec.options || []).map(([v, l]) => el('option', { value: JSON.stringify(v), text: l, selected: JSON.stringify(v) === JSON.stringify(value) ? true : null })));
    s.addEventListener('change', () => onInput(JSON.parse(s.value)));
    return el('label', { class: 'st-field' }, el('span', { text: spec.label || key }), s);
  }
  if (t === 'color') {
    const c = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff' });
    c.addEventListener('input', () => onInput(c.value));
    return el('label', { class: 'st-field row' }, el('span', { text: spec.label || key }), c);
  }
  if (t === 'icon') {
    const s = el('select', { class: 'select' }, ...iconList().map((k) => el('option', { value: k, text: `${CAT.icons[k] || CAT.holds[k] || k}（${k}）`, selected: k === value ? true : null })));
    s.addEventListener('change', () => onInput(s.value));
    return el('label', { class: 'st-field' }, el('span', { text: spec.label || key }), s);
  }
  if (t === 'text') {
    const i = el('input', { class: 'input', value: value ?? '' });
    i.addEventListener('input', () => onInput(i.value));
    return el('label', { class: 'st-field' }, el('span', { text: spec.label || key }), i);
  }
  const min = spec.min ?? 0, max = spec.max ?? 100, step = t === 'int' ? 1 : spec.step ?? (max - min > 20 ? 1 : 0.01);
  const r = el('input', { type: 'range', min, max, step, value: value ?? spec.default ?? min, class: 'st-range' });
  const n = el('input', { type: 'number', min, max, step, value: value ?? spec.default ?? min, class: 'st-num' });
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
  const comp = el('select', { class: 'select' }, ...metas.map((m) => el('option', { value: m.id, text: m.name, selected: m.id === l.component ? true : null })));
  comp.addEventListener('change', () => st.change((p) => { const x = p.layers.find((y) => y.id === l.id); x.component = comp.value; x.params = {}; }));
  const kids = [
    el('div', { class: 'st-insphead' }, el('i', { class: 'tl-dot', style: `background:${TCOLOR[l.type]}` }), el('b', { text: ZH[l.type] }),
      el('span', { class: 'st-grow' }),
      el('button', { class: 'st-btn icon', type: 'button', title: '往上挪（先画）', onclick: () => moveLayer(idx, -1) }, '↑'),
      el('button', { class: 'st-btn icon', type: 'button', title: '往下挪（后画）', onclick: () => moveLayer(idx, 1) }, '↓'),
      el('button', { class: 'st-btn icon', type: 'button', title: '复制一层', onclick: () => { const nid = newId(l.type[0]); st.change((p) => { p.layers.splice(idx + 1, 0, { ...structuredClone(l), id: nid }); }); st.select(nid); } }, '⧉'),
      el('button', { class: 'st-btn icon danger', type: 'button', title: '删掉（Delete）', onclick: () => { st.change((p) => { p.layers.splice(idx, 1); }); st.select(null); } }, '🗑'),
      el('button', { class: 'st-btn icon', type: 'button', title: '取消选中，看工程设置', onclick: () => st.select(null) }, '×')),
  ];
  if (l.type === 'text') {
    const inp = el('input', { class: 'input st-textinput', value: l.text, maxlength: 24 });
    inp.addEventListener('input', () => set((x) => { x.text = inp.value; }, 'text'));
    kids.push(group('文字', inp, el('p', { class: 'st-note', text: '「/」手动换行。' }), styleRow(),
      el('label', { class: 'st-field' }, el('span', { text: '动画' }), comp),
      control({ label: '上下位置', min: 0, max: 512, type: 'int' }, l.y, (v) => set((x) => { x.y = v; }, 'y'), 'y'),
      control({ label: '左右位置', min: -256, max: 256, type: 'int' }, l.x, (v) => set((x) => { x.x = v; }, 'x'), 'x'),
      control({ label: '大小', min: 0.3, max: 2, step: 0.05 }, l.scale, (v) => set((x) => { x.scale = v; }, 'scale'), 'scale')));
  } else if (l.type === 'face') {
    const f = l.face || metaOf('face', l.component)?.face || {};
    const part = (key, label, options) => {
      const s = el('select', { class: 'select' }, ...options.map(([v, t]) => el('option', { value: v, text: t, selected: (f[key] || options[0][0]) === v ? true : null })));
      s.addEventListener('change', () => set((x) => { x.face = { ...(x.face || f), [key]: s.value }; }, key));
      return el('label', { class: 'st-field' }, el('span', { text: label }), s);
    };
    const eyes = ['open', 'closed', 'happy', 'squeeze', 'star', 'big', 'tiny', 'angry', 'sad', 'heart', 'cry', 'teary', 'meh', 'flat', 'sleep', 'up', 'side', 'money', 'x', 'dizzy', 'wink'].map((v) => [v, v]);
    const mouths = ['normal', 'smile', 'o', 'flat', 'frown', 'wavy', 'shout', 'w', 'tongue', 'grin', 'drool', 'eat', 'none'].map((v) => [v, v]);
    const blush = el('input', { type: 'checkbox', checked: f.blush ? true : null });
    blush.addEventListener('change', () => set((x) => { x.face = { ...(x.face || f), blush: blush.checked }; }, 'blush'));
    const blink = el('input', { type: 'checkbox', checked: l.blink !== false ? true : null });
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
  const bgSel = el('select', { class: 'select' }, ...[['white', '白色'], ['transparent', '透明（GIF 背景透明）'], ['color', '纯色']].map(([v, t]) => el('option', { value: v, text: t, selected: v === P.background.mode ? true : null })));
  bgSel.addEventListener('change', () => st.change((p) => { p.background.mode = bgSel.value; }));
  fill(S.inspector, 
    el('div', { class: 'st-insphead' }, el('b', { text: '工程设置' }), el('span', { class: 'st-grow' }), el('small', { class: 'st-note', text: '选中图层看它的属性' })),
    group('画面',
      control({ label: '导出尺寸（像素）', min: 120, max: 800, type: 'int' }, P.size, (v) => set((p) => { p.size = v; }, 'size'), 'size'),
      control({ label: '帧率', min: 6, max: 30, type: 'int' }, P.fps, (v) => set((p) => { p.fps = v; }, 'fps'), 'fps'),
      control({ label: '一圈多少帧', min: 8, max: 120, type: 'int' }, P.frames, (v) => set((p) => { p.frames = v; }, 'frames'), 'frames'),
      el('p', { class: 'st-note', text: `一圈 ${(P.frames / P.fps).toFixed(2)} 秒。正式表情是 48 帧 15 fps。` }),
      el('label', { class: 'st-field' }, el('span', { text: '背景' }), bgSel),
      P.background.mode === 'color' ? control({ label: '背景色', type: 'color' }, P.background.color, (v) => set((p) => { p.background.color = v; }, 'bgc'), 'bgc') : null),
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
async function loadCode() {
  if (S.dock !== 'code') return;
  const ed = await ensureEditor();
  const l = S.store.layer();
  let type, id;
  if (l) { type = l.type === 'text' ? 'textanim' : l.type; id = l.component; } else { type = 'skin'; id = S.store.p.skin.component; }
  const r = await S.runner.request({ type: 'source', ctype: type, id });
  const own = S.store.p.components.find((c) => c.origin === `override:${type}:${id}`) || S.store.p.components.find((c) => c.origin.endsWith(`:${id}`));
  S.codeTarget = { type, id, origin: own ? own.origin : `override:${type}:${id}`, builtin: r.builtin && !own };
  ed.set(own ? own.source : r.source || `// 没找到组件 ${type}:${id} 的源码`);
  const name = nameOf(type, id);
  fill(S.codeHead, 
    el('span', { class: 'st-codetitle' }, el('b', { text: `${ZH[type]}「${name}」` }), el('small', { text: own ? ' · 这个工程里改过' : r.builtin ? ' · 内置（改了只影响这个工程）' : ` · ${r.origin || ''}` })),
    el('span', { class: 'st-grow' }),
    el('button', { class: 'st-btn small primary', type: 'button', title: 'Ctrl+Enter', onclick: () => runCode(ed.value) }, '运行'),
    own ? el('button', { class: 'st-btn small', type: 'button', title: '丢掉这个工程里的改动', onclick: () => { S.store.dropComponent(own.origin); if (r.builtin || own.origin.startsWith('override:')) S.runner.post({ type: 'remove', ctype: type, id }); loadCode(); } }, '还原') : null,
    el('button', { class: 'st-btn small', type: 'button', onclick: () => saveAsMine(ed.value, type) }, '另存为组件'),
    el('button', { class: 'st-btn small', type: 'button', onclick: () => download(new Blob([ed.value], { type: 'text/javascript' }), `${id}.axo.js`) }, '下载'),
    el('button', { class: 'st-btn small', type: 'button', onclick: () => proposeComponent(ed.value, id) }, '提交到组件库'));
  showErrors();
}
function runCode(src) {
  const t = S.codeTarget;
  if (!t) return;
  S.store.putComponent(t.origin, src);
}
function saveAsMine(src, type) {
  const m = /id:\s*['"]([^'"]+)['"]/.exec(src), n = /name:\s*['"]([^'"]+)['"]/.exec(src);
  const id = prompt('新组件的 id（小写字母、数字、-）', m ? `my-${m[1].replace(/^my-/, '')}` : 'my-thing');
  if (!id || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(id)) { if (id) toast('id 只能用小写字母、数字、- 和 _'); return; }
  const name = prompt('中文名', n ? `${n[1]}（我的）` : id) || id;
  let out = src.replace(/id:\s*['"][^'"]+['"]/, `id: '${id}'`).replace(/name:\s*['"][^'"]+['"]/, `name: '${name.replace(/'/g, '’')}'`).replace(/\s*extends:\s*['"][^'"]+['"],?/, (x) => x);
  const origin = `mine:${id}`;
  S.store.saveMine({ origin, name, type, source: out });
  S.store.putComponent(origin, out);
  const l = S.store.layer();
  if (l && (l.type === type || (l.type === 'text' && type === 'textanim'))) S.store.change((p) => { p.layers.find((x) => x.id === l.id).component = id; });
  toast(`存好了：「${name}」。在「组件」里能下载、提交到组件库`);
  loadCode();
}
function newComponent(type) {
  const src = TEMPLATES[type];
  const id = /id:\s*'([^']+)'/.exec(src)[1], origin = `mine:${id}-${Date.now().toString(36).slice(-4)}`;
  const fixed = src.replace(/id:\s*'([^']+)'/, (x, a) => `id: '${a}-${origin.slice(-4)}'`);
  const nid = /id:\s*'([^']+)'/.exec(fixed)[1];
  S.store.putComponent(origin, fixed);
  S.store.saveMine({ origin, name: /name:\s*'([^']+)'/.exec(fixed)[1], type, source: fixed });
  if (type === 'skin') S.store.change((p) => { p.skin = { component: nid, params: {} }; });
  else {
    const lt = type === 'textanim' ? 'text' : type, lid = newId(lt[0]);
    S.store.change((p) => { p.layers.push(lt === 'text' ? { id: lid, type: 'text', component: nid, text: '新动画' } : { id: lid, type: lt, component: nid }); });
    S.store.select(lid);
  }
  setDock('code');
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
function pickFile(accept = '.js,.json,.axo,.glb,.gltf,application/json,text/javascript') {
  const i = el('input', { type: 'file', accept, multiple: true });
  i.addEventListener('change', () => { for (const f of i.files) importFile(f); });
  i.click();
}
async function importFile(f) {
  if (/\.(glb|gltf)$/i.test(f.name)) {
    if (f.size > 4 << 20) { toast(`${f.name} 太大了（模型上限 4 MB）`); return; }
    const id = `file:${f.name}`, bytes = await f.arrayBuffer(), my = ++modelPick;
    const r = await S.runner.request({ type: 'model', id, bytes: bytes.slice(0) }).catch((e) => ({ ok: false, message: e.message }));
    if (!r.ok) { toast(`模型没读出来：${r.message}`); return; }
    S.models.set(id, { name: f.name, bytes, info: `${r.quads} 个面片 · 骨骼 ${r.bones.join(' ') || '无'}` });
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
    if (!confirm(`载入组件「${f.name}」？\n\n组件是别人写的代码，会在预览沙盒里运行（碰不到这个网页和你的数据，但只载入你信任的来源）。`)) return;
    const origin = `file:${f.name.replace(/\.axo\.js$|\.js$/i, '')}`;
    const m = /type:\s*['"](\w+)['"]/.exec(text), n = /name:\s*['"]([^'"]+)['"]/.exec(text);
    S.store.saveMine({ origin, name: n ? n[1] : f.name, type: m ? m[1] : '', source: text });
    S.store.putComponent(origin, text);
    const s = sniff(text); applyNew(s.type, s.id);
    toast(`载入并用上了「${n ? n[1] : f.name}」（也存进了「我的组件」）`);
    return;
  }
  toast(`不认识 ${f.name}：能拖进来的是 .axo.json 工程、.axo.js 组件、.glb / .gltf 模型`);
}

async function encodeShare(p) {
  const json = new TextEncoder().encode(JSON.stringify(p));
  if (!('CompressionStream' in window)) return 'j' + btoa(String.fromCharCode(...json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
async function shareLink() {
  const code = await encodeShare(S.store.p);
  const url = `${location.origin}${location.pathname}#/editor?s=${code}`;
  try { await navigator.clipboard.writeText(url); toast(url.length > 6000 ? '链接复制好了（有点长，有的聊天软件会截断）' : '链接复制好了'); } catch { prompt('复制这个链接：', url); }
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
    if (!(l.style in CAT.styles)) out.push(`「${l.text}」的字色不是内置的那几种`);
  }
  if (p.layers.length > PUB.layers) out.push(`图层最多 ${PUB.layers} 个`);
  if (p.frames > PUB.frames) out.push(`工坊最多 ${PUB.frames} 帧，现在是 ${p.frames} 帧（右边「工程设置」里改）`);
  if (!['axolotl', 'logo'].includes(p.model.component)) out.push('自己载入的模型只在你的浏览器里，发不上去：先在「模型」里换回网站自带的');
  if (p.components.length > PUB.components) out.push(`工程最多带 ${PUB.components} 段组件代码，现在有 ${p.components.length} 段`);
  for (const c of p.components) if (size(c.source) > PUB.component) out.push(`组件代码「${c.origin}」超过 ${PUB.component / 1000} KB`);
  if (size(json) > PUB.bytes) out.push(`工程太大了（${Math.round(size(json) / 1000)} KB，最多 ${PUB.bytes / 1000} KB）`);
  if (S.errors.length || S.compileErrors.length) out.push('预览里还有组件报错（看左上角的红色角标）：出图时有报错就不会发布');
  return out;
}

function publish() {
  const p = S.store.p, json = JSON.stringify(p), problems = preflight(p, json);
  if (problems.length) {
    dialog('还不能发布', [el('p', { text: '工坊机器人会按这些规矩检查，先改一下：' }), el('ul', {}, ...problems.map((t) => el('li', { text: t })))], []);
    return;
  }
  const title = `[工坊] ${p.layers.find((l) => l.type === 'text')?.text || p.name || '美西螈'}`;
  const base = `https://github.com/${REPO}/issues/new?template=workshop.yml&title=${encodeURIComponent(title)}`;
  const url = `${base}&project=${encodeURIComponent(json)}`;
  dialog('发布到工坊', [
    el('p', { text: '会打开 GitHub 的发布表单（要登录 GitHub）。提交之后，GitHub Actions 在隔离的环境里用同一个引擎重新出图，几分钟后出现在「工坊作品」。别人给 issue 点 👍 就是点赞。' }),
    p.components.length ? el('p', { class: 'st-note', text: `这个工程带了 ${p.components.length} 段组件代码，会一起发上去（出图时在沙盒里跑，维护者也会看）。` }) : null,
    url.length > 6000 ? el('p', { class: 'st-warn', text: '工程有点大，放不进链接：点下面的按钮会先把工程复制到剪贴板，打开表单后粘贴到「工程」那一栏。' }) : null,
  ], [['打开 GitHub 发布表单', async () => {
    if (url.length > 6000) { try { await navigator.clipboard.writeText(json); toast('工程已复制，粘贴到表单的「工程」栏'); } catch { /* 用户自己复制 */ } window.open(base, '_blank', 'noopener'); }
    else window.open(url, '_blank', 'noopener');
  }, 'primary']]);
}

function proposeComponent(src, id) {
  const name = `${String(id).replace(/[^a-z0-9_-]/gi, '-')}.axo.js`;
  const header = /^\/\*\s*@axo/.test(src) ? '' : `/* @axo ${JSON.stringify({ id: (/id:\s*['"]([^'"]+)['"]/.exec(src) || [])[1] || id, type: (/type:\s*['"](\w+)['"]/.exec(src) || [])[1] || '', name: (/name:\s*['"]([^'"]+)['"]/.exec(src) || [])[1] || id, author: '你的 GitHub 名字', version: '1.0.0', description: '一句话说明' })} */\n`;
  const body = header + src;
  const url = `https://github.com/${REPO}/new/main/workshop/components?filename=${encodeURIComponent(name)}&value=${encodeURIComponent(body)}`;
  dialog('提交到组件库', [
    el('p', { text: '组件库是仓库里的 workshop/components 文件夹。提交后 GitHub 会帮你 fork 一份并开一个 PR，维护者看过合并后，所有人都能在「组件」里直接用。' }),
    el('p', { class: 'st-note', text: '文件开头的 /* @axo {...} */ 是组件库的说明卡，记得把作者和说明改成你的。' }),
    url.length > 6000 ? el('p', { class: 'st-warn', text: '代码有点长，放不进链接：先下载文件，再在打开的页面里上传。' }) : null,
  ], [
    url.length > 6000
      ? ['下载并打开上传页', () => { download(new Blob([body], { type: 'text/javascript' }), name); window.open(`https://github.com/${REPO}/upload/main/workshop/components`, '_blank', 'noopener'); }, 'primary']
      : ['在 GitHub 上新建文件', () => window.open(url, '_blank', 'noopener'), 'primary'],
    ['只下载文件', () => download(new Blob([body], { type: 'text/javascript' }), name)],
  ]);
}

function dialog(title, body, actions) {
  const d = el('dialog', { class: 'st-dialog' });
  d.append(el('h2', { text: title }), ...body.filter(Boolean),
    el('div', { class: 'st-dlgactions' }, ...actions.map(([t, f, cls]) => el('button', { class: `btn ${cls || ''}`, type: 'button', onclick: async () => { const keep = await f(); if (keep !== true) d.close(); } }, t)),
      el('button', { class: 'btn', type: 'button', onclick: () => d.close() }, '关掉')));
  d.addEventListener('close', () => d.remove());
  document.body.append(d); d.showModal();
  return d;
}

function showExport() {
  const P = S.store.p;
  let format = 'gif', size = P.size, colors = 0, maxKb = 1000;
  const presets = [['原尺寸', P.size, 1000], ['微信表情 240', 240, 500], ['高清 800', 800, 4000]];
  const presetBox = el('div', { class: 'chips' }, ...presets.map(([t, s, kb], i) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(i === 0), onclick: (e) => {
    size = s; maxKb = kb; sizeIn.value = s; kbIn.value = kb;
    for (const c of presetBox.children) c.setAttribute('aria-pressed', String(c === e.currentTarget));
  } }, `${t}（${s}px）`)));
  const fmt = el('select', { class: 'select' }, ...[['gif', 'GIF 动图'], ['png-zip', '逐帧 PNG（zip）'], ['png', '当前这一帧 PNG']].map(([v, t]) => el('option', { value: v, text: t })));
  fmt.addEventListener('change', () => { format = fmt.value; });
  const sizeIn = el('input', { class: 'input', type: 'number', min: 64, max: 800, value: size });
  sizeIn.addEventListener('change', () => { size = Math.max(64, Math.min(800, +sizeIn.value || 400)); });
  const colSel = el('select', { class: 'select' }, ...[[0, '自动（64 色起，超大小就降）'], [256, '256 色'], [128, '128'], [64, '64'], [32, '32'], [16, '16']].map(([v, t]) => el('option', { value: v, text: t })));
  colSel.addEventListener('change', () => { colors = +colSel.value; });
  const kbIn = el('input', { class: 'input', type: 'number', min: 100, max: 8000, value: maxKb });
  kbIn.addEventListener('change', () => { maxKb = +kbIn.value || 1000; });
  const bar = el('div', { class: 'progress', hidden: true }, el('i'));
  const result = el('div', { class: 'st-result' });
  dialog('导出', [
    el('h4', { text: '预设' }), presetBox,
    el('div', { class: 'two' }, el('label', { class: 'st-field' }, el('span', { text: '格式' }), fmt), el('label', { class: 'st-field' }, el('span', { text: '边长（像素）' }), sizeIn)),
    el('div', { class: 'two' }, el('label', { class: 'st-field' }, el('span', { text: '颜色数' }), colSel), el('label', { class: 'st-field' }, el('span', { text: '大小上限（KB）' }), kbIn)),
    el('p', { class: 'st-note', text: `${P.frames} 帧 · ${P.fps} fps · 第一帧是封面${P.background.mode === 'transparent' ? ' · 透明背景' : ''}` }),
    bar, result,
  ], [['开始导出', async () => {
    bar.hidden = false; fill(result, el('p', { class: 'st-note', text: '一帧一帧地画…' }));
    try {
      const r = await S.runner.request({ type: 'export', format, size, colors: colors || undefined, maxKb }, (p) => { bar.firstElementChild.style.width = `${Math.round(p * 100)}%`; });
      const blob = new Blob([r.bytes], { type: r.mime }), url = URL.createObjectURL(blob);
      const ext = format === 'gif' ? 'gif' : format === 'png' ? 'png' : 'zip', fname = `${P.name || '美西螈'}.${ext}`;
      fill(result, 
        format !== 'png-zip' ? el('img', { src: url, alt: '导出的结果', class: 'st-resultimg' }) : null,
        el('p', { class: 'st-note', text: `${Math.round(blob.size / 1024)} KB · 电脑上点下载；手机微信里长按图片保存。` }),
        el('div', { class: 'st-row' }, el('a', { class: 'btn primary', href: url, download: fname }, '下载'),
          navigator.canShare?.({ files: [new File([blob], fname, { type: r.mime })] }) ? el('button', { class: 'btn', type: 'button', onclick: () => navigator.share({ files: [new File([blob], fname, { type: r.mime })] }).catch(() => {}) }, '分享') : null));
    } catch (e) { fill(result, el('p', { class: 'st-warn', text: '导出失败：' + e.message })); }
    bar.hidden = true;
    return true;
  }, 'primary']]);
}

function showKeys() {
  dialog('快捷键', [el('table', { class: 'st-keys' }, ...[
    ['空格', '播放 / 暂停'], ['← / →', '上一帧 / 下一帧'], ['Shift + ← / →', '跳 10 帧'], ['Home / End', '第一帧 / 最后一帧'],
    ['Ctrl + Z / Ctrl + Shift + Z', '撤销 / 重做'], ['Delete', '删掉选中的图层'], ['Esc', '取消选中'], ['O', '洋葱皮'],
    ['Ctrl + S', '保存工程文件（在代码里是「运行」）'], ['Ctrl + Enter', '运行代码'], ['拖文件进来', '打开工程 / 载入组件'],
  ].map(([k, v]) => el('tr', {}, el('td', {}, el('kbd', { text: k })), el('td', { text: v }))))], []);
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
  else if (k === 'ArrowLeft') { seek(S.frame - (e.shiftKey ? 10 : 1)); e.preventDefault(); }
  else if (k === 'ArrowRight') { seek(S.frame + (e.shiftKey ? 10 : 1)); e.preventDefault(); }
  else if (k === 'Home') seek(0);
  else if (k === 'End') seek(S.N - 1);
  else if (mod && k.toLowerCase() === 'z') { (e.shiftKey ? S.store.redo() : S.store.undo()); e.preventDefault(); }
  else if (mod && k.toLowerCase() === 'y') { S.store.redo(); e.preventDefault(); }
  else if (mod && k.toLowerCase() === 's') { saveProjectFile(); e.preventDefault(); }
  else if ((k === 'Delete' || k === 'Backspace') && S.store.selected) { const id = S.store.selected; S.store.change((p) => { p.layers = p.layers.filter((l) => l.id !== id); }); S.store.select(null); }
  else if (k === 'Escape') S.store.select(null);
  else if (k === 'o' || k === 'O') S.onionBtn.click();
  else if (k === '?') showKeys();
}
