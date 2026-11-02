"""2D effects. Each factory returns f(stk, img, d, t, layer) drawing only on its own layer ('back' | 'front' | 'top')."""
import math, random
import numpy as np
from PIL import Image, ImageDraw
from axl import W, H, icon, put, star, sq, clamp, bump, ease_out, ease_out_back, elastic, lerp

def _on(layer, want): return layer == want

def twinkle(amt=1.0):
    def f(s, img, d, t, layer):
        if layer == 'top': s.twinkles(d, t, amt)
    return f

def floaters(name, n=4, k=4, src='head', rise=150, spread=60, period=None, layer='top', sway=12, life=0.75, dx=0, dy=-30):
    """icons rising from the head (hearts, notes, zzz, flowers...)."""
    rng = random.Random(hash(name) & 0xfff)
    off = [(rng.uniform(-spread, spread), rng.random(), rng.uniform(0.75, 1.15)) for _ in range(n)]
    def f(s, img, d, t, lay):
        if lay != layer or s.LAST is None: return
        hx, hy = s.head_pt() if src == 'head' else src
        per = period or s.T / 2
        for i, (ox, ph, sc) in enumerate(off):
            k_ = ((t / per) + i / n) % 1.0
            if k_ > life: continue
            u = k_ / life
            x = hx + dx + ox * (0.4 + 0.6 * u) + sway * math.sin(u * 6 + i)
            y = hy + dy - rise * u
            a = clamp(u / 0.15) * clamp((1 - u) / 0.3)
            put(img, icon(name, k), x, y, sc * (0.6 + 0.4 * ease_out_back(u / 0.3)), 0, a)
    return f

def fall(name, n=10, k=4, layer='top', spin=True, speed=1.0, area=(0, W), stop=None):
    """icons falling from the top (confetti, coins, snow, leaves)."""
    rng = random.Random(hash(name) & 0xff)
    P = [dict(x=rng.uniform(*area), ph=rng.random(), sp=rng.uniform(0.8, 1.2), r=rng.uniform(-1, 1), sc=rng.uniform(0.7, 1.1))
         for _ in range(n)]
    cols = [(255, 62, 140), (255, 200, 60), (90, 190, 255), (60, 200, 120), (180, 120, 255)]
    def f(s, img, d, t, lay):
        if lay != layer: return
        for i, p in enumerate(P):
            u = (t / s.T * round(max(1, speed)) * p['sp'] + p['ph']) % 1.0
            y = -30 + u * ((stop or H) + 60)
            x = p['x'] + 18 * math.sin(u * 8 + i)
            if name == 'confetti':
                c = cols[i % len(cols)]; w = 10 * abs(math.cos(u * 9 + i)) + 3
                d.rectangle((x - w / 2, y - 5, x + w / 2, y + 5), fill=c + (255,))
            else:
                put(img, icon(name, k), x, y, p['sc'], (p['r'] * 360 * u) if spin else 0)
    return f

def pop_icon(name, k=6, at=(60, -95), period=None, rot=0, sway=True, layer='top', head=True, n_beats=2):
    """icon pops above/next to the head and pulses."""
    def f(s, img, d, t, lay):
        if lay != layer or (head and s.LAST is None): return
        hx, hy = s.head_pt() if head else (0, 0)
        per = s.T / n_beats
        u = (t % per) / per
        sc = elastic(u / 0.35) if u < 0.35 else 1 + 0.05 * math.sin(u * 12)
        if u > 0.9: sc *= 1 - (u - 0.9) / 0.1 * 0.25
        r = rot + (8 * math.sin(2 * math.pi * t / s.T * 2) if sway else 0)
        put(img, icon(name, k), hx + at[0], hy + at[1], sc, r)
    return f

def stay_icon(name, k=6, at=(60, -95), bob=6, rot=0, layer='top', head=True, beat=4):
    def f(s, img, d, t, lay):
        if lay != layer or (head and s.LAST is None): return
        hx, hy = s.head_pt() if head else (0, 0)
        y = hy + at[1] + bob * s.ls(t, beat)
        put(img, icon(name, k), hx + at[0], y, 1 + 0.04 * s.ls(t, beat * 2), rot + 4 * s.ls(t, 2))
    return f

