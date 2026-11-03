// 内置动作「晃脑袋」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'headbob', type: 'motion', name: '晃脑袋',
  move(a, t) { addrot(a, 'head', 4 * abs(this.ls(t, 8)), 0, 15 * this.ls(t, 4)); a.roll = 4 * this.ls(t, 4); a.dy -= 5 * abs(this.ls(t, 8)); },
});
