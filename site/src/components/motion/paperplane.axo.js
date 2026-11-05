// 内置动作「折纸飞机发出去」：初代「发日志」（kit 工具包 anim_log.py）。举着「道具」图层里的那张纸（没有就是日志纸），
// 一行行打字（道具有 shape 才会打，比如日志纸）→ 往后一收 → 「噗」地变成纸飞机，拖着虚线飞出画面 → 过一会儿新的一张弹回手上。
// 配「提示条」特效（✓ 已发送）、文字动画「轻晃，到点跳一下」就是初代那张
component({
  id: 'paperplane', type: 'motion', name: '折纸飞机发出去', holdsItself: true,
  params: {
    send: { label: '发出去（一圈里的位置 0～1）', type: 'number', min: 0.05, max: 0.9, step: 0.01, default: 0.45 },
    back: { label: '新的一张回到手上（0～1）', type: 'number', min: 0.1, max: 1, step: 0.01, default: 0.89 },
    typing: { label: '先一行行打字', type: 'bool', default: true },
    t0: { label: '开始打字（0～1）', type: 'number', min: 0, max: 1, step: 0.01, default: 0.04 },
    t1: { label: '打完（0～1）', type: 'number', min: 0, max: 1, step: 0.01, default: 0.36 },
    s: { label: '纸的大小', type: 'number', min: 0.3, max: 2, default: 1.15 },
  },
  kind() { return this.spec.hold || 'logpage'; },
  times() { const T = this.T, p = this.p; return { ts: p.send * T, tn: max(p.back, p.send + 0.2) * T, t0: p.t0 * T, t1: max(p.t1, p.t0 + 0.01) * T }; },
  page(t) {                                                    // 手里这张纸：位置、大小、打到哪儿
    const { ts, tn, t0, t1 } = this.times(), typing = this.p.typing && t > t0 && t < t1;
    const d = { x: 4.8, y: 7.4, z: -13, rz: -10, s: this.p.s }, def = this.propDef(this.kind());
    let k = 1;
    if (t >= tn) { d.s *= max(0.05, elastic((t - tn) / 0.4)); k = this.p.typing ? 0 : 1; }
    else {
      if (this.p.typing) k = t >= t0 ? clamp((t - t0) / (t1 - t0)) : 0;
      const w = clamp((t - ts + 0.25) / 0.25) ** 2;            // 扔之前往后蓄力
      d.x -= 1.4 * w; d.y += 2 * w; d.rz += 28 * w + (typing ? 2 * sin((t - t0) * 14) : 0);
    }
    if (def?.shape && k < 1) { k = round(k * 32) / 32; d.boxes = def.shape(k, typing); d.geo = `${k}|${typing}`; }
    return d;
  },
  move(a, t) {
    const { ts, tn, t0, t1 } = this.times(), typing = this.p.typing && t > t0 && t < t1;
    const hold = t < ts ? 1 : t < tn ? 1 - easeIO((t - ts) / 0.25) : easeIO((t - tn) / 0.3);
    addrot(a, 'head', typing ? -3.5 * abs(sin((t - t0) * 14)) : 0, -18 * bump((t - ts + 0.1) / 0.45));   // 打字时一点一点，扔的时候头一甩
    if (t < ts || t >= tn) this.hold(a, this.kind(), { ...this.page(t), legs: hold });
    else for (const leg of ['leg3', 'leg4']) { const r = a.pose[leg].rot || [0, 0, 0]; a.pose[leg].rot = [r[0] - 35 * hold, r[1] * (1 - hold), r[2]]; }
  },
  path(k) {                                                    // 纸飞机的路线：出手点 → 右边画面外，先往上拱一下
    const [x0, y0] = this.from, x1 = W + 80, y1 = 262;
    return [lerp(x0, x1, k), lerp(y0, y1, k) - 45 * sin(PI * k) + 18 * sin(2 * PI * k)];
  },
  plane(ctx, x, y, ang, sc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc); ctx.translate(-45, -30);
    ctx.lineJoin = 'round';
    for (const [pts, fill, edge] of [[[[4, 26], [86, 8], [30, 34]], [247, 248, 252], 1], [[[30, 34], [86, 8], [40, 52]], [214, 220, 232], 1], [[[30, 34], [86, 8], [34, 40]], [254, 62, 140], 0]]) {
      polygon(ctx, pts, fill);
      if (edge) { ctx.strokeStyle = 'rgb(150,160,180)'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.restore();
  },
  drawTop(ctx, t) {
    const { ts } = this.times(), k = (t - ts) / 0.65, kp = (t - ts) / 0.3;
    if (k < 0 || k >= 1.6) return;
    if (!this.from) {                                           // 出手的位置：变成纸飞机前一刻纸在画面上的哪儿
      const a = this.stage.poseAt(ts - 1e-3), it = (a.pose._items || []).find((x) => x.kind === this.kind() && !x.gear);
      this.from = it ? this.stage.itemAt(it, [0, 0, 0], a) : [W / 2 + 60, 320];
    }
    if (kp < 1) {                                               // 「噗」：一圈白色小方块
      for (let j = 0; j < 8; j++) { const an = j * PI / 4, r = 14 + 36 * easeOut(kp); sq(ctx, this.from[0] + cos(an) * r, this.from[1] + sin(an) * r, 12 * (1 - kp), [255, 255, 255], [190, 200, 215], 2); }
    }
    const ke = easeIO(min(k, 1)), tail = clamp((k - 0.25) / 1.0);
    for (let j = 0; j < 14; j += 2) {                           // 虚线轨迹
      const kk = lerp(tail, ke, j / 14);
      if (kk >= ke - 0.04) continue;
      const [x, y] = this.path(kk); sq(ctx, x, y, 6, [200, 208, 222]);
    }
    if (k < 1) {
      const [x, y] = this.path(ke), [x2, y2] = this.path(min(1, ke + 0.02));
      this.plane(ctx, x, y, atan2(y2 - y, x2 - x), 0.9 + 0.45 * easeOut(k / 0.2));
    }
  },
});
