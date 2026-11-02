// 内置文字动画「打字机」。
component({
  id: 'type', type: 'textanim', name: '打字机', entrance: true,
  cover(n) { return Math.min(this.T - 0.6, 0.15 + (n - 1) * 0.22 + 0.4); },
  xf(i, n, t) {
    const tt = t - (0.15 + i * 0.22);
    if (tt <= 0) return [0, 0, 0, 0, false];
    const te = (t - (this.T - 0.45) - (n - 1 - i) * 0.04) / 0.25;
    if (te >= 1) return [0, 0, 0, 0, false];
    let sc = easeOutBack(tt / 0.2, 3);
    if (te > 0) sc *= 1 + 0.25 * sin(te * PI) - te ** 2;
    return [0, 0, Math.max(0.01, sc), 0, true];
  },
});
