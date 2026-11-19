/* 枠をキーボードの上に収める（この処理は、ここ一つだけ）
 *
 * iPhone はキーボードを出しても画面の大きさ（レイアウト）を変えず、「見えている範囲」だけを狭くする。
 * そのままだと、書く画面の上の帯（‹ 暦・綴じる）がキーボードの出入りで画面の外へ押し出されることがある。
 * そこで、キーボードが出入りして見えている範囲の「大きさ」が変わった時だけ、アプリの枠の高さをそれに合わせる。
 *
 * やらないこと（v1 の教訓）：
 *  ・スクロールやフリックのたびに何かを動かす（visualViewport の scroll には反応しない）
 *  ・カーソルの位置を追いかける（入力中のスクロールは iPhone と入力欄自身に任せる） */

export interface ViewportHooks {
  /** キーボードが出た直後に一度だけ呼ばれる */
  onKeyboardShown?: () => void;
}

/** 見えている高さがこれだけ縮んでいたら、キーボードが出ているとみなす */
const KEYBOARD_MIN = 120;

export function installViewportFit(hooks: ViewportHooks = {}): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let keyboard = false;
  const fit = () => {
    if (vv.scale > 1.01) return; // ピンチで拡大している時は触らない
    root.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
    // キーボードに押されてページ全体がずれていたら、元の位置に戻す（枠がもう収まっているので、ずらす必要はない）
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    const now = window.innerHeight - vv.height > KEYBOARD_MIN;
    if (now && !keyboard) hooks.onKeyboardShown?.();
    keyboard = now;
  };
  vv.addEventListener('resize', fit);
  fit();
}
