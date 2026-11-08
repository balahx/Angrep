/* Pantalla de bloqueo con teclado numérico. Usa App.lock (lógica) y se pone encima de toda la app. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, lock = A.lock;
  let locked = false, screen = null, hiddenAt = 0, onUnlock = null;

  const appEl = () => document.getElementById('app');
  function setInert(on) { const a = appEl(); if (!a) return; if (on) { a.setAttribute('inert', ''); a.setAttribute('aria-hidden', 'true'); } else { a.removeAttribute('inert'); a.removeAttribute('aria-hidden'); } }

  function show() {
    if (screen) return;
    locked = true; setInert(true);
    let pin = '', busy = false, msg = '';
    const dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
    const status = h('p', { class: 'lock-msg', role: 'status' });
    const draw = () => {
      dots.innerHTML = '';
      for (let i = 0; i < 6; i++) dots.appendChild(h('span', { class: 'dot' + (i < pin.length ? ' on' : '') }));
      status.textContent = msg;
    };
    async function submit() {
      if (busy || pin.length < 4) return;
      busy = true;
      const r = await lock.verify(pin);
      busy = false;
      if (r.ok) { hide(); return; }
      pin = '';
      msg = r.wait ? 'Demasiados intentos. Espera ' + r.wait + ' s.' : 'PIN incorrecto. Te quedan ' + r.left + ' intentos antes de una espera.';
      draw();
    }
    const press = d => { if (busy) return; if (d === 'del') pin = pin.slice(0, -1); else if (pin.length < 6) pin += d; msg = ''; draw(); if (pin.length === 6) submit(); };
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'forgot', '0', 'del'];
    const pad = h('div', { class: 'pad' }, keys.map(k => {
      if (k === 'forgot') return h('button', { class: 'key small', type: 'button', onclick: forgot }, 'Olvidé mi PIN');
      return h('button', { class: 'key', type: 'button', 'aria-label': k === 'del' ? 'Borrar' : k, onclick: () => press(k) }, k === 'del' ? '⌫' : k);
    }));
    screen = h('div', { class: 'lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'App bloqueada' },
      h('div', { class: 'lock-box' }, A.ui.icon('lock'), h('h1', null, 'App bloqueada'), h('p', { class: 'muted' }, 'Escribe tu PIN'), dots, status, pad,
        h('button', { class: 'btn', type: 'button', onclick: submit }, 'Entrar')));
    screen.addEventListener('keydown', e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') submit(); });
    document.body.appendChild(screen); draw(); screen.querySelector('.key').focus();
  }

  function forgot() {
    const input = A.ui.h('input', { class: 'txt', type: 'text', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Código de recuperación', placeholder: 'XXXX-XXXX-XXXX' });
    const err = h('p', { class: 'note warn', role: 'alert' });
    A.ui.modal('Recuperar el acceso', h('div', null,
      h('p', null, 'Escribe el código de recuperación que se mostró al activar el PIN. Se quita el PIN y tus datos no se tocan.'), input, err,
      h('p', { class: 'muted' }, 'Si no tienes el código, solo queda borrar los datos de este dispositivo. No se tocan los respaldos ni los otros dispositivos.')),
    [{ label: 'Cancelar', kind: 'ghost' },
      { label: 'Borrar datos de este dispositivo', kind: 'danger', keep: true, run: async box => {
        const ok = await A.ui.confirm('¿Borrar todo en este dispositivo?', 'Se eliminan los registros guardados aquí y se quita el PIN. Esto no se puede deshacer.', 'Borrar todo', true);
        if (!ok) return;
        A.store.wipe(); lock.disable(); box.closest('.modal-back').remove(); hide(); A.ui.toast('Datos de este dispositivo borrados.');
      } },
      { label: 'Recuperar', keep: true, run: async box => {
        const r = await lock.recover(input.value);
        if (r.ok) { box.closest('.modal-back').remove(); hide(); A.ui.toast('PIN quitado. Puedes crear uno nuevo en Datos → Seguridad.'); }
        else err.textContent = 'Código incorrecto.';
      } }]);
  }

  function hide() { if (screen) { screen.remove(); screen = null; } locked = false; setInert(false); if (onUnlock) { const f = onUnlock; onUnlock = null; f(); } }

  /* Arranque: si hay PIN, pide el PIN antes de mostrar nada; después solo vuelve a pedirlo al regresar tras el tiempo elegido */
  function gate(then) {
    if (lock.enabled()) { onUnlock = then; show(); } else then();
    document.addEventListener('visibilitychange', () => {
      if (!lock.enabled()) return;
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= lock.timeoutMin() * 60000) show();
    });
  }
  A.lockUi = { gate, show, isLocked: () => locked };
})(window);
