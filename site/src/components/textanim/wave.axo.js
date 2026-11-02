// 内置文字动画「波浪」。
component({
  id: 'wave', type: 'textanim', name: '波浪',
  xf(i, n, t) { return [0, 10 * this.ls(t, 2, -i * 1.1), 1, 6 * this.ls(t, 2, -i * 1.1 + 1.5), true]; },
});
