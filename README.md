# ひとひ

鉛筆で綴る、一日一頁の日記。iPhone の Safari で開き、「ホーム画面に追加」して使います。

- 日記の中身は端末の中（IndexedDB）だけに保存され、どこにも送信されません
- 本番：https://teto59.github.io/hitohi/ ／ 試作版：https://teto59.github.io/hitohi/beta/
- 書体：Klee One／Yuji Syuku（SIL Open Font License）

## 文書
- `CLAUDE.md` … 作業の引き継ぎ書（大原則・教訓・進め方）
- `docs/PRODUCT.md` … 仕様書（何を作り、何を作らないか）
- `docs/REBUILD.md` … 再構築（v2）の計画
- `docs/CHECKLIST.md` … iPhone での確認チェックリスト
- `docs/design-ref/` … 見た目の参考画像
- `docs/v1-notes.md` … v1 の設計メモ（記録）

## 開発
- `npm ci` → `npx playwright install webkit`（初回だけ）
- `npm run check` … 型の確認・ロジックのテスト・組み立て・画面の流れのテスト（WebKit）をまとめて
- `npm run dev` … 手元で動かす（http://localhost:5173/hitohi/）
