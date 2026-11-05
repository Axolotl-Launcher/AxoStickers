// 内置特效「提示条」：初代「发日志」里弹出来的绿色「✓ 已发送」（kit 工具包 anim_log.py）。到点弹出来，旁边闪小星星，再缩回去
component({
  id: 'toast', type: 'fx', name: '提示条（✓ 已发送）', glyphs: '',
  params: {
    text: { label: '字', type: 'text', default: '已发送' },
    color: { label: '颜色', type: 'color', default: '#07c160' },
    check: { label: '前面打个勾', type: 'bool', default: true },
    x: { label: '横向位置', type: 'number', min: 0, max: 512, default: 420 },
    y: { label: '纵向位置', type: 'number', min: 0, max: 512, default: 236 },
    at: { label: '弹出来（一圈里的位置 0～1）', type: 'number', min: 0, max: 1, step: 0.01, default: 0.59 },
    end: { label: '缩回去（0～1）', type: 'number', min: 0, max: 1, step: 0.01, default: 0.85 },
    stars: { label: '旁边闪小星星', type: 'bool', default: true },
  },
  draw(ctx, t, layer) {
    if (layer !== 'top') return;
    const k = t - this.p.at * this.T, e = this.p.end * this.T;
    if (k <= 0 || t > e + 0.25) return;
    const sc = elastic(k / 0.45) * (1 - easeIO((t - e) / 0.25));
    pill(ctx, this.p.x, this.p.y, this.p.text, { color: hex(this.p.color.replace('#', '').padEnd(6, '0')), sc, check: !!this.p.check });
    if (this.p.stars) for (const s of this.stage.twk) { const a = (0.5 + 0.5 * sin(t * 7 + s.ph)) * sc; if (a > 0.25) star(ctx, s.x, s.y, s.r * a, s.c); }
  },
});
