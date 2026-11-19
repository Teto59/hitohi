// 試作版のアイコンを作る（本番のアイコンの上に「試作」の帯を重ねる）。一度作って brand/icons-beta/ に入れておく。
//   node scripts/make-beta-icons.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = 'brand/icons', out = 'brand/icons-beta';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const f of readdirSync(src).filter(f => f.endsWith('.png'))) {
  const png = readFileSync(join(src, f));
  const size = png.readUInt32BE(16); // PNG の幅
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><style>
    html,body{margin:0}
    .w{position:relative;width:${size}px;height:${size}px;overflow:hidden}
    img{display:block;width:100%;height:100%}
    .b{position:absolute;left:0;right:0;top:0;height:${Math.round(size * 0.27)}px;background:#2a2723;
       display:grid;place-items:center;color:#f1ece1;font:600 ${Math.round(size * 0.15)}px/1 "Yu Mincho","Hiragino Mincho ProN",serif;
       letter-spacing:.3em;padding-left:.3em;padding-top:${Math.round(size * 0.035)}px}
  </style><div class="w"><img src="data:image/png;base64,${png.toString('base64')}"><div class="b">試作</div></div>`);
  await page.locator('.w').screenshot({ path: join(out, f) });
  console.log('made', join(out, f), size);
}
await browser.close();
