// 内置动作「横跳」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'sidehop', type: 'motion', name: '横跳',
  setup() { [[0, 50], [1, -50]].forEach(([i, x]) => this.splash((0.42 + i * 0.5) * this.T, x, 9, 0.55, 40)); },
  move(a, t) {
    const k = this.ph(t, 2), side = this.ph(t) < 0.5 ? 1 : -1;
    if (k < 0.42) {
      const u = k / 0.42;
      a.dx += lerp(-side * 50, side * 50, easeIO(u)); a.dy -= 72 * sin(PI * u);
      a.yaw = YAW + side * 38 * bump(u / 0.9); addrot(a, 'root', 12 * cos(PI * u));
    } else {
      const u = (k - 0.42) / 0.58, b = u < 0.3 ? bump(u / 0.3) : 0;
      a.dx += side * 50; a.sy = 1 - 0.08 * b; a.sx = 1 + 0.06 * b;
    }
  },
});
