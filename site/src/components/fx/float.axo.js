// 内置特效「飘」：任选一个图标从头顶往上飘。爱心、小花、+1 都是它换了图标。
component({
  id: 'float', type: 'fx', name: '飘（任选图标）',
  params: {
    icon: { label: '图标', type: 'icon', default: 'heart' },
    n: { label: '数量', type: 'int', min: 1, max: 12, default: 4 },
    k: { label: '大小', type: 'int', min: 2, max: 9, default: 4 },
    rise: { label: '飘多高', type: 'number', min: 40, max: 300, default: 150 },
    spread: { label: '散开', type: 'number', min: 0, max: 200, default: 60 },
    dx: { label: '左右偏移', type: 'number', min: -150, max: 150, default: 0 },
  },
  setup() {
    const r = rng(strHash(this.p.icon) & 0xfff);
    this.off = Array.from({ length: this.p.n }, () => [r.uniform(-this.p.spread, this.p.spread), r.random(), r.uniform(0.75, 1.15)]);
  },
  draw(ctx, t, layer) {
    if (layer !== 'top' || !this.LAST) return;
    const [hx, hy] = this.headPt(), per = this.T / 2, life = 0.75, n = this.off.length;
    this.off.forEach(([ox, ph, sc], i) => {
      const k = mod(t / per + i / n, 1);
      if (k > life) return;
      const u = k / life;
      const x = hx + this.p.dx + ox * (0.4 + 0.6 * u) + 12 * sin(u * 6 + i), y = hy - 30 - this.p.rise * u;
      put(ctx, icon(this.p.icon, this.p.k), x, y, sc * (0.6 + 0.4 * easeOutBack(u / 0.3)), 0, clamp(u / 0.15) * clamp((1 - u) / 0.3));
    });
  },
});
