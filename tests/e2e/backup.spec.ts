import { readFileSync, writeFileSync } from 'node:fs';
import { expect, openApp, readDB, seedDB, test, TODAY_KEY } from './helpers';

test.describe('栞・控え', () => {
  test('控えを書き出す → 別の端末（まっさら）で戻すと、同じ日記が戻る', async ({ page, browser }, info) => {
    await openApp(page);
    await seedDB(page, 'hitohi-beta', [
      { date: '2026-11-17', text: '朝の空気が冷たくて、\n息が白く見えた。', created: 1, updated: 2 },
      { date: TODAY_KEY, text: '「雨」 & <b>1,280円</b>', created: 3, updated: 4 },
    ]);
    await page.reload();
    await page.locator('#menu-open').click();
    await expect(page.locator('#days')).toHaveText('これまでに綴った日　2日');
    await expect(page.locator('#last-export')).toHaveText('まだ控えを書き出していません。');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export').click()]);
    expect(download.suggestedFilename()).toBe('ひとひ控え-試作-2026-11-19.json');
    await expect(page.locator('#io-msg')).toHaveText('2日分の控えを書き出しました。');
    await expect(page.locator('#last-export')).toHaveText('最後に控えを書き出した日　十一月十九日（木）');
    const file = info.outputPath('backup.json');
    await download.saveAs(file);
    const data = JSON.parse(readFileSync(file, 'utf8'));
    expect(data).toMatchObject({ app: 'hitohi', version: 1 });
    expect(data.entries).toEqual(await readDB(page, 'hitohi-beta'));

    // まっさらな端末で戻す
    const ctx2 = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' });
    await ctx2.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const p2 = await ctx2.newPage();
    await openApp(p2);
    await expect(p2.locator('#grid .seal')).toHaveCount(0);
    await p2.locator('#menu-open').click();
    await p2.locator('#import').setInputFiles(file);
    await expect(p2.locator('#io-msg')).toHaveText('2日分を戻しました。');
    await expect(p2.locator('#days')).toHaveText('これまでに綴った日　2日');
    await p2.locator('#menu-close').click();
    await expect(p2.locator('#grid .seal')).toHaveCount(2);
    expect(await readDB(p2, 'hitohi-beta')).toEqual(data.entries);
    // もう一度戻しても、新しい日はない
    await p2.locator('#menu-open').click();
    await p2.locator('#import').setInputFiles(file);
    await expect(p2.locator('#io-msg')).toHaveText('新しく戻す日はありませんでした。');
    await ctx2.close();
  });

  test('「ひとひ」の控えでないファイルは断る（日記は変わらない）', async ({ page }, info) => {
    await openApp(page);
    await seedDB(page, 'hitohi-beta', [{ date: TODAY_KEY, text: 'そのまま' }]);
    await page.reload();
    const bad = info.outputPath('bad.json');
    writeFileSync(bad, '{"something":"else"}');
    await page.locator('#menu-open').click();
    await page.locator('#import').setInputFiles(bad);
    await expect(page.locator('#io-msg')).toContainText('「ひとひ」の控えではないようです');
    expect(await readDB(page, 'hitohi-beta')).toEqual([expect.objectContaining({ text: 'そのまま' })]);
  });

  test('5 日以上書いていて 30 日以上書き出していなければ、栞に小さな朱の点', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#menu-open')).not.toHaveClass(/nudge/);
    await seedDB(page, 'hitohi-beta', ['01', '02', '03', '04', '05'].map(d => ({ date: `2026-11-${d}`, text: d })));
    await page.reload();
    await expect(page.locator('#menu-open')).toHaveClass(/nudge/);
    await page.locator('#menu-open').click();
    await Promise.all([page.waitForEvent('download'), page.locator('#export').click()]);
    await expect(page.locator('#menu-open')).not.toHaveClass(/nudge/);
  });

  test('栞に書体のクレジットと版の名前。音の設定はない', async ({ page }) => {
    await openApp(page);
    await page.locator('#menu-open').click();
    await expect(page.locator('.credit')).toContainText('Klee One／Yuji Syuku（SIL Open Font License）');
    await expect(page.locator('#version')).toContainText('（試作）');
    await expect(page.locator('#menu')).not.toContainText('音');
    await page.locator('#menu-scrim').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#menu')).toBeHidden();
  });
});
