/* Piezas de interfaz comunes: crear elementos, iconos, avisos, confirmaciones y descargas. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};

  /* h('div', {class:'x', onclick:fn}, 'texto', [hijos]) */
  function h(tag, props) {
    const el = document.createElement(tag);
    if (props) Object.keys(props).forEach(k => {
      const v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    const add = k => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    };
    for (let i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  }

  const ICONS = {
    home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    scale: 'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 10a4 4 0 0 1 8 0M12 10l2-2',
    food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10',
    dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
    data: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
    lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3'
  };
  function icon(name) {
    const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    p.setAttribute('d', ICONS[name] || ''); s.appendChild(p);
    return s;
  }

  let toastTimer = null;
  /* Aviso breve. Con action = { label, run } muestra un botón (p. ej. «Deshacer») y dura más. */
  function toast(msg, action) {
    const box = document.getElementById('toast'); if (!box) return;
    box.textContent = msg; box.classList.toggle('act', !!action);
    if (action) box.appendChild(h('button', { class: 'toast-btn', type: 'button', onclick: () => { box.classList.remove('show'); clearTimeout(toastTimer); action.run(); } }, action.label));
    box.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('show'), action ? 7000 : 3200);
  }
  /* Campo de formulario: etiqueta + control + ayuda opcional */
  const field = (id, label, input, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('p', { class: 'hint' }, hint) : null);

  /* Ventana modal sencilla. Devuelve { close, el }. */
  function modal(title, body, actions, opt) {
    const prev = document.activeElement;
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const close = v => { back.remove(); if (prev && prev.focus) prev.focus(); if (opt && opt.onClose) opt.onClose(v); };
    box.appendChild(h('h2', null, title)); box.appendChild(body);
    const row = h('div', { class: 'row-end' });
    (actions || []).forEach(a => row.appendChild(h('button', { class: 'btn ' + (a.kind || ''), type: 'button', onclick: () => { if (!a.keep) close(a.value); if (a.run) a.run(box); } }, a.label)));
    box.appendChild(row); back.appendChild(box);
    back.addEventListener('keydown', e => { if (e.key === 'Escape' && !(opt && opt.sticky)) close(false); });
    document.body.appendChild(back);
    const f = box.querySelector('input,button'); if (f) f.focus();
    return { close: close, el: box };
  }
  const confirmBox = (title, text, okLabel, danger) => new Promise(res => {
    modal(title, h('p', null, text), [{ label: 'Cancelar', value: false, kind: 'ghost' }, { label: okLabel || 'Aceptar', value: true, kind: danger ? 'danger' : '' }], { onClose: res });
  });

  /* Descarga un texto como archivo; si el navegador no deja, lo muestra para copiar */
  function download(name, text, mime) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' })), a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) {
      modal('Copia el contenido', h('textarea', { class: 'txt area', rows: 8, readonly: true }, text), [{ label: 'Cerrar' }]);
      return false;
    }
  }

  /* Logo de Angrep: dos versiones (claro y oscuro); el CSS muestra la que corresponde al tema */
  const logo = (size, cls) => h('span', { class: 'logo ' + (cls || '') }, h('img', { class: 'lg-l', src: 'logo/angrep-logo-claro.svg', alt: 'Angrep', width: size, height: size }), h('img', { class: 'lg-d', src: 'logo/angrep-logo-oscuro.svg', alt: 'Angrep', width: size, height: size }));
  A.ui = { h, icon, logo, toast, field, modal, confirm: confirmBox, download };
})(window);
