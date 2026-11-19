import { describe, expect, it } from 'vitest';
import { loadSettings, needsBackupNudge, saveSettings } from '../../src/settings';

function memory(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m };
}

describe('設定', () => {
  it('v1 の設定から、最後に控えを書き出した日を引き継ぐ', () => {
    const s = memory({ 'hitohi-settings': JSON.stringify({ soundLevel: 'mid', lead: '4B', lastExport: 1763500000000 }) });
    expect(loadSettings(s, 'hitohi-settings')).toEqual({ lastExport: 1763500000000 });
  });
  it('書き込む時、v1 の設定（音など）は消さずに残す', () => {
    const s = memory({ 'hitohi-settings': JSON.stringify({ soundLevel: 'off', lead: 'HB', lastExport: 1 }) });
    saveSettings(s, 'hitohi-settings', { lastExport: 1763600000000 });
    expect(JSON.parse(s.m.get('hitohi-settings')!)).toEqual({ soundLevel: 'off', lead: 'HB', lastExport: 1763600000000 });
  });
  it('まだ何もない・壊れている時は、ふつうの値で始める', () => {
    expect(loadSettings(memory(), 'hitohi-settings')).toEqual({ lastExport: 0 });
    for (const bad of ['{', '[]', 'null', '"x"', '{"lastExport":"abc"}', '{"lastExport":-5}']) {
      expect(loadSettings(memory({ k: bad }), 'k'), bad).toEqual({ lastExport: 0 });
    }
  });
  it('試作版の設定は別のキー（本番の設定には触れない）', () => {
    const s = memory({ 'hitohi-settings': JSON.stringify({ lastExport: 5 }) });
    saveSettings(s, 'hitohi-beta-settings', { lastExport: 9 });
    expect(JSON.parse(s.m.get('hitohi-settings')!)).toEqual({ lastExport: 5 });
    expect(loadSettings(s, 'hitohi-beta-settings')).toEqual({ lastExport: 9 });
  });
  it('保存できない端末でも止まらない', () => {
    const s = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(() => saveSettings(s, 'k', { lastExport: 1 })).not.toThrow();
  });
});

describe('控えの催促（栞の朱の点）', () => {
  const day = 86400000, now = 100 * day;
  it('5 日以上書いていて、30 日以上書き出していない時だけ', () => {
    expect(needsBackupNudge(4, 0, now)).toBe(false);
    expect(needsBackupNudge(5, 0, now)).toBe(true);
    expect(needsBackupNudge(5, now - 30 * day, now)).toBe(false);
    expect(needsBackupNudge(5, now - 31 * day, now)).toBe(true);
    expect(needsBackupNudge(50, now - 2 * day, now)).toBe(false);
  });
});
