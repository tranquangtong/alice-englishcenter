import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { browserEngine, isWebKit, launchBrowser, webKitMobileOptions } from './helpers/browser.mjs';
import { serveFixture } from './helpers/static-server.mjs';

const artifacts = `test-artifacts/gt-nav/${browserEngine}`;

async function layoutPages(browser) {
  const desktop = await browser.newPage({ reducedMotion: 'reduce' });
  desktop.setDefaultTimeout(8000);
  if (!isWebKit) return { desktop, mobile: desktop };
  const mobile = await browser.newPage({
    reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, ...webKitMobileOptions
  });
  mobile.setDefaultTimeout(8000);
  return { desktop, mobile };
}
const hub = '#/ielts-gt';
const listening = `${hub}/listening`;
const catalog = JSON.parse(await readFile(new URL('../content/ielts-gt/listening/index.json', import.meta.url)));
const { tests } = catalog;
const practice = `${listening}/${tests[0].id}?mode=practice`;
const catalogPath = '**/content/ielts-gt/listening/index.json';

function measureNavigation() {
  const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
  const header = rect('.site-header');
  const brand = rect('.brand');
  const mark = rect('.brand-mark');
  const button = document.querySelector('.top-menu__btn');
  const pill = button.getBoundingClientRect().toJSON();
  const centerY = (pill.top + pill.bottom) / 2;
  const edges = [pill.left + .5, pill.right - .5];
  // Probe the four corners of the expanded hit area, beyond the visible gel face.
  const fullHitArea = [centerY - 21.5, centerY + 21.5].every(y =>
    edges.every(x => button.contains(document.elementFromPoint(x, y))));

  const sidebarEntries = [...document.querySelectorAll('#site-nav h2, #site-nav a, .sidebar__label, .sidebar__soon')];
  const boxes = sidebarEntries.map(entry => {
    const range = document.createRange();
    range.selectNodeContents(entry);
    return { label: entry.textContent.trim(), row: entry.getBoundingClientRect(), text: [...range.getClientRects()] };
  });
  const intersects = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
  const overlaps = [];
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) {
      if (intersects(a.row, b.row) || a.text.some(part => b.text.some(other => intersects(part, other)))) {
        overlaps.push([a.label, b.label]);
      }
    }
  }
  const controls = [...document.querySelectorAll('.brand, .menu-toggle, .theme-toggle, .top-menu__panel a, #site-nav a')]
    .filter(node => node.getClientRects().length)
    .map(node => ({ label: node.textContent.trim(), box: node.getBoundingClientRect().toJSON() }));
  return {
    header, brand, mark, pill, fullHitArea, overlaps, controls,
    toggle: rect('.menu-toggle'),
    theme: rect('.theme-toggle'),
    viewport: innerWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  };
}

function measureMenuIcon(button) {
  const icon = button.querySelector('.menu-toggle__icon');
  const face = button.getBoundingClientRect();
  const box = icon.getBoundingClientRect();
  return {
    backgroundImage: getComputedStyle(icon).backgroundImage,
    width: box.width,
    height: box.height,
    dx: (box.left + box.right - face.left - face.right) / 2,
    dy: (box.top + box.bottom - face.top - face.bottom) / 2
  };
}

