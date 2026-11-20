(() => {
  'use strict';
  const base = new URL('./', window.location.href);
  base.hash = '';
  base.search = '';
  const content = document.querySelector('#page-content');
  const status = document.querySelector('#page-status');
  const nav = document.querySelector('#site-nav');
  const toc = document.querySelector('#page-toc');
  const main = document.querySelector('main');
  const menu = document.querySelector('.menu-toggle');
  const gtHub = 'ielts-gt';
  const gtListening = `${gtHub}/listening`;
  const practiceGroup = { id: 'practice-tests', title: 'Practice Tests' };
  const sidebarItemLimit = 8;
  const groupPreferences = new Map();
  let pages = [];
  let navSection;
  let navPage;
  let navGroups = [];
  let request = 0;
  let listeningRequest;
  let previousHash = location.hash;
  let reverting = false;

  function startThemeToggle() {
    const root = document.documentElement;
    const button = document.querySelector('.theme-toggle');
    const system = matchMedia('(prefers-color-scheme: dark)');
    const labels = { system: 'Theo hệ thống', light: 'Sáng', dark: 'Tối' };
    const modes = Object.keys(labels);

    function apply(mode) {
      root.dataset.themeMode = mode;
      root.dataset.theme = mode === 'system' ? (system.matches ? 'dark' : 'light') : mode;
      const label = `Giao diện: ${labels[mode]}`;
      button.setAttribute('aria-label', label);
      button.title = label;
      return label;
    }

    apply(root.dataset.themeMode || 'system');
    button.addEventListener('click', () => {
      const mode = modes[(modes.indexOf(root.dataset.themeMode) + 1) % modes.length];
      try { localStorage.setItem('aec-theme', mode); } catch { /* Storage can be blocked. */ }
      status.textContent = apply(mode);
    });
    system.addEventListener('change', () => {
      if (root.dataset.themeMode === 'system') apply('system');
    });
  }

  function startUpdateChecks() {
    const loadedHash = document.querySelector('meta[name="aec-version"]').content;
    const toast = document.querySelector('#update-toast');
    const title = toast.querySelector('.update-toast__title');
    const text = toast.querySelector('.update-toast__text');
    const versionURL = new URL('version.json', base);
    const hashPattern = /^[a-f0-9]{64}$/;
    const dismissed = new Set();
    const dismissKey = hash => `aec-dismissed:${base.pathname}:${hash}`;
    let offeredHash;
    let checking = false;

    function renderNotice() {
      if (toast.hidden) return;
      const exam = window.Listening?.isExamRunning();
      const message = exam
        ? 'Nội dung vừa được cập nhật. Đang trong lượt thi thử — tải lại trang sẽ làm mất bài đang làm.'
        : 'Nội dung vừa được cập nhật. Tải lại trang để xem bản mới nhất nhé.';
      toast.classList.toggle('update-toast--warn', exam);
      if (!title.textContent) title.textContent = 'Đã có phiên bản mới';
      if (text.textContent !== message) text.textContent = message;
    }

    function hideNotice() {
      const restoreFocus = toast.contains(document.activeElement);
      toast.hidden = true;
      offeredHash = undefined;
      title.textContent = '';
      text.textContent = '';
      if (restoreFocus) main.focus({ preventScroll: true });
    }

    function dismissNotice() {
      dismissed.add(offeredHash);
      try { sessionStorage.setItem(dismissKey(offeredHash), '1'); } catch { /* Storage can be blocked. */ }
      hideNotice();
    }

    async function checkVersion() {
      if (checking) return;
      checking = true;
      try {
        versionURL.searchParams.set('ts', Date.now());
        const response = await fetch(versionURL, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!response.ok) return;
        const { hash } = await response.json();
        if (typeof hash !== 'string' || !hashPattern.test(hash)) return;
        let seen = dismissed.has(hash);
        try { seen ||= sessionStorage.getItem(dismissKey(hash)) === '1'; } catch { /* Storage can be blocked. */ }
        if (hash === loadedHash || seen) {
          if (!toast.hidden) hideNotice();
        } else {
          offeredHash = hash;
          if (toast.hidden) {
            toast.hidden = false;
            requestAnimationFrame(renderNotice);
          }
        }
      } catch { /* A failed poll should leave the current page usable. */ }
      finally { checking = false; }
    }

    if (!hashPattern.test(loadedHash)) return;
    toast.querySelector('.update-toast__reload').addEventListener('click', () => location.reload());
    toast.querySelector('.update-toast__close').addEventListener('click', dismissNotice);
    new ResizeObserver(() => {
      const space = toast.hidden ? 0 : Math.ceil(innerHeight - toast.offsetTop);
      document.documentElement.style.setProperty('--toast-space', `${space}px`);
      const field = document.activeElement;
      if (!toast.hidden && field.matches('.lt-paper :is(input, select, textarea)')) {
        const answer = field.getBoundingClientRect();
        const notice = toast.getBoundingClientRect();
        if (answer.bottom > toast.offsetTop && answer.right > notice.left && answer.left < notice.right) {
          field.scrollIntoView({ block: 'nearest' });
        }
      }
    }).observe(toast);
    window.addEventListener('listeningexamchange', renderNotice);
    window.addEventListener('focus', checkVersion);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkVersion();
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || event.defaultPrevented || toast.hidden) return;
      dismissNotice();
    });
    setInterval(checkVersion, 5 * 60 * 1000);
    checkVersion();
  }

  function routeURL(id, section = '') {
    return `#/${encodeURIComponent(id)}${section ? `?section=${encodeURIComponent(section)}` : ''}`;
  }
  function message(title, description) {
    const heading = document.createElement('h1');
    heading.textContent = title;
    const paragraph = document.createElement('p');
    paragraph.textContent = description;
    content.replaceChildren(heading, paragraph);
    toc.replaceChildren();
  }
  function closeMenu() {
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('pointerdown', event => {
    if (nav.classList.contains('is-open') && !menu.contains(event.target) && !nav.contains(event.target)) {
      closeMenu();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented && menu.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      closeMenu();
      menu.focus({ preventScroll: true });
    }
  });

  function navLink(id, title, href = routeURL(id)) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = title;
    if (id) link.dataset.page = id;
    return link;
  }

  function appendNavItem(list, entry) {
    const item = document.createElement('li');
    item.append(entry);
    list.append(item);
    return item;
  }

  function markCurrentNav() {
    for (const entry of nav.querySelectorAll('[data-page]')) {
      if (entry.dataset.page === navPage) entry.setAttribute('aria-current', 'page');
      else entry.removeAttribute('aria-current');
    }
  }

  function buildGtNav() {
    const overview = navLink(gtHub, 'IELTS General');
    overview.className = 'sidebar__overview';
    const skills = document.createElement('ul');
    const listening = appendNavItem(skills, navLink(gtListening, 'Listening', `#/${gtListening}`));
    const groups = document.createElement('ul');
    groups.className = 'sidebar__groups';
    listening.append(groups);
    for (const skill of ['Reading', 'Writing', 'Speaking']) {
      const entry = document.createElement('span');
      entry.className = 'sidebar__soon';
      entry.dataset.page = `${gtHub}/${skill.toLowerCase()}`;
      const badge = document.createElement('small');
      badge.textContent = 'Sắp ra mắt';
      entry.append(`${skill} `, badge);
      appendNavItem(skills, entry);
    }
    nav.append(navLink('home', '← Danh mục học tập'), overview, skills);
  }

  function setGroupOpen({ button, items }, open) {
    button.setAttribute('aria-expanded', String(open));
    items.hidden = !open;
  }

  function syncGtGroups() {
    for (const group of navGroups) {
      setGroupOpen(group, group.routes.has(navPage) || groupPreferences.get(group.key) === true);
    }
  }

  function appendGtGroup(list, { id, title }, entries) {
    const items = document.createElement('ul');
    items.id = `gt-listening-${id}`;
    items.className = 'sidebar__sublist';
    const key = `aec-sidebar:${base.pathname}:${items.id}`;
    if (!groupPreferences.has(key)) {
      try { groupPreferences.set(key, sessionStorage.getItem(key) === 'true'); } catch { /* Storage can be blocked. */ }
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-controls', items.id);
    const count = document.createElement('small');
    count.textContent = entries.length;
    const chevron = document.createElement('span');
    chevron.textContent = '›';
    chevron.setAttribute('aria-hidden', 'true');
    button.append(`${title} `, count, chevron);

    const group = { key, button, items, routes: new Set(entries.map(entry => `${gtListening}/${entry.id}`)) };
    button.addEventListener('click', () => {
      const open = items.hidden;
      groupPreferences.set(key, open);
      try { sessionStorage.setItem(key, String(open)); } catch { /* Storage can be blocked. */ }
      setGroupOpen(group, open);
    });

    for (const { id, title } of entries.slice(0, sidebarItemLimit)) {
      const href = `#/${gtListening}/${encodeURIComponent(id)}?mode=practice`;
      appendNavItem(items, navLink(`${gtListening}/${id}`, title, href));
    }
    if (entries.length > sidebarItemLimit) {
      appendNavItem(items, navLink(null, `Xem tất cả (${entries.length})`, `#/${gtListening}`));
    }
    appendNavItem(list, button).append(items);
    navGroups.push(group);
  }

  async function populateGtGroups(list) {
    let catalog;
    try {
      catalog = await window.Listening?.loadCatalog();
    } catch {
      // Keep the skill links usable and retry on the next IELTS General route.
      return;
    }
    if (!list.isConnected || list.childElementCount || !Array.isArray(catalog?.tests)) return;
    // Catalog groups are ordered {id, title} entries. Each test's optional group names its group id.
    // Older catalogs and tests without a group use the Practice Tests group.
    for (const group of catalog.groups ?? [practiceGroup]) {
      const entries = catalog.tests.filter(entry => (entry.group ?? practiceGroup.id) === group.id);
      if (entries.length) appendGtGroup(list, group, entries);
    }
    markCurrentNav();
    syncGtGroups();
  }

  function buildGlobalNav() {
    const groups = new Map();
    for (const page of pages) {
      if (!groups.has(page.group)) {
        const group = document.createElement('section');
        const title = document.createElement('h2');
        title.textContent = page.group;
        const list = document.createElement('ul');
        group.append(title, list);
        nav.append(group);
        groups.set(page.group, list);
      }
      appendNavItem(groups.get(page.group), navLink(page.id, page.title));
    }
  }

  function buildNav(id, inGt) {
    const routeChanged = navPage !== id;
    navPage = id;
    if (navSection !== inGt) {
      navSection = inGt;
      navGroups = [];
      nav.replaceChildren();
      nav.setAttribute('aria-label', inGt ? 'Danh mục IELTS General' : 'Tài liệu học tập');
      if (inGt) buildGtNav();
      else buildGlobalNav();
    }
    markCurrentNav();
    if (routeChanged) syncGtGroups();
    const pendingGroups = inGt && nav.querySelector('.sidebar__groups:empty');
    if (pendingGroups) populateGtGroups(pendingGroups);
  }

  function prepareContent(page) {
    const used = new Set();
    const list = document.createElement('ul');
    content.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
      const stem = heading.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
      let id = stem;
      let count = 2;
      while (used.has(id)) id = `${stem}-${count++}`;
      used.add(id);
      heading.id = id;
      heading.tabIndex = -1;
      if (heading.matches('h2, h3')) {
        const item = document.createElement('li');
        item.classList.toggle('toc-subheading', heading.matches('h3'));
        const link = document.createElement('a');
        link.href = routeURL(page.id, id);
        link.textContent = heading.textContent;
        item.append(link);
        list.append(item);
      }
    });
    toc.replaceChildren();
    if (list.childElementCount) toc.append(list);
    else {
      const empty = document.createElement('p');
      empty.textContent = 'Trang này chưa có mục lục.';
      toc.append(empty);
    }
    const source = new URL(page.path, base);
    content.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (href.startsWith('#/')) return;
      const target = new URL(href, source);
      if (target.origin !== base.origin) return;
      const match = pages.find(entry => new URL(entry.path, base).pathname === target.pathname);
      if (match) {
        let section = target.hash.slice(1);
        try { section = decodeURIComponent(section); } catch { /* Keep malformed fragments readable. */ }
        link.setAttribute('href', routeURL(match.id, section));
      } else link.href = target.href;
    });
    content.querySelectorAll('img[src]').forEach(img => { img.src = new URL(img.getAttribute('src'), source).href; });
    content.querySelectorAll('table').forEach(table => {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll';
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', 'Bảng dữ liệu');
      // Column headers become data-label on each cell (stacked card layout on narrow screens).
      const headerRow = table.tHead ? table.tHead.rows[0] : null;
      const labels = headerRow ? Array.from(headerRow.cells, cell => cell.textContent.trim()) : [];
      const columns = Math.max(labels.length, ...Array.from(table.rows, row => row.cells.length));
      if (columns >= 5) wrapper.classList.add('table-scroll--wide');
      if (columns >= 7) wrapper.classList.add('table-scroll--many');
      // Explicit roles keep table semantics when CSS switches rows to display: block.
      table.setAttribute('role', 'table');
      Array.from(table.querySelectorAll('thead, tbody, tfoot')).forEach(group => group.setAttribute('role', 'rowgroup'));
      Array.from(table.rows).forEach(row => {
        row.setAttribute('role', 'row');
        Array.from(row.cells).forEach((cell, index) => {
          if (cell.tagName === 'TH') {
            cell.setAttribute('role', cell.closest('thead') ? 'columnheader' : 'rowheader');
          } else {
            cell.setAttribute('role', 'cell');
            if (labels[index]) cell.dataset.label = labels[index];
          }
        });
      });
      table.before(wrapper);
      wrapper.append(table);
    });
  }

  async function render() {
    if (reverting) { reverting = false; return; }
    // Native skip links must not be interpreted as document routes.
    if (location.hash && !location.hash.startsWith('#/') && content.childElementCount) return;
    if (location.hash !== previousHash && window.Listening && !window.Listening.allowLeave()) {
      reverting = true;
      location.replace(previousHash || '#/home');
      return;
    }
    previousHash = location.hash;
    listeningRequest?.abort();
    window.Listening?.dispose();
    const current = ++request;
    const route = location.hash.startsWith('#/') ? location.hash.slice(2) : '';
    const [rawId, query = ''] = route.split('?');
    let id;
    try { id = decodeURIComponent(rawId || 'home'); } catch { id = ''; }
    const page = pages.find(entry => entry.id === id);
    closeMenu();
    const inGt = id === gtHub || id.startsWith(`${gtHub}/`);
    buildNav(id, inGt);
    toc.closest('aside').hidden = inGt;
    if (id === 'ielts-gt' || /^ielts-gt\/(?:listening(?:\/[^/]+)?|reading|writing|speaking)$/.test(id)) {
      listeningRequest = new AbortController();
      main.setAttribute('aria-busy', 'true');
      status.textContent = 'Đang tải IELTS General…';
      document.title = 'IELTS General · Alice English Center';
      toc.replaceChildren();
      try {
        await window.Listening.render({ id, query, content, signal: listeningRequest.signal });
        if (current !== request) return;
        status.textContent = 'IELTS General';
        window.scrollTo(0, 0);
        main.focus({ preventScroll: true });
      } catch (error) {
        if (current !== request || error.name === 'AbortError') return;
        message('Chưa tải được bài thi', error.message);
        status.textContent = 'Có lỗi tải bài thi';
      } finally { if (current === request) main.removeAttribute('aria-busy'); }
      return;
    }
    if (!page) {
      main.removeAttribute('aria-busy');
      message('Không tìm thấy trang', 'Hãy chọn một tài liệu trong danh mục học tập để tiếp tục.');
      document.title = 'Không tìm thấy trang · Alice English Center';
      status.textContent = 'Trang không tồn tại';
      main.focus({ preventScroll: true });
      return;
    }
    document.title = `${page.title} · Alice English Center`;
    status.textContent = 'Đang tải tài liệu…';
    main.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(new URL(page.path, base));
      if (current !== request) return;
      if (response.status === 404) {
        message(`${page.title} — Đang soạn`, 'Tài liệu đang được chuẩn bị. Bạn hãy chọn một nội dung khác trong danh mục và quay lại sau nhé.');
      } else {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const markdown = await response.text();
        if (current !== request) return;
        content.innerHTML = DOMPurify.sanitize(marked.parse(markdown), { SANITIZE_NAMED_PROPS: true });
        prepareContent(page);
      }
      status.textContent = page.group;
      const section = new URLSearchParams(query).get('section');
      const heading = section && Array.from(content.querySelectorAll('[id]')).find(node => node.id === section);
      if (heading) {
        heading.scrollIntoView();
        heading.focus({ preventScroll: true });
      } else {
        window.scrollTo(0, 0);
        main.focus({ preventScroll: true });
      }
    } catch (error) {
      if (current !== request) return;
      message('Chưa tải được tài liệu', 'Hãy kiểm tra kết nối rồi tải lại trang. Nếu bạn đang mở file trực tiếp, vui lòng chạy website qua máy chủ HTTP.');
      status.textContent = 'Có lỗi tải nội dung';
      console.error(error);
    } finally {
      if (current === request) main.removeAttribute('aria-busy');
    }
  }

  async function start() {
    try {
      if (!window.marked || !window.DOMPurify) throw new Error('Thư viện Markdown chưa tải được.');
      const response = await fetch(new URL('content/manifest.json', base));
      if (!response.ok) throw new Error(`Manifest: HTTP ${response.status}`);
      pages = await response.json();
      if (!Array.isArray(pages) || !pages.length || pages.some(page =>
        !['id', 'title', 'group', 'path'].every(key => typeof page[key] === 'string' && page[key].trim()))) {
        throw new Error('Danh mục tài liệu không hợp lệ.');
      }
      menu.hidden = false;
      window.addEventListener('hashchange', render);
      await render();
    } catch (error) {
      message('Chưa thể mở tài liệu', 'Hãy kiểm tra kết nối Internet rồi tải lại trang để tải danh mục và thư viện hiển thị.');
      status.textContent = 'Có lỗi khởi tạo';
      nav.textContent = 'Chưa tải được danh mục.';
      console.error(error);
    }
  }
  startThemeToggle();
  startUpdateChecks();
  start();
})();
