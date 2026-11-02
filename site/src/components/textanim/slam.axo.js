// 内置文字动画「砸下来」。
component({
  id: 'slam', type: 'textanim', name: '砸下来', entrance: true,
  cover(n) { return Math.min(this.T - 0.5, 0.1 + (n - 1) * 0.12 + 0.5); },
  xf(i, n, t) {
    const tt = t - (0.1 + i * 0.12);
    if (tt <= 0) return [0, 0, 0, 0, false];
    const te = (t - (this.T - 0.35)) / 0.25;
    if (te >= 1) return [0, 0, 0, 0, false];
    const dy = tt < 0.18 ? -(1 - easeIn(tt / 0.18)) * 220 : 0;
    let sc = tt >= 0.18 ? 1 + 0.18 * bump((tt - 0.18) / 0.15) : 1;
    if (te > 0) sc *= 1 - easeIn(te);
    return [0, dy, Math.max(0.01, sc), 0, true];
  },
});
