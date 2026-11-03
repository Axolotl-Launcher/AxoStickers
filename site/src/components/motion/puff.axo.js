// 内置动作「鼓气」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'puff', type: 'motion', name: '鼓气',
  move(a, t) { const p = 0.5 + 0.5 * this.ls(t, 2); a.sx = 1 + 0.14 * p; a.sy = 1 + 0.1 * p; a.dy -= 8 * p; },
});
