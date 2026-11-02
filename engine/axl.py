"""Axolotl sticker engine: stage (water, text, FX), axolotl rendering and GIF export on top of the kit renderer."""
import os, sys, json, math, random, subprocess, shutil, copy
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'kit', 'src'))
sys.path.insert(0, HERE)
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import rig2, face_cam, items

rig2.PERSP = 0.15
FONT_PATH = os.path.join(ROOT, 'kit', 'fonts', 'NotoSansSC.ttf')
REST = json.load(open(os.path.join(ROOT, 'kit', 'src', 'rest_pose.json')))
W = H = 512
FPS = 15
YAW, PITCH = 160, 28
U = 1 / 16
REF, BOX = 340, 480                       # kit framing box / our (roomier) render box, same pixel scale
BOX_CX, BOX_CY = W / 2 + 6, 200 + REF / 2  # where the kit put the centre of its box
WATER_Y = 405

rig2.render(REST, yaw=YAW, pitch=PITCH, size=64, ss=1)
_C0, CEN, SCL, _ = rig2.LAST
ANCHOR = np.array([0, 6, 0]) * U
def _scr(C, p): return rig2._proj((C @ p)[None])[0][:2]
ANCHOR_OFF = _scr(_C0, ANCHOR) - CEN
SCL_BOX = SCL * REF / BOX

# ---------------- math ----------------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def lerp(a, b, k): return a + (b - a) * k
def ease_out(t): t = clamp(t); return 1 - (1 - t) ** 3
def ease_in(t): t = clamp(t); return t ** 3
def ease_io(t): t = clamp(t); return t * t * (3 - 2 * t)
def ease_out_back(t, s=1.9): t = clamp(t) - 1; return 1 + (s + 1) * t ** 3 + s * t ** 2
def elastic(t):
    t = clamp(t)
    if t in (0, 1): return t
    return 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * 2 * math.pi / 3) + 1
def bump(t): return math.sin(math.pi * clamp(t))          # 0 -> 1 -> 0
def window(t, a, b, fade=0.15):                           # 1 inside [a,b] with soft edges
    return clamp((t - a) / fade) * clamp((b - t) / fade)

# ---------------- fonts / text ----------------
_FONTS = {}
def font(sz, w='Black'):
    k = (sz, w)
    if k not in _FONTS:
        f = ImageFont.truetype(FONT_PATH, sz); f.set_variation_by_name(w); _FONTS[k] = f
    return _FONTS[k]

STYLES = {   # outer stroke, deep stroke, extrusion, top tint
    'pink':   ((254, 62, 140), (196, 22, 96), (110, 20, 70), (255, 214, 234)),
    'blue':   ((64, 152, 255), (26, 98, 205), (16, 52, 122), (214, 234, 255)),
    'purple': ((158, 102, 255), (104, 56, 204), (54, 26, 112), (232, 220, 255)),
    'red':    ((255, 84, 52), (206, 30, 30), (112, 14, 20), (255, 222, 210)),
    'green':  ((36, 198, 108), (12, 140, 72), (8, 76, 40), (212, 250, 226)),
    'gold':   ((255, 172, 28), (216, 108, 0), (122, 56, 0), (255, 240, 200)),
    'gray':   ((150, 152, 168), (96, 98, 114), (50, 52, 62), (236, 236, 242)),
    'cyan':   ((24, 196, 214), (8, 136, 160), (4, 72, 90), (210, 248, 252)),
}

