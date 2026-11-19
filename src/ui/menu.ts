/* 栞（設定）：綴った日数、控え（書き出し・戻す）、最後に書き出した日、書体のクレジット */

import { backupFileName, BackupFormatError, makeBackup, parseBackup, pickNewer } from '../backup';
import { IS_BETA } from '../channel';
import { dateLabelW, startOfToday } from '../koyomi';
import { needsBackupNudge } from '../settings';
import { diary, entries, settings, storeSettings } from '../state';
import { renderCalendar } from './calendar';
import { $ } from './dom';

const wrap = $('#menu'), msg = $('#io-msg');

function sync(): void {
  $('#days').textContent = `これまでに綴った日　${entries.size}日`;
  $('#last-export').textContent = settings.lastExport
    ? `最後に控えを書き出した日　${dateLabelW(new Date(settings.lastExport))}`
    : 'まだ控えを書き出していません。';
  nudge();
}

/** しばらく控えを書き出していない時は、栞に小さな朱の点を付けて知らせる */
export function nudge(): void {
  $('#menu-open').classList.toggle('nudge', needsBackupNudge(entries.size, settings.lastExport, Date.now()));
}

function exported(n: number): void {
  settings.lastExport = Date.now();
  storeSettings();
  sync();
  msg.textContent = `${n}日分の控えを書き出しました。`;
}

$('#menu-open').addEventListener('click', () => { msg.textContent = ''; sync(); wrap.hidden = false; });
$('#menu-close').addEventListener('click', () => { wrap.hidden = true; });
$('#menu-scrim').addEventListener('click', () => { wrap.hidden = true; });

// 控えを書き出す：共有シート（「ファイル」に保存）が使えればそれで、使えなければダウンロードで
$('#export').addEventListener('click', async () => {
  const n = entries.size;
  const name = backupFileName(startOfToday(), IS_BETA);
  const file = new File([makeBackup(entries.values())], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      exported(n);
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return; // 共有シートを閉じた
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  exported(n);
});

// 控えから戻す：同じ日がすでにあれば、新しく書いた方を残す
$<HTMLInputElement>('#import').addEventListener('change', async e => {
  const input = e.target as HTMLInputElement, f = input.files?.[0];
  input.value = '';
  if (!f) return;
  try {
    const picked = pickNewer(entries, parseBackup(await f.text()));
    for (const x of picked) { await diary.put(x); entries.set(x.date, x); }
    msg.textContent = picked.length ? `${picked.length}日分を戻しました。` : '新しく戻す日はありませんでした。';
    sync();
    renderCalendar();
  } catch (err) {
    msg.textContent = err instanceof BackupFormatError
      ? 'このファイルは「ひとひ」の控えではないようです。書き出した .json ファイルを選んでください。'
      : '戻せませんでした。iPhoneの空き容量を確かめて、もう一度お試しください。';
  }
});
