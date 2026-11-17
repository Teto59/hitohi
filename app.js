'use strict';
/* ひとひ ─ 鉛筆で綴る、一日一頁の日記
 * データはこの端末の IndexedDB にだけ保存する。通信は初回の読み込み（と書体）だけ。 */

const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement;

/* ───────────── 日付・暦の計算 ───────────── */
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const KN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function kanjiNum(n) {
  if (n < 10) return KN[n];
  const t = Math.floor(n / 10), o = n % 10;
  return (t === 1 ? '' : KN[t]) + '十' + (o ? KN[o] : '');
}
const kanjiYear = y => String(y).split('').map(c => KN[+c]).join('');
const WAFU = ['睦月', '如月', '弥生', '卯月', '皐月', '水無月', '文月', '葉月', '長月', '神無月', '霜月', '師走'];
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const dateLabel = d => `${kanjiNum(d.getMonth() + 1)}月${kanjiNum(d.getDate())}日`;
const dateLabelW = d => `${dateLabel(d)}（${WEEK[d.getDay()]}）`;
// 字数（改行や空白は数えない）
const countChars = arr => { let n = 0; for (const c of arr) if (!/\s/.test(c)) n++; return n ? `${n}字` : ''; };

// 太陽黄経（簡易式）から二十四節気を求める
const jdOf = ms => ms / 86400000 + 2440587.5;
function sunLon(jd) {
  const T = (jd - 2451545) / 36525, r = Math.PI / 180;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * r)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M * r) + 0.000289 * Math.sin(3 * M * r);
  const l = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * r);
  return ((l % 360) + 360) % 360;
}
const SEKKI = ['春分', '清明', '穀雨', '立夏', '小満', '芒種', '夏至', '小暑', '大暑', '立秋', '処暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '啓蟄'];
function sekkiOn(y, m, d) { // 日本時間のその日のうちに節気の境を越えるか
  const s = Date.UTC(y, m, d) - 9 * 3600000;
  const a = Math.floor(sunLon(jdOf(s)) / 15), b = Math.floor(sunLon(jdOf(s + 86400000)) / 15);
  return a !== b ? SEKKI[b % 24] : null;
}
// 月齢（正午の値）
const SYN = 29.530588853;
function moonAge(y, m, d) {
  const a = (jdOf(Date.UTC(y, m, d, 12) - 9 * 3600000) - 2451550.1) % SYN;
  return a < 0 ? a + SYN : a;
}
function moonSVG(age) {
  const r = 7, p = age / SYN, k = Math.cos(2 * Math.PI * p), wax = p < 0.5, N = 14, pts = [];
  for (let i = 0; i <= N; i++) { const y = -r + 2 * r * i / N, w = Math.sqrt(Math.max(0, r * r - y * y)); pts.push([wax ? w : -w, y]); }
  for (let i = N; i >= 0; i--) { const y = -r + 2 * r * i / N, w = Math.sqrt(Math.max(0, r * r - y * y)); pts.push([wax ? k * w : -k * w, y]); }
  const d = 'M' + pts.map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L') + 'Z';
  return `<svg class="moon" viewBox="-9 -9 18 18" aria-hidden="true"><circle r="${r}" class="moon-rim"/><path d="${d}" class="moon-lit"/></svg>`;
}

/* ───────────── 乱数（毎回同じ揺らぎにするため、日付から決める） ───────────── */
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) { let s = (seed % 2147483646) + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }

function sealSVG(key, stamp) {
  const r = seeded(hashStr('seal' + key));
  const rot = ((r() - .5) * 16).toFixed(1);
  return `<svg class="seal${stamp ? ' stamp' : ''}" viewBox="0 0 20 20" style="--r:${rot}deg;transform:rotate(${rot}deg)" aria-hidden="true">`
    + `<g filter="url(#stamp)"><rect x="1.5" y="1.5" width="17" height="17" rx="2.4" class="seal-bg"/><text x="10" y="14.6" class="seal-tx">記</text></g></svg>`;
}
function ringSVG(key) {
  const r = seeded(hashStr('ring' + key)), j = () => ((r() - .5) * 2.4).toFixed(1);
  return `<svg class="today-ring" viewBox="0 0 34 26" aria-hidden="true"><path d="M27 4c-6-3-17-2-22 4s-2 14 7 15 18-2 19-9-4-10-10-11"`
    + ` transform="translate(${j()} ${j()})"/></svg>`;
}