_SPR = {}
def char_sprite(c, ch, style='pink'):
    k = (c, ch, style)
    if k in _SPR: return _SPR[k]
    HOT, DEEP, PLUM, TINT = STYLES[style]
    f = font(ch)
    s1, s2 = max(6, round(ch * 0.134)), max(4, round(ch * 0.09))
    dep = max(4, round(ch * 0.08))
    pad = int(ch * 0.36)
    sz = ch + 2 * pad
    im = Image.new('RGBA', (sz, sz + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = sz / 2, sz / 2
    for k2 in range(dep, 0, -1):
        d.text((cx + k2 * 0.6, cy + k2), c, font=f, anchor='mm', fill=PLUM, stroke_width=s1, stroke_fill=PLUM)
    d.text((cx, cy), c, font=f, anchor='mm', fill=DEEP, stroke_width=s1, stroke_fill=DEEP)
    d.text((cx, cy), c, font=f, anchor='mm', fill=HOT, stroke_width=s2, stroke_fill=HOT)
    d.text((cx, cy), c, font=f, anchor='mm', fill=(255, 255, 255))
    gl = Image.new('L', im.size, 0); ImageDraw.Draw(gl).text((cx, cy), c, font=f, anchor='mm', fill=255)
    grad = Image.linear_gradient('L').resize(im.size)
    tint = Image.new('RGBA', im.size, TINT + (255,))
    mask = Image.fromarray((np.asarray(gl) * (np.asarray(grad) / 255.0) * 0.75).astype(np.uint8))
    im.paste(tint, (0, 0), mask)
    _SPR[k] = im
    return im

def is_wide(c): return ord(c) > 0x2E80
def _units(line):                      # width in "CJK char" units
    f = font(100)
    return sum(1.0 if is_wide(c) else (f.getlength(c) + 14) / 100 for c in line)
def _size(u):
    xs, ys = (1, 2, 3, 4, 5, 6), (190, 160, 138, 112, 92, 80)
    u = max(1, min(6, u))
    for i in range(5):
        if u <= xs[i + 1]: return ys[i] + (ys[i + 1] - ys[i]) * (u - xs[i])
    return ys[-1]
def layout(text, y0=118):
    """returns [(char, x, y, size)] for 1 or 2 lines."""
    lines = text.split('/') if '/' in text else [text]
    if len(lines) == 1 and _units(text) > 5.3:
        best = min(range(1, len(text)), key=lambda k: abs(_units(text[:k]) - _units(text[k:])) +
                   (9 if text[k - 1].isascii() and text[k].isascii() else 0))
        lines = [text[:best], text[best:]]
    ch = _size(max(_units(l) for l in lines))
    if len(lines) == 2: ch = min(ch, 104)
    f = font(int(ch))
    out = []
    for li, line in enumerate(lines):
        adv = [ch + 2 if is_wide(c) else f.getlength(c) + ch * 0.14 for c in line]
        tot = sum(adv); x = W / 2 - tot / 2
        y = y0 if len(lines) == 1 else (y0 - 52 + li * (ch + 18))
        for c, a in zip(line, adv):
            out.append((c, x + a / 2, y, int(ch))); x += a
    return out

# ---------------- 2D pixel icons ----------------
ICON = {
 'heart': items.SPR['heart'],
 'question': (['.qqqq.', 'qq..qq', '....qq', '...qq.', '..qq..', '......', '..qq..'], {'q': 'ff3e8c'}),
 'exclaim': (['qq', 'qq', 'qq', 'qq', '..', 'qq'], {'q': 'ff3b4e'}),
 'note': items.SPR['note'], 'note2': (['.kkkkk', '.k...k', '.k...k', 'kk..kk', 'kk..kk'], {'k': '6d63ff'}),
 'star': items.SPR['star'], 'bulb': items.SPR['bulb'], 'snow': items.SPR['snowflake'], 'money': items.SPR['money'],
 'anger': (['.rr.rr.', 'r..r..r', 'r.....r', '.r...r.', 'r.....r', 'r..r..r', '.rr.rr.'], {'r': 'ff2e3e'}),
 'sweat': (['..b..', '.bb..', '.bWb.', 'bbWbb', 'bbbbb', '.bbb.'], {'b': '6cc4ff', 'W': 'e8f7ff'}),
 'drop': (['.b.', 'bbb', 'bWb', '.b.'], {'b': '6cc4ff', 'W': 'e8f7ff'}),
 'cloud': (['....wwww....', '..wwwwwwww..', '.wwwwwwwwwww', 'wwwwwwwwwwww', 'wwwwwwwwwwww', '.gggggggggg.'], {'w': 'f2f4f8', 'g': 'c8cdd8'}),
 'dark': (['....wwww....', '..wwwwwwww..', '.wwwwwwwwwww', 'wwwwwwwwwwww', 'wwwwwwwwwwww', '.gggggggggg.'], {'w': '8a8fa0', 'g': '6a6f80'}),
 'flame': (['...o...', '..oo...', '..ooo..', '.ooyoo.', '.oyyyo.', 'ooyWyoo', '.oyyyo.'], {'o': 'ff5a1f', 'y': 'ffc83a', 'W': 'fff6c0'}),
 'ghost': (['.wwww.', 'wwwwww', 'wkwwkw', 'wwwwww', 'wwwwww', 'w.ww.w'], {'w': 'f4f6ff', 'k': '3a3e4c'}),
 'bolt': (['...yy', '..yy.', '.yyyy', '...yy', '..yy.', '.yy..', 'yy...'], {'y': 'ffd23a'}),
 'check': (['.......g', '......gg', 'g....gg.', 'gg..gg..', '.gggg...', '..gg....'], {'g': '1fc46a'}),
 'cross': (['rr...rr', '.rr.rr.', '..rrr..', '.rr.rr.', 'rr...rr'], {'r': 'ff3b4e'}),
 'plus1': (['..p..p.', '..p.pp.', 'ppppp.p', '..p...p', '..p...p'], {'p': 'ff3e8c'}),
 'z': (['zzzz', '..z.', '.z..', 'zzzz'], {'z': '7d73ff'}),
 'spark': (['..w..', '..w..', 'wwyww', '..w..', '..w..'], {'w': 'fff6c0', 'y': 'ffd23a'}),
 'skull': (['.wwww.', 'wwwwww', 'wkwwkw', 'wwwwww', '.wkwk.'], {'w': 'f2f2f2', 'k': '2a2a2a'}),
 'swirl': (['.ppp.', 'p...p', 'p.p.p', 'p.pp.', '.p...'], {'p': '8a5cff'}),
 'thumb': (['...yy...', '...yy...', '..yyy...', 'yyyyyyy.', 'yyyyyyyy', 'yyyyyyy.', 'yyyyyy..'], {'y': 'ffcc4a'}),
 'diamond': items.SPR['diamond'], 'fish': items.SPR['fish'], 'flower': items.SPR['flower'], 'cookie': items.SPR['cookie'],
 'bug': items.SPR['bug'], 'gift': items.SPR['gift'], 'apple': items.SPR['apple'], 'mail': items.SPR['mail'],
 'clock': items.SPR['clock'], 'bone': items.SPR['bone'], 'key': items.SPR['key'],
 'leaf': (['...gg', '..ggg', '.gGg.', 'gGg..', 'g....'], {'g': '3cb043', 'G': '8ce08a'}),
 'confetti': (['c'], {'c': 'ffffff'}),
 'moon': (['..yyy.', '.yy...', 'yy....', 'yy....', 'yy....', '.yy...', '..yyy.'], {'y': 'ffd23a'}),
 'sun': (['..y..y..', 'y..yy..y', '..yyyy..', '.yyyyyy.', '.yyyyyy.', '..yyyy..', 'y..yy..y', '..y..y..'], {'y': 'ffc83a'}),
 'brokenheart': (['.RR.RR.', 'RRR.RRR', 'RRR.RRR', '.RR.RR.', '..R.R..', '...R...'], {'R': 'ff2f6d'}),
 'pin': (['.rrr.', 'rrWrr', 'rrrrr', '.rrr.', '..k..', '..k..'], {'r': 'ff3b4e', 'W': 'ffc0c0', 'k': '6c707a'}),
 'dots': (['k.k.k'], {'k': '6c707a'}),
 'wave': (['.b..b..b', 'b.bb.bb.'], {'b': '6cc4ff'}),
 'arrow': (['..g..', '.ggg.', 'ggggg', '.ggg.', '.ggg.', '.ggg.'], {'g': '1fc46a'}),
 'lemon': (['...g..', '.yyyy.', 'yyWyyy', 'yyyyyy', '.yyyy.'], {'y': 'ffe14a', 'W': 'fff8c0', 'g': '3cb043'}),
 'stone': (['dGGGGGGd', 'GgggggGd', 'GggdggGd', 'GgggggGd', 'GggggdGd', 'GgdgggGd', 'GgggggGd', 'dddddddd'], {'G': 'b4b8c2', 'g': '9a9ea8', 'd': '6c707a'}),
 'hic': (['.wwww.', 'w....w', 'w....w', 'w....w', '.wwww.'], {'w': '7cc8ff'}),
 'creeper': (['gggggggg', 'gGgggGgg', 'gkkggkkg', 'gkkggkkg', 'gggkkggg', 'ggkkkkgg', 'ggkkkkgg', 'ggkggkgg'],
             {'g': '5fcf4a', 'G': '8be07a', 'k': '1f3a1f'}),
}

def _darker(c, k=0.55): return tuple(int(v * k) for v in c)
_ICONS = {}
def icon(name, k=5, outline=True, tint=None):
    key = (name, k, outline, tint)
    if key in _ICONS: return _ICONS[key]
    rows, pal = ICON[name] if name in ICON else items.SPR[name]
    h = len(rows); w = max(len(r) for r in rows)
    a = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0)); px = a.load()
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c not in '. ':
                col = rig2.hx(tint) if tint else rig2.hx(pal[c])
                px[x + 1, y + 1] = col + (255,)
    if outline:
        o = Image.new('RGBA', a.size, (0, 0, 0, 0)); po = o.load()
        base = rig2.hx(tint or list(pal.values())[0])
        dk = _darker(base, 0.5) + (255,)
        for y in range(a.height):
            for x in range(a.width):
                if px[x, y][3]: continue
                if any(0 <= x + dx < a.width and 0 <= y + dy < a.height and px[x + dx, y + dy][3]
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    po[x, y] = dk
        o.alpha_composite(a); a = o
    a = a.resize((a.width * k, a.height * k), Image.NEAREST)
    _ICONS[key] = a
    return a

def put(img, im, x, y, sc=1.0, rot=0.0, alpha=1.0):
    if sc <= 0.02 or alpha <= 0.02: return
    if sc != 1: im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.NEAREST)
    if rot: im = im.rotate(rot, Image.NEAREST, expand=True)
    if alpha < 1:
        im = im.copy(); a = np.asarray(im.getchannel('A')).astype(float) * alpha
        im.putalpha(Image.fromarray(a.astype(np.uint8)))
    img.alpha_composite(im, (int(x - im.width / 2), int(y - im.height / 2)))

