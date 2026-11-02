"""水龙卷：水面被整个卷起来——龙卷和底下的水是同一块水（同色、同一条白色水线一路沿着龙卷边缘爬上去），
螺旋水带高速旋转、边缘甩出水滴、底部喷溅、风圈环绕；美西螈一脸呆滞地被卷着绕圈、各个方向 3D 翻滚，
同时卷着原版 MC 的铁头盔、海龟壳、美西螈桶、热带鱼、TNT 一起转。
python engine/tornado.py [文字|-] [输出.gif]      文字为 - 时出无字版
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
import axl, items, rig2
from axl import (Sticker, Ax, W, H, FPS, BOX, BOX_CX, BOX_CY, SCL_BOX, ANCHOR_OFF, render_ax, place, _affine,
                 sq, clamp, lerp)
from rig import rot_euler

WATER = (170, 222, 255); LIP = (150, 210, 255, 150); LINE = (255, 255, 255, 230); DROP_EDGE = (90, 170, 235)
TINT = np.array([120, 190, 255], np.float32)


class Tornado(Sticker):
    T = 48 / FPS            # 3.2 s loop
    calm = 1.3

    def __init__(self, spec):
        super().__init__(spec)
        lo = bool(self.text)
        self.wl = axl.WATER_Y
        self.top = 60 if lo else -40
        self.az = 0.58 if lo else 0.68
        self.orb = (300, 22, 10, 10) if lo else (212, 42, 16, 10)          # centre y, swing, depth bob, gap off the wall
        # (kind, scale, centre y, swing, gap, laps per loop, phase, tumble turns (x, y, z))
        self.debris = ([('iron_helmet3d', 0.62, 236, 10, 64, 2, 0.15, (2, 1, 1)), ('mc_axolotl_bucket', 1.2, 352, 8, 58, 2, 0.62, (1, 2, 1)),
                        ('tnt3d', 0.6, 330, 12, 84, 1, 0.4, (1, 1, 2))] if lo else
                       [('iron_helmet3d', 0.7, 92, 20, 84, 2, 0.15, (2, 1, 1)), ('mc_axolotl_bucket', 1.3, 130, 16, 124, 1, 0.62, (1, 1, 2)),
                        ('turtle_helmet3d', 0.66, 352, 10, 74, 2, 0.7, (1, 2, 1)), ('tnt3d', 0.6, 300, 14, 132, 1, 0.1, (1, 2, 1))])
        rng = random.Random(11)
        self.bub = [dict(th=rng.uniform(0, 2 * math.pi), ph=rng.random(), s=rng.choice((6, 8, 10))) for _ in range(14)]
        self.fling = [dict(ph=rng.random(), u=rng.uniform(0.15, 0.85), side=rng.choice((-1, 1)), v=rng.uniform(150, 260),
                           s=rng.choice((7, 9, 11))) for _ in range(16)]
        self.spray = [dict(th=rng.uniform(0, 2 * math.pi), ph=rng.random(), v=rng.uniform(70, 160), up=rng.uniform(180, 300),
                           s=rng.choice((7, 9, 11, 13))) for _ in range(30)]
        self.wind = [dict(u=rng.uniform(0.1, 0.8), ph=rng.random(), L=rng.uniform(0.7, 1.2), gap=rng.uniform(16, 40)) for _ in range(6)]
        items.load_mc()

    # ---------------- shape ----------------
    def u(self, y): return clamp((y - self.top) / (self.wl - self.top))
    def r(self, y, t=0.0):
        u = self.u(y)
        core = 24 + 166 * (1 - u) ** 1.7
        flare = 66 * math.exp(-max(0.0, self.wl - y) / 20)                  # skirts out into the water surface
        return (core + flare) * (1 + 0.035 * math.sin(2 * math.pi * 3 * t / self.T + 6 * u))
    def cx(self, y, t):
        u = self.u(y)
        return W / 2 + 40 * (1 - u) ** 1.2 * math.sin(2 * math.pi * 0.85 * u - 2 * math.pi * 2 * t / self.T) + 10 * self.ls(t, 1)
    def spin(self, t): return 2 * math.pi * 4 * t / self.T

    def water_y(self, x, t):
        cb = self.cx(self.wl, t)
        base = self.wl + 5 * math.sin(x / 38 + 2 * math.pi * 3 * t / self.T) + 3 * math.sin(x / 17 - 2 * math.pi * 4 * t / self.T)
        churn = 7 * math.exp(-((x - cb) / 110) ** 2) * math.sin(x / 13 - 2 * math.pi * 6 * t / self.T)
        return base + churn

    def edges(self, t):
        """left & right silhouette from the top down to where they meet the water."""
        ys = list(np.arange(self.top, self.wl - 2, 5))
        L = [(self.cx(y, t) - self.r(y, t), y) for y in ys]; R = [(self.cx(y, t) + self.r(y, t), y) for y in ys]
        L.append((L[-1][0] - 6, self.water_y(L[-1][0] - 6, t))); R.append((R[-1][0] + 6, self.water_y(R[-1][0] + 6, t)))
        return L, R

    def union(self, t, L, R):
        xl, xr = L[-1][0], R[-1][0]
        left = [(x, self.water_y(x, t)) for x in range(-8, int(xl), 8)]
        right = [(x, self.water_y(x, t)) for x in range(int(xr) + 8, W + 16, 8)]
        return left, right

    # ---------------- funnel surface ----------------
    def draw_bands(self, d, t, L):
        sp = self.spin(t)
        ys = [y for _, y in L[:-1]]
        for k in range(3):
            a0 = 2 * math.pi * k / 3
            rows = []
            for y in ys:
                u = self.u(y); c, r = self.cx(y, t), self.r(y, t) - 3
                a = a0 + 2 * math.pi * 1.5 * u + sp
                lo_, hi_ = a % (2 * math.pi), a % (2 * math.pi) + 0.6
                lo_c, hi_c = max(lo_, 0.04), min(hi_, math.pi - 0.04)
                rows.append((y, c + r * math.cos(hi_c), c + r * math.cos(lo_c)) if hi_c > lo_c else None)
            for r0, r1 in zip(rows, rows[1:]):
                if r0 and r1:
                    d.polygon([(r0[1], r0[0]), (r0[2], r0[0]), (r1[2], r1[0]), (r1[1], r1[0])], fill=LIP[:3] + (205,))
            seg = []
            for row in rows + [None]:
                if row: seg.append((row[2], row[0]))
                elif len(seg) > 1: d.line(seg, fill=(255, 255, 255, 220), width=4); seg = []
                else: seg = []

    def draw_bubbles(self, d, t):
        sp = self.spin(t)
        for b in self.bub:
            k = (t / self.T * 2 + b['ph']) % 1.0
            y = self.wl - 16 - k * (self.wl - max(self.top, 0) - 40)
            c, r = self.cx(y, t), self.r(y, t) * 0.7
            a = b['th'] + sp * 0.8 + k * 5
            if math.sin(a) < 0.1: continue
            x = c + r * math.cos(a)
            d.rectangle((x, y, x + b['s'], y + b['s']), outline=(255, 255, 255, 235), width=2)

    def draw_wind(self, d, t, front):
        sp = self.spin(t) * 0.75
        for w_ in self.wind:
            y = self.top + w_['u'] * (self.wl - self.top)
            if y < (205 if self.text else 0): continue
            c, r = self.cx(y, t), self.r(y, t) + w_['gap']
            a0 = (2 * math.pi * w_['ph'] + sp) % (2 * math.pi)
            pts = []
            for i in range(10):
                a = a0 + w_['L'] * i / 9
                if (math.sin(a) > 0) != front: continue
                pts.append((c + r * math.cos(a), y + r * 0.2 * math.sin(a)))
            if len(pts) > 1: d.line(pts, fill=(255, 255, 255, 230 if front else 140), width=4)

    def draw_fling(self, d, t):
        """droplets thrown off the edges of the funnel."""
        for f in self.fling:
            k = (t / self.T * 3 + f['ph']) % 1.0
            y0 = self.top + f['u'] * (self.wl - self.top)
            if y0 < (205 if self.text else 0): continue
            tt = k * 0.7
            x0 = self.cx(y0, t) + f['side'] * self.r(y0, t)
            x = x0 + f['side'] * f['v'] * tt; y = y0 - 40 * tt + 420 * tt * tt
            s = f['s'] * (1 - k * 0.6)
            if y < self.water_y(x, t): sq(d, x, y, s, (255, 255, 255, 255) if f['s'] > 8 else (200, 236, 255, 255), DROP_EDGE)

    def draw_spray(self, d, t, front):
        cb = self.cx(self.wl, t)
        for s_ in self.spray:
            k = (t / self.T * 2 + s_['ph']) % 1.0
            tt = k * 0.9
            a = s_['th'] + self.spin(t) * 0.3
            vis = math.sin(a)
            if (vis > 0) != front: continue
            rr = 40 + s_['v'] * tt
            x = cb + rr * math.cos(a); y = self.wl - 6 + rr * 0.18 * vis - s_['up'] * tt + 380 * tt * tt
            if y > self.water_y(x, t) + 2: continue
            sq(d, x, y, s_['s'] * (1 - 0.5 * k), (255, 255, 255, 255) if vis > 0 else (220, 240, 255, 255), DROP_EDGE)

    # ---------------- passengers ----------------
    def orbit_pt(self, t, ang, oy, ay, dz, gap):
        y = oy - ay * math.cos(ang) + dz * math.sin(ang)
        return self.cx(y, t) + (self.r(y, t) + gap) * math.cos(ang), y

    def axo(self, t):
        ph = self.spin(t) * 0.75 + math.radians(100)          # 3 laps per loop
        vis = math.sin(ph)
        a = Ax(); p = a.pose
        p['head'] = {'rot': (0, 0, 0)}
        p['left_gills'] = {'rot': (0, 30, 0)}; p['right_gills'] = {'rot': (0, -30, 0)}; p['top_gills'] = {'rot': (-25, 0, 0)}
        p['tail'] = {'rot': (0, 0, 0)}
        p['leg3'] = {'set': (80, -95, 0), 'move': (0, -1.5, 0)}; p['leg4'] = {'set': (80, 95, 0), 'move': (0, -1.5, 0)}
        p['leg1'] = {'set': (-80, 95, 0), 'move': (0, -1.5, 0)}; p['leg2'] = {'set': (-80, -95, 0), 'move': (0, -1.5, 0)}
        u = t / self.T                                          # 3D tumble about the body centre
        rx, ry, rz = 360 * 2 * u + 30, 360 * 1 * u, 360 * 3 * u
        R = rot_euler(rx, ry, rz); piv = np.array([0, 6, 2.0])
        p['root'] = {'rot': (rx, ry, rz), 'move': tuple(piv - R @ piv)}
        p['_face'] = {}                                         # the original dot eyes: completely unbothered
        a.yaw = 270 - math.degrees(ph)
        a.zoom = self.az * (0.9 + 0.12 * vis)
        oy, ay, dz, gap = self.orb
        x, y = self.orbit_pt(t, ph, oy, ay, dz, gap)
        self.place_anchor(a, x, y)
        return a, vis, ph

    def place_anchor(self, a, X, Y):
        ab = np.array([BOX / 2 + ANCHOR_OFF[0] * SCL_BOX * BOX, BOX / 2 - ANCHOR_OFF[1] * SCL_BOX * BOX])
        a.dx = a.dy = 0
        Mx, _ = _affine(a)
        v = Mx @ (ab - BOX / 2)
        a.dx = X - BOX_CX - v[0]; a.dy = Y - BOX_CY - v[1]

    def debris_state(self, t):
        out = []
        u = t / self.T
        for kind, s, oy, ay, gap, laps, ph0, (tx, ty, tz) in self.debris:
            ang = 2 * math.pi * (laps * u + ph0)
            vis = math.sin(ang)
            x, y = self.orbit_pt(t, ang, oy, ay, ay * 0.4, gap)
            S = 170
            pose = {'_items': [dict(kind=kind, at='world', x=0, y=0, z=0, s=s,
                                    rx=360 * tx * u + 20, ry=360 * ty * u + 40 * ph0, rz=360 * tz * u)]}
            zoom = self.az * (0.9 + 0.12 * vis)
            im = rig2.render(pose, yaw=180, pitch=20, size=S, ss=2, center=(0, 0), scale=SCL_BOX * zoom * BOX / S, only=['item'])
            out.append(dict(im=im, x=x, y=y, vis=vis, ang=ang, oy=oy, ay=ay, gap=gap))
        return out

    def trail(self, d, t, ang, oy, ay, dz, gap, width, front):
        pts = []
        for i in range(8):
            a = ang - 0.12 - 0.07 * i
            if (math.sin(a) > 0) != front: break
            pts.append(self.orbit_pt(t, a, oy, ay, dz, gap))
        for i, (p0, p1) in enumerate(zip(pts, pts[1:])):
            d.line([p0, p1], fill=(255, 255, 255, int(220 * (1 - i / 7))), width=max(2, int(width * (1 - i / 8))))

    # ---------------- frame ----------------
    def frame(self, fi):
        t = fi / FPS
        img = Image.new('RGBA', (W, H), (255, 255, 255, 255))
        a, vis, ph = self.axo(t); self.A = a
        im, self.LAST = render_ax(a)
        ax_layer = place(im, a)
        deb = self.debris_state(t)
        L, R = self.edges(t)
        left, right = self.union(t, L, R)
        oy, ay, dz, gap = self.orb

        # behind the funnel
        back = Image.new('RGBA', (W, H), (0, 0, 0, 0)); bd = ImageDraw.Draw(back)
        self.draw_wind(bd, t, False)
        self.draw_spray(bd, t, False)
        for o in deb:
            if o['vis'] <= 0: back.alpha_composite(o['im'], (int(o['x'] - o['im'].width / 2), int(o['y'] - o['im'].height / 2)))
        if vis <= 0: back.alpha_composite(ax_layer)
        img.alpha_composite(back)

        # the water and the funnel are one body of water
        body = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(body)
        shape = [(-8, H + 8)] + left + L[::-1] + R + right + [(W + 16, H + 8)]
        d.polygon(shape, fill=WATER + (255,))
        if self.top > 0:                                       # fade the top out behind the text
            al = np.asarray(body.getchannel('A')).astype(np.float32)
            body.putalpha(Image.fromarray((al * np.clip((np.arange(H) - self.top) / 60.0, 0, 1)[:, None]).astype(np.uint8)))
        mask = body.getchannel('A')
        img.alpha_composite(body)
        # things behind stay faintly visible through the water
        ghost = np.asarray(back).astype(np.float32)
        ghost[..., :3] = ghost[..., :3] * 0.4 + TINT * 0.6
        ghost[..., 3] *= (np.asarray(mask, np.float32) / 255.0) * 0.55
        img.alpha_composite(Image.fromarray(ghost.astype(np.uint8)))

        # ripples around the foot (back halves)
        cb = self.cx(self.wl, t)
        rings = []
        per = self.T / 4
        for k in range(4):
            tt = (t + k * per / 4) % per
            r = 90 + tt / per * 200; al = int(230 * (1 - tt / per))
            rings.append(((cb - r, self.wl + 4 - r * 0.17, cb + r, self.wl + 4 + r * 0.17), al))
        rl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); rd = ImageDraw.Draw(rl)
        for bx, al in rings: rd.arc(bx, 180, 360, fill=(255, 255, 255, al), width=4)
        img.alpha_composite(rl)

        # spinning surface
        sl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sl)
        self.draw_bands(sd, t, L)
        self.draw_bubbles(sd, t)
        if self.top > 0:
            al = np.asarray(sl.getchannel('A')).astype(np.float32)
            sl.putalpha(Image.fromarray((al * np.clip((np.arange(H) - self.top - 20) / 60.0, 0, 1)[:, None]).astype(np.uint8)))
        img.alpha_composite(sl)

        # in front
        fr = Image.new('RGBA', (W, H), (0, 0, 0, 0)); fd = ImageDraw.Draw(fr)
        self.trail(fd, t, ph, oy, ay, dz, gap, 8, True)
        for o in deb:
            if o['vis'] > 0: self.trail(fd, t, o['ang'], o['oy'], o['ay'], o['ay'] * 0.4, o['gap'], 5, True)
        img.alpha_composite(fr)
        for o in sorted([o for o in deb if o['vis'] > 0], key=lambda o: o['vis']):
            if o['vis'] < vis or vis <= 0: img.alpha_composite(o['im'], (int(o['x'] - o['im'].width / 2), int(o['y'] - o['im'].height / 2)))
        if vis > 0: img.alpha_composite(ax_layer)
        for o in deb:
            if o['vis'] > 0 and vis > 0 and o['vis'] >= vis:
                img.alpha_composite(o['im'], (int(o['x'] - o['im'].width / 2), int(o['y'] - o['im'].height / 2)))

        # water front lip + one continuous white water line that climbs the funnel walls
        lip = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(lip)
        front = [(x, self.water_y(x, t) + 14) for x in range(-8, W + 16, 8)] + [(W + 8, H + 8), (-8, H + 8)]
        ld.polygon(front, fill=LIP)
        ld.line(left + L[::-1], fill=LINE, width=5)
        ld.line(R + right, fill=LINE, width=5)
        for bx, al in rings: ld.arc(bx, 0, 180, fill=(255, 255, 255, al), width=4)
        if self.top > 0:
            al = np.asarray(lip.getchannel('A')).astype(np.float32)
            lip.putalpha(Image.fromarray((al * np.clip((np.arange(H) - self.top) / 60.0, 0, 1)[:, None]).astype(np.uint8)))
        img.alpha_composite(lip)
        d = ImageDraw.Draw(img)
        self.draw_wind(d, t, True)
        self.draw_fling(d, t)
        self.draw_spray(d, t, True)
        self.draw_text(img, t)
        return img.convert('RGB')


if __name__ == '__main__':
    text = sys.argv[1] if len(sys.argv) > 1 else '我没事'
    if text == '-': text = ''
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(axl.ROOT, 'out', '水龙卷_' + (text or '无字') + '.gif')
    stk = Tornado(dict(text=text, tmode='stay', text_y=110))
    if os.environ.get('AXL_PREVIEW'):
        axl.preview(stk, [float(v) for v in os.environ['AXL_PREVIEW'].split(',')], out[:-4] + '_preview.png', 0.6)
    else:
        print(out, axl.export(stk, out))
