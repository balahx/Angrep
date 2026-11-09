/* Selector de número tipo rueda (boceto Angrep). Las casillas siguen siendo editables con teclado;
   la rueda es un atajo: A.wheel.pick (hoja con ruedas), A.wheel.attach (botón junto a una casilla) y A.wheel.setPicker (kg y repeticiones). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, U = A.util, IH = 44;

  const range = (a, b, step, fmt) => { const o = []; for (let v = a; v <= b + 1e-9; v += step) { const x = Math.round(v * 100) / 100; o.push({ v: x, t: fmt ? fmt(x) : String(x) }); } return o; };
  const near = (items, v) => { let bi = 0, bd = Infinity; items.forEach((it, i) => { const d = Math.abs(it.v - v); if (d < bd) { bd = d; bi = i; } }); return bi; };

  /* cols: [{ items:[{v,t}], value, label }]. Devuelve una promesa con los valores elegidos, o null si se cancela. */
  function pick(title, cols) {
    return new Promise(res => {
      const idx = cols.map(c => near(c.items, c.value)), wrap = h('div', { class: 'wheels' }), cells = [];
      cols.forEach((c, ci) => {
        const list = h('div', { class: 'wheel', tabindex: '0', role: 'spinbutton', 'aria-label': c.label || title, 'aria-valuenow': String(c.items[idx[ci]].v), 'aria-valuetext': c.items[idx[ci]].t });
        list.appendChild(h('div', { class: 'wheel-pad' }));
        c.items.forEach((it, i) => list.appendChild(h('div', { class: 'wheel-it', onclick: () => list.scrollTo({ top: i * IH, behavior: 'smooth' }) }, it.t)));
        list.appendChild(h('div', { class: 'wheel-pad' }));
        const upd = () => { const i = Math.max(0, Math.min(c.items.length - 1, Math.round(list.scrollTop / IH))); idx[ci] = i; list.setAttribute('aria-valuenow', String(c.items[i].v)); list.setAttribute('aria-valuetext', c.items[i].t); [].forEach.call(list.querySelectorAll('.wheel-it'), (n, k) => n.classList.toggle('on', k === i)); };
        list.addEventListener('scroll', upd);
        list.addEventListener('keydown', e => { const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0; if (d) { e.preventDefault(); list.scrollTo({ top: Math.max(0, Math.min(c.items.length - 1, idx[ci] + d)) * IH }); } });
        if (ci) wrap.appendChild(h('span', { class: 'wheel-sep' }, c.sep || ''));
        wrap.appendChild(list); cells.push({ list, upd, i0: idx[ci] });
      });
      wrap.appendChild(h('div', { class: 'wheel-band', 'aria-hidden': 'true' }));
      const m = A.ui.modal(title, wrap, [{ label: 'Cancelar', kind: 'ghost', value: null }, { label: 'Listo', value: true, run: () => res(cols.map((c, i) => c.items[idx[i]].v)) }], { onClose: v => { if (v !== true) res(null); } });
      cells.forEach(x => { x.list.scrollTop = x.i0 * IH; x.upd(); }); cells[0].list.focus();
    });
  }

  const fire = inp => inp.dispatchEvent(new Event('input', { bubbles: true }));
  const split = (v, dec) => { const f = Math.pow(10, dec), t = Math.round(v * f); return [Math.floor(t / f), t % f]; };

  /* Rueda de un número decimal (entero + decimales). opt: { min, max, dec (1 por defecto), unit, title, start } */
  function number(inp, opt) {
    const dec = opt.dec == null ? 1 : opt.dec, cur = U.parseNum(inp.value), v0 = cur != null ? cur : (opt.start != null ? opt.start : opt.min), s = split(Math.min(opt.max, Math.max(opt.min, v0)), dec);
    const cols = [{ items: range(Math.floor(opt.min), Math.floor(opt.max), 1), value: s[0], label: (opt.title || 'Valor') + ', parte entera' }];
    if (dec) cols.push({ items: range(0, Math.pow(10, dec) - 1, 1, x => String(x).padStart(dec, '0')), value: s[1], sep: ',', label: 'decimales' });
    return pick((opt.title || 'Valor') + (opt.unit ? ' (' + opt.unit + ')' : ''), cols).then(r => { if (!r) return; const val = dec ? r[0] + r[1] / Math.pow(10, dec) : r[0]; inp.value = String(val).replace('.', ','); fire(inp); inp.focus(); });
  }

  /* Casilla con botón de rueda al lado (devuelve el contenedor). */
  function attach(inp, opt) {
    const b = h('button', { class: 'btn ghost wheel-btn', type: 'button', 'aria-label': 'Elegir ' + (opt.title || 'valor').toLowerCase() + ' con la rueda', onclick: () => number(inp, opt) }, '⇅');
    return h('div', { class: 'wheel-wrap' }, inp, b);
  }

  /* Botón "kg ×" de una serie: abre dos ruedas (kilos y repeticiones). */
  function setPicker(kg, reps, label) {
    return h('button', { class: 'btn ghost sm setwheel', type: 'button', 'aria-label': 'Elegir kilos y repeticiones con la rueda' + (label ? ' de ' + label : ''), onclick: () => {
      const k = U.parseNum(kg.value), r = U.parseNum(reps.value), half = k == null || Math.abs(k * 2 - Math.round(k * 2)) < 1e-9, sp = split(k == null ? 0 : k, 1);
      const dItems = half ? [{ v: 0, t: '0' }, { v: 5, t: '5' }] : range(0, 9, 1);
      pick('Kilos y repeticiones', [{ items: range(0, 400, 1), value: sp[0], label: 'Kilos' }, { items: dItems, value: sp[1], sep: ',', label: 'Decimales de kilo' }, { items: range(1, 100, 1), value: r == null ? 5 : r, sep: '×', label: 'Repeticiones' }]).then(x => {
        if (!x) return; kg.value = String(x[0] + x[1] / 10).replace('.', ','); fire(kg); reps.value = String(x[2]); fire(reps); });
    } }, 'kg ×');
  }

  A.wheel = { pick, number, attach, setPicker };
})(window);
