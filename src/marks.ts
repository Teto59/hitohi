/* 暦や頁に描く小さな印（月・朱印・今日の丸）。v1 から移植。
 * 揺らぎは日付から決まる乱数で付けるので、開くたびに同じ形になる。 */

import { SYN } from './koyomi';

/** 文字列 → 32bit の数（FNV-1a） */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (const c of s) { h ^= c.codePointAt(0)!; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 種から決まる 0〜1 の乱数列 */
export function seeded(seed: number): () => number {
  let s = (seed % 2147483646) + 1;
  return () => (s = s * 16807 % 2147483647) / 2147483647;
}

/** 月の満ち欠け（age は月齢） */
export function moonSVG(age: number): string {
  const r = 7, p = age / SYN, k = Math.cos(2 * Math.PI * p), wax = p < 0.5, N = 14, pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) { const y = -r + 2 * r * i / N, w = Math.sqrt(Math.max(0, r * r - y * y)); pts.push([wax ? w : -w, y]); }
  for (let i = N; i >= 0; i--) { const y = -r + 2 * r * i / N, w = Math.sqrt(Math.max(0, r * r - y * y)); pts.push([wax ? k * w : -k * w, y]); }
  const d = 'M' + pts.map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L') + 'Z';
  return `<svg class="moon" viewBox="-9 -9 18 18" aria-hidden="true"><circle r="${r}" class="moon-rim"/><path d="${d}" class="moon-lit"/></svg>`;
}

/** 朱の印「記」。stamp なら押される動きを付ける */
export function sealSVG(key: string, stamp = false): string {
  const r = seeded(hashStr('seal' + key));
  const rot = ((r() - .5) * 16).toFixed(1);
  return `<svg class="seal${stamp ? ' stamp' : ''}" viewBox="0 0 20 20" style="--r:${rot}deg;transform:rotate(${rot}deg)" aria-hidden="true">`
    + `<g filter="url(#stamp)"><rect x="1.5" y="1.5" width="17" height="17" rx="2.4" class="seal-bg"/><text x="10" y="14.6" class="seal-tx">記</text></g></svg>`;
}

/** 今日を囲む鉛筆の丸 */
export function ringSVG(key: string): string {
  const r = seeded(hashStr('ring' + key)), j = () => ((r() - .5) * 2.4).toFixed(1);
  return `<svg class="today-ring" viewBox="0 0 34 26" aria-hidden="true"><path d="M27 4c-6-3-17-2-22 4s-2 14 7 15 18-2 19-9-4-10-10-11"`
    + ` transform="translate(${j()} ${j()})"/></svg>`;
}
