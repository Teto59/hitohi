/* v1 の保存の処理（v1/app.js の「保存（IndexedDB）」の部分をそのまま写したもの。変えないこと）
 * v2 が v1 の日記を読めるか、v1 が v2 の書いた日記を読めるか（万一 v1 に戻した時）を確かめるために使う。 */
/* eslint-disable */
// @ts-nocheck
export function makeV1DB(name = 'hitohi') {
  // ↓ v1/app.js 76〜97 行目（データベース名だけ引数にした。本番の v1 は 'hitohi'）
  const DB = (() => {
    let p;
    const open = () => p || (p = new Promise((ok, ng) => {
      const rq = indexedDB.open(name, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('entries', { keyPath: 'date' });
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => ng(rq.error);
    }));
    async function run(mode, fn) {
      const db = await open();
      return new Promise((ok, ng) => {
        const t = db.transaction('entries', mode), rq = fn(t.objectStore('entries'));
        t.oncomplete = () => ok(rq ? rq.result : undefined);
        t.onerror = () => ng(t.error);
      });
    }
    return {
      all: () => run('readonly', s => s.getAll()),
      put: e => run('readwrite', s => s.put(e)),
      del: k => run('readwrite', s => s.delete(k)),
      close: async () => (await open()).close(),
    };
  })();
  return DB;
}
