"""创意工坊的后台：GitHub issue 就是投稿，这个脚本负责校验、用真引擎出图、更新 workshop/index.json、统计点赞。

  python workshop/tools/workshop.py check                      # 核对 catalog.json 和引擎是否一致
  python workshop/tools/workshop.py render recipe.json out.gif # 本地试渲一个配方
  python workshop/tools/workshop.py publish [--push]           # 工作流用：读 $GITHUB_EVENT_PATH 里的 issue
  python workshop/tools/workshop.py reject [--push]            # 工作流用：维护者打了 rejected 标签
  python workshop/tools/workshop.py likes [--push]             # 工作流用：按 issue 上的 👍 刷新点赞数
--push 表示在最新的 main 上提交并推送（工作流里用）；不加就只改本地文件。

issue 正文是不可信输入：只当 JSON 解析（不 eval），每个值都必须在 catalog.json 的白名单里，
文字限 1～5 个指定字符，文件名只用 issue 编号。回复正文写到 $RUNNER_TEMP/workshop/comment.md，状态写到 $GITHUB_OUTPUT。
"""
import os, sys, re, json, time, subprocess, unicodedata, urllib.request
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WS = os.path.join(ROOT, 'workshop')
CATALOG = json.load(open(os.path.join(WS, 'catalog.json'), encoding='utf-8'))
INDEX = os.path.join(WS, 'index.json')
KEYS = ('text', 'motion', 'face', 'fx', 'hold', 'wear', 'style', 'tmode')
PER_DAY = 5                      # 每人 24 小时内最多发几张
SITE = 'https://axolotl-launcher.github.io/AxoStickers/'

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8'); sys.stderr.reconfigure(encoding='utf-8')

# ---------------- recipe ----------------
TEXT_RE = re.compile('[%s]+' % CATALOG['text']['chars'])

def extract(body):
    """issue 表单正文 -> 配方 dict。找「### 配方」下面的第一个 JSON 对象。"""
    if not isinstance(body, str) or len(body) > 20000: raise ValueError('issue 正文太长了')
    m = re.search(r'###\s*配方\s*\n(.*?)(?=\n###\s|\Z)', body, re.S)
    part = m.group(1) if m else body
    part = re.sub(r'```(?:json)?', '', part).strip()
    a, b = part.find('{'), part.rfind('}')
    if a < 0 or b <= a: raise ValueError('没找到配方 JSON（「### 配方」下面那一段）')
    raw = part[a:b + 1]
    if len(raw) > 2000: raise ValueError('配方太长了')
    try: r = json.loads(raw)
    except json.JSONDecodeError as e: raise ValueError(f'配方不是合法的 JSON：{e.msg}（第 {e.colno} 列）')
    if not isinstance(r, dict): raise ValueError('配方应该是一个 JSON 对象')
    return r

def consented(body):
    """「### 授权」那一段里的复选框勾上了没有（表单里是必填，但 API 建的 / 改过正文的 issue 绕得过去）。"""
    m = re.search(r'###\s*授权\s*\n(.*?)(?=\n###\s|\Z)', body or '', re.S)
    return bool(m and re.search(r'^\s*[-*]\s*\[[xX]\]', m.group(1), re.M))

def show(v):
    """把用户输入放进行内代码再回显：不会被当成 @提及 或 markdown。"""
    return '`' + re.sub(r'\s+', ' ', str(v)[:40]).replace('`', "'") + '`'

