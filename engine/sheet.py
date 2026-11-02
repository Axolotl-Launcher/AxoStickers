"""检查用拼图：python engine/sheet.py [每张数量=30] -> ref/sheet_XX.png（每个表情 4 帧：封面 + 3 个中间帧）"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image, ImageDraw, ImageSequence
import axl, specs, build

def frames_of(path, k=4, sz=110):
    g = Image.open(path); fr = [f.convert('RGB') for f in ImageSequence.Iterator(g)]
    return [fr[int(i * len(fr) / k)].resize((sz, sz), Image.LANCZOS) for i in range(k)]

def main(per=30, cols=3, k=4, sz=110, only=None):
    S = specs.all_specs()
    if only: S = [s for s in S if s['id'] in only]
    f = axl.font(15, 'Bold')
    cw, ch = k * sz + 8, sz + 20
    for p in range(0, len(S), per):
        chunk = S[p:p + per]
        rows = (len(chunk) + cols - 1) // cols
        im = Image.new('RGB', (cw * cols, ch * rows), (235, 235, 240)); d = ImageDraw.Draw(im)
        for i, s in enumerate(chunk):
            x, y = (i % cols) * cw, (i // cols) * ch
            path = os.path.join(build.OUT, build.fname(s) + '.gif')
            d.text((x + 4, y + 1), f"{s['id']} {s['text']}  {s['motion']}", font=f, fill=(20, 20, 30))
            if not os.path.exists(path): continue
            for j, fr in enumerate(frames_of(path, k, sz)): im.paste(fr, (x + j * sz, y + 19))
        name = f'sheet_{p // per + 1:02d}.png' if not only else f'sheet_sel_{p // per + 1}.png'
        os.makedirs(os.path.join(axl.ROOT, 'ref'), exist_ok=True)
        im.save(os.path.join(axl.ROOT, 'ref', name)); print(name)

if __name__ == '__main__':
    only = None
    if len(sys.argv) > 1 and '-' in sys.argv[1] or (len(sys.argv) > 1 and ',' in sys.argv[1]):
        only = build.parse(sys.argv[1], 300)
    main(only=only)
