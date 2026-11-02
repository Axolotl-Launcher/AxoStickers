"""Motion presets: each class moves the axolotl; faces/items/fx come from the spec."""
import math
import numpy as np
from axl import (Sticker, Ax, W, H, YAW, PITCH, FPS, clamp, lerp, ease_out, ease_in, ease_io, ease_out_back, elastic,
                 bump, window, icon, put, sq, star)
import fx as FX
import items

FACES = {
    'normal': {}, 'smile': {'mouth': 'smile'}, 'happy': {'L': 'happy', 'R': 'happy', 'mouth': 'smile', 'blush': True},
    'joy': {'L': 'happy', 'R': 'happy', 'mouth': 'w', 'blush': True}, 'love': {'L': 'heart', 'R': 'heart', 'mouth': 'smile', 'blush': True},
    'star': {'L': 'star', 'R': 'star', 'mouth': 'o'}, 'shock': {'L': 'big', 'R': 'big', 'mouth': 'shout'},
    'surprise': {'L': 'big', 'R': 'big', 'mouth': 'o'}, 'angry': {'L': 'angry', 'R': 'angry', 'mouth': 'frown'},
    'rage': {'L': 'angry', 'R': 'angry', 'mouth': 'shout'}, 'sad': {'L': 'sad', 'R': 'sad', 'mouth': 'frown'},
    'cry': {'L': 'cry', 'R': 'cry', 'mouth': 'shout'}, 'sob': {'L': 'cry', 'R': 'cry', 'mouth': 'wavy'},
    'teary': {'L': 'teary', 'R': 'teary', 'mouth': 'wavy'}, 'sleep': {'L': 'sleep', 'R': 'sleep'},
    'tired': {'L': 'flat', 'R': 'flat', 'mouth': 'wavy'}, 'meh': {'L': 'meh', 'R': 'meh', 'mouth': 'flat'},
    'dead': {'L': 'x', 'R': 'x', 'mouth': 'tongue'}, 'dizzy': {'L': 'dizzy', 'R': 'dizzy', 'mouth': 'wavy'},
    'smug': {'L': 'meh', 'R': 'meh', 'mouth': 'w'}, 'wink': {'L': 'wink', 'mouth': 'smile', 'blush': True},
    'focus': {'L': 'squeeze', 'R': 'squeeze', 'mouth': 'flat'}, 'struggle': {'L': 'squeeze', 'R': 'squeeze', 'mouth': 'shout'},
    'blep': {'mouth': 'tongue'}, 'drool': {'L': 'happy', 'R': 'happy', 'mouth': 'drool'},
    'money': {'L': 'money', 'R': 'money', 'mouth': 'smile'}, 'awkward': {'mouth': 'wavy'},
    'side': {'L': 'side', 'R': 'side', 'mouth': 'flat'}, 'cool': {'mouth': 'w'}, 'eat': {'L': 'happy', 'R': 'happy', 'mouth': 'eat'},
    'shy': {'L': 'side', 'R': 'side', 'mouth': 'w', 'blush': True}, 'tiny': {'L': 'tiny', 'R': 'tiny', 'mouth': 'o'},
    'up': {'L': 'up', 'R': 'up', 'mouth': 'o'}, 'grin': {'L': 'happy', 'R': 'happy', 'mouth': 'grin'},
    'catface': {'mouth': 'w', 'blush': True}, 'blank': {'L': 'flat', 'R': 'flat', 'mouth': 'none'},
    'pout': {'L': 'angry', 'R': 'angry', 'mouth': 'w', 'blush': True}, 'sparkle': {'L': 'star', 'R': 'star', 'mouth': 'smile', 'blush': True},
    'determined': {'L': 'angry', 'R': 'angry', 'mouth': 'grin'}, 'worried': {'L': 'sad', 'R': 'sad', 'mouth': 'wavy'},
    'sleepy': {'L': 'flat', 'R': 'flat', 'mouth': 'o'}, 'xd': {'L': 'squeeze', 'R': 'squeeze', 'mouth': 'smile', 'blush': True},
}

