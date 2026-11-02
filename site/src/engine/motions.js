// 动作（engine/motions.py + motions2.py）。和 Python 一样：idle 打底，move() 叠动作，dress() 穿表情 / 帽子 / 道具。
import { Sticker, Ax } from './stage.js';
import { makeFx } from './fx.js';
import { E, K, YAW, FPS, clamp, lerp, easeOut, easeIn, easeIO, easeOutBack, elastic, bump, win, mod, rng, rootM } from './core.js';
import { icon, put, sq, star, line } from './draw.js';

export const FACES = E.faces;
const LEGS = ['leg1', 'leg2', 'leg3', 'leg4'];
const GILLS = [['left_gills', 1], ['right_gills', -1]];
const abs = Math.abs, sin = Math.sin, cos = Math.cos, PI = Math.PI;

function addrot(a, bone, x = 0, y = 0, z = 0) {
  const r = a.pose[bone]?.rot || [0, 0, 0];
  (a.pose[bone] ||= {}).rot = [r[0] + x, r[1] + y, r[2] + z];
}
const LEGR = {
  leg3: [[[80, -55, 0], [0, -1.5, 0]], [[120, 40, -60], [1.5, 0, -3]]],
  leg4: [[[80, 55, 0], [0, -1.5, 0]], [[120, -40, 60], [-1.5, 0, -3]]],
};
function legmix(a, name, k, extra = [0, 0, 0]) {
  const [[r, rm], [u, um]] = LEGR[name];
  a.pose[name] = { set: [0, 1, 2].map((i) => lerp(r[i], u[i], k) + extra[i]), move: [0, 1, 2].map((i) => lerp(rm[i], um[i], k)) };
}
const sprS = (kind) => (E.spr[kind] ? K.SPR_S : 0.9);

class Base extends Sticker {
  constructor(spec, R) {
    super(spec, R);
    this.fx = makeFx(spec.fx);
    this.setup();
  }
  get holdsItself() { return false; }
  setup() {}
  move() {}
  motion(t) {
    const a = new Ax();
    this.idle(a, t, this.spec.idle || {});
    this.move(a, t);
    this.dress(a, t);
    return a;
  }
  faceDict(t, name) {
    let f = name || this.spec.face || 'normal';
    f = typeof f === 'string' ? { ...(FACES[f] || {}) } : { ...f };
    if (this.spec.blink !== false && (f.L || 'open') === 'open' && (f.R || 'open') === 'open') {
      if (this.ph(t, 1, this.spec.blink_ph ?? 0.37) < 0.045) f.L = f.R = 'closed';
    }
    return f;
  }
  dress(a, t) {
    const sp = this.spec;
    if (!('_face' in a.pose)) { const f = this.faceDict(t); if (Object.keys(f).length) a.pose._face = f; }
    for (const w of sp.wear || []) {
      if (typeof w === 'string') this.wear(a, w);
      else { const { kind, ...kw } = w; this.wear(a, kind, kw); }
    }
    let h = sp.hold;
    if (h && !this.holdsItself) {
      h = typeof h === 'string' ? { kind: h } : { ...h };
      if (h.s === undefined) h.s = sprS(h.kind);
      const { kind, ...kw } = h;
      this.hold(a, kind, kw);
    }
  }
}

