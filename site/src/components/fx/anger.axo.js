// 内置特效「怒」。
component({
  id: 'anger', type: 'fx', name: '怒',
  params: { x: { label: '横向位置', type: 'number', min: -150, max: 150, default: -62 }, y: { label: '纵向位置', type: 'number', min: -150, max: 50, default: -62 } },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt(), u = mod(t / this.T * 4, 1);
    put(ctx, icon('anger', 6), hx + this.p.x, hy + this.p.y, 1 + 0.25 * exp(-u * 6), 0);
  },
});