async function tapStickyToggle(page, toggle) {
  // Use viewport coordinates so the input does not scroll the sticky header.
  const { x, y } = await toggle.evaluate(button => {
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  if (webKitMobileOptions.hasTouch) {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.click(x, y);
  }
}

test('Edge: compact GT header and route-specific sidebar at 1600, 390 and 360px', { timeout: 90000 }, async t => {
  const server = await serveFixture({ real: true });
  t.after(() => server.close());
  const browser = await launchBrowser({ timeout: 15000 });
  t.after(() => browser.close());
  const { desktop, mobile: phone } = await layoutPages(browser);
  await mkdir(artifacts, { recursive: true });
  const heading = (page, name) => page.getByRole('heading', { level: 1, name, exact: true });
  const pageErrors = [];
  for (const page of new Set([desktop, phone])) {
    page.on('pageerror', error => pageErrors.push(error.message));
  }

  for (const scheme of ['light', 'dark']) {
    for (const width of [1600, 390, 360]) {
      const mobile = width < 900;
      const page = mobile ? phone : desktop;
      const sidebar = page.locator('#site-nav');
      const active = sidebar.locator('[aria-current]');
      const practiceLink = sidebar.getByRole('link', { name: `Practice Tests ${tests.length}`, exact: true });
      const toggle = page.getByRole('button', { name: 'Danh mục học tập' });
      const gtButton = page.getByRole('button', { name: 'IELTS General', exact: true });
      const label = `${width}px ${scheme}`;
      await page.setViewportSize({ width, height: mobile ? 844 : 1000 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(server.url + '#/home', { timeout: 12000 });
      await heading(page, 'Học tiếng Anh, cùng nhau tiến bộ').waitFor();

      async function expectIcon(expanded) {
        const state = `${label} ${expanded ? 'close' : 'hamburger'} icon`;
        const size = expanded ? [16, 16] : [18, 14];
        const deadline = performance.now() + 1000;
        let icon = await toggle.evaluate(measureMenuIcon);
        while ((icon.width !== size[0] || icon.height !== size[1]) && performance.now() < deadline) {
          await delay(16);
          icon = await toggle.evaluate(measureMenuIcon);
        }
        assert.match(icon.backgroundImage, /linear-gradient/, state);
        assert.deepEqual([icon.width, icon.height], size, state);
        assert.ok(Math.abs(icon.dx) <= 1 && Math.abs(icon.dy) <= 1,
          `${state}: offset (${icon.dx}, ${icon.dy})`);
      }

      async function expectClosed() {
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false', label);
        assert.equal(await sidebar.isVisible(), false, label);
      }

      async function openSidebar() {
        if (mobile) {
          await expectClosed();
          assert.equal(await toggle.innerText(), '', `${label}: compact button label is visually hidden`);
          await expectIcon(false);
          const before = await page.locator('main').evaluate(node => ({
            mainTop: node.getBoundingClientRect().top,
            scroll: [window.scrollX, window.scrollY]
          }));
          await tapStickyToggle(page, toggle);
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true', label);
          await expectIcon(true);
          const panel = await sidebar.evaluate(node => {
            const style = getComputedStyle(node);
            const dropdown = getComputedStyle(document.querySelector('.top-menu__panel'));
            const glass = style => [style.backgroundColor, style.backdropFilter || style.webkitBackdropFilter];
            return {
              position: style.position,
              animationName: style.animationName,
              glass: glass(style),
              dropdownGlass: glass(dropdown),
              box: node.getBoundingClientRect().toJSON(),
              headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom,
              mainTop: document.querySelector('main').getBoundingClientRect().top,
              scroll: [window.scrollX, window.scrollY],
              viewportWidth: document.documentElement.clientWidth,
              viewportHeight: document.documentElement.clientHeight
            };
          });
          assert.deepEqual(panel.scroll, before.scroll, `${label}: opening scrolled the page`);
          assert.equal(panel.mainTop, before.mainTop, `${label}: opening shifted main content`);
          assert.equal(panel.position, 'fixed', label);
          assert.equal(panel.animationName, 'none', `${label}: reduced motion`);
          assert.deepEqual(panel.glass, panel.dropdownGlass, `${label}: menu glass`);
          assert.ok(
            panel.box.left >= 0 && panel.box.right <= panel.viewportWidth &&
            panel.box.top >= panel.headerBottom && panel.box.bottom <= panel.viewportHeight,
            `${label}: panel outside its viewport bounds`
          );
        } else {
          assert.equal(await sidebar.evaluate(node => getComputedStyle(node).position), 'sticky', label);
        }
        assert.ok(await sidebar.isVisible(), label);
      }

      async function inspect(state) {
        const context = `${label} ${state}`;
        await page.mouse.move(0, 0);
        await page.evaluate(() => window.scrollTo(0, 0));
        const sizes = await page.evaluate(measureNavigation);
        const center = box => (box.top + box.bottom) / 2;
        assert.ok(Math.abs(sizes.mark.height - sizes.pill.height) <= 4, context);
        assert.ok(Math.abs(center(sizes.mark) - center(sizes.pill)) <= 1, context);
        assert.ok(Math.abs(center(sizes.header) - center(sizes.pill)) <= 1, context);
        assert.ok(sizes.brand.right <= sizes.pill.left && sizes.pill.right <= sizes.header.right, context);
        if (mobile) {
          assert.ok(sizes.pill.right <= sizes.toggle.left && sizes.toggle.right <= sizes.header.right, context);
          assert.ok(Math.abs(center(sizes.toggle) - center(sizes.pill)) <= 1, context);
        }
        assert.ok(sizes.pill.width >= 44 && sizes.fullHitArea, `${context}: GT button hit area`);
        assert.ok(sizes.scrollWidth <= sizes.viewport, `${context}: horizontal overflow`);
        assert.deepEqual(sizes.overlaps, [], `${context}: overlapping sidebar entries`);
        for (const { label: control, box } of sizes.controls) {
          assert.ok(box.width >= 44 && box.height >= 44, `${context}: small target "${control}"`);
          assert.ok(box.left >= 0 && box.right <= sizes.viewport, `${context}: offscreen target "${control}"`);
        }
      }

      async function capture(route) {
        if (width !== 360) await page.screenshot({ path: `${artifacts}/${route}-${width}-${scheme}.png` });
      }

      async function expectCurrent(href, kind = 'page') {
        await sidebar.locator(`a[href="${href}"][aria-current="${kind}"]`).waitFor();
        assert.equal(await active.count(), 1, label);
      }

      await openSidebar();
      assert.equal(await sidebar.getAttribute('aria-label'), 'Tài liệu học tập', label);
      await sidebar.getByRole('heading', { name: 'Bắt đầu' }).waitFor();
      assert.equal(await sidebar.locator(`a[href="${hub}"]`).count(), 0, label);
      await expectCurrent('#/home');
      await inspect('home');
      await capture('home');

      // Open the dropdown by pressing the transparent portion of the target.
      const target = await gtButton.boundingBox();
      await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2 - 21);
      await page.getByRole('link', { name: 'Tổng quan IELTS General' }).waitFor();
      await inspect('dropdown');
      await page.getByRole('link', { name: 'Tổng quan IELTS General' }).click();
      await heading(page, 'IELTS General').waitFor();
      await openSidebar();
      assert.equal(await sidebar.getAttribute('aria-label'), 'Danh mục IELTS General', label);
      assert.equal(await sidebar.getByRole('heading', { name: 'Bắt đầu' }).count(), 0, label);
      await expectCurrent(hub);
      await practiceLink.waitFor();
      const sections = sidebar.locator('.sidebar__groups');
      assert.deepEqual(await sections.locator('a').evaluateAll(links => links.map(link => [
        link.getAttribute('href'), link.textContent.trim()
      ])), [
        [listening, `Practice Tests ${tests.length}`],
        ...catalog.methods.map(method => [`${listening}/${method.id}`, `${method.title} ${method.exercises.length}`])
      ], label);
      assert.equal(await sections.locator('button, ul, [aria-expanded]').count(), 0, label);
      for (const skill of ['Reading', 'Writing', 'Speaking']) {
        assert.match(await sidebar.locator('.sidebar__soon').filter({ hasText: skill }).innerText(), /Sắp ra mắt/, label);
        assert.equal(await sidebar.getByRole('link', { name: skill }).count(), 0, label);
      }
      await inspect('hub');
      await capture(mobile ? 'menu-open' : 'ielts-gt');
      if (mobile) {
        await practiceLink.focus();
        await page.keyboard.press('Escape');
        await expectClosed();
        assert.ok(await toggle.evaluate(el => el === document.activeElement), label);
        await openSidebar();
        if (isWebKit) await page.touchscreen.tap(6, 100);
        else await page.mouse.click(6, 100);
        await expectClosed();
        await openSidebar();
        await active.click(); // The current route has the same hash.
        await expectClosed();
        await openSidebar();
      }

      await practiceLink.press('Enter');
      await heading(page, 'IELTS General · Listening').waitFor();
      await openSidebar();
      await expectCurrent(listening);
      await inspect('list');
      await capture('list');
      if (mobile) await toggle.click();
      await page.locator(`.lt-card a[href="${practice}"]`).click();
      await heading(page, tests[0].title).waitFor();
      await openSidebar();
      await expectCurrent(listening, 'location');
      await inspect('practice');
      await capture('practice');
      if (mobile) await toggle.click();
      await page.locator('[data-action="submit"]').click();
      await page.locator('.lt-score').waitFor();
      await openSidebar();
      await expectCurrent(listening, 'location');
      await inspect('result');

      await page.evaluate(hash => { location.hash = hash; }, practice.replace('mode=practice', 'mode=exam'));
      await page.locator('.lt-mode--exam').waitFor();
      await openSidebar();
      await expectCurrent(listening, 'location');
      await inspect('exam');
      if (mobile) await toggle.click();
      await page.getByRole('link', { name: 'Danh sách bài thi' }).click();
      await heading(page, 'IELTS General · Listening').waitFor();
      await openSidebar();
      await expectCurrent(listening);
      await sidebar.getByRole('link', { name: /Danh mục học tập/ }).click();
      await heading(page, 'Học tiếng Anh, cùng nhau tiến bộ').waitFor();
      await openSidebar();
      await expectCurrent('#/home');
      assert.equal(await sidebar.getByRole('link', { name: 'IELTS General', exact: true }).count(), 0, label);
      await inspect('back home');
      if (mobile) await toggle.click();
    }
  }

  const page = desktop;
  const sidebar = page.locator('#site-nav');
  const gtButton = page.getByRole('button', { name: 'IELTS General', exact: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.route(catalogPath, route => route.fulfill({ status: 503 }), { times: 1 });
  const failedCatalog = page.waitForResponse(response => response.status() === 503 && response.url().endsWith('/listening/index.json'));
  await page.goto(`${server.url}?retry-catalog${hub}`);
  await failedCatalog;
  await heading(page, 'IELTS General').waitFor();
  assert.equal(await sidebar.locator('.sidebar__groups a').count(), 1);
  await sidebar.getByRole('link', { name: 'Practice Tests', exact: true }).click();
  await heading(page, 'IELTS General · Listening').waitFor();
  await sidebar.getByRole('link', { name: `Practice Tests ${tests.length}`, exact: true }).waitFor();
  await page.emulateMedia({ media: 'print' });
  assert.equal(await sidebar.isVisible(), false);
  assert.equal(await gtButton.isVisible(), false);
  assert.deepEqual(pageErrors, []);
});

test('Practice Tests stays a single flat link with an extended or legacy catalog', { timeout: 60000 }, async t => {
  const server = await serveFixture({ real: true });
  t.after(() => server.close());
  const browser = await launchBrowser({ timeout: 15000 });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
  const extraTests = Array.from({ length: 5 }, (_, index) => ({
    ...tests[0], id: `extra-${index}`, title: `Extra test ${index + 1}`
  }));
  const practiceTests = [...tests, ...extraTests];
  const groupedTest = { ...tests[0], id: 'dictation-01', title: 'Dictation 1', group: 'dictation' };
  const extended = {
    groups: [...catalog.groups, { id: 'dictation', title: 'Dictation' }],
    tests: [...practiceTests, groupedTest]
  };
  const sidebar = page.locator('#site-nav');
  for (const data of [extended, { tests }]) {
    await page.route(catalogPath, route => route.fulfill({ json: data }), { times: 1 });
    const testRoute = data === extended ? `${listening}/${groupedTest.id}` : practice;
    await page.goto(`${server.url}?tests=${data.tests.length}${testRoute}`);
    await page.getByRole('heading', { level: 1, name: tests[0].title }).waitFor();
    const sections = sidebar.locator('.sidebar__groups');
    const link = sections.getByRole('link', { name: `Practice Tests ${data.tests.length}`, exact: true });
    await link.waitFor();
    assert.equal(await sections.getByRole('link').count(), 1);
    assert.equal(await link.getAttribute('href'), listening);
    assert.equal(await link.getAttribute('aria-current'), 'location');
    await link.click();
    await page.getByRole('heading', { level: 1, name: 'IELTS General · Listening' }).waitFor();
    await page.getByRole('heading', { name: data.tests.at(-1).title, exact: true }).waitFor();
    assert.equal(await link.getAttribute('aria-current'), 'page');
  }
});

test('scrolled liquid glass header keeps its compact geometry over article text', { timeout: 60000 }, async t => {
  const server = await serveFixture({ real: true });
  t.after(() => server.close());
  const browser = await launchBrowser({ timeout: 15000 });
  t.after(() => browser.close());
  const { desktop, mobile: phone } = await layoutPages(browser);
  await mkdir(artifacts, { recursive: true });

  for (const scheme of ['light', 'dark']) {
    for (const width of [1600, 390, 360]) {
      const mobile = width < 900;
      const page = mobile ? phone : desktop;
      const paragraph = page.locator('#page-content > p').first();
      const label = `${width}px ${scheme}`;
      await page.setViewportSize({ width, height: mobile ? 844 : 1000 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(server.url + '#/syllabus', { timeout: 12000 });
      await page.getByRole('heading', { level: 1, name: /^Lộ trình Tổng quan Ôn thi IELTS/ }).waitFor();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const before = await page.evaluate(measureNavigation);
      const overArticle = await paragraph.evaluate(node => {
        const header = document.querySelector('.site-header');
        const initial = header.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        const firstLine = range.getClientRects()[0];
        window.scrollBy({ top: firstLine.top - initial.top - 12, behavior: 'instant' });

        const box = header.getBoundingClientRect();
        const style = getComputedStyle(header);
        return {
          scrollY: window.scrollY,
          top: box.top,
          offset: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
          hasTextBehind: [...range.getClientRects()].some(line =>
            line.top >= box.top && line.bottom <= box.bottom && line.left < box.right && line.right > box.left),
          supportsFilter: CSS.supports('backdrop-filter', 'blur(1px)') ||
            CSS.supports('-webkit-backdrop-filter', 'blur(1px)'),
          filter: style.backdropFilter || style.webkitBackdropFilter
        };
      });
      const after = await page.evaluate(measureNavigation);
      assert.ok(overArticle.scrollY > 0 && overArticle.hasTextBehind, `${label}: article text behind header`);
      assert.ok(Math.abs(overArticle.top - before.header.top) < 1, `${label}: sticky top`);
      // Preserve the pre-restyle dimensions at the default 16px root size.
      assert.ok(Math.abs(overArticle.offset - (mobile ? 76 : 94.4)) < .1, `${label}: header offset`);
      assert.ok(Math.abs(after.header.height - (mobile ? 58.8 : 54.4)) < .1, `${label}: header height`);
      for (const key of ['header', 'brand', 'mark', 'pill', 'toggle', 'theme']) {
        assert.equal(after[key].width, before[key].width, `${label}: ${key} width after scroll`);
        assert.equal(after[key].height, before[key].height, `${label}: ${key} height after scroll`);
      }
      const markSize = mobile ? 32 : 36;
      assert.equal(after.mark.height, markSize, `${label}: brand mark height`);
      assert.equal(after.pill.height, markSize, `${label}: GT button face height`);
      assert.equal(after.brand.height, 44, `${label}: brand link height`);
      assert.equal(after.theme.height, 44, `${label}: theme control height`);
      assert.ok(after.pill.width >= 44 && after.fullHitArea, `${label}: GT button hit area`);
      for (const { label: control, box } of after.controls) {
        assert.ok(box.width >= 44 && box.height >= 44, `${label}: small target "${control}"`);
      }
      if (mobile) {
        assert.equal(after.toggle.width, 44, `${label}: menu control width`);
        assert.equal(after.toggle.height, 44, `${label}: menu control height`);
        assert.equal(after.theme.width, 44, `${label}: theme control width`);
      }
      if (overArticle.supportsFilter) {
        const blur = Number(/\bblur\(([\d.]+)px\)/.exec(overArticle.filter)?.[1]);
        assert.ok(blur >= 2 && blur <= 3, `${label}: expected blur between 2px and 3px, got ${overArticle.filter}`);
      }
      if (width !== 360) await page.screenshot({ path: `${artifacts}/scrolled-header-${width}-${scheme}.png` });
      if (mobile) {
        const toggle = page.getByRole('button', { name: 'Danh mục học tập' });
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false', `${label}: menu starts closed`);
        await tapStickyToggle(page, toggle);
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true', `${label}: menu opened`);
        assert.equal(await page.evaluate(() => window.scrollY), overArticle.scrollY, `${label}: opening over article text scrolled the page`);
        await page.keyboard.press('Escape');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false', `${label}: menu closed before next viewport`);
      }
    }
  }
});
