// 内置动作「跳舞」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'dance', type: 'motion', name: '跳舞',
  move(a, t) {
    a.roll = 9 * this.ls(t, 2); a.dx += 26 * this.ls(t, 2);
    addrot(a, 'head', 0, 22 * this.ls(t, 2, PI / 2), 6 * this.ls(t, 4));
    a.dy -= 14 * abs(this.ls(t, 4));
    for (const [l, s] of [['leg3', 1], ['leg4', -1]]) addrot(a, l, -50 * Math.max(0, s * this.ls(t, 4)));
    addrot(a, 'tail', 0, 25 * this.ls(t, 4));
  },
});
