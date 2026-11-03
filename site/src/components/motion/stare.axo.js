// 内置动作「盯」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'stare', type: 'motion', name: '盯',
  move(a) { a.zoom = 1.18; a.dy -= 26; a.pose.head.rot = [14, 0, 0]; },
});