def question(n=2):
    spots = [(70, -100, 0), (110, -60, 18), (30, -140, -12)][:n]
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt()
        for i, (ox, oy, r) in enumerate(spots):
            u = (t / s.T * 2 + i * 0.3) % 1.0
            sc = elastic(u / 0.3) if u < 0.3 else 1
            if u > 0.85: sc *= 1 - (u - 0.85) / 0.15
            put(img, icon('question', 6 if i == 0 else 5), hx + ox, hy + oy + 4 * math.sin(u * 9), sc, r + 6 * math.sin(u * 7))
    return f

def exclaim(n=1):
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt()
        u = (t / s.T * 2) % 1.0
        sc = elastic(u / 0.25) if u < 0.25 else 1
        x, y = hx + 70, hy - 105
        for k in range(n): put(img, icon('exclaim', 7), x + k * 26, y - 6 * bump(u / 0.2), sc, -10 + k * 14)
        if u < 0.4:
            a = 1 - u / 0.4
            for j in range(5):
                ang = math.radians(-150 + j * 30); r0 = 45 + 30 * u / 0.4; r1 = r0 + 22
                d.line((x + math.cos(ang) * r0, y + math.sin(ang) * r0, x + math.cos(ang) * r1, y + math.sin(ang) * r1),
                       fill=(255, 59, 78, int(255 * a)), width=5)
    return f

def shock_lines():
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt()
        u = (t / s.T * 4) % 1.0
        for j in range(8):
            ang = math.radians(j * 45 + 22)
            r0 = 85 + 15 * u; r1 = r0 + 26
            if math.sin(ang) > 0.5: continue
            d.line((hx + math.cos(ang) * r0, hy - 10 + math.sin(ang) * r0 * 0.9, hx + math.cos(ang) * r1, hy - 10 + math.sin(ang) * r1 * 0.9),
                   fill=(60, 60, 70, int(255 * (1 - u))), width=5)
    return f

def anger(at=(-62, -62)):
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt()
        u = (t / s.T * 4) % 1.0
        put(img, icon('anger', 6), hx + at[0], hy + at[1], 1 + 0.25 * math.exp(-u * 6), 0)
    return f

def sweat(side=1, big=False):
    def f(s, img, d, t, lay):
        if lay != 'front' or s.LAST is None: return
        hx, hy = s.head_pt()
        u = (t / s.T * 2) % 1.0
        put(img, icon('sweat', 7 if big else 5), hx - side * 62, hy - 48 + 30 * ease_out(u), 1, 0, clamp((1 - u) / 0.3))
    return f

def panic():
    rng = random.Random(5)
    P = [(rng.uniform(-1, 1), rng.random()) for _ in range(6)]
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt()
        for i, (dirx, ph) in enumerate(P):
            u = (t / s.T * 3 + ph) % 1.0
            x = hx + dirx * 140 * u; y = hy - 40 - 90 * u + 160 * u * u
            put(img, icon('drop', 5), x, y, 1, -dirx * 40, clamp((1 - u) / 0.3))
    return f

def tears(stream=False):
    def f(s, img, d, t, lay):
        if lay != 'front' or s.LAST is None: return
        for side, (ex, ey) in zip((1, -1), s.eye_pts()):
            if stream:
                for j in range(7):
                    u = (t / s.T * 4 + j / 7) % 1.0
                    x = ex + side * (70 * u); y = ey + 8 - 40 * u + 120 * u * u
                    sq(d, x, y, 10 - 4 * u, (124, 200, 255, 255), (60, 140, 220))
            else:
                for j in range(2):
                    u = (t / s.T * 2 + j * 0.5) % 1.0
                    put(img, icon('drop', 4), ex + side * 6, ey + 12 + 70 * u * u, 1, 0, clamp((1 - u) / 0.3))
    return f

