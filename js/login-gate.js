/* Acceso con cuenta (fase 9): si la app tiene un proyecto de Firebase, no se muestra nada hasta entrar con correo y contraseña,
   o crear una cuenta (pensado para compartirla con cercanos: cada cuenta ve solo sus datos). La sesión queda en el dispositivo (sirve sin conexión).
   Es una barrera de pantalla: los datos del dispositivo no se cifran; lo que separa a las personas en la nube son las reglas de Firestore. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const need = () => !!(A.defaultFirebase || A.cloud.configured());
  const ensureCfg = () => { if (!A.cloud.configured() && A.defaultFirebase) A.store.setLocal({ syncCfg: A.defaultFirebase }); };
  const hasData = () => Object.keys(A.store.counts()).length > 0;


  /* Muro de acceso: la cuenta tiene que estar aprobada por el administrador (members/{uid}). Se vuelve a mirar solo cada 15 s mientras espera. */
  const TXT = {
    checking: ['Comprobando tu acceso…', ''],
    unverified: ['Falta verificar tu correo', 'Abre el enlace que te enviamos por correo (revisa también el spam) y luego toca «Ya lo verifiqué». Si el enlace dice que venció o que ya se usó, normalmente tu correo ya quedó verificado: solo toca «Ya lo verifiqué».'],
    pending: ['Solicitud enviada', 'Tu acceso tiene que ser aprobado por el administrador de la app. Esta pantalla se actualiza sola cuando lo apruebe.'],
    rejected: ['Acceso no aprobado', 'El administrador no aprobó esta solicitud. Puedes pedirlo de nuevo.'],
    offline: ['Sin conexión', 'Necesito internet para comprobar tu acceso, solo esta vez en este dispositivo.'],
    error: ['No se pudo comprobar', '']
  };
  let wallEl = null, timer = null;
  function wall(then, fresh) {
    if (wallEl) return; const h = A.ui.h; wallEl = h('div', { class: 'lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Acceso a la app', id: 'wall' });
    document.body.appendChild(wallEl);
    const close = () => { clearInterval(timer); timer = null; wallEl.remove(); wallEl = null; };
    const out = () => { A.cloud.signOut(); location.reload(); };
    const draw = (st, message) => {
      const t = TXT[st] || TXT.error, btn = (id, label, fn, ghost) => h('button', { class: 'btn' + (ghost ? ' ghost' : ''), type: 'button', id: id, onclick: fn }, label);
      const row = [];
      if (st === 'unverified') row.push(btn('wl-check', 'Ya lo verifiqué', check), btn('wl-resend', 'Reenviar correo', async e => { e.currentTarget.disabled = true; try { await A.cloud.resendVerification(); A.ui.toast('Correo enviado.'); } catch (x) { A.ui.toast(x.message); } e.currentTarget.disabled = false; }, true));
      else if (st === 'rejected') row.push(btn('wl-again', 'Pedir de nuevo', async () => { draw('checking'); apply(await A.cloud.askAgain()); }));
      else if (st !== 'checking') row.push(btn('wl-check', st === 'pending' ? 'Revisar ahora' : 'Reintentar', check));
      row.push(btn('wl-out', 'Cerrar sesión', out, true));
      wallEl.replaceChildren(h('div', { class: 'lock-box' }, A.ui.logo(104), h('h1', { id: 'wl-title' }, t[0]), h('p', { class: 'muted', id: 'wl-text', role: 'status' }, message || t[1]), st === 'checking' ? null : h('p', { class: 'muted' }, A.store.getLocal().syncLastEmail || ''), ...row));
    };
    const apply = r => {
      if (r.state === 'ok') { close(); if (fresh) A.ui.toast('Cuenta aprobada. ¡Bienvenido!'); then(); return; }
      draw(r.state, r.message); clearInterval(timer); timer = (r.state === 'pending' || r.state === 'unverified') ? setInterval(check, 15000) : null;
    };
    let checking = false;
    async function check() {
      if (checking) return; checking = true; const b = document.getElementById('wl-check'); if (b) { b.disabled = true; b.textContent = 'Comprobando…'; }
      try { apply(await A.cloud.access()); } catch (e) { apply({ state: 'error', message: e && e.message }); } finally { checking = false; }
    }
    draw('checking'); check();
  }
  /* Con la app ya abierta: si el administrador quitó el acceso, vuelve el muro */
  function recheck() { A.cloud.access().then(r => { if (r.state !== 'ok' && r.state !== 'offline' && r.state !== 'error') wall(() => {}); }).catch(() => {}); }

  function require(then) {
    if (!need()) { then(); return; }
    ensureCfg(); A.cloud.start();
    if (A.cloud.signedIn()) { if (A.cloud.cachedOk() || A.cloud.isAdmin()) { then(); recheck(); } else wall(then); return; }
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
        A.store.setLocal({ syncLastEmail: email, syncOwner: r.uid }); screen.remove(); wall(then, mode === 'up');
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
      const form = h('form', { class: 'lock-box', novalidate: 'novalidate' }, A.ui.logo(104), h('h1', null, 'Angrep'),
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
