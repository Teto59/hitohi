/* 画面の切り替え（暦・読む・書く）。位置は動かさず、静かに現れるだけ */

import { $ } from './dom';

export type ScreenName = 'cal' | 'read' | 'edit';
let current: ScreenName = 'cal';

export const currentScreen = (): ScreenName => current;

export function show(name: ScreenName): void {
  for (const n of ['cal', 'read', 'edit'] as const) $(`#${n}`).hidden = n !== name;
  const el = $(`#${name}`);
  el.classList.remove('enter');
  void el.offsetWidth; // 動きを最初からやり直すため
  el.classList.add('enter');
  current = name;
}
