// 内置文字动画「哆嗦」。
component({
  id: 'shiver', type: 'textanim', name: '哆嗦',
  xf(i, n, t) { return [2.5 * this.ls(t, 30, i * 1.7), 0, 1, 0, true]; },
});
