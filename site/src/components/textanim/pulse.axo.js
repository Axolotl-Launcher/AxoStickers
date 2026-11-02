// 内置文字动画「心跳」。
component({
  id: 'pulse', type: 'textanim', name: '心跳',
  xf(i, n, t) { return [0, 0, 1 + 0.10 * exp(-this.ph(t, 4) * 7), 0, true]; },
});
