// 场景：一个「工程」（project JSON）= 画布设置 + 相机 + 水面 + 皮肤 + 一叠图层（动作、表情、道具、帽子、特效、文字、场景）。
// 每个图层指向一个组件（registry 里的 type:id）和它的参数；动作可以叠加、可以只在一段时间里起作用。
// 合成顺序和 engine/axl.py 的 Sticker.frame 一样：背景 → 水 → 后层特效 → 美西螈（水下偏色）→ 水面前沿 → 水花 → 前层特效 → 字 → 顶层特效。
import { E, K, W, H, BOX, mod, rng, strHash, clamp, win, headWorld, itemXf, xfPoint, projectBox, proj3, camera, hx, makeCanvas } from './core.js';
import { layout, charSprite, star, sq, polygon, line } from './draw.js';
import { resolveParams, lineOf } from './components.js';
import { bounded } from './loopguard.js';
import { Ax } from './ax.js';
import { normalizeProject } from './project.js';

export { Ax };
export { normalizeProject, fromRecipe, DEFAULTS } from './project.js';
const NUM = ['yaw', 'pitch', 'dx', 'dy', 'sx', 'sy', 'roll', 'zoom', 'alpha', 'gray', 'rgb'];
function cloneAx(a) { const b = Object.assign(Object.create(Ax.prototype), a); b.pose = structuredClone(a.pose); return b; }

// 几个动作叠在一起：结果 = 待机 + Σ 权重 ×（这个动作 − 待机）
function blend(base, parts) {
  const out = cloneAx(base);
  for (const f of NUM) out[f] = base[f] + parts.reduce((s, [a, k]) => s + k * (a[f] - base[f]), 0);
  out.show = parts.every(([a, k]) => k < 0.5 || a.show);
  const bones = new Set([...Object.keys(base.pose), ...parts.flatMap(([a]) => Object.keys(a.pose))].filter((b) => !b.startsWith('_')));
  for (const b of bones) {
    const p0 = base.pose[b] || {}, o = {};
    for (const key of ['set', 'rot', 'move']) {
      const zero = key === 'set' ? (p0.set || null) : [0, 0, 0];
      const b0 = p0[key] || zero;
      const has = p0[key] || parts.some(([a]) => a.pose[b]?.[key]);
      if (!has) continue;
      const ref = b0 || [0, 0, 0];
      o[key] = [0, 1, 2].map((i) => ref[i] + parts.reduce((s, [a, k]) => s + k * (((a.pose[b]?.[key]) || ref)[i] - ref[i]), 0));
    }
    out.pose[b] = o;
  }
  const strong = parts.filter(([, k]) => k >= 0.5).sort((x, y) => y[1] - x[1]);
  const face = strong.find(([a]) => a.pose._face && a.pose._face !== base.pose._face);
  if (face) out.pose._face = face[0].pose._face;
  out.pose._items = strong.flatMap(([a]) => a.pose._items || []);
  if (!out.pose._items.length) delete out.pose._items;
  return out;
}

// 帽子的位置微调（属性面板「戴在哪」）：gx gy gz 挪（模型像素）、gs 缩放、rx ry rz 转；没调过就是空的，按帽子本来的位置戴
function gearFit(q = {}) {
  const out = {};
  for (const k of ['gx', 'gy', 'gz', 'gs', 'rx', 'ry', 'rz']) if (typeof q[k] === 'number' && Number.isFinite(q[k]) && q[k] !== (k === 'gs' ? 1 : 0)) out[k] = q[k];
  return out;
}

function affine(a) {                                       // 盒子像素 -> 画布像素：[m00, m10, m01, m11, ox, oy]
  const r = -a.roll * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const m00 = c * a.sx, m01 = -s * a.sy, m10 = s * a.sx, m11 = c * a.sy;
  const ox = K.BOX_CX + a.dx - (m00 * BOX / 2 + m01 * BOX / 2), oy = K.BOX_CY + a.dy - (m10 * BOX / 2 + m11 * BOX / 2);
  return [m00, m10, m01, m11, ox, oy];
}

