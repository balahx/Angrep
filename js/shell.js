/* Estructura de la pantalla: menú (barra inferior en celular, lateral en computador), pestañas de secciones y rutas (#/menu/sub/sección). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, N = A.nav;
  A.views = A.views || {};
  let navEl, subEl, tabEl, viewEl, titleEl, flagEl;

  function mount(host) {
    navEl = h('nav', { class: 'nav', 'aria-label': 'Menú principal' });
    N.MENUS.forEach(m => navEl.appendChild(h('a', { class: 'nav-item', href: N.href(m.id), 'data-menu': m.id },
      A.ui.icon(m.icon), h('span', { class: 'lbl-long' }, m.label), h('span', { class: 'lbl-short' }, m.short || m.label))));
    titleEl = h('h1', { id: 'title' });
    flagEl = h('span', { class: 'flag', id: 'flag', role: 'status' });
    subEl = h('div', { class: 'tabs sub', role: 'navigation', 'aria-label': 'Tipo de entrenamiento' });
    tabEl = h('div', { class: 'tabs', role: 'navigation', 'aria-label': 'Secciones' });
    viewEl = h('main', { id: 'view', tabindex: '-1' });
    host.appendChild(h('div', { class: 'shell' }, navEl,
      h('div', { class: 'content' }, h('header', { class: 'top' }, titleEl, flagEl), subEl, tabEl, viewEl)));
    A.store.on(updateFlag);
    updateFlag();
  }

  function updateFlag() {
    if (!flagEl) return;
    const s = A.store.status();
    flagEl.textContent = s.ok ? '' : 'Sin espacio: no se está guardando';
    flagEl.className = 'flag' + (s.ok ? '' : ' warn');
  }

  const link = (href, label, on) => h('a', { class: 'tab', href: href, 'aria-current': on ? 'page' : null }, label);

  function render() {
    const r = N.resolve(location.hash);
    A.shell.key = r.key;   // pantalla actual: lo usan los «Deshacer» para no redibujar otra pantalla
    if (location.hash !== r.path) history.replaceState(null, '', r.path);
    navEl.querySelectorAll('.nav-item').forEach(a => { if (a.getAttribute('data-menu') === r.menu.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    titleEl.textContent = r.menu.label;
    subEl.innerHTML = ''; tabEl.innerHTML = '';
    subEl.hidden = !r.menu.subs; tabEl.hidden = !(r.menu.sections || (r.sub && r.sub.sections));
    if (r.menu.subs) r.menu.subs.forEach(s => subEl.appendChild(link(N.href(r.menu.id, s.id), s.label, s.id === r.sub.id)));
    const secs = r.sub ? r.sub.sections : r.menu.sections;
    if (secs) secs.forEach(s => tabEl.appendChild(link(N.href(r.menu.id, r.sub && r.sub.id, s.id), s.label, s.id === r.section.id)));
    if (A.charts) A.charts.destroyAll();
    viewEl.innerHTML = '';
    const fn = A.views[r.key];
    try { (fn || placeholder(r))(viewEl, r); }
    catch (e) { viewEl.appendChild(h('div', { class: 'card' }, h('p', { class: 'note warn', role: 'alert' }, 'No se pudo mostrar esta pantalla: ' + e.message))); }
    document.title = (r.section ? r.section.label + ' · ' : '') + r.menu.label + ' · Seguimiento';
    const act = tabEl.querySelector('[aria-current]'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
    viewEl.scrollTop = 0; window.scrollTo(0, 0);
  }

  /* Pantalla de una sección que aún no se construye: dice cuándo llega y qué incluirá */
  function placeholder(r) {
    const phase = r.section ? r.section.phase : r.menu.phase, items = r.section ? r.section.items : r.menu.items;
    return el => el.appendChild(h('section', { class: 'card empty' },
      h('span', { class: 'chip' }, 'Fase ' + phase + ' · pendiente'),
      h('h2', null, r.section ? r.section.label : r.menu.label),
      h('p', { class: 'muted' }, 'Esta pantalla se construye en la fase ' + phase + '. Va a incluir:'),
      h('ul', null, (items || []).map(i => h('li', null, i)))));
  }

  function start() {
    window.addEventListener('hashchange', render);
    render();
  }
  A.shell = { mount, start, render };
})(window);
