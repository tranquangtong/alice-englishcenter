import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { browserEngine, launchBrowser, webKitMobileOptions } from './helpers/browser.mjs';
import { serveFixture } from './helpers/static-server.mjs';

const home = '#/ielts-gt/listening';
const catalog = JSON.parse(await readFile(new URL('../content/ielts-gt/listening/index.json', import.meta.url), 'utf8'));
const methods = await Promise.all(catalog.methods.map(async method => ({
  ...method,
  exercises: JSON.parse(await readFile(new URL(`../${method.file}`, import.meta.url), 'utf8'))
})));
const cases = [
  ['dictation/booking-details', { surname: ' CLARKE ', phone: 'oh seven double two six one five' }],
  ['dictation/office-gap', { place: 'Reception Desk!' }],
  ['dictation/workplace-sentence', { sentence: 'We checked the spare keys before the new team arrived.' }],
  ['paraphrase/booking-change', { day: 'Tuesday', pivot: 'Actually' }, true],
  ['paraphrase/parking-rule', { meaning: 'Employees may park at the back after 6 p.m.' }, true],
  ['paraphrase/pickup-point', { location: 'The room next to the staff kitchen' }, true],
  ['connected-speech/count-the-words', { count: 'five' }],
  ['connected-speech/weak-have', { modal: 'must’ve' }],
  ['connected-speech/teen-or-ty', { number: '14' }, true],
  ['connected-speech/word-endings', { plural: 'badges', past: 'walked' }, true],
  ['prediction/training-signup', { places: 'fourteen', 'booking-name': 'Clarke' }]
];

