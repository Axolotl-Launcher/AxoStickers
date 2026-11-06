// 首页头图：标题用表情同款立体字画（同一个 charSprite），右边一摞贴纸：中间是网页引擎实时渲染的随机一张，后面两张静态缩略图。
// 按设备档位来：没有显卡加速 / 省流量 / 想少看动画的，标题画一次、右边放一张静态封面，不跑三维；
// 其他的实时渲染也只在换帧的时候画（15 fps，和 GIF 一样），标题在弱一点的设备上 30 fps。
import { detectPerf } from './perf.js';
import { fontsCss } from './util.js';

const TITLE = '美西螈表情包';
const T = 3.2;

export async function initHero(items, isActive) {
  const perf = detectPerf(), still = perf.tier === 'low' || perf.reduced || perf.save;
  const pool = items.filter((it) => !it.special);
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  for (const img of document.querySelectorAll('.hero-chip')) {    // 后面斜贴的两张：缩略图（手机上整摞不显示，图也不下）
    if (img.offsetParent === null) continue;
    const it = pick();
    img.addEventListener('load', () => img.classList.add('on'), { once: true });
    img.addEventListener('error', () => { if (img.src.includes('/thumbs/')) img.src = it.cover; }, { once: true });
    img.src = it.still;
  }
  // 引擎还没下完：先把第一张的缩略图画在气泡里，开始实时渲染时就从这张接着动
  const live = document.getElementById('hero-live'), lc = live.querySelector('canvas'), lg = lc.getContext('2d');
  const cap = live.querySelector('figcaption'), first = pick();
  let rendering = false;
  if (live.offsetParent !== null) {
    const img = new Image();
    img.onload = () => { if (!rendering) lg.drawImage(img, 0, 0, lc.width, lc.height); };
    img.onerror = () => { if (!img.src.endsWith('.gif')) img.src = first.cover; };
    img.src = first.still;
    cap.textContent = `#${first.key} ${first.text}`;
  }
  const [ENG] = await Promise.all([import('./engine/index.js'), fontsCss]);
  if (!await ENG.loadFont(TITLE)) return;                    // 标题的字体切片没下下来：不用系统字体画，页面上的文字标题留着
  const tc = document.getElementById('hero-title'), tg = tc.getContext('2d');
  const ch = 168, sprites = [...TITLE].map((c) => ENG.charSprite(c, ch, 'pink'));
  const adv = ch + 14, x0 = sprites[0].width / 2 - 40;            // 左对齐（字图四周有留白）
  const drawTitle = (t) => {
    tg.clearRect(0, 0, tc.width, tc.height);
    sprites.forEach((s, i) => {                      // 和 tmode='stay' 一样的轻晃
      const dy = 5 * Math.sin(2 * Math.PI * 4 * t / T - i * 0.9), sc = 1 + 0.03 * Math.sin(2 * Math.PI * 4 * t / T - i * 0.9);
      const rot = 2.5 * Math.sin(2 * Math.PI * 3 * t / T + i);
      tg.setTransform(sc, 0, 0, sc, x0 + i * adv, tc.height / 2 + dy + 8);
      tg.rotate(-rot * Math.PI / 180);
      tg.drawImage(s, -s.width / 2, -s.height / 2);
    });
    tg.setTransform(1, 0, 0, 1, 0, 0);
    if (!tc.dataset.ready) { tc.dataset.ready = '1'; tc.closest('.hero').classList.add('ready'); }
  };

  if (still) { drawTitle(0); return; }              // 静态版：气泡里就是上面那张缩略图，不开三维渲染器

  const reg = ENG.builtinRegistry();
  let stk = null, born = 0, onScreen = true, lastF = -1, lastTitle = 0;
  async function next(now) {
    let it = rendering ? pick() : first;
    for (let k = 0; k < 3 && !await ENG.loadFont(it.text); k++) it = pick();   // 这一张的字下不来：换一张（不用系统字体画）
    if (!await ENG.loadFont(it.text)) return;                 // 还是不行：接着放现在这张
    stk = new ENG.Scene(ENG.fromRecipe(it), reg, ENG.renderer());
    born = now; lastF = -1; rendering = true; cap.textContent = `#${it.key} ${it.text}`;
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(tc);

  const titleGap = perf.tier === 'high' ? 0 : 33;
  let pending = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!isActive() || !onScreen || document.hidden) return;
    if (now - lastTitle >= titleGap) { lastTitle = now; drawTitle(now / 1000); }
    if (live.offsetParent === null) return;           // 手机上不显示，就不画
    if ((!stk || now - born > T * 2000) && !pending) { pending = true; next(now).finally(() => { pending = false; }); }
    if (!stk) return;
    const f = Math.floor(((now - born) / 1000) * stk.FPS) % stk.N;
    if (f !== lastF) { lastF = f; stk.frame(lg, f / stk.FPS); }
  }
  requestAnimationFrame(frame);
}
