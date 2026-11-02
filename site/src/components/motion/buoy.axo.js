// 内置动作「浮浮沉沉」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'buoy', type: 'motion', name: '浮浮沉沉',
  move(a, t) { a.dy += 20 * this.ls(t, 1); a.roll = 7 * this.ls(t, 1, PI / 2); addrot(a, 'root', 6 * this.ls(t, 1, PI / 2)); },
});
