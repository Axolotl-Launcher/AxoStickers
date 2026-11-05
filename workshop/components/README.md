# 工坊

这里的 `*.axo.js` 会出现在网站编辑器的「工坊」里，所有人都能看到、一键添加（下载到自己浏览器的组件库，之后在它那一类里就能用）。
工坊投稿暂未开放（维护者：重新开放的步骤见根目录 README）。

分类按 `type` 来：`scene`（多种效果拼起来、接管整帧的，比如水龙卷）在工坊里叫「组件」；`textanim` 归「文字」，`fx` 归「特效」，`motion` 归「动作」，以此类推。

自己写的组件：「下载」成 `.axo.js` 发给别人，对方把文件拖进编辑器就能用；分享工程时，工程里用到的组件代码会一起带上。下面是文件的写法。

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

所有类型都可以写 `setup()`（建场景时跑一次，预先算好随机数之类），动作和场景还能写 `drawSky` `drawBack` `drawFront` `drawTop(ctx, t)` 在对应的层上画；文字动画也能写 `draw(ctx, t, lay)`，在这一行字画完以后画（`lay` 是每个字的 `[字, x, y, 字号]`，比如蹦出来时炸开的小星星）。

几个写在 def 上的开关：动作的 `offscreen: true`（中途离开画面，编辑器里归到「中途离开画面的」）、`holdsItself: true`（自己拿道具，「道具」图层就不再替它拿）；
道具可以写 `shape(k, …)` 按进度返回 `boxes`（动作里用 `this.propDef(道具)` 拿到它，`this.hold(a, 道具, { boxes, geo: '缓存用的名字' })`，比如日志纸一行行打字）；
自己用表情字体画字的组件写 `glyphs: '会用到的字'`，它 `type: 'text'` 的参数里的字也会提前下好（不然画出来是系统字体）。

## 能用的东西

`this` 是这一层的上下文：`this.p` 是参数值，`this.T` 一圈多少秒，`this.N` 多少帧，`this.FPS`，`this.layer` 是图层设置；
`this.ls(t, n)` / `this.lc(t, n)` 是一圈里来回 n 次的 sin / cos，`this.ph(t, n)` 是 0～1 的相位；
`this.headPt()` 脑袋在画面上的位置（`this.LAST` 有值以后才能用），`this.splash(t0, x, n)` 在水面溅水花，`this.hold(a, 道具)` / `this.wear(a, 帽子)`；
`this.stage.poseAt(t)` 别的时刻的姿势（只算不画），`this.stage.projAt(a, 世界坐标)` / `this.stage.itemAt(道具位置, 点, a)` 投到画面上（比如扔出去之前道具在哪儿）；
动作的 `move` 里往 `this.stage.rings` 推 `[x, y, 横半径, 竖半径, 不透明度]` 就多一圈涟漪，`this.stage.rippleOn = false` 关掉默认的涟漪（只管这一帧）。
工程里写 `cover`（0～1）能自己定封面在一圈里的哪儿，不写就是字刚好出全那一帧。

直接能用的函数和常量：`W` `H`（画布 512），`PI` `sin` `cos` `abs` `exp` `sqrt` `min` `max` `atan2` `hypot`…，
`clamp` `lerp` `mod` `easeIn` `easeOut` `easeIO` `easeOutBack` `elastic` `bump` `win`，`rng(seed)`（`.random()` `.uniform(a, b)` `.choice(list)`），
画图的 `icon(名字, 大小)` `put(ctx, 图, x, y, 缩放, 旋转)` `star` `sq` `rect` `line` `ellipse` `polygon` `makeCanvas`，
界面小字和提示条 `label(ctx, 字, x, y, 字号, 颜色, 对齐)` `labelWidth(字, 字号)` `roundRect(ctx, x0, y0, x1, y1, 圆角, 填充, 描边)` `pill(ctx, x, y, 字, { color, sc, check })`（「✓ 已发送」那种），
骨骼的 `addrot` `legmix` `LEGS` `GILLS` `BONES`，颜色的 `hex` `rgb2hsl` `hsl2rgb` `recolor`。编辑器里打字会自动补全，Ctrl+Enter 运行。

参数（`params`）会自动出现在右边的属性面板：`type` 可以是 `int` `number` `bool` `select`（加 `options`）`color` `icon` `text`，都要写 `default`。

## 模型

`workshop/models/` 放模型：一个说明卡 `<id>.json` 加一个 `.glb` 文件，出现在工坊的「模型」分类里，添加后在编辑器「模型」里能换上。

```json
{"id": "my-model", "type": "model", "name": "我的模型", "author": "你的 GitHub 名字", "version": "1.0.0", "description": "一句话说明", "file": "my-model.glb", "face": false}
```

- 用 Blockbench 做方块模型，导出成 `.glb`（贴图内嵌），最多 4 MB。节点名叫 `head`、`body`、`tail`、`leg1`～`leg4`、`top_gills`、`left_gills`、`right_gills` 的会跟着动作动。
- `face`：要不要在头的正面画表情（脸不在那儿的模型写 `false`）。
- 在编辑器里「载入模型文件」能先试一下读不读得出来、动作对不对。

## 规矩

- 组件只在浏览器沙盒里跑（`<iframe sandbox="allow-scripts">`，不能联网、碰不到网站的页面和存储），循环跑太久会被掐掉。别想着在里面发请求。
- 一帧要画得快：一张 GIF 几十帧，导出时每帧都要算。
- 不要放 Minecraft 原版材质或别的有版权的图；道具自己画像素画。
- 这个文件夹里的东西和仓库里其他东西一样按 GPL-3.0-only 发布。