test('Listening methods navigation, playback, grading, retry, persistence and layout', { timeout: 240000 }, async t => {
  const server = await serveFixture({ real: true });
  t.after(() => server.close());
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce', ...webKitMobileOptions });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  const stylesheetRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (request.url().includes('/practice.min.css')) stylesheetRequests.push(request.url()); });
  const css = page.locator('#practice-css');
  const score = page.locator('.practice-score');
  const nav = page.locator('#site-nav');
  const check = page.getByRole('button', { name: 'Kiểm tra' });
  const retry = page.getByRole('button', { name: 'Làm lại' });
  const audio = page.locator('.practice audio');
  const back = page.getByRole('link', { name: 'Về trang giới thiệu' });
  const next = page.getByRole('link', { name: 'Bài tiếp theo →' });
  const choose = page.getByRole('link', { name: 'Chọn bài khác' });
  const methodLink = id => nav.locator(`a[href="${home}/${id}"]`);
  async function go(part = '') {
    await page.goto(server.url + home + (part ? '/' + part : ''));
    const [methodId, exerciseId] = part.split('/');
    const method = catalog.methods.find(entry => entry.id === methodId);
    const heading = exerciseId ? method.exercises.find(entry => entry.id === exerciseId).title : method?.title ?? 'IELTS General · Listening';
    await page.getByRole('heading', { name: heading, level: 1, exact: true }).waitFor();
    await page.locator('main:not([aria-busy])').waitFor();
  }

  await go();
  await nav.locator(`a[href="${home}"] small`).waitFor();
  assert.equal(await page.locator('.lt-card').count(), catalog.tests.length);
  assert.equal(await nav.locator('.sidebar__groups > li > a').count(), methods.length + 1);
  assert.equal(await css.count(), 0);
  assert.deepEqual(stylesheetRequests, []);
  for (const method of methods) {
    const link = methodLink(method.id);
    assert.equal(await link.textContent(), `${method.title} ${method.exercises.length}`);
    await link.click();
    await page.locator('.practice-list').waitFor();
    assert.equal(await link.getAttribute('aria-current'), 'page');
    assert.match(await css.getAttribute('href'), /practice\.min\.css\?v=\d+/);
    await go();
    assert.equal(await css.count(), 0);
  }

  for (const method of methods) {
    await go(method.id);
    for (const exercise of method.exercises) {
      const route = `${method.id}/${exercise.id}`;
      assert.equal(await nav.locator(`[href="${home}/${route}"]`).count(), 0);
      const card = page.locator(`.practice-list a[href="${home}/${route}"]`);
      await card.waitFor();
      assert.ok((await card.innerText()).includes(exercise.level), route);
    }
    for (const [index, exercise] of method.exercises.entries()) {
      const route = `${method.id}/${exercise.id}`;
      await go(route);
      await methodLink(method.id).and(nav.locator('[aria-current="location"]')).waitFor();
      assert.equal(await nav.locator('[aria-current]').count(), 1);
      assert.equal(await back.getAttribute('href'), `${home}/${method.id}`);
      assert.equal(await next.count(), 0);
      const items = exercise.clips.flatMap(clip => clip.items);
      if (method.id === 'prediction') {
        for (const item of items) await page.locator(`#practice-${item.id}`).selectOption(item.expectedType);
        await page.getByRole('button', { name: 'Sang bước nghe' }).click();
      }
      assert.deepEqual(await audio.evaluateAll(players => players.map(player => player.getAttribute('src'))),
        exercise.clips.map(clip => clip.audio), route);
      await audio.evaluateAll(players => {
        for (const player of players) {
          player.preload = 'metadata';
          player.load();
        }
      });
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.practice audio')).every(player =>
        player.error || (player.readyState >= HTMLMediaElement.HAVE_METADATA && Number.isFinite(player.duration))));
      const broken = await audio.evaluateAll(players => players.filter(player => player.error || player.duration <= 0).map(player => player.src));
      assert.deepEqual(broken, [], route);
      await check.click();
      assert.ok((await score.innerText()).endsWith(`Đáp án đúng 0/${items.length}`), route);
      assert.equal(await choose.getAttribute('href'), `${home}/${method.id}?section=bai-luyen`);
      const following = method.exercises[index + 1];
      if (following) assert.equal(await next.getAttribute('href'), `${home}/${method.id}/${following.id}`);
      else assert.equal(await next.count(), 0);
      await retry.click();
    }
  }

  for (const [route, answers, choice] of cases) {
    await go(route);
    const prediction = route.startsWith('prediction');
    if (prediction) {
      assert.equal(await audio.count(), 0);
      await page.getByRole('button', { name: 'Sang bước nghe' }).click();
      assert.equal(await audio.count(), 0);
      await page.locator('#practice-places').selectOption('number');
      await page.locator('#practice-booking-name').selectOption('noun');
      await page.locator('#practice-places-guess').fill('20');
      await page.getByRole('button', { name: 'Sang bước nghe' }).click();
    }
    if (route === 'dictation/booking-details') {
      assert.equal(await page.locator('.practice-transcript').count(), 0);
      await page.getByRole('button', { name: 'Gợi ý ký tự đầu' }).first().click();
      assert.match(await page.locator('.practice-hint').first().innerText(), /“C”/);
      await page.locator('[data-speed]').selectOption('0.85');
      await page.getByRole('button', { name: 'Phát / Tạm dừng' }).click();
      await page.waitForFunction(() => document.querySelector('.practice audio').currentTime > .2);
      assert.equal(await audio.evaluate(el => el.playbackRate), .85);
      await page.getByRole('button', { name: 'Nghe lại từ đầu' }).click();
      await page.waitForFunction(() => {
        const player = document.querySelector('.practice audio');
        return !player.paused && player.currentTime < 1;
      });
    }
    for (const [item, value] of Object.entries(answers)) {
      const field = page.locator(`[data-question="${item}"]`);
      if (choice) await field.getByRole('radio', { name: value, exact: true }).check();
      else await field.getByRole('textbox').fill(value);
    }
    if (route === 'dictation/workplace-sentence') {
      const field = page.getByRole('textbox');
      await field.fill('We check the spare keys before the new team arrived.');
      await check.click();
      assert.match(await score.innerText(), /Đáp án đúng 0\/1/);
      assert.match(await page.locator('.practice-diff ins').innerText(), /checked/);
      assert.match(await page.locator('.practice-diff del').innerText(), /check/);
      await retry.click();
      await field.fill(Object.values(answers)[0]);
    }
    await check.click();
    const total = Object.keys(answers).length;
    const expected = `${prediction ? 'Dự đoán đúng 1/2 · ' : ''}Đáp án đúng ${total}/${total}`;
    assert.equal(await score.innerText(), expected, route);
    if (route.includes('pickup-point')) {
      assert.equal(await page.locator('.practice-mark--answer').count(), 1);
      assert.equal(await page.locator('.practice-mark--distractor').count(), 1);
    }
    await page.reload();
    await retry.waitFor();
    assert.equal(await score.innerText(), expected, route);
    await retry.click();
    if (prediction) {
      assert.equal(await audio.count(), 0);
      assert.equal(await page.locator('#practice-places').inputValue(), '');
    } else if (choice) {
      assert.equal(await page.locator('.practice input:checked').count(), 0);
    } else {
      assert.equal(await page.getByRole('textbox').first().inputValue(), '');
    }
  }

  await go('dictation/office-gap');
  await page.getByRole('textbox').fill('Reception');
  await page.reload();
  await page.getByRole('textbox').waitFor();
  assert.equal(await page.getByRole('textbox').inputValue(), 'Reception');
  await go('dictation');
  assert.match(await page.locator('.practice-list a[href$="/office-gap"]').innerText(), /Đang làm/);

  await go('dictation/everyday-tatoeba');
  await page.getByText('Nguồn và giấy phép audio').click();
  assert.equal(await page.locator('.practice-credits li').count(), 15);
  const artifacts = `test-artifacts/listening-methods/${browserEngine}`;
  await mkdir(artifacts, { recursive: true });
  await go('dictation/booking-details');
  await page.locator('.practice-text').first().fill('Clark');
  await check.click();
  await page.locator('.practice-diff del').waitFor();
  const dictation = methods.find(method => method.id === 'dictation');
  const following = dictation.exercises[dictation.exercises.findIndex(entry => entry.id === 'booking-details') + 1];
  await next.click();
  await page.getByRole('heading', { level: 1, name: following.title, exact: true }).waitFor();
  await back.click();
  await page.locator('.practice-list').waitFor();
  assert.equal(new URL(page.url()).hash, `${home}/dictation`);
  assert.equal(await methodLink('dictation').getAttribute('aria-current'), 'page');
  assert.match(await page.locator('.practice-list a[href$="/booking-details"]').innerText(), /Đã kiểm tra/);
  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      await go('dictation');
      await page.evaluate(value => localStorage.setItem('aec-theme', value), theme);
      await page.reload();
      await page.locator('.practice-list').waitFor();
      await page.waitForFunction(() => Boolean(document.querySelector('#practice-css')?.sheet));
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      const hubFits = await page.locator('.practice-list a').evaluateAll(cards => cards.every(card => {
        const { left, right, height } = card.getBoundingClientRect();
        return left >= 0 && right <= innerWidth && height >= 44;
      }) && document.documentElement.scrollWidth <= innerWidth);
      assert.ok(hubFits, `Hub layout at ${width}px in ${theme}`);
      await page.screenshot({ path: `${artifacts}/hub-${width}-${theme}.png`, fullPage: true });
      await go('dictation/booking-details');
      await page.locator('.practice-audio').waitFor();
      await page.locator('.practice-diff del').waitFor();
      await page.waitForFunction(() => Boolean(document.querySelector('#practice-css')?.sheet));
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      const layout = await page.locator('.practice').evaluate(section => {
        const play = section.querySelector('[data-practice-action="play"]').getBoundingClientRect();
        const answer = section.querySelector('.practice-text').getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          playHeight: play.height,
          answerHeight: answer.height,
          playBeforeAnswer: play.bottom <= answer.top,
          answerFits: answer.left >= 0 && answer.right <= innerWidth
        };
      });
      assert.ok(layout.documentWidth <= layout.viewport && layout.playHeight >= 44 && layout.answerHeight >= 44
        && layout.playBeforeAnswer && layout.answerFits, JSON.stringify({ width, theme, layout }));
      await page.screenshot({ path: `${artifacts}/feedback-${width}-${theme}.png`, fullPage: true });
      for (const link of [back, next, choose]) {
        const box = await link.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width,
          `Exercise link layout at ${width}px in ${theme}`);
      }
      if (width === 390) {
        const toggle = page.getByRole('button', { name: 'Danh mục học tập' });
        await toggle.click();
        await methodLink('dictation').waitFor();
        assert.equal(await methodLink('dictation').getAttribute('aria-current'), 'location');
        await methodLink('paraphrase').click();
        await page.getByRole('heading', { level: 1, name: methods.find(method => method.id === 'paraphrase').title }).waitFor();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await nav.isVisible(), false);
        await go('dictation/booking-details');
      }
      await choose.click();
      const listHeading = page.getByRole('heading', { name: 'Bài luyện', exact: true });
      await listHeading.waitFor();
      await page.locator('#bai-luyen:focus').waitFor();
      assert.equal(new URL(page.url()).hash, `${home}/dictation?section=bai-luyen`);
      assert.equal(await methodLink('dictation').getAttribute('aria-current'), 'page');
      assert.ok(await listHeading.evaluate(heading => {
        const box = heading.getBoundingClientRect();
        const header = document.querySelector('.site-header').getBoundingClientRect();
        return box.top >= header.bottom - 1 && box.bottom <= innerHeight;
      }), `Exercise list anchor visible at ${width}px in ${theme}`);
    }
  }
  assert.deepEqual(errors, []);
});
