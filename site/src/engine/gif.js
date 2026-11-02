// 在浏览器里导出 GIF：48 帧 400×400、15 fps、第一帧就是封面；像引擎一样 64 → 24 色往下试，尽量 ≤ 1 MB。
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { W, FPS } from './core.js';
import { makeSticker } from './motions.js';

const SIZE = 400, MAX_KB = 1000;
const tick = () => new Promise((r) => setTimeout(r));

export async function renderFrames(spec, renderer, onProgress) {
  const s = makeSticker(spec, renderer);
  const big = document.createElement('canvas'); big.width = big.height = W;
  const small = document.createElement('canvas'); small.width = small.height = SIZE;
  const bctx = big.getContext('2d'), sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
  const frames = [];
  for (let i = 0; i < s.N; i++) {
    s.frame(bctx, i / FPS);
    sctx.drawImage(big, 0, 0, SIZE, SIZE);
    frames.push(sctx.getImageData(0, 0, SIZE, SIZE).data);
    onProgress?.(0.6 * (i + 1) / s.N);
    if (i % 4 === 3) await tick();
  }
  const c = Math.round(s.coverTime() * FPS) % s.N;          // 转一下，让封面当第一帧
  return frames.slice(c).concat(frames.slice(0, c));
}

function encode(frames, colors) {
  const step = Math.max(1, Math.floor(frames.length / 12)), picks = frames.filter((_, i) => i % step === 0);
  const sample = new Uint8ClampedArray(picks.length * SIZE * SIZE * 4);
  picks.forEach((f, i) => sample.set(f, i * f.length));
  const pal = quantize(sample, colors - 1);
  let wi = 0, wd = Infinity;                                  // 背景必须是纯白
  pal.forEach((c, i) => { const d = (255 - c[0]) + (255 - c[1]) + (255 - c[2]); if (d < wd) { wd = d; wi = i; } });
  pal[wi] = [255, 255, 255];
  const T = pal.length, full = [...pal, [0, 0, 0]];          // 最后一格当透明：和上一帧一样的像素不重画
  const enc = GIFEncoder();
  let prev = null;
  frames.forEach((f, k) => {
    const idx = applyPalette(f, pal);
    const delay = k % 3 === 2 ? 60 : 70;                      // 7,7,6 厘秒 ≈ 15 fps
    if (!prev) { prev = idx.slice(); enc.writeFrame(idx, SIZE, SIZE, { palette: full, delay, repeat: 0 }); return; }
    const out = idx.slice();
    for (let i = 0; i < out.length; i++) if (idx[i] === prev[i]) out[i] = T;
    prev = idx;
    enc.writeFrame(out, SIZE, SIZE, { delay, transparent: true, transparentIndex: T, dispose: 1 });
  });
  enc.finish();
  return enc.bytes();
}

export async function exportGif(spec, renderer, onProgress) {
  const frames = await renderFrames(spec, renderer, onProgress);
  let bytes = null;
  const steps = [64, 48, 40, 32, 24];
  for (let i = 0; i < steps.length; i++) {
    await tick();
    bytes = encode(frames, steps[i]);
    onProgress?.(0.6 + 0.4 * (i + 1) / steps.length);
    if (bytes.length / 1024 <= MAX_KB) break;
  }
  onProgress?.(1);
  return new Blob([bytes], { type: 'image/gif' });
}