/* ───────────── 保存（IndexedDB） ───────────── */
const DB = (() => {
  let p;
  const open = () => p || (p = new Promise((ok, ng) => {
    const rq = indexedDB.open('hitohi', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('entries', { keyPath: 'date' });
    rq.onsuccess = () => ok(rq.result);
    rq.onerror = () => ng(rq.error);
  }));
  async function run(mode, fn) {
    const db = await open();
    return new Promise((ok, ng) => {
      const t = db.transaction('entries', mode), rq = fn(t.objectStore('entries'));
      t.oncomplete = () => ok(rq ? rq.result : undefined);
      t.onerror = () => ng(t.error);
    });
  }
  return {
    all: () => run('readonly', s => s.getAll()),
    put: e => run('readwrite', s => s.put(e)),
    del: k => run('readwrite', s => s.delete(k)),
  };
})();
const entries = new Map(); // date -> {date, text, created, updated}

/* ───────────── 設定 ───────────── */
const settings = { sound: true, lastExport: 0 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('hitohi-settings') || '{}')); } catch (e) {}
const saveSettings = () => { try { localStorage.setItem('hitohi-settings', JSON.stringify(settings)); } catch (e) {} };

/* ───────────── 鉛筆の音 ─────────────
 * 「指が動いている間、鉛筆が紙の上を走り続ける」。
 * 録音（サッ・サーッ・サッ の一続き、0.29秒）を切らずに丸ごと鳴らし、打ち続けている間は途切れなくつなぐ。
 * 指が止まったら、今書いている一画を最後まで書き終えて静かにやむ（途中で切らない）。
 * 高さと強さを一回ごとに少し変えて、同じ音の繰り返しに聞こえないようにする。 */
const Sound = (() => {
  const BEGIN = [0.022, 0.022, 0.118]; // 書き出し位置（多くは頭から、時々二画目から）
  const END = 0.285;
  let ctx = null, master = null, buf = null, loading = null;
  let until = 0, nextAt = 0, timer = null;

  function init() {
    if (!ctx) {
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {} // マナーモードに従い、音楽も止めない
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 2.0; master.connect(ctx.destination);
      loading = fetch('sound/scribble.mp3').then(r => r.arrayBuffer())
        .then(b => new Promise((ok, ng) => ctx.decodeAudioData(b, ok, ng)))
        .then(b => (buf = b)).catch(() => null);
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return loading;
  }
  function ready() {
    if (!settings.sound || !ctx || !buf) return false;
    if (ctx.state !== 'running') ctx.resume().catch(() => {}); // 音声入力の後などに止められていたら起こす
    return true;
  }
  function stroke(t) {
    const a = BEGIN[Math.floor(Math.random() * BEGIN.length)];
    const rate = 0.93 + Math.random() * 0.14, len = (END - a) / rate;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(), peak = 0.8 + Math.random() * 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.setValueAtTime(peak, t + len - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(g); g.connect(master);
    src.start(t, a, END - a);
    return len;
  }
  function tick() {
    const now = ctx.currentTime;
    while (nextAt < until && nextAt < now + 0.15) {
      const t = Math.max(nextAt, now + 0.005);
      nextAt = t + stroke(t) * (0.9 + Math.random() * 0.14); // 少し重ねて、つなぎ目を感じさせない
    }
    if (now > until && nextAt >= until) { clearInterval(timer); timer = null; }
  }
  // ms ミリ秒先まで「書いている」状態にする
  function write(ms) {
    if (!ready()) return;
    const now = ctx.currentTime;
    until = Math.max(until, now + ms / 1000);
    if (nextAt < now) nextAt = now; // 止まっていたら、すぐ書き始める
    if (!timer) { tick(); timer = setInterval(tick, 40); }
  }
  function lift() { until = 0; } // 鉛筆を上げる（今の一画は最後まで）
  return { init, write, lift };
})();
// iOSは最初のタッチまで音を鳴らせないので、最初の操作で準備する
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => Sound.init(), { capture: true, passive: true }));

