/* Listening route controller. Visual class names follow the shared content contract. */
(() => {
  'use strict';
  const core = import('./listening-core.js?v=2');
  const dataRoot = 'content/ielts-gt/listening/';
  const skills = ['Listening', 'Reading', 'Writing', 'Speaking'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let dispose = () => {};
  let runningExam = false;
  function setRunningExam(running) {
    if (runningExam === running) return;
    runningExam = running;
    window.dispatchEvent(new Event('listeningexamchange'));
  }
  let catalogRequest;
  const top = document.querySelector('.top-menu');
  const disclosure = top.querySelector('button');
  const panel = top.querySelector('.top-menu__panel');
  function close(focus = false) {
    disclosure.setAttribute('aria-expanded', 'false'); panel.hidden = true;
    if (focus) disclosure.focus();
  }
  disclosure.addEventListener('click', () => {
    const open = disclosure.getAttribute('aria-expanded') !== 'true';
    disclosure.setAttribute('aria-expanded', String(open)); panel.hidden = !open;
  });
  top.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  top.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && e.target === disclosure) {
      e.preventDefault(); disclosure.setAttribute('aria-expanded', 'true'); panel.hidden = false; panel.querySelector('a').focus();
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); close(true); }
  });
  document.addEventListener('click', e => { if (!top.contains(e.target)) close(); });
  top.addEventListener('focusout', e => { if (!top.contains(e.relatedTarget)) close(); });
  async function json(path, signal, optional = false) {
    const response = await fetch(path, { signal });
    if (optional && response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  function loadCatalog() {
    // The sidebar and Listening pages share the small catalogue across routes.
    return catalogRequest ??= json(`${dataRoot}index.json`, undefined, true).catch(error => {
      catalogRequest = undefined;
      throw error;
    });
  }
  async function render({ id, query, content, signal }) {
    const rules = await core;
    if (signal.aborted) return;
    close();
    if (id === 'ielts-gt') {
      content.innerHTML = `<section class="gt-hub"><h1>IELTS General</h1><p>Chọn kỹ năng để luyện tập.</p>${skills.map((s, i) => `<a class="gt-skill${i ? ' gt-skill--soon' : ''}" href="#/ielts-gt/${s.toLowerCase()}"><h2>${s}</h2><p>${i ? 'Sắp ra mắt' : 'Bài thi Listening tự biên soạn · 40 câu'}</p></a>`).join('')}</section>`;
      return;
    }
    if (/^ielts-gt\/(reading|writing|speaking)$/.test(id)) {
      content.innerHTML = `<section class="gt-hub"><h1>${esc(id.split('/')[1])}</h1><p>Sắp ra mắt</p><a href="#/ielts-gt">Về IELTS General</a></section>`;
      return;
    }
    if (id === 'ielts-gt/listening') {
      const [catalog, external] = await Promise.all([loadCatalog(), json(`${dataRoot}external.json`, signal, true)]);
      if (signal.aborted) return;
      if (external && rules.validateExternal(external).length) throw new Error('Danh mục liên kết không hợp lệ');
      content.innerHTML = `<section class="lt-list"><h1>IELTS General · Listening</h1><p>Bài luyện tập tự biên soạn. Chọn luyện tập hoặc thi thử.</p>${(catalog?.tests || []).map(t => `<article class="lt-card"><h2>${esc(t.title)}</h2><p>${esc(t.summary)}</p><p>${esc(t.difficulty)}</p><a class="lt-btn aero-btn" href="#/ielts-gt/listening/${encodeURIComponent(t.id)}?mode=practice">Luyện tập</a> <a class="lt-btn aero-btn" href="#/ielts-gt/listening/${encodeURIComponent(t.id)}?mode=exam">Thi thử</a></article>`).join('') || '<p>Bài thi đang được chuẩn bị.</p>'}${catalog?.methods?.length ? `<h2>Luyện theo kỹ năng</h2><p>${catalog.methods.map(method => `<a href="#/ielts-gt/listening/${encodeURIComponent(method.id)}" class="lt-btn aero-btn">${esc(method.title)}</a>`).join(' ')}</p>` : ''}<h2>Luyện thêm ở trang khác</h2><p>Các bài thi được liên kết thuộc về chủ sở hữu tương ứng.</p>${(external?.sites || []).map(site => `<section><h3><a target="_blank" rel="noopener noreferrer" href="${esc(site.home)}">${esc(site.site)}</a></h3>${site.note ? `<p>${esc(site.note)}</p>` : ''}<ul>${site.tests.map(t => `<li><a target="_blank" rel="noopener noreferrer" href="${esc(t.url)}">${esc(t.title)}</a></li>`).join('')}</ul></section>`).join('')}</section>`;
      return;
    }
    const [testId, exerciseId] = id.slice('ielts-gt/listening/'.length).split('/');
    const catalog = await loadCatalog();
    if (signal.aborted) return;
    const method = catalog?.methods?.find(entry => entry.id === testId);
    if (method) {
      const { renderMethod } = await import('./listening-methods.js?v=3');
      if (!signal.aborted) await renderMethod({ method, exerciseId, content, signal });
      return;
    }
    if (exerciseId) throw new Error('Không tìm thấy bài luyện');
    const entry = catalog?.tests?.find(t => t.id === testId);
    if (!entry || !rules.safePath(entry.file)) throw new Error('Không tìm thấy bài thi');
    const test = await json(entry.file, signal);
    if (signal.aborted) return;
    const invalid = rules.validateTest(test);
    if (invalid.length) throw new Error(`Dữ liệu bài thi không hợp lệ: ${invalid[0]}`);
    const mode = new URLSearchParams(query).get('mode') === 'exam' ? 'exam' : 'practice';
    mount(test, mode, content, rules);
  }
  function mount(test, mode, content, rules) {
    const key = `listening:${test.id}:${mode}`;
    let answers = {};
    try {
      const saved = JSON.parse(sessionStorage.getItem(key));
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) answers = saved;
    } catch { /* Storage may be disabled or full. */ }
    let selected = 0, playing = 0, submitted = false, result;
    let phase = 'ready', anchor = 0, resetting = false, dead = false, failed = false;
    let started = 0, reviewUntil = 0, loaded = false;
    const audio = document.createElement('audio');
    audio.preload = 'metadata'; // Native controls are deliberately never enabled.
    const root = document.createElement('section'); root.className = 'lt';
    content.replaceChildren(root);
    root.innerHTML = `<header class="lt-head"><a href="#/ielts-gt/listening">Danh sách bài thi</a><h1>${esc(test.title)}</h1><p class="lt-mode--${mode}">${mode === 'exam' ? 'Thi thử' : 'Luyện tập'}</p><p class="lt-progress" role="status" aria-live="polite"></p></header><div class="lt-tabs" role="tablist" aria-label="Các phần câu hỏi">${test.parts.map((p, i) => `<button class="lt-tab aero-btn" type="button" id="lt-tab-${i}" role="tab" aria-selected="${i === 0}" aria-controls="lt-paper" tabindex="${i === 0 ? 0 : -1}" data-part="${i}">Part ${p.part}</button>`).join('')}</div><div class="lt-audio"></div><p class="lt-timer" role="timer" aria-live="off"></p><div class="lt-paper" id="lt-paper" role="tabpanel" aria-labelledby="lt-tab-0"></div><div class="lt-submit"><button type="button" class="lt-btn lt-btn--primary aero-btn" data-action="submit">Nộp bài</button></div><div class="lt-result" aria-live="polite"></div>`;
    const bar = root.querySelector('.lt-audio');
    const paper = root.querySelector('.lt-paper');
    const timer = root.querySelector('.lt-timer');
    function save() { try { sessionStorage.setItem(key, JSON.stringify(answers)); } catch { /* Optional persistence. */ } }
    function updateProgress() { root.querySelector('.lt-progress').textContent = `Đã làm ${rules.progress(test, answers)}/40`; }
    function audioBar() {
      const practice = mode === 'practice';
      bar.innerHTML = `<p data-audio-part>Audio: Part ${playing + 1}</p><p data-audio-error role="status" hidden></p>${practice ? '<button type="button" class="lt-btn aero-btn" data-action="play">Phát / Tạm dừng</button>' + [-10, -5, 5, 10].map(n => `<button class="lt-btn aero-btn" type="button" data-jump="${n}" aria-label="${n < 0 ? 'Lùi' : 'Tới'} ${Math.abs(n)} giây">${n > 0 ? '+' : '−'}${Math.abs(n)}s</button>`).join('') + '<label>Vị trí <input class="lt-seek" aria-label="Vị trí audio" type="range" min="0" max="0" step="0.1" value="0"></label><label>Tốc độ <select class="lt-speed" aria-label="Tốc độ"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label>' : '<p>Audio chạy liên tục qua 4 phần. Sau phần 4, bạn có 2 phút kiểm tra lại. Rời trang sẽ kết thúc lượt thi này.</p><button type="button" class="lt-btn lt-btn--primary aero-btn" data-action="start">Bắt đầu</button>'}<label>Âm lượng <input class="lt-volume" aria-label="Âm lượng" type="range" min="0" max="1" step="0.05" value="1"></label><span class="lt-time"></span>`;
      bar.append(audio);
    }
    function audioError(message = 'Chưa có audio cho phần này') {
      failed = true;
      const status = bar.querySelector('[data-audio-error]'); status.hidden = false; status.textContent = message;
      // Learners can still complete answers and submit if an asset is absent.
      if (mode === 'exam' && !submitted) {
        const button = bar.querySelector('[data-action="start"]'); button.hidden = false; button.textContent = 'Thử tải audio lại';
      }
    }
    function setAudio(index) {
      resetting = true; audio.pause(); playing = index; anchor = 0; loaded = false; failed = false;
      bar.querySelector('[data-audio-part]').textContent = `Audio: Part ${playing + 1}`;
      bar.querySelector('[data-audio-error]').hidden = true;
      audio.src = test.parts[index].audio; audio.load(); updateTime();
    }
    async function play() {
      try { await audio.play(); }
      catch (error) { if (!dead && !submitted) audioError(error.name === 'NotAllowedError' ? 'Trình duyệt chưa cho phát audio. Nhấn nút phát để tiếp tục.' : 'Chưa có audio cho phần này'); }
    }
    function updateTime() {
      const clock = n => `${Math.floor((n || 0) / 60)}:${String(Math.floor((n || 0) % 60)).padStart(2, '0')}`;
      bar.querySelector('.lt-time').textContent = `${clock(audio.currentTime)} / ${clock(Number.isFinite(audio.duration) ? audio.duration : 0)}`;
      const seek = bar.querySelector('.lt-seek');
      if (seek) { seek.max = Number.isFinite(audio.duration) ? audio.duration : 0; seek.value = audio.currentTime; }
      if (mode === 'exam') {
        if (phase === 'review') timer.textContent = `Thời gian kiểm tra lại: ${clock(Math.max(0, Math.ceil((reviewUntil - Date.now()) / 1000)))}`;
        else if (phase === 'playing') timer.textContent = `Đang nghe Part ${playing + 1} · Đã qua ${clock((Date.now() - started) / 1000)}`;
        else timer.textContent = submitted ? 'Đã nộp bài' : 'Sẵn sàng';
      }
    }
    function jump(seconds) {
      if (mode !== 'practice' || !loaded || !Number.isFinite(audio.duration)) return;
      audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds)); updateTime();
    }
    function feedback(question) {
      if (!submitted) return '';
      const mark = result.questions[question.n];
      return `<div class="lt-feedback"><p>${mark.correct ? '✓ Đúng' : '✗ Chưa đúng'} · Bạn trả lời: ${esc(mark.given || '(bỏ trống)')} · Đáp án: ${esc(mark.answer)}</p><p class="lt-explain">${esc(question.explanation)}</p><blockquote class="lt-evidence">${esc(question.evidence)}</blockquote><div class="lt-distractors"><strong>Bẫy</strong><ul>${question.distractors.map(d => `<li>${esc(d.text)}: ${esc(d.why)}</li>`).join('')}</ul>${question.distractors.length ? '' : '<p>Không có bẫy bổ sung.</p>'}</div></div>`;
    }
    function options(question, group, multi = false) {
      const list = group.type === 'mcq' ? question.options : group.options;
      return `<div class="lt-options">${list.map(option => `<label class="lt-option"><input type="${multi ? 'checkbox' : 'radio'}" name="q${question.n}" data-n="${question.n}" ${multi ? 'data-multi' : ''} value="${esc(option.key)}" ${multi ? (Array.isArray(answers[question.n]) && answers[question.n].includes(option.key) ? 'checked' : '') : (answers[question.n] === option.key ? 'checked' : '')} ${submitted ? 'disabled' : ''}> ${esc(option.key)}. ${esc(option.text)}</label>`).join('')}</div>`;
    }
    function transcript(part) {
      const evidence = [...new Set(part.groups.flatMap(g => g.questions.map(q => q.evidence)))].sort((a, b) => b.length - a.length);
      const pattern = new RegExp(evidence.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
      // Match raw text first, then escape every segment so scripts cannot inject HTML.
      const highlight = text => {
        let html = '', end = 0;
        for (const match of text.matchAll(pattern)) { html += esc(text.slice(end, match.index)) + `<mark class="lt-hl">${esc(match[0])}</mark>`; end = match.index + match[0].length; }
        return html + esc(text.slice(end));
      };
      return `<section class="lt-transcript"><h3>Transcript · Part ${part.part}</h3>${part.script.map(s => 'pause' in s ? `<p>[Nghỉ ${esc(s.pause)} giây: ${esc(s.note || '')}]</p>` : `<p lang="en"><strong>${esc(s.speaker)}:</strong> ${highlight(s.text)}</p>`).join('')}</section>`;
    }
    function gap(question, prompt = question.prompt) {
      const input = `<input class="lt-gap" id="lt-q-${question.n}" data-n="${question.n}" name="q${question.n}" aria-label="${esc(`Question ${question.n}: ${question.prompt.replace('{{blank}}', '…')}`)}" value="${esc(answers[question.n] || '')}" autocomplete="off" spellcheck="false" ${submitted ? 'disabled' : ''}>`;
      return `<label for="lt-q-${question.n}">${esc(prompt).replace('{{blank}}', input)}</label>`;
    }
    function questionMarkup(question, group, table = false) {
      const cls = submitted ? (result.questions[question.n].correct ? ' lt-q--correct' : ' lt-q--wrong') : '';
      if (table) {
        const cells = question.prompt.split(' | ');
        return `<tr role="row" class="lt-q${cls}" data-question="${question.n}">${cells.map((cell, i) => `<td role="cell">${i === 0 ? `<strong>${question.n}.</strong> ` : ''}${cell.includes('{{blank}}') ? gap(question, cell) + feedback(question) : esc(cell)}</td>`).join('')}</tr>`;
      }
      let field;
      if (rules.GAP_TYPES.includes(group.type)) field = `<strong>${question.n}.</strong> ${gap(question)}`;
      else if (group.type !== 'mcq-multi') field = `<fieldset><legend>${question.n}. ${esc(question.prompt || '')}</legend>${options(question, group)}</fieldset>`;
      else field = `<p>Câu ${question.n}</p>`;
      return `<div class="lt-q${cls}" data-question="${question.n}">${field}${feedback(question)}</div>`;
    }
    function groupQuestions(group) {
      // Older table prompts have no column delimiter; keep their inline layout.
      const table = group.type === 'table' && group.questions.every(q => q.prompt.includes(' | '));
      const rows = group.questions.map(q => questionMarkup(q, group, table)).join('');
      return table ? `<div class="table-scroll"><table role="table" class="lt-table" lang="en"><caption class="visually-hidden">${esc(group.title || `Questions ${group.range.join('–')}`)}</caption><tbody role="rowgroup">${rows}</tbody></table></div>` : rows;
    }
    function drawPaper() {
      const part = test.parts[selected];
      paper.setAttribute('aria-labelledby', `lt-tab-${selected}`);
      root.querySelectorAll('.lt-tab').forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === selected)); tab.tabIndex = i === selected ? 0 : -1; });
      paper.innerHTML = `<h2>${esc(part.title)}</h2><p lang="en">${esc(part.context)}</p>${part.groups.map(group => `<section class="lt-group"><h3>${esc(group.title || `Questions ${group.range.join('–')}`)}</h3><p class="lt-instructions" lang="en">${esc(group.instructions)}</p>${group.image ? `<img class="lt-map" src="${esc(group.image)}" alt="${esc(group.title || 'Sơ đồ địa điểm cho câu hỏi ' + group.range.join('–'))}">` : ''}${group.type === 'mcq-multi' ? `<fieldset><legend>Questions ${group.range.join('–')} · Chọn ${group.questions.length} đáp án</legend>${options(group.questions[0], group, true)}</fieldset>` : ''}${groupQuestions(group)}</section>`).join('')}${submitted ? transcript(part) : ''}`;
    }
    function choose(index) {
      selected = index; drawPaper();
      if (mode === 'practice') setAudio(index);
    }
    function submit() {
      if (submitted) return;
      submitted = true; phase = 'done'; setRunningExam(false); result = rules.grade(test, answers); audio.pause();
      root.querySelector('.lt-submit').hidden = true;
      const start = bar.querySelector('[data-action="start"]'); if (start) start.hidden = true;
      root.querySelector('.lt-result').innerHTML = `<h2 tabindex="-1">Kết quả</h2><p class="lt-score">${result.score}/40</p><p class="lt-band">Band ${result.band} (ước tính)</p><p>Chọn từng Part để xem giải thích, Bẫy và transcript.</p><button type="button" class="lt-btn aero-btn" data-action="reset">Làm lại</button>`;
      drawPaper(); updateTime(); root.querySelector('.lt-result h2').focus();
    }
    function reset() {
      answers = {}; save(); submitted = false; phase = 'ready'; setRunningExam(false); started = 0; reviewUntil = 0;
      selected = 0; root.querySelector('.lt-submit').hidden = false; root.querySelector('.lt-result').replaceChildren();
      audioBar(); setAudio(0); drawPaper(); updateProgress();
    }
    function keydown(e) {
      if (mode !== 'practice' || e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input, select, textarea, button, a, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); jump((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 5)); }
      if (e.code === 'Space') { e.preventDefault(); if (audio.paused) play(); else audio.pause(); }
    }
    function unload(e) { if (runningExam) { e.preventDefault(); e.returnValue = ''; } }
    root.addEventListener('click', e => {
      const tab = e.target.closest('[data-part]'); if (tab) choose(Number(tab.dataset.part));
      const skip = e.target.closest('[data-jump]'); if (skip) jump(Number(skip.dataset.jump));
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'play') { if (audio.paused) play(); else audio.pause(); }
      if (action === 'submit') submit();
      if (action === 'reset') reset();
      if (action === 'start' && !submitted) {
        if (phase === 'ready' && !window.confirm('Bắt đầu thi thử? Audio chạy liên tục, không tạm dừng hoặc nghe lại.')) return;
        if (phase === 'ready') { started = Date.now(); phase = 'playing'; setRunningExam(true); }
        failed = false; e.target.hidden = true;
        if (audio.error) { resetting = true; audio.load(); }
        play();
      }
    });
    root.querySelector('.lt-tabs').addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); choose(e.key === 'Home' ? 0 : e.key === 'End' ? 3 : (selected + (e.key === 'ArrowRight' ? 1 : 3)) % 4);
      root.querySelector(`[data-part="${selected}"]`).focus();
    });
    root.addEventListener('input', e => {
      const input = e.target;
      if (input.matches('.lt-volume')) audio.volume = Number(input.value);
      if (input.matches('.lt-seek') && mode === 'practice' && loaded) { audio.currentTime = Number(input.value); updateTime(); }
      if (input.matches('.lt-speed') && mode === 'practice') audio.playbackRate = Number(input.value);
      if (!input.dataset.n || submitted) return;
      if (input.hasAttribute('data-multi')) {
        const chosen = [...paper.querySelectorAll(`[data-n="${input.dataset.n}"]:checked`)];
        const group = test.parts[selected].groups.find(g => g.questions[0].n === Number(input.dataset.n));
        if (chosen.length > group.questions.length) { input.checked = false; return; }
        answers[input.dataset.n] = chosen.map(n => n.value);
      } else answers[input.dataset.n] = input.value;
      save(); updateProgress();
    });
    audio.addEventListener('loadedmetadata', () => { loaded = true; resetting = false; anchor = 0; updateTime(); });
    audio.addEventListener('timeupdate', () => {
      if (mode === 'exam' && phase === 'playing' && !audio.seeking && !resetting) anchor = audio.currentTime;
      updateTime();
    });
    audio.addEventListener('seeking', () => {
      if (mode === 'exam' && !resetting && Math.abs(audio.currentTime - anchor) > 0.05) audio.currentTime = anchor;
    });
    audio.addEventListener('ratechange', () => { if (mode === 'exam' && audio.playbackRate !== 1) audio.playbackRate = 1; });
    audio.addEventListener('pause', () => {
      if (mode === 'exam' && phase === 'playing' && !submitted && !resetting && !failed && !audio.ended && !audio.error) play();
    });
    audio.addEventListener('error', () => { if (!dead) audioError(); });
    audio.addEventListener('ended', () => {
      if (mode !== 'exam' || phase !== 'playing' || submitted) return;
      if (playing < 3) { resetting = true; setAudio(playing + 1); choose(playing); play(); }
      else { phase = 'review'; reviewUntil = Date.now() + 120000; updateTime(); }
    });
    window.addEventListener('keydown', keydown);
    window.addEventListener('beforeunload', unload);
    const tick = setInterval(() => {
      if (phase === 'review' && Date.now() >= reviewUntil) submit();
      else if (mode === 'exam') updateTime();
    }, 250);
    dispose = () => {
      dead = true; setRunningExam(false); phase = 'done'; clearInterval(tick);
      window.removeEventListener('keydown', keydown); window.removeEventListener('beforeunload', unload);
      audio.pause(); audio.removeAttribute('src'); audio.load();
    };
    audioBar(); drawPaper(); setAudio(0); updateProgress();
  }
  window.Listening = {
    render,
    loadCatalog,
    isExamRunning() { return runningExam; },
    dispose() { dispose(); dispose = () => {}; },
    allowLeave() { return !runningExam || window.confirm('Bạn đang thi thử. Rời trang sẽ kết thúc lượt thi này. Tiếp tục?'); }
  };
})();
