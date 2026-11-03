// 内置文字动画「弹跳」。
component({
  id: 'bounce', type: 'textanim', name: '弹跳',
  xf(i, n, t) {
    const k = mod(this.ph(t, 2) - i * 0.1, 1);
    const hop = k < 0.28 ? -26 * bump(k / 0.28) : 0;
    const s = k >= 0.28 && k < 0.4 ? 1 + 0.06 * bump((k - 0.28) / 0.12) : 1;
    return [0, hop, s, 0, true];
  },
});
