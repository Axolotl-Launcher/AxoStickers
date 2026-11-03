/* @axo {"id":"jelly","type":"textanim","name":"果冻字","author":"Axolotl-Launcher","version":"1.0.0","description":"每个字像果冻一样一前一后地压扁、弹起，最后一起晃一下。文字动画的例子：下载后在「文字」里能找到。"} */
// 文字动画：xf(i, n, t) 返回第 i 个字（共 n 个）的 [dx, dy, 缩放, 角度, 是否显示]。
component({
  id: 'jelly', type: 'textanim', name: '果冻字',
  params: {
    amp: { label: '弹的幅度', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 },
    n: { label: '一圈弹几下', type: 'int', min: 1, max: 6, default: 2 },
  },
  xf(i, n, t) {
    const u = this.ph(t, this.p.n, -i * 0.12), k = this.p.amp;
    const squash = u < 0.25 ? Math.sin(u / 0.25 * PI) : 0;              // 先压扁
    const bounce = u >= 0.25 && u < 0.6 ? Math.sin((u - 0.25) / 0.35 * PI) : 0;   // 再弹起来
    const sc = 1 - 0.12 * k * squash + 0.06 * k * bounce;
    return [0, 10 * k * squash - 26 * k * bounce, sc, 4 * k * this.ls(t, this.p.n, i), true];
  },
});
