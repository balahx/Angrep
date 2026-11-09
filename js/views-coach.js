/* Plan del entrenador (fase 9): carga y publicación desde Excel (administrador) y selección de semana (cuentas con acceso). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, U = A.util, W = A.vw, store = A.store, K = A.coach, Cl = A.cloud;
  const when = t => t ? new Date(t).toLocaleDateString('es-CL') : '';
  const fmtSet = s => (s.pct ? U.fmtNum(s.pct, 0) + ' % · ' : '') + (s.reps || '') + (s.reps ? ' reps' : '') + ' × ' + (s.sets || 1);

  /* ---------- Administrador: cargar y publicar ---------- */
  W.wrapView('datos/plan-entrenador', (el, again) => {
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Plan del entrenador'), h('p', { class: 'muted' }, 'Carga el Excel del plan anual, revísalo y publícalo. Solo lo verán las cuentas a las que les actives «Plan del entrenador» en Accesos. Se guarda comprimido (unos 20 KB) y cada dispositivo lo baja una vez.')));
    if (!Cl.isAdmin()) { el.appendChild(h('section', { class: 'card' }, h('p', { class: 'note warn', role: 'status' }, 'Esta sección es solo para el administrador.'))); return; }
    const st = h('div', { id: 'pe-state' }, h('p', { class: 'muted' }, 'Revisando lo publicado…')); el.appendChild(st);
    Cl.plan.meta().then(m => st.replaceChildren(h('p', { id: 'pe-pub-info' }, m ? 'Publicado: «' + m.name + '» · ' + m.weeks + ' semanas · versión ' + m.ver + (m.at ? ' · ' + when(m.at) : '') : 'Todavía no hay un plan publicado.'),
      m ? h('button', { class: 'btn ghost', type: 'button', id: 'pe-del', onclick: async () => { if (await A.ui.confirm('¿Quitar el plan publicado?', 'Nadie podrá bajarlo de nuevo. Las copias ya guardadas en otros dispositivos se limpian cuando esas cuentas vuelven a conectarse.', 'Quitar plan', true)) { try { await Cl.plan.remove(); K.clear(); A.ui.toast('Plan quitado.'); } catch (e) { A.ui.toast(e.message); } again(); } } }, 'Quitar plan publicado') : null)).catch(e => st.replaceChildren(h('p', { class: 'note warn', role: 'alert' }, e && e.message || 'No se pudo revisar.')));
    const out = h('div', { id: 'pe-out' }), file = h('input', { type: 'file', id: 'pe-file', class: 'file', accept: '.xlsx', 'aria-label': 'Excel del plan' });
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0]; if (!f) return; out.replaceChildren(h('p', { class: 'muted', role: 'status' }, 'Leyendo el Excel…'));
      try {
        const g = await root.XlsxLite.readXlsx(await f.arrayBuffer()), res = root.PlanImport.parsePlan(g.grid, g.merges);
        if (res.unknown && res.unknown.length) root.PlanImport.applyNames(res, {});
        const name = h('input', { class: 'txt', id: 'pe-name', type: 'text', maxlength: 120, value: f.name.replace(/\.xlsx$/i, '') });
        out.replaceChildren(h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Vista previa'),
          W.tiles([W.tile('Semanas', String(res.stats.semanas)), W.tile('Sesiones', String(res.stats.sesiones)), W.tile('Ejercicios', String(res.stats.ejercicios)), W.tile('Etapas', String(res.stats.etapas))]),
          h('ul', null, res.stages.map(s => h('li', null, s.name + ' · ' + res.weeks.filter(w => w.stageId === s.id).length + ' semanas'))),
          res.unknown && res.unknown.length ? h('p', { class: 'note warn' }, res.unknown.length + ' ejercicios no están en el glosario; se guardan con el texto de la planilla.') : null,
          (res.warnings || []).length ? h('p', { class: 'hint' }, 'Avisos: ' + res.warnings.slice(0, 3).join(' · ')) : null,
          A.ui.field('pe-name', 'Nombre del plan', name), h('p', { class: 'note', id: 'pe-err', role: 'alert' }),
          h('button', { class: 'btn', type: 'button', id: 'pe-pub', onclick: async e => { const b = e.currentTarget; b.disabled = true; b.textContent = 'Publicando…'; try { const m = await K.publish(res, name.value.trim()); A.ui.toast('Plan publicado: ' + m.weeks + ' semanas.'); again(); } catch (x) { document.getElementById('pe-err').textContent = x && x.message || 'No se pudo publicar.'; b.disabled = false; b.textContent = 'Publicar'; } } }, 'Publicar')));
      } catch (e) { out.replaceChildren(h('p', { class: 'note warn', role: 'alert' }, 'No pude leer ese archivo: ' + (e && e.message || 'formato no reconocido') + '.')); }
    });
    el.appendChild(h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Cargar Excel'), A.ui.field('pe-file', 'Archivo .xlsx (planilla del entrenador o plantilla simple)', file)));
    el.appendChild(out);
  });

  /* ---------- Cuentas con acceso: elegir semana ---------- */
  W.wrapView('entrenos/halterofilia/entrenador', (el, again) => {
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Plan del entrenador'), h('p', { class: 'muted' }, 'Elige una semana del plan anual para verla con tus kilos, o úsala como tu rutina de Halterofilia.')));
    if (!Cl.canPlan()) { el.appendChild(h('section', { class: 'card' }, h('p', { class: 'note warn', role: 'status' }, 'Tu cuenta no tiene acceso al plan del entrenador. Pídeselo a la persona que administra la app.'))); return; }
    const box = h('div', { id: 'ce-box' }, h('p', { class: 'muted', role: 'status' }, 'Cargando el plan…')); el.appendChild(box);
    const refresh = h('button', { class: 'btn ghost', type: 'button', id: 'ce-refresh', onclick: async e => { e.currentTarget.disabled = true; const r = await K.refresh(true); A.ui.toast(r.state === 'nuevo' ? 'Plan actualizado.' : r.state === 'al-dia' ? 'Ya tienes la última versión.' : r.state === 'sin-plan' ? 'Todavía no hay plan publicado.' : r.state === 'offline' ? 'Sin conexión.' : (r.message || 'No se pudo.')); again(); } }, 'Buscar plan nuevo');
    (async () => {
      if (!K.info()) await K.refresh(true);
      const plan = await K.load();
      if (!plan) { box.replaceChildren(h('section', { class: 'card empty' }, h('p', { class: 'muted' }, 'Todavía no hay un plan publicado o no se pudo bajar.'), refresh)); return; }
      const sel = store.getLocal().coachSel || {}, stageId = plan.stages.some(s => s.id === sel.stage) ? sel.stage : plan.stages[0].id;
      const weeks = plan.weeks.filter(w => w.stageId === stageId), wk = weeks.filter(w => w.id === sel.week)[0] || weeks[0];
      const pick = (stage, week) => { store.setLocal({ coachSel: { stage: stage, week: week } }); again(); };
      const stageSel = h('select', { class: 'txt', id: 'ce-stage', 'aria-label': 'Etapa', onchange: e => { const ws = plan.weeks.filter(w => w.stageId === e.target.value); pick(e.target.value, ws[0] && ws[0].id); } }, plan.stages.map(s => h('option', { value: s.id, selected: s.id === stageId }, s.name)));
      const chips = h('div', { class: 'tabs sub', role: 'group', 'aria-label': 'Semanas' }, weeks.map(w => h('button', { class: 'tab', type: 'button', 'aria-pressed': String(w === wk), id: 'ce-wk-' + w.id, onclick: () => pick(stageId, w.id) }, 'S' + w.week)));
      const body = [h('section', { class: 'card' }, A.ui.field('ce-stage', 'Etapa', stageSel), h('p', { class: 'lab' }, 'Semana'), chips, h('p', { class: 'hint' }, K.info() ? 'Plan «' + K.info().name + '» · guardado en este dispositivo.' : ''))];
      if (wk) {
        const notes = (wk.notes || []).filter(x => x && !/^\d+$/.test(String(x)));
        body.push(h('section', { class: 'card' }, h('h3', { class: 'sub', id: 'ce-title' }, 'Semana ' + wk.week + (wk.label ? ' · ' + wk.label : '')), notes.length ? h('p', { class: 'hint' }, notes.join(' · ')) : null,
          h('button', { class: 'btn', type: 'button', id: 'ce-use', onclick: async () => {
            if (!await A.ui.confirm('¿Usar esta semana como tu rutina?', 'Reemplaza los días de tu rutina de Halterofilia por los de la semana ' + wk.week + '. Tus sesiones ya registradas no cambian. Los ejercicios que falten se crean.', 'Usar esta semana')) return;
            try { const days = K.toRoutine(plan, wk), cur = store.list('plan').filter(p => p.discipline === 'halterofilia')[0]; store.save('plan', Object.assign(cur ? { id: cur.id } : {}, { name: 'Plan del entrenador · semana ' + wk.week, discipline: 'halterofilia', kind: 'weekly', days: days })); A.ui.toast('Rutina actualizada con la semana ' + wk.week + '.'); location.hash = '#/entrenos/halterofilia/plan'; } catch (e) { A.ui.toast(e && e.message || 'No se pudo.'); } } }, 'Usar como mi rutina')));
        wk.sessions.forEach(s => body.push(h('section', { class: 'card' }, h('h3', { class: 'sub' }, s.name || K.dayName(s.day)),
          h('ul', { class: 'rows' }, s.items.map(it => { const mx = K.maxOf(plan, it);
            return h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, K.itemName(plan, it)), h('span', { class: 'hint' }, (it.block ? it.block + ' · ' : '') + (it.sets || []).map(x => fmtSet(x) + (mx && x.pct ? ' ≈ ' + U.fmtNum(Math.round(mx * x.pct / 100), 0) + ' kg' : '')).join(' / '))));
          })))));
      }
      body.push(h('div', { class: 'row-end wrap' }, refresh)); box.replaceChildren.apply(box, body);
    })().catch(e => box.replaceChildren(h('p', { class: 'note warn', role: 'alert' }, e && e.message || 'No se pudo mostrar el plan.')));
  });
})(window);
