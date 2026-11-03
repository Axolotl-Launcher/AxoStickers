// 内置动作「鞠躬」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'bow', type: 'motion', name: '鞠躬',
  params: {
    n: { label: '鞠几次', type: 'int', min: 1, max: 6, default: 2 },
  },
  move(a, t) {
    const k = this.ph(t, this.p.n), b = k < 0.7 ? easeIO(bump(k / 0.7)) : 0;
    addrot(a, 'head', -45 * b); addrot(a, 'root', -14 * b); a.dy += 18 * b;
  },
});
