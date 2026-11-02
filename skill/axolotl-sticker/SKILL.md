---
name: axolotl-sticker
description: Make animated Axolotl Launcher axolotl stickers (美西螈表情包) with the AxoStickers engine — a voxel axolotl in water under big pink 3D Chinese text, 400×400 looping GIF ≤ 1 MB whose first frame is the cover. Use whenever someone asks for new axolotl / 美西螈 stickers, 表情包, 动图, a sticker for a phrase, a batch of stickers, a change to an existing sticker (text, motion, face, prop, colour), or the water-tornado sticker — even if they only give the phrase.
---

# Axolotl stickers

Everything is pure Python (numpy + Pillow) plus ffmpeg; no GPU, no Blender. The repo root is the folder that holds `engine/`, `kit/` and `out/`.

```
pip install numpy pillow          # ffmpeg must be on PATH
python engine/build.py 301 --force            # render one spec (by id)
python engine/build.py 12,40-45 --force       # several
python engine/build.py                        # everything not yet rendered (resumable)
python engine/sheet.py 301-310                # review sheet -> ref/sheet_sel_N.png (cover + 3 frames each)
python engine/manifest.py                     # refresh out/stickers.json after adding stickers
python engine/tornado.py 我没事               # the water-tornado sticker ("-" = no text); needs engine/fetch_mc.py first
```

Output: `out/NNN_文字.gif` and the cover `out/_封面/NNN_文字.png`.

## Adding a sticker

One line per sticker in `engine/specs.py` (append at the end of the right section so existing ids stay stable):

```python
S('摸鱼', 'flagwave', 'happy', [], hold='fish', s=0.7)
#  text   motion     face    fx   extras
S('别催了', 'rage', 'angry', ['steam'], style='red', tmode='shake')
S('暴富', 'spin', 'money', ['coins', ('float', 'money', 3, 4)], style='gold')
```

Pick the motion that acts the phrase out, then a face, 0–2 effects, and at most one prop/hat. Keep text to 2–5 characters (6+ wraps to two lines and gets small). Use `/` to force a line break.

- **motion** (`engine/motions.py`, `engine/motions2.py`, 75 in total): nod shake hop jump flip spin sink popup peek hide tremble rage tantrum dance wag bow kowtow doze flop melt dash slidein look lookup wave cheer clap belly flipover float zoom pounce approach tilt shrink puff grow drift buoy sway headbang headbob roll circle stare shy turnaway think boing wobble faint run launch stretch slosh petrify glitch squish hiccup shakeoff nuzzle rise recoil bonk, and prop actions swing flagwave offer chomp drink read typing scan umbrella (these read `hold=`).
- **face** (`FACES` in motions.py): normal smile happy joy love star shock surprise angry rage sad cry sob teary sleep sleepy tired meh dead dizzy smug wink focus struggle blep drool money awkward side cool eat shy tiny up grin catface blank pout sparkle determined worried xd — or a dict like `{'L': 'big', 'R': 'big', 'mouth': 'o'}`.
- **fx** (`engine/fx.py`): hearts question exclaim shock anger sweat panic zzz notes tears stream rain bulb confetti fireworks stars steam gloom sparkles speed fire sun moon blush coins snow leaves check cross boom bubbles ghost dots loading bolt flash thumb plus1 flowers swirl skull twinkle brokenheart; generic ones take an icon name: `('float', 'diamond', n, size)`, `('pop', 'pin', size, (dx, dy))`, `('stay', 'clock', size, (dx, dy))`, `('say', 'mail')`, `('orbit', 'star', n, (rx, ry), size)`, `('fall', 'flower', n, size)`.
- **hold=** (held voxel prop): pickaxe sword wrench flag fish rod heart diamond emerald cookie apple melon carrot potion bulb book cup boba phone laptop gift cake tnt grass brick bowl popcorn torch rtorch magnifier mail key trophy controller bucket umbrella …
- **wear=[…]** (hats/face gear): party crown nightcap shades glasses band helmet halo horns phones bow chef grad flowers mask towel ice
- **style=** text colour: pink (default) blue purple red green gold gray cyan — match the mood (sad blue, angry red, money gold, done green, tired gray, night purple).
- **tmode=** text animation: stay (default) wave bounce shake shiver pulse droop swing zoom spin pop type slam.

## Review before you hand anything over

Render, then open the review sheet and actually look at it. Check that:
- the cover (first frame) shows the full text **and** the axolotl;
- the prop/effect reads at sticker size and is not hidden behind the text band (anything above the head shares space with the text);
- the white background stayed white (the exporter retries with a full-frame palette when ffmpeg tints it);
- the file is ≤ 1000 KB (the exporter steps down 64 → 24 colours automatically).

## Gotchas

- Motions that leave the frame mid-loop (launch, sink, dash, popup, slidein, glitch) must not use `pop`/`slam`/`type` text — the cover would catch the axolotl off screen.
- Too many stickers on one motion feels repetitive: keep any single motion to about 6 uses across the set (`python -c "import sys; sys.path.insert(0,'engine'); import specs, collections; print(collections.Counter(s['motion'] for s in specs.all_specs()).most_common(10))"`).
- Front legs are small and sit under the head; leg-only gestures barely read — pair them with a prop or an effect.
- Coordinates for props are head-local model pixels: the face is at z = -10, the head top at y = 9, +x is the viewer's left.
- Humour that lands with this audience is deadpan (难绷), not exaggerated screaming.

## The water tornado

`engine/tornado.py` draws the funnel as the same body of water as the pond (one outline, same colour, the white water line climbs the walls), spins spiral bands, flings drops and tumbles the axolotl in 3D together with vanilla Minecraft items made 3D (iron/turtle helmet, axolotl bucket, TNT). Run `python engine/fetch_mc.py` once to copy those textures from your own Minecraft client (1.21.2+ jar) — they are never committed.
