// 工程状态：当前工程 + 撤销 / 重做 + 自动存草稿。组件库（下载的 / 自己写的组件）在 library.js。
import { normalizeProject, DEFAULTS } from '../engine/project.js';

const DRAFT = 'axo-studio-draft-v2';
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

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
    const d = load(DRAFT, null);
    this.p = d ? normalizeProject(d) : STARTER();
    this.selected = null;                                    // 选中的图层 id；null = 工程设置
    this.lastPush = 0;
    this.foreign = false;                                    // 另一个标签页存过草稿以后，这边就不再自动覆盖它
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === DRAFT && e.newValue && !this.foreign) { this.foreign = true; this.tell('foreign'); }
      });
    } catch { /* 没有 window（测试环境） */ }
  }
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  tell(why) { for (const f of this.listeners) f(why); }
  emit(why) { if (!this.foreign) this.saveFailed = !save(DRAFT, this.p); this.tell(why); }   // 先存再通知：界面上的「已自动保存」看的是这次存没存上（浏览器存储满了会失败）

  // 改工程：fn 直接改 draft；coalesce 用来把拖滑块这种连续操作合成一步撤销
  // fn 抛错时整个改动作废、工程回到改之前；带 userFacing 的错误（比如组件代码太多了）交给 onError 提示，不往外抛
  change(fn, { coalesce = null } = {}) {
    const now = performance.now(), snap = JSON.stringify(this.p);
    const pushed = !(coalesce && this.lastKey === coalesce && now - this.lastPush < 800);
    try { fn(this.p); } catch (e) {
      this.p = normalizeProject(JSON.parse(snap));
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
    this.past.push(JSON.stringify(this.p)); this.future = [];
    this.p = normalizeProject(p); this.selected = null; this.emit(why);
  }
  undo() { if (!this.past.length) return; this.future.push(JSON.stringify(this.p)); this.p = normalizeProject(JSON.parse(this.past.pop())); this.emit('history'); }
  redo() { if (!this.future.length) return; this.past.push(JSON.stringify(this.p)); this.p = normalizeProject(JSON.parse(this.future.pop())); this.emit('history'); }
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