// ---------------- simple body motions ----------------
class Idle extends Base {}
class Nod extends Base {
  move(a, t) { const k = this.ph(t, this.spec.n || 3), n = k < 0.45 ? bump(k / 0.45) : 0; addrot(a, 'head', -24 * n); a.dy += 5 * n; }
}
class Shake extends Base {
  move(a, t) { addrot(a, 'head', 0, 30 * this.ls(t, 4), 4 * this.ls(t, 4)); addrot(a, 'root', 0, 5 * this.ls(t, 4, PI)); }
}
class Hop extends Base {
  setup() { const n = this.spec.n || 2; for (let i = 0; i < n; i++) this.splash((0.45 + i) * this.T / n, 0, 8, 0.55, 60); }
  move(a, t) {
    const k = this.ph(t, this.spec.n || 2);
    if (k < 0.45) {
      const u = k / 0.45;
      a.dy -= 80 * sin(PI * u); a.sy = 1 + 0.07 * sin(PI * u); a.sx = 1 / a.sy ** 0.5;
      addrot(a, 'root', 12 * cos(PI * u));
      for (const l of LEGS) addrot(a, l, -20 * sin(PI * u));
    } else {
      const u = (k - 0.45) / 0.55, b = u < 0.3 ? bump(u / 0.3) : 0;
      a.sy = 1 - 0.09 * b; a.sx = 1 + 0.07 * b; a.dy += 6 * b;
    }
  }
}
class Jump extends Base {
  setup() { this.t0 = 0.16 * this.T; this.t1 = 0.6 * this.T; this.splash(this.t0, 0, 16, 1.0); this.splash(this.t1 + 0.05, 0, 20, 1.1); }
  move(a, t) {
    const flip = this.spec.flip || 0;
    if (t < this.t0) { const u = t / this.t0; a.dy += 18 * bump(u); a.sy = 1 - 0.06 * bump(u); }
    else if (t < this.t1) {
      const k = (t - this.t0) / (this.t1 - this.t0);
      a.dy -= 210 * 4 * k * (1 - k);
      addrot(a, 'root', 30 - 60 * k - flip * 360 * easeIO(k));
      a.sy = k < 0.25 ? 1 + 0.08 * bump(k / 0.25) : 1;
      for (const l of LEGS) addrot(a, l, -25 * bump(k));
      addrot(a, 'tail', 20 * bump(k));
    } else {
      const u = (t - this.t1) / (this.T - this.t1);
      a.dy += u < 0.6 ? 70 * bump(u / 0.6) : 0;
    }
  }
}
class Flip extends Jump { constructor(spec, R) { super({ ...spec, flip: 1 }, R); } }
class Spin extends Base {
  move(a, t) { const k = this.ph(t, this.spec.n || 1); a.yaw = YAW + 360 * easeIO(k) * (this.spec.dir || 1); a.dy -= 26 * bump(k); }
}
class Sink extends Base {
  setup() { this.splash(0.42 * this.T, 0, 10, 0.6, 50); this.splash(0.78 * this.T, 0, 14, 0.8); }
  move(a, t) {
    const k = this.ph(t);
    let d;
    if (k < 0.15) d = 0;
    else if (k < 0.42) { d = 260 * easeIn((k - 0.15) / 0.27); addrot(a, 'root', -20 * clamp((k - 0.15) / 0.1)); }
    else if (k < 0.66) d = 300;
    else d = 300 * (1 - easeOutBack((k - 0.66) / 0.3, 1.3));
    a.dy += d; a.show = d < 290;
  }
}
class Peek extends Base {
  move(a, t) {
    const k = this.ph(t), rise = k > 0.3 && k < 0.7 ? bump((k - 0.3) / 0.4) : 0;
    a.dy += 52 - 26 * easeIO(rise * 1.6);
    addrot(a, 'head', -10, 28 * clamp(1.8 * this.ls(t, 1)));
  }
}
class Tremble extends Base {
  move(a, t) {
    a.dx += 3.5 * this.ls(t, 36); addrot(a, 'head', 0, 3 * this.ls(t, 30));
    for (const [g, s] of GILLS) addrot(a, g, 0, s * 10 * this.ls(t, 24));
  }
}
class Rage extends Base {
  move(a, t) {
    a.dx += 4.5 * this.ls(t, 30); const p = Math.exp(-this.ph(t, 4) * 5); a.sx = a.sy = 1 + 0.07 * p; addrot(a, 'head', -14);
    for (const [g, s] of GILLS) addrot(a, g, 0, s * 25);
    addrot(a, 'top_gills', -20);
  }
}
class Dance extends Base {
  move(a, t) {
    a.roll = 9 * this.ls(t, 2); a.dx += 26 * this.ls(t, 2);
    addrot(a, 'head', 0, 22 * this.ls(t, 2, PI / 2), 6 * this.ls(t, 4));
    a.dy -= 14 * abs(this.ls(t, 4));
    for (const [l, s] of [['leg3', 1], ['leg4', -1]]) addrot(a, l, -50 * Math.max(0, s * this.ls(t, 4)));
    addrot(a, 'tail', 0, 25 * this.ls(t, 4));
  }
}
class Wag extends Base {
  move(a, t) { addrot(a, 'tail', 0, 40 * this.ls(t, 8)); addrot(a, 'root', 0, 7 * this.ls(t, 8, PI)); a.dy -= 6 * abs(this.ls(t, 4)); }
}
class Bow extends Base {
  move(a, t) {
    const k = this.ph(t, this.spec.n || 2), b = k < 0.7 ? easeIO(bump(k / 0.7)) : 0;
    addrot(a, 'head', -45 * b); addrot(a, 'root', -14 * b); a.dy += 18 * b;
  }
}
class Doze extends Base {
  move(a, t) {
    const k = this.ph(t), drop = k < 0.82 ? easeIn(k / 0.82) : 1 - easeOut((k - 0.82) / 0.1);
    addrot(a, 'head', -40 * drop); a.dy += 22 * drop;
    for (const [g] of GILLS) addrot(a, g, -25 * drop);
    a.pose._face = { ...(k > 0.82 && k < 0.95 ? FACES.surprise : FACES[this.spec.face || 'sleep'] || {}) };
  }
}
class Flop extends Base {
  move(a, t) {
    a.pose.head.rot = [-2 + 2 * this.ls(t, 1), 0, 0];
    for (const [l, s] of [['leg1', 1], ['leg2', -1], ['leg3', 1], ['leg4', -1]]) addrot(a, l, 0, 0, s * 40);
    a.pose.tail.rot = [0, 6 * this.ls(t, 1), 0];
    a.sy = 0.9 + 0.025 * this.ls(t, 2); a.sx = 1.06; a.dy += 30;
    for (const [g, s] of GILLS) a.pose[g] = { rot: [-30, s * 20, 0] };
    a.pose.top_gills = { rot: [-30, 0, 0] };
  }
}
class Dash extends Base {
  setup() { this.splash(0.22 * this.T, 40, 12, 0.7); }
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.2) { a.dx -= 14 * easeIO(k / 0.2); addrot(a, 'head', 0, -20 * easeIO(k / 0.2)); }
    else if (k < 0.4) { a.dx += -14 + 480 * easeIn((k - 0.2) / 0.2); a.yaw = YAW + 110 * easeIO((k - 0.2) / 0.08); }
    else if (k < 0.55) a.show = false;
    else if (k < 0.85) { a.dx += -480 * (1 - easeOut((k - 0.55) / 0.3)); a.yaw = YAW + 110 * (1 - easeIO((k - 0.7) / 0.15)); }
    for (const l of LEGS) addrot(a, l, 0, 25 * this.ls(t, 16));
  }
}
class Look extends Base { move(a, t) { addrot(a, 'head', -5, 38 * clamp(1.7 * this.ls(t, 1))); } }
class WaveLeg extends Base {
  move(a, t) { legmix(a, 'leg3', 1, [10 * this.ls(t, 6), 0, 30 * this.ls(t, 6)]); addrot(a, 'head', 0, -8, -6); }
}
class Clap extends Base {
  move(a, t) { const c = abs(this.ls(t, 6)); legmix(a, 'leg3', 0.85, [0, 0, 30 * c]); legmix(a, 'leg4', 0.85, [0, 0, -30 * c]); a.dy -= 4 * c; }
}
class Cheer extends Base {
  move(a, t) {
    const u = this.ls(t, 4);
    legmix(a, 'leg3', Math.max(0, u) * 1.1); legmix(a, 'leg4', Math.max(0, -u) * 1.1);
    a.dy -= 14 * abs(u); addrot(a, 'head', 10);
  }
}
class Belly extends Base {
  move(a, t) {
    a.pose.root = { rot: [0, 10 * this.ls(t, 1), 180], move: [0, 15, 0] };
    a.pose.head.rot = [0, 0, 0];
    for (const l of LEGS) addrot(a, l, 8 * this.ls(t, 2, l === 'leg1' ? 1 : 0));
    a.dy += 22 + 3 * this.ls(t, 2); a.dx += 10 * this.ls(t, 1);
  }
}
class Zoom extends Base {
  move(a, t) {
    const k = this.ph(t), z = k < 0.6 ? easeIO(k / 0.35) : 1 - easeIO((k - 0.6) / 0.3);
    a.zoom = 1 + 0.55 * z; a.dy -= 50 * z; addrot(a, 'head', -8 * z);
  }
}
class Tilt extends Base { move(a, t) { addrot(a, 'head', 6, 0, 20 * clamp(1.6 * this.ls(t, 1))); } }
class Shrink extends Base { move(a, t) { a.zoom = 0.6; a.dx += 1.5 * this.ls(t, 30); a.dy += 30 + 4 * this.ls(t, 2); } }
class Puff extends Base { move(a, t) { const p = 0.5 + 0.5 * this.ls(t, 2); a.sx = 1 + 0.14 * p; a.sy = 1 + 0.1 * p; a.dy -= 8 * p; } }
class Drift extends Base {
  move(a, t) { a.dx += 80 * this.ls(t, 1); a.roll = -7 * this.lc(t, 1); addrot(a, 'head', 0, -15 * this.lc(t, 1)); this.rippleDx = a.dx; }
}
class Headbang extends Base { move(a, t) { addrot(a, 'head', -30 * (0.5 + 0.5 * this.ls(t, 8))); a.dy += 4 * this.ls(t, 8); } }
class Roll extends Base {
  move(a, t) { const k = this.ph(t); a.pose.root = { rot: [8, 0, 360 * easeIO(k)], move: [0, 7 * bump(k), 0] }; a.dy += 10 * bump(k); }
}
class Stare extends Base { move(a) { a.zoom = 1.18; a.dy -= 26; a.pose.head.rot = [14, 0, 0]; } }
class Shy extends Base {
  move(a, t) {
    const k = 0.5 + 0.5 * this.ls(t, 1);
    addrot(a, 'head', -12, 36 * k); a.dy += 18 * k;
    for (const [g] of GILLS) addrot(a, g, -20 * k);
  }
}
class Think extends Base { move(a, t) { addrot(a, 'head', 12, -10, 14 + 3 * this.ls(t, 1)); legmix(a, 'leg3', 0.9, [25, 0, 25]); } }
class Boing extends Base {
  move(a, t) { const k = this.ph(t, 2), e = Math.exp(-k * 4) * sin(k * 2 * PI * 3); a.sy = 1 + 0.16 * e; a.sx = 1 - 0.1 * e; a.dy -= 30 * Math.max(0, e); }
}
class Faint extends Base {
  move(a, t) {
    const k = this.ph(t), f = k < 0.72 ? easeOutBack(k / 0.25, 1.1) : 1 - easeIO((k - 0.72) / 0.22);
    a.pose.root = { rot: [8 * (1 - f), 6 * this.ls(t, 1) * f, 180 * f], move: [0, 15 * f, 0] };
    a.dy += 22 * f; a.pose.head.rot = a.pose.head.rot.map((v) => v * (1 - f));
  }
}
class Run extends Base {
  move(a, t) {
    for (const [l, s] of [['leg1', 1], ['leg2', -1], ['leg3', -1], ['leg4', 1]]) addrot(a, l, -20 * abs(this.ls(t, 16)), 40 * s * this.ls(t, 16));
    a.dx += 3 * this.ls(t, 16); addrot(a, 'head', -8, -14); addrot(a, 'tail', 0, 30 * this.ls(t, 16));
  }
}
class Launch extends Base {
  setup() { this.splash(0.2 * this.T, 0, 22, 1.2); }
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.15) { a.dy += 20 * bump(k / 0.15); a.sy = 1 - 0.08 * bump(k / 0.15); }
    else if (k < 0.42) { a.dy -= 620 * easeIn((k - 0.15) / 0.27); addrot(a, 'root', 35); a.sy = 1.12; }
    else if (k < 0.6) a.show = false;
    else a.dy += 260 * (1 - easeOutBack((k - 0.6) / 0.3, 1.4));
    this._k = k;
  }
  drawBack(ctx, t) {
    const k = this._k || 0;
    if (k > 0.15 && k < 0.42 && this.LAST) {
      const e = rootM(this.A.pose).elements;
      const [x, y] = this.proj([e[12], e[13], e[14] + 0.6]);
      for (let j = 0; j < 4; j++) put(ctx, icon('flame', 7), x + 12 * sin(t * 40 + j), y + 30 + j * 26, 1 - j * 0.18, 180);
    }
  }
}
class Float extends Base {
  move(a, t) {
    a.pose.root = { rot: [0, 20 * this.ls(t, 1), 180], move: [0, 15, 0] };
    a.pose.head.rot = [0, 0, 0];
    for (const [l, s] of [['leg1', 1], ['leg2', -1], ['leg3', 1], ['leg4', -1]]) addrot(a, l, 0, 0, s * 30);
    a.dy += 24 + 3 * this.ls(t, 2);
  }
}
class Grow extends Base {
  move(a, t) { const k = this.ph(t, 2), g = k < 0.7 ? elastic(k / 0.4) : 1 - easeIO((k - 0.7) / 0.3); a.zoom = 1 + 0.35 * g; a.dy -= 40 * g; }
}

