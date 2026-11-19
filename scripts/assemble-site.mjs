// 公開するサイトを site/ に組み立てる（GitHub Pages にはこの site/ がそのまま出る）
//   site/        … 本番 https://teto59.github.io/hitohi/       （site.config.json の production：v1 なら v1/ をそのまま）
//   site/beta/   … 試作 https://teto59.github.io/hitohi/beta/  （dist/beta/）
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';

const { production } = JSON.parse(readFileSync('site.config.json', 'utf8'));
const prodDir = { v1: 'v1', v2: 'dist/production' }[production];
if (!prodDir) throw new Error(`site.config.json の production は "v1" か "v2"：${production}`);
for (const d of [prodDir, 'dist/beta']) {
  if (!existsSync(d)) throw new Error(`${d} がありません。先に npm run build を。`);
}
if (existsSync(`${prodDir}/beta`)) throw new Error(`${prodDir}/beta があると試作版とぶつかります`);

rmSync('site', { recursive: true, force: true });
cpSync(prodDir, 'site', { recursive: true });
cpSync('dist/beta', 'site/beta', { recursive: true });
console.log(`site/ を組み立てました（本番：${production} ← ${prodDir}／試作：dist/beta）`);
