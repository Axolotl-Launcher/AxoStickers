// 内置动作「歪头」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'tilt', type: 'motion', name: '歪头',
  move(a, t) { addrot(a, 'head', 6, 0, 20 * clamp(1.6 * this.ls(t, 1))); },
});
