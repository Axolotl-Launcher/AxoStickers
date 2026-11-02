// 创意工坊 · 编辑器：选项面板 + three.js 实时预览 + 浏览器里导出 GIF + 发布（打开填好配方的 GitHub issue）。
import { CAT, REPO, STYLE_COLORS, $, el, toast, toRecipe, recipeToSpec } from './util.js';

const DEFAULT = { v: 1, text: '摸鱼', motion: 'flagwave', face: 'happy', fx: ['bubbles'], hold: 'fish', wear: [], style: 'pink', tmode: 'stay' };
const LINES = ['收到', '已阅', '在摸了', '下次一定', '你说得对', '啊对对对', '也不是不行', '先这样吧', '关我啥事', '好家伙',
  '绷不住了', '没救了', '急了', '已老实', '睡了', '开摆', '不想努力', '蚌埠住了', '我是谁', '稳住', '收工', '就这', '这河里吗'];
const TEXT_RE = new RegExp(`^[${CAT.text.chars}]+$`, 'u');

let ENG = null, R = null, stk = null;
const rec = structuredClone(DEFAULT);
const ui = {};
let t0 = performance.now(), paused = false, pausedAt = 0, active = false, built = false, frameVisible = true;

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chars = (s) => [...s];

function textState() {
  const n = chars(rec.text).length;
  if (!n) return [false, '先写几个字'];
  if (n > CAT.text.max) return [false, `最多 ${CAT.text.max} 个字（现在 ${n} 个）`];
  if (!TEXT_RE.test(rec.text)) return [false, '有不支持的字符：' + CAT.text.hint];
  return [true, `${n}/${CAT.text.max} · ${CAT.text.hint}`];
}

export function recipe() {
  const r = { v: 1, ...rec, fx: [...rec.fx], wear: [...rec.wear] };
  const m = CAT.motions[r.motion];
  if (m.noHold) r.hold = null;
  else if (m.prop && !r.hold) r.hold = m.prop;
  return r;
}

// ---------------- 面板 ----------------
function chipGroup(entries, isOn, onClick, extra) {
  const box = el('div', { class: 'chips' });
  for (const [k, label] of entries) {
    const b = el('button', { class: 'chip', type: 'button', 'data-v': k, 'aria-pressed': String(isOn(k)), onclick: () => onClick(k) }, label);
    extra?.(b, k);
    box.append(b);
  }
  return box;
}
const group = (title, sub, ...kids) => el('section', { class: 'group' }, el('h3', {}, title, sub ? el('small', { text: sub }) : null), ...kids);

function buildPanel() {
  const P = $('#ed-panel');
  ui.text = el('input', { class: 'input', id: 'ed-text', value: rec.text, autocomplete: 'off', enterkeyhint: 'done', 'aria-label': '文字' });
  ui.text.addEventListener('input', () => { rec.text = ui.text.value.trim(); refresh(); });
  ui.textHint = el('p', { class: 'hint' });

  const M = CAT.motions, ids = Object.keys(M);
  const body = ids.filter((k) => !M[k].prop && !M[k].noHold && !M[k].offscreen);
  const props = ids.filter((k) => M[k].prop || M[k].noHold), off = ids.filter((k) => M[k].offscreen);
  const onMotion = (k) => {
    const was = M[rec.motion];
    if (was.prop && rec.hold === was.prop && !M[k].prop) rec.hold = null;   // 换走道具动作时，顺手放下它默认的道具
    rec.motion = k;
    if (M[k].prop && !rec.hold) rec.hold = M[k].prop;
    if (M[k].offscreen && CAT.entrance.includes(rec.tmode)) { rec.tmode = 'stay'; toast('这个动作会离开画面，文字动画换回「轻轻晃」'); }
    refresh();
  };
  const mchips = (list) => chipGroup(list.map((k) => [k, M[k].zh]), (k) => k === rec.motion, onMotion);
  ui.motions = el('div', {},
    mchips(body),
    el('h4', { text: '拿着道具的（道具在下面选）' }), mchips(props),
    el('h4', { text: '中途会离开画面的' }), mchips(off));

  ui.faces = chipGroup(Object.entries(CAT.faces), (k) => k === rec.face, (k) => { rec.face = k; refresh(); });
  ui.fxHint = el('small');
  ui.fx = chipGroup(Object.entries(CAT.fx), (k) => rec.fx.includes(k), (k) => {
    if (rec.fx.includes(k)) rec.fx = rec.fx.filter((f) => f !== k);
    else { rec.fx = [...rec.fx, k]; if (rec.fx.length > CAT.limits.fx) rec.fx.shift(); }
    refresh();
  });

  ui.hold = el('select', { class: 'select', 'aria-label': '道具' }, el('option', { value: '', text: '不拿东西' }),
    ...Object.entries(CAT.holds).map(([k, v]) => el('option', { value: k, text: v })));
  ui.hold.addEventListener('change', () => { rec.hold = ui.hold.value || null; refresh(); });
  ui.wear = el('select', { class: 'select', 'aria-label': '帽子' }, el('option', { value: '', text: '不戴' }),
    ...Object.entries(CAT.wears).map(([k, v]) => el('option', { value: k, text: v })));
  ui.wear.addEventListener('change', () => { rec.wear = ui.wear.value ? [ui.wear.value] : []; refresh(); });
  ui.holdHint = el('p', { class: 'hint' });

  ui.styles = el('div', { class: 'style-picks' }, ...Object.entries(CAT.styles).map(([k, zh]) =>
    el('button', { class: 'style-pick', type: 'button', 'data-v': k, title: zh + '字', 'aria-label': zh + '字', 'aria-pressed': String(rec.style === k),
      onclick: () => { rec.style = k; refresh(); } }, el('canvas', { width: 104, height: 104, style: `background:linear-gradient(${STYLE_COLORS[k][0]}22, #fff)` }))));

  ui.tmodes = chipGroup(Object.entries(CAT.tmodes), (k) => k === rec.tmode, (k) => { rec.tmode = k; refresh(); });

  P.append(
    group('文字', null, el('div', { class: 'text-row' }, ui.text), ui.textHint),
    group('动作', `${ids.length} 种`, ui.motions),
    group('表情', null, ui.faces),
    group('特效', `最多 ${CAT.limits.fx} 个，点第三个会顶掉最早的`, ui.fx),
    group('道具和帽子', null, el('div', { class: 'two' },
      el('label', { class: 'field' }, el('span', { class: 'hint', text: '手里拿' }), ui.hold),
      el('label', { class: 'field' }, el('span', { class: 'hint', text: '头上戴' }), ui.wear)), ui.holdHint),
    group('字色', null, ui.styles),
    group('文字动画', null, ui.tmodes));
}