// ---------------- 场景 ----------------
export class Scene {
  constructor(project, registry, renderer) {
    const P = this.P = normalizeProject(project);
    this.reg = registry; this.R = renderer;
    this.FPS = P.fps; this.N = P.frames; this.T = P.frames / P.fps;
    this.stage = this;
    this.water = P.water.on; this.calm = P.water.calm; this.waterLevel = P.water.level;
    this.rippleOn = P.water.ripples; this.rippleDx = 0;
    this.errors = new Map();                               // `${type}:${id}` -> { message, line }
    const texts = P.layers.filter((l) => l.type === 'text').map((l) => l.text).join('');
    const r = this.rnd = rng(P.seed || (strHash(texts) & 0xffff) || 1);
    this.bubbles = Array.from({ length: 8 }, () => ({ x: r.uniform(150, 360), ph: r.random(), sp: r.uniform(90, 150), s: r.choice([6, 8, 10]) }));
    this.twk = Array.from({ length: 6 }, () => ({
      x: r.uniform(30, 482), y: r.uniform(200, 330), ph: r.uniform(0, 6.28), r: r.uniform(6, 10),
      c: r.choice([[255, 205, 60], [255, 140, 190], [130, 210, 255]]),
    }));
    this.droplets = []; this.rings = []; this.LAST = null; this.A = null;
    this.axCanvas = makeCanvas(W, H); this.lipCanvas = makeCanvas(W, H);   // 别叫 layer：实例上的 this.layer 是图层设置
    const live = P.layers.filter((l) => !l.hidden);
    const of = (t) => live.filter((l) => l.type === t);
    this.props = of('prop'); this.wears = of('wear');
    this.faceLayer = of('face')[0] || null;
    this.spec = { hold: this.props[0]?.component, face: this.faceLayer && !this.faceLayer.face ? this.faceLayer.component : undefined };
    this.texts = of('text').map((l) => this.textEntry(l));
    this.motions = of('motion').map((l) => this.instance('motion', l)).filter(Boolean);
    this.scenes = of('scene').map((l) => this.instance('scene', l)).filter(Boolean);
    this.fx = of('fx').map((l) => this.instance('fx', l)).filter(Boolean);
    if (this.R && this.reg) {
      this.R.lookup = (kind) => this.reg.get('prop', kind) || this.reg.get('wear', kind);
      if (this.R.regVersion !== this.reg.version) { this.R.itemGeo.clear(); this.R.regVersion = this.reg.version; }
      this.skin = [this.skinFn(), JSON.stringify(P.skin) + this.reg.version];
      this.R.setSkin(...this.skin);
    }
  }

  textEntry(l) {
    const lay = l.text ? layout(l.text, l.y, l.scale, l.x, l.font) : [];
    const anim = this.instance('textanim', l, { lay }) || this.instance('textanim', { ...l, component: 'stay' }, { lay });
    return { l, lay, anim };
  }
  // 预览上拖着一行字（不重建场景）：这一行按新位置重新排、文字动画重新建一份（setup 按新的图层和排版再跑一遍，和松手后重建出来的一样）。
  // 字的精灵按字号缓存着、模型几何不动，照旧用
  moveText(id, { x, y, scale }) {
    const i = this.texts.findIndex((t) => t.l.id === id);
    if (i < 0) return;
    Object.assign(this.texts[i].l, { x, y, scale });
    this.texts[i] = this.textEntry(this.texts[i].l);
  }

  // ---- 组件实例：this = 这一层的上下文（原型链连到场景，所以 this.T、this.ls、this.headPt 都能用） ----
  instance(type, layer, extra = {}) {
    const def = this.reg.get(type, layer.component);
    if (!def) { this.fail(type, layer.component, new Error('组件库里没有这个组件')); return null; }
    // 原型链：实例 → 组件定义（它自己写的辅助方法 this.xxx 也能用）→ 场景
    const ctx = Object.assign(Object.create(Object.assign(Object.create(this), def)), extra, { def, layer, p: resolveParams(def, layer.params) });
    if (def.setup) this.guard(ctx, () => def.setup.call(ctx));
    return ctx;
  }
  fail(type, id, e) { const k = `${type}:${id}`; if (!this.errors.has(k)) this.errors.set(k, { message: e.message || String(e), line: e.line ?? lineOf(e) }); }
  guard(ctx, fn) {
    if (ctx.broken) return undefined;
    try { return bounded(400, fn); } catch (e) { ctx.broken = true; this.fail(ctx.def.type, ctx.def.id, e); return undefined; }   // 单次调用超过 0.4 秒就当死循环
  }
  call(ctx, name, ...args) { const f = ctx.def[name]; return f ? this.guard(ctx, () => f.apply(ctx, args)) : undefined; }
  weight(l, t) {                                          // 图层在这一时刻的权重：强度 × 时间段（两头 0.08 淡入淡出）
    if (l.start <= 0 && l.end >= 1) return l.strength;
    const u = t / this.T;
    return l.strength * win(u, l.start, l.end, Math.min(0.08, (l.end - l.start) / 2 || 0.01));
  }

