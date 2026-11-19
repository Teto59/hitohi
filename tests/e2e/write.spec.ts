import { BETA, day, expect, openApp, readDB, seedDB, test, TODAY_KEY, typeText, waitAutosave } from './helpers';

const ed = '#ed';

test.describe('書く', () => {
  test('「書く」を押すと、すぐ入力欄にカーソル（末尾）', async ({ page }) => {
    await openApp(page);
    await seedDB(page, 'hitohi-beta', [{ date: TODAY_KEY, text: '朝の空気が冷たくて、\n息が白く見えた。' }]);
    await page.reload();
    await page.locator('#write-today').click();
    await expect(page.locator('#edit')).toBeVisible();
    await expect(page.locator('#edit-date')).toHaveText('十一月十九日（木）');
    await expect(page.locator(ed)).toBeFocused();
    await expect(page.locator(ed)).toHaveValue('朝の空気が冷たくて、\n息が白く見えた。');
    const sel = await page.locator(ed).evaluate((t: HTMLTextAreaElement) => [t.selectionStart, t.selectionEnd, t.value.length]);
    expect(sel).toEqual([sel[2], sel[2], sel[2]]); // カーソルは末尾
    await expect(page.locator('#edit-count')).toHaveText('18字');
  });

  test('本物の入力欄をそのまま見せる（透明にしない・上に何も重ねない・書体は Klee One）', async ({ page }) => {
    await openApp(page);
    await page.locator('#write-today').click();
    await typeText(page, '静かな道を歩いていると、\n考えごともゆっくりほどけていく。');
    const t = page.locator(ed);
    const style = await t.evaluate(el => {
      const s = getComputedStyle(el);
      return { color: s.color, fill: s.getPropertyValue('-webkit-text-fill-color'), opacity: s.opacity, font: s.fontFamily, weight: s.fontWeight, size: s.fontSize };
    });
    expect(style.color).not.toMatch(/rgba\(.*,\s*0\)|transparent/);
    expect(style.fill).not.toMatch(/rgba\(.*,\s*0\)|transparent/);
    expect(style.opacity).toBe('1');
    expect(style.font).toMatch(/^"?Klee One"?/);
    expect(style.weight).toBe('600');
    expect(parseFloat(style.size)).toBeGreaterThanOrEqual(16); // 16px 未満だと iPhone が勝手に拡大する
    // 入力欄の上に、ほかの部品が重なっていない
    const covered = await t.evaluate(el => {
      const r = el.getBoundingClientRect(), bad: string[] = [];
      for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.05, 0.3, 0.6, 0.95]) {
        const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
        if (hit !== el) bad.push(hit ? hit.outerHTML.slice(0, 60) : 'null');
      }
      return bad;
    });
    expect(covered).toEqual([]);
    // 書く画面には、写しや重ね書きの部品がない
    await expect(page.locator('#edit [aria-hidden="true"]:not(.chev)')).toHaveCount(0);
  });

  test('打っている間、アプリは入力欄の中身・カーソルに一切手を出さない', async ({ page }) => {
    await openApp(page);
    await page.locator('#write-today').click();
    // 開いた後に、アプリが value やカーソルを書き換えたら数える
    await page.locator(ed).evaluate((el: HTMLTextAreaElement) => {
      const w = window as unknown as { __writes: string[] };
      w.__writes = [];
      const proto = HTMLTextAreaElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value')!;
      Object.defineProperty(el, 'value', { get() { return desc.get!.call(this); }, set(v) { w.__writes.push('value'); desc.set!.call(this, v); } });
      for (const m of ['setSelectionRange', 'setRangeText', 'select'] as const) {
        const orig = proto[m] as (...a: unknown[]) => unknown;
        (el as unknown as Record<string, unknown>)[m] = function (this: HTMLTextAreaElement, ...a: unknown[]) { w.__writes.push(m); return orig.apply(this, a); };
      }
      for (const p of ['selectionStart', 'selectionEnd', 'scrollTop'] as const) {
        const d = Object.getOwnPropertyDescriptor(p === 'scrollTop' ? Element.prototype : proto, p)!;
        Object.defineProperty(el, p, { get() { return d.get!.call(this); }, set(v) { w.__writes.push(p); d.set!.call(this, v); } });
      }
    });
    const before = await page.locator('#edit').evaluate(s => s.innerHTML.replace(/<textarea[\s\S]*<\/textarea>/, ''));
    await typeText(page, '一行目\n二行目、「かぎ」と English 123。\n三行目');
    await page.keyboard.press('Backspace');
    await typeText(page, '目です');
    await waitAutosave(page);
    expect(await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)).toEqual([]);
    await expect(page.locator(ed)).toHaveValue('一行目\n二行目、「かぎ」と English 123。\n三行目です');
    // 書く画面の部品も、字数以外は変わっていない
    const after = await page.locator('#edit').evaluate(s => s.innerHTML.replace(/<textarea[\s\S]*<\/textarea>/, ''));
    expect(after.replace(/<span class="count" id="edit-count"[^>]*>[^<]*<\/span>/, ''))
      .toBe(before.replace(/<span class="count" id="edit-count"[^>]*>[^<]*<\/span>/, ''));
  });

  test('書く → 綴じる → 暦に朱印 → 日付で読む → なおす → 続きから → 綴じると読む画面', async ({ page }) => {
    await openApp(page);
    await page.locator('#write-today').click();
    await typeText(page, '朝の空気が冷たくて、\n息が白く見えた。');
    await page.locator('#done').click();
    // 初めて綴じた日：暦に戻って朱印が押される
    await expect(page.locator('#cal')).toBeVisible();
    await expect(day(page, TODAY_KEY).locator('.seal.stamp')).toHaveCount(1);
    expect(await readDB(page, 'hitohi-beta')).toEqual([
      expect.objectContaining({ date: TODAY_KEY, text: '朝の空気が冷たくて、\n息が白く見えた。' }),
    ]);
    // 日付を押すと、すぐ全文
    await day(page, TODAY_KEY).click();
    await expect(page.locator('#read')).toBeVisible();
    await expect(page.locator('#read-date')).toHaveText(/^十一月十九日（木）/);
    await expect(page.locator('#read-date .seal')).toHaveCount(1);
    await expect(page.locator('#read-hand')).toHaveText('朝の空気が冷たくて、息が白く見えた。');
    await expect(page.locator('#read-hand br')).toHaveCount(1);
    await expect(page.locator('#read-count')).toHaveText('18字');
    // なおす：続きから（末尾にカーソル）
    await page.locator('#fix').click();
    await expect(page.locator(ed)).toBeFocused();
    await expect(page.locator(ed)).toHaveValue('朝の空気が冷たくて、\n息が白く見えた。');
    await typeText(page, '\n今日は、そんな一日だった。');
    await page.locator('#done').click();
    // すでにあった日：読む画面へ
    await expect(page.locator('#read')).toBeVisible();
    await expect(page.locator('#read-hand')).toHaveText('朝の空気が冷たくて、息が白く見えた。今日は、そんな一日だった。');
    const [rec] = await readDB(page, 'hitohi-beta') as { created: number; updated: number }[];
    expect(Object.keys(rec).sort()).toEqual(['created', 'date', 'text', 'updated']); // v1 と同じ形
    // ‹ 暦 で暦へ
    await page.locator('#read-back').click();
    await expect(page.locator('#cal')).toBeVisible();
    await expect(day(page, TODAY_KEY).locator('.seal:not(.stamp)')).toHaveCount(1);
  });

  test('過去の日にも書ける。日記のない日を押すと「書く」、ある日は「読む」', async ({ page }) => {
    await openApp(page);
    await day(page, '2026-11-10').click();
    await expect(page.locator('#edit')).toBeVisible();
    await expect(page.locator('#edit-date')).toHaveText('十一月十日（火）');
    await expect(page.locator(ed)).toBeFocused();
    await typeText(page, '十日のこと');
    await page.locator('#edit-back').click(); // ‹ 暦 でも、初めての日なら朱印
    await expect(day(page, '2026-11-10').locator('.seal.stamp')).toHaveCount(1);
    await day(page, '2026-11-10').click();
    await expect(page.locator('#read')).toBeVisible();
    await expect(page.locator('#read-hand')).toHaveText('十日のこと');
  });

  test('何も書かずに戻っても、何も残らない', async ({ page }) => {
    await openApp(page);
    await page.locator('#write-today').click();
    await typeText(page, '  \n ');
    await page.locator('#done').click();
    await expect(page.locator('#cal')).toBeVisible();
    await expect(page.locator('#grid .seal')).toHaveCount(0);
    await expect(page.locator('#confirm')).toBeHidden();
    expect(await readDB(page, 'hitohi-beta')).toEqual([]);
  });

  test('自動保存：綴じなくても 0.5 秒ほどで端末に残り、開き直しても消えない', async ({ page }) => {
    await openApp(page);
    await page.locator('#write-today').click();
    await typeText(page, '途中まで書いた');
    await waitAutosave(page);
    expect(await readDB(page, 'hitohi-beta')).toEqual([expect.objectContaining({ date: TODAY_KEY, text: '途中まで書いた' })]);
    await page.reload(); // アプリを閉じて開き直す
    await expect(day(page, TODAY_KEY).locator('.seal')).toHaveCount(1);
    await page.locator('#write-today').click();
    await expect(page.locator(ed)).toHaveValue('途中まで書いた');
  });

  test('アプリを切り替えた時（画面が隠れた時）も、すぐ保存する', async ({ page }) => {
    await openApp(page);
    await page.locator('#write-today').click();
    await typeText(page, 'すぐ閉じた');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200); // 自動保存の 0.5 秒より前
    expect(await readDB(page, 'hitohi-beta')).toEqual([expect.objectContaining({ text: 'すぐ閉じた' })]);
  });
});