/* ───────────── 字が現れる速さ（音声入力でまとめて入った時） ───────────── */
function schedule(n) {
  const first = 90, fastest = 22, cap = 4500, ramp = 6, ds = [];
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, i / ramp);
    ds.push((first + (fastest - first) * (1 - Math.pow(1 - t, 2))) * (0.8 + Math.random() * 0.4));
  }
  const sum = ds.reduce((a, b) => a + b, 0), k = sum > cap ? cap / sum : 1;
  return ds.map(d => d * k);
}

/* ───────────── 手書きの描画（読む画面） ───────────── */
const NO_START = '、。，．・：；？！ー）」』】〉》〕ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ…‥!?),.:;'; // 行頭に来ない字
const NO_END = '「『（【〈《〔(“‘';                                                              // 行末に来ない字
const isWordCh = c => /[A-Za-z0-9@#%&_'’\-.]/.test(c);                                           // 英単語・数字は途中で切らない
function jitter(r) {
  return { rot: ((r() - .5) * 4).toFixed(2), ty: ((r() - .5) * 2.4).toFixed(2), sc: (1 + (r() - .5) * .07).toFixed(3), a: (0.82 + r() * 0.18).toFixed(2) };
}
function renderHand(el, text, seedKey) {
  const r = seeded(hashStr(seedKey)), frag = document.createDocumentFragment();
  let tk = null, prev = '', len = 0;
  for (const ch of text) {
    if (ch === '\n') { frag.appendChild(document.createElement('br')); tk = null; prev = ''; continue; }
    const join = tk && (NO_START.includes(ch) || NO_END.includes(prev) || (isWordCh(ch) && isWordCh(prev) && len < 16));
    if (!join) { tk = document.createElement('span'); tk.className = 'tk'; frag.appendChild(tk); len = 0; }
    const c = document.createElement('span'), j = jitter(r);
    c.className = 'c'; c.textContent = ch;
    c.style.cssText = `--j:translateY(${j.ty}px) rotate(${j.rot}deg) scale(${j.sc});--a:${j.a}`;
    tk.appendChild(c); len++; prev = ch;
  }
  el.textContent = ''; el.appendChild(frag);
}

/* ───────────── 小さな知らせと確認 ───────────── */
function toast(msg, ms = 3000) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}
// 全部消した頁を閉じる時の確認。白紙にするなら true
function confirmClear(label) {
  const wrap = $('#confirm');
  $('#confirm-text').textContent = `${label}の文字をすべて消しました。このまま閉じると、この日の頁と朱印がなくなり、元には戻せません。`;
  wrap.hidden = false;
  return new Promise(ok => {
    const done = v => { wrap.hidden = true; $('#confirm-keep').onclick = $('#confirm-clear').onclick = null; ok(v); };
    $('#confirm-keep').onclick = () => done(false);
    $('#confirm-clear').onclick = () => done(true);
  });
}

/* ───────────── 枠をキーボードの上に収める ─────────────
 * ページ全体は動かさず、枠（#app）の高さだけを「見えている範囲」に合わせる。
 * 反応するのはキーボードの出入り（大きさの変化）だけなので、スクロールやフリックでは何も動かない。 */
function fitViewport() {
  const vv = window.visualViewport;
  if (!vv || vv.scale > 1.05) return; // ピンチで拡大中は触らない
  if (window.scrollY) window.scrollTo(0, 0);
  root.style.setProperty('--vv-h', Math.round(vv.height) + 'px');
  root.style.setProperty('--vv-top', Math.round(Math.max(0, vv.offsetTop)) + 'px');
  root.classList.toggle('kb-open', window.innerHeight - vv.height > 140);
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', () => { fitViewport(); if (current === 'edit') Editor.keepCaret(); });
  visualViewport.addEventListener('scroll', fitViewport);
}

/* ───────────── 画面の切り替え ───────────── */
const screens = { cal: $('#cal'), read: $('#read'), edit: $('#edit') };
let current = 'cal';
let viewDate = null; // 開いている日の key
function show(name, push = true) {
  if (current === 'edit' && name !== 'edit') Editor.close();
  Object.entries(screens).forEach(([k, el]) => { el.hidden = k !== name; });
  const el = screens[name];
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  if (name !== 'cal') $('.scroller', el).scrollTop = 0;
  const dock = $('.dock', el);
  root.style.setProperty('--dock-h', (dock ? dock.offsetHeight : 64) + 'px');
  current = name;
  if (push) history.pushState({ s: name, d: viewDate }, '');
}
window.addEventListener('popstate', e => {
  const st = e.state || { s: 'cal' };
  if (st.s === 'read' && st.d && entries.has(st.d)) Reader.open(st.d, false);
  else { show('cal', false); Cal.render(); }
});

