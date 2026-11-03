// 内置特效「掉落」：任选图标从上面掉下来。撒钱、下雪、落叶、彩纸都是它。
component({
  id: 'fall', type: 'fx', name: '掉落（任选图标）',
  params: {
    icon: { label: '图标', type: 'icon', default: 'flower' },
    n: { label: '数量', type: 'int', min: 1, max: 30, default: 10 },
    k: { label: '大小', type: 'int', min: 2, max: 9, default: 4 },
    spin: { label: '转着掉', type: 'bool', default: 1 },
  },
  setup() {
    const r = rng(strHash(this.p.icon) & 0xff);
    this.P = Array.from({ length: this.p.n }, () => ({ x: r.uniform(0, W), ph: r.random(), sp: r.uniform(0.8, 1.2), r: r.uniform(-1, 1), sc: r.uniform(0.7, 1.1) }));
  },
  draw(ctx, t, layer) {
    if (layer !== 'top') return;
    this.P.forEach((p, i) => {
      const u = mod(t / this.T * p.sp + p.ph, 1), y = -30 + u * (H + 60), x = p.x + 18 * sin(u * 8 + i);
      put(ctx, icon(this.p.icon, this.p.k), x, y, p.sc, this.p.spin ? p.r * 360 * u : 0);
    });
  },
});
