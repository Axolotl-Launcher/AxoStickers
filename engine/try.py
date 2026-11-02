"""Quick look: python engine/try.py out.png  -> rows of 4 frames for the specs in TRY (or a specs.py id range)."""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import axl, motions

def sheet(specs, out, cols=4, sz=200):
    rows = []
    t0 = time.time()
    for sp in specs:
        stk = motions.make(sp)
        ts = [stk.cover_time() + stk.T * k / cols for k in range(cols)]
        row = Image.new('RGB', (sz * cols, sz), 'white')
        for i, tv in enumerate(ts):
            row.paste(stk.frame(int(round(tv * axl.FPS)) % stk.N).resize((sz, sz), Image.LANCZOS), (i * sz, 0))
        ImageDraw.Draw(row).text((4, 2), f"{sp.get('id', '')} {sp.get('motion')}", fill=(0, 0, 0))
        rows.append(row)
    im = Image.new('RGB', (sz * cols, sz * len(rows)), 'white')
    for i, r in enumerate(rows): im.paste(r, (0, i * sz))
    im.save(out)
    print(out, f'{(time.time() - t0) / max(1, len(specs) * cols):.2f}s/frame')

if __name__ == '__main__':
    import json
    specs = json.loads(sys.argv[2]) if len(sys.argv) > 2 else []
    sheet(specs, sys.argv[1])
