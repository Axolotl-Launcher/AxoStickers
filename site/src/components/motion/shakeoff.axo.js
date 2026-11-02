// 内置动作「甩水」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'shakeoff', type: 'motion', name: '甩水',
  move(a, t) {
    const s = win(this.ph(t), 0.15, 0.6, 0.06); this._s = s;
    a.roll = 20 * s * this.ls(t, 22); addrot(a, 'head', 0, 25 * s * this.ls(t, 22, 1)); a.dy -= 10 * s;
    if (s > 0.5) a.pose._face = { L: 'squeeze', R: 'squeeze', mouth: 'w' };
  },
  drawFront(ctx, t) {
    if (!(this._s >= 0.2) || !this.LAST) return;
    const [hx, hy] = this.headPt([0, 6, 0]);
    for (let j = 0; j < 10; j++) {
      const u = mod(t / this.T * 6 + j / 10, 1), ang = 2 * PI * j / 10 + 0.4;
      sq(ctx, hx + cos(ang) * (40 + 120 * u), hy + sin(ang) * (30 + 70 * u) + 60 * u * u, 10 * (1 - u) + 3, [150, 215, 255], [90, 170, 235]);
    }
  },
});