def addrot(a, bone, x=0, y=0, z=0):
    r = a.pose[bone].get('rot', (0, 0, 0)) if bone in a.pose else (0, 0, 0)
    a.pose.setdefault(bone, {})['rot'] = (r[0] + x, r[1] + y, r[2] + z)

SPR_S = 0.62

def setleg(a, name, x, y, z):
    a.pose[name] = {'set': (x, y, z), 'move': (0, -1.5, 0)}

LEGR = {'leg3': (((80, -55, 0), (0, -1.5, 0)), ((120, 40, -60), (1.5, 0, -3))),
        'leg4': (((80, 55, 0), (0, -1.5, 0)), ((120, -40, 60), (-1.5, 0, -3)))}
def legmix(a, name, k, extra=(0, 0, 0)):
    (r, rm), (u, um) = LEGR[name]
    a.pose[name] = {'set': tuple(lerp(r[i], u[i], k) + extra[i] for i in range(3)),
                    'move': tuple(lerp(rm[i], um[i], k) for i in range(3))}

class Base(Sticker):
    item_default = None
    def __init__(self, spec):
        super().__init__(spec)
        self.fx, setups = FX.make(spec.get('fx'))
        for s in setups: s(self)
        self.setup()

    def setup(self): pass
    def move(self, a, t): pass

    def motion(self, t):
        a = Ax(); self.idle(a, t, **self.spec.get('idle', {}))
        self.move(a, t)
        self.dress(a, t)
        return a

    def face_dict(self, t, name=None):
        f = name or self.spec.get('face', 'normal')
        f = dict(FACES[f]) if isinstance(f, str) else dict(f)
        if self.spec.get('blink', True) and f.get('L', 'open') == 'open' and f.get('R', 'open') == 'open':
            u = self.ph(t, 1, self.spec.get('blink_ph', 0.37))
            if u < 0.045: f['L'] = f['R'] = 'closed'
        return f

    def dress(self, a, t):
        sp = self.spec
        if '_face' not in a.pose:
            f = self.face_dict(t)
            if f: a.pose['_face'] = f
        for w in sp.get('wear', ()):
            if isinstance(w, str): self.wear(a, w)
            else: self.wear(a, **w)
        h = sp.get('hold')
        if h and not getattr(self, 'holds_itself', False):
            h = dict(kind=h) if isinstance(h, str) else dict(h)
            if 's' not in h: h['s'] = SPR_S if h['kind'] in items.SPR else 0.9
            k = h.pop('kind'); self.hold(a, k, **h)

# ---------------- simple body motions ----------------
class Idle(Base): pass

class Nod(Base):
    def move(self, a, t):
        k = self.ph(t, self.spec.get('n', 3)); n = bump(k / 0.45) if k < 0.45 else 0
        addrot(a, 'head', x=-24 * n); a.dy += 5 * n

class Shake(Base):
    def move(self, a, t):
        addrot(a, 'head', y=30 * self.ls(t, 4), z=4 * self.ls(t, 4)); addrot(a, 'root', y=5 * self.ls(t, 4, math.pi))

class Hop(Base):
    def setup(self):
        n = self.spec.get('n', 2)
        for i in range(n): self.splash((0.45 + i) * self.T / n, n=8, power=0.55, spread=60)
    def move(self, a, t):
        n = self.spec.get('n', 2); k = self.ph(t, n)
        if k < 0.45:
            u = k / 0.45; a.dy -= 80 * math.sin(math.pi * u); a.sy = 1 + 0.07 * math.sin(math.pi * u); a.sx = 1 / a.sy ** 0.5
            addrot(a, 'root', x=12 * math.cos(math.pi * u))
            for l in ('leg1', 'leg2', 'leg3', 'leg4'): addrot(a, l, x=-20 * math.sin(math.pi * u))
        else:
            u = (k - 0.45) / 0.55; b = bump(u / 0.3) if u < 0.3 else 0
            a.sy = 1 - 0.09 * b; a.sx = 1 + 0.07 * b; a.dy += 6 * b

