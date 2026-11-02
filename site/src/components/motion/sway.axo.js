// 内置动作「摇摆」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'sway', type: 'motion', name: '摇摆',
  move(a, t) { a.roll = 9 * this.ls(t, 1); a.dx += 12 * this.ls(t, 1); addrot(a, 'head', 0, 10 * this.ls(t, 1, PI / 2), -7 * this.ls(t, 1)); },
});
