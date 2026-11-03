// 内置动作「缩小」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'shrink', type: 'motion', name: '缩小',
  move(a, t) { a.zoom = 0.6; a.dx += 1.5 * this.ls(t, 30); a.dy += 30 + 4 * this.ls(t, 2); },
});