function syncPanel() {
  const [ok, msg] = textState();
  ui.textHint.textContent = msg; ui.textHint.classList.toggle('err', !ok);
  if (document.activeElement !== ui.text && ui.text.value !== rec.text) ui.text.value = rec.text;
  const M = CAT.motions[rec.motion];
  for (const b of ui.motions.querySelectorAll('.chip')) b.setAttribute('aria-pressed', String(b.dataset.v === rec.motion));
  for (const b of ui.faces.children) b.setAttribute('aria-pressed', String(b.dataset.v === rec.face));
  for (const b of ui.fx.children) b.setAttribute('aria-pressed', String(rec.fx.includes(b.dataset.v)));
  for (const b of ui.styles.children) b.setAttribute('aria-pressed', String(b.dataset.v === rec.style));
  for (const b of ui.tmodes.children) {
    const off = M.offscreen && CAT.entrance.includes(b.dataset.v);
    b.disabled = off; b.title = off ? '这个动作中途会离开画面，封面会拍不到美西螈' : '';
    b.setAttribute('aria-pressed', String(b.dataset.v === rec.tmode));
  }
  const r = recipe();
  ui.hold.disabled = !!M.noHold;
  ui.hold.value = r.hold || '';
  ui.hold.options[0].disabled = !!M.prop;
  ui.wear.value = rec.wear[0] || '';
  ui.holdHint.textContent = M.noHold ? `「${M.zh}」自带道具，手里不能再拿别的。` : M.prop ? `「${M.zh}」会挥舞 / 使用手里的道具。` : '';
  $('#ed-publish').disabled = !ok; $('#ed-export').disabled = !ok || exporting;
}

// ---------------- 预览 ----------------
let buildId = 0;
async function rebuild() {
  if (!ENG) return;
  const id = ++buildId, r = recipe();
  await ENG.loadFont(r.text);
  if (id !== buildId) return;
  stk = ENG.makeSticker(recipeToSpec(r), R);
  if (paused) draw(pausedAt);
}
function refresh() {
  syncPanel();
  rebuild();
  const h = '#/editor?r=' + encodeURIComponent(JSON.stringify(recipe()));
  if (location.hash.startsWith('#/editor') && location.hash !== h) history.replaceState(null, '', h);
}

function draw(t) {
  if (!stk) return;
  stk.frame(ui.ctx, t % stk.T);
  if (!ui.mini.hidden) ui.mctx.drawImage(ui.canvas, 0, 0, ui.mctx.canvas.width, ui.mctx.canvas.height);
}
function loop(now) {
  requestAnimationFrame(loop);
  if (!active || paused || document.hidden) return;
  draw((now - t0) / 1000);
}

async function drawStyles() {
  await ENG.loadFont('字');
  for (const b of ui.styles.children) {
    const c = b.querySelector('canvas'), g = c.getContext('2d'), s = ENG.charSprite('字', 64, b.dataset.v);
    g.clearRect(0, 0, c.width, c.height);
    const k = Math.min(c.width / s.width, c.height / s.height) * 1.1;
    g.drawImage(s, (c.width - s.width * k) / 2, (c.height - s.height * k) / 2 + 4, s.width * k, s.height * k);
  }
}

