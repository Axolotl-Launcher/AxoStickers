// 内置特效「截图框」：初代「请截图」的截图界面（kit 工具包 anim_screenshot.py）。到点画面变暗 → 鼠标拖出选框（带尺寸标签和控制点）
// → 弹出工具栏 □ ○ ↗ ~ A ✕ ✓ → 点 ✓ → 选框变绿、闪白、「✓ 已截图」→ 界面淡出。整段 1.7 秒，开始的时刻和选框位置能调
const BLUE = [24, 144, 255], GREEN = [7, 193, 96], RED = [235, 45, 55], INK = [50, 50, 58], WHITE = [255, 255, 255];
const TB_W = 268, TB_H = 40;
component({
  id: 'snip', type: 'fx', name: '截图框', glyphs: '0123456789 ×A',
  params: {
    at: { label: '开始（一圈里的位置 0～1）', type: 'number', min: 0, max: 0.95, step: 0.01, default: 0.47 },
    x: { label: '选框左边', type: 'number', min: 0, max: 500, default: 106 },
    y: { label: '选框上边', type: 'number', min: 40, max: 500, default: 250 },
    w: { label: '选框宽', type: 'number', min: 60, max: 512, default: 320 },
    h: { label: '选框高', type: 'number', min: 40, max: 512, default: 202 },
    text: { label: '截好以后的提示', type: 'text', default: '已截图' },
    bar: { label: '工具栏', type: 'bool', default: true },
  },
  times() { const t0 = this.p.at * this.T; return [0, 0.15, 0.65, 0.7, 1.2, 1.25, 1.7].map((d) => t0 + d); },   // 变暗 开始拖 拖完 工具栏 点 ✓ 截好 淡出
  sel() { const { x, y, w, h } = this.p; return [x, y, min(W - 1, x + w), min(H - 1, y + h)]; },
  okPos() { const S = this.sel(); return [S[2] - 22, S[3] + 8 + TB_H / 2]; },
  rectAt(t) {
    const [, D0, D1] = this.times(), S = this.sel(), k = easeIO((t - D0) / (D1 - D0));
    return [S[0], S[1], Math.trunc(lerp(S[0] + 1, S[2], k)), Math.trunc(lerp(S[1] + 1, S[3], k))];
  },
  cursorAt(t) {
    const [T0, D0, D1, , CLICK] = this.times(), S = this.sel(), ok = this.okPos();
    if (t < D0) { const k = easeOut((t - T0) / (D0 - T0)); return [lerp(S[0] - 70, S[0], k), lerp(S[1] - 60, S[1], k)]; }
    if (t < D1) { const r = this.rectAt(t); return [r[2], r[3]]; }
    const k = easeIO((t - D1 - 0.08) / (CLICK - D1 - 0.12));
    return [lerp(S[2], ok[0] - 2, k), lerp(S[3], ok[1] - 4, k)];
  },
  toolbar(ctx, x0, y0) {
    ctx.save(); ctx.translate(x0, y0);
    roundRect(ctx, 0, 0, TB_W, TB_H, 8, WHITE, [205, 205, 212], 1);
    const cy = TB_H / 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = 22 + i * 32;
      if (i === 0) rect(ctx, x - 8, cy - 7, x + 8, cy + 7, null, INK, 2);
      if (i === 1) ellipse(ctx, x - 8, cy - 8, x + 8, cy + 8, null, INK, 2);
      if (i === 2) { line(ctx, [[x - 7, cy + 7], [x + 6, cy - 6]], INK, 2); polygon(ctx, [[x + 8, cy - 8], [x, cy - 7], [x + 7, cy]], INK); }
      if (i === 3) line(ctx, [[x - 8, cy + 4], [x - 3, cy - 3], [x + 2, cy + 3], [x + 8, cy - 5]], INK, 2);
      if (i === 4) label(ctx, 'A', x, cy + 1, 19, INK);
      if (i === 5) line(ctx, [[x - 4, cy - 10], [x - 4, cy + 10]], [215, 215, 220], 1);
    }
    let x = TB_W - 56;
    line(ctx, [[x - 7, cy - 7], [x + 7, cy + 7]], RED, 3); line(ctx, [[x - 7, cy + 7], [x + 7, cy - 7]], RED, 3);
    x = TB_W - 22;
    ctx.lineJoin = 'round'; line(ctx, [[x - 9, cy], [x - 3, cy + 6], [x + 9, cy - 7]], GREEN, 4);
    ctx.restore();
  },
  cursor(ctx, x, y, press) {
    const s = 1.5 * (press ? 0.85 : 1), pts = [[0, 0], [0, 17], [4.2, 13.2], [7.2, 20], [10, 18.8], [7.2, 12.3], [12.5, 12.3]];
    polygon(ctx, pts.map(([a, b]) => [x + a * s, y + b * s]), WHITE);
    ctx.strokeStyle = 'rgb(20,20,20)'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  },
  draw(ctx, t, layer) {
    if (layer !== 'front') return;
    const [T0, D0, D1, BAR, CLICK, DONE, OFF] = this.times(), S = this.sel(), ok = this.okPos();
    if (t < T0 || t >= OFF + 0.3) return;
    const fade = easeOut((t - T0) / 0.2) * (1 - easeIO((t - OFF) / 0.25)), done = t >= DONE;
    ctx.save();
    const A0 = ctx.globalAlpha;                                 // 图层自己的淡入淡出
    if (t >= D0) {
      const r = this.rectAt(t), col = done ? GREEN : BLUE;
      ctx.fillStyle = `rgba(18,18,28,${0.47 * fade})`;          // 选框外面压暗
      ctx.fillRect(0, 0, W, r[1]); ctx.fillRect(0, r[3] + 1, W, H - r[3] - 1); ctx.fillRect(0, r[1], r[0], r[3] - r[1] + 1); ctx.fillRect(r[2] + 1, r[1], W - r[2] - 1, r[3] - r[1] + 1);
      ctx.globalAlpha = A0 * fade;
      if (done) { const fl = 1 - easeOut((t - DONE) / 0.35); if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${0.86 * fl})`; ctx.fillRect(r[0], r[1], r[2] - r[0] + 1, r[3] - r[1] + 1); } }
      rect(ctx, r[0], r[1], r[2], r[3], null, col, 3);
      if (r[2] - r[0] > 20) {                                   // 控制点：拖的时候四个角，拖完八个
        const mx = Math.trunc((r[0] + r[2]) / 2), my = Math.trunc((r[1] + r[3]) / 2);
        const pts = [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]], ...(t >= D1 ? [[mx, r[1]], [mx, r[3]], [r[0], my], [r[2], my]] : [])];
        for (const [x, y] of pts) rect(ctx, x - 5, y - 5, x + 5, y + 5, WHITE, col, 2);
      }
      if (!done && r[2] - r[0] > 30) {                          // 尺寸标签（像高分屏那样 ×2）
        const lab = `${(r[2] - r[0]) * 2} × ${(r[3] - r[1]) * 2}`, tw = labelWidth(lab, 17);
        roundRect(ctx, r[0], r[1] - 32, r[0] + tw + 18, r[1] - 6, 6, [30, 30, 38], null, 1, 215 / 255);
        label(ctx, lab, r[0] + 9, r[1] - 18, 17, WHITE, 'left');
      }
    }
    ctx.globalAlpha = A0;
    if (this.p.bar && t >= BAR && t < DONE + 0.12) {
      const k = easeOut((t - BAR) / 0.2) * (1 - clamp((t - DONE) / 0.12));
      ctx.globalAlpha = A0 * k; this.toolbar(ctx, S[2] - TB_W, S[3] + 8 + 10 * (1 - k)); ctx.globalAlpha = A0;
    }
    const kc = (t - CLICK) / 0.35;                              // 点 ✓ 的水波
    if (this.p.bar && kc > 0 && kc < 1) { const rr = 8 + 26 * easeOut(kc); ellipse(ctx, ok[0] - rr, ok[1] - rr, ok[0] + rr, ok[1] + rr, null, GREEN, 3, 0, 360, 1 - kc); }
    const kd = t - DONE - 0.05;
    if (kd > 0) pill(ctx, (S[0] + S[2]) / 2, S[1] - 26, this.p.text, { h: 36, sc: elastic(kd / 0.45) * fade });
    if (t < DONE + 0.25) {
      const [cx, cy] = this.cursorAt(t), press = (t >= D0 && t < D1) || (t >= CLICK - 0.03 && t < CLICK + 0.1);
      ctx.globalAlpha = A0 * fade * (1 - clamp((t - DONE) / 0.25));
      if (ctx.globalAlpha > 0.01) this.cursor(ctx, cx, cy, press);
    }
    ctx.restore();
  },
});
