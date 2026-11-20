import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { browserEngine, launchBrowser, webKitMobileOptions } from './helpers/browser.mjs';
import { serveFixture } from './helpers/static-server.mjs';

const home = '#/ielts-gt/listening';
const catalog = JSON.parse(await readFile(new URL('../content/ielts-gt/listening/index.json', import.meta.url), 'utf8'));
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

test('Listening methods navigation, playback, grading, retry, persistence and layout', { timeout: 150000 }, async t => {
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
  page.on('request', request => { if (request.url().includes('/practice.min.css')) stylesheetRequests.push(request.url()); });
  const css = page.locator('#practice-css');
  const score = page.locator('.practice-score');
  const nav = page.locator('#site-nav');
  const check = page.getByRole('button', { name: 'Kiểm tra' });
  const retry = page.getByRole('button', { name: 'Làm lại' });
  const audio = page.locator('.practice audio');
  async function go(part = '') {
    await page.goto(server.url + home + (part ? '/' + part : ''));
    const [methodId, exerciseId] = part.split('/');
    const method = catalog.methods.find(entry => entry.id === methodId);
    const heading = exerciseId ? method.exercises.find(entry => entry.id === exerciseId).title : method?.title ?? 'IELTS General · Listening';
    await page.getByRole('heading', { name: heading, level: 1, exact: true }).waitFor();
    await page.locator('main:not([aria-busy])').waitFor();
  }

  await go();
  await nav.locator('[aria-controls="gt-listening-practice-tests"]').waitFor();
  assert.equal(await page.locator('.lt-card').count(), 4);
  assert.equal(await nav.locator('.sidebar__groups > li > button').count(), 5);
  assert.equal(await css.count(), 0);
  assert.deepEqual(stylesheetRequests, []);
  for (const method of ['dictation', 'paraphrase', 'connected-speech', 'prediction']) {
    const disclosure = nav.locator(`[aria-controls="gt-listening-${method}"]`);
    await disclosure.click();
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'true');
    await nav.locator(`#gt-listening-${method}`).getByRole('link', { name: 'Giới thiệu' }).click();
    await page.locator('.practice-list').waitFor();
    assert.equal(await nav.locator(`[href="${home}/${method}"]`).getAttribute('aria-current'), 'page');
    assert.match(await css.getAttribute('href'), /practice\.min\.css\?v=\d+/);
    await go();
    assert.equal(await css.count(), 0);
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

  await go('dictation/everyday-tatoeba');
  await page.getByText('Nguồn và giấy phép audio').click();
  assert.equal(await page.locator('.practice-credits li').count(), 15);
  const artifacts = `test-artifacts/listening-methods/${browserEngine}`;
  await mkdir(artifacts, { recursive: true });
  await go('dictation/booking-details');
  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => localStorage.setItem('aec-theme', value), theme);
      await page.reload();
      await page.locator('.practice-audio').waitFor();
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
      await page.screenshot({ path: `${artifacts}/${width}-${theme}.png`, fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
});
