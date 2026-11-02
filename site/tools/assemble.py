"""把网站拼起来：python site/tools/assemble.py [--thumbs-only]
_site/ = site/dist（vite build 的产物）+ out/（GIF、封面、清单）+ workshop/（投稿、index.json）+ thumbs/（缩略图 webp）。
缩略图缓存在 site/.thumbs/（不进 git），源图没变就不重做。"""
import os, sys, json, shutil
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT, WS = os.path.join(ROOT, 'out'), os.path.join(ROOT, 'workshop')
THUMBS = os.path.join(ROOT, 'site', '.thumbs')
SITE = os.path.join(ROOT, '_site')
TS = 240

def thumb(src, name):
    dst = os.path.join(THUMBS, name + '.webp')
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src): return 0
    im = Image.open(src); im.seek(0)                      # GIF 取第一帧（就是封面）
    im = im.convert('RGB').resize((TS, TS), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=82, method=6)
    return 1

def make_thumbs():
    os.makedirs(THUMBS, exist_ok=True)
    data = json.load(open(os.path.join(OUT, 'stickers.json'), encoding='utf-8'))
    n = 0
    for s in data['stickers']: n += thumb(os.path.join(ROOT, s['cover']), '%03d' % s['id'])
    for s in data['specials']: n += thumb(os.path.join(ROOT, s['gif']), s['id'])
    idx = json.load(open(os.path.join(WS, 'index.json'), encoding='utf-8'))
    for e in idx['entries']:
        if os.path.exists(os.path.join(ROOT, e['cover'])): n += thumb(os.path.join(ROOT, e['cover']), 'w%d' % e['issue'])
    print('thumbs:', n, 'new')

def copy(src, dst, exts=None):
    os.makedirs(dst, exist_ok=True)
    for name in os.listdir(src):
        p = os.path.join(src, name)
        if os.path.isdir(p): continue
        if exts and os.path.splitext(name)[1].lower() not in exts: continue
        shutil.copy2(p, os.path.join(dst, name))

def main():
    make_thumbs()
    if '--thumbs-only' in sys.argv: return
    dist = os.path.join(ROOT, 'site', 'dist')
    if not os.path.exists(os.path.join(dist, 'index.html')): raise SystemExit('先在 site/ 里 npm run build')
    if os.path.exists(SITE): shutil.rmtree(SITE)
    shutil.copytree(dist, SITE)
    copy(OUT, os.path.join(SITE, 'out'), {'.gif', '.png', '.json'})
    copy(os.path.join(OUT, '_封面'), os.path.join(SITE, 'out', '_封面'), {'.png'})
    copy(WS, os.path.join(SITE, 'workshop'), {'.json'})
    for d in ('gifs', 'covers'): copy(os.path.join(WS, d), os.path.join(SITE, 'workshop', d), {'.gif', '.png'})
    copy(THUMBS, os.path.join(SITE, 'thumbs'), {'.webp'})
    open(os.path.join(SITE, '.nojekyll'), 'w').close()
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(SITE) for f in fs)
    print('_site:', round(size / 1024 / 1024), 'MB')

if __name__ == '__main__':
    main()
