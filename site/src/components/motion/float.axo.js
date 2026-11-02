// 内置动作「仰泳」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'float', type: 'motion', name: '仰泳',
  move(a, t) {
    a.pose.root = { rot: [0, 20 * this.ls(t, 1), 180], move: [0, 15, 0] };
    a.pose.head.rot = [0, 0, 0];
    for (const [l, s] of [['leg1', 1], ['leg2', -1], ['leg3', 1], ['leg4', -1]]) addrot(a, l, 0, 0, s * 30);
    a.dy += 24 + 3 * this.ls(t, 2);
  },
});
