// 内置动作「撒泼」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'tantrum', type: 'motion', name: '撒泼',
  setup() { for (let i = 0; i < 4; i++) this.splash((i + 0.2) * this.T / 4, [-50, 40, -20, 60][i], 6, 0.5, 40); },
  move(a, t) {
    a.roll = 15 * this.ls(t, 8); a.dx += 7 * this.ls(t, 8, 1.3); a.dy -= 6 * abs(this.ls(t, 8));
    for (const [l, s] of [['leg1', 1], ['leg2', -1], ['leg3', -1], ['leg4', 1]]) addrot(a, l, 0, 45 * s * this.ls(t, 16), 25 * this.ls(t, 16, 1));
    addrot(a, 'tail', 0, 45 * this.ls(t, 12)); addrot(a, 'head', -8, 20 * this.ls(t, 8, PI));
  },
});
