import { describe, expect, it } from 'vitest';
import {
  charLabel, countChars, dateLabel, dateLabelW, fromKey, isDateKey, kanjiNum, kanjiYear, keyOf,
  monthLabel, monthShape, moonAge, sekkiOn, SEKKI, startOfToday, SYN, WAFU,
} from '../../src/koyomi';

describe('日付', () => {
  it('日付と文字列を行き来できる', () => {
    expect(keyOf(new Date(2026, 10, 9))).toBe('2026-11-09');
    expect(fromKey('2026-11-09')).toEqual(new Date(2026, 10, 9));
    expect(keyOf(fromKey('2028-02-29'))).toBe('2028-02-29');
  });
  it('今日の 0 時', () => {
    expect(startOfToday(new Date(2026, 10, 19, 23, 59, 59))).toEqual(new Date(2026, 10, 19));
  });
  it('日付の形を確かめる', () => {
    expect(isDateKey('2026-11-19')).toBe(true);
    for (const bad of ['2026-1-19', '20261119', '', null, 20261119, '2026-11-19x']) expect(isDateKey(bad)).toBe(false);
  });
});

describe('漢数字・和風月名', () => {
  it('漢数字', () => {
    expect([0, 1, 9, 10, 11, 19, 20, 21, 30, 31].map(kanjiNum))
      .toEqual(['〇', '一', '九', '十', '十一', '十九', '二十', '二十一', '三十', '三十一']);
    expect(kanjiYear(2026)).toBe('二〇二六');
  });
  it('和風月名は 12 か月', () => {
    expect(WAFU).toHaveLength(12);
    expect(WAFU[0]).toBe('睦月');
    expect(WAFU[10]).toBe('霜月');
    expect(WAFU[11]).toBe('師走');
  });
  it('日付の見出し', () => {
    expect(dateLabel(new Date(2026, 10, 19))).toBe('十一月十九日');
    expect(dateLabelW(new Date(2026, 10, 19))).toBe('十一月十九日（木）');
    expect(dateLabelW(new Date(2026, 10, 1))).toBe('十一月一日（日）');
    expect(monthLabel(2026, 10)).toBe('十一月　二〇二六');
  });
  it('月のマス目', () => {
    expect(monthShape(2026, 10)).toEqual({ lead: 0, days: 30 }); // 2026 年 11 月は日曜はじまり
    expect(monthShape(2026, 1)).toEqual({ lead: 0, days: 28 });
    expect(monthShape(2028, 1).days).toBe(29); // うるう年
  });
});

describe('字数', () => {
  it('改行や空白は数えない', () => {
    expect(countChars('')).toBe(0);
    expect(countChars('朝の空気が\n冷たくて、 息が白い。')).toBe(15);
    expect(countChars('𠮷野家')).toBe(3); // サロゲートペアも一字
    expect(charLabel(0)).toBe('');
    expect(charLabel(12)).toBe('12字');
  });
});

describe('二十四節気（日本時間）', () => {
  /** その年の節気を { 名前: 'MM-DD' } で */
  function termsOf(year: number) {
    const out: Record<string, string> = {};
    for (let m = 0; m < 12; m++) {
      const days = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const t = sekkiOn(year, m, d);
        if (t) { expect(out[t]).toBeUndefined(); out[t] = `${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
      }
    }
    return out;
  }
  it('計画書に挙げた日：2026 年の立冬は 11/7、小雪は 11/22', () => {
    expect(sekkiOn(2026, 10, 7)).toBe('立冬');
    expect(sekkiOn(2026, 10, 22)).toBe('小雪');
    expect(sekkiOn(2026, 10, 6)).toBeNull();
    expect(sekkiOn(2026, 10, 8)).toBeNull();
  });
  it('2026 年の二十四節気が国立天文台の暦要項と一致する', () => {
    expect(termsOf(2026)).toEqual({
      小寒: '01-05', 大寒: '01-20', 立春: '02-04', 雨水: '02-19', 啓蟄: '03-05', 春分: '03-20',
      清明: '04-05', 穀雨: '04-20', 立夏: '05-05', 小満: '05-21', 芒種: '06-06', 夏至: '06-21',
      小暑: '07-07', 大暑: '07-23', 立秋: '08-07', 処暑: '08-23', 白露: '09-07', 秋分: '09-23',
      寒露: '10-08', 霜降: '10-23', 立冬: '11-07', 小雪: '11-22', 大雪: '12-07', 冬至: '12-22',
    });
  });
  it('どの年も、24 の節気が一度ずつ', () => {
    for (const y of [2025, 2027, 2030]) expect(Object.keys(termsOf(y)).sort()).toEqual([...SEKKI].sort());
  });
});

describe('月齢', () => {
  /** 新月（0）からの近さ（日） */
  const fromNew = (a: number) => Math.min(a, SYN - a);
  it('計画書に挙げた日：2026 年 11 月 9 日ごろが新月、24 日ごろが満月', () => {
    expect(fromNew(moonAge(2026, 10, 9))).toBeLessThan(1);
    expect(Math.abs(moonAge(2026, 10, 24) - SYN / 2)).toBeLessThan(1);
  });
  it('その前後は、新月・満月から離れていく', () => {
    expect(fromNew(moonAge(2026, 10, 6))).toBeGreaterThan(2);
    expect(fromNew(moonAge(2026, 10, 12))).toBeGreaterThan(2);
    expect(Math.abs(moonAge(2026, 10, 21) - SYN / 2)).toBeGreaterThan(2);
  });
  it('2026 年の新月の日（暦要項）はどれも月齢 1 日以内', () => {
    const newMoons = ['01-19', '02-17', '03-19', '04-17', '05-17', '06-15', '07-14', '08-13', '09-11', '10-11', '11-09', '12-09'];
    for (const md of newMoons) {
      const [mm, dd] = md.split('-').map(Number);
      expect(fromNew(moonAge(2026, mm - 1, dd)), md).toBeLessThan(1.1);
    }
  });
  it('月齢はいつも 0 以上、朔望月未満', () => {
    for (let d = 1; d <= 400; d++) {
      const a = moonAge(2026, 0, d);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(SYN);
    }
  });
});
