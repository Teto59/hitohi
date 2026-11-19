// @ts-check
/// <reference lib="webworker" />
/* ひとひ：オフラインで動かすための仕組み（Service Worker）
 * 組み立ての時に、先頭へ CONFIG（版・保存場所の名前・控えるファイルの一覧）が書き足される（build/plugin.ts）。
 *
 * ・アプリ本体は端末に控え、次に開いた時から通信なしで起動する。
 * ・書体は使った分だけ控えていく。
 * ・新しい版は裏で取り込み、取り込み終わったら切り替える（画面側が、書いている途中でなければ開き直す）。
 * ・同じ teto59.github.io の中には本番と試作版が同居している。控えの名前は CONFIG.prefix で分け、
 *   自分の控え以外は消さない。本番の仕組みは、試作版（beta/）の通信には手を出さない。 */

/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self);
const APP = `${CONFIG.prefix}-app-${CONFIG.version}`;
const FONTS = `${CONFIG.prefix}-fonts`;
const scopePath = new URL(sw.registration.scope).pathname;

sw.addEventListener('install', e => {
  // 途中の古い控えを使わず、必ず最新を取りに行く
  e.waitUntil(caches.open(APP)
    .then(c => c.addAll(CONFIG.shell.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      const oldMine = k.startsWith(`${CONFIG.prefix}-app-`) && k !== APP;
      const oldV1 = CONFIG.cleanV1 && /^hitohi-v\d+$/.test(k); // v1 の本体の控え（本番を v2 に切り替えた後だけ消す）
      if (oldMine || oldV1) await caches.delete(k);
    }
    await sw.clients.claim();
  })());
});

sw.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(FONTS, req)); return; }
  if (url.hostname === 'fonts.googleapis.com') { e.respondWith(staleWhileRevalidate(FONTS, req)); return; }
  if (url.origin !== location.origin || !url.pathname.startsWith(scopePath)) return;
  if (CONFIG.skip.some(p => url.pathname.startsWith(scopePath + p))) return; // 試作版の通信には手を出さない
  if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
  e.respondWith(cacheFirst(APP, req));
});

/** 取りに行く。圏外などで取れなければ「取れなかった」という返事にする（エラーで止めない） */
const net = (/** @type {Request} */ req) => fetch(req).catch(() => Response.error());

/** 画面を開く：控えてある本体（この版の index.html）をすぐ出す。なければ取りに行く */
async function page(/** @type {Request} */ req) {
  const hit = await (await caches.open(APP)).match('index.html');
  return hit || net(req);
}

/** 手元にあれば手元のものを、なければ取りに行って控える */
async function cacheFirst(/** @type {string} */ name, /** @type {Request} */ req) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreSearch: name === APP });
  if (hit) return hit;
  const res = await net(req);
  if (res.ok || res.type === 'opaque') c.put(req, res.clone()).catch(() => {});
  return res;
}

/** 手元のものをすぐ使い、裏で新しくする（書体の目録用） */
async function staleWhileRevalidate(/** @type {string} */ name, /** @type {Request} */ req) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const fresh = net(req).then(res => {
    if (res.ok) c.put(req, res.clone()).catch(() => {});
    return res;
  });
  return hit || fresh;
}
