// 大图弹窗：图鉴和工坊作品共用。逐帧播放器、配方、下载、在工坊里改一改、上一张 / 下一张。
import { CAT, REPO, RELEASE, $, el, recipeRows, toast, gifName } from './util.js';
import { FramePlayer } from './player.js';

const dlg = $('#detail');
const player = new FramePlayer($('#d-player'));
let cur = null;           // { item, list, kind, onNav }

function rows(r) {
  return recipeRows(r).flatMap(([k, v, code]) => [el('dt', { text: k }), el('dd', {}, v, code && code !== v ? el('code', { text: code }) : null)]);
}

// 第二版的工坊投稿没有配方，只有机器人写的一行摘要：「动作 蹦跶、点头 · 表情 微笑 · 48 帧 · 15 fps · 自带 1 段组件代码」；
// 300 张翻新以后也是按工程出的图，清单里是同样格式的摘要（engine/manifest.py 按 out/projects 写的）
function summaryRows(s) {
  const out = [], rest = [];
  for (const part of String(s || '').split(' · ')) {
    const m = /^(动作|表情|道具|帽子|特效|文字动画|场景|模型) (.+)$/.exec(part);
    if (m) out.push(el('dt', { text: m[1] }), el('dd', { text: m[2].replaceAll('`', '') }));
    else if (part) rest.push(part);
  }
  if (rest.length) out.push(el('dt', { text: '其他' }), el('dd', { text: rest.join(' · ') }));
  return out;
}

function fill() {
  const { item: it, kind, list } = cur;
  const gif = kind === 'workshop' ? it.gifUrl : it.gif;
  const name = gifName(it, kind);
  player.load(gif, it.still, name);
  $('#d-title').textContent = it.text || '（无字）';
  const recipe = kind === 'workshop' ? it.recipe : it;
  const meta = kind === 'workshop'
    ? `工坊 #${it.issue} · @${it.author} · ${it.date.slice(0, 10)}`
    : it.special ? `${it.category_zh} · ${it.series}` : `#${it.key} · ${CAT.categories[it.category] || it.category_zh}`;
  $('#d-meta').textContent = meta;
  const dl = $('#d-recipe');
  dl.replaceChildren(...(kind === 'workshop' && it.desc ? [el('dt', { text: '说明' }), el('dd', { text: it.desc })] : []),   // 投稿时写的一句话（纯文本）
    ...(it.series === '水龙卷' ? [el('dt', { text: '动作' }), el('dd', { text: '水龙卷（转着圈飞上天，又掉回来）' })]
    : it.special && it.project ? [el('dt', { text: '来源' }), el('dd', { text: '初代表情包工具包里的原图' }), el('dt', { text: '工程' }), el('dd', { text: '照着原图的脚本在创意工坊里拼了一份（动作、道具、特效、文字动画都是编辑器里的组件），「在工坊里改一改」打开它' })]
    : it.special ? [el('dt', { text: '来源' }), el('dd', { text: '初代表情包工具包里的原图（不是这个引擎出的，没有配方）' })]
    : (kind === 'workshop' && !recipe) || (!it.special && it.summary) ? summaryRows(it.summary) : rows(recipe)));
  const down = $('#d-download');
  down.href = gif;
  down.download = `${name}.gif`;
  const remix = $('#d-remix');
  remix.hidden = !!it.special && !it.project;                  // 初代有照着做的工程；水龙卷没有
  remix.href = kind === 'workshop' ? `#/editor?w=${it.issue}` : it.project ? `#/editor?g=${encodeURIComponent(it.special ? it.slug : it.key)}` : '#/editor?r=' + encodeURIComponent(JSON.stringify(Object.fromEntries(['text', 'motion', 'face', 'fx', 'hold', 'wear', 'style', 'tmode', 'n', 's', 'debris', 'dir', 'flip', 'seed', 'idle', 'params'].filter((k) => it[k] !== undefined).map((k) => [k, it[k]]))));   // 动作参数和种子也带上，改一改时和原图一样
  const issue = $('#d-issue');
  issue.hidden = kind !== 'workshop';
  if (kind === 'workshop') { issue.href = `https://github.com/${REPO}/issues/${it.issue}`; issue.textContent = `去 GitHub 点 👍（${it.likes || 0}）`; }
  const note = $('#d-note');
  note.replaceChildren();
  if (kind === 'workshop') note.append('想让它进下一版正式表情包？去 issue 里喊一声。');
  else {
    if (it.series === '水龙卷') note.append('水龙卷用到了原版 Minecraft 材质，没放进工坊，只能本地用引擎出（见 README）。 ');
    note.append('全部 300 张 + 4 张初代 + 水龙卷打包：', el('a', { href: RELEASE.url, text: `Release zip（${RELEASE.size}）` }));
  }
  const i = list.indexOf(it);
  $('#d-prev').disabled = i <= 0; $('#d-next').disabled = i < 0 || i >= list.length - 1;
}

export function openDetail(item, list, kind, onNav) {
  cur = { item, list, kind, onNav };
  fill();
  if (!dlg.open) dlg.showModal();
}
export function closeDetail(silent) {
  if (!dlg.open) return;
  cur = null; player.stop(); dlg.close();
  if (!silent) history.replaceState(null, '', location.pathname + location.search + (location.hash.startsWith('#/w/') ? '#/workshop' : '#/'));
}
function step(d) {
  if (!cur) return;
  const i = cur.list.indexOf(cur.item), nx = cur.list[i + d];
  if (nx) cur.onNav(nx);
}

$('#d-close').addEventListener('click', () => closeDetail());
$('#d-prev').addEventListener('click', () => step(-1));
$('#d-next').addEventListener('click', () => step(1));
dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDetail(); });
dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeDetail(); });
dlg.addEventListener('keydown', (e) => {          // ←/→ 逐帧、空格暂停；Shift+←/→ 换一张
  if (e.target.closest('input, select, textarea')) return;
  if (e.shiftKey && e.key === 'ArrowLeft') { step(-1); e.preventDefault(); return; }
  if (e.shiftKey && e.key === 'ArrowRight') { step(1); e.preventDefault(); return; }
  if (player.key(e)) e.preventDefault();
});

// 手机上直接调系统分享（能存相册 / 发给好友）
const share = $('#d-share');
try { share.hidden = !(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.gif', { type: 'image/gif' })] })); } catch { share.hidden = true; }
share.addEventListener('click', async () => {
  try {
    const src = $('#d-download').href, name = $('#d-download').download;
    const blob = await (await fetch(src)).blob();
    await navigator.share({ files: [new File([blob], name, { type: 'image/gif' })], title: $('#d-title').textContent });
  } catch (e) { if (e.name !== 'AbortError') toast('分享没成功，长按图片保存试试'); }
});
