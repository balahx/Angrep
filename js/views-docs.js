/* Ajustes y datos · Documentos y exportación (fase 7): exportar a Excel (CSV), informe PDF y archivos propios. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, field = A.ui.field, U = A.util, store = A.store, V = A.views = A.views || {}, W = A.vw, E = A.exporter;
  const RANGES = [['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['365', 'Último año'], ['all', 'Todo']];
  const ctxOf = () => ({ weights: store.list('weight'), steps: store.list('steps'), measures: store.list('measure'), meals: store.list('meal'), nutri: store.list('nutriday'), sessions: store.list('session'), exercises: store.list('exercise'), plans: store.list('plan'), profile: store.getProfile(),
    goals: { main: store.get('goal', 'goal_main_weight'), steps: store.get('goal', 'goal_steps'), food: W.foodGoals() } });
  const rangeOf = (v, ctx) => { const to = U.today(); if (v !== 'all') return { from: U.ymd(U.addDays(U.parseYmd(to), -(+v - 1))), to: to };
    const all = [].concat(ctx.weights, ctx.steps, ctx.measures, ctx.meals, ctx.nutri, ctx.sessions).map(r => r.date).filter(Boolean).sort(); return { from: all[0] || to, to: to }; };
  function save(name, data, mime) {
    try { const url = URL.createObjectURL(new Blob([data], { type: mime })), a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return true; }
    catch (e) { A.ui.toast('Tu navegador no permitió la descarga.'); return false; }
  }
  const rangeSel = id => h('select', { class: 'txt', id: id }, RANGES.map(r => h('option', { value: r[0], selected: r[0] === '90' }, r[1])));

  W.wrapView('datos/documentos', (el, again) => {
    /* CSV */
    const kind = h('select', { class: 'txt', id: 'ex-kind' }, Object.keys(E.SETS).map(k => h('option', { value: k }, E.SETS[k].label))), r1 = rangeSel('ex-range'), msg = h('p', { class: 'note', role: 'status' });
    msg.hidden = true;
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Exportar a Excel (CSV)'), h('p', { class: 'muted' }, 'Un archivo por tema, con separador «;» y coma decimal: se abre directo en Excel.'),
      field('ex-kind', 'Datos', kind), field('ex-range', 'Periodo', r1), msg,
      h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', id: 'ex-csv', onclick: () => { const c = ctxOf(), r = rangeOf(r1.value, c), out = E.makeCsv(kind.value, c, r1.value === 'all' ? null : r.from, r.to);
        msg.hidden = false; if (!out.count) { msg.className = 'note warn'; msg.textContent = 'No hay datos de «' + E.SETS[kind.value].label + '» en ese periodo.'; return; }
        msg.className = 'note ok'; msg.textContent = out.count + (out.count === 1 ? ' fila' : ' filas') + ' exportadas en ' + out.name + '.'; save(out.name, out.text, 'text/csv;charset=utf-8'); } }, 'Descargar CSV'))));

    /* PDF */
    const r2 = rangeSel('pdf-range'), sec = { peso: 'Peso', pasos: 'Pasos', comida: 'Alimentación', entrenos: 'Entrenamientos', rutinas: 'Rutinas' }, on = { peso: true, pasos: true, comida: true, entrenos: true, rutinas: true }, perr = h('p', { class: 'note warn', role: 'alert' });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Informe en PDF'), h('p', { class: 'muted' }, 'Resumen con cifras, gráfico de peso y tablas, listo para imprimir o mostrar a tu entrenador o nutricionista.'),
      field('pdf-range', 'Periodo', r2),
      h('fieldset', { class: 'checks' }, h('legend', null, 'Qué incluir'), Object.keys(sec).map(k => h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'pdf-' + k, checked: true, onchange: e => { on[k] = e.target.checked; } }), h('span', null, sec[k])))), perr,
      h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', id: 'ex-pdf', onclick: () => { perr.textContent = ''; if (!Object.keys(on).some(k => on[k])) { perr.textContent = 'Elige al menos una sección.'; return; }
        try { const c = ctxOf(), r = rangeOf(r2.value, c), res = A.exporter.report(c, { from: r.from, to: r.to, sections: on }); save('informe-' + U.today() + '.pdf', res.bytes, 'application/pdf'); A.ui.toast('Informe de ' + res.pages + (res.pages === 1 ? ' página' : ' páginas') + ' descargado.'); }
        catch (e) { perr.textContent = 'No se pudo armar el informe: ' + e.message; } } }, 'Descargar PDF'))));

    /* Documentos propios */
    const file = h('input', { class: 'file', type: 'file', id: 'doc-file', accept: '.pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.json,.md,image/*' }), dk = h('select', { class: 'txt', id: 'doc-kind' }, A.docs.KINDS.map(k => h('option', { value: k[0] }, k[1]))), derr = h('p', { class: 'note warn', role: 'alert' });
    const docs = A.docs.list(), ul = h('ul', { class: 'rows stack', 'aria-label': 'Documentos guardados' });
    docs.forEach(d => ul.appendChild(h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, d.name), h('span', { class: 'hint' }, (A.docs.KINDS.filter(k => k[0] === d.kind)[0] || [0, 'Otro'])[1] + ' · ' + A.docs.sizeText(d.size) + ' · ' + U.fmtDate(d.date))),
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Descargar ' + d.name, onclick: async () => { const b = await A.docs.blob(d.id); if (!b) { A.ui.toast('No encuentro el archivo en este dispositivo.'); return; } save(d.name, b, d.mime || 'application/octet-stream'); } }, 'Descargar'),
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar ' + d.name, onclick: async () => { if (await A.ui.confirm('¿Eliminar este documento?', d.name + ' se borra de este dispositivo.', 'Eliminar')) { await A.docs.remove(d.id); A.ui.toast('Documento eliminado.'); again(); } } }, 'Eliminar'))));
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Mis documentos'), h('p', { class: 'muted' }, 'Guarda aquí tus rutinas y planes (PDF, Excel, Word, imágenes) para tenerlos a mano sin conexión. Quedan solo en este dispositivo y no entran al respaldo.'),
      field('doc-file', 'Archivo', file), field('doc-kind', 'Tipo', dk), derr,
      h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', id: 'doc-add', onclick: async () => { derr.textContent = ''; const f = file.files && file.files[0]; if (!f) { derr.textContent = 'Elige un archivo.'; return; }
        try { await A.docs.add(f, dk.value); file.value = ''; A.ui.toast('Documento guardado.'); again(); } catch (e) { derr.textContent = e.message || 'No se pudo guardar el archivo.'; } } }, 'Guardar documento')),
      docs.length ? ul : h('p', { class: 'hint' }, 'Aún no guardas documentos.')));
  });
})(window);
