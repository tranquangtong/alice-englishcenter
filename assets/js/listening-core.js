// Shared, DOM-free rules used by the player, content checker and tests.
export const VOICES = Object.freeze({
  'en-GB-female-1': 'en-GB-SoniaNeural',
  'en-GB-male-1': 'en-GB-RyanNeural',
  'en-AU-female-1': 'en-AU-NatashaNeural',
  'en-AU-male-1': 'en-AU-WilliamNeural',
  'en-US-female-1': 'en-US-JennyNeural',
  'en-US-male-1': 'en-US-GuyNeural',
  'en-GB-narrator': 'en-GB-LibbyNeural'
});
export const GAP_TYPES = ['form', 'note', 'table', 'sentence', 'summary'];
export const GROUP_TYPES = [...GAP_TYPES, 'mcq', 'mcq-multi', 'matching', 'map'];
export function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '').trim()
    .replace(/(?<=\d),(?=\d)/g, '');
}
export function withinLimit(value, group) {
  if (!GAP_TYPES.includes(group.type)) return true;
  const tokens = normalize(value).split(' ').filter(Boolean);
  // A number is an extra permitted token only for AND/OR A NUMBER instructions.
  const numbers = tokens.filter(token => /^\d+(?:[.:/-]\d+)*$/.test(token));
  return group.allowNumber ? numbers.length <= 1 && tokens.length - numbers.length <= group.wordLimit : tokens.length <= group.wordLimit;
}
export function bandFor(score) {
  return [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5],
    [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 2]].find(([min]) => score >= min)?.[1] ?? 2;
}
export function grade(test, answers) {
  const questions = {};
  let score = 0;
  for (const part of test.parts) for (const group of part.groups) {
    if (group.type === 'mcq-multi') {
      const accepted = new Set(group.questions[0].answer.map(normalize));
      const selected = [...new Set((Array.isArray(answers[group.questions[0].n]) ? answers[group.questions[0].n] : []).map(normalize))];
      const hits = selected.filter(value => accepted.has(value));
      group.questions.forEach((question, i) => {
        const correct = selected.length <= group.questions.length && i < hits.length;
        questions[question.n] = { correct, given: selected.join(', '), answer: question.answer.join(' / ') };
        if (correct) score++;
      });
    } else for (const question of group.questions) {
      const given = String(answers[question.n] ?? '');
      const correct = !!normalize(given) && withinLimit(given, group) && question.answer.some(answer => normalize(answer) === normalize(given));
      questions[question.n] = { correct, given, answer: question.answer.join(' / ') };
      if (correct) score++;
    }
  }
  return { score, band: bandFor(score), questions };
}
export function progress(test, answers) {
  return test.parts.flatMap(p => p.groups).reduce((total, group) => total + (group.type === 'mcq-multi'
    ? Math.min(group.questions.length, Array.isArray(answers[group.questions[0].n]) ? answers[group.questions[0].n].length : 0)
    : group.questions.filter(q => normalize(answers[q.n])).length), 0);
}
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export const safePath = value => nonempty(value) && !value.includes('\\') && !value.startsWith('/') && !value.split('/').some(p => p === '..' || p === '.') && !/[:?#%]/.test(value);
export function validateTest(test, { imageExists = () => true } = {}) {
  const errors = [];
  const fail = message => errors.push(message);
  if (!test || !nonempty(test.id) || !nonempty(test.title)) fail('test id and title required');
  if (!Array.isArray(test?.parts) || test.parts.length !== 4) { fail('expected 4 parts'); return errors; }
  const all = [];
  test.parts.forEach((part, pi) => {
    const label = `Part ${pi + 1}`;
    if (!part || typeof part !== 'object') { fail(`${label}: invalid part`); return; }
    if (part.part !== pi + 1 || !nonempty(part.title)) fail(`${label}: part number/title invalid`);
    if (!safePath(part.audio) || !part.audio.endsWith('.mp3')) fail(`${label}: local MP3 audio path required`);
    const script = Array.isArray(part.script) ? part.script : [];
    if (!script.length || script[0]?.voice !== 'en-GB-narrator' || !script.some(s => Number.isFinite(s?.pause) && s.pause > 0)) fail(`${label}: narrator intro and reading pause required`);
    script.forEach(item => {
      if (!item || typeof item !== 'object') { fail(`${label}: invalid script item`); return; }
      if ('pause' in item) {
        if (!Number.isFinite(item.pause) || item.pause < 0 || item.pause > 600) fail(`${label}: invalid pause`);
      } else if (!Object.hasOwn(VOICES, item.voice) || !nonempty(item.text) || !nonempty(item.speaker)) fail(`${label}: unknown voice or missing script text/speaker`);
    });
    const text = script.map(s => s?.text || '').join(' ');
    const numbers = [];
    if (!Array.isArray(part.groups) || !part.groups.length) fail(`${label}: groups required`);
    for (const group of Array.isArray(part.groups) ? part.groups : []) {
      if (!group || typeof group !== 'object') { fail(`${label}: invalid group`); continue; }
      if (!GROUP_TYPES.includes(group.type)) fail(`${label}: unknown group type ${group.type}`);
      if (!nonempty(group.instructions)) fail(`${label}: group instructions required`);
      if (GAP_TYPES.includes(group.type) && (!Number.isInteger(group.wordLimit) || group.wordLimit < 1 || typeof group.allowNumber !== 'boolean')) fail(`${label}: wordLimit/allowNumber invalid`);
      if (!Array.isArray(group.questions) || !group.questions.length) { fail(`${label}: questions required`); continue; }
      if (!Array.isArray(group.range) || group.range[0] !== group.questions[0]?.n || group.range[1] !== group.questions.at(-1)?.n) fail(`${label}: group range does not match questions`);
      if (group.type === 'map' && (!safePath(group.image) || !imageExists(group.image))) fail(`${label}: map image missing`);
      for (const question of group.questions) {
        if (!question || typeof question !== 'object') { fail(`${label}: invalid question`); continue; }
        numbers.push(question.n); all.push(question.n);
        const qlabel = `${label} Q${question.n}`;
        if (!Array.isArray(question.answer) || !question.answer.length || !question.answer.every(nonempty)) fail(`${qlabel}: nonempty answers required`);
        if (!nonempty(question.explanation) || !nonempty(question.evidence)) fail(`${qlabel}: explanation and evidence required`);
        else if (!text.includes(question.evidence)) fail(`${qlabel}: evidence absent from script`);
        if (!Array.isArray(question.distractors) || !question.distractors.every(d => d && nonempty(d.text) && nonempty(d.why))) fail(`${qlabel}: distractors must be text/why pairs`);
        if (GAP_TYPES.includes(group.type)) {
          if (!nonempty(question.prompt) || !question.prompt.includes('{{blank}}')) fail(`${qlabel}: gap prompt must include {{blank}}`);
          if (Array.isArray(question.answer) && question.answer.some(a => !withinLimit(a, group))) fail(`${qlabel}: accepted answer exceeds word limit`);
        } else {
          const options = group.type === 'mcq' ? question.options : group.options;
          if (!Array.isArray(options) || !options.length || !options.every(o => o && nonempty(o.key) && nonempty(o.text)) || new Set(options.map(o => o.key)).size !== options.length) fail(`${qlabel}: invalid options`);
          else if (Array.isArray(question.answer) && question.answer.some(a => !options.some(o => o.key === a))) fail(`${qlabel}: answer not in options`);
        }
      }
      if (group.type === 'mcq-multi') {
        const first = group.questions[0]?.answer;
        if (!Array.isArray(first) || first.length !== group.questions.length || new Set(first).size !== first.length || group.questions.some(q => !Array.isArray(q?.answer) || JSON.stringify([...q.answer].sort()) !== JSON.stringify([...first].sort()))) fail(`${label}: multi answer set must be shared and match question count`);
      }
    }
    if (numbers.length !== 10 || numbers.some((n, i) => n !== pi * 10 + i + 1)) fail(`${label}: expected 10 continuous questions ${pi * 10 + 1}–${pi * 10 + 10}`);
  });
  if (all.length !== 40 || new Set(all).size !== 40) fail('expected 40 unique questions');
  return errors;
}
export function validateExternal(data) {
  const errors = [];
  const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
  if (!Array.isArray(data?.sites)) return ['external sites array required'];
  for (const site of data.sites) {
    if (!site || typeof site !== 'object') { errors.push('invalid external site'); continue; }
    if (!nonempty(site.site) || !https(site.home) || !Array.isArray(site.tests)) errors.push('invalid external site or non-HTTPS home');
    for (const test of Array.isArray(site.tests) ? site.tests : []) if (!test || !nonempty(test.title) || !https(test.url)) errors.push('external test requires title and HTTPS URL');
  }
  return errors;
}
