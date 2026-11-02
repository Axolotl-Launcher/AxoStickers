"""More body motions (second batch), registered into motions.REG."""
import math, random
from axl import Ax, YAW, FPS, clamp, lerp, ease_out, ease_in, ease_io, ease_out_back, elastic, bump, window, icon, put, sq, star
import motions
from motions import Base, Jump, addrot, legmix


class Popup(Base):
    """dives, then bursts back out of the water (冒泡 / 能进了)."""
    def setup(self): self.splash(0.58 * self.T, n=8, power=0.5, spread=50); self.splash(0.82 * self.T, n=24, power=1.25)
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.5: return
        if k < 0.6: a.dy += 270 * ease_in((k - 0.5) / 0.1); addrot(a, 'root', x=-25 * ((k - 0.5) / 0.1))
        elif k < 0.8: a.dy += 300; a.show = False
        else:
            u = (k - 0.8) / 0.2
            if u < 0.4: a.dy += lerp(300, -60, ease_out(u / 0.4)); a.sy = 1.14; a.sx = 0.92; addrot(a, 'root', x=20)
            else:
                a.dy += -60 * (1 - ease_out_back((u - 0.4) / 0.6, 2.4))
                b = bump((u - 0.4) / 0.25); a.sy = 1 - 0.08 * b; a.sx = 1 + 0.06 * b

class Slosh(Base):
    """tail slaps the water (拍水)."""
    def setup(self):
        for i in range(2): self.splash((0.3 + i * 0.5) * self.T, x=70, n=16, power=0.9, spread=40)
    def move(self, a, t):
        k = self.ph(t, 2)
        up = ease_out(k / 0.24) if k < 0.24 else (1 - ease_in((k - 0.24) / 0.06) if k < 0.3 else 0)
        addrot(a, 'tail', x=-55 * up + 18 * bump((k - 0.3) / 0.12), y=-15 * up)
        addrot(a, 'root', x=-8 * bump((k - 0.28) / 0.14)); a.dy += 6 * bump((k - 0.28) / 0.14)

class SideHop(Base):
    def setup(self):
        for i, x in ((0, 50), (1, -50)): self.splash((0.42 + i * 0.5) * self.T, x=x, n=9, power=0.55, spread=40)
    def move(self, a, t):
        k = self.ph(t, 2); side = 1 if self.ph(t) < 0.5 else -1
        if k < 0.42:
            u = k / 0.42; a.dx += lerp(-side * 50, side * 50, ease_io(u)); a.dy -= 72 * math.sin(math.pi * u)
            a.yaw = YAW + side * 38 * bump(u / 0.9); addrot(a, 'root', x=12 * math.cos(math.pi * u))
        else:
            u = (k - 0.42) / 0.58; b = bump(u / 0.3) if u < 0.3 else 0
            a.dx += side * 50; a.sy = 1 - 0.08 * b; a.sx = 1 + 0.06 * b

class Sway(Base):
    def move(self, a, t):
        a.roll = 9 * self.ls(t, 1); a.dx += 12 * self.ls(t, 1)
        addrot(a, 'head', z=-7 * self.ls(t, 1), y=10 * self.ls(t, 1, math.pi / 2))

class Tantrum(Base):
    def setup(self):
        for i in range(4): self.splash((i + 0.2) * self.T / 4, x=(-50, 40, -20, 60)[i], n=6, power=0.5, spread=40)
    def move(self, a, t):
        a.roll = 15 * self.ls(t, 8); a.dx += 7 * self.ls(t, 8, 1.3); a.dy -= 6 * abs(self.ls(t, 8))
        for l, s_ in (('leg1', 1), ('leg2', -1), ('leg3', -1), ('leg4', 1)):
            addrot(a, l, y=45 * s_ * self.ls(t, 16), z=25 * self.ls(t, 16, 1))
        addrot(a, 'tail', y=45 * self.ls(t, 12)); addrot(a, 'head', y=20 * self.ls(t, 8, math.pi), x=-8)

