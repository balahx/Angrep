/* Pantallas de «Alimentación» (fase 3), primera parte: Registro del día y Alimentos (base propia). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, field = A.ui.field, U = A.util, store = A.store, F = A.food, S = A.schema, W = A.vw;
  const tile = W.tile, tiles = W.tiles, wrapView = W.wrapView, dateInput = W.dateInput, errBox = W.errBox, optionsOf = W.optionsOf, removeWithUndo = W.removeWithUndo, meter = W.meter;

  const SLOT_LABEL = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', once: 'Once', cena: 'Cena', colacion: 'Colación' };
  const UNIT_OPTS = F.UNITS.map(u => [u, u]);
  /* Metas guardadas: kcal y macros en gramos (null si no hay) */
  const goals = () => { const k = store.get('goal', 'goal_kcal'), m = store.get('goal', 'goal_macros'); return { kcal: k ? k.target : null, p: m ? m.p : null, c: m ? m.c : null, f: m ? m.f : null, kcalRec: k || null, macRec: m || null }; };
  W.foodGoals = goals; W.SLOT_LABEL = SLOT_LABEL; W.UNIT_OPTS = UNIT_OPTS;

  /* Lee un campo numérico: null si está vacío y es opcional, NaN si no es un número */
  const readNum = (inp, optional) => { const t = inp.value.trim(); if (!t) return optional ? null : NaN; const v = U.parseNum(t); return v == null ? NaN : v; };
  const numInput = (id, ph, val) => h('input', { class: 'txt', id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: ph || '', value: val == null ? '' : String(val).replace('.', ',') });
  const macroText = o => ['P', 'C', 'G'].map((l, i) => { const v = [o.p, o.c, o.f][i]; return v == null ? null : l + ' ' + U.fmtNum(v, 1); }).filter(Boolean).join(' · ');
  const defaultSlot = () => { const hr = new Date().getHours(); return hr < 11 ? 'desayuno' : hr < 16 ? 'almuerzo' : hr < 19 ? 'once' : 'cena'; };

  /* ---------- Alimentación · Registro ---------- */
  let fDate = null, lastSlot = null, editMeal = null;
  wrapView('comida/registro', (el, again) => {
    const today = U.today(), date = fDate && fDate <= today ? fDate : today, g = goals();
    const meals = store.list('meal').filter(m => m.date === date), quick = store.get('nutriday', 'nutriday_' + date) || null;
    const total = F.dayTotal(meals, quick), st = F.dayStatus(total, g);

    /* Día */
    const dIn = dateInput('f-date', date);
    dIn.addEventListener('change', () => { if (U.isYmd(dIn.value) && dIn.value <= today) { fDate = dIn.value; editMeal = null; again(); } else dIn.value = date; });
    const go = n => () => { const d = U.ymd(U.addDays(U.parseYmd(date), n)); if (d > today) return; fDate = d; editMeal = null; again(); };
    el.appendChild(h('section', { class: 'card daybar' },
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Día anterior', onclick: go(-1) }, '‹'),
      h('div', { class: 'daybar-mid' }, field('f-date', date === today ? 'Hoy' : W.longDate(date), dIn)),
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Día siguiente', disabled: date >= today, onclick: go(1) }, '›'),
      date !== today ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { fDate = null; editMeal = null; again(); } }, 'Hoy') : null));

    /* Resumen del día */
    const sum = h('section', { class: 'card' }, h('h2', null, 'Resumen del día'));
    if (!total) sum.appendChild(h('p', { class: 'muted' }, 'Aún no registras nada este día.'));
    else {
      sum.appendChild(meter('Calorías', total.kcal, g.kcal, 'kcal'));
      if (g.kcal) sum.appendChild(h('p', { class: st.ok === false && st.kcalOk === false ? 'note warn' : 'muted', role: 'status' }, g.kcal - total.kcal >= 0 ? 'Te quedan ' + U.fmtNum(g.kcal - total.kcal, 0) + ' kcal.' : 'Te pasaste por ' + U.fmtNum(total.kcal - g.kcal, 0) + ' kcal.', st.ok === true ? ' Día en meta.' : st.protOk === false ? ' Falta proteína para llegar a la meta.' : ''));
      if (total.macros || g.p) {
        sum.appendChild(meter('Proteínas', total.p, g.p, 'g'));
        sum.appendChild(meter('Carbohidratos', total.c, g.c, 'g'));
        sum.appendChild(meter('Grasas', total.f, g.f, 'g'));
      }
      sum.appendChild(h('p', { class: 'hint' }, total.source === 'comidas' ? 'Suma de ' + total.n + (total.n === 1 ? ' comida' : ' comidas') + '.' : 'Vienen de los totales rápidos del día.'));
    }
    if (!g.kcal) sum.appendChild(h('p', { class: 'hint' }, ['Aún no tienes meta de kcal. ', h('a', { href: '#/comida/objetivos' }, 'Calcúlala en Objetivos'), '.']));
    el.appendChild(sum);

    /* Formulario para agregar o editar una comida */
    const em = editMeal && editMeal.date === date ? editMeal : null;
    let picked = em && em.foodId ? store.get('food', em.foodId) || null : null;
    const slotSel = h('select', { class: 'txt', id: 'fm-slot' }, optionsOf(S.SLOTS.map(s => [s, SLOT_LABEL[s]]), em ? em.slot : lastSlot || defaultSlot()));
    const q = h('input', { class: 'txt', id: 'fm-q', type: 'search', autocomplete: 'off', placeholder: 'Escribe para buscar…', 'aria-controls': 'fm-pick' });
    const pick = h('ul', { class: 'pick', id: 'fm-pick', 'aria-label': 'Alimentos encontrados' });
    const name = h('input', { class: 'txt', id: 'fm-name', type: 'text', maxlength: 120, value: em ? em.name : '', placeholder: 'Ej. Pan con palta' });
    const qty = numInput('fm-qty', 'Ej. 150', em ? em.qty : null), unit = h('select', { class: 'txt', id: 'fm-unit', 'aria-label': 'Unidad' }, optionsOf(UNIT_OPTS, em && em.unit ? em.unit : 'porción'));
    const kc = numInput('fm-kcal', 'Ej. 320', em ? em.kcal : null), p = numInput('fm-p', 'Opcional', em ? em.p : null), c = numInput('fm-c', 'Opcional', em ? em.c : null), f = numInput('fm-f', 'Opcional', em ? em.f : null);
    const keep = h('input', { type: 'checkbox', id: 'fm-keep' }), keepRow = h('label', { class: 'check', for: 'fm-keep' }, keep, ' Guardar también en mis alimentos'), err = errBox(), pickedNote = h('p', { class: 'hint' });
    const fill = () => { if (!picked) return; const qv = readNum(qty, true); if (qv == null || isNaN(qv) || qv <= 0) return; const s = F.scale(picked, qv); kc.value = String(s.kcal).replace('.', ','); p.value = s.p == null ? '' : String(s.p).replace('.', ','); c.value = s.c == null ? '' : String(s.c).replace('.', ','); f.value = s.f == null ? '' : String(s.f).replace('.', ','); };
    const showPicked = () => { pickedNote.textContent = picked ? 'Valores calculados desde «' + picked.name + '» (' + U.fmtNum(picked.amount, 1) + ' ' + picked.unit + ' = ' + U.fmtNum(picked.kcal, 0) + ' kcal). Puedes ajustarlos.' : ''; keepRow.hidden = !!picked; };
    const chooseFood = fd => { picked = fd; name.value = fd.name; qty.value = String(fd.amount).replace('.', ','); unit.value = fd.unit || 'g'; fill(); showPicked(); pick.innerHTML = ''; q.value = ''; kc.focus(); };
    const list = () => {
      pick.innerHTML = ''; const res = F.search(store.list('food'), q.value).slice(0, 8);
      if (!res.length && q.value.trim()) pick.appendChild(h('li', { class: 'hint' }, 'No hay coincidencias en tu base. Escribe el nombre y los valores abajo.'));
      res.forEach(fd => pick.appendChild(h('li', null, h('button', { type: 'button', class: 'pick-b', onclick: () => chooseFood(fd) }, h('span', null, (fd.fav ? '★ ' : '') + fd.name), h('span', { class: 'muted' }, U.fmtNum(fd.amount, 1) + ' ' + fd.unit + ' · ' + U.fmtNum(fd.kcal, 0) + ' kcal')))));
    };
    q.addEventListener('input', list);
    qty.addEventListener('input', fill); name.addEventListener('input', () => { if (picked && F.norm(name.value) !== F.norm(picked.name)) { picked = null; showPicked(); } });
    const form = h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); err.textContent = '';
      const nm = name.value.trim(), qv = readNum(qty, true), kv = readNum(kc), pv = readNum(p, true), cv = readNum(c, true), fv = readNum(f, true);
      if (!nm) { err.textContent = 'Escribe qué comiste.'; return; }
      if (isNaN(kv) || kv < 0 || kv > 20000) { err.textContent = 'Escribe las kcal como número (0 a 20.000).'; return; }
      if ([pv, cv, fv].some(v => v != null && (isNaN(v) || v < 0 || v > 2000))) { err.textContent = 'Los macros deben ser números en gramos (0 a 2.000), o dejarse vacíos.'; return; }
      if (qv != null && (isNaN(qv) || qv <= 0)) { err.textContent = 'La cantidad debe ser un número mayor que cero, o quedar vacía.'; return; }
      try { store.save('meal', Object.assign(em ? { id: em.id } : {}, { date: date, slot: slotSel.value, name: nm, kcal: U.round(kv, 1), p: pv, c: cv, f: fv, qty: qv, unit: qv == null ? null : unit.value, foodId: picked ? picked.id : null })); } catch (x) { err.textContent = x.message; return; }
      let extra = '';
      if (!picked && keep.checked && !em && F.search(store.list('food'), nm).every(x => F.norm(x.name) !== F.norm(nm))) {
        try { store.save('food', Object.assign({ name: nm, unit: unit.value, amount: qv || 1, kcal: U.round(kv, 1), source: 'manual' }, pv != null ? { p: pv } : {}, cv != null ? { c: cv } : {}, fv != null ? { f: fv } : {})); extra = ' Guardado en tus alimentos.'; } catch (x) { extra = ' No se guardó en alimentos: ' + x.message; }
      }
      lastSlot = slotSel.value; editMeal = null; A.ui.toast((em ? 'Comida actualizada.' : 'Comida agregada.') + extra); again();
    } },
    h('h2', null, em ? 'Editar comida' : 'Agregar comida'),
    field('fm-slot', 'Comida del día', slotSel),
    em ? null : field('fm-q', 'Buscar en mis alimentos', q, 'Primero se busca en tu base, sin conexión.'), em ? null : pick,
    field('fm-name', 'Qué comiste', name), pickedNote,
    h('div', { class: 'grid2' }, field('fm-qty', 'Cantidad', qty), field('fm-unit', 'Unidad', unit)),
    h('div', { class: 'grid2' }, field('fm-kcal', 'Kcal', kc), field('fm-p', 'Proteínas (g)', p)),
    h('div', { class: 'grid2' }, field('fm-c', 'Carbohidratos (g)', c), field('fm-f', 'Grasas (g)', f)),
    keepRow, err,
    h('div', { class: 'row-end' }, em ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { editMeal = null; again(); } }, 'Cancelar') : null, h('button', { class: 'btn', type: 'submit' }, em ? 'Actualizar' : 'Agregar')));
    showPicked(); if (!em) list();

    /* Comidas del día */
    const prevD = U.ymd(U.addDays(U.parseYmd(date), -1)), prev = store.list('meal').filter(m => m.date === prevD);
    const secs = h('section', { class: 'card' }, h('h2', null, 'Comidas'));
    S.SLOTS.forEach(sl => {
      const items = meals.filter(m => m.slot === sl).sort((a, b) => a.updatedAt - b.updatedAt), sub = items.reduce((t, m) => t + m.kcal, 0);
      const ul = h('ul', { class: 'rows stack', 'aria-label': SLOT_LABEL[sl] });
      items.forEach(m => ul.appendChild(h('li', { class: 'row' },
        h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, m.name), h('span', { class: 'hint' }, [m.qty ? U.fmtNum(m.qty, 1) + ' ' + (m.unit || '') : null, macroText(m)].filter(Boolean).join(' · '))),
        h('strong', null, U.fmtNum(m.kcal, 0) + ' kcal'),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Editar ' + m.name, onclick: () => { editMeal = m; again(); const fm = document.getElementById('fm-name'); if (fm) { fm.focus(); fm.scrollIntoView({ block: 'center' }); } } }, 'Editar'),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar ' + m.name, onclick: () => removeWithUndo('meal', m, () => store.save('meal', m), again) }, 'Eliminar'))));
      secs.appendChild(h('div', { class: 'slot' },
        h('div', { class: 'slot-head' }, h('h3', { class: 'sub' }, SLOT_LABEL[sl]), items.length ? h('span', { class: 'muted' }, U.fmtNum(sub, 0) + ' kcal') : null,
          h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Agregar a ' + SLOT_LABEL[sl].toLowerCase(), onclick: () => { slotSel.value = sl; const t = document.getElementById('fm-q') || document.getElementById('fm-name'); if (t) { t.focus(); t.scrollIntoView({ block: 'center' }); } } }, 'Agregar')),
        items.length ? ul : h('p', { class: 'hint' }, 'Sin registros.')));
    });
    secs.appendChild(h('div', { class: 'row-end wrap' }, h('button', { class: 'btn ghost', type: 'button', disabled: !prev.length, onclick: async () => {
      if (meals.length && !(await A.ui.confirm('¿Copiar el día anterior?', 'Este día ya tiene comidas; se agregan las del día anterior sin borrar las actuales.', 'Copiar'))) return;
      prev.forEach(m => store.save('meal', { date: date, slot: m.slot, name: m.name, kcal: m.kcal, p: m.p == null ? null : m.p, c: m.c == null ? null : m.c, f: m.f == null ? null : m.f, qty: m.qty == null ? null : m.qty, unit: m.unit || null, foodId: m.foodId || null }));
      A.ui.toast(prev.length + (prev.length === 1 ? ' comida copiada.' : ' comidas copiadas.')); again();
    } }, 'Copiar el día anterior' + (prev.length ? ' (' + prev.length + ')' : ''))));
    el.appendChild(secs);
    el.appendChild(form);

    /* Totales rápidos del día (cuando no se detalla cada comida) */
    const qk = numInput('q-kcal', 'Ej. 1900', quick ? quick.kcal : null), qp = numInput('q-p', 'Opcional', quick ? quick.p : null), qc = numInput('q-c', 'Opcional', quick ? quick.c : null), qf = numInput('q-f', 'Opcional', quick ? quick.f : null), qerr = errBox();
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); qerr.textContent = '';
      const kv = readNum(qk), pv = readNum(qp, true), cv = readNum(qc, true), fv = readNum(qf, true);
      if (isNaN(kv) || kv < 0 || kv > 20000) { qerr.textContent = 'Escribe las kcal del día como número (0 a 20.000).'; return; }
      if ([pv, cv, fv].some(v => v != null && (isNaN(v) || v < 0 || v > 2000))) { qerr.textContent = 'Los macros deben ser números en gramos, o dejarse vacíos.'; return; }
      try { store.save('nutriday', { date: date, kcal: U.round(kv, 1), p: pv, c: cv, f: fv }); } catch (x) { qerr.textContent = x.message; return; }
      A.ui.toast('Totales del día guardados.'); again();
    } }, h('h2', null, 'Totales rápidos del día'),
    h('p', { class: 'muted' }, 'Para días en que no detallas cada comida: anota solo el total. ' + (meals.length ? 'Este día ya tiene comidas, así que estos totales no se suman: valen las comidas.' : 'Si luego agregas comidas, valen las comidas.')),
    h('div', { class: 'grid2' }, field('q-kcal', 'Kcal del día', qk), field('q-p', 'Proteínas (g)', qp)),
    h('div', { class: 'grid2' }, field('q-c', 'Carbohidratos (g)', qc), field('q-f', 'Grasas (g)', qf)), qerr,
    h('div', { class: 'row-end' }, quick ? h('button', { class: 'btn ghost', type: 'button', onclick: () => removeWithUndo('nutriday', quick, () => store.save('nutriday', { date: quick.date, kcal: quick.kcal, p: quick.p == null ? null : quick.p, c: quick.c == null ? null : quick.c, f: quick.f == null ? null : quick.f }), again, 'Totales eliminados.') }, 'Quitar totales') : null, h('button', { class: 'btn', type: 'submit' }, quick ? 'Actualizar' : 'Guardar'))));
  });

  /* ---------- Alimentación · Alimentos ---------- */
  const PROMPT = 'Te paso fotos de tablas nutricionales. Devuélveme solo un JSON con esta forma: {"alimentos":[{"nombre":"…","unidad":"g","cantidad":100,"kcal":0,"p":0,"c":0,"f":0}]}. Usa los valores para la cantidad que indica la tabla (por 100 g o por porción). p = proteínas, c = carbohidratos y f = grasas, en gramos. Si un dato no se lee bien, déjalo fuera en lugar de inventarlo.';
  let foodQ = '', foodShown = 40, editFood = null, labelUrl = null;
  const freeLabel = () => { if (labelUrl) { URL.revokeObjectURL(labelUrl); labelUrl = null; } };
  wrapView('comida/alimentos', (el, again) => {
    freeLabel();
    const all = store.list('food');

    /* Lista */
    const ul = h('ul', { class: 'rows stack', 'aria-label': 'Mis alimentos' }), count = h('p', { class: 'hint', role: 'status' }), more = h('div', { class: 'row-end' });
    const draw = () => {
      ul.innerHTML = ''; more.innerHTML = '';
      const res = F.search(all, foodQ); count.textContent = res.length + (res.length === 1 ? ' alimento' : ' alimentos') + (foodQ.trim() ? ' encontrados' : ' en tu base');
      res.slice(0, foodShown).forEach(fd => ul.appendChild(h('li', { class: 'row' },
        h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, fd.name), h('span', { class: 'hint' }, [U.fmtNum(fd.amount, 1) + ' ' + fd.unit + ' = ' + U.fmtNum(fd.kcal, 0) + ' kcal', macroText(fd)].filter(Boolean).join(' · '))),
        h('button', { class: 'btn ghost sm fav', type: 'button', 'aria-pressed': String(!!fd.fav), 'aria-label': 'Favorito: ' + fd.name, onclick: () => { store.save('food', { id: fd.id, name: fd.name, unit: fd.unit, amount: fd.amount, kcal: fd.kcal, fav: !fd.fav }); again(); } }, fd.fav ? '★' : '☆'),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Editar ' + fd.name, onclick: () => { editFood = fd; again(); const t = document.getElementById('fa-name'); if (t) { t.focus(); t.scrollIntoView({ block: 'center' }); } } }, 'Editar'),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar ' + fd.name, onclick: () => removeWithUndo('food', fd, () => store.save('food', fd), again, 'Alimento eliminado. Las comidas ya registradas no cambian.') }, 'Eliminar'))));
      if (res.length > foodShown) more.appendChild(h('button', { class: 'btn ghost', type: 'button', onclick: () => { foodShown += 40; draw(); } }, 'Mostrar más'));
    };
    const search = h('input', { class: 'txt', id: 'fa-q', type: 'search', autocomplete: 'off', value: foodQ, placeholder: 'Buscar…' });
    search.addEventListener('input', () => { foodQ = search.value; foodShown = 40; draw(); });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Mis alimentos'), all.length ? field('fa-q', 'Buscar', search) : null, all.length ? count : h('p', { class: 'muted' }, 'Tu base está vacía. Agrega alimentos abajo: se guardan en este dispositivo y funcionan sin conexión.'), ul, more));
    draw();

    /* Agregar o editar */
    const ed = editFood && all.some(x => x.id === editFood.id) ? editFood : null;
    const name = h('input', { class: 'txt', id: 'fa-name', type: 'text', maxlength: 120, value: ed ? ed.name : '', placeholder: 'Ej. Yogurt natural' });
    const amount = numInput('fa-amount', 'Ej. 100', ed ? ed.amount : 100), unit = h('select', { class: 'txt', id: 'fa-unit', 'aria-label': 'Unidad' }, optionsOf(UNIT_OPTS, ed ? ed.unit : 'g'));
    const kc = numInput('fa-kcal', 'Ej. 350', ed ? ed.kcal : null), p = numInput('fa-p', 'Opcional', ed ? ed.p : null), c = numInput('fa-c', 'Opcional', ed ? ed.c : null), f = numInput('fa-f', 'Opcional', ed ? ed.f : null);
    const fav = h('input', { type: 'checkbox', id: 'fa-fav', checked: !!(ed && ed.fav) }), err = errBox(), warn = h('p', { class: 'note warn', role: 'status' }), btn = h('button', { class: 'btn', type: 'submit' }, ed ? 'Actualizar' : 'Guardar');
    let fromPhoto = ed ? ed.source === 'foto' : false, warned = false;
    const resetWarn = () => { warned = false; warn.textContent = ''; btn.textContent = ed ? 'Actualizar' : 'Guardar'; };
    [kc, p, c, f].forEach(i => i.addEventListener('input', resetWarn));
    const photoBox = h('div', { class: 'label-box', hidden: true }), photoIn = h('input', { class: 'file', id: 'fa-photo', type: 'file', accept: 'image/*' });
    photoIn.addEventListener('change', () => {
      freeLabel(); photoBox.innerHTML = '';
      const file = photoIn.files && photoIn.files[0];
      if (!file) { photoBox.hidden = true; fromPhoto = false; return; }
      if (!/^image\//.test(file.type || '')) { err.textContent = 'El archivo no es una imagen.'; photoIn.value = ''; photoBox.hidden = true; return; }
      err.textContent = ''; labelUrl = URL.createObjectURL(file); fromPhoto = true;
      photoBox.hidden = false; photoBox.appendChild(h('img', { class: 'label-img', src: labelUrl, alt: 'Foto de la tabla nutricional que estás copiando' }));
      photoBox.appendChild(h('p', { class: 'hint' }, 'Copia los valores de la tabla en los campos. La foto no se guarda: solo te acompaña mientras anotas.'));
    });
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); err.textContent = '';
      const nm = name.value.trim(), av = readNum(amount), kv = readNum(kc), pv = readNum(p, true), cv = readNum(c, true), fv = readNum(f, true);
      if (!nm) { err.textContent = 'Escribe el nombre del alimento.'; return; }
      if (isNaN(av) || av <= 0 || av > 100000) { err.textContent = 'La cantidad base debe ser un número mayor que cero (la que muestra la tabla, p. ej. 100 g).'; return; }
      if (isNaN(kv) || kv < 0 || kv > 100000) { err.textContent = 'Escribe las kcal como número.'; return; }
      if ([pv, cv, fv].some(v => v != null && (isNaN(v) || v < 0 || v > 10000))) { err.textContent = 'Los macros deben ser números en gramos, o dejarse vacíos.'; return; }
      if (all.some(x => F.norm(x.name) === F.norm(nm) && (!ed || x.id !== ed.id))) { err.textContent = 'Ya tienes un alimento con ese nombre.'; return; }
      const co = F.coherence({ kcal: kv, p: pv, c: cv, f: fv });
      if (!co.ok && !warned) { warned = true; warn.textContent = 'Las kcal (' + U.fmtNum(kv, 0) + ') no cuadran con los macros: 4·P + 4·C + 9·G da cerca de ' + U.fmtNum(co.expected, 0) + '. Revisa la etiqueta; si está bien así, guarda de todos modos.'; btn.textContent = 'Guardar de todos modos'; return; }
      const rec = { name: nm, unit: unit.value, amount: U.round(av, 2), kcal: U.round(kv, 1), p: pv, c: cv, f: fv, fav: fav.checked, source: fromPhoto ? 'foto' : ed && ed.source ? ed.source : 'manual' };
      try { store.save('food', Object.assign(ed ? { id: ed.id } : {}, rec)); } catch (x) { err.textContent = x.message; return; }
      editFood = null; A.ui.toast(ed ? 'Alimento actualizado.' : 'Alimento guardado.'); again();
    } },
    h('h2', null, ed ? 'Editar alimento' : 'Agregar alimento'),
    h('details', { class: 'more' }, h('summary', null, 'Tengo una foto de la tabla nutricional'),
      h('p', { class: 'hint' }, 'La lectura automática de la etiqueta aún no está disponible. Por ahora la foto se muestra junto al formulario para que copies los valores. Otra opción: pasa las fotos por un chat con Claude y pega el resultado en «Importar» más abajo.'),
      field('fa-photo', 'Foto de la etiqueta', photoIn), photoBox),
    field('fa-name', 'Nombre', name),
    h('div', { class: 'grid2' }, field('fa-amount', 'Cantidad base', amount, 'La de la tabla: 100 g, 1 porción…'), field('fa-unit', 'Unidad', unit)),
    h('div', { class: 'grid2' }, field('fa-kcal', 'Kcal', kc), field('fa-p', 'Proteínas (g)', p)),
    h('div', { class: 'grid2' }, field('fa-c', 'Carbohidratos (g)', c), field('fa-f', 'Grasas (g)', f)),
    h('label', { class: 'check', for: 'fa-fav' }, fav, ' Marcar como favorito'), warn, err,
    h('div', { class: 'row-end' }, ed ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { editFood = null; again(); } }, 'Cancelar') : null, btn)));

    /* Importar JSON (plan B de la lectura de etiquetas) */
    const text = h('textarea', { class: 'txt area', id: 'fi-text', rows: 6, placeholder: '{"alimentos":[{"nombre":"Yogurt natural","unidad":"g","cantidad":125,"kcal":75,"p":5.5,"c":9,"f":2}]}', spellcheck: 'false' }), prev = h('div'), ierr = errBox();
    const check = () => {
      ierr.textContent = ''; prev.innerHTML = '';
      if (!text.value.trim()) { ierr.textContent = 'Pega primero el JSON.'; return; }
      const r = F.parseFoods(text.value, store.list('food'));
      if (r.errors.length) prev.appendChild(h('ul', { class: 'note warn', role: 'status' }, r.errors.map(x => h('li', null, x))));
      if (r.dup) prev.appendChild(h('p', { class: 'hint' }, r.dup + (r.dup === 1 ? ' alimento ya está en tu base y se omite.' : ' alimentos ya están en tu base y se omiten.')));
      if (!r.foods.length) { if (!r.errors.length) prev.appendChild(h('p', { class: 'muted' }, 'No hay alimentos nuevos para importar.')); return; }
      const lst = h('ul', { class: 'rows', 'aria-label': 'Alimentos a importar' });
      r.foods.forEach(fd => { const co = F.coherence(fd); lst.appendChild(h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, fd.name), h('span', { class: 'hint' }, U.fmtNum(fd.amount, 1) + ' ' + fd.unit + ' = ' + U.fmtNum(fd.kcal, 0) + ' kcal' + (macroText(fd) ? ' · ' + macroText(fd) : ''))), co.ok ? null : h('span', { class: 'status vencido' }, '! kcal no cuadran con macros'))); });
      prev.appendChild(lst);
      prev.appendChild(h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', onclick: () => { let n = 0; r.foods.forEach(fd => { try { store.save('food', fd); n++; } catch (x) { /* ya validado */ } }); A.ui.toast(n + (n === 1 ? ' alimento importado.' : ' alimentos importados.')); text.value = ''; again(); } }, 'Importar ' + r.foods.length + (r.foods.length === 1 ? ' alimento' : ' alimentos'))));
    };
    const promptBox = h('textarea', { class: 'txt area', rows: 5, readonly: true, 'aria-label': 'Texto para pedirle el JSON a Claude' }, PROMPT);
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Importar alimentos (JSON)'),
      h('p', { class: 'muted' }, 'Sube las fotos de las etiquetas a un chat con Claude con este texto, y pega aquí el JSON que te devuelva. Revisas la lista antes de importar.'),
      h('details', { class: 'more' }, h('summary', null, 'Texto para pegar en el chat'), promptBox, h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(PROMPT); A.ui.toast('Texto copiado.'); } catch (x) { promptBox.focus(); promptBox.select(); A.ui.toast('Selecciónalo y cópialo.'); } } }, 'Copiar texto'))),
      field('fi-text', 'JSON con los alimentos', text), ierr, h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', onclick: check }, 'Revisar')), prev));
  });
})(window);
