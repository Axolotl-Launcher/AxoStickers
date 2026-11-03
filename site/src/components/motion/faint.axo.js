// 内置动作「晕倒」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'faint', type: 'motion', name: '晕倒',
  move(a, t) {
    const k = this.ph(t), f = k < 0.72 ? easeOutBack(k / 0.25, 1.1) : 1 - easeIO((k - 0.72) / 0.22);
    a.pose.root = { rot: [8 * (1 - f), 6 * this.ls(t, 1) * f, 180 * f], move: [0, 15 * f, 0] };
    a.dy += 22 * f; a.pose.head.rot = a.pose.head.rot.map((v) => v * (1 - f));
  },
});
