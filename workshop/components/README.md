# 组件库

这里的 `*.axo.js` 会出现在网站编辑器的「组件」里，所有人都能直接用。加一个组件就是往这个文件夹开一个 PR：
在编辑器的「代码」面板里写好，点「提交到组件库」，GitHub 会帮你 fork 并开 PR；也可以自己把文件放进来。

不想进组件库也行：「下载」成 `.axo.js` 发给别人，对方把文件拖进编辑器就能用；发布到工坊时，工程里用到的自己的组件会一起带上。

## 文件长什么样

```js
/* @axo {"id":"wiggle","type":"motion","name":"扭一扭","author":"你的 GitHub 名字","version":"1.0.0","description":"一句话说明"} */
component({
  id: 'wiggle', type: 'motion', name: '扭一扭',
  params: {
    n: { label: '扭几下', type: 'int', min: 1, max: 8, default: 3 },
  },
  move(a, t) {
    addrot(a, 'root', 0, 0, 14 * this.ls(t, this.p.n));
    a.dx += 6 * this.ls(t, this.p.n);
  },
});
```

- 第一行的 `/* @axo {...} */` 是说明卡：一行 JSON，`id`、`type`、`name`、`author`、`version`、`description`。网站部署时只读这一行生成 `components/index.json`，不执行代码。
- 文件名用 id：`wiggle.axo.js`。id 只能是小写字母、数字、`-`、`_`；和内置组件同名会顶掉内置的。
- 一个文件里可以调用好几次 `component({...})`；`extends: '另一个 id'` 可以在别的组件上改（参数会合并）。

## 类型

| type | 做什么 | 要写的 |
|---|---|---|
| `motion` 动作 | 改美西螈这一帧的姿势和位置 | `move(a, t)`：`a` 是这一帧的状态（`a.dx` `a.dy` 位移，`a.sx` `a.sy` 缩放，`a.roll`，`a.pose` 骨骼），用 `addrot(a, 骨骼, x, y, z)` 转骨骼 |
| `fx` 特效 | 在画面上画东西 | `draw(ctx, t, layer)`：`layer` 是 `'back'`（美西螈后面）、`'front'`、`'top'`（最上面） |
| `textanim` 文字动画 | 每个字怎么动 | `xf(i, n, t)` 返回 `[dx, dy, 缩放, 旋转角度, 显示]`；开头字是空的就写 `entrance: true` 和 `cover(n)`（返回字全出来的时间，当封面） |
| `skin` 皮肤 | 给模型重新上色 | `tint(rgb, part)` 返回新颜色；`recolor(rgb, part, {body, gill, dark})` 按部位换色、保留深浅 |
| `prop` 道具 / `wear` 帽子 | 拿在手上 / 戴在头上的体素 | 数据：`sprite: [行, 调色板]`（像素画）或 `boxes: [...]`（方块） |
| `face` 表情 | 眼睛和嘴 | 数据：`face: {...}`，格式照内置的抄（编辑器里「表情」→ 代码） |
| `scene` 场景 | 接管整帧（水龙卷就是） | `render(ctx, t)`：用 `this.background(ctx)`、`this.axLayer(a)`、`this.placeAt(a, X, Y)`、`this.itemImage(items)`、`this.drawText(ctx, t)` 自己拼 |

所有类型都可以写 `setup()`（建场景时跑一次，预先算好随机数之类），动作和场景还能写 `drawSky` `drawBack` `drawFront` `drawTop(ctx, t)` 在对应的层上画。

## 能用的东西

`this` 是这一层的上下文：`this.p` 是参数值，`this.T` 一圈多少秒，`this.N` 多少帧，`this.FPS`，`this.layer` 是图层设置；
`this.ls(t, n)` / `this.lc(t, n)` 是一圈里来回 n 次的 sin / cos，`this.ph(t, n)` 是 0～1 的相位；
`this.headPt()` 脑袋在画面上的位置（`this.LAST` 有值以后才能用），`this.splash(t0, x, n)` 在水面溅水花，`this.hold(a, 道具)` / `this.wear(a, 帽子)`。

直接能用的函数和常量：`W` `H`（画布 512），`PI` `sin` `cos` `abs` `exp` `sqrt` `min` `max` `atan2` `hypot`…，
`clamp` `lerp` `mod` `easeIn` `easeOut` `easeIO` `easeOutBack` `elastic` `bump` `win`，`rng(seed)`（`.random()` `.uniform(a, b)` `.choice(list)`），
画图的 `icon(名字, 大小)` `put(ctx, 图, x, y, 缩放, 旋转)` `star` `sq` `rect` `line` `ellipse` `polygon` `makeCanvas`，
骨骼的 `addrot` `legmix` `LEGS` `GILLS` `BONES`，颜色的 `hex` `rgb2hsl` `hsl2rgb` `recolor`。编辑器里打字会自动补全，Ctrl+Enter 运行。

参数（`params`）会自动出现在右边的属性面板：`type` 可以是 `int` `number` `bool` `select`（加 `options`）`color` `icon` `text`，都要写 `default`。

## 规矩

- 组件只在浏览器沙盒里跑（`<iframe sandbox="allow-scripts">`，不能联网、碰不到网站的页面和存储），循环跑太久会被掐掉。别想着在里面发请求。
- 一帧要画得快：一张 GIF 几十帧，导出时每帧都要算。
- 不要放 Minecraft 原版材质或别的有版权的图；道具自己画像素画。
- 提交到这里就是同意按 GPL-3.0-only 发布（和仓库里其他东西一样）。