class Jump(Base):
    def setup(self):
        self.t0, self.t1 = 0.16 * self.T, 0.6 * self.T
        self.splash(self.t0, n=16, power=1.0); self.splash(self.t1 + 0.05, n=20, power=1.1)
    def move(self, a, t):
        flip = self.spec.get('flip', 0)
        if t < self.t0:
            u = t / self.t0; a.dy += 18 * bump(u); a.sy = 1 - 0.06 * bump(u)
        elif t < self.t1:
            k = (t - self.t0) / (self.t1 - self.t0)
            a.dy -= 210 * 4 * k * (1 - k)
            addrot(a, 'root', x=30 - 60 * k - flip * 360 * ease_io(k))
            a.sy = 1 + 0.08 * bump(k / 0.25) if k < 0.25 else 1
            for l in ('leg1', 'leg2', 'leg3', 'leg4'): addrot(a, l, x=-25 * bump(k))
            addrot(a, 'tail', x=20 * bump(k))
        else:
            u = (t - self.t1) / (self.T - self.t1)
            a.dy += 70 * bump(u / 0.6) if u < 0.6 else 0

class Spin(Base):
    def move(self, a, t):
        k = self.ph(t, self.spec.get('n', 1))
        a.yaw = YAW + 360 * ease_io(k) * self.spec.get('dir', 1)
        a.dy -= 26 * bump(k)

class Sink(Base):
    """dives under and comes back (溜了 / 潜水)."""
    def setup(self): self.splash(0.42 * self.T, n=10, power=0.6, spread=50); self.splash(0.78 * self.T, n=14, power=0.8)
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.15: d = 0
        elif k < 0.42: d = 260 * ease_in((k - 0.15) / 0.27); addrot(a, 'root', x=-20 * clamp((k - 0.15) / 0.1))
        elif k < 0.66: d = 300
        else: d = 300 * (1 - ease_out_back((k - 0.66) / 0.3, 1.3))
        a.dy += d
        a.show = d < 290

class Peek(Base):
    def move(self, a, t):
        k = self.ph(t)
        rise = bump((k - 0.3) / 0.4) if 0.3 < k < 0.7 else 0
        a.dy += 52 - 26 * ease_io(rise * 1.6)
        addrot(a, 'head', y=28 * clamp(1.8 * self.ls(t, 1)), x=-10)
        a.dx += 0

class Tremble(Base):
    def move(self, a, t):
        a.dx += 3.5 * self.ls(t, 36); addrot(a, 'head', y=3 * self.ls(t, 30))
        for g, s in (('left_gills', 1), ('right_gills', -1)): addrot(a, g, y=s * 10 * self.ls(t, 24))

class Rage(Base):
    def move(self, a, t):
        a.dx += 4.5 * self.ls(t, 30); k = self.ph(t, 4)
        p = math.exp(-k * 5); a.sx = a.sy = 1 + 0.07 * p; addrot(a, 'head', x=-14)
        for g, s in (('left_gills', 1), ('right_gills', -1)): addrot(a, g, y=s * 25)
        addrot(a, 'top_gills', x=-20)

class Dance(Base):
    def move(self, a, t):
        a.roll = 9 * self.ls(t, 2); a.dx += 26 * self.ls(t, 2)
        addrot(a, 'head', y=22 * self.ls(t, 2, math.pi / 2), z=6 * self.ls(t, 4))
        a.dy -= 14 * abs(self.ls(t, 4))
        for l, s in (('leg3', 1), ('leg4', -1)): addrot(a, l, x=-50 * max(0, s * self.ls(t, 4)))
        addrot(a, 'tail', y=25 * self.ls(t, 4))

class Wag(Base):
    def move(self, a, t):
        addrot(a, 'tail', y=40 * self.ls(t, 8)); addrot(a, 'root', y=7 * self.ls(t, 8, math.pi))
        a.dy -= 6 * abs(self.ls(t, 4))

