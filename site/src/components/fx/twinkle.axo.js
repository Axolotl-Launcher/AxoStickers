// 内置特效「小星星」。
component({
  id: 'twinkle', type: 'fx', name: '小星星',
  draw(ctx, t, layer) { if (layer === 'top') this.stage.twinkles(ctx, t, 1); },
});
