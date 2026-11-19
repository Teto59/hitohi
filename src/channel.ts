/* 本番と試作版の違い（組み立ての時に決まる）。
 * 同じ teto59.github.io の中は保存場所が共有されるので、試作版は別の名前の保存場所を使う。 */

declare const __CHANNEL__: 'production' | 'beta';

export const CHANNEL: 'production' | 'beta' = typeof __CHANNEL__ === 'string' ? __CHANNEL__ : 'production';
export const IS_BETA = CHANNEL === 'beta';

/** 日記のデータベース名（本番は v1 と同じ 'hitohi'） */
export const DB_NAME = IS_BETA ? 'hitohi-beta' : 'hitohi';
/** 設定の保存キー（本番は v1 と同じ 'hitohi-settings'） */
export const SETTINGS_KEY = IS_BETA ? 'hitohi-beta-settings' : 'hitohi-settings';
