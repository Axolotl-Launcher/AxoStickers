// 内置文字动画「耷拉」。
component({
  id: 'droop', type: 'textanim', name: '耷拉',
  xf(i, n, t) { return [0, 4 * i + 4 * this.ls(t, 2, -i * 0.6), 1, -4 - 3 * i + 2 * this.ls(t, 2, -i * 0.6), true]; },
});
