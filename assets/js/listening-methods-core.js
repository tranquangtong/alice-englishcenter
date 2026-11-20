import { VOICES } from './listening-core.js?v=2';

export const FORMATS = Object.freeze({
  dictation: ['number-spelling', 'gap-dictation', 'sentence-dictation'],
  paraphrase: ['trap-spotter', 'paraphrase-match', 'transcript-highlight'],
  'connected-speech': ['word-count', 'reduced-cloze', 'number-contrast', 'ending-contrast'],
  prediction: ['predict-verify']
});
export const PREDICTIONS = Object.freeze({
  number: 'Số', date: 'Ngày tháng', name: 'Tên riêng', noun: 'Danh từ',
  adjective: 'Tính từ', verb: 'Động từ', time: 'Giờ', place: 'Địa điểm'
});
const choiceFormats = new Set(['trap-spotter', 'paraphrase-match', 'transcript-highlight', 'number-contrast', 'ending-contrast']);
export const isDictation = format => FORMATS.dictation.includes(format);
export const isChoice = format => choiceFormats.has(format);
export const isSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export const SPELLINGS = [
  ['colour', 'color'], ['colours', 'colors'], ['coloured', 'colored'],
  ['centre', 'center'], ['centres', 'centers'], ['favourite', 'favorite'],
  ['favourites', 'favorites'], ['organise', 'organize'], ['organised', 'organized'],
  ['organisation', 'organization'], ['neighbour', 'neighbor'], ['neighbours', 'neighbors'],
  ['travelling', 'traveling'], ['travelled', 'traveled'], ['theatre', 'theater'],
  ['theatres', 'theaters'], ['labour', 'labor'], ['recognise', 'recognize']
];
const spellings = new Map(SPELLINGS.map(([uk, us]) => [uk, us]));
const shortForms = new Map(Object.entries({
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are',
  "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have',
  "can't": 'can not', 'cannot': 'can not', "won't": 'will not', "don't": 'do not',
  "doesn't": 'does not', "didn't": 'did not', "isn't": 'is not', "aren't": 'are not',
  "wasn't": 'was not', "weren't": 'were not', "haven't": 'have not', "hasn't": 'has not'
}));
const units = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const tens = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const integers = new Map(units.map((word, value) => [word, value]));
for (const [index, word] of tens.entries()) {
  const value = (index + 2) * 10;
  integers.set(word, value);
  for (let unit = 1; unit < 10; unit++) integers.set(`${word} ${units[unit]}`, value + unit);
}
const digit = '(?:[0-9]|zero|oh|one|two|three|four|five|six|seven|eight|nine)';
const digitSequence = new RegExp(`^(?:double ${digit}|${digit}|[0-9]+)(?: (?:double ${digit}|${digit}|[0-9]+))*$`);

export function normalizePractice(value, rules = {}) {
  let text = String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[’‘ʼ]/g, "'")
    .replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}'\.]+/gu, ' ')
    .replace(/(?<!\p{L})'|'(?!\p{L})/gu, '')
    .trim().replace(/\s+/g, ' ');
  if (rules.numbers === 'integer') {
    if (integers.has(text)) text = String(integers.get(text));
    else if (/^\d+$/.test(text)) text = text.replace(/^0+(?=\d)/, '');
  }
  if (rules.numbers === 'digits' && digitSequence.test(text)) {
    text = text.replace(/(double )?([a-z]+|\d+)/g, (_, repeat, word) =>
      String(word === 'oh' ? 0 : integers.get(word) ?? word).repeat(repeat ? 2 : 1)).replaceAll(' ', '');
  }
  return text.split(' ').map(word => {
    const expanded = rules.contractions
      ? shortForms.get(word) ?? word.replace(/^(must|should|could|would|might|may)'ve$/, '$1 have')
      : word;
    return rules.spelling === false ? expanded : spellings.get(expanded) ?? expanded;
  }).join(' ');
}

export function gradePractice(exercise, responses = {}, predictions = {}) {
  const items = exercise.clips.flatMap(clip => clip.items);
  const outcomes = items.map(item => {
    const value = Object.hasOwn(responses, item.id) ? responses[item.id] : '';
    const normalize = isChoice(exercise.format) ? String : input => normalizePractice(input, item.rules);
    const actual = normalize(value);
    const accepted = [item.answer, ...(item.variants ?? [])].map(normalize);
    return {
      id: item.id,
      correct: Boolean(actual) && accepted.includes(actual),
      predicted: Boolean(item.expectedType) && Object.hasOwn(predictions, item.id) && predictions[item.id] === item.expectedType
    };
  });
  return {
    outcomes,
    correct: outcomes.filter(item => item.correct).length,
    total: items.length,
    predictionCorrect: outcomes.filter(item => item.predicted).length,
    predictionTotal: items.filter(item => item.expectedType).length
  };
}

