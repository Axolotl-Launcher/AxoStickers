"""把网站拼起来：python site/tools/assemble.py [--thumbs-only]
_site/ = site/dist（vite build 的产物）+ gif/（表情 GIF，英文文件名）+ out/（封面、清单）+ workshop/（投稿、index.json）
       + thumbs/（240px 静态缩略图 webp）+ previews/（240px 小视频预览 mp4，悬停时播放，要 ffmpeg）。
缩略图和预览缓存在 site/.thumbs/、site/.previews/（不进 git），源图没变就不重做。"""
import os, re, sys, json, shutil, subprocess
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT, WS = os.path.join(ROOT, 'out'), os.path.join(ROOT, 'workshop')
THUMBS = os.path.join(ROOT, 'site', '.thumbs')
PREVIEWS = os.path.join(ROOT, 'site', '.previews')
SITE = os.path.join(ROOT, '_site')
TS = 240

def thumb(src, name):
    dst = os.path.join(THUMBS, name + '.webp')
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src): return 0
    im = Image.open(src); im.seek(0)                      # GIF 取第一帧（就是封面）
    im = im.convert('RGBA')
    flat = Image.new('RGB', im.size, (255, 255, 255)); flat.paste(im, mask=im.getchannel('A'))   # 透明底的投稿：垫白底，别变成黑底
    im = flat.resize((TS, TS), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=82, method=6)
    return 1

def preview(src, name):
    """GIF -> 240px 无声循环 mp4（H.264，几十 KB）。"""
    dst = os.path.join(PREVIEWS, name + '.mp4')
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src): return 0
    # 先垫一层白底再转成不带透明的视频（透明底的投稿不然会变成黑底）；白底和 GIF 本身是同一路帧，时间对得上
    vf = f'[0:v]scale={TS}:{TS}:flags=lanczos,format=rgba,split[a][b];[a]drawbox=c=white:t=fill[bg];[bg][b]overlay=format=auto,format=yuv420p'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter_complex', vf,
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-movflags', '+faststart', '-an', dst], check=True)
    return 1

def sources():
    """[(源文件, 封面或首帧, 名字)]：300 张、初代和特别篇、工坊投稿。"""
    data = json.load(open(os.path.join(OUT, 'stickers.json'), encoding='utf-8'))
    out = [(os.path.join(ROOT, s['gif']), os.path.join(ROOT, s['cover']), '%03d' % s['id']) for s in data['stickers']]
    out += [(os.path.join(ROOT, s['gif']), os.path.join(ROOT, s['gif']), s['id']) for s in data['specials']]
    idx = json.load(open(os.path.join(WS, 'index.json'), encoding='utf-8'))
    out += [(os.path.join(ROOT, e['gif']), os.path.join(ROOT, e['cover']), 'w%d' % e['issue'])
            for e in idx['entries'] if os.path.exists(os.path.join(ROOT, e['gif']))]
    return out

def make_thumbs(videos=True):
    os.makedirs(THUMBS, exist_ok=True); os.makedirs(PREVIEWS, exist_ok=True)
    src = sources()
    n = sum(thumb(cover, name) for _, cover, name in src)
    print('thumbs:', n, 'new')
    if videos:
        with ThreadPoolExecutor(min(6, os.cpu_count() or 2)) as ex:
            v = sum(ex.map(lambda s: preview(s[0], s[2]), src))
        print('previews:', v, 'new')

def site_gifs():
    """表情 GIF 在网站上的英文地址：gif/001.gif；初代、水龙卷用清单里的 slug：gif/og-send-log.gif、gif/tornado-1.gif（开发服务器 vite.config.js 里是同一套规则）。
    QQ 收拖进去的图片时会自己去下图片的地址，地址里有中文就失败；中文名只当文件名（下载按钮的 download、拖出去的 DownloadURL）。
    返回 (改成新地址的清单, {新文件名: 源文件})。"""
    data = json.load(open(os.path.join(OUT, 'stickers.json'), encoding='utf-8'))
    named = [('%03d.gif' % s['id'], s) for s in data['stickers']] + [(s['slug'] + '.gif', s) for s in data['specials']]
    files = {}
    for name, s in named:
        files[name] = os.path.join(ROOT, s['gif'])
        s['gif'] = 'gif/' + name
    return data, files

