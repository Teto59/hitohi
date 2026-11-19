/* 控え（バックアップ）：JSON の書き出しと読み込み。v1 と同じ形なので、v1 の控えも v2 の控えも互いに戻せる。
 *   { app: 'hitohi', version: 1, exportedAt: ISO 文字列, entries: [{date, text, created, updated}, ...] }
 * 戻す時は、同じ日がすでにあれば「新しく書いた方」を残す。 */

import { isDateKey, keyOf } from './koyomi';
import type { Entry } from './store';

export function makeBackup(entries: Iterable<Entry>, now: Date = new Date()): string {
  const list = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return JSON.stringify({ app: 'hitohi', version: 1, exportedAt: now.toISOString(), entries: list }, null, 1);
}

export function backupFileName(today: Date, beta: boolean): string {
  return `ひとひ控え${beta ? '-試作' : ''}-${keyOf(today)}.json`;
}

export class BackupFormatError extends Error {
  constructor() { super('not a hitohi backup'); }
}

/** 控えのファイルの中身を読む。「ひとひ」の控えでなければ BackupFormatError */
export function parseBackup(text: string, now: number = Date.now()): Entry[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new BackupFormatError(); }
  const d = data as { app?: unknown; entries?: unknown } | null;
  if (!d || d.app !== 'hitohi' || !Array.isArray(d.entries)) throw new BackupFormatError();
  const out: Entry[] = [];
  for (const x of d.entries as unknown[]) {
    const e = x as Partial<Entry> | null;
    if (!e || !isDateKey(e.date) || typeof e.text !== 'string' || !e.text.trim()) continue;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : now);
    out.push({ date: e.date, text: e.text, created: num(e.created), updated: num(e.updated) });
  }
  return out;
}

/** 戻すべきもの（まだない日と、控えの方が新しい日）だけを選ぶ */
export function pickNewer(current: ReadonlyMap<string, Entry>, incoming: Entry[]): Entry[] {
  const best = new Map<string, Entry>();
  for (const e of incoming) {
    const seen = best.get(e.date);
    if (!seen || e.updated > seen.updated) best.set(e.date, e);
  }
  return [...best.values()].filter(e => {
    const old = current.get(e.date);
    return !old || (old.updated || 0) < e.updated;
  });
}
