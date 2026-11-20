import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { browserEngine, launchPersistentContext, webKitMobileOptions } from './helpers/browser.mjs';
import { serveFixture } from './helpers/static-server.mjs';

const artifacts = `test-artifacts/listening/${browserEngine}`;

test('Edge: listening player, exam guards, routing and responsive layout', { timeout: 120000 }, async t => {
  const server = await serveFixture();
  const profile = await mkdtemp(path.join(tmpdir(), 'alice-listening-edge-'));
  let context;
  t.after(async () => { await context?.close(); await server.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });
  // Keep the same exam and results alive when resizing to the phone viewport.
  context = await launchPersistentContext(profile, {
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce', ...webKitMobileOptions
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url})`); });
  let acceptDialog = true;
  page.on('dialog', dialog => acceptDialog ? dialog.accept() : dialog.dismiss());
  async function route(hash) { await page.goto(server.url + hash); await page.locator('main:not([aria-busy])').waitFor(); }
  const currentTime = () => page.locator('audio').evaluate(audio => audio.currentTime);
  const noOverflow = async label => {
    const metrics = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, outside: [...document.querySelectorAll('.lt *, .top-menu *')].filter(n => n.getClientRects().length && n.getBoundingClientRect().right > innerWidth + 1).map(n => n.className) }));
    assert.ok(metrics.document <= metrics.viewport && metrics.body <= metrics.viewport && !metrics.outside.length, `${label}: ${JSON.stringify(metrics)}`);
  };
  await route('#/home');
  assert.ok(await page.locator('#page-content h1').count());
  const home = await page.locator('#page-content').innerText(); assert.ok(home.length > 50);
  await page.locator('.top-menu__btn').click(); assert.equal(await page.locator('.top-menu__panel').isVisible(), true);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.top-menu__btn').getAttribute('aria-expanded'), 'false');
  await page.locator('.top-menu__btn').press('ArrowDown'); assert.equal(await page.locator('.top-menu__panel a').first().evaluate(a => a === document.activeElement), true);
  // The Aero dropdown overlays main's top-left corner; click its far edge to
  // exercise a real outside pointer event without clicking through the menu.
  const mainBox = await page.locator('main').boundingBox();
  await page.locator('main').click({ position: { x: mainBox.width - 10, y: 10 } }); assert.equal(await page.locator('.top-menu__panel').isVisible(), false);
  await route('#/ielts-gt'); assert.equal(await page.locator('.gt-skill').count(), 4);
  await page.locator('.gt-skill--soon').first().click(); await page.waitForFunction(() => document.querySelector('#page-content h1')?.textContent === 'reading');
  assert.equal(await page.locator('#page-content').getByText('Sắp ra mắt', { exact: true }).count(), 1);
  assert.match(await page.locator('#site-nav [aria-current="page"]').innerText(), /^Reading/);
  await route('#/ielts-gt/listening'); assert.equal(await page.locator('.lt-card').count(), 1);
  assert.equal(await page.getByText('External fixture').getAttribute('rel'), 'noopener noreferrer');
  await page.getByRole('link', { name: 'Luyện tập', exact: true }).click(); await page.locator('.lt-paper').waitFor();
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && Number.isFinite(a.duration) && a.readyState >= 1; });
  assert.equal(await page.locator('.lt-transcript').count(), 0);
  for (const seconds of [5, 10, -5, -10]) {
    const before = await currentTime(); await page.locator(`[data-jump="${seconds}"]`).click();
    assert.ok(Math.abs((await currentTime()) - (before + seconds)) < 0.4, `jump ${seconds}`);
  }
  await page.locator('.lt-seek').fill('15'); assert.ok(Math.abs((await currentTime()) - 15) < 0.4);
  await page.locator('main').focus(); await page.keyboard.press('ArrowRight'); assert.ok(Math.abs((await currentTime()) - 20) < 0.4);
  await page.keyboard.press('Shift+ArrowLeft'); assert.ok(Math.abs((await currentTime()) - 10) < 0.4);
  await page.locator('.lt-speed').selectOption('1.25'); assert.equal(await page.locator('audio').evaluate(a => a.playbackRate), 1.25);
  await page.locator('#lt-q-1').fill('hollis.'); await page.locator('#lt-q-3').fill('1,200');
  await page.locator('[data-n="7"][value="B"]').check();
  await page.locator('[data-n="9"][value="B"]').check(); await page.locator('[data-n="9"][value="A"]').check();
  assert.equal(await page.locator('.lt-progress').innerText(), 'Đã làm 5/40');
  const beforeInputArrow = await currentTime(); await page.locator('#lt-q-1').press('ArrowRight'); assert.ok(Math.abs((await currentTime()) - beforeInputArrow) < 0.4);
  await page.reload(); await page.locator('.lt-gap').first().waitFor(); assert.equal(await page.locator('#lt-q-1').inputValue(), 'hollis.');
  await page.locator('[data-action="submit"]').click(); assert.equal(await page.locator('.lt-score').innerText(), '5/40');
  assert.match(await page.locator('.lt-band').innerText(), /2.5.*ước tính/);
  assert.equal(await page.locator('.lt-feedback').count(), 10); assert.equal(await page.locator('.lt-explain').count(), 10);
  assert.equal(await page.locator('.lt-distractors').count(), 10); assert.ok(await page.locator('.lt-transcript .lt-hl').count());
  await mkdir(artifacts, { recursive: true });
  await noOverflow('desktop result'); await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); }); await page.screenshot({ path: `${artifacts}/listening-1600.png`, fullPage: true });
  await page.locator('[data-action="reset"]').click(); assert.equal(await page.locator('#lt-q-1').inputValue(), ''); assert.equal(await page.locator('.lt-transcript').count(), 0);
  await page.route('**/scripts/fixtures/audio/part2.mp3', request => request.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'invalid audio fixture' }));
  await page.locator('[data-part="1"]').click(); await page.getByText('Chưa có audio cho phần này', { exact: true }).waitFor();
  await page.locator('[data-n="11"][value="B"]').check(); await page.locator('[data-action="submit"]').click(); assert.equal(await page.locator('.lt-score').innerText(), '1/40');
  await page.unroute('**/scripts/fixtures/audio/part2.mp3');
  await route('#/ielts-gt/listening/sample-listening?mode=exam');
  assert.equal(await page.locator('.lt-seek, .lt-speed, [data-jump], [data-action="play"]').count(), 0);
  assert.equal(await page.locator('audio').getAttribute('controls'), null);
  await page.locator('[data-action="start"]').click(); await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && !a.paused && a.currentTime > 0.15; });
  const anchor = await currentTime();
  await page.locator('audio').evaluate(a => { a.currentTime += 10; });
  await page.waitForTimeout(150); assert.ok((await currentTime()) < anchor + 1, 'exam restores forbidden seek');
  await page.locator('audio').evaluate(a => { a.playbackRate = 2; }); assert.equal(await page.locator('audio').evaluate(a => a.playbackRate), 1);
  await page.locator('audio').evaluate(a => a.pause()); await page.waitForTimeout(100); assert.equal(await page.locator('audio').evaluate(a => a.paused), false);
  const src = await page.locator('audio').getAttribute('src'); await page.locator('[data-part="2"]').click(); assert.equal(await page.locator('audio').getAttribute('src'), src);
  assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), true);
  acceptDialog = false;
  await page.locator('.lt-head a').click(); await page.waitForTimeout(100); assert.ok(page.url().includes('mode=exam')); assert.equal(await page.locator('audio').getAttribute('src'), src);
  acceptDialog = true;
  await page.clock.install();
  for (let i = 1; i <= 4; i++) {
    await page.locator('audio').evaluate(a => a.dispatchEvent(new Event('ended')));
    if (i < 4) await page.waitForFunction(part => document.querySelector('audio').src.includes(`part${part}.mp3`) && document.querySelector('audio').readyState >= 1, i + 1);
  }
  assert.match(await page.locator('.lt-timer').innerText(), /Thời gian kiểm tra lại: 2:00/);
  await page.clock.fastForward(120100); await page.locator('.lt-score').waitFor(); assert.equal(await page.locator('.lt-score').innerText(), '0/40');
  await page.clock.resume();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow('mobile result');
  await page.locator('.top-menu__btn').click(); await noOverflow('mobile dropdown');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); }); await page.screenshot({ path: `${artifacts}/listening-390.png`, fullPage: true });
  await route('#/home'); assert.equal(await page.locator('#page-content').innerText(), home);
  await noOverflow('mobile Markdown');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await noOverflow('360px dark Markdown');
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage disabled'); };
    Storage.prototype.setItem = () => { throw new Error('Storage disabled'); };
  });
  await page.reload();
  await route('#/ielts-gt/listening/sample-listening?mode=practice'); await page.locator('#lt-q-1').fill('Hollis');
  await page.locator('[data-action="submit"]').click(); assert.equal(await page.locator('.lt-score').innerText(), '1/40');
  assert.deepEqual(errors, [], `console/page errors: ${errors.join('\n')}`);
});
