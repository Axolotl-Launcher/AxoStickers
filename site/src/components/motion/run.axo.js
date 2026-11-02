// 内置动作「狂奔」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'run', type: 'motion', name: '狂奔',
  move(a, t) {
    for (const [l, s] of [['leg1', 1], ['leg2', -1], ['leg3', -1], ['leg4', 1]]) addrot(a, l, -20 * abs(this.ls(t, 16)), 40 * s * this.ls(t, 16));
    a.dx += 3 * this.ls(t, 16); addrot(a, 'head', -8, -14); addrot(a, 'tail', 0, 30 * this.ls(t, 16));
  },
});
