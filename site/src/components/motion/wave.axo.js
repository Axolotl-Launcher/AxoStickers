// 内置动作「挥手」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'wave', type: 'motion', name: '挥手',
  move(a, t) { legmix(a, 'leg3', 1, [10 * this.ls(t, 6), 0, 30 * this.ls(t, 6)]); addrot(a, 'head', 0, -8, -6); },
});
