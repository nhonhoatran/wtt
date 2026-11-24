import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const targets = process.argv.slice(2);
if (!targets.length || targets.includes('--help')) {
  const print = targets.includes('--help') ? console.log : console.error;
  print('Usage: node tests/performance/lighthouse-audit.mjs <URL> [URL ...]');
  print('Environment: LIGHTHOUSE_OUTPUT_DIR, LIGHTHOUSE_MIN_PERFORMANCE (85), LIGHTHOUSE_MIN_ACCESSIBILITY (90), LIGHTHOUSE_MIN_SEO (95)');
  process.exit(targets.includes('--help') ? 0 : 2);
}
const urls = targets.map((target) => {
  const url = new URL(target);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Audit targets must be HTTP(S) URLs without embedded credentials');
  }
  return url;
});
const categories = ['performance', 'accessibility', 'seo'];
const thresholds = Object.fromEntries(categories.map((category, index) => {
  const configured = process.env[`LIGHTHOUSE_MIN_${category.toUpperCase()}`]?.trim();
  const threshold = Number(configured || [85, 90, 95][index]);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new Error(`Invalid Lighthouse threshold for ${category}`);
  }
  return [category, threshold];
}));
const output = path.resolve(process.env.LIGHTHOUSE_OUTPUT_DIR ?? 'test-results/lighthouse');
mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const cli = require.resolve('lighthouse/cli/index.js');
const summary = [];
let failed = false;
for (const [index, url] of urls.entries()) {
  const name = `${index + 1}-${url.pathname.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').slice(0, 100) || 'home'}`;
  const base = path.join(output, name);
  console.log(`Lighthouse mobile: ${url.origin}${url.pathname}`);
  const result = spawnSync(process.execPath, [cli, url.href,
    '--chrome-flags=--headless --no-sandbox',
    '--only-categories=performance,accessibility,seo', '--output=json', '--output=html',
    `--output-path=${base}`, '--quiet',
  ], { env: { ...process.env, CHROME_PATH: chromium.executablePath() },
    encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) {
    failed = true;
    const message = result.error?.message || result.stderr?.trim() || result.stdout?.trim()
      || `Lighthouse process failed (exit ${result.status}, signal ${result.signal ?? 'none'})`;
    console.error(message);
    summary.push({ url: url.href, error: true, exitCode: result.status, signal: result.signal ?? null, message });
    continue;
  }
  const report = JSON.parse(readFileSync(`${base}.report.json`, 'utf8'));
  const scores = Object.fromEntries(categories.map((category) => [category,
    typeof report.categories?.[category]?.score === 'number' ? report.categories[category].score * 100 : null,
  ]));
  const passed = !report.runtimeError && categories.every((category) => scores[category] !== null && scores[category] >= thresholds[category]);
  failed ||= !passed;
  summary.push({ url: url.href, scores, thresholds, passed, runtimeError: report.runtimeError ?? null,
    lighthouseVersion: report.lighthouseVersion, fetchTime: report.fetchTime,
  });
  console.log(JSON.stringify(summary.at(-1)));
}
writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
process.exitCode = failed ? 1 : 0;