def validate(r):
    """返回 (规范化后的配方, [问题])。"""
    C, errs = CATALOG, []
    extra = sorted(set(r) - set(KEYS) - {'v'})
    if extra: errs.append('不认识的字段：' + '、'.join(show(k) for k in extra[:8]))
    text = r.get('text')
    if not isinstance(text, str): errs.append('缺少文字 text'); text = ''
    text = unicodedata.normalize('NFC', text).strip()
    n = len(text)
    if not C['text']['min'] <= n <= C['text']['max']: errs.append(f"文字要 {C['text']['min']}～{C['text']['max']} 个字，现在是 {n} 个")
    elif not TEXT_RE.fullmatch(text):
        bad = ''.join(sorted({c for c in text if not TEXT_RE.fullmatch(c)}))
        errs.append(f'文字里有不支持的字符：{show(bad)}（{C["text"]["hint"]}）')
    def one(key, table, default=None):
        v = r.get(key, default)
        if v is None and default is None: return None
        if not isinstance(v, str) or v not in C[table]: errs.append(f'{key} 不在可选范围里：{show(v)}'); return None
        return v
    motion = one('motion', 'motions', 'idle')
    face = one('face', 'faces', 'normal')
    style = one('style', 'styles', 'pink')
    tmode = one('tmode', 'tmodes', 'stay')
    fx = r.get('fx', [])
    if not isinstance(fx, list) or len(fx) > C['limits']['fx'] or len(set(map(str, fx))) != len(fx):
        errs.append(f"特效 fx 最多 {C['limits']['fx']} 个、不能重复"); fx = []
    fx = [f for f in fx if isinstance(f, str) and f in C['fx'] or errs.append(f'特效不在可选范围里：{show(f)}')]
    wear = r.get('wear', [])
    if isinstance(wear, str): wear = [wear]
    if not isinstance(wear, list) or len(wear) > C['limits']['wear']: errs.append('帽子 wear 最多 1 个'); wear = []
    wear = [w for w in wear if isinstance(w, str) and w in C['wears'] or errs.append(f'帽子不在可选范围里：{show(w)}')]
    hold = r.get('hold')
    if hold is not None and (not isinstance(hold, str) or hold not in C['holds']):
        errs.append(f'道具不在可选范围里：{show(hold)}'); hold = None
    m = C['motions'].get(motion or '', {})
    if m.get('noHold'): hold = None
    elif m.get('prop') and not hold: hold = m['prop']
    if m.get('offscreen') and tmode in C['entrance']:
        errs.append(f'「{m["zh"]}」中途会离开画面，文字动画不能用「{C["tmodes"][tmode]}」（封面会拍不到美西螈）')
    rec = dict(text=text, motion=motion, face=face, fx=fx, hold=hold, wear=wear, style=style, tmode=tmode)
    return rec, errs

def describe(rec):
    C = CATALOG
    parts = [f"动作 {C['motions'][rec['motion']]['zh']}", f"表情 {C['faces'][rec['face']]}"]
    if rec['fx']: parts.append('特效 ' + '、'.join(C['fx'][f] for f in rec['fx']))
    if rec['hold']: parts.append('道具 ' + C['holds'][rec['hold']])
    if rec['wear']: parts.append('帽子 ' + '、'.join(C['wears'][w] for w in rec['wear']))
    parts += [f"字色 {C['styles'][rec['style']]}", f"文字动画 {C['tmodes'][rec['tmode']]}"]
    return ' · '.join(parts)

# ---------------- render ----------------
def render(rec, gif, cover, seed=0):
    sys.path.insert(0, os.path.join(ROOT, 'engine'))
    import axl, motions
    spec = {k: rec[k] for k in KEYS if rec.get(k) not in (None, [])}
    spec['seed'] = seed
    return axl.export(motions.make(spec), gif, cover_png=cover)

# ---------------- index ----------------
def load_index():
    if not os.path.exists(INDEX): return {'version': 1, 'entries': []}
    return json.load(open(INDEX, encoding='utf-8'))

def save_index(d):
    """一条投稿一行，diff 好看。"""
    d['entries'].sort(key=lambda e: -e['issue'])
    rows = ',\n'.join('  ' + json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in d['entries'])
    with open(INDEX, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n "version": %d,\n "entries": [%s]\n}\n' % (d.get('version', 1), '\n' + rows + '\n ' if rows else ''))

# ---------------- GitHub plumbing ----------------
def event():
    return json.load(open(os.environ['GITHUB_EVENT_PATH'], encoding='utf-8'))

def outputs(**kw):
    path = os.environ.get('GITHUB_OUTPUT')
    lines = ''.join(f'{k}={v}\n' for k, v in kw.items())
    if path:
        with open(path, 'a', encoding='utf-8') as f: f.write(lines)
    print(lines, end='')

def write_comment(text):
    d = os.path.join(os.environ.get('RUNNER_TEMP', os.path.join(ROOT, '_tmp')), 'workshop')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'comment.md'), 'w', encoding='utf-8') as f: f.write(text)

def api(path, token, repo):
    url = f'https://api.github.com/repos/{repo}/{path}'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json',
                                               'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'axostickers-workshop'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def git(*args, check=True):
    r = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if check and r.returncode: raise SystemExit(f'git {args[0]} failed: {r.stderr.strip()}')
    return r

BOT = ('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com')

class Abort(Exception):
    """change() 在最新的 index 上发现这次改动不该做了：status 写进 $GITHUB_OUTPUT，errs 回复给 issue。"""
    def __init__(self, status, errs=()):
        super().__init__(status); self.status, self.errs = status, list(errs)

def fetch_main():
    for k in range(5):                              # GitHub 偶尔抖一下，有限次退避重试
        if git('fetch', '-q', 'origin', 'main', check=False).returncode == 0: return
        time.sleep(2 ** k * 3)
    raise SystemExit('git fetch failed 5 times')

