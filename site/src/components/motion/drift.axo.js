// 内置动作「漂着」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'drift', type: 'motion', name: '漂着',
  move(a, t) { a.dx += 80 * this.ls(t, 1); a.roll = -7 * this.lc(t, 1); addrot(a, 'head', 0, -15 * this.lc(t, 1)); this.stage.rippleDx = a.dx; },
});
