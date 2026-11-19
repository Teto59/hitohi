/* 試作版への入口の手当て（試作版の beta/app.js としてだけ置く。v2 の画面はこのファイルを使わない）
 *
 * なぜ要るか：本番 v1 の仕組み（Service Worker）は /hitohi/ の下の画面を「すべて」引き受け、
 * 自分の控えた v1 の画面を出してしまう。だから、まだ試作版の仕組みが入っていない Safari で /hitohi/beta/ を開くと、
 * v1 の画面（の骨組み）が出て、その v1 の画面が同じ場所の app.js ＝このファイルを読みに来る。
 * そこで、ここで試作版の仕組みを入れてから開き直す。一度入れば、/hitohi/beta/ は試作版の仕組みが引き受ける
 * （より細かい場所を受け持つ仕組みが優先されるため）。本番の中身にも、本番の日記にも触れない。 */
(function () {
  var me = document.currentScript && /** @type {HTMLScriptElement} */ (document.currentScript).src;
  if (!me) return;
  var base = new URL('./', me).href;
  var KEY = 'hitohi-beta-shim';
  function say(text) {
    document.body.replaceChildren();
    var p = document.createElement('p');
    p.style.cssText = 'margin:40vh 24px 0;text-align:center;font:15px/1.8 serif;color:#77705f';
    p.textContent = text;
    document.body.appendChild(p);
  }
  if (!('serviceWorker' in navigator)) { say('このブラウザでは試作版を開けません。'); return; }
  var tries = 0;
  try { tries = Number(sessionStorage.getItem(KEY) || 0); sessionStorage.setItem(KEY, String(tries + 1)); } catch (e) { /* 数えられなくても進める */ }
  if (tries >= 2) { say('試作版を開けませんでした。Safari を一度閉じて、もう一度開いてください。'); return; }
  say('試作版を準備しています…');
  navigator.serviceWorker.register(base + 'sw.js', { scope: base }).then(function (reg) {
    var w = reg.installing || reg.waiting || reg.active;
    function go() { location.replace(base); }
    if (!w || w.state === 'activated') { go(); return; }
    w.addEventListener('statechange', function () { if (w && w.state === 'activated') go(); });
  }).catch(function () { say('試作版を準備できませんでした。通信のよい所で、もう一度開いてください。'); });
})();
