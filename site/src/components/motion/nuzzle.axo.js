// 内置动作「蹭蹭」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'nuzzle', type: 'motion', name: '蹭蹭',
  move(a, t) {
    a.roll = 7 * this.ls(t, 4); addrot(a, 'head', 0, 12 * this.ls(t, 4), 10 * this.ls(t, 4, PI));
    a.dx += 6 * this.ls(t, 4); a.dy -= 4 * abs(this.ls(t, 4));
  },
});