def apply(change, paths, message, push):
    """改 index.json（和几个文件）。push=True 时在最新的 main 上重放这次改动再推送：
    几张投稿同时在跑也不会互相覆盖（不用 concurrency 组，那个会把排队的直接丢掉）。
    change(idx) 每次都在最新的 index 上跑，可以抛 Abort 放弃。"""
    if not push:
        idx = load_index(); change(idx); save_index(idx); return True
    keep = {p: open(os.path.join(ROOT, p), 'rb').read() for p in paths if os.path.exists(os.path.join(ROOT, p))}
    for attempt in range(6):
        fetch_main()
        git('checkout', '-q', '-f', '-B', 'workshop-bot', 'origin/main')
        idx = load_index(); change(idx)
        for p in paths:
            full = os.path.join(ROOT, p)
            if p in keep:
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, 'wb') as f: f.write(keep[p])
            elif os.path.exists(full): os.remove(full)
        save_index(idx)
        git('add', '-A', '--', 'workshop')
        if git('diff', '--cached', '--quiet', check=False).returncode == 0:
            print('nothing to commit'); return False
        git(*BOT, 'commit', '-q', '-m', message)
        if git('push', '-q', 'origin', 'HEAD:main', check=False).returncode == 0: return True
        print('push rejected, retrying'); time.sleep(3 + attempt * 4)
    raise SystemExit('push failed 6 times')

def limits(idx, rec, author, num):
    """查重 + 每人每天的配额，按给定的 index 算（发布前查一次，重放到最新 index 上时再查一次）。"""
    errs, others = [], [e for e in idx['entries'] if e['issue'] != num]
    same = next((e for e in others if e['recipe'] == rec), None)
    if same: errs.append(f"工坊里已经有一模一样的了：#{same['issue']}（@{same['author']}）。换个表情或者特效再来")
    now = datetime.now(timezone.utc)
    recent = [e for e in others if e['author'] == author and now - datetime.fromisoformat(e['date']) < timedelta(days=1)]
    if len(recent) >= PER_DAY: errs.append(f'24 小时内每人最多发 {PER_DAY} 张，明天再来')
    return errs

def still_current(num, body):
    """出图要十几秒：提交前再看一眼 issue，被改过正文（新的那次运行会处理）、关了或被撤下就不发了。"""
    token, repo = os.environ.get('GITHUB_TOKEN'), os.environ.get('GITHUB_REPOSITORY')
    if not token or not repo: return
    try: cur = api(f'issues/{num}', token, repo)
    except Exception as e: print('issue check skipped:', e); return   # 查不到就按事件里的来，别让抖动卡住发布
    if any(l.get('name') == 'rejected' for l in cur.get('labels', [])): raise Abort('stale')
    if cur.get('state') != 'open' or (cur.get('body') or '') != body: raise Abort('stale')

MARK = '<!-- workshop:published -->'

def published_comment(e, repo):
    return (f'出图了 ✅\n\n![{e["text"]}](https://github.com/{repo}/blob/main/{e["gif"]}?raw=true)\n\n'
            f'- 配方：{describe(e["recipe"])}\n- 网站上几分钟后就能看到：{SITE}#/workshop\n'
            f'- 觉得好笑就给这个 issue 点个 👍，工坊的「最多赞」按它排（每 6 小时数一次）\n\n'
            f'机器人顺手把 issue 关了，点赞不受影响。\n{MARK}\n')

def invalid_comment(errs):
    return ('没能出图 ❌\n\n' + '\n'.join(f'- {e}' for e in errs) +
            '\n\n改一下正文里的配方（或者回网站重新点「发布到工坊」把新配方贴过来），保存后机器人会再试一次。\n')

