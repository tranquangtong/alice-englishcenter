import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { normalize, withinLimit, grade, progress, bandFor, validateTest, validateExternal, safePath, GROUP_TYPES } from '../assets/js/listening-core.js';
const fixture = JSON.parse(await readFile(new URL('../scripts/fixtures/sample-listening.json', import.meta.url)));
const clone = () => structuredClone(fixture);

test('normalization permits case, whitespace, a final full stop and number commas', () => {
  assert.equal(normalize('  HoLLis.  '), 'hollis');
  assert.equal(normalize('  River   bank. '), 'river bank');
  assert.equal(normalize('1,200,000'), '1200000');
  assert.notEqual(normalize('river-bank'), normalize('river bank'));
  assert.equal(normalize(null), '');
});
test('word limits allow an optional single number, but reject extra words/numbers', () => {
  const group = { type: 'form', wordLimit: 1, allowNumber: true };
  assert.ok(withinLimit('12 river', group));
  assert.ok(withinLimit('1,200', group));
  assert.ok(!withinLimit('river bank', group));
  assert.ok(withinLimit('12 13', group));
  assert.ok(!withinLimit('12 river 13', group));
  assert.ok(!withinLimit('12 river', { ...group, allowNumber: false }));
});

test('numeric runs count as one number and spaced phone variants grade both ways', () => {
  const group = { type: 'form', wordLimit: 1, allowNumber: true };
  for (const value of ['07492 618305', '07492-618305', '07492 - 618305', '1.25', '1,200', '1, 200', '09:30', '09 : 30', '15/03', '15 March']) assert.ok(withinLimit(value, group), value);
  assert.ok(!withinLimit('07492 618305', { ...group, allowNumber: false }));
  assert.ok(!withinLimit('15 March 2026', group));
  assert.ok(!withinLimit('07492 river bank', group));
  for (const [accepted, given] of [['07492 618305', '07492618305'], ['07492618305', '07492 618305']]) {
    const sample = clone();
    Object.assign(sample.parts[0].groups[0], group);
    sample.parts[0].groups[0].questions[0].answer = [accepted];
    assert.deepEqual(validateTest(sample), []);
    assert.ok(grade(sample, { 1: given }).questions[1].correct);
    assert.ok(!grade(sample, { 1: '07492 618306' }).questions[1].correct);
  }
  const sample = clone();
  sample.parts[0].groups[0].questions[0].answer = ['1200'];
  assert.ok(grade(sample, { 1: '1, 200' }).questions[1].correct);
});
test('accepted variants score, blanks and excessive answers do not', () => {
  const sample = clone(); sample.parts[0].groups[0].questions[0].answer.push('Hollins');
  const result = grade(sample, { 1: ' hollins. ', 2: 'wrong', 3: '1,200', 4: 'green green', 7: 'b' });
  assert.equal(result.score, 3); assert.equal(result.band, 2);
  assert.ok(result.questions[1].correct); assert.ok(!result.questions[4].correct);
});
test('multi choices score once per unique correct letter, in either order', () => {
  assert.equal(grade(fixture, { 9: ['B', 'A'] }).score, 2);
  assert.equal(grade(fixture, { 9: ['A', 'C'] }).score, 1);
  assert.equal(grade(fixture, { 9: ['A', 'A'] }).score, 1);
  assert.equal(grade(fixture, { 9: ['A', 'B', 'C'] }).score, 0);
  assert.equal(grade(fixture, { 9: 'A' }).score, 0);
  assert.equal(progress(fixture, { 1: 'Hollis', 9: ['A', 'B'] }), 3);
});
test('all 40 fixture answers can earn band 9', () => {
  const answers = {};
  for (const part of fixture.parts) for (const group of part.groups) {
    if (group.type === 'mcq-multi') answers[group.questions[0].n] = group.questions[0].answer;
    else for (const q of group.questions) answers[q.n] = q.answer[0];
  }
  assert.equal(grade(fixture, answers).score, 40); assert.equal(grade(fixture, answers).band, 9);
});
test('band table has every specified boundary', () => {
  const bands = [[0, 3, 2], [4, 5, 2.5], [6, 7, 3], [8, 9, 3.5], [10, 12, 4], [13, 15, 4.5], [16, 17, 5], [18, 22, 5.5], [23, 25, 6], [26, 29, 6.5], [30, 31, 7], [32, 34, 7.5], [35, 36, 8], [37, 38, 8.5], [39, 40, 9]];
  for (const [low, high, band] of bands) for (let score = low; score <= high; score++) assert.equal(bandFor(score), band, `score ${score}`);
});
test('fixture validates and covers every question group', () => {
  assert.deepEqual(validateTest(fixture, { imageExists: existsSync }), []);
  assert.deepEqual(new Set(fixture.parts.flatMap(p => p.groups.map(g => g.type))), new Set(GROUP_TYPES));
});
const invalidCases = [
  ['4 parts', sample => sample.parts.pop(), /4 parts/],
  ['duplicate number', sample => { sample.parts[0].groups[0].questions[1].n = 1; }, /continuous|unique/],
  ['empty answer', sample => { sample.parts[0].groups[0].questions[0].answer = []; }, /nonempty answers/],
  ['MCQ key', sample => { sample.parts[0].groups[2].questions[0].answer = ['Z']; }, /not in options/],
  ['missing explanation', sample => { sample.parts[0].groups[0].questions[0].explanation = ''; }, /explanation/],
  ['evidence mismatch', sample => { sample.parts[0].groups[0].questions[0].evidence = 'Invented quotation'; }, /absent from script/],
  ['voice', sample => { sample.parts[0].script[0].voice = 'unknown'; }, /unknown voice/],
  ['reading time', sample => { sample.parts[0].script = sample.parts[0].script.filter(s => !('pause' in s)); }, /reading pause/],
  ['word limit', sample => { sample.parts[0].groups[0].questions[0].answer = ['two words']; }, /word limit/],
  ['multi set', sample => { sample.parts[0].groups[3].questions[1].answer = ['A', 'C']; }, /shared/],
  ['unsafe audio path', sample => { sample.parts[0].audio = '../bad.mp3'; }, /audio path/]
];
for (const [name, mutate, expected] of invalidCases) test(`validator rejects ${name}`, () => {
  const sample = clone(); mutate(sample); assert.match(validateTest(sample).join('\n'), expected);
});
test('map requires an existing image', () => assert.match(validateTest(fixture, { imageExists: () => false }).join('\n'), /map image missing/));
test('malformed JSON shapes return validation errors instead of throwing', () => {
  for (const sample of [null, {}, { parts: [] }, { id: 'x', title: 'X', parts: [null, null, null, null] }]) assert.ok(validateTest(sample).length);
  for (const mutate of [sample => { sample.parts[0].script = [null]; }, sample => { sample.parts[0].groups = 'bad'; }, sample => { sample.parts[0].groups[0].questions = [null]; }, sample => { sample.parts[0].groups[0].questions[0].answer = 'not an array'; }]) {
    const sample = clone(); mutate(sample); assert.ok(validateTest(sample).length);
  }
  assert.ok(validateExternal({ sites: [null] }).length);
});
test('external catalogue only accepts HTTPS destinations', () => {
  const good = { sites: [{ site: 'Example', home: 'https://example.com', tests: [{ title: 'Test', url: 'https://example.com/test' }] }] };
  assert.deepEqual(validateExternal(good), []);
  for (const url of ['http://example.com', 'javascript:alert(1)', '//example.com', 'invalid']) {
    const bad = structuredClone(good); bad.sites[0].tests[0].url = url; assert.ok(validateExternal(bad).length);
  }
  assert.deepEqual(validateExternal({ sites: [] }), []);
});
test('paths reject escapes, protocols and encoded traversal', () => {
  for (const value of ['../test.json', '/test.json', 'https://a.test', 'x/../y', 'x%2fy', 'x\\y']) assert.ok(!safePath(value));
  assert.ok(safePath('content/ielts-gt/listening/gt-l-01.json'));
});