// ---------------- prop actions（自己拿道具，读 hold=） ----------------
class Prop extends Base { get holdsItself() { return true; } }
class Swing extends Prop {
  setup() { this.kind = this.spec.hold || 'pickaxe'; }
  move(a, t) {
    const k = this.ph(t, this.spec.n || 3), sw = k < 0.3 ? easeIn(k / 0.3) : 1 - easeOut((k - 0.3) / 0.7);
    this.hold(a, this.kind, { x: 5.4, y: 7.0, z: -12.5, rz: -40 + 110 * sw, s: 0.7 });
    addrot(a, 'head', -10 * sw, -6 * sw);
    this._hit = k;
  }
  drawFront(ctx) {
    if (!this.spec.debris || !(this._hit < 0.35) || !this.LAST) return;
    const u = clamp((this._hit - 0.25) / 0.1), [hx, hy] = this.headPt();
    for (let j = 0; j < 6; j++) {
      const ang = -PI / 2 + (j - 2.5) * 0.45, r = 20 + 60 * u;
      sq(ctx, hx + 110 + cos(ang) * r, hy + 40 + sin(ang) * r, 12 * (1 - u * 0.5), j % 2 ? [150, 150, 160] : [110, 110, 120], [60, 60, 70], 2);
    }
  }
}
class FlagWave extends Prop {
  move(a, t) {
    const n = this.spec.n || 4;
    this.hold(a, this.spec.hold || 'flag', { x: 5.2, y: 8.0, z: -12.6, rz: -5 + 28 * this.ls(t, n), s: this.spec.s ?? 0.7 });
    addrot(a, 'head', 0, -6 * this.ls(t, n)); a.dy -= 4 * abs(this.ls(t, n));
  }
}
class Offer extends Prop {
  move(a, t) {
    const kind = this.spec.hold || 'heart', p = Math.exp(-this.ph(t, 2) * 5);
    this.hold(a, kind, { x: 2.0, y: 10.5, z: -14.5, rz: -6, s: sprS(kind) * (1 + 0.18 * p) * (this.spec.s ?? 1), legs: 1.0 });
    legmix(a, 'leg3', 1.0); addrot(a, 'head', 8);
  }
}
class Chomp extends Prop {
  move(a, t) {
    const kind = this.spec.hold || 'cookie', k = this.ph(t), bites = Math.floor(k * 4);
    const s = (E.spr[kind] ? K.SPR_S * 1.4 : 1.0) * Math.max(0, 1 - bites * 0.22) * (this.spec.s ?? 1);
    const kk = mod(k * 4, 1), b = kk < 0.3 ? bump(kk / 0.3) : 0;
    addrot(a, 'head', 12 * b - 4);
    this.hold(a, kind, { x: 0.5, y: 6.4, z: -12.8 + 0.8 * b, rz: 0, s: Math.max(s, 0.001), legs: 1.0 });
  }
}
class Drink extends Prop {
  move(a, t) {
    const k = this.ph(t, 2), sip = k < 0.6 ? easeIO(bump(k / 0.6)) : 0;
    this.hold(a, this.spec.hold || 'boba', { x: lerp(4.8, 1.0, sip), y: lerp(5.5, 4.5, sip), z: -13.5, rz: lerp(-8, 20, sip), s: 0.9 });
    addrot(a, 'head', lerp(0, 18, sip));
  }
}
class Read extends Prop {
  move(a, t) {
    this.hold(a, this.spec.hold || 'book', { x: 4.6, y: 8.6, z: -13.2, ry: -35, rz: -8, s: this.spec.s ?? 1 });
    addrot(a, 'head', -6 + 2 * this.ls(t, 2), -16 + 6 * this.ls(t, 4));
  }
}
class Typing extends Prop {
  move(a, t) {
    this.wear(a, 'laptop', { at: 'root', x: 0, y: 6.0, z: -15.5, rx: -8, ry: 180, s: 0.9 }); a.dy -= 22;
    addrot(a, 'head', -14 + 4 * abs(this.ls(t, 12)));
    addrot(a, 'leg3', -60 - 15 * abs(this.ls(t, 12))); addrot(a, 'leg4', -60 - 15 * abs(this.ls(t, 12, 1.2)));
  }
}
class Scan extends Prop {
  move(a, t) {
    const u = this.ls(t, 2);
    this.hold(a, this.spec.hold || 'magnifier', { x: 1.5 + 4 * u, y: 6.0 + 1.0 * abs(u), z: -14.0, rz: -20 + 10 * u, s: 0.75 });
    addrot(a, 'head', -6, -18 * u);
  }
}
class Umbrella extends Prop {
  move(a, t) { this.hold(a, 'umbrella', { x: 2.5, y: 12.0, z: -9.0, rz: 8 + 4 * this.ls(t, 2), s: 0.95 }); }
}

