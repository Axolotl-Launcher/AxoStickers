// 在浏览器里导出 GIF：帧数 / 尺寸 / 帧率都跟着工程走，第一帧就是封面；像引擎一样 64 → 24 色往下试，尽量不超过上限。
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { W, makeCanvas } from './core.js';

const tick = () => new Promise((r) => setTimeout(r));

// GIF 编码要把所有帧留在内存里：帧数 × 边长² 有个上限（120 帧 800px 要 300 MB，手机上会把标签页撑崩）
export const EXPORT_BYTES = 160 << 20;
export function checkBudget(scene, size) {
  const need = scene.N * size * size * 4;
  if (need > EXPORT_BYTES) throw new Error(`一次导出的画面太多了（${scene.N} 帧 × ${size}px，约 ${Math.round(need / 1048576)} MB）：把边长或帧数调小一点`);
}

// 一帧一帧渲出来交给 each(像素, 第几帧)。fromCover：GIF 从封面（文字刚好出全）开始；逐帧 PNG 按时间顺序从头开始
export async function eachFrame(scene, size, each, { fromCover = true, onProgress } = {}) {
  const big = makeCanvas(W, W), small = makeCanvas(size, size);
  const bctx = big.getContext('2d'), sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
  const N = scene.N, c = fromCover ? Math.round(scene.coverTime() * scene.FPS) % N : 0;
  for (let k = 0; k < N; k++) {
    const i = (k + c) % N;
    scene.frame(bctx, i / scene.FPS);
    sctx.clearRect(0, 0, size, size);
    sctx.drawImage(big, 0, 0, size, size);
    await each(sctx.getImageData(0, 0, size, size).data, k, small);
    onProgress?.(0.6 * (k + 1) / N);
    if (k % 4 === 3) await tick();
  }
}

// 按顺序渲出每一帧（已经转好，第一帧 = 封面），返回 ImageData 数据数组
export async function renderFrames(scene, size, onProgress) {
  checkBudget(scene, size);
  const frames = [];
  await eachFrame(scene, size, (f) => { frames.push(f); }, { onProgress });
  return frames;
}

function encode(frames, size, fps, colors, transparent, white) {
  const step = Math.max(1, Math.floor(frames.length / 12)), picks = frames.filter((_, i) => i % step === 0);
  const sample = new Uint8ClampedArray(picks.length * size * size * 4);
  picks.forEach((f, i) => sample.set(f, i * f.length));
  const pal = quantize(sample, colors - (transparent ? 2 : 1), transparent ? { format: 'rgba4444', oneBitAlpha: true } : undefined);
  if (white) {                                               // 白底要是纯白（别的底色就用量化出来的颜色）
    let wi = 0, wd = Infinity;
    pal.forEach((c, i) => { const d = (255 - c[0]) + (255 - c[1]) + (255 - c[2]); if (d < wd) { wd = d; wi = i; } });
    pal[wi] = [255, 255, 255];
  }
  const T = pal.length, full = [...pal.map((c) => c.slice(0, 3)), [0, 0, 0]];   // 最后一格当透明
  const enc = GIFEncoder();
  // 每帧几厘秒：GIF 只能精确到 10 ms，按累计时间取整分摊，平均下来正好是工程的帧率（15 fps 和 Python 引擎一样用 7,7,6）
  const delayAt = (k) => (fps === 15 ? [70, 70, 60][k % 3] : (Math.round(100 * (k + 1) / fps) - Math.round(100 * k / fps)) * 10);
  let prev = null;
  frames.forEach((f, k) => {
    const idx = applyPalette(f, pal, transparent ? 'rgba4444' : 'rgb565');
    if (transparent) for (let i = 0; i < idx.length; i++) if (f[i * 4 + 3] < 128) idx[i] = T;
    const delay = delayAt(k);
    if (!prev || transparent) {                              // 透明背景每帧都整帧画（处置方式 2：先清空）
      enc.writeFrame(idx, size, size, { palette: k === 0 ? full : undefined, delay, repeat: 0, transparent: !!transparent, transparentIndex: T, dispose: transparent ? 2 : -1 });
      prev = idx; return;
    }
    const out = idx.slice();
    for (let i = 0; i < out.length; i++) if (idx[i] === prev[i]) out[i] = T;
    prev = idx;
    enc.writeFrame(out, size, size, { delay, transparent: true, transparentIndex: T, dispose: 1 });
  });
  enc.finish();
  return enc.bytes();
}

// opts: { size, colors, maxKb, transparent }
export async function exportGif(scene, opts = {}, onProgress) {
  const bg = scene.P.background, size = opts.size || scene.P.size, transparent = bg.mode === 'transparent';
  const white = !transparent && (bg.mode !== 'color' || /^#?(fff|ffffff)$/i.test(String(bg.color)));   // 和 Scene.background 一致：不是纯色就是白底
  const frames = await renderFrames(scene, size, onProgress);
  const steps = (opts.colors ? [opts.colors] : [64, 48, 40, 32, 24]);
  const maxKb = opts.maxKb ?? 1000;
  let bytes = null;
  for (let i = 0; i < steps.length; i++) {
    await tick();
    bytes = encode(frames, size, scene.FPS, steps[i], transparent, white);
    onProgress?.(0.6 + 0.4 * (i + 1) / steps.length);
    if (bytes.length / 1024 <= maxKb) break;
  }
  onProgress?.(1);
  return bytes;
}
