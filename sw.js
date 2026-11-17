/* ひとひ：オフラインで動かすための仕組み
 * アプリ本体は端末に保存し、次に開いた時から通信なしで起動する。
 * 書体は使った分だけ保存していく。新しい版は裏で取り込み、次に開いた時に切り替わる。 */
const VERSION = 'hitohi-v2'; // 中身を変えたら必ず上げる
const SHELL = [
  './', './index.html', './app.css', './app.js', './manifest.webmanifest',
  './sound/scribble.mp3', './icons/icon-180.png', './icons/icon-192.png',
];
const FONT_CACHE = 'hitohi-fonts';

self.addEventListener('install', e => {
  // 途中の古い控えを使わず、必ず最新を取りに行く
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 書体ファイル：一度読んだら端末のものを使う
  if (url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // 書体の目録：手元のものをすぐ使い、裏で新しくする
  if (url.hostname === 'fonts.googleapis.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // アプリ本体：手元のものをすぐ使い、裏で新しい版を取り込む
  e.respondWith(caches.open(VERSION).then(async c => {
    const isPage = req.mode === 'navigate';
    const hit = await c.match(isPage ? './index.html' : req, { ignoreSearch: true });
    const net = fetch(req).then(res => {
      if (res.ok) c.put(isPage ? './index.html' : req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