// ---------------- second batch (motions2.py) ----------------
class Popup extends Base {
  setup() { this.splash(0.58 * this.T, 0, 8, 0.5, 50); this.splash(0.82 * this.T, 0, 24, 1.25); }
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.5) return;
    if (k < 0.6) { a.dy += 270 * easeIn((k - 0.5) / 0.1); addrot(a, 'root', -25 * ((k - 0.5) / 0.1)); }
    else if (k < 0.8) { a.dy += 300; a.show = false; }
    else {
      const u = (k - 0.8) / 0.2;
      if (u < 0.4) { a.dy += lerp(300, -60, easeOut(u / 0.4)); a.sy = 1.14; a.sx = 0.92; addrot(a, 'root', 20); }
      else {
        a.dy += -60 * (1 - easeOutBack((u - 0.4) / 0.6, 2.4));
        const b = bump((u - 0.4) / 0.25); a.sy = 1 - 0.08 * b; a.sx = 1 + 0.06 * b;
      }
    }
  }
}
class Slosh extends Base {
  setup() { for (let i = 0; i < 2; i++) this.splash((0.3 + i * 0.5) * this.T, 70, 16, 0.9, 40); }
  move(a, t) {
    const k = this.ph(t, 2), up = k < 0.24 ? easeOut(k / 0.24) : k < 0.3 ? 1 - easeIn((k - 0.24) / 0.06) : 0;
    addrot(a, 'tail', -55 * up + 18 * bump((k - 0.3) / 0.12), -15 * up);
    addrot(a, 'root', -8 * bump((k - 0.28) / 0.14)); a.dy += 6 * bump((k - 0.28) / 0.14);
  }
}
class SideHop extends Base {
  setup() { [[0, 50], [1, -50]].forEach(([i, x]) => this.splash((0.42 + i * 0.5) * this.T, x, 9, 0.55, 40)); }
  move(a, t) {
    const k = this.ph(t, 2), side = this.ph(t) < 0.5 ? 1 : -1;
    if (k < 0.42) {
      const u = k / 0.42;
      a.dx += lerp(-side * 50, side * 50, easeIO(u)); a.dy -= 72 * sin(PI * u);
      a.yaw = YAW + side * 38 * bump(u / 0.9); addrot(a, 'root', 12 * cos(PI * u));
    } else {
      const u = (k - 0.42) / 0.58, b = u < 0.3 ? bump(u / 0.3) : 0;
      a.dx += side * 50; a.sy = 1 - 0.08 * b; a.sx = 1 + 0.06 * b;
    }
  }
}
class Sway extends Base {
  move(a, t) { a.roll = 9 * this.ls(t, 1); a.dx += 12 * this.ls(t, 1); addrot(a, 'head', 0, 10 * this.ls(t, 1, PI / 2), -7 * this.ls(t, 1)); }
}
class Tantrum extends Base {
  setup() { for (let i = 0; i < 4; i++) this.splash((i + 0.2) * this.T / 4, [-50, 40, -20, 60][i], 6, 0.5, 40); }
  move(a, t) {
    a.roll = 15 * this.ls(t, 8); a.dx += 7 * this.ls(t, 8, 1.3); a.dy -= 6 * abs(this.ls(t, 8));
    for (const [l, s] of [['leg1', 1], ['leg2', -1], ['leg3', -1], ['leg4', 1]]) addrot(a, l, 0, 45 * s * this.ls(t, 16), 25 * this.ls(t, 16, 1));
    addrot(a, 'tail', 0, 45 * this.ls(t, 12)); addrot(a, 'head', -8, 20 * this.ls(t, 8, PI));
  }
}
class Petrify extends Base {
  move(a, t) {
    const k = this.ph(t), g = k < 0.8 ? clamp((k - 0.12) / 0.1) : 1 - clamp((k - 0.88) / 0.06);
    if (g > 0) {
      const f = new Ax(); this.idle(f, 0.12 * this.T); a.pose = f.pose; a.dy = f.dy;
      if (k >= 0.8 && k < 0.9) a.dx += 4 * this.ls(t, 30);
    }
    a.gray = g;
  }
}
class Melt extends Base {
  move(a, t) {
    const k = this.ph(t), m = k < 0.72 ? easeIO(k / 0.35) : 1 - elastic((k - 0.72) / 0.28);
    a.sy = 1 - 0.4 * m; a.sx = 1 + 0.32 * m; a.dy += 38 * m; addrot(a, 'head', -15 * m);
    for (const [g] of GILLS) addrot(a, g, -35 * m);
  }
}
class Stretch extends Base {
  move(a, t) {
    const k = this.ph(t), s = k < 0.6 ? easeIO(bump(k / 0.6)) : 0;
    a.sy = 1 + 0.2 * s; a.sx = 1 - 0.08 * s; a.dy -= 28 * s; addrot(a, 'head', 28 * s);
    legmix(a, 'leg3', 0.9 * s); legmix(a, 'leg4', 0.9 * s);
    if (s > 0.35) a.pose._face = { L: 'squeeze', R: 'squeeze', mouth: 'shout' };
  }
}
class LookUp extends Base {
  move(a, t) { addrot(a, 'head', 24 + 6 * this.ls(t, 1), 10 * this.ls(t, 1, 1)); addrot(a, 'root', 8); a.dy -= 6; }
}
class TurnAway extends Base {
  move(a, t) {
    const k = this.ph(t);
    const tw = k < 0.12 ? 0 : k < 0.72 ? easeOutBack((k - 0.12) / 0.16, 1.4) : 1 - easeIO((k - 0.72) / 0.16);
    a.yaw = YAW + 130 * tw;
    if (k > 0.42 && k < 0.58) addrot(a, 'head', 0, -55 * bump((k - 0.42) / 0.16));
    addrot(a, 'head', 12 * tw);
  }
}
class Glitch extends Base {
  move(a, t) {
    const step = Math.floor(Math.round(t * FPS) / 3), r = rng(step * 7919 + (this.spec.seed || 0));
    const f = new Ax(); this.idle(f, step * 3 / FPS); a.pose = f.pose; a.dy = f.dy;
    if (step % Math.max(1, Math.floor(this.N / 3)) && r.random() < 0.55) {
      a.dx += r.choice([-26, -14, 14, 26]); a.dy += r.choice([-10, 0, 10]); a.rgb = r.choice([0, 5, 8]);
    }
    this.rippleOn = false;
  }
}
class Squish extends Base {
  move(a, t) {
    const k = this.ph(t); this._k = k;
    if (k >= 0.3 && k < 0.55) { a.sy = 0.62; a.sx = 1.3; a.dy += 36; }
    else if (k >= 0.55 && k < 0.8) { const e = elastic((k - 0.55) / 0.25); a.sy = lerp(0.62, 1, e); a.sx = lerp(1.3, 1, e); a.dy += lerp(36, 0, e); }
    if (k >= 0.3 && k < 0.55) a.pose._face = { L: 'squeeze', R: 'squeeze', mouth: 'flat' };
  }
  drawTop(ctx) {
    const k = this._k;
    if (!this.LAST || !(k > 0.08 && k < 0.75)) return;
    const [hx, hy] = this.headPt([0, 9.5, -7.5]);
    let x = hx, y = hy - 26, r = 0;
    if (k < 0.3) y = lerp(-80, hy - 26, easeIn((k - 0.08) / 0.22));
    else if (k >= 0.55) { const u = (k - 0.55) / 0.2; x = hx + 260 * u; y = hy - 26 - 160 * u + 300 * u * u; r = -200 * u; }
    put(ctx, icon('stone', 8), x, y, 1, r);
    if (k >= 0.3 && k < 0.38) {
      for (let j = 0; j < 6; j++) {
        const ang = (200 + j * 28) * PI / 180, r0 = 50 + 120 * (k - 0.3);
        line(ctx, [[hx + cos(ang) * r0, hy - 20 + sin(ang) * r0 * 0.6], [hx + cos(ang) * (r0 + 18), hy - 20 + sin(ang) * (r0 + 18) * 0.6]], [90, 90, 100], 4);
      }
    }
  }
}
class SlideIn extends Base {
  setup() { this.splash(0.93 * this.T, -30, 14, 0.7, 40); }
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.58) return;
    if (k < 0.7) { const u = (k - 0.58) / 0.12; a.dx += 480 * easeIn(u); a.yaw = YAW + 110 * easeIO(u / 0.5); }
    else if (k < 0.76) a.show = false;
    else {
      const u = (k - 0.76) / 0.24;
      a.dx += -480 * (1 - easeOut(u / 0.7)); a.yaw = YAW + 110 * (1 - easeIO((u - 0.7) / 0.3));
      a.roll = -14 * bump((u - 0.55) / 0.35);
      for (const l of LEGS) addrot(a, l, 0, 30 * this.ls(t, 16));
    }
  }
}
class Buoy extends Base {
  move(a, t) { a.dy += 20 * this.ls(t, 1); a.roll = 7 * this.ls(t, 1, PI / 2); addrot(a, 'root', 6 * this.ls(t, 1, PI / 2)); }
}
class Approach extends Base {
  get coverK() { return 0.6; }
  move(a, t) {
    const k = this.ph(t), z = k < 0.42 ? easeOut(k / 0.42) : k < 0.8 ? 1 : 1 - easeIn((k - 0.8) / 0.2);
    a.zoom = 0.38 + 0.62 * z; a.dy -= 52 * (1 - z); a.dx += 60 * (1 - z);
    if (k >= 0.8) a.yaw = YAW + 150 * easeIO((k - 0.8) / 0.08);
    const swim = k >= 0.42 && k < 0.8 ? 0 : 1;
    for (const l of LEGS) addrot(a, l, 0, 25 * this.ls(t, 12) * swim);
  }
}
class Hiccup extends Base {
  move(a, t) {
    const k = this.ph(t, 2);
    if (k < 0.16) {
      const b = bump(k / 0.16); a.dy -= 26 * b; a.sy = 1 + 0.1 * b; a.sx = 1 - 0.05 * b;
      a.pose._face = { L: 'big', R: 'big', mouth: 'o' };
    }
    this._k = k;
  }
  drawTop(ctx) {
    if (!this.LAST || !(this._k > 0.02 && this._k < 0.5)) return;
    const [hx, hy] = this.headPt([0, 9, -7.5]), u = (this._k - 0.02) / 0.48;
    put(ctx, icon('hic', 5), hx + 60 + 20 * u, hy - 40 - 70 * u, 0.6 + 0.6 * u, 0, clamp((1 - u) / 0.3));
  }
}
class Kowtow extends Base {
  setup() { for (let i = 0; i < 4; i++) this.splash((i + 0.27) * this.T / 4, -70, 5, 0.35, 25); }
  move(a, t) {
    const k = this.ph(t, 4), b = k < 0.55 ? easeIO(bump(k / 0.55)) : 0;
    addrot(a, 'head', -55 * b); addrot(a, 'root', -24 * b); a.dy += 30 * b;
  }
}
class FlipOver extends Base {
  setup() { this.splash(0.42 * this.T, 0, 12, 0.7); this.splash(0.9 * this.T, 0, 12, 0.7); }
  move(a, t) {
    const k = this.ph(t);
    const r = k < 0.3 ? 0 : k < 0.45 ? 180 * easeOutBack((k - 0.3) / 0.15, 1.2) : k < 0.75 ? 180 : k < 0.92 ? 180 + 180 * easeIO((k - 0.75) / 0.17) : 360;
    const h = sin(r / 2 * PI / 180) ** 2;
    a.pose.root = { rot: [8 * cos(r * PI / 180), 0, r], move: [0, 15 * h, 0] };
    a.dy += 22 * h;
    if (k >= 0.45 && k < 0.75) for (const l of LEGS) addrot(a, l, 20 * this.ls(t, 8, l === 'leg2' ? 1 : 0));
  }
}
class Wobble extends Base {
  move(a, t) {
    const k = this.ph(t, 2), e = Math.exp(-k * 4.5) * sin(k * 2 * PI * 3.5);
    a.sx = 1 + 0.2 * e; a.sy = 1 - 0.18 * e; a.roll = 9 * e; a.dy += 10 * e;
  }
}
class ShakeOff extends Base {
  move(a, t) {
    const s = win(this.ph(t), 0.15, 0.6, 0.06); this._s = s;
    a.roll = 20 * s * this.ls(t, 22); addrot(a, 'head', 0, 25 * s * this.ls(t, 22, 1)); a.dy -= 10 * s;
    if (s > 0.5) a.pose._face = { L: 'squeeze', R: 'squeeze', mouth: 'w' };
  }
  drawFront(ctx, t) {
    if (!(this._s >= 0.2) || !this.LAST) return;
    const [hx, hy] = this.headPt([0, 6, 0]);
    for (let j = 0; j < 10; j++) {
      const u = mod(t / this.T * 6 + j / 10, 1), ang = 2 * PI * j / 10 + 0.4;
      sq(ctx, hx + cos(ang) * (40 + 120 * u), hy + sin(ang) * (30 + 70 * u) + 60 * u * u, 10 * (1 - u) + 3, [150, 215, 255], [90, 170, 235]);
    }
  }
}
class Pounce extends Base {
  move(a, t) {
    const k = this.ph(t);
    if (k < 0.22) { const c = bump(k / 0.22); a.dy += 14 * c; a.sy = 1 - 0.07 * c; }
    else if (k < 0.36) { const u = easeOut((k - 0.22) / 0.14); a.zoom = 1 + 0.45 * u; a.dy -= 46 * u; addrot(a, 'root', 15); }
    else if (k < 0.62) { a.zoom = 1.45 + 0.02 * this.ls(t, 8); a.dy -= 46; }
    else { const u = easeIO((k - 0.62) / 0.25); a.zoom = 1.45 - 0.45 * u; a.dy -= 46 * (1 - u); }
  }
}
class Nuzzle extends Base {
  move(a, t) {
    a.roll = 7 * this.ls(t, 4); addrot(a, 'head', 0, 12 * this.ls(t, 4), 10 * this.ls(t, 4, PI));
    a.dx += 6 * this.ls(t, 4); a.dy -= 4 * abs(this.ls(t, 4));
  }
}
class Circle extends Base {
  move(a, t) {
    const ang = 2 * PI * this.ph(t) + PI / 2;
    a.dx += 75 * cos(ang); a.dy += 14 * sin(ang); a.zoom = 1 + 0.1 * sin(ang);
    a.yaw = 270 - (ang + PI / 2) * 180 / PI;
    for (const l of LEGS) addrot(a, l, 0, 25 * this.ls(t, 12, l === 'leg1' || l === 'leg4' ? 1 : 0));
    addrot(a, 'tail', 0, 25 * this.ls(t, 6)); this.rippleDx = a.dx;
  }
}
class HeadBob extends Base {
  move(a, t) {
    addrot(a, 'head', 4 * abs(this.ls(t, 8)), 0, 15 * this.ls(t, 4)); a.roll = 4 * this.ls(t, 4); a.dy -= 5 * abs(this.ls(t, 8));
  }
}
class Hide extends Base {
  move(a, t) {
    const k = this.ph(t), h = k < 0.25 ? 0 : k < 0.78 ? easeIO((k - 0.25) / 0.15) : 1 - easeOutBack((k - 0.78) / 0.18, 1.3);
    a.dy += 60 * h; addrot(a, 'head', -6 * h, 24 * h * clamp(1.8 * this.ls(t, 2), -1, 1));
  }
}
class Rise extends Base {
  get coverK() { return 0.42; }
  move(a, t) {
    const k = this.ph(t), r = k < 0.75 ? easeOutBack(k / 0.28, 1.6) : 1 - easeIO((k - 0.75) / 0.25);
    a.dy -= 48 * r; addrot(a, 'head', 16 * r); addrot(a, 'root', 8 * r); a.sy = 1 + 0.04 * r;
  }
}
class Recoil extends Base {
  move(a, t) {
    const k = this.ph(t), r = k < 0.12 ? 0 : k < 0.78 ? easeOutBack((k - 0.12) / 0.12, 2.5) : 1 - easeIO((k - 0.78) / 0.18);
    a.zoom = 1 - 0.2 * r; a.dy -= 30 * r; a.dx += 2.5 * r * this.ls(t, 30); addrot(a, 'head', 14 * r);
    if (k > 0.12 && k < 0.3) a.pose._face = { L: 'big', R: 'big', mouth: 'shout' };
  }
}
class Bonk extends Base {
  move(a, t) {
    const k = this.ph(t, 2); this._k = k;
    if (k < 0.3) { a.zoom = 1 + 0.3 * easeIn(k / 0.3); a.dy -= 25 * easeIn(k / 0.3); }
    else if (k < 0.42) { a.zoom = 1.3; a.dy -= 25; const b = bump((k - 0.3) / 0.12); a.sx = 1 + 0.14 * b; a.sy = 1 - 0.1 * b; }
    else { const u = easeOut((k - 0.42) / 0.4); a.zoom = 1.3 - 0.3 * u; a.dy -= 25 * (1 - u); }
    if (k >= 0.3 && k < 0.6) a.pose._face = { L: 'squeeze', R: 'squeeze', mouth: 'wavy' };
  }
  drawTop(ctx) {
    if (!this.LAST || !(this._k >= 0.3 && this._k < 0.62)) return;
    const [hx, hy] = this.headPt(), u = (this._k - 0.3) / 0.32;
    for (let j = 0; j < 3; j++) {
      const a_ = 2 * PI * (u + j / 3);
      star(ctx, hx + 70 * cos(a_), hy - 60 + 14 * sin(a_), 12 * (1 - u * 0.5), [255, 214, 64]);
    }
  }
}

