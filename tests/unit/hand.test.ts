// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BREAK, NO_END, NO_START, renderHand, tokenize, type Token } from '../../src/hand';

const words = (ts: Token[]) => ts.map(t => (t === BREAK ? '\\n' : t.join('')));

describe('禁則（かたまりに分ける）', () => {
  it('「 は次の字と、。」 は前の字と、ひとかたまり', () => {
    expect(words(tokenize('今日は「雨」だった。'))).toEqual(['今', '日', 'は', '「雨」', 'だっ', 'た。']);
  });
  it('「「」で行を終えない：開き括弧がかたまりの最後に来ない（文末を除く）', () => {
    const text = '彼は「おはよう」と言った。『本』を（二冊）買った。【メモ】〈注〉《題》〔補〕';
    for (const t of tokenize(text)) {
      if (t === BREAK) continue;
      expect(NO_END.includes(t[t.length - 1]), t.join('')).toBe(false);
    }
  });
  it('句読点を行頭に置かない：行頭禁則の字がかたまりの先頭に来ない（行の最初を除く）', () => {
    const text = 'そうか、なるほど。ちょっと待って！ええっ？ふぅ…カップ・ラーメン';
    const ts = tokenize(text);
    ts.slice(1).forEach(t => { if (t !== BREAK) expect(NO_START.includes(t[0]), t.join('')).toBe(false); });
  });
  it('英単語・数字を途中で切らない', () => {
    expect(words(tokenize('Hello world 2026年'))).toEqual(['Hello', ' ', 'world', ' ', '2026', '年']);
    expect(words(tokenize('v2.0.1を入れた'))).toEqual(['v2.0.1', 'を', '入', 'れ', 'た']);
  });
  it('長すぎる綴りは 16 字ごとに折り返してよい', () => {
    const long = 'a'.repeat(40);
    expect(words(tokenize(long))).toEqual(['a'.repeat(16), 'a'.repeat(16), 'a'.repeat(8)]);
  });
  it('改行はそのまま改行', () => {
    expect(words(tokenize('一\n\n二'))).toEqual(['一', '\\n', '\\n', '二']);
  });
  it('改行の直後の句読点は、前の行とはつながない', () => {
    expect(words(tokenize('あ\n、い'))).toEqual(['あ', '\\n', '、', 'い']);
  });
  it('どんな文章でも、字が欠けたり増えたりしない', () => {
    const text = '朝の空気が冷たくて、\n息が白く見えた。「授業」のあと、少し遠回り(walk)して帰る。𠮷野家で1,280円。';
    expect(tokenize(text).map(t => (t === BREAK ? '\n' : t.join(''))).join('')).toBe(text);
  });
});

describe('手書きの描画（読む画面）', () => {
  const draw = (text: string, seed = '2026-11-19') => {
    const el = document.createElement('div');
    renderHand(el, text, seed);
    return el;
  };
  it('文章をそのまま、一文字ずつ揺らぎを付けて描く', () => {
    const el = draw('今日は「雨」。\n静か。');
    expect(el.textContent).toBe('今日は「雨」。静か。');
    expect(el.querySelectorAll('br')).toHaveLength(1);
    const cs = el.querySelectorAll<HTMLElement>('.c');
    expect(cs).toHaveLength(10);
    cs.forEach(c => expect(c.style.cssText).toMatch(/--j:\s*translateY\(.+\) rotate\(.+\) scale\(.+\)/));
    expect(el.querySelector('.tk')!.textContent).toBe('今');
    expect([...el.querySelectorAll('.tk')].map(t => t.textContent)).toContain('「雨」。');
  });
  it('同じ日なら毎回同じ揺らぎ、違う日なら違う揺らぎ', () => {
    expect(draw('朝の空気').innerHTML).toBe(draw('朝の空気').innerHTML);
    expect(draw('朝の空気', '2026-11-18').innerHTML).not.toBe(draw('朝の空気').innerHTML);
  });
  it('字は HTML として解釈しない（< > & もそのまま字として出る）', () => {
    const el = draw('<b>太字</b> & 1<2');
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toBe('<b>太字</b> & 1<2');
  });
  it('描き直すと、前の中身は消える', () => {
    const el = draw('一つ目');
    renderHand(el, '二', 'x');
    expect(el.textContent).toBe('二');
  });
});
