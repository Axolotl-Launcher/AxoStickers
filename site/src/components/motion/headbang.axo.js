// 内置动作「甩头」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'headbang', type: 'motion', name: '甩头',
  move(a, t) { addrot(a, 'head', -30 * (0.5 + 0.5 * this.ls(t, 8))); a.dy += 4 * this.ls(t, 8); },
});
