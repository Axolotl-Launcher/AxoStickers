// 内置文字动画「蹦出来」：一个一个弹出来，最后一起收掉。entrance: true 表示开头字是空的，封面要往后取。
component({
  id: 'pop', type: 'textanim', name: '蹦出来', entrance: true,
  cover(n) { return Math.min(this.T - 0.6, 0.15 + (n - 1) * 0.14 + 0.7); },
  xf(i, n, t) {
    const tt = t - (0.15 + i * 0.14);
    if (tt <= 0) return [0, 0, 0, 0, false];
    const te = (t - (this.T - 0.45) - (n - 1 - i) * 0.04) / 0.25;
    if (te >= 1) return [0, 0, 0, 0, false];
    let sc = tt < 0.55 ? elastic(tt / 0.55) : 1 + 0.04 * sin(tt * 7);
    const rot = (1 - easeOut(tt / 0.4)) * (i % 2 ? -28 : 28), dy = -(1 - easeOutBack(tt / 0.45)) * 100;
    if (te > 0) sc *= 1 + 0.25 * sin(te * PI) - te ** 2;
    return [0, dy, Math.max(0.01, sc), rot, true];
  },
});
