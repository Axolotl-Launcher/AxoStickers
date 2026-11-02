// 内置特效「冒金星」：小星星绕着头顶转。
component({
  id: 'stars', type: 'fx', name: '冒金星',
  params: { icon: { label: '图标', type: 'icon', default: 'star' }, n: { label: '数量', type: 'int', min: 1, max: 8, default: 3 } },
  draw(ctx, t, layer) {
    if ((layer !== 'back' && layer !== 'top') || !this.LAST) return;
    const [hx, hy] = this.headPt([0, 10, -7.5]);
    for (let i = 0; i < this.p.n; i++) {
      const a = 2 * PI * (t / this.T * 2 + i / this.p.n);
      if ((layer === 'top') !== (sin(a) > 0)) continue;
      put(ctx, icon(this.p.icon, 4), hx + 70 * cos(a), hy - 18 + 16 * sin(a), 0.8 + 0.25 * sin(a), 0);
    }
  },
});
