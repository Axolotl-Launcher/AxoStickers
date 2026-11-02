// 内置动作「往后一缩」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'recoil', type: 'motion', name: '往后一缩',
  move(a, t) {
    const k = this.ph(t), r = k < 0.12 ? 0 : k < 0.78 ? easeOutBack((k - 0.12) / 0.12, 2.5) : 1 - easeIO((k - 0.78) / 0.18);
    a.zoom = 1 - 0.2 * r; a.dy -= 30 * r; a.dx += 2.5 * r * this.ls(t, 30); addrot(a, 'head', 14 * r);
    if (k > 0.12 && k < 0.3) a.pose._face = { L: 'big', R: 'big', mouth: 'shout' };
  },
});
