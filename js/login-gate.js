/* Acceso con cuenta (fase 9): si la app tiene un proyecto de Firebase, no se muestra nada hasta iniciar sesión con correo y contraseña.
   La sesión queda guardada en el dispositivo (sirve sin conexión). Es una barrera de la pantalla: los datos del dispositivo no se cifran;
   lo que protege lo de la nube son las reglas de Firestore (firestore.rules). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  function need() { return !!(A.defaultFirebase || A.cloud.configured()); }
  function ensureCfg() { const s = A.store; if (!A.cloud.configured() && A.defaultFirebase) s.setLocal({ syncCfg: A.defaultFirebase }); }

  function require(then) {
    if (!need()) { then(); return; }
    ensureCfg(); A.cloud.start();
    if (A.cloud.signedIn()) { then(); return; }
    const h = A.ui.h, em = h('input', { class: 'txt', id: 'lg-email', type: 'email', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Correo', placeholder: 'Correo', value: A.store.getLocal().syncLastEmail || '' }),
      pw = h('input', { class: 'txt', id: 'lg-pw', type: 'password', autocomplete: 'current-password', 'aria-label': 'Contraseña', placeholder: 'Contraseña' }),
      err = h('p', { class: 'note warn', role: 'alert', id: 'lg-err' }), btn = h('button', { class: 'btn', type: 'submit', id: 'lg-go' }, 'Entrar');
    const form = h('form', { class: 'lock-box', novalidate: 'novalidate' }, A.ui.icon('lock'), h('h1', null, 'Angrep'), h('p', { class: 'muted' }, 'Inicia sesión para entrar'), em, pw, err, btn,
      h('p', { class: 'muted' }, 'La cuenta se crea una sola vez en la consola de Firebase. Tus datos siguen guardándose en este dispositivo.'));
    const screen = h('div', { class: 'lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Iniciar sesión' }, form);
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); err.textContent = '';
      if (!em.value.trim() || !pw.value) { err.textContent = 'Escribe tu correo y tu contraseña.'; return; }
      btn.disabled = true; btn.textContent = 'Entrando…';
      try { await A.cloud.signIn(em.value, pw.value); A.store.setLocal({ syncLastEmail: em.value.trim() }); screen.remove(); then(); }
      catch (e) { err.textContent = e && e.message || 'No se pudo iniciar sesión.'; btn.disabled = false; btn.textContent = 'Entrar'; pw.value = ''; pw.focus(); }
    });
    document.body.appendChild(screen); (em.value ? pw : em).focus();
  }
  A.loginGate = { require, need };
})(window);
