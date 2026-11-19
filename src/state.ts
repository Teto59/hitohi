/* アプリ全体で共有するもの：日記（端末の中）と設定 */

import { DB_NAME, SETTINGS_KEY } from './channel';
import { loadSettings, saveSettings, type Settings } from './settings';
import { openDiary, type Entry } from './store';

/** 日付 → その日の日記（起動時に端末から読み込み、書くたびに更新する） */
export const entries = new Map<string, Entry>();

export const diary = openDiary(DB_NAME);

export const settings: Settings = loadSettings(localStorage, SETTINGS_KEY);

export function storeSettings(): void {
  saveSettings(localStorage, SETTINGS_KEY, settings);
}