class Bow(Base):
    def move(self, a, t):
        k = self.ph(t, self.spec.get('n', 2)); b = ease_io(bump(k / 0.7)) if k < 0.7 else 0
        addrot(a, 'head', x=-45 * b); addrot(a, 'root', x=-14 * b); a.dy += 18 * b

class Doze(Base):
    def move(self, a, t):
        k = self.ph(t)
        drop = ease_in(k / 0.82) if k < 0.82 else 1 - ease_out((k - 0.82) / 0.1)
        addrot(a, 'head', x=-40 * drop); a.dy += 22 * drop
        for g, s in (('left_gills', 1), ('right_gills', -1)): addrot(a, g, x=-25 * drop)
        if 0.82 < k < 0.95: a.pose['_face'] = dict(FACES['surprise'])
        else: a.pose['_face'] = dict(FACES[self.spec.get('face', 'sleep')])

class Flop(Base):
    def move(self, a, t):
        a.pose['head']['rot'] = (-2 + 2 * self.ls(t, 1), 0, 0)
        for l, s in (('leg1', 1), ('leg2', -1), ('leg3', 1), ('leg4', -1)): addrot(a, l, z=s * 40)
        a.pose['tail']['rot'] = (0, 6 * self.ls(t, 1), 0)
        a.sy = 0.9 + 0.025 * self.ls(t, 2); a.sx = 1.06; a.dy += 30
        for g, s in (('left_gills', 1), ('right_gills', -1)): a.pose[g] = {'rot': (-30, s * 20, 0)}
        a.pose['top_gills'] = {'rot': (-30, 0, 0)}

class Dash(Base):
    def setup(self): self.splash(0.22 * self.T, x=40, n=12, power=0.7)
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.2: a.dx -= 14 * ease_io(k / 0.2); addrot(a, 'head', y=-20 * ease_io(k / 0.2))
        elif k < 0.4: a.dx += -14 + 480 * ease_in((k - 0.2) / 0.2); a.yaw = YAW + 110 * ease_io((k - 0.2) / 0.08)
        elif k < 0.55: a.show = False
        elif k < 0.85: a.dx += -480 * (1 - ease_out((k - 0.55) / 0.3)); a.yaw = YAW + 110 * (1 - ease_io((k - 0.7) / 0.15))
        for l in ('leg1', 'leg2', 'leg3', 'leg4'): addrot(a, l, y=25 * self.ls(t, 16))

class Look(Base):
    def move(self, a, t):
        addrot(a, 'head', y=38 * clamp(1.7 * self.ls(t, 1)), x=-5)

class WaveLeg(Base):
    def move(self, a, t):
        legmix(a, 'leg3', 1, (10 * self.ls(t, 6), 0, 30 * self.ls(t, 6))); addrot(a, 'head', z=-6, y=-8)

class Clap(Base):
    def move(self, a, t):
        c = abs(self.ls(t, 6))
        legmix(a, 'leg3', 0.85, (0, 0, 30 * c)); legmix(a, 'leg4', 0.85, (0, 0, -30 * c))
        a.dy -= 4 * c

class Cheer(Base):
    def move(self, a, t):
        u = self.ls(t, 4)
        legmix(a, 'leg3', max(0, u) * 1.1); legmix(a, 'leg4', max(0, -u) * 1.1)
        a.dy -= 14 * abs(u); addrot(a, 'head', x=10)

class Belly(Base):
    """belly-up float (寄 / 躺平)."""
    def move(self, a, t):
        a.pose['root'] = {'rot': (0, 10 * self.ls(t, 1), 180), 'move': (0, 15, 0)}
        a.pose['head']['rot'] = (0, 0, 0)
        for l in ('leg1', 'leg2', 'leg3', 'leg4'): addrot(a, l, x=8 * self.ls(t, 2, l == 'leg1'))
        a.dy += 22 + 3 * self.ls(t, 2); a.dx += 10 * self.ls(t, 1)

