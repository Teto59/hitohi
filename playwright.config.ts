import { defineConfig, devices } from '@playwright/test';

/* 画面の流れのテスト。Safari と同じ WebKit で、iPhone の大きさで動かす。
 * 配信は scripts/serve.mjs（GitHub Pages と同じ並び：/hitohi/ に本番、/hitohi/beta/ に試作版）。 */
const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    // オフラインの仕組み（Service Worker）は、それを確かめるテスト（offline.spec.ts）でだけ動かす
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'webkit-iphone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: `node scripts/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/hitohi/beta/`,
    reuseExistingServer: !process.env.CI,
  },
});
