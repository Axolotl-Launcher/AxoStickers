// 内置动作「抬头」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'lookup', type: 'motion', name: '抬头',
  move(a, t) { addrot(a, 'head', 24 + 6 * this.ls(t, 1), 10 * this.ls(t, 1, 1)); addrot(a, 'root', 8); a.dy -= 6; },
});
