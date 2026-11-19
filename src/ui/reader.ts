/* 読む：開いたらすぐ全文を、手書きの揺らぎ付きで */

import { renderHand } from '../hand';
import { charLabel, countChars, dateLabelW, fromKey } from '../koyomi';
import { sealSVG } from '../marks';
import { entries } from '../state';
import { goCalendar } from './calendar';
import { $ } from './dom';
import { openEditor } from './editor';
import { show } from './screens';

let viewing = '';

export function openReader(k: string): void {
  const e = entries.get(k);
  if (!e) { goCalendar(k); return; }
  viewing = k;
  const date = $('#read-date');
  date.textContent = dateLabelW(fromKey(k));
  date.insertAdjacentHTML('beforeend', sealSVG(k));
  renderHand($('#read-hand'), e.text, k);
  $('#read-count').textContent = charLabel(countChars(e.text));
  show('read');
  $('#read .scroller').scrollTop = 0;
}

$('#fix').addEventListener('click', () => openEditor(viewing));
$('#read-back').addEventListener('click', () => goCalendar(viewing));