def rain(cloud='dark'):
    rng = random.Random(9)
    D = [(rng.uniform(-60, 60), rng.random()) for _ in range(9)]
    def f(s, img, d, t, lay):
        if s.LAST is None: return
        hx, hy = s.head_pt()
        cx, cy = hx, hy - 150 + 4 * s.ls(t, 2)
        if lay == 'back':
            for ox, ph in D:
                u = (t / s.T * 4 + ph) % 1.0
                x = cx + ox; y = cy + 20 + u * 160
                d.line((x, y, x - 4, y + 16), fill=(108, 170, 235, 255), width=4)
        if lay == 'top':
            put(img, icon(cloud, 9), cx, cy, 1, 0)
    return f

def bulb():
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt()
        u = (t / s.T * 2) % 1.0
        x, y = hx + 10, hy - 125
        sc = elastic(u / 0.3) if u < 0.3 else 1
        if u > 0.2:
            for j in range(8):
                ang = math.radians(j * 45); r0 = 52; r1 = 52 + 18 * (1 + 0.3 * math.sin(u * 20))
                d.line((x + math.cos(ang) * r0, y + math.sin(ang) * r0, x + math.cos(ang) * r1, y + math.sin(ang) * r1),
                       fill=(255, 200, 40, 255), width=5)
        put(img, icon('bulb', 7), x, y, sc)
    return f

def fireworks(n=3):
    rng = random.Random(11)
    B = [dict(x=rng.uniform(70, 440), y=rng.uniform(220, 320), ph=i / n,
              c=rng.choice(((255, 62, 140), (255, 200, 60), (90, 190, 255), (60, 200, 120)))) for i in range(n)]
    def f(s, img, d, t, lay):
        if lay != 'back': return
        for b in B:
            u = (t / s.T + b['ph']) % 1.0
            if u < 0.55:
                k = u / 0.55
                for j in range(12):
                    ang = j * math.pi / 6; r = 55 * ease_out(k)
                    x = b['x'] + math.cos(ang) * r; y = b['y'] + math.sin(ang) * r + 20 * k * k
                    sq(d, x, y, 9 * (1 - k) + 2, b['c'] + (255,))
    return f

def dizzy(n=3, name='star'):
    def f(s, img, d, t, lay):
        if lay not in ('back', 'top') or s.LAST is None: return
        hx, hy = s.head_pt((0, 10, -7.5))
        for i in range(n):
            a = 2 * math.pi * (t / s.T * 2 + i / n)
            front = math.sin(a) > 0
            if (lay == 'top') != front: continue
            x = hx + 70 * math.cos(a); y = hy - 18 + 16 * math.sin(a)
            put(img, icon(name, 4), x, y, 0.8 + 0.25 * math.sin(a), 0)
    return f

def orbit(name, n=3, r=(150, 40), k=4, cy=0, speed=1):
    def f(s, img, d, t, lay):
        if lay not in ('back', 'top') or s.LAST is None: return
        hx, hy = s.head_pt()
        for i in range(n):
            a = 2 * math.pi * (t / s.T * speed + i / n)
            front = math.sin(a) > 0
            if (lay == 'top') != front: continue
            put(img, icon(name, k), hx + r[0] * math.cos(a), hy + cy + r[1] * math.sin(a), 0.75 + 0.3 * math.sin(a), 0)
    return f

def steam():
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt((0, 9, -7.5))
        for side in (-1, 1):
            for j in range(3):
                u = (t / s.T * 4 + j / 3 + (0.5 if side > 0 else 0)) % 1.0
                x = hx + side * (40 + 40 * u); y = hy - 20 - 70 * u
                sc = 10 + 16 * u
                sq(d, x, y, sc, (255, 255, 255, int(255 * (1 - u))), (190, 196, 210, int(255 * (1 - u))), 3)
    return f

def gloom():
    def f(s, img, d, t, lay):
        if lay != 'back': return
        for j in range(7):
            x = 120 + j * 46 + 6 * math.sin(j)
            y0 = 190 + 10 * math.sin(j * 1.3) + 8 * s.ls(t, 2, j)
            d.line((x, y0, x, y0 + 70 + 20 * math.sin(j * 2.1)), fill=(150, 130, 210, 150), width=5)
    return f

