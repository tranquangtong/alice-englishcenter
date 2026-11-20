import { gradePractice, isChoice, isDictation, PREDICTIONS, validatePractice, wordDiff } from './listening-methods-core.js?v=1';

const home = '#/ielts-gt/listening';
const progressKey = (method, exercise) => `aec-listening-method:${location.pathname}:${method}:${exercise}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const button = (action, label, primary = false) =>
  `<button type="${action === 'submit' || action === 'verify' ? 'submit' : 'button'}" class="lt-btn aero-btn${primary ? ' lt-btn--primary' : ''}" data-practice-action="${action}">${label}</button>`;

async function read(file, signal, type) {
  const response = await fetch(file, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response[type]();
}

export async function renderMethod({ method, exerciseId, content, signal }) {
  const href = `${home}/${method.id}`;
  const [exercises, intro] = await Promise.all([
    read(method.file, signal, 'json'),
    exerciseId ? null : read(method.intro, signal, 'text')
  ]);
  if (signal.aborted) return;
  const exercise = exerciseId ? exercises.find(entry => entry.id === exerciseId) : null;
  if (exerciseId && !exercise) throw new Error('Không tìm thấy bài luyện');
  if (exercise && validatePractice(exercise, method.id).length) throw new Error('Dữ liệu bài luyện không hợp lệ');

  const root = document.createElement('section');
  root.className = 'practice';
  if (exercise) {
    root.innerHTML = `<header class="lt-head"><a class="practice-back" href="${href}">${esc(method.title)}</a><h1>${esc(exercise.title)}</h1><p>${esc(exercise.level)} · ${esc(exercise.instructions)}</p></header>`;
    mount(root, method.id, exercise, signal);
  } else {
    root.innerHTML = `<a class="practice-back" href="${home}">Về Listening</a>`;
    const outline = document.createElement('div');
    outline.innerHTML = window.DOMPurify.sanitize(window.marked.parse(intro), { SANITIZE_NAMED_PROPS: true });
    root.append(outline);
    root.insertAdjacentHTML('beforeend', `<h2>Bài luyện</h2><ul class="practice-list">${exercises.map((entry, index) => {
      const predict = entry.format === 'predict-verify';
      const state = readProgress(progressKey(method.id, entry.id), entry.clips.flatMap(clip => clip.items), predict);
      const started = (predict && state.stage === 'answer')
        || Object.keys(state.types).length || Object.values(state.guesses).some(value => value.trim())
        || Object.values(state.answers).some(value => value.trim());
      const progress = state.stage === 'result' ? '✓ Đã kiểm tra' : started ? 'Đang làm' : 'Chưa làm';
      return `<li><a class="aero-btn" href="${href}/${encodeURIComponent(entry.id)}">
        <span class="practice-card-meta"><span>Bài ${index + 1}</span><span>${esc(entry.level)}</span></span>
        <span>${esc(entry.title)}</span><span class="practice-card-progress">${progress}</span>
      </a></li>`;
    }).join('')}</ul>`);
  }
  document.title = `${exercise?.title ?? method.title} · Alice English Center`;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.id = 'practice-css';
  style.href = document.querySelector('meta[name="aec-practice-css"]').content;
  document.head.append(style);
  signal.addEventListener('abort', () => style.remove(), { once: true });
  content.replaceChildren(root);
}

function readProgress(key, items, predict) {
  function values(source, allow) {
    const result = Object.create(null);
    for (const item of items) {
      const value = source?.[item.id];
      if (typeof value === 'string' && allow(value, item)) result[item.id] = value.slice(0, 1000);
    }
    return result;
  }
  let stored;
  try { if (key) stored = JSON.parse(localStorage.getItem(key)); } catch { /* Storage is optional. */ }
  const answers = values(stored?.answers, (value, item) => !item.choices || item.choices.some(choice => choice.id === value));
  const types = values(stored?.types, value => Object.hasOwn(PREDICTIONS, value));
  const guesses = values(stored?.guesses, () => true);
  let stage = stored?.stage === 'result' ? 'result' : 'answer';
  if (predict && (Object.keys(types).length !== items.length || !['answer', 'result'].includes(stored?.stage))) stage = 'predict';
  return { answers, types, guesses, stage };
}

function transcript(clip) {
  const lines = clip.script.map((line, index) => {
    const marks = (clip.highlights ?? []).filter(mark => mark.line === index)
      .map(mark => ({ ...mark, start: line.text.indexOf(mark.text) })).sort((a, b) => a.start - b.start);
    let cursor = 0, text = '';
    for (const mark of marks) {
      if (mark.start < cursor) continue;
      const label = mark.kind === 'answer' ? 'Đáp án' : 'Bẫy';
      text += esc(line.text.slice(cursor, mark.start)) + `<mark class="practice-mark--${mark.kind}">${esc(mark.text)} <small lang="vi">(${label})</small></mark>`;
      cursor = mark.start + mark.text.length;
    }
    return `<p><strong>${esc(line.speaker)}</strong> <span lang="en">${text}${esc(line.text.slice(cursor))}</span></p>`;
  });
  return `<details class="practice-transcript"${clip.highlights ? ' open' : ''}><summary>Lời thoại</summary>${lines.join('')}</details>`;
}

function feedback(exercise, item, state, outcome) {
  const correct = outcome.correct;
  const expected = item.choices?.find(choice => choice.id === item.answer)?.label ?? item.answer;
  const entered = state.answers[item.id] ?? '';
  const prediction = item.expectedType
    ? `<p>${outcome.predicted ? '✓ Dự đoán đúng' : '✗ Dự đoán chưa đúng'} · ${PREDICTIONS[item.expectedType]}${state.guesses[item.id] ? ` · Bạn đoán “${esc(state.guesses[item.id])}”` : ''}</p>` : '';
  const diff = isDictation(exercise.format) ? wordDiff(entered, correct ? entered : expected, item.rules).map(({ word, kind }) => {
    if (kind === 'missing') return `<ins><span class="visually-hidden">Thiếu </span>${esc(word)}</ins>`;
    if (kind === 'extra') return `<del><span class="visually-hidden">Thừa hoặc sai </span>${esc(word)}</del>`;
    return esc(word);
  }).join(' ') : '';
  return `<div class="practice-feedback lt-q--${correct ? 'correct' : 'wrong'}"><p><strong>${correct ? '✓ Đúng' : '✗ Chưa đúng'}</strong> · Đáp án <span lang="en">${esc(expected)}</span></p>${prediction}${diff ? `<p class="practice-diff"><span class="visually-hidden">So sánh từng từ </span>${diff}</p>` : ''}<p>${esc(item.explanation)}</p></div>`;
}

function credits(exercise) {
  const sources = exercise.clips.map(clip => clip.source);
  if (sources.every(source => source.kind === 'original')) {
    const { attribution, licence } = sources[0];
    return `<p class="practice-credits">${esc(attribution)} · ${esc(licence)}</p>`;
  }
  return `<details class="practice-credits"><summary>Nguồn và giấy phép audio</summary><ul>${sources.map(source =>
    source.kind === 'tatoeba'
      ? `<li><a href="${esc(source.link)}">Tatoeba #${source.sentenceId}</a> · Audio #${source.audioId} · <a href="${esc(source.attributionURL)}">${esc(source.speaker)}</a> · <a rel="license" href="${esc(source.audioLicence)}">${esc(source.licence)}</a> · Chữ: ${esc(source.attribution)} (<a rel="license" href="${esc(source.textLicence)}">giấy phép</a>)</li>`
      : `<li>${esc(source.attribution)} · ${esc(source.licence)}</li>`).join('')}</ul></details>`;
}

function mount(root, methodId, exercise, signal) {
  const predict = exercise.format === 'predict-verify';
  const items = exercise.clips.flatMap(clip => clip.items);
  const byId = new Map(items.map(item => [item.id, item]));
  const key = progressKey(methodId, exercise.id);
  let state = readProgress(key, items, predict);
  const form = document.createElement('form');
  const score = document.createElement('p');
  score.className = 'practice-score';
  score.setAttribute('role', 'status');
  score.tabIndex = -1;
  root.append(score, form);
  root.insertAdjacentHTML('beforeend', credits(exercise));

  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Storage is optional. */ }
  }

  function resetAudio() {
    for (const audio of form.querySelectorAll('audio')) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }

  function draw() {
    resetAudio();
    const predicting = state.stage === 'predict';
    const done = state.stage === 'result';
    const result = done ? gradePractice(exercise, state.answers, state.types) : null;
    if (result) score.dataset.outcome = result.correct === result.total ? 'correct' : result.correct ? 'partial' : 'wrong';
    else delete score.dataset.outcome;
    score.textContent = result
      ? `${predict ? `Dự đoán đúng ${result.predictionCorrect}/${result.predictionTotal} · ` : ''}Đáp án đúng ${result.correct}/${result.total}`
      : predict ? (predicting ? 'Bước 1 · Dự đoán' : 'Bước 2 · Nghe và kiểm chứng') : '';
    form.innerHTML = exercise.clips.map((clip, index) => {
      const heading = exercise.clips.length > 1 ? `<h2>Đoạn ${index + 1}</h2>` : '';
      const audio = predicting ? '' : `<div class="lt-audio practice-audio">
        ${button('play', 'Phát / Tạm dừng', true)}${button('replay', 'Nghe lại từ đầu')}
        <label>Tốc độ <select class="lt-gap" data-speed><option value="1">1×</option><option value="0.85">0.85×</option></select></label>
        <p data-audio-error role="status" hidden></p><audio preload="none" src="${esc(clip.audio)}"></audio></div>`;
      return `<div class="lt-group practice-clip">${heading}${audio}${clip.items.map(item => {
        const prompt = esc(item.prompt);
        const inputId = `practice-${item.id}`;
        if (predicting) {
          return `<fieldset class="practice-item"><legend>${prompt}</legend><label for="${inputId}">Loại thông tin</label>
            <select class="lt-gap" id="${inputId}" data-store="types" data-item="${item.id}" required>
            <option value="">Chọn loại</option>${Object.entries(PREDICTIONS).map(([id, label]) => `<option value="${id}"${state.types[item.id] === id ? ' selected' : ''}>${label}</option>`).join('')}</select>
            <label for="${inputId}-guess">Bạn đoán (không bắt buộc)</label>
            <input class="lt-gap" id="${inputId}-guess" maxlength="1000" value="${esc(state.guesses[item.id])}" data-store="guesses" data-item="${item.id}"></fieldset>`;
        }
        const data = `data-store="answers" data-item="${item.id}"`;
        const control = isChoice(exercise.format)
          ? item.choices.map(choice => `<label class="lt-option practice-choice"><input type="radio" name="${inputId}" value="${choice.id}" ${data}${state.answers[item.id] === choice.id ? ' checked' : ''}${done ? ' disabled' : ''}> <span lang="en">${esc(choice.label)}</span></label>`).join('')
          : `<input class="lt-gap practice-text" id="${inputId}" aria-labelledby="${inputId}-label" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" maxlength="1000" value="${esc(state.answers[item.id])}" ${data}${done ? ' readonly' : ''}>`;
        const hint = !done && isDictation(exercise.format)
          ? `${button('hint', 'Gợi ý ký tự đầu')} <span class="practice-hint" role="status"></span>` : '';
        return `<fieldset class="practice-item" data-question="${item.id}"><legend id="${inputId}-label">${prompt}</legend>${control}${hint}${done ? feedback(exercise, item, state, result.outcomes.find(outcome => outcome.id === item.id)) : ''}</fieldset>`;
      }).join('')}${done ? transcript(clip) : ''}</div>`;
    }).join('') + `<div class="lt-submit">${done ? button('retry', 'Làm lại') : predicting ? button('verify', 'Sang bước nghe', true) : button('submit', 'Kiểm tra', true)}</div>`;
  }

  form.addEventListener('input', event => {
    const input = event.target;
    if (input.matches('[data-speed]')) {
      input.closest('.practice-audio').querySelector('audio').playbackRate = Number(input.value);
    } else if (input.dataset.store && state.stage !== 'result') {
      state[input.dataset.store][input.dataset.item] = input.value;
      save();
    }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (state.stage === 'result') return;
    state.stage = state.stage === 'predict' ? 'answer' : 'result';
    save();
    draw();
    score.focus();
  });

  form.addEventListener('click', async event => {
    const control = event.target.closest('[data-practice-action]');
    if (!control) return;
    const action = control.dataset.practiceAction;
    if (action === 'retry') {
      state = readProgress(null, items, predict);
      save();
      draw();
      form.querySelector('select, button')?.focus();
    }
    if (action === 'hint') {
      const question = control.closest('[data-question]');
      const answer = byId.get(question.dataset.question).answer;
      question.querySelector('.practice-hint').textContent = `Bắt đầu bằng “${Array.from(answer.trim())[0]}”.`;
    }
    if (action === 'play' || action === 'replay') {
      const player = control.closest('.practice-audio');
      const audio = player.querySelector('audio');
      const status = player.querySelector('[data-audio-error]');
      status.hidden = true;
      if (action === 'play' && !audio.paused) { audio.pause(); return; }
      for (const other of form.querySelectorAll('audio')) if (other !== audio) other.pause();
      try {
        if (audio.error) audio.load();
        if (action === 'replay') audio.currentTime = 0;
        audio.playbackRate = Number(player.querySelector('[data-speed]').value);
        await audio.play();
      } catch (error) {
        if (error.name === 'AbortError' || signal.aborted || !status.isConnected) return;
        status.textContent = 'Chưa phát được audio. Hãy thử lại.';
        status.hidden = false;
      }
    }
  });

  signal.addEventListener('abort', resetAudio, { once: true });
  draw();
}
