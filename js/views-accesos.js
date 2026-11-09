/* Ajustes y datos · Accesos (fase 9): el administrador aprueba, rechaza o quita cuentas. Solo se muestra a quien tenga el correo de administrador;
   lo que de verdad lo impide a los demás son las reglas de Firestore. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, W = A.vw, Cl = A.cloud;
  const when = t => t ? new Date(t).toLocaleDateString('es-CL') : '';
  W.wrapView('datos/accesos', (el, again) => {
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Accesos'), h('p', { class: 'muted' }, 'Quien crea una cuenta y verifica su correo queda en espera hasta que tú la apruebes. Sin tu aprobación no puede entrar ni guardar datos en la nube.')));
    if (!Cl.isAdmin()) { el.appendChild(h('section', { class: 'card' }, h('p', { class: 'note warn', role: 'status' }, 'Esta sección es solo para el administrador de la app.'))); return; }
    const box = h('div', { id: 'ac-box' }, h('p', { class: 'muted', role: 'status' }, 'Cargando…')); el.appendChild(box);
    const run = async (fn, okMsg) => { try { await fn(); A.ui.toast(okMsg); } catch (e) { A.ui.toast(e && e.message || 'No se pudo.'); } again(); };
    Cl.admin.list().then(r => {
      const pend = r.requests.filter(x => x.status !== 'rejected'), rej = r.requests.filter(x => x.status === 'rejected');
      const row = (x, btns) => h('li', { class: 'ac-row' }, h('div', null, h('strong', null, x.email || x.id), h('div', { class: 'muted' }, (x.createdAt ? 'Pidió ' + when(x.createdAt) : x.approvedAt ? 'Aprobada ' + when(x.approvedAt) : ''))), h('div', { class: 'row-end wrap' }, btns));
      const b = (id, label, fn, ghost) => h('button', { class: 'btn' + (ghost ? ' ghost' : ''), type: 'button', id: id, onclick: e => { e.currentTarget.disabled = true; fn(); } }, label);
      box.replaceChildren(
        h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Solicitudes pendientes (' + pend.length + ')'), pend.length ? h('ul', { class: 'ac-list' }, pend.map((x, i) => row(x, [b('ac-ok-' + i, 'Aprobar', () => run(() => Cl.admin.approve(x.id, x.email), 'Acceso aprobado.')), b('ac-no-' + i, 'Rechazar', () => run(() => Cl.admin.reject(x.id), 'Solicitud rechazada.'), true)]))) : h('p', { class: 'muted' }, 'No hay solicitudes pendientes.')),
        h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Cuentas con acceso (' + r.members.length + ')'), r.members.length ? h('ul', { class: 'ac-list' }, r.members.map((x, i) => row(x, [h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'ac-plan-' + i, checked: x.plan === true, onchange: e => { const on = e.target.checked; e.target.disabled = true; run(() => Cl.admin.setPlanAccess(x.id, on), on ? 'Ahora puede ver el plan del entrenador.' : 'Ya no ve el plan del entrenador.'); } }), h('span', null, 'Plan del entrenador')), b('ac-rm-' + i, 'Quitar acceso', async () => { if (await A.ui.confirm('¿Quitar el acceso?', (x.email || 'Esta cuenta') + ' deja de poder entrar y sincronizar. Sus datos en la nube no se borran.', 'Quitar acceso', true)) run(() => Cl.admin.remove(x.id), 'Acceso quitado.'); else again(); }, true)]))) : h('p', { class: 'muted' }, 'Aún no has aprobado a nadie.')),
        rej.length ? h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Rechazadas (' + rej.length + ')'), h('ul', { class: 'ac-list' }, rej.map((x, i) => row(x, [b('ac-ap2-' + i, 'Aprobar', () => run(() => Cl.admin.approve(x.id, x.email), 'Acceso aprobado.')), b('ac-del-' + i, 'Eliminar', () => run(() => Cl.admin.dismiss(x.id), 'Solicitud eliminada.'), true)])))) : null);
    }).catch(e => box.replaceChildren(h('p', { class: 'note warn', role: 'alert' }, (e && e.code === 'offline' ? 'Sin conexión. ' : '') + (e && e.message || 'No se pudo cargar.'))));
  });
})(window);
