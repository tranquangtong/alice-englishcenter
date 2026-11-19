import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serveFixture } from './helpers/static-server.mjs';

// Conservative glass approximation: composite computed background colours and
// gradient stops through every ancestor, including the gel's white sheen.
// Keep both sky extremes (plus white clouds in light mode). Blur/saturation and
// inset shadows are not rasterised, so the report records an approximation.
function inspect() {
  const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const rgb = value => {
    const numbers = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
    return [...numbers.slice(0, 3), numbers[3] ?? 1];
  };
  const hex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)).concat(1);
  const colours = value => (value.match(/rgba?\([^)]+\)|#[\da-f]{6}/gi) || []).map(c => c[0] === '#' ? hex(c) : rgb(c));
  const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3])).concat(1);
  const luminance = c => c.slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((s, n, i) => s + n * [.2126, .7152, .0722][i], 0);
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  const root = getComputedStyle(document.documentElement);
  function contrast(el) {
    let bgs = ['--sky-top', '--sky-mid', '--sky-bottom'].map(token => hex(root.getPropertyValue(token).trim()));
    if (!matchMedia('(prefers-color-scheme: dark)').matches) bgs.push([255, 255, 255, 1]);
    const ancestors = []; for (let n = el; n && n !== document.body; n = n.parentElement) ancestors.unshift(n);
    for (const n of ancestors) {
      const style = getComputedStyle(n);
      bgs = bgs.map(bg => over(rgb(style.backgroundColor), bg));
      const stops = colours(style.backgroundImage);
      if (stops.length) bgs = bgs.flatMap(bg => stops.map(stop => over(stop, bg)));
      // The extrema bound the gradients used in these components.
      bgs.sort((a, b) => luminance(a) - luminance(b)); bgs = [bgs[0], bgs.at(-1)];
    }
    const sheen = getComputedStyle(el, '::before');
    // A gloss cap above the label cannot affect its contrast. Bound the label
    // with actual text ranges (or the centered pseudo label on compact buttons).
    const ranges = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()).flatMap(n => {
      const range = document.createRange(); range.selectNodeContents(n);
      return [...range.getClientRects()].filter(r => r.height > 0).map(r => r.top - el.getBoundingClientRect().top);
    });
    const fontSize = parseFloat(getComputedStyle(el).fontSize) || parseFloat(getComputedStyle(el, '::after').fontSize);
    const textTop = ranges.length ? Math.min(...ranges) : (el.getBoundingClientRect().height - fontSize * 1.2) / 2;
    const sheenBottom = parseFloat(sheen.top) + parseFloat(sheen.height);
    if (el.matches('.aero-btn, .menu-toggle') && sheen.display !== 'none' && sheen.opacity !== '0' && sheenBottom >= textTop) {
      bgs = bgs.flatMap(bg => [bg, ...colours(sheen.backgroundImage).map(c => over(c, bg))]);
    }
    const fg = rgb(getComputedStyle(el).color);
    const worst = bgs.map(bg => ({ ratio: ratio(over(fg, bg), bg), background: bg })).sort((a, b) => a.ratio - b.ratio)[0];
    return { selector: el.className || el.tagName, text: el.textContent.trim().slice(0, 65), foreground: fg, ...worst };
  }
  const header = document.querySelector('.site-header').getBoundingClientRect();
  const heading = document.querySelector('#page-content h1').getBoundingClientRect();
  const bar = document.querySelector('.lt-audio')?.getBoundingClientRect();
  const controls = [...document.querySelectorAll('.site-header a, .site-header button, #page-content a, #page-content button, #page-content input:not(:disabled), #page-content select')].filter(visible);
  const targets = controls.map(el => {
    const target = el.matches('[type="checkbox"], [type="radio"]') ? el.closest('label') : el;
    const r = target.getBoundingClientRect();
    return { text: el.textContent.trim().slice(0, 40) || el.getAttribute('aria-label'), width: r.width, height: r.height };
  });
  const text = [...document.querySelectorAll('.site-header button, .top-menu__panel a, #page-content p, #page-content label, #page-content legend, #page-content a, #page-content button, .lt-distractors strong, .lt-transcript strong, mark.lt-hl')].filter(el => visible(el) && el.textContent.trim()).map(contrast);
  return {
    viewport: innerWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    header: header.toJSON(), heading: heading.toJSON(), audio: bar?.toJSON(),
    audioOffset: bar ? parseFloat(getComputedStyle(document.querySelector('.lt-audio')).top) : null,
    headerControls: [...document.querySelectorAll('.site-header > *, .top-menu__btn')].filter(visible).map(el => el.getBoundingClientRect().toJSON()),
    smallTargets: targets.filter(r => r.width < 43.9 || r.height < 43.9),
    minTarget: { width: Math.min(...targets.map(r => r.width)), height: Math.min(...targets.map(r => r.height)) },
    contrast: text, minContrast: Math.min(...text.map(t => t.ratio))
  };
}

