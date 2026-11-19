/* 書く：本物の入力欄（textarea）をそのまま見せる
 *
 * 大原則：入力は iPhone に任せる。この画面は、入力欄の中身を「読む」だけで、書き換えたり飾ったりしない。
 *  ・カーソル・変換中の下線・選択・ペースト・音声入力・入力中のスクロールは、すべて iOS 標準のまま。
 *  ・入力欄の value を書き換えるのは、頁を開いた時と「書き戻す」を選んだ時だけ。
 *  ・入力のたびにするのは、字数の表示と、0.5 秒後の自動保存の予約だけ（どちらも入力欄の外の仕事）。 */

import { charLabel, countChars, dateLabelW, fromKey } from '../koyomi';
import { diary, entries } from '../state';
import type { Entry } from '../store';
import { goCalendar } from './calendar';
import { confirmClear, toast } from './dialogs';
import { $ } from './dom';
import { openReader } from './reader';
import { currentScreen, show } from './screens';

const ed = $<HTMLTextAreaElement>('#ed');
const count = $('#edit-count');

/** 開いている日（'YYYY-MM-DD'）。閉じている時は null */
let key: string | null = null;
/** 開いた時点で、その日の日記がすでにあったか（初めてなら、綴じた時に朱印を押す） */
let existedBefore = false;
let composing = false;
let saveTimer = 0;
let countFrame = 0;
let failed = false;
let leaving = false;

/** 保存する文字（末尾の空白・改行は落とす） */
const textToSave = () => ed.value.replace(/\s+$/u, '');

function updateCount(): void {
  countFrame = 0;
  count.textContent = charLabel(countChars(ed.value));
}

export function openEditor(k: string): void {
  key = k;
  existedBefore = entries.has(k);
  failed = false;
  ed.value = existedBefore ? entries.get(k)!.text : '';
  $('#edit-date').textContent = dateLabelW(fromKey(k));
  updateCount();
  show('edit');
  // 開いてすぐキーボードを出し、続きを書く位置（末尾）へ。
  // iPhone は「押した」処理の中で focus しないとキーボードが出ないので、ここでは何も待たない
  ed.focus({ preventScroll: true });
  const end = ed.value.length;
  ed.setSelectionRange(end, end);
  ed.scrollTop = ed.scrollHeight;
}

/** キーボードが出た直後に一度だけ：カーソルが末尾にあるなら、末尾が見えるように入力欄を送る
 *  （キーボードの分だけ入力欄が縮んで、末尾が隠れることがあるため。入力中は呼ばれない） */
export function revealEndOnKeyboard(): void {
  if (currentScreen() !== 'edit' || document.activeElement !== ed || composing) return;
  const end = ed.value.length;
  if (ed.selectionStart === end && ed.selectionEnd === end) ed.scrollTop = ed.scrollHeight;
}

ed.addEventListener('compositionstart', () => { composing = true; });
ed.addEventListener('compositionend', () => { composing = false; });
ed.addEventListener('input', () => {
  if (!countFrame) countFrame = requestAnimationFrame(updateCount);
  queueSave();
});

/* ── 保存 ──
 * 書いた内容を端末に。白紙（全部消した）の時は、ここでは消さない（閉じる時に確かめてから消す）。
 * 保存は一つずつ順番に（前の保存が終わってから次を）。 */
function queueSave(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void save(); }, 500);
}

let chain: Promise<boolean> = Promise.resolve(true);
function save(): Promise<boolean> {
  clearTimeout(saveTimer);
  chain = chain.then(saveNow, saveNow);
  return chain;
}

async function saveNow(): Promise<boolean> {
  const k = key;
  if (!k) return true;
  const text = textToSave();
  if (!text.trim()) return true;
  const old = entries.get(k);
  if (old && old.text === text && !failed) return true;
  const now = Date.now();
  const e: Entry = { date: k, text, created: old ? old.created : now, updated: now };
  try {
    await diary.put(e);
  } catch (err) {
    console.error(err);
    failed = true;
    toast('保存できませんでした。iPhoneの空き容量を確かめて、もう一度「綴じる」を押してください。', 8000);
    return false;
  }
  entries.set(k, e);
  if (failed) toast('保存できました。');
  failed = false;
  // 端末の空きが少なくなっても、日記を消されにくくする（iPhone が許せば）
  navigator.storage?.persist?.().catch(() => {});
  return true;
}

/** 頁を閉じてよければ true。白紙なら確かめる。保存に失敗したら false（この頁に留まる） */
async function leave(k: string): Promise<boolean> {
  if (!textToSave().trim()) {
    if (!entries.has(k)) return true; // もともと何もない日：何もせず閉じる
    const clear = await confirmClear(dateLabelW(fromKey(k)));
    if (!clear) { // 書き戻す
      ed.value = entries.get(k)!.text;
      updateCount();
      return false;
    }
    try {
      await diary.del(k);
    } catch (err) {
      console.error(err);
      toast('消せませんでした。もう一度お試しください。', 6000);
      return false;
    }
    entries.delete(k);
    return true;
  }
  return save();
}

async function finish(toCal: boolean): Promise<void> {
  if (leaving || !key) return;
  leaving = true;
  try {
    const k = key;
    // キーボードを閉じる。変換の途中だった字は、ここで確定する（確定を待ってから中身を読む）
    ed.blur();
    await new Promise(r => setTimeout(r, 0));
    if (!(await leave(k))) return; // 書き戻した・保存に失敗した → この頁に留まる
    key = null;
    const has = entries.has(k);
    if (has && !existedBefore) goCalendar(k, { stamp: true }); // 初めて綴じた日は、暦に朱印を押す
    else if (has && !toCal) openReader(k);
    else goCalendar(k);
  } finally {
    leaving = false;
  }
}

$('#done').addEventListener('click', () => { void finish(false); });
$('#edit-back').addEventListener('click', () => { void finish(true); });

// アプリを閉じる・切り替える時も保存
document.addEventListener('visibilitychange', () => { if (document.hidden && key) void save(); });
window.addEventListener('pagehide', () => { if (key) void save(); });
