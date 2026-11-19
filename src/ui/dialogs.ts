/* 小さな知らせ（トースト）と、白紙に戻す時の確認 */

import { $ } from './dom';

let toastTimer = 0;

export function toast(msg: string, ms = 3000): void {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { t.hidden = true; }, ms);
}

/** 全部消した頁を閉じる時の確認。白紙にするなら true、書き戻すなら false */
export function confirmClear(label: string): Promise<boolean> {
  const wrap = $('#confirm'), keep = $<HTMLButtonElement>('#confirm-keep'), clear = $<HTMLButtonElement>('#confirm-clear');
  $('#confirm-text').textContent = `${label}の文字をすべて消しました。このまま閉じると、この日の頁と朱印がなくなり、元には戻せません。`;
  wrap.hidden = false;
  return new Promise(ok => {
    const done = (v: boolean) => { wrap.hidden = true; keep.onclick = clear.onclick = null; ok(v); };
    keep.onclick = () => done(false);
    clear.onclick = () => done(true);
  });
}

/** 確認や栞が開いているか */
export const dialogOpen = (): boolean => !$('#confirm').hidden || !$('#menu').hidden;
