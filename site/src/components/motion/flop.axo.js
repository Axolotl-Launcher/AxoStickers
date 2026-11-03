// 内置动作「瘫着」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'flop', type: 'motion', name: '瘫着',
  move(a, t) {
    a.pose.head.rot = [-2 + 2 * this.ls(t, 1), 0, 0];
    for (const [l, s] of [['leg1', 1], ['leg2', -1], ['leg3', 1], ['leg4', -1]]) addrot(a, l, 0, 0, s * 40);
    a.pose.tail.rot = [0, 6 * this.ls(t, 1), 0];
    a.sy = 0.9 + 0.025 * this.ls(t, 2); a.sx = 1.06; a.dy += 30;
    for (const [g, s] of GILLS) a.pose[g] = { rot: [-30, s * 20, 0] };
    a.pose.top_gills = { rot: [-30, 0, 0] };
  },
});
