// 内置动作「摇尾巴」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'wag', type: 'motion', name: '摇尾巴',
  move(a, t) { addrot(a, 'tail', 0, 40 * this.ls(t, 8)); addrot(a, 'root', 0, 7 * this.ls(t, 8, PI)); a.dy -= 6 * abs(this.ls(t, 4)); },
});
