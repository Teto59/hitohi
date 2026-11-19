/* 設定（localStorage）
 * 本番は 'hitohi-settings'、試作は 'hitohi-beta-settings'。
 * v2 が使うのは lastExport（最後に控えを書き出した時刻）だけ。v1 の音の設定などは読まないが、消さずに残す
 * （万一 v1 に戻した時に、元の設定のまま使えるように）。 */

export interface Settings {
  /** 最後に控えを書き出した時刻（ミリ秒）。まだなら 0 */
  lastExport: number;
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;

function readRaw(storage: KV, key: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(storage.getItem(key) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function loadSettings(storage: KV, key: string): Settings {
  const raw = readRaw(storage, key);
  const t = Number(raw.lastExport);
  return { lastExport: Number.isFinite(t) && t > 0 ? t : 0 };
}

/** 変えた項目だけを書き込む（知らない項目はそのまま残す） */
export function saveSettings(storage: KV, key: string, s: Settings): void {
  try {
    storage.setItem(key, JSON.stringify({ ...readRaw(storage, key), ...s }));
  } catch { /* 保存できなくても日記には関係ないので、黙って続ける */ }
}

/** 控えを書き出すよう、そっと知らせるか（5 日以上書いていて、30 日以上書き出していない） */
export function needsBackupNudge(entryCount: number, lastExport: number, now: number): boolean {
  const days = lastExport ? (now - lastExport) / 86400000 : Infinity;
  return entryCount >= 5 && days > 30;
}