def star(d, x, y, r, col, a=255):
    pts = []
    for k in range(8):
        ang = k * math.pi / 4 - math.pi / 2
        rr = r if k % 2 == 0 else r * 0.28
        pts.append((x + rr * math.cos(ang), y + rr * math.sin(ang)))
    d.polygon(pts, fill=tuple(col) + (int(a),))

def sq(d, x, y, s, fill, outline=None, w=2):
    d.rectangle((x - s / 2, y - s / 2, x + s / 2, y + s / 2), fill=fill, outline=outline, width=w)

# ---------------- axolotl state ----------------
def base_pose():
    return copy.deepcopy(REST)

class Ax:
    def __init__(self):
        self.pose = base_pose(); self.yaw = YAW; self.pitch = PITCH
        self.dx = 0.0; self.dy = 0.0; self.sx = 1.0; self.sy = 1.0; self.roll = 0.0; self.zoom = 1.0
        self.show = True; self.alpha = 1.0
        self.gray = 0.0; self.rgb = 0     # stone tint 0..1 / RGB-split glitch offset px

def render_ax(a, ss=2):
    C = rig2.camera(a.yaw, a.pitch)
    center = _scr(C, ANCHOR) - ANCHOR_OFF / a.zoom
    im = rig2.render(a.pose, yaw=a.yaw, pitch=a.pitch, size=BOX, ss=ss, center=center, scale=SCL_BOX * a.zoom)
    return im, rig2.LAST