class Petrify(Base):
    """turns to stone, then shakes it off (石化 / 人麻了)."""
    def move(self, a, t):
        k = self.ph(t)
        g = clamp((k - 0.12) / 0.1) if k < 0.8 else 1 - clamp((k - 0.88) / 0.06)
        if g > 0:
            f = Ax(); self.idle(f, 0.12 * self.T); a.pose = f.pose; a.dy = f.dy
            if 0.8 <= k < 0.9: a.dx += 4 * self.ls(t, 30)
        a.gray = g

class Melt(Base):
    def move(self, a, t):
        k = self.ph(t)
        m = ease_io(k / 0.35) if k < 0.72 else 1 - elastic((k - 0.72) / 0.28)
        a.sy = 1 - 0.4 * m; a.sx = 1 + 0.32 * m; a.dy += 38 * m; addrot(a, 'head', x=-15 * m)
        for g, s_ in (('left_gills', 1), ('right_gills', -1)): addrot(a, g, x=-35 * m)

class Stretch(Base):
    """big yawn/stretch (起床 / 伸懒腰)."""
    def move(self, a, t):
        k = self.ph(t); s_ = ease_io(bump(k / 0.6)) if k < 0.6 else 0
        a.sy = 1 + 0.2 * s_; a.sx = 1 - 0.08 * s_; a.dy -= 28 * s_; addrot(a, 'head', x=28 * s_)
        legmix(a, 'leg3', 0.9 * s_); legmix(a, 'leg4', 0.9 * s_)
        if s_ > 0.35: a.pose['_face'] = {'L': 'squeeze', 'R': 'squeeze', 'mouth': 'shout'}

class LookUp(Base):
    def move(self, a, t):
        addrot(a, 'head', x=24 + 6 * self.ls(t, 1), y=10 * self.ls(t, 1, 1)); addrot(a, 'root', x=8); a.dy -= 6

class TurnAway(Base):
    """turns its back, glances back once, turns around again (哼 / 不理你)."""
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.12: tw = 0
        elif k < 0.72: tw = ease_out_back((k - 0.12) / 0.16, 1.4)
        else: tw = 1 - ease_io((k - 0.72) / 0.16)
        a.yaw = YAW + 130 * tw
        if 0.42 < k < 0.58: addrot(a, 'head', y=-55 * bump((k - 0.42) / 0.16))
        addrot(a, 'head', x=12 * tw)

