// 内置文字动画「轻晃，到点跳一下」：初代「发日志」的字（kit 工具包 anim_log.py）。一直在，轻轻波浪着晃；
// 到点（比如纸飞机飞出去那一下）从左到右挨个跳一下
component({
  id: 'hopat', type: 'textanim', name: '轻晃，到点跳一下',
  params: {
    at: { label: '在哪儿跳（一圈里的位置 0～1）', type: 'number', min: 0, max: 1, step: 0.01, default: 0.55 },
    hop: { label: '跳多高', type: 'number', min: 0, max: 60, default: 16 },
  },
  xf(i, n, t) {
    const w = this.ls(t, 4, -i * 0.9), hop = this.p.hop * bump((t - this.p.at * this.T - i * 0.07) / 0.3);
    return [0, 5 * w - hop, 1 + 0.03 * w, 2.5 * this.ls(t, 3, i), true];
  },
});
