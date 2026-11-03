// 内置动作「欢呼」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'cheer', type: 'motion', name: '欢呼',
  move(a, t) {
    const u = this.ls(t, 4);
    legmix(a, 'leg3', Math.max(0, u) * 1.1); legmix(a, 'leg4', Math.max(0, -u) * 1.1);
    a.dy -= 14 * abs(u); addrot(a, 'head', 10);
  },
});
