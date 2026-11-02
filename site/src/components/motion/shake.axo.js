// 内置动作「摇头」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'shake', type: 'motion', name: '摇头',
  move(a, t) { addrot(a, 'head', 0, 30 * this.ls(t, 4), 4 * this.ls(t, 4)); addrot(a, 'root', 0, 5 * this.ls(t, 4, PI)); },
});