HEADER = re.compile(r'^\s*/\*\s*@axo\s*(\{.*?\})\s*\*/', re.S)

def components(dst):
    """组件库：workshop/components/*.axo.js -> components/，并从文件头的 /* @axo {...} */ 生成 index.json（不执行代码）。"""
    src = os.path.join(WS, 'components'); os.makedirs(dst, exist_ok=True)
    index = []
    for name in sorted(os.listdir(src)) if os.path.isdir(src) else []:
        if not name.endswith('.axo.js'): continue
        text = open(os.path.join(src, name), encoding='utf-8').read()
        m = HEADER.match(text)
        if not m: print('skip (no @axo header):', name); continue
        meta = json.loads(m.group(1))
        index.append({k: str(meta.get(k, ''))[:300] for k in ('id', 'type', 'name', 'author', 'version', 'description')} | {'file': name})
        shutil.copy2(os.path.join(src, name), os.path.join(dst, name))
    index += models(os.path.join(os.path.dirname(dst), 'models'))
    json.dump(index, open(os.path.join(dst, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('components + models:', len(index))

def models(dst):
    """工坊里的模型：workshop/models/<id>.json（说明卡）+ 模型文件（.glb，在 workshop/models/ 或 kit/model/）-> models/。"""
    src, kit, out = os.path.join(WS, 'models'), os.path.join(ROOT, 'kit', 'model'), []
    os.makedirs(dst, exist_ok=True)
    for name in sorted(os.listdir(src)) if os.path.isdir(src) else []:
        if not name.endswith('.json'): continue
        meta = json.load(open(os.path.join(src, name), encoding='utf-8'))
        f = str(meta.get('file', ''))
        glb = next((p for p in (os.path.join(src, f), os.path.join(kit, f)) if re.fullmatch(r'[\w.-]+\.glb', f) and os.path.isfile(p)), None)
        if not glb: print('skip model (no file):', name); continue
        shutil.copy2(glb, os.path.join(dst, f)); shutil.copy2(os.path.join(src, name), os.path.join(dst, name))
        out.append({k: str(meta.get(k, ''))[:300] for k in ('id', 'name', 'author', 'version', 'description')} | {'type': 'model', 'file': f, 'face': bool(meta.get('face')), 'kb': round(os.path.getsize(glb) / 1024)})
    return out

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
    copy(OUT, os.path.join(SITE, 'out'), {'.png', '.json'})
    copy(os.path.join(OUT, 'projects'), os.path.join(SITE, 'out', 'projects'), {'.json'})   # 300 张的工程：「在工坊里改一改」打开它
    copy(os.path.join(OUT, '_封面'), os.path.join(SITE, 'out', '_封面'), {'.png'})
    data, files = site_gifs()                         # 表情 GIF 只放英文名的这一份，站上的清单跟着改
    os.makedirs(os.path.join(SITE, 'gif'))
    for name, src in files.items(): shutil.copy2(src, os.path.join(SITE, 'gif', name))
    json.dump(data, open(os.path.join(SITE, 'out', 'stickers.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    copy(WS, os.path.join(SITE, 'workshop'), {'.json'})
    for d in ('gifs', 'covers', 'projects'):          # projects/：投稿的工程，「在工坊里改一改」载进编辑器
        if os.path.isdir(os.path.join(WS, d)): copy(os.path.join(WS, d), os.path.join(SITE, 'workshop', d), {'.gif', '.png', '.json'})
    copy(THUMBS, os.path.join(SITE, 'thumbs'), {'.webp'})
    copy(PREVIEWS, os.path.join(SITE, 'previews'), {'.mp4'})
    components(os.path.join(SITE, 'components'))
    os.makedirs(os.path.join(SITE, 'models'), exist_ok=True)
    shutil.copy2(os.path.join(ROOT, 'kit', 'model', 'axolotl_logo.glb'), os.path.join(SITE, 'models', 'axolotl_logo.glb'))
    open(os.path.join(SITE, '.nojekyll'), 'w').close()
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(SITE) for f in fs)
    print('_site:', round(size / 1024 / 1024), 'MB')

if __name__ == '__main__':
    main()