def sparkles(n=6, area=(70, 180, 440, 400)):
    rng = random.Random(21)
    P = [(rng.uniform(area[0], area[2]), rng.uniform(area[1], area[3]), rng.random(), rng.uniform(8, 14)) for _ in range(n)]
    def f(s, img, d, t, lay):
        if lay != 'top': return
        for x, y, ph, r in P:
            a = max(0.0, math.sin(2 * math.pi * (t / s.T * 2 + ph)))
            if a > 0.1: star(d, x, y, r * a, (255, 214, 64), int(255 * a))
    return f

def speed(dirx=1, n=7):
    rng = random.Random(4)
    L = [(rng.uniform(220, 400), rng.random(), rng.uniform(60, 140)) for _ in range(n)]
    def f(s, img, d, t, lay):
        if lay != 'back': return
        for y, ph, ln in L:
            u = (t / s.T * 4 + ph) % 1.0
            x = W + 40 - u * (W + 200) if dirx > 0 else -40 + u * (W + 200)
            d.line((x, y, x + ln * dirx, y), fill=(190, 200, 215, 220), width=5)
    return f

def fire():
    rng = random.Random(8)
    P = [(rng.uniform(80, 430), rng.random(), rng.uniform(0.7, 1.2)) for _ in range(9)]
    def f(s, img, d, t, lay):
        if lay != 'back': return
        for x, ph, sc in P:
            u = (t / s.T * 3 + ph) % 1.0
            put(img, icon('flame', 7), x + 8 * math.sin(u * 7), 380 - 140 * u, sc * (1 - 0.6 * u), 0, clamp((1 - u) / 0.4))
    return f

def sun():
    def f(s, img, d, t, lay):
        if lay != 'back': return
        x, y = 440, 230
        for j in range(12):
            ang = math.radians(j * 30 + 15 * t / s.T * 4)
            d.line((x + math.cos(ang) * 44, y + math.sin(ang) * 44, x + math.cos(ang) * 62, y + math.sin(ang) * 62),
                   fill=(255, 200, 60, 255), width=6)
        d.ellipse((x - 36, y - 36, x + 36, y + 36), fill=(255, 210, 70, 255), outline=(240, 160, 30, 255), width=4)
    return f

def moon():
    def f(s, img, d, t, lay):
        if lay != 'back': return
        put(img, icon('moon', 9), 445, 235, 1, 0)
        for x, y, ph in ((60, 230, 0), (100, 300, 2), (400, 320, 4), (30, 330, 1)):
            a = 0.5 + 0.5 * math.sin(2 * math.pi * t / s.T * 2 + ph)
            star(d, x, y, 9 * a + 3, (255, 214, 64), int(255 * (0.4 + 0.6 * a)))
    return f

def blush_lines():
    def f(s, img, d, t, lay):
        if lay != 'front' or s.LAST is None: return
        for side, (ex, ey) in zip((1, -1), s.eye_pts()):
            x, y = ex - side * 2, ey + 22
            a = int(200 + 55 * s.ls(t, 4))
            for j in range(3):
                d.line((x - 12 + j * 9, y + 6, x - 6 + j * 9, y - 6), fill=(255, 80, 140, a), width=3)
    return f

def check(color='check', k=9, at=(330, 270)):
    def f(s, img, d, t, lay):
        if lay != 'top': return
        u = (t / s.T) % 1.0
        sc = elastic(u / 0.25) if u < 0.25 else 1 + 0.03 * math.sin(u * 20)
        put(img, icon(color, k), at[0], at[1], sc, -8)
    return f

def boom(at=None, period=1):
    rng = random.Random(13)
    P = [(rng.uniform(0, 2 * math.pi), rng.uniform(60, 140), rng.choice((10, 14, 18))) for _ in range(14)]
    def f(s, img, d, t, lay):
        if lay != 'top': return
        cx, cy = at or (W / 2, 330)
        u = (t / s.T * period) % 1.0
        if u < 0.45:
            k = u / 0.45
            r = 30 + 70 * ease_out(k)
            if k < 0.35: d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 230, 120, int(255 * (1 - k / 0.35))))
            for ang, sp, sz in P:
                x = cx + math.cos(ang) * sp * ease_out(k); y = cy + math.sin(ang) * sp * ease_out(k) * 0.8
                c = (255, 140, 40) if k < 0.4 else (170, 170, 180)
                sq(d, x, y, sz * (1 - 0.5 * k), c + (255,), (90, 90, 100), 2)
    return f