def _affine(a):
    """box px -> canvas px as (M 2x2, offset)."""
    r = math.radians(-a.roll)
    R = np.array([[math.cos(r), -math.sin(r)], [math.sin(r), math.cos(r)]])
    Mx = R @ np.diag([a.sx, a.sy])
    off = np.array([BOX_CX + a.dx, BOX_CY + a.dy]) - Mx @ np.array([BOX / 2, BOX / 2])
    return Mx, off

def place(im, a):
    Mx, off = _affine(a)
    if abs(a.sx - 1) < 1e-3 and abs(a.sy - 1) < 1e-3 and abs(a.roll) < 0.05:
        L = Image.new('RGBA', (W, H), (0, 0, 0, 0)); L.alpha_composite(im, (int(round(off[0])), int(round(off[1]))))
    else:
        inv = np.linalg.inv(Mx); o = -inv @ off
        L = im.convert('RGBa').transform((W, H), Image.AFFINE, (inv[0, 0], inv[0, 1], o[0], inv[1, 0], inv[1, 1], o[1]),
                                          resample=Image.BICUBIC).convert('RGBA')
    if a.alpha < 1:
        al = np.asarray(L.getchannel('A')).astype(float) * a.alpha; L.putalpha(Image.fromarray(al.astype(np.uint8)))
    return L

