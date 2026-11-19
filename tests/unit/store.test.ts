import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { DB_VERSION, openDiary, STORE, type Entry } from '../../src/store';
import { makeV1DB } from './v1-db';

const e = (date: string, text: string, created = 1763500000000, updated = created): Entry => ({ date, text, created, updated });

beforeEach(() => {
  // 毎回まっさらな端末から
  globalThis.indexedDB = new IDBFactory();
});

describe('v1 の日記を引き継ぐ', () => {
  it('v1 が書いた日記（DB "hitohi" / 入れ物 "entries"）を、v2 がそのまま読める', async () => {
    const v1 = makeV1DB('hitohi');
    const written = [
      e('2026-11-17', '朝の空気が冷たくて、\n息が白く見えた。', 1763340000000, 1763350000000),
      e('2026-11-18', '「授業」のあと、少し遠回りして帰る。', 1763430000000, 1763440000000),
      e('2026-11-19', 'English & 数字 1,280円 と 𠮷野家。', 1763520000000, 1763530000000),
    ];
    for (const x of written) await v1.put(x);
    await v1.close();

    const v2 = openDiary('hitohi');
    const read = (await v2.all()).sort((a, b) => a.date.localeCompare(b.date));
    expect(read).toEqual(written); // 字も時刻も、一つも変わらない
  });

  it('v2 は DB の版を上げない（v1 に戻しても開ける）', async () => {
    const v2 = openDiary('hitohi');
    await v2.put(e('2026-11-19', 'v2 で書いた'));
    const db = await new Promise<IDBDatabase>((ok, ng) => {
      const rq = indexedDB.open('hitohi');
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = () => ng(rq.error);
    });
    expect(DB_VERSION).toBe(1);
    expect(db.version).toBe(1);
    expect([...db.objectStoreNames]).toEqual([STORE]);
    expect(db.transaction(STORE).objectStore(STORE).keyPath).toBe('date');
    db.close();
  });

  it('v2 が書いた日記を、v1 の処理でも読める（万一 v1 に戻した時）', async () => {
    const v2 = openDiary('hitohi');
    await v2.put(e('2026-11-20', 'v2 で書いた日'));
    const v1 = makeV1DB('hitohi');
    expect(await v1.all()).toEqual([e('2026-11-20', 'v2 で書いた日')]);
  });
});

describe('保存', () => {
  it('書く・書き直す・消す', async () => {
    const d = openDiary('hitohi');
    expect(await d.all()).toEqual([]);
    await d.put(e('2026-11-19', '一'));
    await d.put(e('2026-11-19', '一二', 1, 2));
    expect(await d.all()).toEqual([e('2026-11-19', '一二', 1, 2)]);
    await d.del('2026-11-19');
    expect(await d.all()).toEqual([]);
  });

  it('試作版（"hitohi-beta"）と本番（"hitohi"）は別の保存場所', async () => {
    const prod = openDiary('hitohi'), beta = openDiary('hitohi-beta');
    await prod.put(e('2026-11-19', '本番の日記'));
    await beta.put(e('2026-11-19', '試作で書いた'));
    await beta.del('2026-11-19');
    expect(await prod.all()).toEqual([e('2026-11-19', '本番の日記')]);
    expect(await beta.all()).toEqual([]);
  });

  it('保存に失敗したら、失敗として知らせる（黙って成功にしない）', async () => {
    const d = openDiary('hitohi');
    // キーのない記録は入れられない → 失敗
    await expect(d.put({ text: 'x' } as unknown as Entry)).rejects.toBeTruthy();
    expect(await d.all()).toEqual([]);
  });
});