class Glitch(Base):
    """lag: freezes and jumps in steps with RGB split (卡了 / 掉线)."""
    def move(self, a, t):
        fi = int(round(t * FPS)); step = fi // 3
        rng = random.Random(step * 7919 + self.spec.get('seed', 0))
        f = Ax(); self.idle(f, step * 3 / FPS); a.pose = f.pose; a.dy = f.dy
        if step % max(1, self.N // 3) and rng.random() < 0.55:
            a.dx += rng.choice((-26, -14, 14, 26)); a.dy += rng.choice((-10, 0, 10))
            a.rgb = rng.choice((0, 5, 8))
        self.ripple_on = False

class Squish(Base):
    """a stone block drops on its head (服了 / 压力好大)."""
    def move(self, a, t):
        k = self.ph(t); self._k = k
        if 0.3 <= k < 0.55: a.sy = 0.62; a.sx = 1.3; a.dy += 36
        elif 0.55 <= k < 0.8:
            e = elastic((k - 0.55) / 0.25); a.sy = lerp(0.62, 1, e); a.sx = lerp(1.3, 1, e); a.dy += lerp(36, 0, e)
        if 0.3 <= k < 0.55: a.pose['_face'] = {'L': 'squeeze', 'R': 'squeeze', 'mouth': 'flat'}
    def draw_top(self, img, d, t):
        k = self._k
        if self.LAST is None or not 0.08 < k < 0.75: return
        hx, hy = self.head_pt((0, 9.5, -7.5))
        if k < 0.3: y = lerp(-80, hy - 26, ease_in((k - 0.08) / 0.22)); x = hx; r = 0
        elif k < 0.55: y = hy - 26; x = hx; r = 0
        else: u = (k - 0.55) / 0.2; x = hx + 260 * u; y = hy - 26 - 160 * u + 300 * u * u; r = -200 * u
        put(img, icon('stone', 8), x, y, 1, r)
        if 0.3 <= k < 0.38:
            for j in range(6):
                ang = math.radians(200 + j * 28); r0 = 50 + 120 * (k - 0.3)
                d.line((hx + math.cos(ang) * r0, hy - 20 + math.sin(ang) * r0 * 0.6, hx + math.cos(ang) * (r0 + 18),
                        hy - 20 + math.sin(ang) * (r0 + 18) * 0.6), fill=(90, 90, 100, 255), width=4)

class SlideIn(Base):
    """slides out right, comes back skidding in from the left (来啦 / 借过)."""
    def setup(self): self.splash(0.93 * self.T, x=-30, n=14, power=0.7, spread=40)
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.58: return
        if k < 0.7: u = (k - 0.58) / 0.12; a.dx += 480 * ease_in(u); a.yaw = YAW + 110 * ease_io(u / 0.5)
        elif k < 0.76: a.show = False
        else:
            u = (k - 0.76) / 0.24; a.dx += -480 * (1 - ease_out(u / 0.7)); a.yaw = YAW + 110 * (1 - ease_io((u - 0.7) / 0.3))
            a.roll = -14 * bump((u - 0.55) / 0.35)
            for l in ('leg1', 'leg2', 'leg3', 'leg4'): addrot(a, l, y=30 * self.ls(t, 16))

class Buoy(Base):
    def move(self, a, t):
        a.dy += 20 * self.ls(t, 1); a.roll = 7 * self.ls(t, 1, math.pi / 2); addrot(a, 'root', x=6 * self.ls(t, 1, math.pi / 2))

class Approach(Base):
    """swims in from far away, stays, swims off again (辛苦了 / 真的吗)."""
    cover_k = 0.6
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.42: z = ease_out(k / 0.42)
        elif k < 0.8: z = 1
        else: z = 1 - ease_in((k - 0.8) / 0.2)
        a.zoom = 0.38 + 0.62 * z; a.dy -= 52 * (1 - z); a.dx += 60 * (1 - z)
        if k >= 0.8: a.yaw = YAW + 150 * ease_io((k - 0.8) / 0.08)
        swim = 0 if 0.42 <= k < 0.8 else 1
        for l in ('leg1', 'leg2', 'leg3', 'leg4'): addrot(a, l, y=25 * self.ls(t, 12) * swim)

class Hiccup(Base):
    def move(self, a, t):
        k = self.ph(t, 2)
        if k < 0.16:
            b = bump(k / 0.16); a.dy -= 26 * b; a.sy = 1 + 0.1 * b; a.sx = 1 - 0.05 * b
            a.pose['_face'] = {'L': 'big', 'R': 'big', 'mouth': 'o'}
        self._k = k
    def draw_top(self, img, d, t):
        if self.LAST is None or not 0.02 < self._k < 0.5: return
        hx, hy = self.head_pt((0, 9, -7.5)); u = (self._k - 0.02) / 0.48
        put(img, icon('hic', 5), hx + 60 + 20 * u, hy - 40 - 70 * u, 0.6 + 0.6 * u, 0, clamp((1 - u) / 0.3))

class Kowtow(Base):
    def setup(self):
        for i in range(4): self.splash((i + 0.27) * self.T / 4, x=-70, n=5, power=0.35, spread=25)
    def move(self, a, t):
        k = self.ph(t, 4); b = ease_io(bump(k / 0.55)) if k < 0.55 else 0
        addrot(a, 'head', x=-55 * b); addrot(a, 'root', x=-24 * b); a.dy += 30 * b

class FlipOver(Base):
    def setup(self): self.splash(0.42 * self.T, n=12, power=0.7); self.splash(0.9 * self.T, n=12, power=0.7)
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.3: r = 0
        elif k < 0.45: r = 180 * ease_out_back((k - 0.3) / 0.15, 1.2)
        elif k < 0.75: r = 180
        elif k < 0.92: r = 180 + 180 * ease_io((k - 0.75) / 0.17)
        else: r = 360
        h = math.sin(math.radians(r / 2)) ** 2
        a.pose['root'] = {'rot': (8 * math.cos(math.radians(r)), 0, r), 'move': (0, 15 * h, 0)}
        a.dy += 22 * h
        if 0.45 <= k < 0.75:
            for l in ('leg1', 'leg2', 'leg3', 'leg4'): addrot(a, l, x=20 * self.ls(t, 8, l == 'leg2'))

class Wobble(Base):
    def move(self, a, t):
        k = self.ph(t, 2); e = math.exp(-k * 4.5) * math.sin(k * 2 * math.pi * 3.5)
        a.sx = 1 + 0.2 * e; a.sy = 1 - 0.18 * e; a.roll = 9 * e; a.dy += 10 * e

class ShakeOff(Base):
    """dog-style shake, flinging water (洗澡 / 清下缓存)."""
    def move(self, a, t):
        k = self.ph(t); s_ = window(k, 0.15, 0.6, 0.06); self._s = s_
        a.roll = 20 * s_ * self.ls(t, 22); addrot(a, 'head', y=25 * s_ * self.ls(t, 22, 1)); a.dy -= 10 * s_
        if s_ > 0.5: a.pose['_face'] = {'L': 'squeeze', 'R': 'squeeze', 'mouth': 'w'}
    def draw_front(self, img, d, t):
        if self._s < 0.2 or self.LAST is None: return
        hx, hy = self.head_pt((0, 6, 0))
        for j in range(10):
            u = (t / self.T * 6 + j / 10) % 1.0; ang = 2 * math.pi * j / 10 + 0.4
            x = hx + math.cos(ang) * (40 + 120 * u); y = hy + math.sin(ang) * (30 + 70 * u) + 60 * u * u
            sq(d, x, y, 10 * (1 - u) + 3, (150, 215, 255, int(255 * self._s)), (90, 170, 235))

class Pounce(Base):
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.22: c = bump(k / 0.22); a.dy += 14 * c; a.sy = 1 - 0.07 * c
        elif k < 0.36: u = ease_out((k - 0.22) / 0.14); a.zoom = 1 + 0.45 * u; a.dy -= 46 * u; addrot(a, 'root', x=15)
        elif k < 0.62: a.zoom = 1.45 + 0.02 * self.ls(t, 8); a.dy -= 46
        else: u = ease_io((k - 0.62) / 0.25); a.zoom = 1.45 - 0.45 * u; a.dy -= 46 * (1 - u)

class Nuzzle(Base):
    def move(self, a, t):
        a.roll = 7 * self.ls(t, 4); addrot(a, 'head', z=10 * self.ls(t, 4, math.pi), y=12 * self.ls(t, 4))
        a.dx += 6 * self.ls(t, 4); a.dy -= 4 * abs(self.ls(t, 4))

class Circle(Base):
    """swims a little circle in place."""
    def move(self, a, t):
        ang = 2 * math.pi * self.ph(t) + math.pi / 2
        a.dx += 75 * math.cos(ang); a.dy += 14 * math.sin(ang); a.zoom = 1 + 0.1 * math.sin(ang)
        a.yaw = 270 - math.degrees(ang + math.pi / 2)
        for l in ('leg1', 'leg2', 'leg3', 'leg4'): addrot(a, l, y=25 * self.ls(t, 12, l in ('leg1', 'leg4')))
        addrot(a, 'tail', y=25 * self.ls(t, 6)); self.ripple_dx = a.dx

class HeadBob(Base):
    def move(self, a, t):
        addrot(a, 'head', z=15 * self.ls(t, 4), x=4 * abs(self.ls(t, 8))); a.roll = 4 * self.ls(t, 4); a.dy -= 5 * abs(self.ls(t, 8))

class Hide(Base):
    """ducks under until only the eyes show, peeks around, comes back up."""
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.25: h = 0
        elif k < 0.78: h = ease_io((k - 0.25) / 0.15)
        else: h = 1 - ease_out_back((k - 0.78) / 0.18, 1.3)
        a.dy += 60 * h; addrot(a, 'head', y=24 * h * clamp(1.8 * self.ls(t, 2), -1, 1), x=-6 * h)

class Rise(Base):
    """rises proudly out of the water, chin up (得意 / 国王驾到)."""
    cover_k = 0.42
    def move(self, a, t):
        k = self.ph(t)
        r = ease_out_back(k / 0.28, 1.6) if k < 0.75 else 1 - ease_io((k - 0.75) / 0.25)
        a.dy -= 48 * r; addrot(a, 'head', x=16 * r); addrot(a, 'root', x=8 * r); a.sy = 1 + 0.04 * r

class Recoil(Base):
    """startled jolt backwards, trembling (不会吧 / 离谱)."""
    def move(self, a, t):
        k = self.ph(t)
        if k < 0.12: r = 0
        elif k < 0.78: r = ease_out_back((k - 0.12) / 0.12, 2.5)
        else: r = 1 - ease_io((k - 0.78) / 0.18)
        a.zoom = 1 - 0.2 * r; a.dy -= 30 * r; a.dx += 2.5 * r * self.ls(t, 30); addrot(a, 'head', x=14 * r)
        if 0.12 < k < 0.3: a.pose['_face'] = {'L': 'big', 'R': 'big', 'mouth': 'shout'}

class Bonk(Base):
    """swims at the camera and bonks an invisible wall (进不去)."""
    def move(self, a, t):
        k = self.ph(t, 2); self._k = k
        if k < 0.3: a.zoom = 1 + 0.3 * ease_in(k / 0.3); a.dy -= 25 * ease_in(k / 0.3)
        elif k < 0.42: a.zoom = 1.3; a.dy -= 25; b = bump((k - 0.3) / 0.12); a.sx = 1 + 0.14 * b; a.sy = 1 - 0.1 * b
        else: u = ease_out((k - 0.42) / 0.4); a.zoom = 1.3 - 0.3 * u; a.dy -= 25 * (1 - u)
        if 0.3 <= k < 0.6: a.pose['_face'] = {'L': 'squeeze', 'R': 'squeeze', 'mouth': 'wavy'}
    def draw_top(self, img, d, t):
        if self.LAST is None or not 0.3 <= self._k < 0.62: return
        hx, hy = self.head_pt(); u = (self._k - 0.3) / 0.32
        for j in range(3):
            a_ = 2 * math.pi * (u + j / 3)
            star(d, hx + 70 * math.cos(a_), hy - 60 + 14 * math.sin(a_), 12 * (1 - u * 0.5), (255, 214, 64))

class Flip(Jump):
    def __init__(self, spec): super().__init__(dict(spec, flip=1))

motions.REG.update({
    'popup': Popup, 'slosh': Slosh, 'sidehop': SideHop, 'sway': Sway, 'tantrum': Tantrum, 'petrify': Petrify, 'melt': Melt,
    'stretch': Stretch, 'lookup': LookUp, 'turnaway': TurnAway, 'glitch': Glitch, 'squish': Squish, 'slidein': SlideIn,
    'buoy': Buoy, 'approach': Approach, 'hiccup': Hiccup, 'kowtow': Kowtow, 'flipover': FlipOver, 'wobble': Wobble,
    'shakeoff': ShakeOff, 'pounce': Pounce, 'nuzzle': Nuzzle, 'circle': Circle, 'headbob': HeadBob, 'hide': Hide,
    'rise': Rise, 'recoil': Recoil, 'bonk': Bonk, 'flip': Flip,
})