class Zoom(Base):
    def move(self, a, t):
        k = self.ph(t)
        z = ease_io(k / 0.35) if k < 0.6 else 1 - ease_io((k - 0.6) / 0.3)
        a.zoom = 1 + 0.55 * z; a.dy -= 50 * z; addrot(a, 'head', x=-8 * z)

class Tilt(Base):
    def move(self, a, t):
        addrot(a, 'head', z=20 * clamp(1.6 * self.ls(t, 1)), x=6)

class Shrink(Base):
    def move(self, a, t):
        a.zoom = 0.6; a.dx += 1.5 * self.ls(t, 30); a.dy += 30 + 4 * self.ls(t, 2)

class Puff(Base):
    def move(self, a, t):
        p = 0.5 + 0.5 * self.ls(t, 2); a.sx = 1 + 0.14 * p; a.sy = 1 + 0.1 * p; a.dy -= 8 * p

class Drift(Base):
    def move(self, a, t):
        a.dx += 80 * self.ls(t, 1); a.roll = -7 * self.lc(t, 1); addrot(a, 'head', y=-15 * self.lc(t, 1))
        self.ripple_dx = a.dx

class Headbang(Base):
    def move(self, a, t):
        addrot(a, 'head', x=-30 * (0.5 + 0.5 * self.ls(t, 8))); a.dy += 4 * self.ls(t, 8)

class Roll(Base):
    def move(self, a, t):
        k = self.ph(t)
        a.pose['root'] = {'rot': (8, 0, 360 * ease_io(k)), 'move': (0, 7 * bump(k), 0)}; a.dy += 10 * bump(k)

class Stare(Base):
    def move(self, a, t):
        a.zoom = 1.18; a.dy -= 26; a.pose['head']['rot'] = (14, 0, 0)
        a.dx += 0

class Shy(Base):
    def move(self, a, t):
        k = 0.5 + 0.5 * self.ls(t, 1)
        addrot(a, 'head', y=36 * k, x=-12); a.dy += 18 * k
        for g, s in (('left_gills', 1), ('right_gills', -1)): addrot(a, g, x=-20 * k)

class Think(Base):
    def move(self, a, t):
        addrot(a, 'head', z=14 + 3 * self.ls(t, 1), x=12, y=-10)
        legmix(a, 'leg3', 0.9, (25, 0, 25))

class Boing(Base):
    def move(self, a, t):
        k = self.ph(t, 2); e = math.exp(-k * 4) * math.sin(k * 2 * math.pi * 3)
        a.sy = 1 + 0.16 * e; a.sx = 1 - 0.1 * e; a.dy -= 30 * max(0, e)

class Faint(Base):
    def move(self, a, t):
        k = self.ph(t)
        f = ease_out_back(k / 0.25, 1.1) if k < 0.72 else 1 - ease_io((k - 0.72) / 0.22)
        a.pose['root'] = {'rot': (8 * (1 - f), 6 * self.ls(t, 1) * f, 180 * f), 'move': (0, 15 * f, 0)}
        a.dy += 22 * f; a.pose['head']['rot'] = tuple(v * (1 - f) for v in a.pose['head']['rot'])

class Run(Base):
    def move(self, a, t):
        for l, s in (('leg1', 1), ('leg2', -1), ('leg3', -1), ('leg4', 1)): addrot(a, l, y=40 * s * self.ls(t, 16), x=-20 * abs(self.ls(t, 16)))
        a.dx += 3 * self.ls(t, 16); addrot(a, 'head', x=-8, y=-14); addrot(a, 'tail', y=30 * self.ls(t, 16))

