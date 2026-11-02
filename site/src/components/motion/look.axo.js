// 内置动作「张望」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'look', type: 'motion', name: '张望',
  move(a, t) { addrot(a, 'head', -5, 38 * clamp(1.7 * this.ls(t, 1))); },
});
