// 这台设备上的组件库：从工坊下载的、自己写的、从文件载入的组件代码。
// 存在浏览器的 IndexedDB（站点数据）里：「删除」就是真的从浏览器里删掉这一条，不是藏起来。
// 几个标签页之间用 BroadcastChannel 同步；IndexedDB 用不了（隐私模式、被禁用）时退回只在内存里，关掉页面就没了。
// 收藏是另一回事：只是一串 `类型:id`，存在 localStorage。
const DB = 'axo-studio', STORE = 'library', LEGACY = 'axo-my-components-v1', FAVS = 'axo-favs-v1';
const items = new Map();                                       // origin -> 条目
const listeners = new Set();
let db = null;
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('axo-library') : null;

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
function store(mode) { return db.transaction(STORE, mode).objectStore(STORE); }
async function reload() {
  if (!db) return;
  const all = await req(store('readonly').getAll());
  items.clear(); for (const e of all) items.set(e.origin, e);
}
const emit = (why) => { for (const f of listeners) f(why); };

// 从源码里读出 id / 类型 / 名字（只用正则，不执行代码）；工坊文件开头的 /* @axo {...} */ 说明卡优先
export function describe(source) {
  const head = /^\s*\/\*\s*@axo\s*(\{[\s\S]*?\})\s*\*\//.exec(source);
  let meta = {};
  try { meta = head ? JSON.parse(head[1]) : {}; } catch { /* 说明卡写坏了就按源码猜 */ }
  const pick = (re) => (re.exec(source) || [])[1];
  return {
    id: meta.id || pick(/id:\s*['"]([^'"]+)['"]/), type: meta.type || pick(/type:\s*['"](\w+)['"]/),
    name: meta.name || pick(/name:\s*['"]([^'"]+)['"]/), author: meta.author || '', version: meta.version || '', description: meta.description || '',
  };
}

export const ready = (async () => {
  try {
    db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'origin' });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    await reload();
  } catch { db = null; }
  try {                                                         // 第一版存在 localStorage 的「我的组件」搬过来，搬完删掉旧的
    const old = JSON.parse(localStorage.getItem(LEGACY) || '[]');
    for (const m of old) if (m?.origin && m.source && !items.has(m.origin)) await put({ ...describe(m.source), name: m.name, type: m.type || describe(m.source).type, origin: m.origin, source: m.source, from: 'mine' }, false);
    localStorage.removeItem(LEGACY);
  } catch { /* 没有 localStorage */ }
  bc?.addEventListener('message', async () => { await reload(); emit('sync'); });
})();

export const list = () => [...items.values()].sort((a, b) => (b.at || 0) - (a.at || 0));
export const get = (origin) => items.get(origin) || null;
export const has = (origin) => items.has(origin);
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

// 放进组件库（同一个 origin 覆盖）。from：repo（工坊）/ mine（自己写的）/ file（从文件载入）
export async function put(entry, notify = true) {
  const e = { ...describe(entry.source), ...entry, at: Date.now() };
  items.set(e.origin, e);
  if (db) await req(store('readwrite').put(e));
  if (notify) { emit('put'); bc?.postMessage('put'); }
  return e;
}

// 真的删掉：IndexedDB 里这一条没了
export async function remove(origin) {
  items.delete(origin);
  if (db) await req(store('readwrite').delete(origin));
  emit('remove'); bc?.postMessage('remove');
}

// ---------------- 收藏 ----------------
let favs = new Set();
try { favs = new Set(JSON.parse(localStorage.getItem(FAVS) || '[]')); } catch { /* 没有 localStorage */ }
export const isFav = (key) => favs.has(key);
export const favList = () => [...favs];
export function toggleFav(key, on = !favs.has(key)) {
  if (on) favs.add(key); else favs.delete(key);
  try { localStorage.setItem(FAVS, JSON.stringify([...favs])); } catch { /* 存不下就只在这次有效 */ }
  emit('fav');
  return on;
}
