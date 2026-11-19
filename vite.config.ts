/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { hitohi, type Channel } from './build/plugin.ts';

/** 栞の下に小さく出す版の名前（どの版を確かめているか分かるように） */
function buildLabel(channel: Channel): string {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  let sha = (process.env.GITHUB_SHA ?? '').slice(0, 7);
  if (!sha) { try { sha = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim(); } catch { sha = 'local'; } }
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  return `版 ${version}${channel === 'beta' ? '（試作）' : ''}　${date}　${sha}`;
}

export default defineConfig(({ mode }) => {
  const channel: Channel = mode === 'beta' ? 'beta' : 'production';
  return {
    base: channel === 'beta' ? '/hitohi/beta/' : '/hitohi/',
    publicDir: false,
    define: {
      __CHANNEL__: JSON.stringify(channel),
      __BUILD__: JSON.stringify(buildLabel(channel)),
    },
    build: {
      target: 'safari16',
      assetsInlineLimit: 0,
      emptyOutDir: true,
      reportCompressedSize: true,
    },
    plugins: [hitohi(channel)],
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
      setupFiles: ['tests/unit/setup.ts'],
    },
  };
});