class Launch(Base):
    def setup(self): self.splash(0.2 * self.T, n=22, power=1.2)
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.15: a.dy += 20 * bump(k / 0.15); a.sy = 1 - 0.08 * bump(k / 0.15)
        elif k < 0.42: a.dy -= 620 * ease_in((k - 0.15) / 0.27); addrot(a, 'root', x=35); a.sy = 1.12
        elif k < 0.6: a.show = False
        else: a.dy += 260 * (1 - ease_out_back((k - 0.6) / 0.3, 1.4))
        self._k = k
    def draw_back(self, img, d, t):
        k = getattr(self, '_k', 0)
        if 0.15 < k < 0.42 and self.LAST is not None:
            x, y = self.proj(items._root_M(self.A.pose)[:3, 3] + np.array([0, 0, 0.6]))
            for j in range(4):
                put(img, icon('flame', 7), x + 12 * math.sin(t * 40 + j), y + 30 + j * 26, 1 - j * 0.18, 180)

class Float(Base):
    """relaxed back float, slowly turning (躺平)."""
    def move(self, a, t):
        a.pose['root'] = {'rot': (0, 360 * self.ph(t) * 0 + 20 * self.ls(t, 1), 180), 'move': (0, 15, 0)}
        a.pose['head']['rot'] = (0, 0, 0)
        for l, s in (('leg1', 1), ('leg2', -1), ('leg3', 1), ('leg4', -1)): addrot(a, l, z=s * 30)
        a.dy += 24 + 3 * self.ls(t, 2)

class Grow(Base):
    def move(self, a, t):
        k = self.ph(t, 2); g = elastic(k / 0.4) if k < 0.7 else 1 - ease_io((k - 0.7) / 0.3)
        a.zoom = 1 + 0.35 * g; a.dy -= 40 * g

# ---------------- prop actions ----------------
class Swing(Base):
    """swings a held tool (pickaxe / sword / wrench / flag)."""
    holds_itself = True
    def setup(self):
        self.kind = self.spec.get('hold', 'pickaxe')
    def move(self, a, t):
        k = self.ph(t, self.spec.get('n', 3))
        sw = ease_in(k / 0.3) if k < 0.3 else 1 - ease_out((k - 0.3) / 0.7)
        rz = -40 + 110 * sw
        self.hold(a, self.kind, x=5.4, y=7.0, z=-12.5, rz=rz, s=0.7)
        addrot(a, 'head', x=-10 * sw, y=-6 * sw)
        self._hit = k
    def draw_front(self, img, d, t):
        if self.spec.get('debris') and self._hit < 0.35 and self.LAST is not None:
            u = clamp((self._hit - 0.25) / 0.1)
            hx, hy = self.head_pt()
            for j in range(6):
                ang = -math.pi / 2 + (j - 2.5) * 0.45
                r = 20 + 60 * u
                sq(d, hx + 110 + math.cos(ang) * r, hy + 40 + math.sin(ang) * r, 12 * (1 - u * 0.5),
                   (150, 150, 160, 255) if j % 2 else (110, 110, 120, 255), (60, 60, 70), 2)

class Wave(Base):
    """waves a held item side to side (flag, fish, glow stick...)."""
    holds_itself = True
    def move(self, a, t):
        kind = self.spec.get('hold', 'flag'); n = self.spec.get('n', 4)
        self.hold(a, kind, x=5.2, y=8.0, z=-12.6, rz=-5 + 28 * self.ls(t, n), s=self.spec.get('s', 0.7))
        addrot(a, 'head', y=-6 * self.ls(t, n)); a.dy -= 4 * abs(self.ls(t, n))

class Offer(Base):
    """holds an item out toward the viewer, pulsing (送你 / 比心)."""
    holds_itself = True
    def move(self, a, t):
        kind = self.spec.get('hold', 'heart'); p = math.exp(-self.ph(t, 2) * 5)
        s = (SPR_S if kind in items.SPR else 0.9) * (1 + 0.18 * p) * self.spec.get('s', 1.0)
        self.hold(a, kind, x=2.0, y=10.5, z=-14.5, rz=-6, s=s, legs=1.0)
        legmix(a, 'leg3', 1.0); addrot(a, 'head', x=8)