  skinFn() {
    const s = this.P.skin, def = s && this.reg.get('skin', s.component);
    if (s && !def) this.fail('skin', s.component, new Error('组件库里没有这个皮肤'));
    if (!def || !def.tint) return null;
    const ctx = Object.assign(Object.create(Object.assign(Object.create(this), def)), { def, layer: s, p: resolveParams(def, s.params) });
    let broken = false;
    return (rgb, part) => {                                // 每个面的颜色都过一遍 tint：也要有期限，坏了一次就不再调
      if (broken) return rgb;
      try { const c = bounded(400, () => def.tint.call(ctx, rgb, part)); return Array.isArray(c) ? c : rgb; } catch (e) { broken = true; this.fail('skin', def.id, e); return rgb; }
    };
  }

  // ---- loop helpers ----
  ls(t, n, ph = 0) { return Math.sin(2 * Math.PI * n * t / this.T + ph); }
  lc(t, n, ph = 0) { return Math.cos(2 * Math.PI * n * t / this.T + ph); }
  ph(t, n = 1, off = 0) { return mod(t * n / this.T + off, 1); }

  splash(t0, x = 0, n = 18, power = 1, spread = 90) {
    const r = rng(Math.floor(t0 * 1000) + Math.trunc(x) * 7 + n);
    for (let i = 0; i < n; i++) {
      const ang = r.uniform(200 * Math.PI / 180, 340 * Math.PI / 180), sp = r.uniform(140, 330) * power;
      this.stage.droplets.push({
        layer: this.layer?.id ? this.layer : null,             // 哪一层溅的：水花跟着那一层的时间段和强度
        t0, x: W / 2 + x + r.uniform(-spread, spread), vx: Math.cos(ang) * sp * 0.7, vy: Math.sin(ang) * sp,
        s: r.choice([7, 9, 11, 13]), c: r.choice([[150, 215, 255], [200, 236, 255], [255, 255, 255]]),
      });
    }
  }

  idle(a, t, { look = 20, gill = 1, tail = 1, paddle = 1, bob = 4 } = {}) {
    const p = a.pose;
    p.head = { rot: [look + 3 * this.ls(t, 4), 4 * this.ls(t, 2), 0] };
    const gw = 8 + 12 * gill * this.ls(t, 6);
    p.left_gills = { rot: [0, gw, 0] }; p.right_gills = { rot: [0, -gw, 0] };
    p.top_gills = { rot: [-0.6 * gw, 0, 0] };
    p.tail = { rot: [-18, 18 * tail * this.ls(t, 3), 0] };
    p.root = { rot: [8, 0, 0] };
    for (const [k, s] of [['leg3', 1], ['leg4', -1], ['leg1', -1], ['leg2', 1]]) {
      p[k].rot = [0, s * 10 * paddle * this.ls(t, 4, k === 'leg1' || k === 'leg2' ? 1 : 0), 0];
    }
    a.dy = bob * this.ls(t, 2);
    return a;
  }
  hold(a, kind, { x = 4.8, y = 7.4, z = -13.0, rz = -10, s = 1.0, legs = 1.0, ...kw } = {}) {
    const it = { kind, x, y, z, rz, s, ...kw };
    (a.pose._items ||= []).push(it);
    if (legs) {
      for (const k of ['leg3', 'leg4']) {
        const r = a.pose[k].rot || [0, 0, 0];
        a.pose[k].rot = [r[0] - 35 * legs, r[1] * (1 - legs), r[2]];
      }
    }
    return it;
  }
  wear(a, kind, kw = {}) { const it = { kind, ...kw }; (a.pose._items ||= []).push(it); return it; }
  propDef(kind) { return this.reg?.get('prop', kind) || null; }   // 道具组件（有 shape(k) 的道具能按进度变形，比如日志纸打到第几行）
  newAx() { return new Ax(this.P.camera); }