/* ───────────── 暦 ───────────── */
const Cal = (() => {
  let y, m, stampKey = null;
  const grid = $('#grid');
  function set(d) { y = d.getFullYear(); m = d.getMonth(); }
  function render(dir) {
    const t = startOfToday(), tk = keyOf(t);
    $('#wafu').textContent = WAFU[m];
    $('#ym').textContent = `${kanjiNum(m + 1)}月　${kanjiYear(y)}`;
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const terms = [];
    let html = '';
    for (let i = 0; i < first; i++) html += '<div class="day blank"></div>';
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m, d), k = keyOf(date), has = entries.has(k), term = sekkiOn(y, m, d);
      if (term) terms.push(term);
      const cls = ['day', has && 'has', date > t && 'future', date.getDay() === 0 && 'sun'].filter(Boolean).join(' ');
      const label = `${dateLabel(date)}${has ? '、日記あり' : ''}${term ? '、' + term : ''}`;
      html += `<button type="button" class="${cls}" data-k="${k}" aria-label="${label}">`
        + (k === tk ? ringSVG(k) : '')
        + `<span class="num">${d}</span>${moonSVG(moonAge(y, m, d))}`
        + (term ? `<span class="term">${term}</span>` : '')
        + (has ? sealSVG(k, k === stampKey) : '')
        + '</button>';
    }
    grid.innerHTML = html;
    stampKey = null;
    $('#sekki').textContent = terms.join('　·　');
    const atNow = y === t.getFullYear() && m === t.getMonth();
    $('#next').style.visibility = (y > t.getFullYear() || atNow) ? 'hidden' : 'visible';
    $('#go-today').style.visibility = atNow ? 'hidden' : 'visible'; // 今月を見ている時は出さない
    if (dir) { grid.classList.remove('turn-l', 'turn-r'); void grid.offsetWidth; grid.classList.add(dir > 0 ? 'turn-l' : 'turn-r'); }
  }
  function move(n) {
    const nd = new Date(y, m + n, 1);
    if (nd > startOfToday()) return;
    set(nd); render(n);
  }
  grid.addEventListener('click', e => {
    const b = e.target.closest('.day[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    if (entries.has(k)) Reader.open(k); else Editor.open(k);
  });
  // 左右になでて月をめくる
  let sx = null, sy = null;
  grid.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  }, { passive: true });
  $('#prev').addEventListener('click', () => move(-1));
  $('#next').addEventListener('click', () => move(1));
  $('#go-today').addEventListener('click', () => { set(startOfToday()); render(); });
  // 「書く」はいつも今日の頁を、続きから書ける状態で開く
  $('#write-today').addEventListener('click', () => Editor.open(keyOf(startOfToday())));
  return { set, render, stamp: k => { stampKey = k; set(fromKey(k)); } };
})();
function goCal() { show('cal'); Cal.render(); }

/* ───────────── 読む ───────────── */
const Reader = (() => {
  const hand = $('#read-hand');
  function open(k, push = true) {
    viewDate = k;
    const date = $('#read-date');
    date.textContent = dateLabelW(fromKey(k));
    date.insertAdjacentHTML('beforeend', sealSVG(k, false));
    const text = entries.get(k).text;
    renderHand(hand, text, k);
    $('#read-count').textContent = countChars(Array.from(text));
    show('read', push);
  }
  $('#fix').addEventListener('click', () => Editor.open(viewDate));
  $('#read-back').addEventListener('click', () => { Cal.set(fromKey(viewDate)); goCal(); });
  return { open };
})();

/* ───────────── 書く ─────────────
 * 見えない入力欄（textarea）の上に、手書きの写しを重ねて表示する。
 * 写しは変わった字の分だけ差し替える（全文を描き直さないので、長くなっても軽い）。 */
