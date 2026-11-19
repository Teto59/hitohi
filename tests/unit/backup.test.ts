import { describe, expect, it } from 'vitest';
import { backupFileName, BackupFormatError, makeBackup, parseBackup, pickNewer } from '../../src/backup';
import type { Entry } from '../../src/store';

const e = (date: string, text: string, updated = 1000, created = 500): Entry => ({ date, text, created, updated });

describe('控えの書き出し', () => {
  it('v1 と同じ形で、日付順に', () => {
    const json = makeBackup([e('2026-11-19', '二'), e('2026-11-17', '一')], new Date('2026-11-19T12:00:00Z'));
    const data = JSON.parse(json);
    expect(data).toEqual({
      app: 'hitohi', version: 1, exportedAt: '2026-11-19T12:00:00.000Z',
      entries: [e('2026-11-17', '一'), e('2026-11-19', '二')],
    });
  });
  it('ファイル名（試作版は分かるように）', () => {
    expect(backupFileName(new Date(2026, 10, 19), false)).toBe('ひとひ控え-2026-11-19.json');
    expect(backupFileName(new Date(2026, 10, 19), true)).toBe('ひとひ控え-試作-2026-11-19.json');
  });
});

describe('控えから戻す', () => {
  it('書き出した控えを読むと、元の日記がそのまま戻る（往復）', () => {
    const list = [e('2026-11-17', '朝の空気が冷たくて、\n息が白く見えた。'), e('2026-11-18', '「雨」 & <b>1,280円</b> 𠮷')];
    expect(parseBackup(makeBackup(list))).toEqual(list);
  });
  it('v1 で書き出した控えも読める', () => {
    const v1File = '{\n "app": "hitohi",\n "version": 1,\n "exportedAt": "2026-11-18T09:00:00.000Z",\n "entries": [\n  {\n   "date": "2026-11-17",\n   "text": "v1 の日記",\n   "created": 1763340000000,\n   "updated": 1763350000000\n  }\n ]\n}';
    expect(parseBackup(v1File)).toEqual([{ date: '2026-11-17', text: 'v1 の日記', created: 1763340000000, updated: 1763350000000 }]);
  });
  it('「ひとひ」の控えでないファイルは断る', () => {
    for (const bad of ['', 'not json', '[]', 'null', '{"app":"other","entries":[]}', '{"app":"hitohi"}', '{"app":"hitohi","entries":{}}']) {
      expect(() => parseBackup(bad), bad).toThrow(BackupFormatError);
    }
  });
  it('おかしな記録は飛ばし、時刻がなければ今の時刻を入れる', () => {
    const file = JSON.stringify({
      app: 'hitohi', entries: [
        null, { date: '2026/11/19', text: 'x' }, { date: '2026-11-19', text: 3 }, { date: '2026-11-19', text: '  \n' },
        { date: '2026-11-20', text: 'よい記録' },
      ],
    });
    expect(parseBackup(file, 777)).toEqual([{ date: '2026-11-20', text: 'よい記録', created: 777, updated: 777 }]);
  });
  it('同じ日がすでにあれば、新しく書いた方を残す', () => {
    const now = new Map([
      ['2026-11-17', e('2026-11-17', '端末の方が新しい', 2000)],
      ['2026-11-18', e('2026-11-18', '端末の方が古い', 1000)],
      ['2026-11-19', e('2026-11-19', '同じ時刻', 1500)],
    ]);
    const picked = pickNewer(now, [
      e('2026-11-17', '控えの方が古い', 1000),
      e('2026-11-18', '控えの方が新しい', 3000),
      e('2026-11-19', '同じ時刻（控え）', 1500),
      e('2026-11-20', '端末にない日', 10),
    ]);
    expect(picked.map(x => x.text).sort()).toEqual(['控えの方が新しい', '端末にない日'].sort());
  });
  it('控えの中に同じ日が二つあれば、新しい方', () => {
    const picked = pickNewer(new Map(), [e('2026-11-20', '古い', 1), e('2026-11-20', '新しい', 2)]);
    expect(picked).toEqual([e('2026-11-20', '新しい', 2)]);
  });
});