  faceDict(t) {
    const L = this.faceLayer;
    const known = L && !L.face && (this.reg.get('face', L.component)?.face || E.faces[L.component]);
    if (L && !L.face && !known) this.fail('face', L.component, new Error('组件库里没有这个表情'));
    let f = !L ? {} : L.face ? { ...L.face } : { ...(known || {}) };
    if ((!L || L.blink !== false) && (f.L || 'open') === 'open' && (f.R || 'open') === 'open') {
      if (this.ph(t, 1, 0.37) < 0.045) f.L = f.R = 'closed';
    }
    return f;
  }

  motion(t) {
    const base = this.newAx();
    this.idle(base, t, this.P.idle);
    const act = this.motions.map((m) => [m, this.weight(m.layer, t)]).filter(([m, k]) => k > 0 && m.def.move && !m.broken);
    let a;
    if (!act.length) a = base;
    else if (act.length === 1 && act[0][1] === 1) { a = base; this.call(act[0][0], 'move', a, t); }   // 和 Python 引擎一模一样的路径
    else {
      a = blend(base, act.map(([m, k]) => { const x = cloneAx(base); this.call(m, 'move', x, t); return [x, k]; }));
    }
    for (const s of this.scenes) if (s.def.move && this.weight(s.layer, t) > 0) this.call(s, 'move', a, t);
    this.dress(a, t, act.some(([m, k]) => m.def.holdsItself && k >= 0.5));
    const M = this.P.model;                                 // 工程里给模型整体定的大小 / 位置 / 角度 / 镜像，叠在动作上面（默认值就不碰：出图和以前逐字节一样）
    if (M.x || M.y || M.rot || M.flip || M.scale !== 1) { a.dx += M.x; a.dy += M.y; a.roll += M.rot; a.sx *= M.scale * (M.flip ? -1 : 1); a.sy *= M.scale; }
    return a;
  }
  dress(a, t, holdsItself) {
    if (!('_face' in a.pose)) { const f = this.faceDict(t); if (Object.keys(f).length) a.pose._face = f; }
    for (const w of this.wears) {                         // 找不到的道具 / 帽子记成错误（出图会因此失败），别悄悄少画一样
      if (this.reg.get('wear', w.component)) this.wear(a, w.component, { gear: true, ...gearFit(w.params) });
      else this.fail('wear', w.component, new Error('组件库里没有这个帽子'));
    }
    if (!holdsItself) {
      for (const p of this.props) {
        const def = this.reg.get('prop', p.component);
        if (!def) { this.fail('prop', p.component, new Error('组件库里没有这个道具')); continue; }
        const q = p.params || {};
        const opt = { s: q.s ?? (def.sprite ? K.SPR_S : 0.9) };
        for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz']) if (q[k] !== undefined && q[k] !== '') opt[k] = Number(q[k]);
        this.hold(a, p.component, opt);
      }
    }
  }

  coverTime() {
    if (typeof this.P.cover === 'number') return this.P.cover * this.T;   // 工程自己定了封面在一圈里的哪儿
    const ent = this.texts.filter((x) => x.anim.def.entrance && x.anim.def.cover);
    if (ent.length) return Math.max(...ent.map((x) => this.guard(x.anim, () => x.anim.def.cover.call(x.anim, x.lay.length)) || 0));
    const m = this.motions.find((x) => x.def.coverK !== undefined && x.def.coverK !== null);
    return m ? m.def.coverK * this.T : 0;
  }

  waterY(x, t) {
    return this.wl + this.calm * (5 * Math.sin(x / 38 + 2 * Math.PI * 3 * t / this.T) + 3 * Math.sin(x / 17 - 2 * Math.PI * 4 * t / this.T));
  }