class Chomp(Base):
    holds_itself = True
    def move(self, a, t):
        kind = self.spec.get('hold', 'cookie'); k = self.ph(t)
        bites = int(k * 4)
        s = (SPR_S * 1.4 if kind in items.SPR else 1.0) * max(0.0, 1 - bites * 0.22) * self.spec.get('s', 1.0)
        b = bump((k * 4) % 1 / 0.3) if (k * 4) % 1 < 0.3 else 0
        addrot(a, 'head', x=12 * b - 4)
        self.hold(a, kind, x=0.5, y=6.4, z=-12.8 + 0.8 * b, rz=0, s=max(s, 0.001), legs=1.0)
        self._b = b

class Drink(Base):
    holds_itself = True
    def move(self, a, t):
        kind = self.spec.get('hold', 'boba'); k = self.ph(t, 2)
        sip = ease_io(bump(k / 0.6)) if k < 0.6 else 0
        self.hold(a, kind, x=lerp(4.8, 1.0, sip), y=lerp(5.5, 4.5, sip), z=-13.5, rz=lerp(-8, 20, sip), s=0.9)
        addrot(a, 'head', x=lerp(0, 18, sip))

class Read(Base):
    holds_itself = True
    def move(self, a, t):
        kind = self.spec.get('hold', 'book')
        self.hold(a, kind, x=4.6, y=8.6, z=-13.2, ry=-35, rz=-8, s=self.spec.get('s', 1.0))
        addrot(a, 'head', x=-6 + 2 * self.ls(t, 2), y=-16 + 6 * self.ls(t, 4))

class Typing(Base):
    holds_itself = True
    def move(self, a, t):
        self.wear(a, 'laptop', at='root', x=0, y=6.0, z=-15.5, rx=-8, ry=180, s=0.9); a.dy -= 22
        addrot(a, 'head', x=-14 + 4 * abs(self.ls(t, 12)))
        addrot(a, 'leg3', x=-60 - 15 * abs(self.ls(t, 12))); addrot(a, 'leg4', x=-60 - 15 * abs(self.ls(t, 12, 1.2)))

class Scan(Base):
    """magnifier sweeping left/right (找 / 让我看看)."""
    holds_itself = True
    def move(self, a, t):
        u = self.ls(t, 2)
        self.hold(a, self.spec.get('hold', 'magnifier'), x=1.5 + 4 * u, y=6.0 + 1.0 * abs(u), z=-14.0, rz=-20 + 10 * u, s=0.75)
        addrot(a, 'head', y=-18 * u, x=-6)

class Umbrella(Base):
    holds_itself = True
    def move(self, a, t):
        self.hold(a, 'umbrella', x=2.5, y=12.0, z=-9.0, rz=8 + 4 * self.ls(t, 2), s=0.95)

# ---------------- special ----------------
REG = {
    'idle': Idle, 'nod': Nod, 'shake': Shake, 'hop': Hop, 'jump': Jump, 'spin': Spin, 'sink': Sink, 'peek': Peek,
    'tremble': Tremble, 'rage': Rage, 'dance': Dance, 'wag': Wag, 'bow': Bow, 'doze': Doze, 'flop': Flop,
    'dash': Dash, 'look': Look, 'wave': WaveLeg, 'clap': Clap, 'cheer': Cheer, 'belly': Belly, 'zoom': Zoom,
    'tilt': Tilt, 'shrink': Shrink, 'puff': Puff, 'drift': Drift, 'headbang': Headbang, 'roll': Roll, 'stare': Stare,
    'shy': Shy, 'think': Think, 'boing': Boing, 'faint': Faint, 'run': Run, 'launch': Launch, 'float': Float,
    'grow': Grow, 'swing': Swing, 'flagwave': Wave, 'offer': Offer, 'chomp': Chomp, 'drink': Drink, 'read': Read,
    'typing': Typing, 'scan': Scan, 'umbrella': Umbrella,
}

def make(spec):
    return REG[spec.get('motion', 'idle')](spec)

import motions2  # noqa: E402  (registers the second batch of motions)
