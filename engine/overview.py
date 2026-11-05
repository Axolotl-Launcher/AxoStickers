"""封面总览图：python engine/overview.py
out/_封面/ 里 300 张封面按编号拼成 20 × 15 的格子，每格 96 px -> out/_总览.png（README 顶上那张）。换了封面以后重跑一遍。"""
import os, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLS, CELL = 20, 96

def main():
    data = json.load(open(os.path.join(ROOT, 'out', 'stickers.json'), encoding='utf-8'))
    items = sorted(data['stickers'], key=lambda s: s['id'])
    rows = -(-len(items) // COLS)
    sheet = Image.new('RGB', (COLS * CELL, rows * CELL), 'white')
    for k, s in enumerate(items):
        im = Image.open(os.path.join(ROOT, s['cover'])).convert('RGB').resize((CELL, CELL), Image.LANCZOS)
        sheet.paste(im, ((k % COLS) * CELL, (k // COLS) * CELL))
    out = os.path.join(ROOT, 'out', '_总览.png')
    sheet.save(out, optimize=True)
    print(len(items), 'covers ->', out)

if __name__ == '__main__':
    main()