// ---------------- 导出 / 发布 ----------------
let exporting = false;
async function doExport() {
  const [ok] = textState();
  if (!ok || exporting || !ENG) return;
  exporting = true; syncPanel();
  const bar = $('#ed-progress'), st = $('#ed-status');
  bar.hidden = false; st.textContent = '正在一帧一帧地画……';
  try {
    const r = recipe();
    await ENG.loadFont(r.text);
    const blob = await ENG.exportGif(recipeToSpec(r), R, (p) => { bar.firstElementChild.style.width = `${Math.round(p * 100)}%`; });
    const a = el('a', { href: URL.createObjectURL(blob), download: `${r.text}.gif` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    st.textContent = `导出好了：${Math.round(blob.size / 1024)} KB，400×400，48 帧。没自动下载的话再点一次。`;
  } catch (e) {
    console.error(e); st.textContent = '导出失败了：' + e.message;
  } finally {
    exporting = false; bar.hidden = true; bar.firstElementChild.style.width = '0'; syncPanel();
  }
}

function publish() {
  const [ok, msg] = textState();
  if (!ok) { toast(msg); return; }
  const r = recipe();
  const q = new URLSearchParams({ template: 'workshop.yml', title: `[工坊] ${r.text}`, recipe: JSON.stringify(r) });
  window.open(`https://github.com/${REPO}/issues/new?${q}`, '_blank', 'noopener');
  $('#ed-status').textContent = '在打开的 GitHub 页面里点「Create」提交就行。几分钟后去「工坊作品」看。';
}

function randomize() {
  const M = CAT.motions, mk = pick(Object.keys(M));
  rec.text = pick(LINES); rec.motion = mk; rec.face = pick(Object.keys(CAT.faces));
  rec.fx = Math.random() < 0.8 ? [pick(Object.keys(CAT.fx))] : [];
  if (Math.random() < 0.3) { const f = pick(Object.keys(CAT.fx)); if (!rec.fx.includes(f)) rec.fx.push(f); }
  rec.hold = M[mk].prop ? (Math.random() < 0.6 ? M[mk].prop : pick(Object.keys(CAT.holds))) : Math.random() < 0.15 ? pick(Object.keys(CAT.holds)) : null;
  rec.wear = Math.random() < 0.3 ? [pick(Object.keys(CAT.wears))] : [];
  rec.style = pick(Object.keys(CAT.styles));
  const tm = Object.keys(CAT.tmodes).filter((k) => !(M[mk].offscreen && CAT.entrance.includes(k)));
  rec.tmode = Math.random() < 0.4 ? 'stay' : pick(tm);
  t0 = performance.now();
  refresh();
}

// ---------------- 对外 ----------------
export function loadRecipe(raw) {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    Object.assign(rec, toRecipe(obj), { text: chars(String(obj.text || '')).slice(0, 20).join('') });
    if (!rec.text) rec.text = DEFAULT.text;
  } catch { /* 链接里的配方坏了就用默认的 */ }
  t0 = performance.now();
  if (built) refresh();
}

export async function initEditor() {
  if (built) return;
  built = true;
  buildPanel();
  ui.canvas = $('#ed-canvas'); ui.ctx = ui.canvas.getContext('2d');
  ui.mini = $('#ed-mini'); ui.mctx = ui.mini.querySelector('canvas').getContext('2d');
  syncPanel();
  $('#ed-status').textContent = '正在加载引擎……';
  ENG = await import('./engine/index.js');
  R = ENG.renderer();
  $('#ed-status').textContent = '';
  drawStyles();
  await rebuild();
  requestAnimationFrame(loop);

  $('#ed-export').addEventListener('click', doExport);
  $('#ed-publish').addEventListener('click', publish);
  $('#ed-random').addEventListener('click', randomize);
  $('#ed-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(recipe())); toast('配方复制好了'); } catch { toast('复制失败，浏览器不让'); }
  });
  $('#ed-play').addEventListener('click', (e) => {
    paused = !paused;
    if (paused) pausedAt = (performance.now() - t0) / 1000; else t0 = performance.now() - pausedAt * 1000;
    e.currentTarget.textContent = paused ? '▶' : '❚❚';
    e.currentTarget.setAttribute('aria-label', paused ? '播放' : '暂停');
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { frameVisible = e.isIntersecting; ui.mini.hidden = frameVisible || !active; }, { threshold: 0.25 }).observe($('#ed-frame'));
  }
  ui.mini.addEventListener('click', () => $('#ed-frame').scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

export function setEditorActive(on) {
  active = on;
  if (ui.mini) ui.mini.hidden = !on || frameVisible;
}
