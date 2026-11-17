'use strict';
/* ひとひ ─ 鉛筆で綴る、一日一頁の日記
 * データはこの端末の IndexedDB にだけ保存する。通信は初回の読み込み（と書体）だけ。 */

const $ = (s, r = document) => r.querySelector(s);

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
  let a = (jdOf(Date.UTC(y, m, d, 12) - 9 * 3600000) - 2451550.1) % SYN;
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
const settings = { sound: true, speed: 's1' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('hitohi-settings') || '{}')); } catch (e) {}
const saveSettings = () => { try { localStorage.setItem('hitohi-settings', JSON.stringify(settings)); } catch (e) {} };

/* ───────────── 鉛筆の音 ─────────────
 * 0.29秒の録音を「サッ／サーッ／サッ」の三画に分け、文字が現れるのに合わせて一画ずつ鳴らす。
 * どの画か・高さ・強さを毎回変えるので、何秒でも自然に続く。句読点では一呼吸おく。 */
const STROKES = [[0.022, 0.100], [0.118, 0.215], [0.220, 0.280], [0.118, 0.280]];
const PUNCT = '、。，．・「」『』（）!?！？ 　\n';
const Sound = (() => {
  let ctx = null, master = null, buf = null, loading = null;
  function init() {
    if (!ctx) {
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {} // マナーモードに従い、音楽も止めない
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 2.2; master.connect(ctx.destination);
      loading = fetch('sound/scribble.mp3').then(r => r.arrayBuffer())
        .then(b => new Promise((ok, ng) => ctx.decodeAudioData(b, ok, ng)))
        .then(b => (buf = b)).catch(() => null);
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return loading;
  }
  // chars: 文字、ds: 各文字の間隔(ms)
  function play(chars, ds) {
    if (!settings.sound || !ctx || !buf) return null;
    // 音声入力の後などは iPhone が音を止めた状態にするので、鳴らす前に起こす
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const bus = ctx.createGain(); bus.connect(master);
    const srcs = [], t0 = ctx.currentTime + 0.02;
    let t = 0, free = 0, last = -1;
    for (let i = 0; i < chars.length; i++) {
      const d = ds[i] / 1000, p = PUNCT.includes(chars[i]);
      if (!p && t >= free) {
        let k; do { k = Math.floor(Math.random() * STROKES.length); } while (k === last && Math.random() < 0.7);
        last = k;
        const [a, b] = STROKES[k], rate = 0.9 + Math.random() * 0.22, len = (b - a) / rate, st = t0 + t;
        const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
        const g = ctx.createGain(), peak = 0.65 + Math.random() * 0.35;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(peak, st + 0.006);
        g.gain.setValueAtTime(peak, st + Math.max(0.01, len - 0.012));
        g.gain.exponentialRampToValueAtTime(0.0001, st + len);
        src.connect(g); g.connect(bus); src.start(st, a, b - a);
        srcs.push(src);
        free = t + len * 0.8 + Math.random() * 0.03;
      }
      if (p) free = t + d * 2;
      t += d;
    }
    return { bus, srcs };
  }
  function stop(h) {
    if (!h || !ctx) return;
    const t = ctx.currentTime;
    try {
      h.bus.gain.setValueAtTime(h.bus.gain.value, t);
      h.bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      h.srcs.forEach(s => { try { s.stop(t + 0.07); } catch (e) {} });
    } catch (e) {}
  }
  return { init, play, stop };
})();
// iOSは最初のタッチまで音を鳴らせないので、最初の操作で準備する
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => Sound.init(), { capture: true, passive: true }));

/* ───────────── 書く速さ ─────────────
 * 書き出しはゆっくり、20字ほどで最速に。全体は上限秒数に収める。 */
const SPEEDS = { s1: [90, 22, 4500], s2: [70, 16, 3500], s3: [55, 12, 2800] };
function schedule(n, speed = settings.speed, ramp = 20) {
  const [first, fastest, cap] = SPEEDS[speed] || SPEEDS.s1, ds = [];
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, i / ramp);
    ds.push((first + (fastest - first) * (1 - Math.pow(1 - t, 2))) * (0.8 + Math.random() * 0.4));
  }
  const sum = ds.reduce((a, b) => a + b, 0), k = sum > cap ? cap / sum : 1;
  return ds.map(d => d * k);
}

