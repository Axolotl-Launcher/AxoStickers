# AxoStickers · 美西螈表情包

Axolotl Launcher 的美西螈动画表情包：300 张 + 水龙卷特别篇，以及生成它们的引擎和 Claude skill。

![300 张封面总览](out/_总览.png)

- 400×400 GIF，15 fps，无缝循环，第一帧就是字全出来的封面，单张 ≤ 1 MB
- 同一个体素美西螈、同一套粉色立体字和水面；75 种动作，同一个动作最多出现 7 次
- 五个分类：群里答疑 55 · 日常回复 66 · 情绪 97 · 我的世界 34 · 生活 48
- 一次性下载：见 [Releases](https://github.com/Axolotl-Launcher/AxoStickers/releases)

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

## 授权

代码和表情 GPL-3.0-only，模型来自 [Axolotl Launcher](https://github.com/Axolotl-Launcher/Axolotl)，字体是思源黑体（SIL OFL 1.1）。不含任何 Minecraft 游戏文件；Minecraft 是 Mojang Synergies AB 的商标，本项目与 Mojang 无关。详见 [COPYING.md](COPYING.md)。
