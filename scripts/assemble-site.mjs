// 公開するサイトを site/ に組み立てる（GitHub Pages にはこの site/ がそのまま出る）
//   site/        … 本番 https://teto59.github.io/hitohi/       （site.config.json の production のフォルダを、そのまま）
//   site/beta/   … 試作 https://teto59.github.io/hitohi/beta/  （dist/beta/。いつも main の最新）
// 本番に出すフォルダは v1/（最初の版）か releases/<7桁>/（試作版で合格した版。scripts/release.mjs で作る）だけ。
// どちらもコミットされたものを 1 バイトも変えずに出すので、main に何を入れても、本番は production を変えない限り変わらない。
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';

const { production } = JSON.parse(readFileSync('site.config.json', 'utf8'));
if (typeof production !== 'string' || !/^(v1|releases\/[0-9a-f]{7})$/.test(production)) {
  throw new Error(`site.config.json の production は "v1" か "releases/<7桁>"：${production}`);
}
for (const d of [production, 'dist/beta']) {
  if (!existsSync(d)) throw new Error(`${d} がありません（dist/beta なら先に npm run build を）。`);
}
if (existsSync(`${production}/beta`)) throw new Error(`${production}/beta があると試作版とぶつかります`);

rmSync('site', { recursive: true, force: true });
cpSync(production, 'site', { recursive: true });
cpSync('dist/beta', 'site/beta', { recursive: true });
console.log(`site/ を組み立てました（本番：${production}／試作：dist/beta）`);
