// 自動テスト用の小さな配信（GitHub Pages の代わり）
//   http://localhost:<port>/hitohi/...  → site/...（本番の位置。v1 のまま）
//   ただし Cookie「hitohi-prod=v2」付きの時は、/hitohi/ を dist/production（v2 の本番版）から出す
//   → 「v1 で書いた日記を、本番を v2 に切り替えた後に読めるか」を、本物の v1 を使って確かめるため
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path === '/hitohi' || path === '/hitohi/beta') { res.writeHead(301, { location: path + '/' }); res.end(); return; }
  if (!path.startsWith('/hitohi/')) { res.writeHead(404); res.end('not found'); return; }
  path = path.slice('/hitohi/'.length);
  const v2 = /(?:^|;\s*)hitohi-prod=v2(?:;|$)/.test(req.headers.cookie || '');
  let root = 'site';
  if (v2 && !path.startsWith('beta/') && path !== 'beta') root = 'dist/production';
  let file = normalize(join(root, path));
  if (!file.startsWith(normalize(root))) { res.writeHead(403); res.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`serving http://localhost:${port}/hitohi/`));
