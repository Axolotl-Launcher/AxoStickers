// 1 分钟短链接。网站是 GitHub Pages 上的静态文件，没有自己的服务器，短链接要借一个公开的中转站：ntfy.sh（开源的消息推送服务，允许跨域）。
// 隐私：工程先在浏览器里压缩、用随机密钥 AES-GCM 加密，交给 ntfy 的只是一串密文；密钥只在链接 # 后面（浏览器不会把 # 后面发给任何服务器）。
// 话题名是密钥的哈希，ntfy 也推不出密钥。打开的人按 since=60s 去取：过了 1 分钟 ntfy 就不再给；密文里也写着过期时间，过期了不解。
// 发起的页面还开着的话，1 分钟一到会让 ntfy 把这条删掉；没删掉的密文最多在 ntfy 上留 12 小时（ntfy.sh 自己的保留时间），没有链接解不开。
export const RELAY = 'https://ntfy.sh';
export const TTL = 60;                                          // 秒
const SKEW = 30000;                                             // 两台设备的时钟可以差 30 秒

const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const join = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function topicOf(raw) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', join(enc.encode('axo-share/'), raw)));
  return `axo-${b64u(h.subarray(0, 12))}`;
}

// code：分享码（和长链接里 ?s= 后面的一样）。返回 { key, expires, topic, id }，短链接是 #/e/<key>
export async function createShort(code) {
  if (!globalThis.crypto?.subtle) throw new Error('这个浏览器不支持加密（要 https 或 localhost）');
  const raw = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const expires = Date.now() + TTL * 1000;
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify({ v: 1, exp: expires, s: code }))));
  const body = b64u(join(iv, ct)), topic = await topicOf(raw);
  const big = body.length > 3800;                               // ntfy 一条消息最多 4 KB，再大就当成附件传
  const r = await fetch(`${RELAY}/${topic}`, { method: big ? 'PUT' : 'POST', headers: big ? { Filename: 'axo.txt' } : {}, body, cache: 'no-store', referrerPolicy: 'no-referrer' });
  if (!r.ok) throw new Error(r.status === 429 ? '中转站说发得太频繁了，过一会儿再试' : r.status === 413 ? '工程太大了，用完整链接吧' : `中转站返回 ${r.status}`);
  const m = await r.json();
  return { key: b64u(raw), expires, topic, id: m.id };
}

// 到期了：请 ntfy 把这条删掉（尽力而为，失败了也没关系：没有链接解不开，ntfy 自己 12 小时内也会清掉）
export async function dropShort({ topic, id }) {
  try { await fetch(`${RELAY}/${topic}/${id}`, { method: 'DELETE', cache: 'no-store', referrerPolicy: 'no-referrer', keepalive: true }); } catch { /* 删不掉就等 ntfy 自己清 */ }
}

// key：短链接 #/e/ 后面那一串。返回分享码；过期了抛 { expired: true }
export async function openShort(key) {
  let raw;
  try { raw = unb64u(key); } catch { raw = null; }
  if (!raw || raw.length !== 16) throw new Error('短链接不完整（复制的时候少了一截？）');
  const topic = await topicOf(raw);
  let msgs = [];
  for (let i = 0; i < 3 && !msgs.some((m) => m.event === 'message'); i++) {   // 刚发出去的消息 ntfy 要过一会儿才查得到
    if (i) await sleep(1200);
    const r = await fetch(`${RELAY}/${topic}/json?poll=1&since=${TTL + 5}s`, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error(`中转站返回 ${r.status}`);
    msgs = (await r.text()).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
  }
  const gone = new Set(msgs.filter((m) => m.event === 'message_delete').map((m) => m.sequence_id));
  const m = msgs.filter((x) => x.event === 'message' && !gone.has(x.id)).pop();
  const expired = () => Object.assign(new Error('这个短链接已经过期了（只能在 1 分钟内打开）：请对方重新分享一次，或者发完整链接'), { expired: true });
  if (!m) throw expired();
  let body = m.message || '';
  if (m.attachment?.url) {
    if (!m.attachment.url.startsWith(`${RELAY}/`) || m.attachment.size > 2 << 20) throw new Error('短链接的内容不对');
    const a = await fetch(m.attachment.url, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!a.ok) throw expired();
    body = await a.text();
  }
  let plain;
  try {
    const all = unb64u(body.trim()), k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    plain = JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, k, all.subarray(12))));
  } catch { throw new Error('短链接解不开（链接不完整，或者内容被改过）'); }
  if (!plain?.exp || Date.now() > plain.exp + SKEW || typeof plain.s !== 'string') throw expired();
  return plain.s;
}
