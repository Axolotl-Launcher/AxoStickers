// 内置特效「太阳」。
component({
  id: 'sun', type: 'fx', name: '太阳',
  params: { x: { label: '横向位置', type: 'number', min: 40, max: 470, default: 440 }, y: { label: '纵向位置', type: 'number', min: 40, max: 400, default: 230 } },
  draw(ctx, t, layer) {
    if (layer !== 'back') return;
    const { x, y } = this.p;
    for (let j = 0; j < 12; j++) {
      const ang = (j * 30 + 15 * t / this.T * 4) * PI / 180;
      line(ctx, [[x + cos(ang) * 44, y + sin(ang) * 44], [x + cos(ang) * 62, y + sin(ang) * 62]], [255, 200, 60], 6);
    }
    ellipse(ctx, x - 36, y - 36, x + 36, y + 36, [255, 210, 70], [240, 160, 30], 4);
  },
});
