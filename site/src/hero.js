// 首页头图：标题用表情同款立体字画（同一个 charSprite），右边是网页引擎实时渲染的随机一张。
// 按设备档位来：没有显卡加速 / 省流量 / 想少看动画的，标题画一次、右边放一张静态封面，不跑三维；
// 其他的实时渲染也只在换帧的时候画（15 fps，和 GIF 一样），标题在弱一点的设备上 30 fps。
import { detectPerf } from './perf.js';

const TITLE = '美西螈表情包';
const T = 3.2;

export async function initHero(items, isActive) {
  const perf = detectPerf(), still = perf.tier === 'low' || perf.reduced || perf.save;
  const ENG = await import('./engine/index.js');
  await ENG.loadFont(TITLE);
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

  const live = document.getElementById('hero-live'), lc = live.querySelector('canvas'), lg = lc.getContext('2d');
  const cap = live.querySelector('figcaption');
  const pool = items.filter((it) => !it.special);
  const pick = () => pool[Math.floor(Math.random() * pool.length)];

  if (still) {                                       // 静态版：一张封面，不开三维渲染器
    drawTitle(0);
    const it = pick(), img = new Image();
    img.onload = () => { lg.clearRect(0, 0, lc.width, lc.height); lg.drawImage(img, 0, 0, lc.width, lc.height); };
    img.src = it.cover || it.still;
    cap.textContent = `#${it.key} ${it.text}`;
    return;
  }

  const reg = ENG.builtinRegistry();
  let stk = null, born = 0, onScreen = true, lastF = -1, lastTitle = 0;
  async function next(now) {
    const it = pick();
    await ENG.loadFont(it.text);
    stk = new ENG.Scene(ENG.fromRecipe(it), reg, ENG.renderer());
    born = now; lastF = -1; cap.textContent = `实时渲染 · #${it.key} ${it.text}`;
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
