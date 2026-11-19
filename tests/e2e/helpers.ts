import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

export { expect };

/** テスト用の配信で、本番の位置（/hitohi/）に出す版を選ぶ（scripts/serve.mjs） */
export const serveProduction = (context: BrowserContext, v: 'v1' | 'v2') =>
  context.addCookies([{ name: 'hitohi-prod', value: v, url: 'http://localhost:4173' }]);
export const BETA = '/hitohi/beta/';
export const PROD = '/hitohi/';
/** テストの「今日」：2026 年 11 月 19 日（木）の朝 */
export const TODAY = new Date('2026-11-19T09:00:00+09:00');
export const TODAY_KEY = '2026-11-19';

export const test = base.extend<{ errors: string[]; allowedErrors: RegExp | null }>({
  /** そのテストでは起きてよい、ブラウザの知らせ（アプリのエラーではないもの） */
  allowedErrors: [null, { option: true }],
  // 書体はインターネットから読まない（なくても字は出る。テストを速く・安定させるため）
  context: async ({ context }, use) => {
    await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({
      status: 200, contentType: 'text/css', body: '/* テストでは書体を読まない */', headers: { 'access-control-allow-origin': '*' },
    }));
    await use(context);
  },
  // 画面の中でエラーが起きていないことも、毎回確かめる
  errors: [async ({ page, allowedErrors }, use) => {
    const errors: string[] = [];
    page.on('pageerror', e => {
      // 書体の読み込みの取りやめ（テストで書体を読まないため、開き直した時に出ることがある）は、アプリのエラーではない
      if (/fonts\.(googleapis|gstatic)\.com/.test(e.message)) return;
      if (allowedErrors?.test(e.message)) return;
      errors.push(e.message);
    });
    await use(errors);
    expect(errors, '画面の中でエラーが起きた').toEqual([]);
  }, { auto: true }],
});

/** アプリを開いて、暦が出るまで待つ */
export async function openApp(page: Page, path = BETA, now = TODAY): Promise<void> {
  await page.clock.setFixedTime(now);
  await page.goto(path);
  await expect(page.locator('#grid .day[data-k]').first()).toBeVisible();
}

export const day = (page: Page, k: string) => page.locator(`#grid .day[data-k="${k}"]`);

/** 端末の日記（IndexedDB）をそのまま読む */
export function readDB(page: Page, name: string) {
  return page.evaluate(n => new Promise<unknown[]>((ok, ng) => {
    const rq = indexedDB.open(n);
    rq.onupgradeneeded = () => rq.result.createObjectStore('entries', { keyPath: 'date' });
    rq.onsuccess = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('entries')) { db.close(); ok([]); return; }
      const g = db.transaction('entries').objectStore('entries').getAll();
      g.onsuccess = () => { db.close(); ok(g.result); };
      g.onerror = () => ng(g.error);
    };
    rq.onerror = () => ng(rq.error);
  }), name);
}

/** 端末の日記（IndexedDB）に直接書く（v1 と同じ形） */
export function seedDB(page: Page, name: string, entries: { date: string; text: string; created?: number; updated?: number }[]) {
  return page.evaluate(([n, list]) => new Promise<void>((ok, ng) => {
    const rq = indexedDB.open(n, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('entries', { keyPath: 'date' });
    rq.onsuccess = () => {
      const db = rq.result, t = db.transaction('entries', 'readwrite');
      for (const e of list) t.objectStore('entries').put({ created: 1763500000000, updated: 1763500000000, ...e });
      t.oncomplete = () => { db.close(); ok(); };
      t.onerror = () => ng(t.error);
    };
    rq.onerror = () => ng(rq.error);
  }), [name, entries] as const);
}

/** 書く画面で字を打つ（iPhone のキーボードの代わり） */
export async function typeText(page: Page, text: string): Promise<void> {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i) await page.keyboard.press('Enter');
    if (lines[i]) await page.keyboard.insertText(lines[i]);
  }
}

/** 自動保存（0.5 秒）が終わるのを待つ */
export const waitAutosave = (page: Page) => page.waitForTimeout(900);
