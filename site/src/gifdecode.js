// 小型 GIF 解码器：拆出每一帧（按处置方式合成好的整帧 RGBA）和每帧时长。给大图里的逐帧查看用，不依赖第三方库。

function lzw(minSize, data, npix) {
  const clear = 1 << minSize, eoi = clear + 1;
  const prefix = new Uint16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097);
  for (let i = 0; i < clear; i++) suffix[i] = i;
  const out = new Uint8Array(npix);
  let size = minSize + 1, mask = (1 << size) - 1, next = eoi + 1, old = -1, first = 0;
  let bits = 0, acc = 0, op = 0;
  for (let p = 0; p < data.length && op < npix;) {
    while (bits < size && p < data.length) { acc |= data[p++] << bits; bits += 8; }
    if (bits < size) break;
    let code = acc & mask; acc >>>= size; bits -= size;
    if (code === clear) { size = minSize + 1; mask = (1 << size) - 1; next = eoi + 1; old = -1; continue; }
    if (code === eoi) break;
    if (old === -1) { out[op++] = suffix[code]; old = first = code; continue; }
    const inCode = code;
    let sp = 0;
    if (code >= next) { stack[sp++] = first; code = old; }
    while (code >= clear) { stack[sp++] = suffix[code]; code = prefix[code]; }
    first = suffix[code];
    stack[sp++] = first;
    if (next < 4096) {
      prefix[next] = old; suffix[next] = first; next++;
      if ((next & mask) === 0 && next < 4096) { size++; mask = (1 << size) - 1; }
    }
    old = inCode;
    while (sp > 0 && op < npix) out[op++] = stack[--sp];
  }
  return out;
}

function deinterlace(px, w, h) {
  const out = new Uint8Array(px.length);
  let row = 0;
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
    for (let y = start; y < h; y += step) out.set(px.subarray(row * w, row * w + w), y * w), row++;
  }
  return out;
}

// 返回 { width, height, frames: [{ data: Uint8ClampedArray(RGBA 整帧), delay: ms }] }
// maxBytes：解出来的帧（每帧一整张 RGBA）总共最多占多少内存，超了就只留前面的帧（truncated = true）
export function decodeGif(buf, { maxBytes = 96 << 20 } = {}) {
  const b = new Uint8Array(buf);
  if (String.fromCharCode(...b.subarray(0, 3)) !== 'GIF') throw new Error('不是 GIF');
  let p = 6;
  const u16 = () => { const v = b[p] | (b[p + 1] << 8); p += 2; return v; };
  const width = u16(), height = u16(), packed = b[p++]; p += 2;
  if (!width || !height || width > 2048 || height > 2048) throw new Error('GIF 尺寸不对');
  const maxFrames = Math.max(1, Math.floor(maxBytes / (width * height * 4)));
  let truncated = false;
  const table = (n) => { const t = b.subarray(p, p + 3 * n); p += 3 * n; return t; };
  const gct = packed & 0x80 ? table(1 << ((packed & 7) + 1)) : null;
  const canvas = new Uint8ClampedArray(width * height * 4);
  const frames = [];
  let gce = { disposal: 0, delay: 0, transparent: -1 };
  let prev = null;                                   // 上一帧的处置信息
  const subBlocks = () => {
    const parts = []; let len = 0;
    for (let n = b[p++]; n; n = b[p++]) { parts.push(b.subarray(p, p + n)); len += n; p += n; }
    const out = new Uint8Array(len); let o = 0;
    for (const s of parts) { out.set(s, o); o += s.length; }
    return out;
  };
  while (p < b.length) {
    const block = b[p++];
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = b[p++];
      if (label === 0xf9) {
        p++; const f = b[p++]; const delay = u16(); const ti = b[p++]; p++;
        gce = { disposal: (f >> 2) & 7, delay: delay * 10, transparent: f & 1 ? ti : -1 };
      } else subBlocks();
      continue;
    }
    if (block !== 0x2c) break;
    const x = u16(), y = u16(), w = u16(), h = u16(), f = b[p++];
    const lct = f & 0x80 ? table(1 << ((f & 7) + 1)) : null;
    const pal = lct || gct;
    const minSize = b[p++];
    let px = lzw(minSize, subBlocks(), w * h);
    if (f & 0x40) px = deinterlace(px, w, h);
    if (prev) {                                       // 处理上一帧的处置方式
      if (prev.disposal === 2) {
        for (let yy = prev.y; yy < prev.y + prev.h && yy < height; yy++) canvas.fill(0, (yy * width + prev.x) * 4, (yy * width + Math.min(width, prev.x + prev.w)) * 4);
      } else if (prev.disposal === 3 && prev.saved) canvas.set(prev.saved);
    }
    const saved = gce.disposal === 3 ? canvas.slice() : null;
    for (let yy = 0; yy < h; yy++) {
      const cy = y + yy; if (cy >= height) break;
      for (let xx = 0; xx < w; xx++) {
        const cx = x + xx; if (cx >= width) break;
        const ci = px[yy * w + xx];
        if (ci === gce.transparent) continue;
        const o = (cy * width + cx) * 4;
        canvas[o] = pal[ci * 3]; canvas[o + 1] = pal[ci * 3 + 1]; canvas[o + 2] = pal[ci * 3 + 2]; canvas[o + 3] = 255;
      }
    }
    frames.push({ data: canvas.slice(), delay: gce.delay || 100 });
    if (frames.length >= maxFrames) { truncated = true; break; }
    prev = { disposal: gce.disposal, x, y, w, h, saved };
    gce = { disposal: 0, delay: 0, transparent: -1 };
  }
  return { width, height, frames, truncated };
}
