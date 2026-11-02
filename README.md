# AxoStickers · 美西螈表情包

Axolotl Launcher 的美西螈动画表情包：300 张 + 水龙卷特别篇，以及生成它们的引擎和 Claude skill。

![300 张封面总览](out/_总览.png)

- 400×400 GIF，15 fps，无缝循环，第一帧就是字全出来的封面，单张 ≤ 1 MB
- 同一个体素美西螈、同一套粉色立体字和水面；75 种动作，同一个动作最多出现 7 次
- 五个分类：群里答疑 55 · 日常回复 66 · 情绪 97 · 我的世界 34 · 生活 48
- 一次性下载：见 [Releases](https://github.com/Axolotl-Launcher/AxoStickers/releases)
- 网站：<https://axolotl-launcher.github.io/AxoStickers/>：在线挑、单张下载，还有创意工坊（自己做一张，发布给大家）

## 目录

| 路径 | 内容 |
|---|---|
| `out/NNN_文字.gif` | 300 张表情 |
| `out/_封面/` | 每张的静态封面 PNG |
| `out/水龙卷_*.gif` | 水龙卷特别篇（无字 / 我没事 / 转晕了） |
| `out/stickers.json` | 清单：文字、分类、动作、表情、特效、道具、配色、文件路径 |
| `engine/` | 引擎：`specs.py` 一行一张，`build.py` 批量出图，`sheet.py` 检查拼图，`tornado.py` 水龙卷 |
| `kit/` | 美西螈模型与渲染器（`rig.py` / `rig2.py` / `face_cam.py`）、思源黑体 |
| `skill/axolotl-sticker/` | 给 Claude Code 用的 skill：让 Claude 按这套风格做新表情 |
| `site/` | 网站：图鉴 + 创意工坊（Vite，预览用 three.js 版引擎） |
| `workshop/` | 创意工坊：`catalog.json` 可选项白名单、`index.json` 投稿清单、投稿出的图、`tools/workshop.py` 出图脚本 |
| `.github/` | 发布到工坊的 issue 表单；出图、数点赞、部署网站的工作流 |

## 自己出图

需要 Python 3.9+、`pip install numpy pillow`、ffmpeg（在 PATH 里）。纯 CPU，不需要显卡。

```
python engine/build.py                   # 出全部（已存在的跳过，断了能接着跑）
python engine/build.py 12,40-45 --force  # 只重出这几张
python engine/sheet.py 1-30              # 检查用拼图 -> ref/
python engine/manifest.py                # 更新 out/stickers.json
```

水龙卷要用几张原版 Minecraft 材质（铁头盔、海龟壳、美西螈桶、TNT），仓库里不带。先从你自己电脑上的客户端里取出来：

```
python engine/fetch_mc.py                # 自动找 .minecraft/versions 里的 1.21.2+ 客户端；也可以把 jar 路径传进去
python engine/tornado.py 我没事           # 文字写 - 出无字版
```

## 加一张新表情

在 `engine/specs.py` 对应分类的末尾加一行：

```python
S('摸鱼', 'flagwave', 'happy', [], hold='fish', s=0.7)
#  文字    动作        表情     特效  道具
```

动作、表情、特效、道具、配色、文字动画的完整列表见 [skill/axolotl-sticker/SKILL.md](skill/axolotl-sticker/SKILL.md)。

## 用 skill 让 Claude 做

把 `skill/axolotl-sticker/` 复制到 `~/.claude/skills/`（或项目的 `.claude/skills/`），在这个仓库里对 Claude Code 说"做一张『下班了』的美西螈表情"就行。

## 网站和创意工坊

网站是纯静态的，部署在 GitHub Pages；创意工坊用 GitHub 当后台：

1. 网页编辑器里选文字、动作、表情、特效、道具、字色、文字动画，实时预览，可以直接在浏览器里导出 GIF。
2. 「发布到工坊」打开一个填好配方的 issue（`.github/ISSUE_TEMPLATE/workshop.yml`）。
3. `工坊 · 出图` 工作流按 `workshop/catalog.json` 的白名单校验配方，用真引擎出图，把 GIF 和 `workshop/index.json` 提交到 main，回复并关掉 issue，再触发网站部署。维护者给 issue 打 `rejected` 标签就会撤下。
4. 点赞就是 issue 上的 👍，`工坊 · 数点赞` 每 6 小时数一次写进 `index.json`。

网页预览是 three.js 版引擎（`site/src/engine/`）：模型面片、表情、道具和图标由 `site/tools/export_engine.py` 从 Python 引擎导出，是同一份数据；动作、特效、文字动画逐行移植。在 `engine/` 里加了新动作 / 特效，要同步移植到 `site/src/engine/` 并加进 `workshop/catalog.json`，网站才能选。

本地跑网站（Node 20+，另外 `pip install fonttools brotli`）：

```
cd site
npm ci
npm run data     # 导出引擎数据 + 把思源黑体切成网页字体（生成到 site/src/gen/，不进 git）
npm run dev      # http://localhost:5173 ；dev.html 是和 Python 引擎逐帧对照的页面
python ../workshop/tools/workshop.py render recipe.json test.gif   # 用真引擎试渲一个配方
```

部署需要在仓库 Settings → Pages 里把来源设成 GitHub Actions。

## 授权

代码和表情 GPL-3.0-only，模型来自 [Axolotl Launcher](https://github.com/Axolotl-Launcher/Axolotl)，字体是思源黑体（SIL OFL 1.1）。不含任何 Minecraft 游戏文件；Minecraft 是 Mojang Synergies AB 的商标，本项目与 Mojang 无关。详见 [COPYING.md](COPYING.md)。
