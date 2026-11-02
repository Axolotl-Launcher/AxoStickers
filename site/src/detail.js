// 大图弹窗：图鉴和工坊作品共用。逐帧播放器、配方、下载、在工坊里改一改、上一张 / 下一张。
import { CAT, REPO, RELEASE, $, el, recipeRows, toast } from './util.js';
import { FramePlayer } from './player.js';

const dlg = $('#detail');
const player = new FramePlayer($('#d-player'));
let cur = null;           // { item, list, kind, onNav }

function rows(r) {
  return recipeRows(r).flatMap(([k, v, code]) => [el('dt', { text: k }), el('dd', {}, v, code && code !== v ? el('code', { text: code }) : null)]);
}

// 第二版的工坊投稿没有配方，只有机器人写的一行摘要：「动作 蹦跶、点头 · 表情 微笑 · 48 帧 · 15 fps · 自带 1 段组件代码」
function summaryRows(s) {
  const out = [], rest = [];
  for (const part of String(s || '').split(' · ')) {
    const m = /^(动作|表情|道具|帽子|特效|场景|模型) (.+)$/.exec(part);
    if (m) out.push(el('dt', { text: m[1] }), el('dd', { text: m[2].replaceAll('`', '') }));
    else if (part) rest.push(part);
  }
  if (rest.length) out.push(el('dt', { text: '其他' }), el('dd', { text: rest.join(' · ') }));
  return out;
}

function fill() {
  const { item: it, kind, list } = cur;
  const gif = kind === 'workshop' ? it.gifUrl : it.gif;
  const name = kind === 'workshop' ? `工坊${it.issue}_${it.text}` : `${it.special ? '水龙卷' : it.key}_${it.text || '无字'}`;
  player.load(gif, it.still, name);
  $('#d-title').textContent = it.text || '（无字）';
  const recipe = kind === 'workshop' ? it.recipe : it;
  const meta = kind === 'workshop'
    ? `工坊 #${it.issue} · @${it.author} · ${it.date.slice(0, 10)}`
    : it.special ? '特别篇 · 水龙卷' : `#${it.key} · ${CAT.categories[it.category] || it.category_zh}`;
  $('#d-meta').textContent = meta;
  const dl = $('#d-recipe');
  dl.replaceChildren(...(it.special ? [el('dt', { text: '动作' }), el('dd', { text: '水龙卷（转着圈飞上天，又掉回来）' })]
    : kind === 'workshop' && !recipe ? summaryRows(it.summary) : rows(recipe)));
  const down = $('#d-download');
  down.href = gif;
  down.download = `${name}.gif`;
  const remix = $('#d-remix');
  remix.hidden = !!it.special;
  remix.href = kind === 'workshop' ? `#/editor?w=${it.issue}` : '#/editor?r=' + encodeURIComponent(JSON.stringify({ text: it.text, motion: it.motion, face: it.face, fx: it.fx, hold: it.hold, wear: it.wear, style: it.style, tmode: it.tmode }));
  const issue = $('#d-issue');
  issue.hidden = kind !== 'workshop';
  if (kind === 'workshop') { issue.href = `https://github.com/${REPO}/issues/${it.issue}`; issue.textContent = `去 GitHub 点 👍（${it.likes || 0}）`; }
  const note = $('#d-note');
  note.replaceChildren();
  if (kind === 'workshop') note.append('想让它进下一版正式表情包？去 issue 里喊一声。');
  else {
    if (it.special) note.append('水龙卷用到了原版 Minecraft 材质，没放进工坊，只能本地用引擎出（见 README）。');
    note.append(it.special ? ' ' : '', '全部 300 张 + 水龙卷打包：', el('a', { href: RELEASE.url, text: `Release zip（${RELEASE.size}）` }));
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
