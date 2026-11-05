// 内置文字动画「蹦回来，再接着…」：先像「蹦回来」那样一个个蹦出来（能炸小星星），落定以后慢慢接上另一个文字动画（抖动、耷拉、弹跳……），
// 快到一圈末尾时一起收掉。生气、委屈这种本来就有表情的字也能有出场
component({
  id: 'popthen', type: 'textanim', name: '蹦回来，再接着…', extends: 'popin',
  params: {
    then: { label: '落定以后', type: 'select', default: 'bounce',
      options: [['shake', '抖动'], ['shiver', '哆嗦'], ['droop', '耷拉'], ['bounce', '弹跳'], ['wave', '波浪'], ['swing', '摇摆'], ['pulse', '心跳'], ['zoom', '冲击'], ['spin', '翻转'], ['stay', '轻轻晃']] },
  },
  popin() { return this.reg.get('textanim', 'popin'); },
  setup() {
    this.popin().setup.call(this);
    const d = this.reg.get('textanim', this.p.then);
    this.next = d && d.xf && !d.entrance ? { d, ctx: Object.assign(Object.create(this), { p: {} }) } : null;
  },
  xf(i, n, t) {
    const a = this.popin().xf.call(this, i, n, t);
    if (!a[4] || !this.next) return a;
    const k = clamp((t - this.t0(i) - 0.45) / 0.35), b = this.next.d.xf.call(this.next.ctx, i, n, t) || [0, 0, 1, 0, true];
    return [a[0] + k * b[0], a[1] + k * b[1], a[2] * (1 + k * (b[2] - 1)), a[3] + k * b[3], true];
  },
});
