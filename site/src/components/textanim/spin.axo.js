// 内置文字动画「翻转」。
component({
  id: 'spin', type: 'textanim', name: '翻转',
  xf(i, n, t) {
    const k = mod(this.ph(t, 1) - i * 0.08, 1);
    return [0, k < 0.35 ? -10 * bump(k / 0.35) : 0, 1, k < 0.35 ? -360 * easeIO(k / 0.35) : 0, true];
  },
});
