// 内置动作「点头」。改了马上能在预览里看到；想留着就「另存为组件」。
component({
  id: 'nod', type: 'motion', name: '点头',
  params: {
    n: { label: '点几下', type: 'int', min: 1, max: 8, default: 3 },
  },
  move(a, t) { const k = this.ph(t, this.p.n), n = k < 0.45 ? bump(k / 0.45) : 0; addrot(a, 'head', -24 * n); a.dy += 5 * n; },
});