# ---------------- sticker ----------------
class Sticker:
    T = 3.2
    water = True
    calm = 1.0
    text_y = 118
    cover_t = None

    def __init__(self, spec):
        self.spec = spec
        self.text = spec.get('text', '')
        self.style = spec.get('style', 'pink')
        self.tmode = spec.get('tmode', 'stay')
        self.T = spec.get('T', self.T)
        self.text_y = spec.get('text_y', self.text_y)
        self.rng = random.Random(spec.get('seed', hash(self.text) & 0xffff))
        self.N = int(round(self.T * FPS))
        self.splashes = []            # (t0, x, n, power)
        self.droplets = []
        self.fx = []
        self.bubbles = [dict(x=self.rng.uniform(150, 360), ph=self.rng.random(), sp=self.rng.uniform(90, 150),
                             s=self.rng.choice((6, 8, 10))) for _ in range(8)]
        self.twk = [dict(x=self.rng.uniform(30, 482), y=self.rng.uniform(200, 330), ph=self.rng.uniform(0, 6.28),
                         r=self.rng.uniform(6, 10), c=self.rng.choice(((255, 205, 60), (255, 140, 190), (130, 210, 255))))
                    for _ in range(6)]
        self.lay = layout(self.text, self.text_y) if self.text else []
        self.LAST = None; self.A = None; self.ax_layer = None

    # ---- loop helpers ----
    def ls(self, t, n, ph=0.0): return math.sin(2 * math.pi * n * t / self.T + ph)
    def lc(self, t, n, ph=0.0): return math.cos(2 * math.pi * n * t / self.T + ph)
    def ph(self, t, n=1, off=0.0): return (t * n / self.T + off) % 1.0

    def splash(self, t0, x=0, n=18, power=1.0, spread=90):
        rng = random.Random(int(t0 * 1000) + int(x) * 7 + n)
        for _ in range(n):
            ang = rng.uniform(math.radians(200), math.radians(340))
            sp = rng.uniform(140, 330) * power
            self.droplets.append(dict(t0=t0, x=W / 2 + x + rng.uniform(-spread, spread), vx=math.cos(ang) * sp * 0.7,
                                      vy=math.sin(ang) * sp, s=rng.choice((7, 9, 11, 13)),
                                      c=rng.choice(((150, 215, 255), (200, 236, 255), (255, 255, 255)))))

    # ---- to override ----
    def motion(self, t):
        a = Ax(); self.idle(a, t); return a

    def idle(self, a, t, look=20, gill=1.0, tail=1.0, paddle=1.0, bob=4):
        p = a.pose
        p['head'] = {'rot': (look + 3 * self.ls(t, 4), 4 * self.ls(t, 2), 0)}
        gw = 8 + 12 * gill * self.ls(t, 6)
        p['left_gills'] = {'rot': (0, gw, 0)}; p['right_gills'] = {'rot': (0, -gw, 0)}
        p['top_gills'] = {'rot': (-0.6 * gw, 0, 0)}
        p['tail'] = {'rot': (-18, 18 * tail * self.ls(t, 3), 0)}
        p['root'] = {'rot': (8, 0, 0)}
        for k, s in (('leg3', 1), ('leg4', -1), ('leg1', -1), ('leg2', 1)):
            p[k]['rot'] = (0, s * 10 * paddle * self.ls(t, 4, k in ('leg1', 'leg2')), 0)
        a.dy = bob * self.ls(t, 2)
        return a

    def face(self, a, **f):
        a.pose['_face'] = f

    def hold(self, a, kind, x=4.8, y=7.4, z=-13.0, rz=-10, s=1.0, legs=1.0, **kw):
        it = dict(kind=kind, x=x, y=y, z=z, rz=rz, s=s); it.update(kw)
        a.pose.setdefault('_items', []).append(it)
        if legs:
            for k in ('leg3', 'leg4'):
                r = a.pose[k].get('rot', (0, 0, 0)); a.pose[k]['rot'] = (r[0] - 35 * legs, r[1] * (1 - legs), r[2])
        return it

    def wear(self, a, kind, **kw):
        it = dict(kind=kind); it.update(kw)
        a.pose.setdefault('_items', []).append(it)
        return it

    def text_xf(self, i, n, t):
        """(dx, dy, scale, rot, visible) for char i."""
        m = self.tmode; ls = self.ls
        if m == 'stay':
            return 0, 5 * ls(t, 4, -i * 0.9), 1 + 0.03 * ls(t, 4, -i * 0.9), 2.5 * ls(t, 3, i), True
        if m == 'wave':
            return 0, 10 * ls(t, 2, -i * 1.1), 1, 6 * ls(t, 2, -i * 1.1 + 1.5), True
        if m == 'bounce':
            k = (self.ph(t, 2) - i * 0.1) % 1.0
            hop = -26 * bump(k / 0.28) if k < 0.28 else 0
            sq_ = 1 + 0.06 * bump((k - 0.28) / 0.12) if 0.28 <= k < 0.4 else 1
            return 0, hop, sq_, 0, True
        if m == 'shake':
            return 3.5 * ls(t, 24, i * 2.1), 3 * ls(t, 18, i * 1.3), 1, 2 * ls(t, 12, i), True
        if m == 'shiver':
            return 2.5 * ls(t, 30, i * 1.7), 0, 1, 0, True
        if m == 'pulse':
            k = self.ph(t, 4); b = math.exp(-k * 7)
            return 0, 0, 1 + 0.10 * b, 0, True
        if m == 'droop':
            return 0, 4 * i + 4 * ls(t, 2, -i * 0.6), 1, -4 - 3 * i + 2 * ls(t, 2, -i * 0.6), True
        if m == 'swing':
            ang = 5 * ls(t, 2)
            cx = W / 2; x = self.lay[i][1]
            return 0, -(x - cx) * math.sin(math.radians(ang)), 1, ang, True
        if m == 'spin':
            k = (self.ph(t, 1) - i * 0.08) % 1.0
            return 0, -10 * bump(k / 0.35) if k < 0.35 else 0, 1, -360 * ease_io(k / 0.35) if k < 0.35 else 0, True
        if m == 'zoom':
            k = self.ph(t, 2); b = math.exp(-k * 6)
            return 3 * ls(t, 20, i) * b, 0, 1 + 0.16 * b, 0, True
        if m in ('pop', 'type'):
            t0 = 0.15 + i * (0.14 if m == 'pop' else 0.22)
            tt = t - t0
            if tt <= 0: return 0, 0, 0, 0, False
            te = (t - (self.T - 0.45) - (n - 1 - i) * 0.04) / 0.25
            if te >= 1: return 0, 0, 0, 0, False
            if m == 'pop':
                sc = elastic(tt / 0.55) if tt < 0.55 else 1 + 0.04 * math.sin(tt * 7)
                rot = (1 - ease_out(tt / 0.4)) * (-28 if i % 2 else 28)
                dy = -(1 - ease_out_back(tt / 0.45)) * 100
            else:
                sc = ease_out_back(tt / 0.2, 3); rot = 0; dy = 0
            if te > 0: sc *= 1 + 0.25 * math.sin(te * math.pi) - te ** 2
            return 0, dy, max(0.01, sc), rot, True
        if m == 'slam':
            t0 = 0.1 + i * 0.12; tt = t - t0
            if tt <= 0: return 0, 0, 0, 0, False
            te = (t - (self.T - 0.35)) / 0.25
            if te >= 1: return 0, 0, 0, 0, False
            dy = -(1 - ease_in(tt / 0.18)) * 220 if tt < 0.18 else 0
            sc = 1 + 0.18 * bump((tt - 0.18) / 0.15) if tt >= 0.18 else 1
            if te > 0: sc *= 1 - ease_in(te); dy -= 0
            return 0, dy, max(0.01, sc), 0, True
        return 0, 0, 1, 0, True

    def cover_time(self):
        if self.cover_t is not None: return self.cover_t
        if getattr(self, 'cover_k', None) is not None and self.tmode in ('stay', 'wave', 'bounce', 'shake', 'shiver', 'pulse',
                                                                         'droop', 'swing', 'zoom', 'spin'):
            return self.cover_k * self.T
        n = len(self.lay)
        if self.tmode == 'pop': return min(self.T - 0.6, 0.15 + (n - 1) * 0.14 + 0.7)
        if self.tmode == 'type': return min(self.T - 0.6, 0.15 + (n - 1) * 0.22 + 0.4)
        if self.tmode == 'slam': return min(self.T - 0.5, 0.1 + (n - 1) * 0.12 + 0.5)
        return 0.0

    # ---- water ----
    def water_y(self, x, t):
        c = self.calm
        return self.wl + c * (5 * math.sin(x / 38 + 2 * math.pi * 3 * t / self.T) + 3 * math.sin(x / 17 - 2 * math.pi * 4 * t / self.T))

    # ---- layers (override in motions / fx) ----
    def draw_sky(self, img, d, t): pass
    def draw_back(self, img, d, t): pass
    def draw_front(self, img, d, t): pass
    def draw_top(self, img, d, t): pass

    # ---- projection helpers (valid after the axolotl was rendered this frame) ----
    def to_canvas(self, bx, by):
        Mx, off = _affine(self.A)
        p = Mx @ np.array([bx, by]) + off
        return float(p[0]), float(p[1])
    def proj(self, world_pt):
        save = rig2.LAST; rig2.LAST = self.LAST
        bx, by = rig2.project(world_pt); rig2.LAST = save
        return self.to_canvas(bx, by)
    def head_pt(self, p=(0, 6.5, -7.5)): return self.proj(items.head_point(self.A.pose, p))
    def eye_pts(self):
        return self.head_pt((3.6, 6.5, -10.2)), self.head_pt((-3.6, 6.5, -10.2))
    def item_pt(self, idx=0, p=(0, 0, 0)):
        return self.proj(items.item_point(self.A.pose, self.A.pose['_items'][idx], p))

    # ---- frame ----
    def frame(self, fi):
        t = fi / FPS
        self.wl = getattr(self, 'water_level', WATER_Y)
        img = Image.new('RGBA', (W, H), (255, 255, 255, 255))
        d = ImageDraw.Draw(img)
        self.draw_sky(img, d, t)
        a = self.motion(t); self.A = a
        if a.show:
            im, self.LAST = render_ax(a)
            layer = place(im, a)
            if a.gray > 0 or a.rgb:
                la = np.asarray(layer).astype(np.float32)
                if a.gray > 0:
                    lum = la[..., :1] * 0.3 + la[..., 1:2] * 0.59 + la[..., 2:3] * 0.11
                    stone = lum * 0.62 + np.array([58, 60, 68], np.float32)
                    la[..., :3] = la[..., :3] * (1 - a.gray) + stone * a.gray
                if a.rgb:
                    la[..., 0] = np.roll(la[..., 0], -a.rgb, axis=1); la[..., 2] = np.roll(la[..., 2], a.rgb, axis=1)
                layer = Image.fromarray(np.clip(la, 0, 255).astype(np.uint8))
        else:
            layer = None
        poly = [(x, self.water_y(x, t)) for x in range(-8, W + 16, 8)] + [(W + 8, H + 8), (-8, H + 8)]
        if self.water:
            wl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(wl).polygon(poly, fill=(170, 222, 255, 255))
            img.alpha_composite(wl)
            for b in self.bubbles:
                per = self.T / 2
                tt = (t + b['ph'] * per) % per
                y = H + 10 - tt * b['sp'] * 1.2
                if y > self.water_y(b['x'], t) + 6:
                    x = b['x'] + 6 * math.sin(tt * 8)
                    d.rectangle((x, y, x + b['s'], y + b['s']), outline=(255, 255, 255), width=2)
            self.ripples = []
            if getattr(self, 'ripple_on', True):
                per = self.T / 2
                for k in range(3):
                    tt = (t + k * per / 3) % per
                    r = 40 + tt * 170 / (per / 1.6); a_ = int(220 * (1 - tt / per))
                    cx = W / 2 + getattr(self, 'ripple_dx', 0)
                    self.ripples.append(((cx - r, self.wl + 8 - r * 0.16, cx + r, self.wl + 8 + r * 0.16), a_))
            rb = Image.new('RGBA', (W, H), (0, 0, 0, 0)); rbd = ImageDraw.Draw(rb)
            for bx, a_ in self.ripples: rbd.arc(bx, 180, 360, fill=(255, 255, 255, a_), width=4)
            img.alpha_composite(rb)
        self.draw_back(img, d, t)
        for f in self.fx: f(self, img, d, t, 'back')
        if layer is not None:
            if self.water:
                sub = Image.new('L', (W, H), 0); ImageDraw.Draw(sub).polygon(poly, fill=255)
                la = np.asarray(layer).astype(np.float32); m = (np.asarray(sub, dtype=np.float32) / 255.0)[..., None] * 0.42
                la[..., :3] = la[..., :3] * (1 - m) + np.array([120, 190, 255], np.float32) * m
                layer = Image.fromarray(la.astype(np.uint8))
            img.alpha_composite(layer)
        if self.water:
            lip = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(lip)
            front = [(x, self.water_y(x, t) + 14) for x in range(-8, W + 16, 8)] + [(W + 8, H + 8), (-8, H + 8)]
            ld.polygon(front, fill=(150, 210, 255, 150))
            ld.line([(x, self.water_y(x, t)) for x in range(-8, W + 16, 8)], fill=(255, 255, 255, 230), width=5)
            for bx, a_ in self.ripples: ld.arc(bx, 0, 180, fill=(255, 255, 255, a_), width=4)
            img.alpha_composite(lip)
        d = ImageDraw.Draw(img)
        for p in self.droplets:
            tt = (t - p['t0']) % self.T
            if tt < 1.2:
                x = p['x'] + p['vx'] * tt; y = self.wl + p['vy'] * tt + 520 * tt * tt
                if y < self.water_y(x, t) + 4:
                    s = p['s'] * (1 - tt / 1.6)
                    sq(d, x, y, s, p['c'] + (255,), (90, 170, 235))
        self.draw_front(img, d, t)
        for f in self.fx: f(self, img, d, t, 'front')
        self.draw_text(img, t)
        d = ImageDraw.Draw(img)
        self.draw_top(img, d, t)
        for f in self.fx: f(self, img, d, t, 'top')
        return img.convert('RGB')

    def draw_text(self, img, t):
        n = len(self.lay)
        for i, (c, x, y, ch) in enumerate(self.lay):
            dx, dy, sc, rot, vis = self.text_xf(i, n, t)
            if not vis or sc < 0.03: continue
            spr = char_sprite(c, ch, self.style)
            s = spr
            if abs(sc - 1) > 1e-3: s = s.resize((max(1, int(s.width * sc)), max(1, int(s.height * sc))), Image.LANCZOS)
            if abs(rot) > 0.05: s = s.rotate(rot, Image.BICUBIC, expand=True)
            img.alpha_composite(s, (int(x + dx - s.width / 2), int(y + dy - s.height / 2 + 8)))

    def twinkles(self, d, t, amt=1.0, ys=None):
        for s in self.twk:
            a = (0.5 + 0.5 * math.sin(2 * math.pi * 3 * t / self.T + s['ph'])) * amt
            if a > 0.25: star(d, s['x'], s['y'] if ys is None else ys[0] + (s['y'] - 200) * (ys[1] - ys[0]) / 130,
                              s['r'] * a, s['c'], int(255 * a))

