/* 読む画面の手書き（v1 の renderHand を移植）
 * 一文字ずつ少し傾け・ずらし、鉛筆のかすれ（CSS のマスク）を付ける。揺らぎは日付から決まるので毎回同じ。
 * 禁則：行頭に来ない字は前の字と、行末に来ない字は次の字と、英単語・数字は続く字と、ひとかたまりにして
 * かたまりの途中では改行させない。 */

import { hashStr, seeded } from './marks';

/** 行頭に来ない字（句読点・閉じ括弧・小さい仮名など） */
export const NO_START = '、。，．・：；？！ー）」』】〉》〕ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ…‥!?),.:;';
/** 行末に来ない字（開き括弧） */
export const NO_END = '「『（【〈《〔(“‘';
/** 英単語・数字として続けて扱う字 */
export const isWordCh = (c: string): boolean => /[A-Za-z0-9@#%&_'’\-.]/.test(c);
/** 英単語・数字のかたまりの最大の長さ（これを超える長い綴りは折り返してよい） */
const WORD_MAX = 16;

export const BREAK = '\n' as const;
export type Token = string[] | typeof BREAK;

/** 文章を「途中で改行してはいけないかたまり」に分ける */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let tk: string[] | null = null, prev = '', len = 0;
  for (const ch of text) {
    if (ch === '\n') { out.push(BREAK); tk = null; prev = ''; continue; }
    const join = tk !== null && (NO_START.includes(ch) || NO_END.includes(prev)
      || (isWordCh(ch) && isWordCh(prev) && len < WORD_MAX));
    if (!join || tk === null) { tk = []; out.push(tk); len = 0; }
    tk.push(ch); len++; prev = ch;
  }
  return out;
}

/** 一文字ぶんの揺らぎ */
function jitter(r: () => number) {
  return {
    rot: ((r() - .5) * 4).toFixed(2),
    ty: ((r() - .5) * 2.4).toFixed(2),
    sc: (1 + (r() - .5) * .07).toFixed(3),
    a: (0.82 + r() * 0.18).toFixed(2),
  };
}

/** el の中身を、手書きの揺らぎ付きの文章に置き換える */
export function renderHand(el: HTMLElement, text: string, seedKey: string): void {
  const r = seeded(hashStr(seedKey)), doc = el.ownerDocument, frag = doc.createDocumentFragment();
  for (const tk of tokenize(text)) {
    if (tk === BREAK) { frag.appendChild(doc.createElement('br')); continue; }
    const box = doc.createElement('span');
    box.className = 'tk';
    for (const ch of tk) {
      const c = doc.createElement('span'), j = jitter(r);
      c.className = 'c';
      c.textContent = ch;
      c.style.cssText = `--j:translateY(${j.ty}px) rotate(${j.rot}deg) scale(${j.sc});--a:${j.a}`;
      box.appendChild(c);
    }
    frag.appendChild(box);
  }
  el.textContent = '';
  el.appendChild(frag);
}
