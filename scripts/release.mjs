// 本番に出す版を作る（試作版で合格した版を、そのまま本番用に組み立てて releases/ に残す）
//   node scripts/release.mjs <commit>     例：node scripts/release.mjs aae353a
//
// ・<commit> は、利用者が試作版でチェックリストに合格した版（栞のいちばん下に出る 7 桁）。
// ・その commit を別の場所に取り出し、本番用（/hitohi/）に組み立てて releases/<7 桁>/ に置き、
//   site.config.json の production をそこに向ける。releases/ の中身はコミットして、以後 1 バイトも変えない。
// ・こうしておくと、main に何を入れても本番は変わらない（試作版だけが新しくなる）。本番を変えるのは、この手順だけ。
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const want = process.argv[2];
if (!want) throw new Error('使い方：node scripts/release.mjs <commit>');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const sha = git('rev-parse', '--verify', `${want}^{commit}`);
const short = sha.slice(0, 7);
const out = `releases/${short}`;
if (existsSync(out)) throw new Error(`${out} はもうあります（本番に出した版は作り直さない）`);

const work = resolve('.release-build');
rmSync(work, { recursive: true, force: true });
git('worktree', 'prune');
// 改行を変えずに取り出す（Windows でも、GitHub で組み立てた時と同じ中身になるように）
execFileSync('git', ['-c', 'core.autocrlf=false', 'worktree', 'add', '--detach', '--force', work, sha], { stdio: 'inherit' });
try {
  const npm = process.env.npm_execpath;
  if (npm) execFileSync(process.execPath, [npm, 'ci', '--no-audit', '--no-fund'], { cwd: work, stdio: 'inherit' });
  else execFileSync('npm ci --no-audit --no-fund', { cwd: work, stdio: 'inherit', shell: true });
  // 版の名前（栞に出る 7 桁）は、試作版で確かめた版と同じにする
  execFileSync(process.execPath, [join(work, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'production', '--outDir', join(work, 'dist/release')],
    { cwd: work, stdio: 'inherit', env: { ...process.env, GITHUB_SHA: sha } });
  cpSync(join(work, 'dist/release'), out, { recursive: true });
} finally {
  execFileSync('git', ['worktree', 'remove', '--force', work], { stdio: 'inherit' });
}

const cfgText = readFileSync('site.config.json', 'utf8');
const cfg = JSON.parse(cfgText);
cfg.production = out;
writeFileSync('site.config.json', JSON.stringify(cfg, null, 2) + '\n');
console.log(`\n本番用の版を ${out} に作り、site.config.json の production を ${out} にしました（${sha}）。`);
console.log('releases/ と site.config.json をコミットして main に入れると、本番がこの版になります。');
