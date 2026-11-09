/* Pantallas de «Ajustes y datos» y de Inicio (fase 1): perfil, seguridad, respaldo, apariencia y acerca de. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, U = A.util, store = A.store, V = A.views = A.views || {};

  const field = (id, label, input, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('p', { class: 'hint' }, hint) : null);
  const opt = (v, t, sel) => h('option', { value: v, selected: sel }, t);

  /* ---------- Perfil ---------- */
  V['datos/perfil'] = el => {
    const p = store.getProfile(), err = h('p', { class: 'note warn', role: 'alert' });
    const name = h('input', { class: 'txt', id: 'f-name', type: 'text', maxlength: 60, autocomplete: 'given-name', value: p.name || '' });
    const birth = h('input', { class: 'txt', id: 'f-birth', type: 'date', value: p.birth || '' });
    const sex = h('select', { class: 'txt', id: 'f-sex' }, opt('', 'Sin indicar', !p.sex), opt('M', 'Hombre', p.sex === 'M'), opt('F', 'Mujer', p.sex === 'F'));
    const height = h('input', { class: 'txt', id: 'f-h', type: 'text', inputmode: 'decimal', value: p.heightCm != null ? String(p.heightCm).replace('.', ',') : '' });
    const act = h('select', { class: 'txt', id: 'f-act' }, opt('', 'Sin indicar', !p.activity),
      [['sedentario', 'Sedentario (poco o nada de ejercicio)'], ['ligero', 'Ligero (1–3 días por semana)'], ['moderado', 'Moderado (3–5 días)'], ['alto', 'Alto (6–7 días)'], ['muyalto', 'Muy alto (doble sesión o trabajo físico)']].map(a => opt(a[0], a[1], p.activity === a[0])));
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); err.textContent = '';
      const hv = U.parseNum(height.value);
      if (height.value.trim() && (hv == null || hv < 100 || hv > 250)) { err.textContent = 'La estatura debe estar entre 100 y 250 cm.'; return; }
      if (birth.value && (!U.isYmd(birth.value) || birth.value > U.today())) { err.textContent = 'La fecha de nacimiento no es válida.'; return; }
      store.setProfile({ name: name.value.trim(), birth: birth.value || null, sex: sex.value || null, heightCm: hv, activity: act.value || null });
      A.ui.toast('Perfil guardado.');
    } },
      h('h2', null, 'Perfil'),
      h('p', { class: 'muted' }, 'La estatura, la edad, el sexo y la actividad se usan para calcular tus kcal objetivo (fase 3). Son opcionales por ahora.'),
      field('f-name', 'Nombre', name), field('f-birth', 'Fecha de nacimiento', birth), field('f-sex', 'Sexo', sex, 'Solo para la fórmula de kcal.'),
      field('f-h', 'Estatura (cm)', height), field('f-act', 'Nivel de actividad', act), err,
      h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'submit' }, 'Guardar'))));
  };

  /* ---------- Seguridad ---------- */
  V['datos/seguridad'] = el => {
    const L = A.lock, draw = () => { el.innerHTML = ''; V['datos/seguridad'](el); };
    const msg = h('p', { class: 'note warn', role: 'alert' });
    const pinField = (id, label) => h('input', { class: 'txt', id: id, type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 6, 'aria-label': label, placeholder: label });
    const showCode = (code, then) => A.ui.modal('Guarda tu código de recuperación',
      h('div', null, h('p', null, 'Si olvidas el PIN, este código lo quita sin perder tus datos. Se muestra solo una vez: anótalo en un lugar seguro.'), h('p', { class: 'code', 'aria-label': 'Código de recuperación' }, code)),
      [{ label: 'Ya lo guardé' }], { sticky: true, onClose: then });
    const card = h('section', { class: 'card form' }, h('h2', null, 'Bloqueo con PIN'));
    card.appendChild(h('p', { class: 'muted' }, 'Es un candado de pantalla de este dispositivo: pide el PIN al abrir la app. No cifra los datos guardados. Face ID y huella llegan más adelante.'));
    if (!L.canHash()) card.appendChild(h('p', { class: 'note warn' }, 'Este navegador no permite crear el PIN en esta dirección. Funciona desde https o localhost.'));
    else if (!L.enabled()) {
      const a = pinField('pin1', 'PIN (4 a 6 números)'), b = pinField('pin2', 'Repite el PIN');
      card.appendChild(field('pin1', 'PIN nuevo', a)); card.appendChild(field('pin2', 'Repite el PIN', b)); card.appendChild(msg);
      card.appendChild(h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', onclick: async () => {
        msg.textContent = '';
        if (a.value !== b.value) { msg.textContent = 'Los PIN no coinciden.'; return; }
        try { const code = await L.enable(a.value); showCode(code, draw); } catch (e) { msg.textContent = e.message; }
      } }, 'Activar PIN')));
    } else {
      const sel = h('select', { class: 'txt', id: 'f-to', onchange: () => { L.setTimeoutMin(+sel.value); A.ui.toast('Guardado.'); } },
        L.TIMEOUTS.map(m => opt(String(m), m === 0 ? 'Siempre que salgo de la app' : 'Después de ' + m + ' min fuera', m === L.timeoutMin())));
      card.appendChild(field('f-to', 'Volver a pedir el PIN', sel));
      card.appendChild(h('div', { class: 'row-end wrap' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => {
          const o = pinField('o', 'PIN actual'), n = pinField('n', 'PIN nuevo'), e = h('p', { class: 'note warn', role: 'alert' });
          A.ui.modal('Cambiar PIN', h('div', null, o, n, e), [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Cambiar', keep: true, run: async box => {
            try { const r = await L.change(o.value, n.value); if (r.ok) { box.closest('.modal-back').remove(); A.ui.toast('PIN cambiado.'); } else e.textContent = r.wait ? 'Espera ' + r.wait + ' s.' : 'PIN actual incorrecto.'; } catch (x) { e.textContent = x.message; }
          } }]);
        } }, 'Cambiar PIN'),
        h('button', { class: 'btn ghost', type: 'button', onclick: async () => { showCode(await L.newRecovery()); } }, 'Nuevo código de recuperación'),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => {
          const o = pinField('o2', 'PIN actual'), e = h('p', { class: 'note warn', role: 'alert' });
          A.ui.modal('Quitar el PIN', h('div', null, h('p', null, 'Escribe tu PIN para quitar el bloqueo.'), o, e), [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Quitar PIN', kind: 'danger', keep: true, run: async box => {
            const r = await L.verify(o.value); if (r.ok) { L.disable(); box.closest('.modal-back').remove(); draw(); A.ui.toast('PIN quitado.'); } else e.textContent = r.wait ? 'Espera ' + r.wait + ' s.' : 'PIN incorrecto.';
          } }]);
        } }, 'Quitar PIN')));
    }
    el.appendChild(card);
  };

  /* ---------- Respaldo ---------- */
  V['datos/respaldo'] = el => {
    const loc = store.getLocal(), counts = store.counts();
    const total = Object.keys(counts).reduce((t, k) => t + counts[k], 0);
    const out = h('div', { 'aria-live': 'polite' });
    const importText = text => {
      out.innerHTML = '';
      try {
        const r = A.backup.importText(text);
        if (r.pending) out.appendChild(h('p', { class: 'note' }, ['Este es un respaldo de la app Halterofilia. Impórtalo en ', h('a', { href: '#/datos/halterofilia' }, 'Importar Halterofilia'), '. Aquí no se cambió nada.']));
        else { const s = r.result; out.appendChild(h('p', { class: 'note ok' }, 'Importado: ' + s.added + ' nuevos, ' + s.updated + ' actualizados, ' + s.skipped + ' sin cambios' + (s.invalid ? ', ' + s.invalid + ' omitidos por datos no válidos' : '') + '.')); A.ui.toast('Respaldo importado.'); }
      } catch (e) { out.appendChild(h('p', { class: 'note warn', role: 'alert' }, e.message)); }
    };
    const file = h('input', { class: 'file', type: 'file', id: 'imp-file', accept: '.json,application/json', onchange: () => {
      const f = file.files && file.files[0]; if (!f) return;
      if (f.size > 25 * 1024 * 1024) { out.innerHTML = ''; out.appendChild(h('p', { class: 'note warn' }, 'El archivo es demasiado grande.')); return; }
      const rd = new FileReader(); rd.onload = () => importText(String(rd.result)); rd.onerror = () => { out.innerHTML = ''; out.appendChild(h('p', { class: 'note warn' }, 'No se pudo leer el archivo.')); }; rd.readAsText(f);
      file.value = '';
    } });
    const area = h('textarea', { class: 'txt area', rows: 3, id: 'imp-text', 'aria-label': 'Contenido del respaldo para importar', placeholder: '…o pega aquí el contenido del respaldo' });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Exportar'),
      h('p', { class: 'muted' }, total + ' registros en este dispositivo. ' + (loc.lastBackupAt ? 'Último respaldo: ' + new Date(loc.lastBackupAt).toLocaleString('es-CL') + '.' : 'Aún no has descargado ningún respaldo.')),
      h('p', { class: 'muted' }, 'Contiene datos de salud: guárdalo en un lugar privado. Las fotos y los documentos no se incluyen.'),
      h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', onclick: () => {
        A.ui.download(A.backup.fileName(), JSON.stringify(A.backup.build(), null, 1));
        store.setLocal({ lastBackupAt: Date.now() }); A.ui.toast('Respaldo descargado.'); el.innerHTML = ''; V['datos/respaldo'](el);
      } }, 'Descargar respaldo (JSON)'))));
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Importar'),
      h('p', { class: 'muted' }, 'Se mezcla con lo que ya tienes: gana el registro más reciente, así que importar el mismo archivo dos veces no duplica nada.'),
      h('label', { class: 'lab', for: 'imp-file' }, 'Archivo de respaldo'), file, area,
      h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => importText(area.value) }, 'Importar texto')), out));
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Zona de peligro'),
      h('p', { class: 'muted' }, 'Borra todos los registros de este dispositivo. No afecta a tus respaldos.'),
      h('div', { class: 'row-end' }, h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (await A.ui.confirm('¿Borrar todo en este dispositivo?', 'Se eliminan perfil y registros guardados aquí. Descarga un respaldo antes si quieres conservarlos.', 'Borrar todo', true)) { store.wipe(); A.ui.toast('Datos borrados.'); el.innerHTML = ''; V['datos/respaldo'](el); }
      } }, 'Borrar datos de este dispositivo'))));
  };

  /* ---------- Apariencia ---------- */
  V['datos/apariencia'] = el => {
    const cur = store.getLocal().theme || 'auto';
    const radios = [['auto', 'Automático (sigue al sistema)'], ['light', 'Claro'], ['dark', 'Oscuro']].map(o => h('label', { class: 'radio' },
      h('input', { type: 'radio', name: 'theme', value: o[0], checked: cur === o[0], onchange: () => { store.setLocal({ theme: o[0] }); A.applyTheme(); } }), ' ' + o[1]));
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Tema'), h('div', { class: 'stack' }, radios),
      h('p', { class: 'muted' }, 'Los colores y la tipografía definitivos llegan con el diseño de la app.')));
  };

  /* ---------- Acerca de ---------- */
  V['datos/acerca'] = el => {
    const v = A.version || {}, st = store.status(), loc = store.getLocal(), out = h('p', { role: 'status', 'aria-live': 'polite' });
    const btn = h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
      out.textContent = 'Buscando…';
      const r = await A.update.check();
      out.textContent = r.error ? r.error : r.newer ? 'Hay una versión nueva (' + r.remote + ').' : 'Ya tienes la última versión.';
      const old = btn.querySelector('.upd-go'); if (old) old.remove();
      if (r.newer) { btn.appendChild(h('button', { class: 'btn upd-go', type: 'button', onclick: e => { e.currentTarget.disabled = true; e.currentTarget.textContent = 'Actualizando…'; out.textContent = 'Actualizando, un momento…'; A.update.apply(); } }, 'Actualizar ahora')); }
    } }, 'Buscar actualización'));
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Acerca de'),
      h('dl', { class: 'kv' }, h('dt', null, 'Versión'), h('dd', null, (v.n || '–') + (v.v ? ' · compilación ' + v.v : '')), h('dt', null, 'Almacenamiento'), h('dd', null, st.ok ? st.adapter + ' (ok)' : 'Sin espacio'),
        h('dt', null, 'Dispositivo'), h('dd', null, String(loc.deviceId).slice(0, 8))),
      st.corrupt ? h('p', { class: 'note warn' }, 'Se encontró un dato dañado y se apartó. Importa tu último respaldo si falta algo.') : null,
      out, btn,
      h('p', { class: 'muted' }, 'iPhone: abre la dirección en Safari → Compartir → Agregar a pantalla de inicio. Windows y Mac: ícono de instalar en Chrome o Edge.')));
  };
})(window);
