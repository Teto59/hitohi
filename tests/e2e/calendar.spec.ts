import { BETA, day, expect, openApp, seedDB, test, TODAY_KEY } from './helpers';

test.describe('暦', () => {
  test('今月の和風月名・二十四節気・月の満ち欠け・今日の丸', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#wafu')).toHaveText('霜月');
    await expect(page.locator('#ym')).toHaveText('十一月　二〇二六');
    await expect(page.locator('#sekki')).toHaveText('立冬　·　小雪');
    await expect(page.locator('#grid .day[data-k]')).toHaveCount(30);
    await expect(page.locator('#grid .day[data-k] .moon')).toHaveCount(30);
    await expect(day(page, '2026-11-07').locator('.term')).toHaveText('立冬');
    await expect(day(page, '2026-11-22').locator('.term')).toHaveText('小雪');
    // 今日だけ鉛筆の丸
    await expect(page.locator('.today-ring')).toHaveCount(1);
    await expect(day(page, TODAY_KEY).locator('.today-ring')).toHaveCount(1);
    // 未来の日は押せない、過去の日は押せる
    await expect(day(page, '2026-11-20')).toBeDisabled();
    await expect(day(page, '2026-11-30')).toBeDisabled();
    await expect(day(page, '2026-11-01')).toBeEnabled();
    // 今月を見ている時は「今日」も「次の月」も出さない
    await expect(page.locator('#go-today')).toBeHidden();
    await expect(page.locator('#next')).toBeHidden();
  });

  test('左右になでると月がめくれ、前の月で「今日」を押すと今月に戻る', async ({ page }) => {
    await openApp(page);
    // 指でなでる（この WebKit では Touch を作れないので、同じ中身を持った知らせを送る）
    const swipe = (dx: number) => page.locator('#grid').evaluate((g, dx) => {
      const r = g.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 40;
      const send = (type: string, cx: number) => {
        const ev = new Event(type, { bubbles: true });
        const pts = [{ clientX: cx, clientY: y }];
        Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : pts });
        Object.defineProperty(ev, 'changedTouches', { value: pts });
        g.dispatchEvent(ev);
      };
      send('touchstart', x);
      send('touchend', x + dx);
    }, dx);
    await swipe(120); // 右へなでる → 前の月
    await expect(page.locator('#wafu')).toHaveText('神無月');
    await expect(page.locator('#ym')).toHaveText('十月　二〇二六');
    await expect(page.locator('#go-today')).toBeVisible();
    await swipe(120);
    await expect(page.locator('#wafu')).toHaveText('長月');
    await swipe(-120); // 左へなでる → 次の月
    await expect(page.locator('#wafu')).toHaveText('神無月');
    await page.locator('#go-today').click();
    await expect(page.locator('#wafu')).toHaveText('霜月');
    await expect(page.locator('#go-today')).toBeHidden();
    // 未来の月へはめくれない
    await swipe(-120);
    await expect(page.locator('#wafu')).toHaveText('霜月');
  });

  test('‹ › でも月をめくれる（年をまたぐ）', async ({ page }) => {
    await openApp(page, BETA, new Date('2027-01-10T09:00:00+09:00'));
    await expect(page.locator('#wafu')).toHaveText('睦月');
    await page.locator('#prev').click();
    await expect(page.locator('#wafu')).toHaveText('師走');
    await expect(page.locator('#ym')).toHaveText('十二月　二〇二六');
    await page.locator('#next').click();
    await expect(page.locator('#ym')).toHaveText('一月　二〇二七');
  });

  test('日記を書いた日には朱印、夜は月が淡い金色', async ({ page }) => {
    await openApp(page);
    await seedDB(page, 'hitohi-beta', [{ date: '2026-11-17', text: '一' }]);
    await page.reload();
    await expect(day(page, '2026-11-17').locator('.seal')).toHaveCount(1);
    await expect(page.locator('#grid .seal')).toHaveCount(1);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(day(page, '2026-11-17').locator('.moon-lit')).toHaveCSS('fill', 'rgb(230, 194, 122)');
  });

  test('昼と夜で色が切り替わる', async ({ page }) => {
    await openApp(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(241, 236, 225)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(29, 28, 26)');
  });
});
