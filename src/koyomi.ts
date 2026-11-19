/* 暦の計算（v1 から移植。計算式は変えていない）
 * 日付の扱い・漢数字・和風月名・二十四節気・月齢。画面には触らない、ただの計算。 */

export const pad = (n: number): string => String(n).padStart(2, '0');

/** 日付 → 'YYYY-MM-DD'（端末の時刻で） */
export const keyOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'YYYY-MM-DD' → その日の 0 時（端末の時刻で） */
export function fromKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfToday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const isDateKey = (k: unknown): k is string => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);

const KN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 0〜99 を漢数字に（十一、二十、三十一 など） */
export function kanjiNum(n: number): string {
  if (n < 10) return KN[n];
  const t = Math.floor(n / 10), o = n % 10;
  return (t === 1 ? '' : KN[t]) + '十' + (o ? KN[o] : '');
}

/** 2026 → 二〇二六 */
export const kanjiYear = (y: number): string => String(y).split('').map(c => KN[Number(c)]).join('');

export const WAFU = ['睦月', '如月', '弥生', '卯月', '皐月', '水無月', '文月', '葉月', '長月', '神無月', '霜月', '師走'];
export const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/** 十一月十九日 */
export const dateLabel = (d: Date): string => `${kanjiNum(d.getMonth() + 1)}月${kanjiNum(d.getDate())}日`;
/** 十一月十九日（木） */
export const dateLabelW = (d: Date): string => `${dateLabel(d)}（${WEEK[d.getDay()]}）`;
/** 十一月　二〇二六 */
export const monthLabel = (y: number, m: number): string => `${kanjiNum(m + 1)}月　${kanjiYear(y)}`;

/** 字数（改行や空白は数えない） */
export function countChars(text: string): number {
  let n = 0;
  for (const c of text) if (!/\s/.test(c)) n++;
  return n;
}
export const charLabel = (n: number): string => (n ? `${n}字` : '');

/* ── 二十四節気：太陽黄経（簡易式）から求める ── */
const jdOf = (ms: number): number => ms / 86400000 + 2440587.5;

export function sunLon(jd: number): number {
  const T = (jd - 2451545) / 36525, r = Math.PI / 180;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * r)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M * r) + 0.000289 * Math.sin(3 * M * r);
  const l = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * r);
  return ((l % 360) + 360) % 360;
}

export const SEKKI = ['春分', '清明', '穀雨', '立夏', '小満', '芒種', '夏至', '小暑', '大暑', '立秋', '処暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '啓蟄'];

/** 日本時間のその日のうちに節気の境を越えるなら、その節気の名前（m は 0 始まり） */
export function sekkiOn(y: number, m: number, d: number): string | null {
  const s = Date.UTC(y, m, d) - 9 * 3600000;
  const a = Math.floor(sunLon(jdOf(s)) / 15), b = Math.floor(sunLon(jdOf(s + 86400000)) / 15);
  return a !== b ? SEKKI[b % 24] : null;
}

/* ── 月齢（日本時間の正午の値。平均の朔望月で数える） ── */
export const SYN = 29.530588853;
export function moonAge(y: number, m: number, d: number): number {
  const a = (jdOf(Date.UTC(y, m, d, 12) - 9 * 3600000) - 2451550.1) % SYN;
  return a < 0 ? a + SYN : a;
}

/** その月のマス目：最初の日の曜日（空きマスの数）と日数 */
export function monthShape(y: number, m: number): { lead: number; days: number } {
  return { lead: new Date(y, m, 1).getDay(), days: new Date(y, m + 1, 0).getDate() };
}
