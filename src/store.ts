/* 日記の保存（IndexedDB）
 * v1 と同じ形：データベース名（本番 'hitohi'／試作 'hitohi-beta'）、版 1、入れ物 'entries'、キーは date。
 * 版の番号は上げない（上げると、v1 に戻した時に開けなくなる）。形を変える時は、古い形から引き継ぐ処理とテストを書く。 */

export interface Entry {
  /** 'YYYY-MM-DD' */
  date: string;
  text: string;
  /** 初めて書いた時刻（ミリ秒） */
  created: number;
  /** 最後に書いた時刻（ミリ秒） */
  updated: number;
}

export const STORE = 'entries';
export const DB_VERSION = 1;

export interface Diary {
  all(): Promise<Entry[]>;
  put(e: Entry): Promise<void>;
  del(date: string): Promise<void>;
}

export function openDiary(name: string, idb: IDBFactory = indexedDB): Diary {
  let opening: Promise<IDBDatabase> | null = null;
  const open = () => opening ?? (opening = new Promise<IDBDatabase>((ok, ng) => {
    const rq = idb.open(name, DB_VERSION);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE, { keyPath: 'date' });
    };
    rq.onsuccess = () => {
      const db = rq.result;
      // 別の画面（新しい版など）が開き直そうとしたら、こちらは閉じて道を譲る。次に使う時に開き直す
      db.onversionchange = () => { db.close(); opening = null; };
      ok(db);
    };
    rq.onerror = () => { opening = null; ng(rq.error); };
  }));

  async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
    const db = await open();
    return new Promise<T | undefined>((ok, ng) => {
      const t = db.transaction(STORE, mode);
      const rq = fn(t.objectStore(STORE));
      t.oncomplete = () => ok(rq ? rq.result : undefined);
      t.onerror = () => ng(t.error ?? new Error('transaction error'));
      t.onabort = () => ng(t.error ?? new Error('transaction aborted'));
    });
  }

  return {
    all: async () => (await run<Entry[]>('readonly', s => s.getAll())) ?? [],
    put: async e => { await run('readwrite', s => s.put(e)); },
    del: async k => { await run('readwrite', s => s.delete(k)); },
  };
}
