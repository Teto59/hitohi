/* ひとひ v2 ─ 鉛筆で綴る、一日一頁の日記
 * 日記はこの端末の IndexedDB にだけ保存する。通信は初回の読み込みと書体だけ。 */

import './style.css';
import { IS_BETA } from './channel';
import { startOfToday } from './koyomi';
import { diary, entries } from './state';
import { renderCalendar, setMonth } from './ui/calendar';
import { dialogOpen, toast } from './ui/dialogs';
import { $ } from './ui/dom';
import { revealEndOnKeyboard } from './ui/editor';
import { nudge } from './ui/menu';
import { currentScreen, show } from './ui/screens';
import { installViewportFit } from './viewport';

declare const __BUILD__: string;

async function boot(): Promise<void> {
  installViewportFit({ onKeyboardShown: revealEndOnKeyboard });
  $('#version').textContent = __BUILD__;
  if (IS_BETA) document.documentElement.classList.add('beta');
  try {
    for (const e of await diary.all()) entries.set(e.date, e);
  } catch (err) {
    console.error(err);
    toast('日記を読み込めませんでした。アプリを一度閉じて、開き直してください。', 8000);
  }
  setMonth(startOfToday());
  show('cal');
  renderCalendar();
  nudge();
  // 開きっぱなしで日付が変わっても、戻ってきた時に暦の「今日」を正しくする
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (pendingReload && currentScreen() !== 'edit' && !dialogOpen()) { location.reload(); return; }
    if (currentScreen() === 'cal') { renderCalendar(); nudge(); }
  });
  try { sessionStorage.removeItem('hitohi-beta-shim'); } catch { /* 試作版の入口の手当ての後始末 */ }
  registerServiceWorker();
}

/* ── オフライン対応（Service Worker） ──
 * 新しい版が届いたら、書いている途中でなければその場で切り替える（書いている時は、次に戻ってきた時）。 */
let pendingReload = false;
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; warmFontCache(); return; } // 初めて入った時：書体も端末に控える
    if (currentScreen() !== 'edit' && !dialogOpen()) location.reload();
    else pendingReload = true;
  });
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(err => console.error(err));
}

/** 初めて開いた時に読み込んだ書体を、オフライン用の控えにも入れる（次からは圏外でも手書きの字で） */
function warmFontCache(): void {
  const urls = new Set<string>();
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]').forEach(l => urls.add(l.href));
  for (const r of performance.getEntriesByType('resource')) {
    if (r.name.startsWith('https://fonts.gstatic.com/')) urls.add(r.name);
  }
  urls.forEach(u => { fetch(u, { mode: 'cors', credentials: 'omit' }).catch(() => {}); });
}

void boot();
