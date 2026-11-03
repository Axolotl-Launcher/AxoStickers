// 内置文字动画「冲击」。
component({
  id: 'zoom', type: 'textanim', name: '冲击',
  xf(i, n, t) { const b = exp(-this.ph(t, 2) * 6); return [3 * this.ls(t, 20, i) * b, 0, 1 + 0.16 * b, 0, true]; },
});