# ---------------- export ----------------
def export(stk, out_gif, colors=64, max_kb=1000, cover_png=None):
    frames = [stk.frame(i) for i in range(stk.N)]
    c = int(round(stk.cover_time() * FPS)) % stk.N
    frames = frames[c:] + frames[:c]
    os.makedirs(os.path.dirname(out_gif) or '.', exist_ok=True)
    if cover_png:
        os.makedirs(os.path.dirname(cover_png), exist_ok=True)
        frames[0].resize((400, 400), Image.LANCZOS).save(cover_png)
    raw = b''.join(f.tobytes() for f in frames)
    for col in (colors, 48, 40, 32, 24):
        for mode in ('diff', 'full'):     # 'diff' is smaller; 'full' keeps the white background exact
            vf = (f"scale=400:400:flags=lanczos,split[a][b];[a]palettegen=max_colors={col}:stats_mode={mode}[p];"
                  f"[b][p]paletteuse=dither=none:diff_mode=rectangle")
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                            '-r', str(FPS), '-i', '-', '-vf', vf, '-loop', '0', out_gif], input=raw, check=True)
            if min(Image.open(out_gif).convert('RGB').getpixel((2, 2))) >= 250: break
        kb = os.path.getsize(out_gif) / 1024
        if kb <= max_kb: break
    return kb, col

def preview(stk, ts, out_png, scale=0.5):
    sz = int(W * scale)
    sheet = Image.new('RGB', (sz * len(ts), sz), 'white')
    for i, tv in enumerate(ts):
        sheet.paste(stk.frame(int(round(tv * FPS)) % stk.N).resize((sz, sz), Image.LANCZOS), (i * sz, 0))
    sheet.save(out_png)