  // ---- 投影（这一帧画过美西螈之后才有效） ----
  toCanvas(bx, by) { const [a, b, c, d, e, f] = affine(this.A); return [a * bx + c * by + e, b * bx + d * by + f]; }
  proj(p) { const [bx, by] = projectBox(this.LAST, p); return this.toCanvas(bx, by); }
  headPt(p = [0, 6.5, -7.5]) { return this.proj(xfPoint(headWorld(this.A.pose), p)); }
  eyePts() { return [this.headPt([3.6, 6.5, -10.2]), this.headPt([-3.6, 6.5, -10.2])]; }
  itemPt(idx = 0, p = [0, 0, 0]) { return this.proj(xfPoint(itemXf(this.A.pose, this.A.pose._items[idx]), p)); }
  itemAt(it, p = [0, 0, 0], a = this.A) { return this.projAt(a, xfPoint(itemXf(a.pose, it), p)); }   // 没拿在手上的道具（it 是道具的位置）在这一帧会在哪
  // 别的时刻：poseAt(t) 是那一刻的姿势（只算不画，也不改这一帧的涟漪），projAt(a, 世界坐标) 投到画布上（投影只看镜头，不用渲染）
  poseAt(t) {
    const keep = [this.rippleOn, this.rippleDx, this.rings, this.A];
    this.rings = [];
    try { return this.motion(t); } finally { [this.rippleOn, this.rippleDx, this.rings, this.A] = keep; }
  }
  projAt(a, p) {
    const zoom = a.zoom * (this.P.camera.zoom ?? 1), persp = this.P.camera.persp ?? K.PERSP, C = camera(a.yaw, a.pitch), an = proj3(C, K.ANCHOR, persp);
    const [bx, by] = projectBox({ C, persp, center: [an[0] - K.ANCHOR_OFF[0] / zoom, an[1] - K.ANCHOR_OFF[1] / zoom], scale: K.SCL_BOX * zoom }, p);
    const [m00, m10, m01, m11, ox, oy] = affine(a);
    return [m00 * bx + m01 * by + ox, m10 * bx + m11 * by + oy];
  }

  hooks(ctx, name, t) {                                  // 动作 / 场景自己画的东西也跟着图层的强度和淡入淡出
    for (const x of [...this.scenes, ...this.motions]) {
      const k = Math.min(1, this.weight(x.layer, t));
      if (k <= 0) continue;
      if (k >= 1) { this.call(x, name, ctx, t); continue; }
      ctx.save(); ctx.globalAlpha *= k; this.call(x, name, ctx, t); ctx.restore();
    }
  }
  // 渲染器（three.js）是几个场景共用的：画之前把自己的皮肤换回来（素材缩略图、导出用的场景会改它）
  renderAx(a) { if (this.skin) this.R.setSkin(...this.skin); return this.R.render(a, this.P.camera); }
  drawFx(ctx, t, layer) {
    for (const f of this.fx) {
      const k = Math.min(1, this.weight(f.layer, t));
      if (k <= 0.001) continue;
      ctx.save(); ctx.globalAlpha = k;
      this.call(f, 'draw', ctx, t, layer);
      ctx.restore();
    }
  }

