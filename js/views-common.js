/* Piezas comunes de las pantallas (tarjetas de cifras, formularios, deshacer, chips, barras de avance). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, U = A.util, store = A.store, V = A.views = A.views || {};

  const signed = (v, d, unit) => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + U.fmtNum(Math.abs(v), d == null ? 1 : d) + (unit ? ' ' + unit : '');
  const longDate = s => { const d = U.parseYmd(s); return d ? U.fmtDate(s) + ' ' + d.getFullYear() : s; };
  const tile = (label, value, sub) => h('div', { class: 'tile' }, h('span', { class: 'tile-l' }, label), h('strong', { class: 'tile-v' }, value), sub ? h('span', { class: 'tile-s' }, sub) : null);
  const tiles = arr => h('div', { class: 'tiles' }, arr);
  const rerender = el => { if (A.shell.key && A.shell.key !== el.__key) return; A.charts.destroyAll(); el.innerHTML = ''; V[el.__key](el); };
  const wrapView = (key, fn) => { V[key] = el => { el.__key = key; fn(el, () => rerender(el)); }; };
  const dateInput = (id, val) => h('input', { class: 'txt', id: id, type: 'date', value: val || U.today(), max: U.today() });
  const errBox = () => h('p', { class: 'note warn', role: 'alert' });
  const optionsOf = (arr, sel) => arr.map(a => h('option', { value: a[0], selected: a[0] === sel }, a[1]));
  /* Borra con «Deshacer» durante unos segundos */
  function removeWithUndo(type, rec, restore, again, text) {
    store.remove(type, rec.id);
    A.ui.toast(text || 'Registro eliminado.', { label: 'Deshacer', run: () => { restore(); again(); } });
    again();
  }
  const chips = (opts, cur, onPick, label) => h('div', { class: 'seg', role: 'group', 'aria-label': label }, opts.map(o => h('button', { type: 'button', class: 'seg-b', 'aria-pressed': String(o[0] === cur), onclick: () => onPick(o[0]) }, o[1])));
  /* Barra de avance hacia una meta: el texto dice lo mismo que la barra (no depende del color) */
  function meter(label, value, goal, unit, d, noOver) {
    const pct = goal ? Math.min(100, Math.round(100 * value / goal)) : 0, over = !noOver && goal && value > goal * 1.1, fill = h('span', { class: 'meter-fill' + (over ? ' over' : '') });
    fill.style.width = pct + '%';
    return h('div', { class: 'meter-wrap' },
      h('div', { class: 'meter-top' }, h('span', null, label), h('span', { class: 'muted' }, U.fmtNum(value, d == null ? 0 : d) + (goal ? ' de ' + U.fmtNum(goal, d == null ? 0 : d) : '') + ' ' + unit + (over ? ' · sobre la meta' : ''))),
      h('div', { class: 'meter', role: 'img', 'aria-label': label + ': ' + U.fmtNum(value, d == null ? 0 : d) + (goal ? ' de ' + U.fmtNum(goal, d == null ? 0 : d) : '') + ' ' + unit }, fill));
  }

  A.vw = { signed, longDate, tile, tiles, rerender, wrapView, dateInput, errBox, optionsOf, removeWithUndo, chips, meter };
})(window);
