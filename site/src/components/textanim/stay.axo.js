// 内置文字动画「轻轻晃」。xf(i, n, t) 返回第 i 个字的 [dx, dy, 缩放, 旋转角度, 是否显示]。
component({
  id: 'stay', type: 'textanim', name: '轻轻晃',
  xf(i, n, t) { return [0, 5 * this.ls(t, 4, -i * 0.9), 1 + 0.03 * this.ls(t, 4, -i * 0.9), 2.5 * this.ls(t, 3, i), true]; },
});
