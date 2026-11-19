/** 組み立ての時に sw.js の先頭へ書き足される設定（build/plugin.ts） */
declare const CONFIG: {
  /** 版（中身から作る指紋。中身が変われば変わる） */
  version: string;
  /** 控えの名前の頭（本番 'hitohi'／試作 'hitohi-beta'） */
  prefix: string;
  /** 最初に控えるファイル（sw.js からの相対） */
  shell: string[];
  /** 手を出さない下位のパス（本番では ['beta/']） */
  skip: string[];
  /** v1 の本体の控え（hitohi-v8 など）を消すか */
  cleanV1: boolean;
};
