// 内置特效「闪电」。
component({
  id: 'bolt', type: 'fx', name: '闪电',
  draw(ctx, t, layer) {
    if (layer !== 'top') return;
    const u = mod(t / this.T * 4, 1);
    if (u < 0.5) for (const [x, y, r] of [[90, 250, -10], [420, 240, 12]]) put(ctx, icon('bolt', 7), x, y, 1, r, u > 0.3 ? 1 - u * 1.5 : 1);
  },
});
