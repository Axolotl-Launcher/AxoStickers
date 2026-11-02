// 内置特效「速度线」。
component({
  id: 'speed', type: 'fx', name: '速度线',
  params: { dir: { label: '方向', type: 'select', options: [[1, '往左'], [-1, '往右']], default: 1 } },
  setup() { const r = rng(4); this.L = Array.from({ length: 7 }, () => [r.uniform(220, 400), r.random(), r.uniform(60, 140)]); },
  draw(ctx, t, layer) {
    if (layer !== 'back') return;
    const d = this.p.dir;
    for (const [y, ph, ln] of this.L) {
      const u = mod(t / this.T * 4 + ph, 1), x = d > 0 ? W + 40 - u * (W + 200) : -40 + u * (W + 200);
      line(ctx, [[x, y], [x + ln * d, y]], [190, 200, 215], 5);
    }
  },
});