const Editor = (() => {
  const ed = $('#ed'), mirror = $('#mirror'), ph = $('#ph'), count = $('#edit-count'), scroller = $('#edit-scroll');
  const tail = document.createTextNode('​'); // 最後の改行の後も高さを保つための印
  let key = null, existedBefore = false, stable = [], shown = [], nodes = [], composing = false, saveTimer = null;
  let typedInComposition = false, lastCompEnd = 0;

  // a と b の違う範囲 → [先頭の一致数, 末尾の一致数]
  function diff(a, b) {
    let s = 0; while (s < a.length && s < b.length && a[s] === b[s]) s++;
    let e = 0; while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
    return [s, e];
  }
  function span(ch) {
    const el = document.createElement('span');
    el.className = 'm'; el.textContent = ch;
    el.style.setProperty('--ty', ((Math.random() - .5) * 2.4).toFixed(2) + 'px');
    return el;
  }
  function sync(now) {
    const [s, e] = diff(shown, now);
    const oldEnd = shown.length - e, newEnd = now.length - e;
    for (let i = s; i < oldEnd; i++) nodes[i].remove();
    const before = nodes[oldEnd] || tail, add = [];
    for (let i = s; i < newEnd; i++) { const el = span(now[i]); mirror.insertBefore(el, before); add.push(el); }
    nodes.splice(s, oldEnd - s, ...add);
    const shrank = now.length < shown.length;
    shown = now;
    ph.hidden = now.length > 0;
    count.textContent = countChars(now);
    // 入力欄の高さを中身に合わせる（縮む時だけ一度リセット）
    if (shrank) ed.style.height = 'auto';
    if (shrank || ed.scrollHeight > ed.clientHeight + 1) ed.style.height = ed.scrollHeight + 'px';
    return { s, added: newEnd - s, removed: oldEnd - s };
  }
  function rebuild(text) {
    mirror.textContent = '';
    shown = []; nodes = [];
    mirror.appendChild(tail);
    ed.style.height = 'auto';
    sync(Array.from(text));
  }

  /* 指で打っている最中（変換前）：打った字はすぐ濃く書き、鉛筆を走らせる。
   * 変換（字数が減る置き換え）や消す時は鉛筆を走らせない。 */
  function onComposing() {
    typedInComposition = true;
    const now = Array.from(ed.value), { s, added, removed } = sync(now);
    const [ds, de] = diff(stable, now);
    for (let i = ds; i < now.length - de; i++) nodes[i].classList.add('draft');
    for (let i = s; i < s + added; i++) nodes[i].classList.add('quick');
    if (added > removed) Sound.write(220);       // 新しく一字打った
    else if (added && added === removed && added <= 2) Sound.write(120); // 打ち替え（か→き、濁点など）
    queueSave(); // 変換前の字も控えておく（確定前にアプリを閉じても消えない）
    keepCaret();
  }
  /* 入力が確定した（変換の確定・音声入力・貼り付け・英字など） */
  function settle(inputType) {
    const now = Array.from(ed.value);
    sync(now);
    const [s, e] = diff(stable, now), insEnd = now.length - e, n = insEnd - s;
    nodes.forEach(el => el.classList.remove('draft'));
    // 打った時にもう書いている字は、確定でもう一度は書かない（iPhoneは確定の直後に知らせがもう一度来ることがある）
    const fromTyping = typedInComposition || inputType === 'insertFromComposition'
      || inputType === 'deleteCompositionText' || performance.now() - lastCompEnd < 120;
    typedInComposition = false;
    if (n > 0 && !fromTyping) {
      const paste = inputType === 'insertFromPaste' || inputType === 'insertFromDrop';
      if (paste) {
        for (let i = s; i < insEnd; i++) nodes[i].className = 'm quick';
      } else if (n === 1) {
        nodes[s].className = 'm quick';
        Sound.write(220);
      } else { // 音声入力のようにまとめて入った字：一文字ずつ現れ、その間鉛筆が走る
        const ds = schedule(n);
        let acc = 0;
        for (let i = s; i < insEnd; i++) {
          nodes[i].style.setProperty('--dl', acc.toFixed(0) + 'ms');
          nodes[i].className = 'm new';
          acc += ds[i - s];
        }
        Sound.write(acc + 80);
      }
    }
    stable = now;
    queueSave();
    keepCaret();
  }
  ed.addEventListener('compositionstart', () => { composing = true; });
  ed.addEventListener('compositionend', () => { composing = false; lastCompEnd = performance.now(); settle('composition'); });
  ed.addEventListener('blur', () => { if (composing) { composing = false; lastCompEnd = performance.now(); settle('composition'); } });
  ed.addEventListener('input', e => {
    if (composing || e.isComposing || e.inputType === 'insertCompositionText') onComposing();
    else settle(e.inputType);
  });
  // 紙の空いている所をタップしたら、末尾から書けるように
  $('#edit-sheet').addEventListener('click', e => {
    if (e.target === ed) return;
    ed.focus();
    const L = ed.value.length; ed.setSelectionRange(L, L);
    keepCaret();
  });

  /* 入力している位置が帯やキーボードに隠れる時だけ、紙を少し送る（隠れていなければ何もしない） */
  function keepCaret() {
    requestAnimationFrame(() => {
      if (current !== 'edit' || document.activeElement !== ed) return;
      const i = Array.from(ed.value.slice(0, ed.selectionEnd)).length;
      const n = nodes[i - 1] || nodes[i];
      const r = n ? n.getBoundingClientRect() : ed.getBoundingClientRect();
      const afterBreak = shown[i - 1] === '\n';
      const top = afterBreak ? r.bottom : r.top, bottom = afterBreak ? r.bottom + 40 : r.bottom;
      const box = scroller.getBoundingClientRect(), margin = 20;
      if (bottom > box.bottom - margin) scroller.scrollTop += bottom - (box.bottom - margin);
      else if (top < box.top + margin) scroller.scrollTop -= (box.top + margin) - top;
    });
  }

  /* 保存：書いた内容を端末に。成功したら true。
   * 白紙（全部消した）の時は、ここでは消さない。閉じる時に確かめてから消す（うっかり消えないように）。 */
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); }
  let failed = false;
  async function save() {
    clearTimeout(saveTimer);
    if (!key) return true;
    const text = ed.value.replace(/\s+$/u, '');
    const old = entries.get(key);
    if (!text.trim()) return true;
    if (old && old.text === text && !failed) return true;
    const now = Date.now();
    const e = { date: key, text, created: old ? old.created : now, updated: now };
    entries.set(key, e);
    try {
      await DB.put(e);
      if (failed) toast('保存できました。');
      failed = false;
    } catch (err) {
      console.error(err);
      failed = true;
      toast('保存できませんでした。iPhoneの空き容量を確かめて、もう一度「綴じる」を押してください。', 8000);
      return false;
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    return true;
  }
  async function leave() { // 頁を閉じてよければ true
    const k = key, text = ed.value.replace(/\s+$/u, '');
    if (!text.trim() && entries.has(k)) {
      ed.blur();
      const ok = await confirmClear(dateLabelW(fromKey(k)));
      if (!ok) { // 書き戻す
        const back = entries.get(k).text;
        ed.value = back; stable = Array.from(back); rebuild(back);
        return false;
      }
      entries.delete(k);
      await DB.del(k).catch(() => {});
      return true;
    }
    return save();
  }

  function open(k) {
    key = k; viewDate = k;
    existedBefore = entries.has(k);
    const text = existedBefore ? entries.get(k).text : '';
    ed.value = text;
    stable = Array.from(text);
    $('#edit-date').textContent = dateLabelW(fromKey(k));
    show('edit');
    rebuild(text);
    // 開いてすぐキーボードを出し、続きを書く位置（末尾）へ。iPhoneはタップの処理の中で focus しないとキーボードが出ない
    try { ed.focus({ preventScroll: true }); const L = ed.value.length; ed.setSelectionRange(L, L); } catch (e) {}
    scroller.scrollTop = scroller.scrollHeight;
    keepCaret();
  }
  function close() { Sound.lift(); ed.blur(); save(); }
  let leaving = false;
  async function finish(toCal) {
    if (leaving) return;
    leaving = true;
    try {
      const k = key;
      if (!(await leave())) return; // 書き戻した・保存に失敗した → この頁に留まる
      close();
      if (entries.has(k) && !existedBefore) { Cal.stamp(k); goCal(); } // はじめて書いた日は、暦に印を押す
      else if (entries.has(k) && !toCal) Reader.open(k);
      else { Cal.set(fromKey(k)); goCal(); }
    } finally { leaving = false; }
  }
  $('#done').addEventListener('click', () => finish(false));
  $('#edit-back').addEventListener('click', () => finish(true));
  // アプリを閉じる・切り替える時も保存
  document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'edit') save(); });
  window.addEventListener('pagehide', () => { if (current === 'edit') save(); });
  return { open, close, keepCaret };
})();

