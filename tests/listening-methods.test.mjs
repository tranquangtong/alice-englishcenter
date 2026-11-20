import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { FORMATS, gradePractice, normalizePractice, validatePractice, wordDiff } from '../assets/js/listening-methods-core.js';

test('normalizes case, punctuation and spelling while preserving meaningful distinctions', () => {
  assert.equal(normalizePractice('  The COLOUR,\n of the centre! '), 'the color of the center');
  assert.equal(normalizePractice('colour', { spelling: false }), 'colour');
  assert.equal(normalizePractice('£1,402.50.'), '1402.50');
  assert.notEqual(normalizePractice('1.5'), normalizePractice('15'));
  assert.notEqual(normalizePractice('badges'), normalizePractice('badge'));
  assert.notEqual(normalizePractice('walked'), normalizePractice('walk'));
  assert.notEqual(normalizePractice('clarke'), normalizePractice('clark'));
});

test('limits numeric equivalence to the item policy and keeps phone zeros', () => {
  assert.equal(normalizePractice('FOURTEEN', { numbers: 'integer' }), '14');
  assert.equal(normalizePractice('Forty-two.', { numbers: 'integer' }), '42');
  assert.equal(normalizePractice('0014', { numbers: 'integer' }), '14');
  assert.equal(normalizePractice('Oh seven double two, six one five', { numbers: 'digits' }), '0722615');
  assert.equal(normalizePractice('(0722) 615', { numbers: 'digits' }), '0722615');
  assert.notEqual(normalizePractice('fourteen'), normalizePractice('14'));
  assert.notEqual(normalizePractice('40', { numbers: 'integer' }), normalizePractice('fourteen', { numbers: 'integer' }));
  assert.notEqual(normalizePractice('722615', { numbers: 'digits' }), '0722615');
});

test('expands only supported contractions where the item allows it', () => {
  assert.equal(normalizePractice('He must’ve left.', { contractions: true }), 'he must have left');
  assert.equal(normalizePractice('I can’t go.', { contractions: true }), 'i can not go');
  assert.equal(normalizePractice('must’ve'), "must've");
  assert.equal(normalizePractice("she'd", { contractions: true }), "she'd");
  assert.notEqual(normalizePractice('must of', { contractions: true }), 'must have');
});

test('scores selected prediction types separately from final answers and accepts explicit variants', () => {
  const exercise = { format: 'predict-verify', clips: [{ items: [
    { id: 'day', expectedType: 'date', answer: 'September 5', variants: ['5 September'] },
    { id: 'name', expectedType: 'name', answer: 'Clarke' }
  ] }] };
  assert.deepEqual(gradePractice(exercise, { day: '5 September', name: 'Clark' }, { day: 'noun', name: 'name' }), {
    outcomes: [{ id: 'day', correct: true, predicted: false }, { id: 'name', correct: false, predicted: true }],
    correct: 1, total: 2, predictionCorrect: 1, predictionTotal: 2
  });
  assert.equal(gradePractice(exercise).correct, 0);
  const choices = { format: 'number-contrast', clips: [{ items: [{ id: 'n', answer: 'fourteen' }] }] };
  assert.equal(gradePractice(choices, { n: 'forty' }).correct, 0);
  assert.equal(gradePractice(choices, { n: 'fourteen' }).correct, 1);
});

test('word-level diff aligns inserted, absent and misspelled words', () => {
  assert.deepEqual(wordDiff('We quickly walk home', 'We walked home'), [
    { kind: 'same', word: 'we' }, { kind: 'extra', word: 'quickly' },
    { kind: 'extra', word: 'walk' }, { kind: 'missing', word: 'walked' }, { kind: 'same', word: 'home' }
  ]);
  assert.deepEqual(wordDiff('The COLOR!', 'The colour'), [
    { kind: 'same', word: 'the' }, { kind: 'same', word: 'color' }
  ]);
});

test('every published format has valid sample data and every audio reference resolves to an MP3', async () => {
  const root = new URL('../', import.meta.url);
  const load = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const catalog = await load('content/ielts-gt/listening/index.json');
  assert.equal(catalog.tests.length, 4);
  const docs = await readFile(new URL('docs/listening-methods-schema.md', root), 'utf8');
  const schema = JSON.parse(/```json\n([\s\S]+?)\n```/.exec(docs)[1]);
  assert.deepEqual(schema.items.properties.format.enum, Object.values(FORMATS).flat());
  for (const method of catalog.methods) {
    const exercises = await load(method.file);
    assert.deepEqual(new Set(exercises.map(entry => entry.format)), new Set(FORMATS[method.id]));
    for (const exercise of exercises) {
      assert.deepEqual(validatePractice(exercise, method.id), [], exercise.id);
      for (const { audio } of exercise.clips) {
        const file = fileURLToPath(new URL(audio, root));
        const decoded = spawnSync(ffmpeg, ['-v', 'error', '-xerror', '-nostdin', '-i', file, '-map', '0:a:0', '-f', 'null', '-'], {
          encoding: 'utf8', timeout: 5000, windowsHide: true
        });
        assert.equal(decoded.status, 0, `${audio}: ${decoded.stderr || decoded.error}`);
      }
      const tatoeba = exercise.clips.findIndex(clip => clip.source.kind === 'tatoeba');
      if (tatoeba >= 0) {
        const invalid = structuredClone(exercise);
        invalid.clips[tatoeba].source.audioLicence = 'https://creativecommons.org/licenses/by-nc/4.0/';
        assert.match(validatePractice(invalid, method.id).join(' '), /invalid source/);
      }
    }
  }
});
