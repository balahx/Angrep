/* «Ajustes y datos» · Importar Halterofilia (fase 5): elegir archivo (JSON o CSV) o pegar el texto, ver qué se va a traer y confirmar. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, store = A.store, V = A.views = A.views || {}, W = A.vw;
  V['datos/halterofilia'] = el => {
    const out = h('div', { 'aria-live': 'polite' }), st = { text: null, replace: false };
    const line = (label, n) => n ? h('li', null, label + ': ' + n) : null;
    const show = () => {
      out.innerHTML = '';
      let prep; try { prep = A.halter.prepare(st.text, A.halter.ctxOf(store), { replacePlan: st.replace }); } catch (e) { out.appendChild(h('p', { class: 'note warn', role: 'alert' }, e.message)); return; }
      const s = prep.summary, total = prep.ops.length, ex = s.exercises;
      const items = [line('Sesiones nuevas', s.sessions.add), line('Sesiones que ya estaban (se omiten)', s.sessions.skip), line('Sesiones sin series válidas (se omiten)', s.sessions.invalid),
        line('Ejercicios nuevos', ex.add), line('Ejercicios a los que se les completa el máximo', ex.update), line('Pesos corporales nuevos', s.weights.add), line('Pesos corporales que ya estaban', s.weights.skip),
        s.plan === 'add' ? h('li', null, 'Rutina semanal: se crea') : s.plan === 'replace' ? h('li', null, 'Rutina semanal: se reemplaza la tuya') : s.plan === 'skip' ? h('li', null, 'Rutina semanal: se deja la que ya tienes') : null,
        s.profile ? h('li', null, 'Perfil: se completan datos que faltaban') : null].filter(Boolean);
      const card = h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Esto se va a traer'), items.length ? h('ul', null, items) : h('p', { class: 'muted' }, 'No hay nada nuevo que traer.'));
      prep.warnings.forEach(w => card.appendChild(h('p', { class: 'note' }, w)));
      if (prep.kind === 'json' && prep.hasPlan) card.appendChild(h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'hal-replace', checked: st.replace, onchange: e => { st.replace = e.target.checked; show(); } }), h('span', null, 'Reemplazar mi rutina semanal por la de Halterofilia')));
      card.appendChild(h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', id: 'hal-go', disabled: !total, onclick: () => {
        const r = A.halter.apply(store, prep); out.innerHTML = '';
        out.appendChild(h('section', { class: 'card' }, h('p', { class: 'note ok' }, 'Listo: ' + r.saved + ' elementos importados' + (r.failed ? ', ' + r.failed + ' con datos no válidos que se omitieron' : '') + '.'),
          h('div', { class: 'row-end wrap' }, h('a', { class: 'btn ghost', href: '#/entrenos/halterofilia/historial' }, 'Ver historial'), h('a', { class: 'btn ghost', href: '#/entrenos/halterofilia/progreso' }, 'Ver progreso'))));
        A.ui.toast('Halterofilia importada.'); } }, 'Importar')));
      out.appendChild(card);
    };
    const read = f => { if (f.size > 25 * 1024 * 1024) { out.innerHTML = ''; out.appendChild(h('p', { class: 'note warn', role: 'alert' }, 'El archivo es demasiado grande.')); return; }
      const rd = new FileReader(); rd.onload = () => { st.text = String(rd.result); st.replace = false; show(); }; rd.onerror = () => { out.innerHTML = ''; out.appendChild(h('p', { class: 'note warn', role: 'alert' }, 'No se pudo leer el archivo.')); }; rd.readAsText(f); };
    const file = h('input', { class: 'file', type: 'file', id: 'hal-file', accept: '.json,.csv,application/json,text/csv', onchange: () => { const f = file.files && file.files[0]; if (f) read(f); file.value = ''; } });
    const area = h('textarea', { class: 'txt area', rows: 3, id: 'hal-text', 'aria-label': 'Contenido del respaldo de Halterofilia', placeholder: '…o pega aquí el contenido' });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Importar desde Halterofilia'),
      h('p', { class: 'muted' }, 'En tu app Halterofilia: Más → Exportar respaldo (JSON). Trae sesiones, ejercicios con máximos y metas, rutina semanal y peso corporal. El CSV de historial trae solo las sesiones.'),
      h('p', { class: 'muted' }, 'Puedes importar el mismo archivo varias veces: lo que ya está no se duplica. No incluye la semana del entrenador ni el plan anual.'),
      h('div', { class: 'field' }, h('label', { for: 'hal-file' }, 'Archivo (.json o .csv)'), file), h('div', { class: 'field' }, h('label', { for: 'hal-text' }, 'O pegar texto'), area),
      h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', id: 'hal-prev', onclick: () => { st.text = area.value; st.replace = false; show(); } }, 'Revisar texto pegado'))));
    el.appendChild(out);
  };
})(window);
