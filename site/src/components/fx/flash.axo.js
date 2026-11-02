// 内置特效「闪光灯」。
component({
  id: 'flash', type: 'fx', name: '闪光灯',
  draw(ctx, t, layer) {
    if (layer !== 'top') return;
    const u = mod(t / this.T, 1) - 0.55;
    if (u >= 0 && u < 0.1) { ctx.fillStyle = `rgba(255,255,255,${(160 * (1 - u / 0.1)) / 255})`; ctx.fillRect(0, 0, W, H); }
  },
});
