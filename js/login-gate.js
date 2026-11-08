/* Acceso con cuenta (fase 9): si la app tiene un proyecto de Firebase, no se muestra nada hasta entrar con correo y contraseña,
   o crear una cuenta (pensado para compartirla con cercanos: cada cuenta ve solo sus datos). La sesión queda en el dispositivo (sirve sin conexión).
   Es una barrera de pantalla: los datos del dispositivo no se cifran; lo que separa a las personas en la nube son las reglas de Firestore. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const need = () => !!(A.defaultFirebase || A.cloud.configured());
  const ensureCfg = () => { if (!A.cloud.configured() && A.defaultFirebase) A.store.setLocal({ syncCfg: A.defaultFirebase }); };
  const hasData = () => Object.keys(A.store.counts()).length > 0;

  function require(then) {
    if (!need()) { then(); return; }
    ensureCfg(); A.cloud.start();
    if (A.cloud.signedIn()) { then(); return; }
    const h = A.ui.h; let mode = 'in', busy = false;
    const screen = h('div', { class: 'lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Acceso' });
    const tab = (m, label) => h('button', { class: 'tab' + (mode === m ? ' on' : ''), type: 'button', id: 'lg-tab-' + m, 'aria-pressed': String(mode === m), onclick: () => { mode = m; draw(); } }, label);

    async function submit(f) {
      const email = f.em.value.trim(), pw = f.pw.value; f.err.textContent = ''; f.ok.textContent = '';
      if (!email || !pw) { f.err.textContent = 'Escribe tu correo y tu contraseña.'; return; }
      if (mode === 'up') { if (pw.length < 8) { f.err.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; } if (pw !== f.pw2.value) { f.err.textContent = 'Las contraseñas no coinciden.'; return; } }
      busy = true; f.btn.disabled = true; f.btn.textContent = mode === 'up' ? 'Creando…' : 'Entrando…';
      const prev = A.cloud.prevUid();
      try {
        const r = mode === 'up' ? await A.cloud.signUp(email, pw) : await A.cloud.signIn(email, pw);
        if (prev && prev !== r.uid && hasData()) {
          const ok = await A.ui.confirm('Este dispositivo tiene datos de otra cuenta', 'Para entrar con esta cuenta se borran los datos guardados aquí (siguen en la nube de la otra cuenta si estaban sincronizados; lo que no se alcanzó a sincronizar se pierde).', 'Borrar y entrar', true);
          if (!ok) { A.cloud.signOut(); throw new Error('No se cambió de cuenta.'); }
          A.cloud.switchAccount();
        }
        A.store.setLocal({ syncLastEmail: email, syncOwner: r.uid }); screen.remove();
        if (mode === 'up') A.ui.toast('Cuenta creada. Te enviamos un correo para verificarla.');
        then();
      } catch (e) { f.err.textContent = e && e.message || 'No se pudo continuar.'; busy = false; f.btn.disabled = false; f.btn.textContent = mode === 'up' ? 'Crear cuenta' : 'Entrar'; f.pw.value = ''; if (f.pw2) f.pw2.value = ''; f.pw.focus(); }
    }
    async function forgot(f) {
      const email = f.em.value.trim(); f.err.textContent = ''; f.ok.textContent = '';
      if (!email) { f.err.textContent = 'Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña».'; return; }
      try { await A.cloud.resetPassword(email); f.ok.textContent = 'Si ese correo tiene cuenta, te enviamos un enlace para cambiar la contraseña. Revisa también el spam.'; }
      catch (e) { f.err.textContent = e && e.message || 'No se pudo enviar el correo.'; }
    }
    function draw() {
      const up = mode === 'up', last = A.store.getLocal().syncLastEmail || '';
      const em = h('input', { class: 'txt', id: 'lg-email', type: 'email', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Correo', placeholder: 'Correo', value: last }),
        pw = h('input', { class: 'txt', id: 'lg-pw', type: 'password', autocomplete: up ? 'new-password' : 'current-password', 'aria-label': 'Contraseña', placeholder: up ? 'Contraseña (mínimo 8 caracteres)' : 'Contraseña' }),
        pw2 = up ? h('input', { class: 'txt', id: 'lg-pw2', type: 'password', autocomplete: 'new-password', 'aria-label': 'Repite la contraseña', placeholder: 'Repite la contraseña' }) : null,
        err = h('p', { class: 'note warn', role: 'alert', id: 'lg-err' }), ok = h('p', { class: 'note ok', role: 'status', id: 'lg-ok' }),
        btn = h('button', { class: 'btn', type: 'submit', id: 'lg-go' }, up ? 'Crear cuenta' : 'Entrar'), f = { em, pw, pw2, err, ok, btn };
      const form = h('form', { class: 'lock-box', novalidate: 'novalidate' }, A.ui.icon('lock'), h('h1', null, 'Angrep'),
        h('div', { class: 'tabs', role: 'group', 'aria-label': 'Modo' }, tab('in', 'Entrar'), tab('up', 'Crear cuenta')),
        em, pw, pw2, err, ok, btn,
        up ? h('p', { class: 'muted' }, 'Cada cuenta ve solo sus propios datos. Te enviaremos un correo para verificar tu dirección; hasta verificarla, tus datos quedan solo en este dispositivo.')
          : h('button', { class: 'btn ghost', type: 'button', id: 'lg-forgot', onclick: () => forgot(f) }, 'Olvidé mi contraseña'));
      form.addEventListener('submit', ev => { ev.preventDefault(); if (!busy) submit(f); });
      screen.replaceChildren(form); (em.value ? pw : em).focus();
    }
    document.body.appendChild(screen); draw();
  }
  A.loginGate = { require, need };
})(window);