/* ───────────── 栞（設定・控え） ───────────── */
const Menu = (() => {
  const wrap = $('#menu'), msg = $('#io-msg');
  function sync() {
    wrap.querySelectorAll('[data-sound]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.sound === 'on') === settings.sound)));
    $('#count').textContent = `これまでに綴った日　${entries.size}日`;
    $('#last-export').textContent = settings.lastExport
      ? `最後に控えを書き出した日　${dateLabelW(new Date(settings.lastExport))}`
      : 'まだ控えを書き出していません。';
    nudge();
  }
  // しばらく控えを書き出していない時は、栞に小さな朱の点を付けて知らせる
  function nudge() {
    const days = settings.lastExport ? (Date.now() - settings.lastExport) / 86400000 : Infinity;
    $('#menu-open').classList.toggle('nudge', entries.size >= 5 && days > 30);
  }
  function exported() { settings.lastExport = Date.now(); saveSettings(); sync(); }
  function open() { msg.textContent = ''; sync(); wrap.hidden = false; }
  function close() { wrap.hidden = true; }
  $('#menu-open').addEventListener('click', open);
  $('#menu-close').addEventListener('click', close);
  $('#menu-scrim').addEventListener('click', close);
  wrap.addEventListener('click', e => {
    const s = e.target.closest('[data-sound]');
    if (s) { settings.sound = s.dataset.sound === 'on'; saveSettings(); sync(); }
  });
  $('#export').addEventListener('click', async () => {
    const list = [...entries.values()].sort((a, b) => a.date.localeCompare(b.date));
    const data = JSON.stringify({ app: 'hitohi', version: 1, exportedAt: new Date().toISOString(), entries: list }, null, 1);
    const name = `ひとひ控え-${keyOf(startOfToday())}.json`;
    const file = new File([data], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        exported();
        msg.textContent = `${list.length}日分の控えを書き出しました。`;
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    exported();
    msg.textContent = `${list.length}日分の控えを書き出しました。`;
  });
  $('#import').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || data.app !== 'hitohi' || !Array.isArray(data.entries)) throw new Error('format');
      let n = 0;
      for (const x of data.entries) {
        if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || typeof x.text !== 'string') continue;
        const old = entries.get(x.date);
        if (old && (old.updated || 0) >= (x.updated || 0)) continue; // 新しい方を残す
        const e2 = { date: x.date, text: x.text, created: x.created || Date.now(), updated: x.updated || Date.now() };
        entries.set(x.date, e2); await DB.put(e2); n++;
      }
      msg.textContent = n ? `${n}日分を戻しました。` : '新しく戻す日はありませんでした。';
      sync(); Cal.render();
    } catch (err) {
      msg.textContent = 'このファイルは「ひとひ」の控えではないようです。書き出した .json ファイルを選んでください。';
    }
  });
  return { nudge };
})();

/* ───────────── 起動 ───────────── */
(async function boot() {
  fitViewport();
  try { (await DB.all()).forEach(e => entries.set(e.date, e)); }
  catch (e) { console.error(e); toast('日記を読み込めませんでした。アプリを一度閉じて、開き直してください。', 8000); }
  Cal.set(startOfToday());
  history.replaceState({ s: 'cal' }, '');
  show('cal', false);
  Cal.render();
  Menu.nudge();
  Sound.init(); // 音を先に読み込んでおく（鳴らせるのは最初のタッチの後）
  // 開きっぱなしで日付が変わっても、戻ってきた時に暦の「今日」を正しくする
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && current === 'cal') { Cal.render(); Menu.nudge(); }
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    // 新しい版が届いたら、書いている途中でなければその場で切り替える（書いている時は次に開いた時）
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && current !== 'edit') location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