  // ---- 给接管整帧的场景组件（比如水龙卷）用 ----
  // 把美西螈画好、摆好，返回一张 W×H 的图层（this.A / this.LAST 也会更新）
  axLayer(a) {
    this.A = a;
    this.LAST = this.renderAx(a);
    const g = this.axCanvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.globalAlpha = a.alpha; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const [m00, m10, m01, m11, ox, oy] = affine(a);
    g.setTransform(m00, m10, m01, m11, ox, oy);
    g.drawImage(this.R.canvas, 0, 0, BOX, BOX);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    return this.axCanvas;
  }
  // 挪美西螈，让它身上的锚点（头和身子之间）正好落在画布 (X, Y)
  placeAt(a, X, Y) {
    const ab = [BOX / 2 + K.ANCHOR_OFF[0] * K.SCL_BOX * BOX, BOX / 2 - K.ANCHOR_OFF[1] * K.SCL_BOX * BOX];
    a.dx = a.dy = 0;
    const [m00, m10, m01, m11] = affine(a), vx = ab[0] - BOX / 2, vy = ab[1] - BOX / 2;
    a.dx = X - K.BOX_CX - (m00 * vx + m01 * vy); a.dy = Y - K.BOX_CY - (m10 * vx + m11 * vy);
  }
  // 单独画几个道具（at: 'world'），返回 size×size 的图，比例和美西螈一致
  itemImage(items, { size = 170, zoom = 1, yaw = 180, pitch = 20 } = {}) {
    const a = this.newAx(); a.yaw = yaw; a.pitch = pitch; a.pose._items = items.map((it) => ({ at: 'world', x: 0, y: 0, z: 0, ...it }));
    this.R.render(a, { persp: this.P.camera.persp }, { itemsOnly: true, center: [0, 0], scale: K.SCL_BOX * zoom * BOX / size });
    const c = this.itemCanvas ||= makeCanvas(size, size), g = c.getContext('2d');
    if (c.width !== size) { c.width = c.height = size; }
    g.clearRect(0, 0, size, size); g.imageSmoothingQuality = 'high';
    g.drawImage(this.R.canvas, 0, 0, size, size);
    const out = makeCanvas(size, size); out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }
  background(ctx) {
    const bg = this.P.background;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    if (bg.mode === 'gradient') {                            // 上下渐变：color 在上、color2 在下
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg.color || '#ffffff'); g.addColorStop(1, bg.color2 || '#ffe3f0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (bg.mode !== 'transparent') { ctx.fillStyle = bg.mode === 'color' ? bg.color : '#fff'; ctx.fillRect(0, 0, W, H); }
  }

  // ---- 一帧：画到 ctx（W×H） ----
  frame(ctx, t) {
    this.wl = this.waterLevel;
    this.rippleOn = this.P.water.ripples; this.rippleDx = 0;   // 动作组件每帧可以改这两个（比如卡顿关掉涟漪），过了它的时间段要恢复
    // 接管整帧的场景组件（水龙卷）：只在它的时间段里接管，两头淡入淡出
    const own = this.scenes.find((s) => s.def.render && !s.broken && this.weight(s.layer, t) > 0.001);
    const k = own ? Math.min(1, this.weight(own.layer, t)) : 0;
    if (own && k >= 0.999) { ctx.save(); this.background(ctx); this.call(own, 'render', ctx, t); ctx.restore(); return; }
    this.plainFrame(ctx, t);
    if (own) {
      const c = this.sceneCanvas ||= makeCanvas(W, H), g = c.getContext('2d');
      g.save(); this.background(g); this.call(own, 'render', g, t); g.restore();
      ctx.save(); ctx.globalAlpha = k; ctx.drawImage(c, 0, 0); ctx.restore();
    }
  }
  plainFrame(ctx, t) {
    ctx.save();
    this.background(ctx);
    this.hooks(ctx, 'drawSky', t);
    this.rings = [];                                       // 动作自己加的涟漪（[x, y, 横半径, 竖半径, 不透明度]），每帧重来
    const a = this.motion(t); this.A = a;
    let layer = null;
    if (a.show && this.R) {
      this.LAST = this.renderAx(a);
      layer = this.axCanvas;
      const g = layer.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      g.globalAlpha = a.alpha; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      const [m00, m10, m01, m11, ox, oy] = affine(a);
      g.setTransform(m00, m10, m01, m11, ox, oy);
      g.drawImage(this.R.canvas, 0, 0, BOX, BOX);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      if (a.gray > 0 || a.rgb) this.tintLayer(g, a);
    }
    const poly = [];
    for (let x = -8; x < W + 16; x += 8) poly.push([x, this.waterY(x, t)]);
    const surface = poly.slice();
    poly.push([W + 8, H + 8], [-8, H + 8]);
    const wc = hx(String(this.P.water.color || '#aadeff').replace('#', '').padEnd(6, '0'));
    if (this.water) {
      polygon(ctx, poly, wc);
      if (this.P.water.bubbles) {
        for (const b of this.bubbles) {
          const per = this.T / 2, tt = mod(t + b.ph * per, per), y = H + 10 - tt * b.sp * 1.2;
          if (y > this.waterY(b.x, t) + 6) {
            const x = b.x + 6 * Math.sin(tt * 8);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, b.s - 1, b.s - 1);
          }
        }
      }
      this.ripples = [];
      if (this.rippleOn) {
        const per = this.T / 2;
        for (let k = 0; k < 3; k++) {
          const tt = mod(t + k * per / 3, per), r = 40 + tt * 170 / (per / 1.6), al = Math.floor(220 * (1 - tt / per)) / 255;
          this.ripples.push([W / 2 + this.rippleDx, this.wl + 8, r, r * 0.16, al]);
        }
      }
      this.ripples.push(...this.rings);
      this.arcs(ctx, Math.PI, 2 * Math.PI);
    }
    this.hooks(ctx, 'drawBack', t);
    this.drawFx(ctx, t, 'back');
    if (layer) {
      if (this.water) {                                    // 水下的部分往水色偏 42%
        const g = layer.getContext('2d');
        g.globalCompositeOperation = 'source-atop';
        polygon(g, poly, wc.map((v, i) => Math.round(v * [0.706, 0.856, 1][i])), 0.42);
        g.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(layer, 0, 0);
    }
    if (this.water) {
      const g = this.lipCanvas.getContext('2d');
      g.clearRect(0, 0, W, H);
      polygon(g, surface.map(([x, y]) => [x, y + 14]).concat([[W + 8, H + 8], [-8, H + 8]]), wc.map((v, i) => Math.round(v * [0.88, 0.946, 1][i])), 150 / 255);
      line(g, surface, [255, 255, 255], 5, 230 / 255);
      this.arcs(g, 0, Math.PI);
      ctx.drawImage(this.lipCanvas, 0, 0);
    }
    for (const p of this.droplets) {
      const tt = mod(t - p.t0, this.T), k = p.layer ? Math.min(1, this.weight(p.layer, t)) : 1;
      if (tt < 1.2 && k > 0.001) {
        const x = p.x + p.vx * tt, y = this.wl + p.vy * tt + 520 * tt * tt;
        if (k < 1) { ctx.save(); ctx.globalAlpha *= k; }
        if (y < this.waterY(x, t) + 4) sq(ctx, x, y, p.s * (1 - tt / 1.6), p.c, [90, 170, 235]);
        if (k < 1) ctx.restore();
      }
    }
    this.hooks(ctx, 'drawFront', t);
    this.drawFx(ctx, t, 'front');
    this.drawText(ctx, t);
    this.hooks(ctx, 'drawTop', t);
    this.drawFx(ctx, t, 'top');
    ctx.restore();
  }

  arcs(g, a0, a1) {
    for (const [cx, cy, rx, ry, al] of this.ripples || []) {
      if (rx <= 2 || ry <= 2) continue;
      g.beginPath(); g.ellipse(cx, cy, rx - 2, ry - 2, 0, a0, a1);
      g.strokeStyle = `rgba(255,255,255,${al})`; g.lineWidth = 4; g.stroke();
    }
  }

  tintLayer(g, a) {                                        // 石化变灰 / 卡顿的 RGB 错位
    const im = g.getImageData(0, 0, W, H), d = im.data;
    if (a.gray > 0) {
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        d[i] = d[i] * (1 - a.gray) + (l * 0.62 + 58) * a.gray;
        d[i + 1] = d[i + 1] * (1 - a.gray) + (l * 0.62 + 60) * a.gray;
        d[i + 2] = d[i + 2] * (1 - a.gray) + (l * 0.62 + 68) * a.gray;
      }
    }
    if (a.rgb) {
      const src = new Uint8ClampedArray(d), s = a.rgb;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          d[i] = src[(y * W + mod(x + s, W)) * 4];
          d[i + 2] = src[(y * W + mod(x - s, W)) * 4 + 2];
        }
      }
    }
    g.putImageData(im, 0, 0);
  }

  drawText(ctx, t) {
    ctx.save();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    for (const { l, lay, anim } of this.texts) {
      const n = lay.length, k = Math.min(1, this.weight(l, t));
      if (k <= 0.001) continue;
      ctx.globalAlpha = k;
      lay.forEach(([c, x, y, ch], i) => {
        const r = this.guard(anim, () => anim.def.xf.call(anim, i, n, t)) || [0, 0, 1, 0, true];
        const [dx, dy, sc, rot, vis] = r;
        if (!vis || sc < 0.03) return;
        const spr = charSprite(c, ch, l.style, l.font);
        ctx.setTransform(1, 0, 0, 1, x + dx, y + dy + 8);
        if (Math.abs(rot) > 0.05) ctx.rotate(-rot * Math.PI / 180);
        if (Math.abs(sc - 1) > 1e-3) ctx.scale(sc, sc);
        ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      });
      if (anim.def.draw) { ctx.setTransform(1, 0, 0, 1, 0, 0); this.guard(anim, () => anim.def.draw.call(anim, ctx, t, lay)); }   // 文字动画自己画的东西（字蹦出来时炸开的小星星）
    }
    ctx.restore();
  }

  twinkles(ctx, t, amt = 1, ys = null) {
    for (const s of this.twk) {
      const a = (0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t / this.T + s.ph)) * amt;
      if (a > 0.25) star(ctx, s.x, ys === null ? s.y : ys[0] + (s.y - 200) * (ys[1] - ys[0]) / 130, s.r * a, s.c);
    }
  }
}
