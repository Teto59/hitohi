/* 組み立ての仕上げ（本番・試作版の違いをここでまとめて付ける）
 *  ・ホーム画面用の目録（manifest.webmanifest）とアイコン（試作版は別の名前・別のアイコン）
 *  ・オフライン用の仕組み sw.js（できあがったファイルの一覧と、中身から作る版の指紋を書き足す）
 *  ・試作版だけ：入口の手当て beta/app.js（src/beta-shim.js の説明を参照） */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

export type Channel = 'production' | 'beta';

const COLORS = { background: '#f1ece1', theme: '#f1ece1' };

function manifest(beta: boolean) {
  return {
    name: beta ? 'ひとひ（試作）' : 'ひとひ',
    short_name: beta ? 'ひとひ試作' : 'ひとひ',
    description: '鉛筆で綴る、一日一頁の日記',
    lang: 'ja',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: COLORS.background,
    theme_color: COLORS.theme,
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** dir の中のファイルを、dir からの相対パス（/ 区切り）で並べる */
function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p); else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

export function hitohi(channel: Channel): Plugin {
  const beta = channel === 'beta';
  const iconDir = beta ? 'brand/icons-beta' : 'brand/icons';
  let outDir = 'dist';
  return {
    name: 'hitohi',
    apply: 'build',
    enforce: 'post',
    configResolved(c) { outDir = c.build.outDir; },
    transformIndexHtml(html) {
      return {
        html: beta ? html.replace('<title>ひとひ</title>', '<title>ひとひ（試作）</title>') : html,
        tags: [
          { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: beta ? 'ひとひ試作' : 'ひとひ' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'manifest', href: 'manifest.webmanifest' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'apple-touch-icon', href: 'icons/icon-180.png' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: 'icons/icon-192.png' }, injectTo: 'head' },
        ],
      };
    },
    generateBundle() {
      for (const f of readdirSync(iconDir)) {
        this.emitFile({ type: 'asset', fileName: `icons/${f}`, source: readFileSync(join(iconDir, f)) });
      }
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifest(beta), null, 2) + '\n' });
      if (beta) this.emitFile({ type: 'asset', fileName: 'app.js', source: readFileSync('src/beta-shim.js', 'utf8') });
    },
    // すべて書き出し終わってから、実際のファイルを見て sw.js を作る
    writeBundle() {
      const files = listFiles(outDir).filter(f => f !== 'sw.js');
      const hash = createHash('sha256');
      for (const f of files) { hash.update(f); hash.update(readFileSync(join(outDir, f))); }
      // 最初に控えるもの：画面と本体と、ホーム画面の小さいアイコン（大きいアイコンや入口の手当ては控えない）
      const shell = ['./', ...files.filter(f => f === 'index.html' || f.startsWith('assets/')
        || f === 'manifest.webmanifest' || f === 'icons/icon-180.png' || f === 'icons/icon-192.png')];
      const config = {
        version: hash.digest('hex').slice(0, 12),
        prefix: beta ? 'hitohi-beta' : 'hitohi',
        shell,
        skip: beta ? [] : ['beta/'],
        cleanV1: !beta,
      };
      const body = readFileSync('src/sw.js', 'utf8').replace(/^\/\/ @ts-check\r?\n\/\/\/ <reference lib="webworker" \/>\r?\n/, '');
      writeFileSync(join(outDir, 'sw.js'), `const CONFIG = ${JSON.stringify(config)};\n${body}`);
    },
  };
}
