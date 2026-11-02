// 内置动作「蹦跶」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'hop', type: 'motion', name: '蹦跶',
  params: {
    n: { label: '蹦几下', type: 'int', min: 1, max: 6, default: 2 },
  },
  setup() { const n = this.p.n; for (let i = 0; i < n; i++) this.splash((0.45 + i) * this.T / n, 0, 8, 0.55, 60); },
  move(a, t) {
    const k = this.ph(t, this.p.n);
    if (k < 0.45) {
      const u = k / 0.45;
      a.dy -= 80 * sin(PI * u); a.sy = 1 + 0.07 * sin(PI * u); a.sx = 1 / a.sy ** 0.5;
      addrot(a, 'root', 12 * cos(PI * u));
      for (const l of LEGS) addrot(a, l, -20 * sin(PI * u));
    } else {
      const u = (k - 0.45) / 0.55, b = u < 0.3 ? bump(u / 0.3) : 0;
      a.sy = 1 - 0.09 * b; a.sx = 1 + 0.07 * b; a.dy += 6 * b;
    }
  },
});
