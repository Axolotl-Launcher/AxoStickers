// 内置文字动画「抖动」。
component({
  id: 'shake', type: 'textanim', name: '抖动',
  xf(i, n, t) { return [3.5 * this.ls(t, 24, i * 2.1), 3 * this.ls(t, 18, i * 1.3), 1, 2 * this.ls(t, 12, i), true]; },
});