def bubbles(n=5, src='mouth'):
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        mx, my = s.head_pt((0, 5, -10.2))
        for j in range(n):
            u = (t / s.T * 2 + j / n) % 1.0
            x = mx + 20 + 18 * math.sin(u * 7 + j) + 30 * u; y = my - 20 - 170 * u
            r = 6 + 16 * u * (0.6 + 0.4 * (j % 2))
            a = int(255 * clamp((1 - u) / 0.3))
            d.ellipse((x - r, y - r, x + r, y + r), outline=(110, 190, 255, a), width=3)
            d.rectangle((x - r * 0.5, y - r * 0.55, x - r * 0.5 + 4, y - r * 0.55 + 4), fill=(255, 255, 255, a))
    return f

def ghost():
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt((0, 9, -7.5))
        u = (t / s.T) % 1.0
        put(img, icon('ghost', 6), hx + 20 * math.sin(u * 9), hy - 30 - 140 * u, 0.7 + 0.4 * u, 6 * math.sin(u * 12),
            clamp(u / 0.1) * clamp((1 - u) / 0.3))
    return f

def dots():
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt()
        x, y = hx + 95, hy - 100
        d.rounded_rectangle((x - 58, y - 32, x + 58, y + 32), 22, fill=(255, 255, 255, 255), outline=(60, 62, 76, 255), width=4)
        d.polygon([(x - 40, y + 28), (x - 58, y + 52), (x - 18, y + 30)], fill=(255, 255, 255, 255))
        d.line([(x - 40, y + 30), (x - 58, y + 52), (x - 20, y + 31)], fill=(60, 62, 76, 255), width=4)
        n = int((t / s.T * 4) % 4)
        for j in range(3):
            c = (60, 62, 76, 255) if j < n else (200, 202, 212, 255)
            sq(d, x - 28 + j * 28, y, 14, c)
    return f

def bubble_icon(name, k=6, side=1):
    """speech bubble holding an icon."""
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt()
        x, y = hx + side * 100, hy - 105 + 4 * s.ls(t, 2)
        sc = 1 + 0.04 * s.ls(t, 4)
        r = 46 * sc
        d.rounded_rectangle((x - r, y - r * 0.85, x + r, y + r * 0.85), 22, fill=(255, 255, 255, 255), outline=(60, 62, 76, 255), width=4)
        tx = x - side * 30
        d.polygon([(tx - 10, y + r * 0.8), (tx - side * 22, y + r * 0.8 + 26), (tx + 10, y + r * 0.8)], fill=(255, 255, 255, 255))
        d.line([(tx - 10 * side, y + r * 0.85 - 1), (tx - side * 22, y + r * 0.8 + 26), (tx + 10 * side, y + r * 0.85 - 1)], fill=(60, 62, 76, 255), width=4)
        put(img, icon(name, k), x, y, sc)
    return f

def loading():
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt()
        x, y = hx + 95, hy - 95
        for j in range(8):
            ang = 2 * math.pi * j / 8
            k = (j - int(t / s.T * 16)) % 8
            a = int(255 * (0.2 + 0.8 * (k / 7)))
            sq(d, x + 30 * math.cos(ang), y + 30 * math.sin(ang), 12, (254, 62, 140, a))
    return f

def bolt():
    def f(s, img, d, t, lay):
        if lay != 'top': return
        u = (t / s.T * 4) % 1.0
        if u < 0.5:
            for x, y, r in ((90, 250, -10), (420, 240, 12)):
                put(img, icon('bolt', 7), x, y, 1, r, 1 - u * 1.5 if u > 0.3 else 1)
    return f

def flash():
    def f(s, img, d, t, lay):
        if lay != 'top': return
        u = (t / s.T) % 1.0 - 0.55            # once per loop, away from the cover frame
        if 0 <= u < 0.1:
            ov = Image.new('RGBA', (W, H), (255, 255, 255, int(160 * (1 - u / 0.1))))
            img.alpha_composite(ov)
    return f

