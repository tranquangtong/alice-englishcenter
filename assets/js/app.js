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
  let pages = [];
  let request = 0;

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

  function buildNav() {
    nav.replaceChildren();
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
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = routeURL(page.id);
      link.textContent = page.title;
      link.dataset.page = page.id;
      item.append(link);
      groups.get(page.group).append(item);
    }
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
      wrapper.setAttribute('aria-label', 'Bảng dữ liệu, có thể cuộn ngang');
      table.before(wrapper);
      wrapper.append(table);
    });
  }

  async function render() {
    // Native skip links must not be interpreted as document routes.
    if (location.hash && !location.hash.startsWith('#/') && content.childElementCount) return;
    const current = ++request;
    const route = location.hash.startsWith('#/') ? location.hash.slice(2) : '';
    const [rawId, query = ''] = route.split('?');
    let id;
    try { id = decodeURIComponent(rawId || 'home'); } catch { id = ''; }
    const page = pages.find(entry => entry.id === id);
    closeMenu();
    nav.querySelectorAll('a').forEach(link => {
      if (link.dataset.page === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
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
      buildNav();
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
