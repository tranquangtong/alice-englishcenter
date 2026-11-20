import { chromium } from 'playwright-core';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserChannel } from './browser.mjs';

// Decode PNGs in the same browser used for QA, without another image package.
export async function compareScreenshots(beforeDirectory, afterDirectory) {
  const profile = await mkdtemp(path.join(tmpdir(), 'alice-css-pixels-'));
  let context;
  const watchdog = setTimeout(() => { void context?.close().catch(() => {}); }, 120000);
  watchdog.unref();
  try {
    context = await chromium.launchPersistentContext(profile, { channel: browserChannel, headless: true, args: ['--no-sandbox'] });
    const page = await context.newPage();
    const report = [];
    const names = (await readdir(beforeDirectory)).filter(name => name.endsWith('.png')).sort();
    if (!names.length) throw new Error('No baseline PNGs found');
    for (const name of names) {
      const images = await Promise.all([beforeDirectory, afterDirectory].map(async directory => (await readFile(path.join(directory, name))).toString('base64')));
      const result = await page.evaluate(async ([left, right]) => {
        async function decode(data) {
          const img = new Image();
          img.src = `data:image/png;base64,${data}`;
          await img.decode();
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
        }
        const [a, b] = await Promise.all([decode(left), decode(right)]);
        if (a.width !== b.width || a.height !== b.height) return { dimensions: [a.width, a.height, b.width, b.height], changedPixels: null };
        let changedPixels = 0, maxChannelDelta = 0;
        let leftX = a.width, top = a.height, rightX = 0, bottom = 0;
        for (let i = 0; i < a.data.length; i += 4) {
          let changed = false;
          for (let c = 0; c < 4; c++) {
            const delta = Math.abs(a.data[i + c] - b.data[i + c]);
            if (delta) { changed = true; maxChannelDelta = Math.max(maxChannelDelta, delta); }
          }
          if (changed) {
            changedPixels++;
            const x = (i / 4) % a.width, y = Math.floor(i / 4 / a.width);
            leftX = Math.min(leftX, x); top = Math.min(top, y); rightX = Math.max(rightX, x); bottom = Math.max(bottom, y);
          }
        }
        return { width: a.width, height: a.height, changedPixels, percent: 100 * changedPixels / (a.width * a.height), maxChannelDelta, bounds: changedPixels ? [leftX, top, rightX, bottom] : null };
      }, images);
      report.push({ name, ...result });
    }
    return report;
  } finally {
    clearTimeout(watchdog);
    await context?.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , before, after, output] = process.argv;
  if (!before || !after || !output) throw new Error('Usage: node tests/helpers/compare-screenshots.mjs BEFORE AFTER REPORT.json');
  const report = await compareScreenshots(before, after);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  for (const entry of report) console.log(`${entry.name}: ${entry.changedPixels ?? 'size mismatch'} changed pixels (${entry.percent?.toFixed(6) ?? 'n/a'}%)`);
}