export const MOTIONS = {
  idle: Idle, nod: Nod, shake: Shake, hop: Hop, jump: Jump, spin: Spin, sink: Sink, peek: Peek,
  tremble: Tremble, rage: Rage, dance: Dance, wag: Wag, bow: Bow, doze: Doze, flop: Flop,
  dash: Dash, look: Look, wave: WaveLeg, clap: Clap, cheer: Cheer, belly: Belly, zoom: Zoom,
  tilt: Tilt, shrink: Shrink, puff: Puff, drift: Drift, headbang: Headbang, roll: Roll, stare: Stare,
  shy: Shy, think: Think, boing: Boing, faint: Faint, run: Run, launch: Launch, float: Float,
  grow: Grow, swing: Swing, flagwave: FlagWave, offer: Offer, chomp: Chomp, drink: Drink, read: Read,
  typing: Typing, scan: Scan, umbrella: Umbrella,
  popup: Popup, slosh: Slosh, sidehop: SideHop, sway: Sway, tantrum: Tantrum, petrify: Petrify, melt: Melt,
  stretch: Stretch, lookup: LookUp, turnaway: TurnAway, glitch: Glitch, squish: Squish, slidein: SlideIn,
  buoy: Buoy, approach: Approach, hiccup: Hiccup, kowtow: Kowtow, flipover: FlipOver, wobble: Wobble,
  shakeoff: ShakeOff, pounce: Pounce, nuzzle: Nuzzle, circle: Circle, headbob: HeadBob, hide: Hide,
  rise: Rise, recoil: Recoil, bonk: Bonk, flip: Flip,
};

export function makeSticker(spec, renderer) {
  const M = MOTIONS[spec.motion] || Idle;
  return new M(spec, renderer);
}
