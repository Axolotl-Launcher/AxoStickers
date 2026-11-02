// 内置文字动画「摇摆」。
component({
  id: 'swing', type: 'textanim', name: '摇摆',
  xf(i, n, t) {
    const ang = 5 * this.ls(t, 2), x = this.lay[i][1];
    return [0, -(x - W / 2) * sin(ang * PI / 180), 1, ang, true];
  },
});
