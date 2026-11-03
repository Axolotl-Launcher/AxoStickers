// 内置特效「挂着」：任选图标挂在头边上轻轻晃。
component({
  id: 'stay', type: 'fx', name: '挂着（任选图标）',
  params: {
    icon: { label: '图标', type: 'icon', default: 'clock' },
    k: { label: '大小', type: 'int', min: 2, max: 10, default: 6 },
    x: { label: '横向位置', type: 'number', min: -200, max: 200, default: 60 },
    y: { label: '纵向位置', type: 'number', min: -200, max: 100, default: -95 },
  },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt();
    put(ctx, icon(this.p.icon, this.p.k), hx + this.p.x, hy + this.p.y + 6 * this.ls(t, 4), 1 + 0.04 * this.ls(t, 8), 4 * this.ls(t, 2));
  },
});
