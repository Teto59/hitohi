/* 暦（ホーム）：月ごとのマス目、和風月名、二十四節気、月の満ち欠け、朱印、今日の丸 */

import { dateLabel, fromKey, keyOf, monthLabel, monthShape, moonAge, sekkiOn, startOfToday, WAFU } from '../koyomi';
import { moonSVG, ringSVG, sealSVG } from '../marks';
import { entries } from '../state';
import { $ } from './dom';
import { openEditor } from './editor';
import { openReader } from './reader';
import { show } from './screens';

let y = 0, m = 0;
/** 次に描く時、朱印を押す動きを付ける日 */
let stampKey: string | null = null;

const grid = $('#grid');

export function setMonth(d: Date): void { y = d.getFullYear(); m = d.getMonth(); }

export function renderCalendar(dir = 0): void {
  const today = startOfToday(), tk = keyOf(today);
  $('#wafu').textContent = WAFU[m];
  $('#ym').textContent = monthLabel(y, m);
  const { lead, days } = monthShape(y, m), terms: string[] = [];
  let html = '<div class="day blank"></div>'.repeat(lead);
  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d), k = keyOf(date), has = entries.has(k), term = sekkiOn(y, m, d);
    if (term) terms.push(term);
    const future = date > today;
    const cls = ['day', has && 'has', future && 'future', date.getDay() === 0 && 'sun'].filter(Boolean).join(' ');
    const label = `${dateLabel(date)}${has ? '、日記あり' : ''}${term ? '、' + term : ''}`;
    html += `<button type="button" class="${cls}" data-k="${k}" aria-label="${label}"${future ? ' disabled' : ''}>`
      + (k === tk ? ringSVG(k) : '')
      + `<span class="num">${d}</span>${moonSVG(moonAge(y, m, d))}`
      + (term ? `<span class="term">${term}</span>` : '')
      + (has ? sealSVG(k, k === stampKey) : '')
      + '</button>';
  }
  grid.innerHTML = html;
  stampKey = null;
  $('#sekki').textContent = terms.join('　·　');
  const atNow = y === today.getFullYear() && m === today.getMonth();
  const atOrAfterNow = y > today.getFullYear() || (y === today.getFullYear() && m >= today.getMonth());
  $('#next').style.visibility = atOrAfterNow ? 'hidden' : 'visible';
  $('#go-today').style.visibility = atNow ? 'hidden' : 'visible'; // 今月を見ている時は出さない
  if (dir) {
    grid.classList.remove('turn-l', 'turn-r');
    void grid.offsetWidth;
    grid.classList.add(dir > 0 ? 'turn-l' : 'turn-r');
  }
}

function move(n: number): void {
  const nd = new Date(y, m + n, 1);
  if (nd > startOfToday()) return; // 未来の月へはめくらない
  setMonth(nd);
  renderCalendar(n);
}

/** 暦へ戻る。k の月を開く。stamp なら、その日に朱印を押す動きを付ける */
export function goCalendar(k?: string, opts: { stamp?: boolean } = {}): void {
  if (k) setMonth(fromKey(k));
  if (k && opts.stamp) stampKey = k;
  show('cal');
  renderCalendar();
}

/* 日付を押す：日記がある日は「読む」、ない日は「書く」。
 * 書く時は、この押した処理の中ですぐ入力欄に focus する（iPhone はそうしないとキーボードが出ない） */
grid.addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLButtonElement>('.day[data-k]');
  if (!b || b.disabled) return;
  const k = b.dataset.k!;
  if (entries.has(k)) openReader(k); else openEditor(k);
});

// 左右になでて月をめくる
let sx: number | null = null, sy = 0;
grid.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
grid.addEventListener('touchend', e => {
  if (sx === null) return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  sx = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
}, { passive: true });

$('#prev').addEventListener('click', () => move(-1));
$('#next').addEventListener('click', () => move(1));
$('#go-today').addEventListener('click', () => { setMonth(startOfToday()); renderCalendar(); });
// 「書く」はいつも今日の頁を、続きから書ける状態で開く
$('#write-today').addEventListener('click', () => openEditor(keyOf(startOfToday())));
