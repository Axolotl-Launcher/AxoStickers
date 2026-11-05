// 内置动作「摇头，把道具扔掉」：初代「请截图」里不要拍屏、把相机扔进水里那一段（kit 工具包 anim_screenshot.py）。
// 抱着道具（「道具」图层里的那个，没有就是相机）→ 摇头 → 往后一收、甩出去 → 道具转着圈落到水里溅起水花。配「禁止标志」特效更像
component({
  id: 'toss', type: 'motion', name: '摇头，把道具扔掉', holdsItself: true,
  params: {
    at: { label: '扔出去（一圈里的位置 0～1）', type: 'number', min: 0.1, max: 0.95, step: 0.01, default: 0.28 },
    shake: { label: '摇头幅度（度）', type: 'number', min: 0, max: 40, default: 15 },
    x: { label: '落水的横向位置', type: 'number', min: 0, max: 512, default: 58 },
    s: { label: '道具大小', type: 'number', min: 0.3, max: 2, default: 1 },
  },
  setup() { this.splash(this.p.at * this.T + 0.55, this.p.x - W / 2, 12, 0.75, 22); },
  kind() { return this.spec.hold || 'camera'; },
  grip(t) {                                                    // 举在头侧，扔之前往后蓄一下力
    const w = clamp((t - this.p.at * this.T + 0.18) / 0.18) ** 2;
    return { x: 4.6 - 1.2 * w, y: 7.6 + 2.2 * w, z: -14.2, rz: -12 + 30 * w, s: this.p.s };
  },
  move(a, t) {
    const ta = this.p.at * this.T, k = clamp((t - ta + 0.4) / 0.25);
    addrot(a, 'head', 0, this.p.shake * sin(k * 2 * PI * 2.5) * sin(k * PI) - 20 * bump((t - ta + 0.1) / 0.4));
    const hold = 1 - easeIO((t - ta) / 0.3);                    // 前腿抱着 → 松开
    if (t < ta) this.hold(a, this.kind(), { ...this.grip(t), legs: hold });
    else for (const leg of ['leg3', 'leg4']) { const r = a.pose[leg].rot || [0, 0, 0]; a.pose[leg].rot = [r[0] - 35 * hold, r[1] * (1 - hold), r[2]]; }
    const tl = t - ta - 0.55;                                   // 落水的小涟漪
    if (tl > 0 && tl < 0.9) { const r = 12 + tl * 70; this.stage.rings.push([this.p.x, this.stage.waterLevel + 6, r, r * 0.2, 230 * (1 - tl / 0.9) / 255]); }
  },
  // 飞出去的道具：画在美西螈后面，落进水里被水面挡住
  drawBack(ctx, t) {
    const ta = this.p.at * this.T, k = (t - ta) / 0.55;
    if (k < 0 || k >= 1.15) return;
    if (!this.from) {                                           // 出手的位置：扔出去前一刻道具在画面上的哪儿
      const a = this.stage.poseAt(ta - 1e-3), it = (a.pose._items || []).find((x) => x.kind === this.kind() && !x.gear);
      this.from = it ? this.stage.itemAt(it, [0, 0.35, -0.9], a) : [W / 2 + 60, 330];
    }
    const kk = min(k, 1), sc = 1 - 0.3 * kk;
    const x = lerp(this.from[0], this.p.x, kk), y = lerp(this.from[1], this.stage.waterLevel + 18, kk) - 600 * kk * (1 - kk) + max(0, k - 1) * 200;
    const im = this.flying ||= this.itemImage([{ kind: this.kind(), rz: 18, s: this.p.s }], { yaw: 160, pitch: 28 });
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.translate(x, y); ctx.rotate(-kk * 600 * PI / 180); ctx.scale(sc, sc);
    ctx.drawImage(im, -im.width / 2, -im.height / 2);
    ctx.restore();
  },
});
