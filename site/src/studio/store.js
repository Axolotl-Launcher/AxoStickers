// 工程状态：当前工程 + 撤销 / 重做 + 自动存草稿。组件库（下载的 / 自己写的组件）在 library.js。
import { normalizeProject, DEFAULTS } from '../engine/project.js';

const DRAFT = 'axo-studio-draft-v2';

let seq = 0;
export const newId = (p = 'l') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const STARTER = () => normalizeProject({
  name: '摸鱼',
  layers: [
    { id: 'm1', type: 'motion', component: 'flagwave' },
    { id: 'f1', type: 'face', component: 'happy' },
    { id: 'p1', type: 'prop', component: 'fish' },
    { id: 'x1', type: 'fx', component: 'bubbles' },
    { id: 't1', type: 'text', component: 'stay', text: '摸鱼', style: 'pink' },
  ],
});

export class Store {
  constructor() {
    this.listeners = new Set();
    this.past = []; this.future = [];
    let raw = null;
    try { raw = localStorage.getItem(DRAFT); } catch { /* 没有 localStorage */ }
    let d = null;
    try { d = raw ? JSON.parse(raw) : null; } catch { d = null; }
    this.p = d ? normalizeProject(d) : STARTER();
    this.lastRaw = raw;                                      // 和工程来自同一次读取：存之前比一比，别的标签页写过就不盖
    this.selected = null;                                    // 选中的图层 id；null = 工程设置
    this.lastPush = 0;
    this.beforeChange = null;                                // 改工程 / 撤销 / 重做 / 换工程之前叫一声：预览上还没写进工程的手势先写进当前这份
    this.foreign = false;                                    // 另一个标签页存过草稿以后，这边就不再自动覆盖它
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === DRAFT && e.newValue && !this.foreign) { this.foreign = true; this.tell('foreign'); }
      });
      const now = () => { if (this.saveTimer) this.flush(true); };
      window.addEventListener('pagehide', now);
      document.addEventListener('visibilitychange', () => { if (document.hidden) now(); });
    } catch { /* 没有 window（测试环境） */ }
  }
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  tell(why) { for (const f of this.listeners) f(why); }
  // 草稿不是每改一下就存（拖滑块时一秒几十次，每次都要把整个工程转成 JSON）：停手 300 毫秒再存，关页面 / 切走时马上存
  emit(why) {
    if (!this.foreign) { clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.flush(), 300); }
    this.tell(why);
  }
  // 「看一眼有没有别的标签页写过 + 写进去」要一口气做完：有 Web Locks 就排队（同一个浏览器里的标签页轮流来），关页面时来不及排队就直接写
  flush(now = false) {
    clearTimeout(this.saveTimer); this.saveTimer = null;
    if (this.foreign) return;
    if (!now && globalThis.navigator?.locks?.request) { navigator.locks.request('axo-draft', () => this.write()).catch(() => this.write()); return; }
    this.write();
  }
  write() {
    if (this.foreign) return;
    let cur = null;
    try { cur = localStorage.getItem(DRAFT); } catch { /* 没有 localStorage */ }
    if (cur !== null && cur !== this.lastRaw) {                // 别的标签页刚写过（storage 事件还没轮到这边）：不盖掉它
      this.foreign = true; this.tell('foreign'); return;
    }
    const raw = JSON.stringify(this.p);
    try { localStorage.setItem(DRAFT, raw); this.lastRaw = raw; this.saveFailed = false; } catch { this.saveFailed = true; }   // 浏览器存储满了会失败：界面上的「已自动保存」跟着变
    this.onSaved?.(!this.saveFailed);
  }

  // 改工程：fn 直接改 draft；coalesce 用来把拖滑块这种连续操作合成一步撤销
  // fn 抛错时整个改动作废、工程回到改之前；带 userFacing 的错误（比如组件代码太多了）交给 onError 提示，不往外抛
  change(fn, { coalesce = null } = {}) {
    this.beforeChange?.();
    const now = performance.now();
    const pushed = !(coalesce && this.lastKey === coalesce && now - this.lastPush < 800);
    // 新的一步：拍下改之前的样子（进撤销栈，出错时也回到这里）。合进上一步的连续改动（拖滑块，一秒几十次）不再拍整份快照：
    // 出错时回到这一串改动开始之前（撤销栈顶就是那时候的样子），这一步撤销也一起拿掉
    const snap = pushed ? JSON.stringify(this.p) : null;
    try { fn(this.p); } catch (e) {
      const back = snap ?? this.past.pop();
      if (!snap) this.lastKey = null;
      this.p = normalizeProject(back ? JSON.parse(back) : this.p);
      if (e.userFacing && this.onError) { this.onError(e); return false; }
      throw e;
    }
    if (pushed) { this.past.push(snap); if (this.past.length > 120) this.past.shift(); }
    this.lastKey = coalesce; this.lastPush = now;
    this.future = [];
    this.p = normalizeProject(this.p);
    this.emit('change');
    return true;
  }
  replace(p, why = 'load') {
    this.beforeChange?.();
    this.past.push(JSON.stringify(this.p)); this.future = [];
    this.p = normalizeProject(p); this.selected = null; this.emit(why);
  }
  undo() { this.beforeChange?.(); if (!this.past.length) return; this.future.push(JSON.stringify(this.p)); this.p = normalizeProject(JSON.parse(this.past.pop())); this.emit('history'); }
  redo() { this.beforeChange?.(); if (!this.future.length) return; this.past.push(JSON.stringify(this.p)); this.p = normalizeProject(JSON.parse(this.future.pop())); this.emit('history'); }
  select(id) { if (id === this.selected) return; this.selected = id; for (const f of this.listeners) f('select'); }   // 同一个不重画：拖时间轴时重画会把正在拖的条换掉

  layer(id = this.selected) { return this.p.layers.find((l) => l.id === id) || null; }
  first(type) { return this.p.layers.find((l) => l.type === type) || null; }

  // 工程里自带的组件源码（改过的内置组件、自己写的）：origin 相同就替换
  putComponent(origin, source) {
    this.change((p) => {
      const i = p.components.findIndex((c) => c.origin === origin);
      if (i >= 0) p.components[i].source = source; else p.components.push({ origin, source });
    }, { coalesce: `code:${origin}` });
  }
  dropComponent(origin) { this.change((p) => { p.components = p.components.filter((c) => c.origin !== origin); }); }

}

export { DEFAULTS };
