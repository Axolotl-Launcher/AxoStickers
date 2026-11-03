// 设备分档：网页和沙盒都用，决定预览画质、缓存多少帧、首页要不要实时渲染。
//   high：有显卡加速的电脑；mid：有显卡加速的手机 / 平板、核少的电脑；low：没有显卡加速（软件渲染）/ 内存小 / 省流量模式。
// 「显卡加速」用 failIfMajorPerformanceCaveat 判断：浏览器关了硬件加速、或者只有 SwiftShader / llvmpipe 这类软件渲染时拿不到上下文。
let cached = null;

function probeGpu() {
  let renderer = '', hw = false, any = false;
  try {
    const mk = () => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas'));
    const strict = mk().getContext('webgl', { failIfMajorPerformanceCaveat: true });
    const gl = strict || mk().getContext('webgl');
    if (gl) {
      any = true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
      hw = !!strict && !/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(renderer);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { /* 没有 WebGL */ }
  return { gpu: hw ? 'hw' : any ? 'sw' : 'none', renderer };
}

export function detectPerf() {
  if (cached) return cached;
  const mm = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  const nav = navigator, coarse = mm('(pointer: coarse)');
  const short = Math.min(screen.width || 9999, screen.height || 9999);
  const device = coarse ? (short >= 600 ? 'tablet' : 'phone') : 'desktop';
  const { gpu, renderer } = probeGpu();
  const cores = nav.hardwareConcurrency || 4, mem = nav.deviceMemory || 4;
  const save = !!nav.connection?.saveData, reduced = mm('(prefers-reduced-motion: reduce)');
  let tier = gpu === 'hw' ? (device === 'desktop' && cores >= 4 && mem >= 4 ? 'high' : 'mid') : 'low';
  if (save || mem <= 2) tier = 'low';
  cached = { tier, gpu, device, cores, mem, save, reduced, renderer };
  return cached;
}

// 按档位（或用户在舞台上选的画质）给出具体参数
//   ss：三维部分的超采样（1 = 和画布一样大，2 = 两倍再缩下来，边缘更顺）
//   cacheMB：预览缓存的帧最多占多少显存 / 内存
//   thumb：素材库小图的边长
export function quality(choice = 'auto', perf = detectPerf()) {
  const tier = choice === 'sharp' ? 'high' : choice === 'smooth' ? 'low' : perf.tier;
  return {
    high: { tier, ss: 2, cacheMB: 128, thumb: 96, power: 'high-performance' },
    mid: { tier, ss: 2, cacheMB: 48, thumb: 96, power: 'default' },
    low: { tier, ss: 1, cacheMB: 24, thumb: 72, power: 'low-power' },
  }[tier];
}