test.describe('上の帯（‹ 暦・日付・綴じる）', () => {
  test('キーボードで見える範囲が狭くなっても、長く書いても、スクロールせずに押せる', async ({ page }) => {
    await openApp(page);
    await page.locator('#write-today').click();
    await typeText(page, Array.from({ length: 40 }, (_, i) => `${i + 1}行目の日記を書いています。`).join('\n'));
    // キーボードが出た時くらいの高さに
    await page.setViewportSize({ width: 393, height: 380 });
    await page.waitForTimeout(100);
    for (const b of ['#edit-back', '#done']) {
      const box = (await page.locator(b).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(380);
    }
    // 入力欄は見える範囲の中に収まり、ページ全体はずれていない
    const tbox = (await page.locator(ed).boundingBox())!;
    expect(tbox.y + tbox.height).toBeLessThanOrEqual(381);
    expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
    // 長い文章は入力欄の中でスクロールする（入力欄自身に任せる）
    expect(await page.locator(ed).evaluate(t => t.scrollHeight > t.clientHeight)).toBe(true);
    await page.locator('#done').click();
    await expect(page.locator('#cal')).toBeVisible();
  });

  test('いちばん長い日付（十二月二十七日（日））でも、ボタンが画面からはみ出さない', async ({ page }) => {
    await openApp(page, BETA, new Date('2026-12-27T09:00:00+09:00'));
    await page.locator('#write-today').click();
    await expect(page.locator('#edit-date')).toHaveText('十二月二十七日（日）');
    await typeText(page, 'あ');
    const vw = page.viewportSize()!.width;
    for (const b of ['#edit-back', '#done']) {
      const box = (await page.locator(b).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vw);
    }
    await page.locator('#done').click();
    await day(page, '2026-12-27').click();
    for (const b of ['#read-back', '#fix', '#read-date .seal']) {
      const box = (await page.locator(b).boundingBox())!;
      expect(box.x + box.width, b).toBeLessThanOrEqual(vw);
    }
    expect(await page.locator('#read .bar').evaluate(b => b.scrollWidth <= b.clientWidth)).toBe(true);
  });
});

test.describe('全部消した時の確認', () => {
  test('全部消して綴じると「白紙に戻しますか」。「書き戻す」で元に戻る', async ({ page }) => {
    await openApp(page);
    await seedDB(page, 'hitohi-beta', [{ date: TODAY_KEY, text: '大切な日記' }]);
    await page.reload();
    await page.locator('#write-today').click();
    await page.locator(ed).fill('');
    await waitAutosave(page);
    // 自動保存では消さない
    expect(await readDB(page, 'hitohi-beta')).toEqual([expect.objectContaining({ text: '大切な日記' })]);
    await page.locator('#done').click();
    await expect(page.locator('#confirm')).toBeVisible();
    await expect(page.locator('#confirm-title')).toHaveText('白紙に戻しますか');
    await page.locator('#confirm-keep').click();
    await expect(page.locator('#confirm')).toBeHidden();
    await expect(page.locator('#edit')).toBeVisible();
    await expect(page.locator(ed)).toHaveValue('大切な日記');
    expect(await readDB(page, 'hitohi-beta')).toEqual([expect.objectContaining({ text: '大切な日記' })]);
  });

  test('「白紙にする」を選ぶと、その日の頁と朱印がなくなる', async ({ page }) => {
    await openApp(page);
    await seedDB(page, 'hitohi-beta', [{ date: TODAY_KEY, text: '消す日記' }, { date: '2026-11-18', text: '残す日記' }]);
    await page.reload();
    await page.locator('#write-today').click();
    await page.locator(ed).fill('');
    await page.locator('#edit-back').click();
    await expect(page.locator('#confirm')).toBeVisible();
    await page.locator('#confirm-clear').click();
    await expect(page.locator('#cal')).toBeVisible();
    await expect(day(page, TODAY_KEY).locator('.seal')).toHaveCount(0);
    await expect(day(page, '2026-11-18').locator('.seal')).toHaveCount(1);
    expect(await readDB(page, 'hitohi-beta')).toEqual([expect.objectContaining({ date: '2026-11-18', text: '残す日記' })]);
  });
});

test.describe('保存に失敗した時', () => {
  test('知らせを出して、その頁に留まる。直れば綴じられる', async ({ page }) => {
    await openApp(page);
    await page.locator('#write-today').click();
    await typeText(page, '失敗しても消えない');
    // 端末がいっぱいで保存できない状態にする
    await page.evaluate(() => {
      const w = window as unknown as { __put: typeof IDBObjectStore.prototype.put };
      w.__put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () { throw new DOMException('full', 'QuotaExceededError'); };
    });
    await page.locator('#done').click();
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('保存できませんでした');
    await expect(page.locator('#edit')).toBeVisible();
    await expect(page.locator(ed)).toHaveValue('失敗しても消えない');
    expect(await readDB(page, 'hitohi-beta')).toEqual([]);
    // 直った
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = (window as unknown as { __put: typeof IDBObjectStore.prototype.put }).__put;
    });
    await page.locator('#done').click();
    await expect(page.locator('#cal')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('保存できました');
    expect(await readDB(page, 'hitohi-beta')).toEqual([expect.objectContaining({ text: '失敗しても消えない' })]);
  });
});
