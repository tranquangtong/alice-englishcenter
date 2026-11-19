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
  let pages = [];
  let navSection;
  let navPage;
  let request = 0;
  let listeningRequest;
  let previousHash = location.hash;
  let reverting = false;

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
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menu.focus();
    }
  });

  function navLink(id, title, href = routeURL(id)) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = title;
    link.dataset.page = id;
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
    const tests = document.createElement('ul');
    tests.className = 'sidebar__sublist';
    listening.append(tests);
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

  async function populateGtTests(list) {
    let catalog;
    try {
      catalog = await window.Listening?.loadCatalog();
    } catch {
      // Keep the skill links usable and retry on the next IELTS General route.
      return;
    }
    if (!list.isConnected || list.childElementCount || !Array.isArray(catalog?.tests)) return;
    for (const { id, title } of catalog.tests) {
      const href = `#/${gtListening}/${encodeURIComponent(id)}?mode=practice`;
      appendNavItem(list, navLink(`${gtListening}/${id}`, title, href));
    }
    markCurrentNav();
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
    navPage = id;
    if (navSection !== inGt) {
      navSection = inGt;
      nav.replaceChildren();
      nav.setAttribute('aria-label', inGt ? 'Danh mục IELTS General' : 'Tài liệu học tập');
      if (inGt) buildGtNav();
      else buildGlobalNav();
    }
    markCurrentNav();
    const pendingTests = inGt && nav.querySelector('.sidebar__sublist:empty');
    if (pendingTests) populateGtTests(pendingTests);
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
  start();
})();
