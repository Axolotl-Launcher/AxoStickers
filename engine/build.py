"""批量出图：python engine/build.py [1-50,77] [--force] [--jobs 6]
结果在 out/：NNN_文字.gif，封面在 out/_封面/。已存在的跳过（断了可以接着跑）。"""
import os, sys, time, ctypes, multiprocessing as mp
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE); OUT = os.path.join(ROOT, 'out')

def fname(s): return f"{s['id']:03d}_{s['text'].replace('/', '').replace('?', '？')}"

def low_priority():
    if os.name == 'nt':
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)  # BELOW_NORMAL

def job(s):
    import axl, motions
    t = time.time()
    out = os.path.join(OUT, fname(s) + '.gif')
    kb, col = axl.export(motions.make(s), out, cover_png=os.path.join(OUT, '_封面', fname(s) + '.png'))
    return s['id'], s['text'], round(kb), col, round(time.time() - t, 1)

def parse(sel, n):
    ids = set()
    for part in sel.split(','):
        a, _, b = part.partition('-'); ids.update(range(int(a), int(b or a) + 1))
    return ids

if __name__ == '__main__':
    import specs
    args = sys.argv[1:]
    force = '--force' in args
    jobs = int(args[args.index('--jobs') + 1]) if '--jobs' in args else 6
    if '--jobs' in args: del args[args.index('--jobs'):args.index('--jobs') + 2]
    sel = [a for a in args if a[0].isdigit()]
    S = specs.all_specs()
    if sel: S = [s for s in S if s['id'] in parse(sel[0], len(S))]
    if not force: S = [s for s in S if not os.path.exists(os.path.join(OUT, fname(s) + '.gif'))]
    os.makedirs(OUT, exist_ok=True)
    low_priority()
    t0 = time.time()
    with mp.Pool(jobs, initializer=low_priority) as pool, open(os.path.join(OUT, '_build_log.tsv'), 'a', encoding='utf-8') as log:
        for i, r in enumerate(pool.imap_unordered(job, S)):
            log.write('\t'.join(map(str, r)) + '\n'); log.flush()
            print(f'[{i + 1}/{len(S)}]', *r, flush=True)
    print('done', len(S), 'in', round(time.time() - t0), 's')