/* ───────────── 手書きの描画 ───────────── */
// 行頭に来てはいけない文字は前の字とくっつける（禁則）
const NO_START = '、。，．・：；？！ー）」』】〉》〕ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ…‥';
function jitter(r) {
  return { rot: ((r() - .5) * 4).toFixed(2), ty: ((r() - .5) * 2.4).toFixed(2), sc: (1 + (r() - .5) * .07).toFixed(3), a: (0.82 + r() * 0.18).toFixed(2) };
}
function renderHand(el, text, seedKey) {
  const r = seeded(hashStr(seedKey)), frag = document.createDocumentFragment(), chars = [];
  let tk = null;
  for (const ch of text) {
    if (ch === '\n') { frag.appendChild(document.createElement('br')); tk = null; continue; }
    if (!tk || !NO_START.includes(ch)) { tk = document.createElement('span'); tk.className = 'tk'; frag.appendChild(tk); }
    const c = document.createElement('span'), j = jitter(r);
    c.className = 'c'; c.textContent = ch;
    c.style.cssText = `--j:translateY(${j.ty}px) rotate(${j.rot}deg) scale(${j.sc});--a:${j.a}`;
    tk.appendChild(c); chars.push(c);
  }
  el.textContent = ''; el.appendChild(frag);
  return chars;
}

/* ───────────── 画面の切り替え ───────────── */
const screens = { cal: $('#cal'), read: $('#read'), edit: $('#edit') };
let current = 'cal';
function show(name, push = true) {
  if (current === 'edit' && name !== 'edit') Editor.close();
  if (current === 'read' && name !== 'read') Reader.stop();
  Object.entries(screens).forEach(([k, el]) => { el.hidden = k !== name; });
  const el = screens[name];
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  current = name;
  window.scrollTo(0, 0);
  if (push) history.pushState({ s: name, d: viewDate }, '');
}
window.addEventListener('popstate', e => {
  const st = e.state || { s: 'cal' };
  if (st.s === 'read' && st.d && entries.has(st.d)) { Reader.open(st.d, false); }
  else { show('cal', false); Cal.render(); }
});

/* ───────────── 暦 ───────────── */
let viewDate = null; // 開いている日の key
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
    $('#next').style.visibility = (y > t.getFullYear() || (y === t.getFullYear() && m >= t.getMonth())) ? 'hidden' : 'visible';
    if (dir) { grid.classList.remove('turn-l', 'turn-r'); void grid.offsetWidth; grid.classList.add(dir > 0 ? 'turn-l' : 'turn-r'); }
  }
  function move(n) {
    const t = startOfToday(), nd = new Date(y, m + n, 1);
    if (nd > t) return;
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
  $('#write-today').addEventListener('click', () => {
    const k = keyOf(startOfToday());
    if (entries.has(k)) Reader.open(k); else Editor.open(k);
  });
  return { set, render, stamp: k => { stampKey = k; set(fromKey(k)); } };
})();

/* ───────────── 読み返す ───────────── */
// 開いたらすぐ全文を見せる（書き直しの演出はしない）
const Reader = (() => {
  const hand = $('#read-hand');
  function open(k, push = true) {
    viewDate = k;
    $('#read-date').textContent = dateLabel(fromKey(k));
    show('read', push);
    renderHand(hand, entries.get(k).text, k);
  }
  function stop() {}
  $('#fix').addEventListener('click', () => Editor.open(viewDate));
  $('#read-back').addEventListener('click', () => { Cal.set(fromKey(viewDate)); goCal(); });
  return { open, stop };
})();

function goCal() {
  show('cal');
  Cal.render();
}

/* ───────────── 書く ─────────────
 * 見えない入力欄（textarea）の上に、手書きの写しを重ねて表示する。
 * 音声入力などで増えた文字だけ、鉛筆の音と一緒に一文字ずつ現れる。 */
