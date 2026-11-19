/** 画面の部品を id や CSS セレクタで取り出す（見つからなければすぐ気づけるように投げる） */
export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
}