// Longest common subsequence keeps missing and extra words aligned.
export function wordDiff(actual, expected, rules = {}) {
  const words = value => normalizePractice(value, rules).split(' ').filter(Boolean).slice(0, 300);
  const a = words(actual), b = words(expected);
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] = a[i] === b[j] ? 1 + lengths[i + 1][j + 1] : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const diff = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      diff.push({ kind: 'same', word: a[i] });
      i++;
      j++;
    }
    else if (i < a.length && (j === b.length || lengths[i + 1][j] >= lengths[i][j + 1])) diff.push({ kind: 'extra', word: a[i++] });
    else diff.push({ kind: 'missing', word: b[j++] });
  }
  return diff;
}

const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const list = value => Array.isArray(value) && value.length > 0;
const AUDIO_LICENCE = /^https:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa)\/[1-4]\.0(?:\/[a-z]{2})?|publicdomain\/zero\/1\.0)\/?$/;
export function validatePractice(exercise, method) {
  if (!exercise || !isSlug(exercise.id) || !Object.hasOwn(FORMATS, method) || !FORMATS[method].includes(exercise.format)
    || ![exercise.title, exercise.level, exercise.instructions].every(nonempty) || !list(exercise.clips)) return ['Invalid exercise header'];
  const errors = [];
  const itemIds = new Set(), clipIds = new Set();
  for (const clip of exercise.clips) {
    if (!clip || !isSlug(clip.id) || clipIds.has(clip.id) || clip.audio !== `assets/audio/listening/methods/${method}/${exercise.id}-${clip.id}.mp3`) {
      errors.push('Invalid clip id or audio path'); continue;
    }
    clipIds.add(clip.id);
    const source = clip.source;
    const tatoeba = source?.kind === 'tatoeba';
    if (!source || !(tatoeba || source.kind === 'original') || ![source.attribution, source.licence].every(nonempty)
      || (tatoeba && (!Number.isInteger(source.sentenceId) || !Number.isInteger(source.audioId)
        || source.link !== `https://tatoeba.org/en/sentences/show/${source.sentenceId}`
        || !nonempty(source.speaker) || !/^https:\/\/[^\s]+$/.test(source.attributionURL)
        || !AUDIO_LICENCE.test(source.audioLicence) || !AUDIO_LICENCE.test(source.textLicence)))) errors.push(`${clip.id}: invalid source`);
    if (!list(clip.script) || clip.script.some(line => !line || !nonempty(line.speaker) || !nonempty(line.text)
      || (tatoeba ? line.voice !== source.speaker : !Object.hasOwn(VOICES, line.voice)))) errors.push(`${clip.id}: invalid script`);
    if (!list(clip.items)) { errors.push(`${clip.id}: items required`); continue; }
    if (exercise.format === 'trap-spotter' && (clip.items.length !== 2 || !clip.items.every((item, index) => item?.role === ['fact', 'cue'][index]))) errors.push(`${clip.id}: expected fact and cue items`);
    if (exercise.format === 'transcript-highlight' && (!list(clip.highlights) || !['answer', 'distractor'].every(kind => clip.highlights.some(mark => mark?.kind === kind))
      || clip.highlights.some(mark => !mark || !['answer', 'distractor'].includes(mark.kind) || !nonempty(mark.text)
        || !Number.isInteger(mark.line) || !nonempty(clip.script?.[mark.line]?.text)
        || !clip.script[mark.line].text.includes(mark.text)))) errors.push(`${clip.id}: invalid highlights`);
    for (const item of clip.items) {
      if (!item || !isSlug(item.id) || itemIds.has(item.id) || ![item.prompt, item.answer, item.explanation].every(nonempty)) {
        errors.push(`${clip.id}: invalid item`); continue;
      }
      itemIds.add(item.id);
      if (item.variants !== undefined && (!Array.isArray(item.variants) || !item.variants.every(nonempty))) errors.push(`${item.id}: invalid variants`);
      if (item.rules !== undefined && (!item.rules || typeof item.rules !== 'object' || Array.isArray(item.rules)
        || Object.entries(item.rules).some(([key, value]) => key === 'numbers' ? !['integer', 'digits'].includes(value) : !['contractions', 'spelling'].includes(key) || typeof value !== 'boolean'))) errors.push(`${item.id}: invalid rules`);
      if (isChoice(exercise.format) && (!list(item.choices) || item.choices.length < 2 || item.choices.some(choice => !choice || !isSlug(choice.id) || !nonempty(choice.label))
        || new Set(item.choices.map(choice => choice?.id)).size !== item.choices.length
        || !item.choices.some(choice => choice?.id === item.answer) || item.variants !== undefined)) errors.push(`${item.id}: invalid choices`);
      if (exercise.format === 'predict-verify' ? !Object.hasOwn(PREDICTIONS, item.expectedType) : item.expectedType !== undefined) errors.push(`${item.id}: invalid prediction type`);
    }
  }
  return errors;
}