const Editor = (() => {
  const ed = $('#ed'), mirror = $('#mirror'), ph = $('#ph');
  const tail = document.createTextNode('​'); // 最後の改行の後も高さを保つための印
  let key = null, existedBefore = false, stable = [], shown = [], nodes = [], composing = false, saveTimer = null, snd = null;

  // a と b の違う範囲を求める → [先頭の一致数, 末尾の一致数]
  function diff(a, b) {
    let s = 0; while (s < a.length && s < b.length && a[s] === b[s]) s++;
    let e = 0; while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
    return [s, e];
  }
  function span(ch) {
    const el = document.createElement('span'), j = jitter(Math.random);
    el.className = 'm'; el.textContent = ch;
    el.style.cssText = `--ty:${j.ty}px`;
    return el;
  }
  // 写しを、変わった文字の分だけ差し替える（全文を描き直さないので、長くなっても軽い）
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
    // 入力欄の高さを中身に合わせる（縮む時だけ一度リセット）
    if (shrank) ed.style.height = 'auto';
    if (shrank || ed.scrollHeight > ed.clientHeight + 1) ed.style.height = ed.scrollHeight + 'px';
  }
  function rebuild(text) {
    mirror.textContent = '';
    shown = []; nodes = [];
    mirror.appendChild(tail);
    ed.style.height = 'auto';
    sync(Array.from(text));
  }
  // 入力が確定した：前回確定した文字列と比べ、新しく入った字だけを鉛筆の音とともに書く
  function settle() {
    const now = Array.from(ed.value);
    sync(now);
    const [s, e] = diff(stable, now), insEnd = now.length - e, n = insEnd - s;
    if (n > 0) {
      const ds = schedule(n, 's1', 6);
      let acc = 0;
      for (let i = s; i < insEnd; i++) {
        const el = nodes[i];
        el.className = 'm';
        el.style.setProperty('--dl', acc.toFixed(0) + 'ms');
        void el.offsetWidth; // 動きを最初から
        el.className = 'm new';
        acc += ds[i - s];
      }
      Sound.stop(snd);
      snd = Sound.play(now.slice(s, insEnd), ds);
    }
    stable = now;
    queueSave();
  }
  ed.addEventListener('compositionstart', () => { composing = true; });
  ed.addEventListener('compositionend', () => { composing = false; settle(); });
  ed.addEventListener('input', e => {
    if (composing || e.isComposing) {
      // 変換中の字は薄く表示しておく
      const now = Array.from(ed.value);
      sync(now);
      const [s, e2] = diff(stable, now);
      for (let i = s; i < now.length - e2; i++) nodes[i].className = 'm draft';
    } else settle();
  });
  $('.edit-sheet').addEventListener('click', e => { if (e.target !== ed) ed.focus(); });

  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 500); }
  async function save() {
    clearTimeout(saveTimer);
    if (!key) return;
    const text = ed.value.replace(/\s+$/u, '');
    const old = entries.get(key);
    if (!text.trim()) {
      if (old) { entries.delete(key); await DB.del(key).catch(() => {}); }
      return;
    }
    if (old && old.text === text) return;
    const now = Date.now();
    const e = { date: key, text, created: old ? old.created : now, updated: now };
    entries.set(key, e);
    try { await DB.put(e); } catch (err) { console.error(err); }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
  function open(k) {
    key = k; viewDate = k;
    existedBefore = entries.has(k);
    const text = existedBefore ? entries.get(k).text : '';
    ed.value = text;
    stable = Array.from(text);
    $('#edit-date').textContent = dateLabel(fromKey(k));
    show('edit');
    rebuild(text);
    // 開いてすぐキーボードを出す（iPhoneはタップの処理の中で focus しないとキーボードが出ない）
    try { ed.focus({ preventScroll: true }); const L = ed.value.length; ed.setSelectionRange(L, L); } catch (e) {}
  }
  function close() { Sound.stop(snd); snd = null; ed.blur(); save(); }
  async function finish() {
    const k = key;
    close();
    await save();
    if (entries.has(k)) {
      if (!existedBefore) { Cal.stamp(k); goCal(); } // はじめて書いた日は、暦に印を押す
      else Reader.open(k);
    } else { Cal.set(fromKey(k)); goCal(); }
  }
  $('#done').addEventListener('click', finish);
  $('#edit-back').addEventListener('click', async () => {
    const k = key; close(); await save();
    if (entries.has(k) && !existedBefore) Cal.stamp(k); else Cal.set(fromKey(k));
    goCal();
  });
  // アプリを閉じる・切り替える時も保存
  document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'edit') save(); });
  window.addEventListener('pagehide', () => { if (current === 'edit') save(); });
  return { open, close };
})();

/* ───────────── 栞（設定・控え） ───────────── */
const Menu = (() => {
  const wrap = $('#menu'), msg = $('#io-msg');
  function sync() {
    wrap.querySelectorAll('[data-sound]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.sound === 'on') === settings.sound)));
    $('#count').textContent = `これまでに綴った日　${entries.size}日`;
  }
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
        msg.textContent = `${list.length}日分の控えを書き出しました。`;
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
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
  return { open, close };
})();

/* ───────────── 起動 ───────────── */
(async function boot() {
  try { (await DB.all()).forEach(e => entries.set(e.date, e)); } catch (e) { console.error(e); }
  Cal.set(startOfToday());
  history.replaceState({ s: 'cal' }, '');
  Cal.render();
  Sound.init(); // 音を先に読み込んでおく（鳴らせるのは最初のタッチの後）
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    // 新しい版が届いたら、書いている途中でなければその場で切り替える（書いている時は次に開いた時）
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && current !== 'edit') location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
