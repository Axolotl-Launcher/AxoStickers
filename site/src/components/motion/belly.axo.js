// 内置动作「翻肚皮」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'belly', type: 'motion', name: '翻肚皮',
  move(a, t) {
    a.pose.root = { rot: [0, 10 * this.ls(t, 1), 180], move: [0, 15, 0] };
    a.pose.head.rot = [0, 0, 0];
    for (const l of LEGS) addrot(a, l, 8 * this.ls(t, 2, l === 'leg1' ? 1 : 0));
    a.dy += 22 + 3 * this.ls(t, 2); a.dx += 10 * this.ls(t, 1);
  },
});
