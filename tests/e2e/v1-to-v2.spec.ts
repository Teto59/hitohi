import { readFileSync } from 'node:fs';
import { BETA, day, expect, openApp, PROD, readDB, test, TODAY, TODAY_KEY, typeText } from './helpers';

/* 本物の v1（v1/ フォルダ。いま本番に出ているもの）で日記を書き、
 * 本番を v2 に切り替えた後（Cookie で配信を v2 の本番版に切り替えて再現）、同じ端末で全部読めるかを確かめる。 */

const switchToV2 = (page: import('@playwright/test').Page) =>
  page.context().addCookies([{ name: 'hitohi-prod', value: 'v2', url: 'http://localhost:4173' }]);

/** v1 の画面で、その日の日記を書いて綴じる */
async function writeWithV1(page: import('@playwright/test').Page, k: string | null, text: string) {
  if (k) await page.locator(`#grid .day[data-k="${k}"]`).click(); else await page.locator('#write-today').click();
  await expect(page.locator('#edit')).toBeVisible();
  await page.locator('#ed').focus();
  await typeText(page, text);
  await page.locator('#done').click();
  await expect(page.locator('#cal')).toBeVisible();
}

test('いま本番に出ているのは v1 そのもの（v1/ フォルダの中身と同じ）', async ({ page }) => {
  for (const f of ['index.html', 'app.js', 'app.css', 'sw.js', 'manifest.webmanifest']) {
    const res = await page.request.get(`${PROD}${f}`);
    expect(res.ok(), f).toBe(true);
    expect(Buffer.from(await res.body()).equals(readFileSync(`v1/${f}`)), f).toBe(true);
  }
});

test('v1 で書いた日記と控えの日付が、本番を v2 に切り替えた後もすべて見える', async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto(PROD);
  await expect(page.locator('#grid .day[data-k]').first()).toBeVisible();
  await expect(page.locator('#menu-open')).toBeVisible();
  expect(await page.locator('script[src="app.js"]').count()).toBe(1); // v1 の画面である
  await writeWithV1(page, '2026-11-10', '十日の日記。\n「かぎ」と English 123。');
  await writeWithV1(page, null, '今日の日記、v1 で書いた。');
  // v1 の栞から控えを書き出す（最後に書き出した日が v1 の設定に残る）
  await page.locator('#menu-open').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export').click()]);
  expect(JSON.parse(readFileSync((await download.path())!, 'utf8')).entries).toHaveLength(2);
  const v1Settings = await page.evaluate(() => JSON.parse(localStorage.getItem('hitohi-settings')!));
  expect(v1Settings.lastExport).toBeGreaterThan(0);
  const v1Records = await readDB(page, 'hitohi');
  expect(v1Records).toHaveLength(2);

  // ── 本番を v2 に切り替える ──
  await switchToV2(page);
  await page.goto(PROD);
  await expect(page.locator('#grid .day[data-k]').first()).toBeVisible();
  expect(await page.locator('script[src="app.js"]').count()).toBe(0); // v2 の画面である
  await expect(page).toHaveTitle('ひとひ');
  // 朱印がそのまま
  await expect(day(page, '2026-11-10').locator('.seal')).toHaveCount(1);
  await expect(day(page, TODAY_KEY).locator('.seal')).toHaveCount(1);
  // 中身がそのまま
  await day(page, '2026-11-10').click();
  await expect(page.locator('#read-hand')).toHaveText('十日の日記。「かぎ」と English 123。');
  await page.locator('#fix').click();
  await expect(page.locator('#ed')).toHaveValue('十日の日記。\n「かぎ」と English 123。');
  await page.locator('#edit-back').click();
  await day(page, TODAY_KEY).click();
  await expect(page.locator('#read-hand')).toHaveText('今日の日記、v1 で書いた。');
  await page.locator('#read-back').click();
  // 栞：日数と、v1 で控えを書き出した日
  await page.locator('#menu-open').click();
  await expect(page.locator('#days')).toHaveText('これまでに綴った日　2日');
  await expect(page.locator('#last-export')).toHaveText('最後に控えを書き出した日　十一月十九日（木）');
  await page.locator('#menu-close').click();

  // v2 で書き足しても、v1 と同じ形のまま。v1 の設定（音など）も消さない
  await page.locator('#write-today').click();
  await typeText(page, '\nv2 で書き足した。');
  await page.locator('#done').click();
  const after = await readDB(page, 'hitohi') as Record<string, unknown>[];
  expect(after).toHaveLength(2);
  for (const r of after) expect(Object.keys(r).sort()).toEqual(['created', 'date', 'text', 'updated']);
  const today = after.find(r => r.date === TODAY_KEY)!;
  const before = (v1Records as Record<string, unknown>[]).find(r => r.date === TODAY_KEY)!;
  expect(today.text).toBe('今日の日記、v1 で書いた。\nv2 で書き足した。');
  expect(today.created).toBe(before.created); // 初めて書いた時刻は変えない
  expect(await page.evaluate(() => indexedDB.databases())).toContainEqual({ name: 'hitohi', version: 1 });
  await expect(page.locator('#read')).toBeVisible(); // すでにあった日を綴じると「読む」へ
  await page.locator('#read-back').click();
  await page.locator('#menu-open').click();
  await page.locator('#menu-close').click();
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('hitohi-settings')!));
  expect(s).toMatchObject({ soundLevel: v1Settings.soundLevel, lead: v1Settings.lead, lastExport: v1Settings.lastExport });
});

test('試作版は、本番の日記にも設定にも触れない（別の保存場所）', async ({ page }) => {
  // 本番（v1）で書く
  await page.clock.setFixedTime(TODAY);
  await page.goto(PROD);
  await expect(page.locator('#grid .day[data-k]').first()).toBeVisible();
  await writeWithV1(page, null, '本番の大切な日記');
  const prodBefore = await readDB(page, 'hitohi');
  const settingsBefore = await page.evaluate(() => localStorage.getItem('hitohi-settings'));

  // 試作版を開く：本番の日記は見えない
  await openApp(page, BETA);
  await expect(page).toHaveTitle('ひとひ（試作）');
  await expect(page.locator('#grid .seal')).toHaveCount(0);
  // 試作版で書いて、消して、控えを書き出す
  await page.locator('#write-today').click();
  await typeText(page, '試作版で書いた');
  await page.locator('#done').click();
  await expect(day(page, TODAY_KEY).locator('.seal')).toHaveCount(1);
  await page.locator('#write-today').click();
  await page.locator('#ed').fill('');
  await page.locator('#done').click();
  await page.locator('#confirm-clear').click();
  await page.locator('#menu-open').click();
  await Promise.all([page.waitForEvent('download'), page.locator('#export').click()]);

  // 本番の日記・設定は、一字も変わっていない
  expect(await readDB(page, 'hitohi')).toEqual(prodBefore);
  expect(await page.evaluate(() => localStorage.getItem('hitohi-settings'))).toBe(settingsBefore);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hitohi-beta-settings')!).lastExport)).toBeGreaterThan(0);
  await page.goto(PROD);
  await expect(day(page, TODAY_KEY).locator('.seal')).toHaveCount(1);
});
