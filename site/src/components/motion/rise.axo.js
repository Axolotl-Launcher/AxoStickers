// 内置动作「登场」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'rise', type: 'motion', name: '登场',
  coverK: 0.42,
  move(a, t) {
    const k = this.ph(t), r = k < 0.75 ? easeOutBack(k / 0.28, 1.6) : 1 - easeIO((k - 0.75) / 0.25);
    a.dy -= 48 * r; addrot(a, 'head', 16 * r); addrot(a, 'root', 8 * r); a.sy = 1 + 0.04 * r;
  },
});
