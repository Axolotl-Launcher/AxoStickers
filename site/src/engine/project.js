// 工程（project JSON）：画布、相机、水面、皮肤、自带的组件源码、一叠图层。纯数据，网页主线程和沙盒都用（不依赖 three.js）。
export const DEFAULTS = {
  v: 2, size: 400, fps: 15, frames: 48, seed: 0,
  background: { mode: 'white', color: '#ffffff' },
  camera: { yaw: 160, pitch: 28, zoom: 1, persp: 0.15 },
  water: { on: true, level: 405, calm: 1, bubbles: true, ripples: true, color: '#aadeff' },
  idle: { look: 20, gill: 1, tail: 1, paddle: 1, bob: 4 },
  skin: { component: 'lucy', params: {} },
  model: { component: 'axolotl', face: null },
  layers: [],
};
const num = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

export function normalizeProject(p = {}) {
  const d = DEFAULTS, P = structuredClone(p);
  const out = {
    v: 2, name: String(P.name || '').slice(0, 40),
    size: num(P.size, d.size, 64, 800), fps: num(P.fps, d.fps, 5, 30), frames: Math.round(num(P.frames, d.frames, 4, 120)),
    seed: Math.round(num(P.seed, 0, 0, 1e6)),
    background: { ...d.background, ...(P.background || {}) },
    camera: { ...d.camera, ...(P.camera || {}) },
    water: { ...d.water, ...(P.water || {}) },
    idle: { ...d.idle, ...(P.idle || {}) },
    skin: { ...d.skin, ...(P.skin || {}) },
    model: { component: String(P.model?.component || 'axolotl').slice(0, 80), face: typeof P.model?.face === 'boolean' ? P.model.face : null },
    components: (Array.isArray(P.components) ? P.components : []).slice(0, 24)
      .filter((c) => c && typeof c.source === 'string' && c.source.length <= 60000)
      .map((c) => ({ origin: String(c.origin || 'project').slice(0, 80), source: c.source })),
    layers: (Array.isArray(P.layers) ? P.layers : []).slice(0, 40).map((l, i) => ({
      id: String(l.id || `l${i}`), type: String(l.type || ''), component: String(l.component || ''), params: l.params || {},
      start: num(l.start, 0, 0, 1), end: num(l.end, 1, 0, 1), strength: num(l.strength, 1, 0, 2), hidden: !!l.hidden,
      ...(l.type === 'text' ? { text: String(l.text ?? '').slice(0, 24), style: String(l.style || 'pink'), y: num(l.y, 118, 0, 512), x: num(l.x, 0, -256, 256), scale: num(l.scale, 1, 0.3, 2),
        ...(l.font && l.font !== 'axo' ? { font: String(l.font).slice(0, 80) } : {}) } : {}),   // 默认字体不写进工程（工坊只认默认字体）
      ...(l.type === 'face' ? { face: l.face && typeof l.face === 'object' ? l.face : null, blink: l.blink !== false } : {}),
    })),
  };
  const ids = new Set();                                       // 图层 id 重复了就改名：编辑器按 id 找图层，重复会改错图层
  for (const [i, l] of out.layers.entries()) { if (ids.has(l.id)) l.id = `${l.id}_${i}`; ids.add(l.id); }
  const c = out.camera; c.yaw = num(c.yaw, d.camera.yaw, -720, 720); c.pitch = num(c.pitch, d.camera.pitch, -89, 89);
  c.zoom = num(c.zoom, 1, 0.3, 3); c.persp = num(c.persp, d.camera.persp, 0, 0.6);
  const w = out.water; w.level = num(w.level, d.water.level, 200, 512); w.calm = num(w.calm, 1, 0, 3);
  return out;
}

// 引擎 specs.py 里的通用特效写法 ('pop', 'flag', 6, (85, -95)) / 清单里的 'float:mail' → 图层
function fxLayer(f) {
  if (typeof f === 'string' && !f.includes(':')) return { type: 'fx', component: f };
  const [kind, ...a] = Array.isArray(f) ? f : f.split(':');
  const at = (v) => (Array.isArray(v) ? { x: v[0], y: v[1] } : {});
  const params = {
    float: () => ({ icon: a[0], n: a[1] ?? 4, k: a[2] ?? 4 }), fall: () => ({ icon: a[0], n: a[1] ?? 10, k: a[2] ?? 4 }),
    pop: () => ({ icon: a[0], k: a[1] ?? 6, ...at(a[2]) }), stay: () => ({ icon: a[0], k: a[2] === undefined ? a[1] ?? 6 : a[1], ...at(a[2]) }),
    say: () => ({ icon: a[0] }), orbit: () => ({ icon: a[0], n: a[1] ?? 3, ...(Array.isArray(a[2]) ? { rx: a[2][0], ry: a[2][1] } : {}), k: a[3] ?? 4 }),
  }[kind];
  return { type: 'fx', component: kind, params: params ? params() : {} };
}

// v1 配方（网站第一版 / 图鉴里的一张）→ 工程
// 第一版的配方 / 引擎 specs 把动作参数（n、s、dir、flip、debris）直接写在顶层，种子和 idle 也是：一并搬进工程
const MOTION_KEYS = ['n', 's', 'debris', 'dir', 'flip'];
export function fromRecipe(r) {
  const params = { ...Object.fromEntries(MOTION_KEYS.filter((k) => r[k] !== undefined && r[k] !== null).map((k) => [k, r[k]])), ...(r.params || {}) };
  const layers = [{ type: 'motion', component: r.motion || 'idle', params }];
  layers.push({ type: 'face', component: typeof r.face === 'string' ? r.face : 'normal' });
  if (r.hold) layers.push({ type: 'prop', component: r.hold });
  for (const w of r.wear || []) layers.push({ type: 'wear', component: w });
  for (const f of r.fx || []) layers.push(fxLayer(f));
  if (r.text !== undefined) layers.push({ type: 'text', component: r.tmode || 'stay', text: r.text, style: r.style || 'pink' });
  return normalizeProject({ name: r.text, seed: r.seed ?? 0, ...(r.idle && typeof r.idle === 'object' ? { idle: r.idle } : {}), layers: layers.map((l, i) => ({ id: `l${i}`, ...l })) });
}