test('Edge: final Aero QA, both schemes and widths, sticky player and accessible names', { timeout: 180000 }, async t => {
  const server = await serveFixture({ real: true });
  const profile = await mkdtemp(path.join(tmpdir(), 'alice-listening-final-'));
  let context;
  t.after(async () => { await context?.close(); await server.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });
  context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true, args: ['--no-sandbox'], reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const report = [], printReport = [], failures = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('test-artifacts/final', { recursive: true });
  async function route(hash) {
    await page.goto(server.url + hash); await page.locator('main:not([aria-busy])').waitFor();
    await page.locator('#page-content h1').waitFor();
  }
  const check = (condition, message) => { if (!condition) failures.push(message); };
  async function capture(label, { scrolled = false, dropdown = false } = {}) {
    const measurement = await page.evaluate(inspect);
    const name = `${label}-${measurement.viewport}-${await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')}`;
    report.push({ name, ...measurement });
    check(measurement.scrollWidth <= measurement.viewport, `${name}: overflow`);
    check(!measurement.smallTargets.length, `${name}: small targets ${JSON.stringify(measurement.smallTargets)}`);
    check(measurement.minContrast >= 4.5, `${name}: contrast ${measurement.minContrast.toFixed(2)} ${JSON.stringify(measurement.contrast.filter(c => c.ratio < 4.5))}`);
    if (!scrolled) check(measurement.heading.top >= measurement.header.bottom, `${name}: heading covered`);
    check(measurement.headerControls.every(r => r.top >= measurement.header.top - 1 && r.bottom <= measurement.header.bottom + 1), `${name}: header row`);
    if (scrolled) {
      check(measurement.audio.top >= measurement.header.bottom, `${name}: audio overlaps header`);
      check(Math.abs(measurement.audio.top - measurement.audioOffset) < 2, `${name}: audio is not sticky`);
    }
    if (measurement.viewport === 390 && measurement.audio) check(measurement.audio.height <= 844 * .4, `${name}: audio too tall`);
    await page.screenshot({ path: `test-artifacts/final/${name}.png`, fullPage: !scrolled && !dropdown });
  }
  const data = JSON.parse(await readFile(new URL('../content/ielts-gt/listening/gt-l-01.json', import.meta.url)));
  const external = JSON.parse(await readFile(new URL('../content/ielts-gt/listening/external.json', import.meta.url)));
  for (const colorScheme of ['light', 'dark']) for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await route('#/ielts-gt'); await capture('hub');
    for (const name of ['IELTS General', ...(width === 390 ? ['Danh mục học tập'] : [])]) {
      const button = page.getByRole('button', { name, exact: true });
      check(await button.count() === 1 && await button.isVisible(), `${width}-${colorScheme}: accessible button ${name}`);
    }
    await page.getByRole('button', { name: 'IELTS General', exact: true }).click();
    await capture('dropdown', { dropdown: true });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const focus = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { visible: document.activeElement.matches(':focus-visible'), style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
    check(focus.visible && focus.style !== 'none' && focus.width >= 2, `${width}-${colorScheme}: focus outline ${JSON.stringify(focus)}`);
    const motion = await page.evaluate(() => [...document.querySelectorAll('*')].flatMap(el => ['', '::before', '::after'].map(p => { const s = getComputedStyle(el, p || null); return { name: s.animationName, duration: parseFloat(s.animationDuration), transition: parseFloat(s.transitionDuration) }; })).filter(s => (s.name !== 'none' && s.duration > .001) || s.transition > .001));
    check(!motion.length, `${width}-${colorScheme}: reduced motion`);
    await route('#/ielts-gt/listening');
    for (const [i, site] of external.sites.entries()) {
      const note = page.locator('.lt-list > section').nth(i).locator(':scope > p');
      if (site.note) assert.equal(await note.textContent(), site.note);
      else assert.equal(await note.count(), 0);
    }
    await capture('list');
    await route('#/ielts-gt/listening/gt-l-01?mode=practice'); await capture('practice');
    await page.evaluate(() => window.scrollTo(0, 700)); await capture('practice-scrolled', { scrolled: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('#lt-q-1').fill(data.parts[0].groups[0].questions[0].answer[0]);
    await page.locator('[data-action="submit"]').click();
    assert.match(await page.locator('.lt-q--correct .lt-feedback > p').first().innerText(), /^✓ Đúng/);
    assert.match(await page.locator('.lt-q--wrong .lt-feedback > p').first().innerText(), /^✗ Chưa đúng/);
    await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); }); await capture('result');
    await page.locator('.lt-result').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-artifacts/final/result-score-${width}-${colorScheme}.png` });
    await route('#/ielts-gt/listening/gt-l-01?mode=exam'); await capture('exam');
    if (width === 390) {
      await page.setViewportSize({ width: 360, height: 800 });
      for (const hash of ['#/ielts-gt', '#/ielts-gt/listening', '#/ielts-gt/listening/gt-l-04?mode=practice']) {
        await route(hash);
        const narrow = await page.evaluate(inspect);
        check(narrow.scrollWidth <= 360 && !narrow.smallTargets.length, `360-${colorScheme}: ${hash} overflow/targets`);
      }
      await page.locator('#lt-q-1').fill('wrong');
      await page.locator('[data-action="submit"]').click();
      await page.emulateMedia({ media: 'print' });
      const print = await page.evaluate(() => ({
        scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
        audioHidden: getComputedStyle(document.querySelector('.lt-audio')).display === 'none',
        tableVisible: !!document.querySelector('.lt-table').getClientRects().length,
        surfaces: [...document.querySelectorAll('main, .lt-result, .lt-band, .lt-feedback > p:first-child, .lt-instructions, .lt-mode--practice, .lt-progress')].map(el => ({ selector: el.className || el.tagName, colour: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, image: getComputedStyle(el).backgroundImage }))
      }));
      printReport.push(print);
      check(print.audioHidden && print.tableVisible, `${colorScheme}: print hides player and retains table`);
      check(print.surfaces.every(s => s.colour === 'rgb(0, 0, 0)' && s.background === 'rgb(255, 255, 255)' && s.image === 'none'), `${colorScheme}: print surfaces ${JSON.stringify(print.surfaces)}`);
      await page.emulateMedia({ media: 'screen' });
    }
  }
  // Optional note: absent sites have no empty paragraph; hostile text is escaped.
  await page.route('**/external.json', route => route.fulfill({ json: { sites: [
    { site: 'No note', home: 'https://example.com', tests: [] },
    { site: 'Escaped note', home: 'https://example.com', tests: [], note: '<img src=x onerror="alert(1)">' }
  ] } }));
  await route('#/ielts-gt/listening');
  assert.equal(await page.locator('.lt-list > section').nth(0).locator(':scope > p').count(), 0);
  assert.equal(await page.locator('.lt-list > section').nth(1).locator(':scope > p').innerText(), '<img src=x onerror="alert(1)">');
  assert.equal(await page.locator('.lt-list > section img').count(), 0);
  await writeFile('test-artifacts/final/measurements.json', JSON.stringify({ approximation: 'Computed gradient-stop extrema and alpha compositing; glass blur/saturation and inset shadows not rasterised. Light includes white cloud and sky extremes; dark uses navy/teal extremes. Gloss caps above actual text bounds do not affect label contrast.', report, printReport, failures, errors }, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
});