def splashes(times, power=1.0, n=14, x=0):
    def setup(s):
        for t0 in times: s.splash(t0 * s.T, x=x, n=n, power=power)
    setup._is_setup = True
    return setup

def emit(name, k=4, rate=3, life=0.8, src=(0, 5, -10.2), vx=(-120, 120), vy=(-260, -120), g=500, layer='top'):
    """burst particles of an icon from a head point (crumbs, sparks)."""
    rng = random.Random(hash(name) & 0x7ff)
    P = [(rng.uniform(*vx), rng.uniform(*vy), rng.random()) for _ in range(rate * 3)]
    def f(s, img, d, t, lay):
        if lay != layer or s.LAST is None: return
        sx, sy = s.head_pt(src)
        for i, (vx_, vy_, ph) in enumerate(P):
            u = (t / s.T * rate / 3 + ph) % 1.0
            tt = u * life * 1.25
            if tt > life: continue
            put(img, icon(name, k), sx + vx_ * tt, sy + vy_ * tt + g * tt * tt, 1, vx_ * tt, clamp((life - tt) / 0.2))
    return f

def notes():
    a = floaters('note', n=3, k=5, spread=70, rise=120)
    b = floaters('note2', n=2, k=5, spread=80, rise=130, period=None, dx=40)
    def f(s, img, d, t, lay): a(s, img, d, t, lay); b(s, img, d, t, lay)
    return f

def zzz():
    def f(s, img, d, t, lay):
        if lay != 'top' or s.LAST is None: return
        hx, hy = s.head_pt((0, 9, -7.5))
        for j in range(3):
            u = (t / s.T * 1 + j / 3) % 1.0
            x = hx + 40 + 50 * u + 10 * math.sin(u * 8); y = hy - 30 - 120 * u
            put(img, icon('z', 4 + j % 2 + (1 if u > 0.5 else 0)), x, y, 0.7 + 0.5 * u, -10, clamp(u / 0.1) * clamp((1 - u) / 0.25))
    return f

REG = {
    'twinkle': twinkle, 'hearts': lambda: floaters('heart', n=4, k=4), 'question': question, 'exclaim': exclaim,
    'shock': shock_lines, 'anger': anger, 'sweat': sweat, 'panic': panic, 'zzz': zzz, 'notes': notes,
    'tears': tears, 'stream': lambda: tears(True), 'rain': rain, 'bulb': bulb, 'confetti': lambda: fall('confetti', 18),
    'fireworks': fireworks, 'dizzy': dizzy, 'steam': steam, 'gloom': gloom, 'sparkles': sparkles, 'speed': speed,
    'fire': fire, 'sun': sun, 'moon': moon, 'blush': blush_lines, 'coins': lambda: fall('money', 9, 4),
    'snow': lambda: fall('snow', 10, 3), 'leaves': lambda: fall('leaf', 8, 4), 'check': check,
    'cross': lambda: check('cross'), 'boom': boom, 'bubbles': bubbles, 'ghost': ghost, 'dots': dots, 'loading': loading,
    'bolt': bolt, 'flash': flash, 'float': floaters, 'fall': fall, 'pop': pop_icon, 'stay': stay_icon, 'orbit': orbit,
    'say': bubble_icon, 'emit': emit, 'splash': splashes, 'brokenheart': lambda: pop_icon('brokenheart', 7),
    'plus1': lambda: floaters('plus1', n=3, k=5, rise=120), 'thumb': lambda: pop_icon('thumb', 7, at=(80, -90)),
    'flowers': lambda: floaters('flower', n=4, k=4, spread=90), 'stars': lambda: dizzy(3, 'star'),
    'swirl': lambda: stay_icon('swirl', 6, at=(0, -110)), 'skull': lambda: stay_icon('skull', 6, at=(70, -100)),
}

def make(spec_fx):
    out, setups = [], []
    for e in spec_fx or ():
        if isinstance(e, str): fn = REG[e]();
        else: fn = REG[e[0]](*e[1:]) if not isinstance(e[-1], dict) else REG[e[0]](*e[1:-1], **e[-1])
        (setups if getattr(fn, '_is_setup', False) else out).append(fn)
    return out, setups
