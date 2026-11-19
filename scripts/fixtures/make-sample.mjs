// Original mechanical fixture: test-engine coverage, never a published mock test.
import { writeFile } from 'node:fs/promises';
const gap = (n, answer, evidence) => ({ n, prompt: `Item ${n}: {{blank}}`, answer: [answer], explanation: `Nghe rõ thông tin: ${answer}.`, evidence, distractors: [{ text: 'old entry', why: 'Thông tin cũ đã được thay thế.' }] });
const options = [{ key: 'A', text: 'Garden desk' }, { key: 'B', text: 'Library desk' }, { key: 'C', text: 'Cafe desk' }];
const choice = (n, answer, evidence, own = false) => ({ n, prompt: `Choose the location for item ${n}.`, ...(own ? { options } : {}), answer: [answer], explanation: 'Câu nói xác nhận vị trí thư viện.', evidence, distractors: [{ text: 'C', why: 'Quán cà phê không phải địa điểm được chọn.' }] });
const group = (type, questions, extras = {}) => ({ range: [questions[0].n, questions.at(-1).n], type, instructions: ['mcq', 'matching', 'map'].includes(type) ? 'Choose the correct letter.' : type === 'mcq-multi' ? 'Choose TWO letters.' : 'Write ONE WORD AND/OR A NUMBER for each answer.', ...( ['form', 'note', 'table', 'sentence', 'summary'].includes(type) ? { wordLimit: 1, allowNumber: true } : {}), questions, ...extras });
const evidence = [
  'The new surname is Hollis, the colour is green, and the fee is 1,200 pounds.',
  'The library desk is at B; the garden desk is at A.',
  'Write river for each item in this short exercise.',
  'Choose the library desk, letter B, and write river for the final five items.'
];
const groups = [
  [group('form', [gap(1, 'Hollis', evidence[0]), gap(2, 'green', evidence[0]), gap(3, '1200', evidence[0])]), group('note', [4, 5, 6].map(n => gap(n, 'green', evidence[0]))), group('mcq', [7, 8].map(n => choice(n, 'B', evidence[1], true))), group('mcq-multi', [9, 10].map(n => ({ ...choice(n, 'A', evidence[1]), answer: ['A', 'B'] })), { options })],
  [group('map', [11, 12, 13, 14, 15].map(n => choice(n, 'B', evidence[1])), { options, image: 'scripts/fixtures/sample-map.svg', title: 'Community centre plan' }), group('matching', [16, 17, 18, 19, 20].map(n => choice(n, 'B', evidence[1])), { options })],
  [group('table', [21, 22, 23, 24].map(n => gap(n, 'river', evidence[2]))), group('sentence', [25, 26, 27].map(n => gap(n, 'river', evidence[2]))), group('summary', [28, 29, 30].map(n => gap(n, 'river', evidence[2])))],
  [group('mcq', [31, 32, 33, 34, 35].map(n => choice(n, 'B', evidence[3], true))), group('note', [36, 37, 38, 39, 40].map(n => gap(n, 'river', evidence[3])))]
];
const test = { id: 'sample-listening', title: 'Original engine fixture', parts: groups.map((groups, i) => ({ part: i + 1, title: `Part ${i + 1} — Community centre fixture`, context: 'A short original exercise for software testing.', audio: `scripts/fixtures/audio/part${i + 1}.mp3`, script: [{ speaker: 'Narrator', voice: 'en-GB-narrator', text: `Part ${i + 1}. You will hear a short community centre exercise.` }, { pause: 20, note: 'Read the questions.' }, { speaker: 'Receptionist', voice: ['en-GB-female-1', 'en-AU-male-1', 'en-US-female-1', 'en-GB-male-1'][i], text: i === 0 ? `${evidence[0]} ${evidence[1]}` : evidence[i] }], groups })) };
await writeFile(new URL('./sample-listening.json', import.meta.url), JSON.stringify(test, null, 2) + '\n');
