import type { Page } from '@playwright/test';
import { BETA, expect, openApp, PROD, test } from './helpers';

/* オフライン（Service Worker）と、同じ場所に同居する本番・試作版の仕組みがぶつからないこと */
test.use({
  serviceWorkers: 'allow',
  // 圏外では、まだ端末に控えていない書体の字が読み込めず、ブラウザがそう知らせる（字はほかの書体で出る）
  allowedErrors: /^(Response served by service worker is an error|Cannot load \.)$/,
});

/** その場所の仕組みが働き、画面を受け持つまで待つ */
async function waitControlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
  }
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('試作版：一度開けば、機内モード（通信なし）でも起動する', async ({ page, context }) => {
  await openApp(page, BETA);
  await waitControlled(page);
  // 書体の目録も、オフライン用に控えられている
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('hitohi-beta-fonts')).keys()).length)).toBe(2);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#wafu')).toHaveText('霜月');
  await expect(page.locator('#grid .day[data-k]')).toHaveCount(30);
  // 書いて保存もできる
  await page.locator('#write-today').click();
  await page.keyboard.insertText('圏外で書いた');
  await page.locator('#done').click();
  await expect(page.locator('#grid .seal')).toHaveCount(1);
});

test('試作版の控え（キャッシュ）は、本番 v1 の控えを消さない', async ({ page }) => {
  await page.goto(PROD);
  // 本番 v1 の控えがある端末（v1 と同じ名前の控えを作っておく）
  await page.evaluate(async () => { await (await caches.open('hitohi-v8')).put('/hitohi/x', new Response('v1')); await caches.open('hitohi-fonts'); });
  await openApp(page, BETA);
  await waitControlled(page);
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toEqual(expect.arrayContaining(['hitohi-v8', 'hitohi-fonts']));
  expect(keys.filter(k => k.startsWith('hitohi-beta-app-'))).toHaveLength(1);
});

test('本番 v1 の仕組みが入っている Safari でも、試作版のアドレスで試作版が開く', async ({ page }) => {
  // 利用者の Safari の再現：本番 v1 の Service Worker が /hitohi/ を受け持っている
  await page.goto(PROD);
  await expect(page.locator('#grid .day[data-k]').first()).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('sw.js'); // v1 は https の時だけ自分で入れるので、ここでは手で入れる
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/hitohi\/sw\.js$/);
  // 試作版のアドレスを開く → v1 の仕組みが v1 の画面を出す → 入口の手当てで試作版の仕組みが入り、開き直す
  await page.goto(BETA);
  await expect(page.locator('#wafu')).toHaveText('霜月', { timeout: 15_000 });
  await expect(page).toHaveTitle('ひとひ（試作）');
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/hitohi\/beta\/sw\.js$/);
  // 開き直しても試作版のまま
  await page.reload();
  await expect(page).toHaveTitle('ひとひ（試作）');
  await expect(page.locator('#wafu')).toHaveText('霜月');
});

test('本番を v2 に切り替えた後も、本番の仕組みは試作版のアドレスに手を出さない', async ({ page, context }) => {
  await context.addCookies([{ name: 'hitohi-prod', value: 'v2', url: 'http://localhost:4173' }]);
  await openApp(page, PROD);
  await expect(page).toHaveTitle('ひとひ');
  await waitControlled(page);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/hitohi\/sw\.js$/);
  await page.goto(BETA);
  await expect(page).toHaveTitle('ひとひ（試作）');
  await expect(page.locator('#wafu')).toHaveText('霜月');
});
