/* Ajustes y datos · Sincronización (fase 8) */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, field = A.ui.field, U = A.util, store = A.store, W = A.vw, Cl = A.cloud;
  const ago = t => { if (!t) return 'nunca'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'hace un momento' : m < 60 ? 'hace ' + m + ' min' : m < 1440 ? 'hace ' + Math.round(m / 60) + ' h' : 'hace ' + Math.round(m / 1440) + ' días'; };
  const RULES = "rules_version = '2';\n// Cada cuenta lee y escribe solo lo suyo (users/{su uid}/records/*). Todo lo que no está permitido aquí queda prohibido.\n// Para escribir hay que tener el correo verificado (frena cuentas falsas); el dueño de la app queda exento por si su cuenta se creó a mano.\n// Cambia el correo del dueño si usas otro.\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    function owner(uid) {\n      return request.auth != null && request.auth.uid == uid\n        && (request.auth.token.email_verified == true || request.auth.token.email == 'felipe.gonzalezg01@gmail.com');\n    }\n    // users/{uid}/records/{tipo__id}: un documento por registro\n    match /users/{uid}/records/{key} {\n      allow read: if request.auth != null && request.auth.uid == uid;\n      allow create, update: if owner(uid)\n        && request.resource.data.keys().hasOnly(['t', 'd', 'u', 'del', 'at'])\n        && request.resource.data.keys().hasAll(['t', 'd', 'u', 'at'])\n        && request.resource.data.t in ['profile', 'weight', 'steps', 'measure', 'goal', 'food', 'meal', 'nutriday', 'exercise', 'plan', 'session']\n        && request.resource.data.d is string && request.resource.data.d.size() < 200000\n        && request.resource.data.u is int && request.resource.data.u <= request.time.toMillis() + 600000\n        && request.resource.data.at == request.time\n        && (!('del' in request.resource.data) || request.resource.data.del is bool)\n        && key.size() <= 160;\n      allow delete: if false;\n    }\n  }\n}\n";   // igual a firestore.rules
  const msg = (text, ok) => h('p', { class: 'note ' + (ok ? 'ok' : 'warn'), role: ok ? 'status' : 'alert' }, text);

  W.wrapView('datos/sync', (el, again) => {
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Sincronización'), h('p', { class: 'muted' }, 'Mantiene el PC y el iPhone al día con tu propio proyecto de Firebase. Sin conexión todo sigue funcionando y se envía al volver internet. Las fotos y los documentos no se sincronizan: quedan en cada dispositivo.')));

    /* 1. Sin configuración */
    if (!Cl.configured()) {
      const ta = h('textarea', { class: 'txt area', id: 'sy-cfg', rows: 6, 'aria-label': 'Configuración de Firebase', placeholder: 'const firebaseConfig = {\n  apiKey: "…",\n  projectId: "…",\n  …\n};' }), err = h('p', { class: 'note warn', role: 'alert' });
      el.appendChild(h('section', { class: 'card' }, h('h3', { class: 'sub' }, '1. Conectar tu proyecto de Firebase'),
        h('ol', null, h('li', null, 'Entra a console.firebase.google.com y crea un proyecto (por ejemplo «Angrep»; Analytics no hace falta).'),
          h('li', null, 'Compilación → Authentication → Comenzar → activa «Correo electrónico/contraseña». En «Usuarios» agrega tu correo y una contraseña.'),
          h('li', null, 'Compilación → Firestore Database → Crear base de datos (modo producción; ubicación southamerica-west1 si la ofrece). En «Reglas» pega estas reglas y publica:'),
          h('li', null, 'Configuración del proyecto (engranaje) → Tus apps → «</>» Web → registra la app y copia el bloque «firebaseConfig». Pégalo aquí.')),
        h('pre', { class: 'rules', tabindex: 0, 'aria-label': 'Reglas de Firestore' }, RULES), h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(RULES); A.ui.toast('Reglas copiadas.'); } catch (e) { A.ui.toast('No se pudo copiar; selecciónalas a mano.'); } } }, 'Copiar reglas')),
        field('sy-cfg', 'Configuración de Firebase', ta), err,
        h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', id: 'sy-save', onclick: () => { err.textContent = ''; try { Cl.setConfig(ta.value); A.ui.toast('Proyecto conectado. Ahora inicia sesión.'); again(); } catch (e) { err.textContent = e.message; } } }, 'Conectar'))));
      return;
    }

    /* 2. Configurado, sin sesión */
    if (!Cl.signedIn()) {
      const em = h('input', { class: 'txt', id: 'sy-email', type: 'email', autocomplete: 'username', inputmode: 'email', value: store.getLocal().syncLastEmail || '' }), pw = h('input', { class: 'txt', id: 'sy-pw', type: 'password', autocomplete: 'current-password' }), err = h('p', { class: 'note warn', role: 'alert' });
      const go = async () => { err.textContent = ''; if (!em.value.trim() || !pw.value) { err.textContent = 'Escribe tu correo y tu contraseña.'; return; } const b = document.getElementById('sy-login'); b.disabled = true;
        try { await Cl.signIn(em.value, pw.value); store.setLocal({ syncLastEmail: em.value.trim() }); const r = await Cl.run(); A.ui.toast(r.ok ? 'Sesión iniciada y datos al día.' : 'Sesión iniciada. ' + r.message); again(); } catch (e) { err.textContent = e.message; b.disabled = false; } };
      el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => { e.preventDefault(); go(); } }, h('h3', { class: 'sub' }, '2. Iniciar sesión'), h('p', { class: 'muted' }, 'Proyecto: ' + Cl.projectId() + '. Usa el correo y la contraseña que creaste en Authentication.'),
        field('sy-email', 'Correo', em), field('sy-pw', 'Contraseña', pw), err, h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: async () => { if (await A.ui.confirm('¿Quitar el proyecto?', 'Se borra la configuración de este dispositivo. Tus datos locales y los de la nube no cambian.', 'Quitar')) { Cl.clear(); again(); } } }, 'Cambiar de proyecto'), h('button', { class: 'btn', type: 'submit', id: 'sy-login' }, 'Iniciar sesión'))));
      return;
    }

    /* 3. Sesión iniciada */
    const s = Cl.state(), pend = Cl.pending(), line = s.error ? { t: s.errorText || 'No se pudo sincronizar.', ok: false } : s.lastOk ? { t: 'Al día ' + ago(s.lastOk) + '.', ok: true } : { t: 'Aún no sincronizas.', ok: true };
    el.appendChild(h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Estado'), W.tiles([W.tile('Cuenta', Cl.email() || '–', Cl.projectId()), W.tile('Última sincronización', ago(s.lastOk), s.lastOk ? new Date(s.lastOk).toLocaleString('es-CL') : ''), W.tile('Por enviar', String(pend), pend ? 'cambios pendientes' : 'todo enviado')]),
      h('p', { class: 'note ' + (line.ok ? 'ok' : 'warn'), role: line.ok ? 'status' : 'alert' }, line.t + (s.error === 'offline' ? ' Se enviará al volver la conexión.' : '')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'sy-auto', checked: store.getLocal().syncAuto !== false, onchange: e => store.setLocal({ syncAuto: e.target.checked }) }), h('span', null, 'Sincronizar automáticamente (al cambiar datos, al abrir la app y cada 5 minutos)')),
      h('div', { class: 'row-end wrap' }, h('button', { class: 'btn ghost', type: 'button', onclick: async () => { if (await A.ui.confirm('¿Cerrar sesión?', 'Los datos de este dispositivo se quedan; dejarán de sincronizarse hasta que vuelvas a entrar.', 'Cerrar sesión')) { Cl.signOut(); again(); } } }, 'Cerrar sesión'),
        h('button', { class: 'btn', type: 'button', id: 'sy-now', onclick: async e => { const b = e.currentTarget; b.disabled = true; b.textContent = 'Sincronizando…'; const r = await Cl.run(); A.ui.toast(r.ok ? 'Listo: ' + r.pulled + ' recibidos, ' + r.pushed + ' enviados.' : r.message); again(); } }, 'Sincronizar ahora'))));
    const vbox = h('div', { id: 'sy-verify' }); el.appendChild(vbox);
    Cl.verified().then(v => { if (v === false) vbox.appendChild(h('section', { class: 'card' }, h('p', { class: 'note warn', role: 'status' }, 'Tu correo aún no está verificado: hasta verificarlo no se envían datos a la nube. Abre el enlace del correo que te enviamos (revisa el spam) y luego toca «Sincronizar ahora».'),
      h('button', { class: 'btn ghost', type: 'button', id: 'sy-resend', onclick: async () => { try { await Cl.resendVerification(); A.ui.toast('Correo enviado.'); } catch (x) { A.ui.toast(x.message); } } }, 'Reenviar correo de verificación'))); }).catch(() => {});
    el.appendChild(h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Cómo funciona'), h('ul', null, h('li', null, 'Si cambias lo mismo en dos dispositivos, gana el cambio más reciente.'), h('li', null, 'Lo que borras se borra también en tus otros dispositivos.'), h('li', null, 'Un dispositivo nuevo: inicia sesión y baja todo lo que ya tienes en la nube.'), h('li', null, 'El respaldo manual (JSON) sigue disponible como copia aparte.'))));
  });
})(window);
