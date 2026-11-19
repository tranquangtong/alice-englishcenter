import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serveFixture } from './helpers/static-server.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/ielts-gt/listening/index.json', import.meta.url)));

test('Edge: all four real tests, real MP3s, scoring, exam transitions and responsive pages', { timeout: 180000 }, async t => {
  const server = await serveFixture({ real: true });
  const profile = await mkdtemp(path.join(tmpdir(), 'alice-listening-real-edge-'));
  let context;
  t.after(async () => { await context?.close(); await server.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });
  context = await chromium.launchPersistentContext(profile, {
    channel: 'msedge', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('dialog', dialog => dialog.accept());
  const errors = [], metrics = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mkdir('test-artifacts', { recursive: true });
  async function route(hash) {
    await page.goto(server.url + hash);
    await page.locator('main:not([aria-busy])').waitFor();
  }
  async function metadata(part) {
    await page.waitForFunction(number => {
      const audio = document.querySelector('audio');
      return audio?.src.endsWith(`part${number}.mp3`) && audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration > 120;
    }, part);
    assert.equal(await page.locator('[data-audio-error]').isVisible(), false);
  }
  async function layout(label) {
    const size = await page.evaluate(() => ({
      viewport: innerWidth, width: document.documentElement.scrollWidth,
      table: document.querySelector('.lt-table')?.getBoundingClientRect().toJSON(),
      outside: [...document.querySelectorAll('.lt input, .lt button, .lt select, .lt-map')]
        .filter(n => n.getClientRects().length && (n.getBoundingClientRect().right > innerWidth + 1 || n.getBoundingClientRect().left < -1))
        .map(n => n.outerHTML.slice(0, 100))
    }));
    metrics.push({ label, ...size });
    assert.ok(size.width <= size.viewport && !size.outside.length, `${label}: ${JSON.stringify(size)}`);
  }
  async function screenshots(name) {
    for (const width of [1600, 390]) {
      await page.setViewportSize({ width, height: width === 1600 ? 1000 : 844 });
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await layout(`${name}-${width}`);
      await page.screenshot({ path: `test-artifacts/listening-real-${name}-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
  }
  await route('#/ielts-gt/listening');
  assert.equal(await page.locator('.lt-card').count(), 4);
  assert.equal(await page.locator('.lt-list > section').count(), 2);
  for (const site of await page.locator('.lt-list > section').all()) {
    assert.equal(await site.locator('li a').count(), 20);
    for (const link of await site.locator('a').all()) {
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.deepEqual((await link.getAttribute('rel')).split(' ').sort(), ['noopener', 'noreferrer']);
    }
  }
  await screenshots('list');
  for (const entry of catalog.tests) {
    const data = JSON.parse(await readFile(new URL(`../${entry.file}`, import.meta.url)));
    await route(`#/ielts-gt/listening/${entry.id}?mode=practice`);
    for (const part of data.parts) {
      await page.locator(`[data-part="${part.part - 1}"]`).click();
      await metadata(part.part);
      const audio = page.locator('audio');
      await audio.evaluate(a => { a.currentTime = 30; });
      await page.waitForFunction(() => !document.querySelector('audio').seeking);
      let expected = 30;
      for (const jump of [-5, 5, -10, 10]) {
        await page.locator(`[data-jump="${jump}"]`).click(); expected += jump;
        await page.waitForFunction(seconds => Math.abs(document.querySelector('audio').currentTime - seconds) < 0.4, expected);
      }
      assert.equal(await page.locator('[data-question]').count(), 10);
      for (const group of part.groups) {
        if (group.type === 'map') {
          const image = page.locator(`.lt-map[src="${group.image}"]`);
          await image.evaluate(img => img.decode());
          assert.ok(await image.evaluate(img => img.naturalWidth > 0 && !!img.alt));
        }
        if (group.type === 'table') {
          for (const question of group.questions) {
            const row = page.locator(`[data-question="${question.n}"]`);
            if (question.prompt.includes(' | ')) {
              assert.equal(await row.evaluate(n => n.tagName), 'TR');
              assert.equal(await row.locator('td').count(), question.prompt.split(' | ').length);
              const index = question.prompt.split(' | ').findIndex(cell => cell.includes('{{blank}}'));
              assert.equal(await row.locator('td').nth(index).locator('input').count(), 1);
            } else assert.equal(await row.evaluate(n => n.tagName), 'DIV');
          }
        }
        if (group.type === 'mcq-multi') {
          assert.equal(await page.locator(`[data-n="${group.questions[0].n}"][data-multi]`).count(), group.options.length);
          for (const question of group.questions.slice(1)) assert.equal(await page.locator(`[data-n="${question.n}"]`).count(), 0);
          for (const answer of group.questions[0].answer) await page.locator(`[data-n="${group.questions[0].n}"][value="${answer}"]`).check();
        } else for (const question of group.questions) {
          if (group.wordLimit) {
            // Exercise the compact variant against the real spaced phone key.
            const answer = entry.id === 'gt-l-01' && question.n === 3 ? '07492618305' : question.answer[0];
            await page.locator(`#lt-q-${question.n}`).fill(answer);
          } else {
            assert.equal(await page.locator(`[data-n="${question.n}"]`).count(), (group.options || question.options).length);
            await page.locator(`[data-n="${question.n}"][value="${question.answer[0]}"]`).check();
          }
        }
      }
      await page.setViewportSize({ width: 390, height: 844 }); await layout(`${entry.id}-part${part.part}-390`);
      await page.setViewportSize({ width: 1600, height: 1000 });
    }
    assert.equal(await page.locator('.lt-progress').innerText(), 'Đã làm 40/40');
    await page.locator('[data-part="0"]').click(); await metadata(1);
    if (entry.id === 'gt-l-04') await screenshots('practice');
    await page.locator('[data-action="submit"]').click();
    assert.equal(await page.locator('.lt-score').innerText(), '40/40');
    assert.match(await page.locator('.lt-band').innerText(), /Band 9 /);
    for (let part = 0; part < 4; part++) {
      await page.locator(`[data-part="${part}"]`).click();
      assert.equal(await page.locator('.lt-feedback').count(), 10);
      assert.equal(await page.locator('.lt-q--correct').count(), 10);
      assert.ok(await page.locator('.lt-transcript .lt-hl').count());
    }
    await page.locator('[data-part="0"]').click();
    if (entry.id === 'gt-l-04') {
      assert.equal(await page.locator('.lt-table tbody tr').count(), 4);
      await screenshots('result');
      await page.setViewportSize({ width: 360, height: 800 });
      for (const colorScheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme }); await layout(`360-${colorScheme}-table-result`);
      }
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.lt-table').isVisible(), true);
      assert.equal(await page.locator('.lt-audio').isVisible(), false);
      await page.emulateMedia({ media: 'screen', colorScheme: 'light' });
      await page.setViewportSize({ width: 1600, height: 1000 });
    }
    await page.locator('[data-action="reset"]').click();
    await page.locator('[data-action="submit"]').click();
    assert.equal(await page.locator('.lt-score').innerText(), '0/40');
  }
  await route('#/ielts-gt/listening/gt-l-01?mode=exam'); await metadata(1);
  assert.equal(await page.locator('.lt-seek, .lt-speed, [data-jump], [data-action="play"]').count(), 0);
  assert.equal(await page.locator('audio').getAttribute('controls'), null);
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => document.querySelector('audio').currentTime > 0.2);
  const anchor = await page.locator('audio').evaluate(a => a.currentTime);
  await page.locator('audio').evaluate(a => { a.currentTime += 10; });
  await page.waitForFunction(before => document.querySelector('audio').currentTime < before + 1, anchor);
  await page.locator('audio').evaluate(a => { a.playbackRate = 2; });
  await page.waitForFunction(() => document.querySelector('audio').playbackRate === 1);
  for (let part = 1; part <= 4; part++) {
    await metadata(part);
    await page.waitForFunction(() => !document.querySelector('audio').paused);
    // Browser-only acceleration: suppress the seek guard just while jumping to
    // the real MP3's tail. The native media element must emit its own ended event.
    await page.locator('audio').evaluate(async audio => {
      const bypass = event => event.stopImmediatePropagation();
      audio.addEventListener('seeking', bypass, { capture: true });
      audio.currentTime = audio.duration - 0.25;
      await new Promise(resolve => audio.addEventListener('seeked', resolve, { once: true }));
      audio.removeEventListener('seeking', bypass, { capture: true });
    });
    if (part < 4) {
      await metadata(part + 1);
      assert.equal(await page.locator(`[data-part="${part}"]`).getAttribute('aria-selected'), 'true');
    } else await page.waitForFunction(() => document.querySelector('.lt-timer').textContent.includes('Thời gian kiểm tra lại:'));
  }
  await page.clock.install(); await page.clock.fastForward(120100);
  await page.locator('.lt-score').waitFor(); assert.equal(await page.locator('.lt-score').innerText(), '0/40');
  await page.clock.resume();
  await page.setViewportSize({ width: 360, height: 800 }); await page.emulateMedia({ colorScheme: 'dark' });
  await layout('360-dark-result');
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.lt-audio').isVisible(), false);
  await writeFile('test-artifacts/listening-real-layout.json', JSON.stringify(metrics, null, 2));
  assert.deepEqual(errors, []);
});
