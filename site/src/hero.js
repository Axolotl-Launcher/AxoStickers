// 首页头图：标题用表情同款立体字画（同一个 charSprite），右边是网页引擎实时渲染的随机一张。
import { toRecipe, recipeToSpec } from './util.js';

const TITLE = '美西螈表情包';
const T = 3.2;

export async function initHero(items, isActive) {
  const ENG = await import('./engine/index.js');
  await ENG.loadFont(TITLE);
  const tc = document.getElementById('hero-title'), tg = tc.getContext('2d');
  const ch = 168, sprites = [...TITLE].map((c) => ENG.charSprite(c, ch, 'pink'));
  const adv = ch + 14, x0 = sprites[0].width / 2 - 40;            // 左对齐（字图四周有留白）

  const live = document.getElementById('hero-live'), lc = live.querySelector('canvas'), lg = lc.getContext('2d');
  const cap = live.querySelector('figcaption');
  const pool = items.filter((it) => !it.special);
  let stk = null, born = 0, onScreen = true;
  async function next(now) {
    const it = pool[Math.floor(Math.random() * pool.length)];
    await ENG.loadFont(it.text);
    stk = ENG.makeSticker(recipeToSpec(toRecipe(it)), ENG.renderer());
    born = now; cap.textContent = `实时渲染 · #${it.key} ${it.text}`;
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(tc);

  let pending = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!isActive() || !onScreen || document.hidden) return;
    const t = now / 1000;
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
    if (live.offsetParent === null) return;           // 手机上不显示，就不画
    if ((!stk || now - born > T * 2000) && !pending) { pending = true; next(now).finally(() => { pending = false; }); }
    if (stk) stk.frame(lg, ((now - born) / 1000) % stk.T);
  }
  requestAnimationFrame(frame);
}