# ---------------- commands ----------------
def cmd_publish(push):
    ev = event(); issue = ev['issue']; body = issue.get('body') or ''
    num = int(issue['number']); author = str(issue['user']['login']); repo = os.environ.get('GITHUB_REPOSITORY', 'Axolotl-Launcher/AxoStickers')
    idx = load_index()
    done = next((e for e in idx['entries'] if e['issue'] == num), None)
    if done:                                       # 已经发过：交给工作流补回复 / 关 issue / 部署（都是幂等的）
        print('already published'); write_comment(published_comment(done, repo)); return outputs(status='skip', number=num)
    try:
        rec, errs = validate(extract(body))
    except ValueError as e:
        rec, errs = None, [str(e)]
    if not consented(body): errs.append('没勾选「授权」：要同意按 GPL-3.0-only 发布才能进工坊')
    if not errs: errs = limits(idx, rec, author, num)
    if errs:
        write_comment(invalid_comment(errs))
        return outputs(status='invalid', number=num)
    gif, cover = f'workshop/gifs/{num}.gif', f'workshop/covers/{num}.png'
    t0 = time.time()
    kb, cols = render(rec, os.path.join(ROOT, gif), os.path.join(ROOT, cover), seed=num)
    print(f'rendered #{num} {round(kb)} KB {cols} colours in {time.time() - t0:.1f}s')
    entry = dict(issue=num, text=rec['text'], recipe=rec, author=author,
                 date=datetime.now(timezone.utc).replace(microsecond=0).isoformat(), likes=0, gif=gif, cover=cover)
    def add(idx):
        errs = limits(idx, rec, author, num)         # 别的投稿可能刚抢先落库
        if errs: raise Abort('invalid', errs)
        still_current(num, body)
        idx['entries'] = [e for e in idx['entries'] if e['issue'] != num] + [entry]
    try:
        apply(add, [gif, cover], f'工坊：#{num}「{rec["text"]}」by @{author}', push)
    except Abort as a:
        print('aborted:', a.status)
        if a.errs: write_comment(invalid_comment(a.errs))
        return outputs(status=a.status, number=num)
    write_comment(published_comment(entry, repo))
    outputs(status='published', number=num)

def cmd_reject(push):
    ev = event(); num = int(ev['issue']['number'])
    hit = [e for e in load_index()['entries'] if e['issue'] == num]
    paths = [e[k] for e in hit for k in ('gif', 'cover')]
    for p in paths:
        if os.path.exists(os.path.join(ROOT, p)): os.remove(os.path.join(ROOT, p))
    def drop(idx):
        idx['entries'] = [e for e in idx['entries'] if e['issue'] != num]
    if hit: apply(drop, paths, f'工坊：撤下 #{num}', push)
    write_comment('这张被维护者撤下了，工坊里不再展示。\n')
    outputs(status='removed' if hit else 'none', number=num)

def cmd_likes(push):
    token, repo = os.environ['GITHUB_TOKEN'], os.environ['GITHUB_REPOSITORY']
    want = {e['issue'] for e in load_index()['entries']}
    likes, page = {}, 1
    while want - set(likes) and page <= 30:
        items = api(f'issues?labels=workshop&state=all&per_page=100&page={page}', token, repo)
        for it in items:
            if 'pull_request' not in it: likes[it['number']] = int(it.get('reactions', {}).get('+1', 0))
        if len(items) < 100: break
        page += 1
    for n in sorted(want - set(likes)):              # 没带标签的老投稿：单独问
        try: likes[n] = int(api(f'issues/{n}', token, repo).get('reactions', {}).get('+1', 0))
        except Exception as e: print('skip', n, e)
    changed = []
    def update(idx):
        changed.clear()
        for e in idx['entries']:
            if e['issue'] in likes and likes[e['issue']] != e.get('likes'):
                e['likes'] = likes[e['issue']]; changed.append(e['issue'])
    apply(update, [], '工坊：更新点赞数', push)
    print('likes updated:', len(changed))
    outputs(changed=len(changed))

def cmd_check():
    sys.path.insert(0, os.path.join(ROOT, 'engine'))
    import axl, motions, items, fx
    C, bad = CATALOG, []
    bad += [f'motion {m}' for m in C['motions'] if m not in motions.REG]
    bad += [f'face {m}' for m in C['faces'] if m not in motions.FACES]
    bad += [f'fx {m}' for m in C['fx'] if m not in fx.REG]
    bad += [f'hold {m}' for m in C['holds'] if m not in items.SPR and m not in items.BLK]
    bad += [f'wear {m}' for m in C['wears'] if m not in items.GEAR]
    bad += [f'style {m}' for m in C['styles'] if m not in axl.STYLES]
    print('catalog OK' if not bad else 'catalog mismatch: ' + ', '.join(bad))
    return 1 if bad else 0

def cmd_render(path, out):
    rec, errs = validate(json.load(open(path, encoding='utf-8')))
    if errs: print('\n'.join(errs)); return 1
    print(describe(rec))
    kb, cols = render(rec, out, os.path.splitext(out)[0] + '.png')
    print(out, round(kb), 'KB', cols, 'colours')

if __name__ == '__main__':
    a = sys.argv[1:] or ['check']
    push = '--push' in a
    cmds = {'publish': lambda: cmd_publish(push), 'reject': lambda: cmd_reject(push), 'likes': lambda: cmd_likes(push),
            'check': cmd_check, 'render': lambda: cmd_render(a[1], a[2])}
    sys.exit(cmds[a[0]]() or 0)
