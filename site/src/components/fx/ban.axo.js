// 内置特效「禁止标志」：初代「请截图」里盖在相机上的红圈斜杠（kit 工具包 anim_screenshot.py）。到点弹出来，到点消失
component({
  id: 'ban', type: 'fx', name: '禁止标志',
  params: {
    at: { label: '弹出来（一圈里的位置 0～1）', type: 'number', min: 0, max: 1, step: 0.01, default: 0.19 },
    end: { label: '消失（0～1）', type: 'number', min: 0, max: 1, step: 0.01, default: 0.28 },
    on: { label: '盖在哪', type: 'select', options: [['item', '手里的道具（没拿就在头上）'], ['head', '头上']], default: 'item' },
    size: { label: '大小', type: 'number', min: 10, max: 120, default: 46 },
  },
  draw(ctx, t, layer) {
    if (layer !== 'front' || !this.LAST) return;
    const k = (t - this.p.at * this.T) / 0.35, e = this.p.end * this.T;
    if (k <= 0 || t >= e) return;
    const sc = elastic(k) * (1 - easeIO((t - e + 0.12) / 0.12)), r = this.p.size * sc;
    if (r < 2) return;
    const idx = this.p.on === 'item' ? (this.A.pose._items || []).findIndex((x) => !x.gear) : -1;
    const [x, y] = idx >= 0 ? this.itemPt(idx, [0, 0, -3]) : this.headPt([0, 6.5, -11]);
    const red = [235, 45, 55], white = [255, 255, 255], d = 0.8 * r * cos(PI / 4);
    ellipse(ctx, x - r - 4, y - r - 4, x + r + 4, y + r + 4, null, white, floor(18 * sc) + 1);
    ellipse(ctx, x - r, y - r, x + r, y + r, null, red, floor(10 * sc) + 1);
    line(ctx, [[x - d, y - d], [x + d, y + d]], white, floor(16 * sc) + 1);
    line(ctx, [[x - d, y - d], [x + d, y + d]], red, floor(10 * sc) + 1);
  },
});
