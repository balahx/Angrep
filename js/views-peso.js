/* Pantallas de «Peso» (fase 2): registro, pasos, medidas y fotos, progreso y objetivo. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, field = A.ui.field, U = A.util, store = A.store, C = A.calc, V = A.views = A.views || {}, S = A.schema;
  const W = A.vw, signed = W.signed, longDate = W.longDate, tile = W.tile, tiles = W.tiles, wrapView = W.wrapView, dateInput = W.dateInput, errBox = W.errBox, optionsOf = W.optionsOf, removeWithUndo = W.removeWithUndo, chips = W.chips;

  /* ---------- Piezas comunes ---------- */
  const kgText = (v, d) => U.fmtNum(v, d == null ? 1 : d) + ' kg';
  const goalMain = () => store.get('goal', 'goal_main_weight');
  const cur = series => { const st = C.stats(series); return st ? st : null; };

  /* ---------- Peso · Registro ---------- */
  let regShown = 30, regDate = null;
  wrapView('peso/registro', (el, again) => {
    const series = C.weightSeries(store.list('weight')), st = cur(series), byDate = {};
    series.forEach(p => { byDate[p.date] = p; });
    const recs = {}; store.list('weight').forEach(r => { recs[r.date] = r; });
    el.appendChild(tiles([
      tile('Último peso', st ? kgText(st.last.value) : '–', st ? U.fmtDate(st.last.date) : 'Sin registros'),
      tile('Tendencia (7 días)', st ? kgText(st.avg) : '–', 'Promedio de la última semana'),
      tile('Cambio en 7 días', st ? signed(st.d7, 1, 'kg') : '–', st && st.d7 == null ? 'Aún sin datos suficientes' : 'Según la tendencia')]));

    const date = dateInput('w-date', regDate), kg = h('input', { class: 'txt', id: 'w-kg', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'Ej. 80,4' });
    const note = h('input', { class: 'txt', id: 'w-note', type: 'text', maxlength: 200, placeholder: 'Opcional' });
    const tag = h('select', { class: 'txt', id: 'w-tag', 'aria-label': 'Tipo de foto' }, optionsOf(A.photos.TAGS, 'frente'));
    const file = h('input', { class: 'file', id: 'w-photo', type: 'file', accept: 'image/*' });
    const hint = h('p', { class: 'hint' }), err = errBox();
    const btn = h('button', { class: 'btn', type: 'submit' }, 'Guardar');
    const sync = () => { const r = recs[date.value]; if (r) { kg.value = String(r.kg).replace('.', ','); note.value = r.note || ''; } hint.textContent = r ? 'Ya hay un peso para este día: al guardar se actualiza.' : ''; btn.textContent = r ? 'Actualizar' : 'Guardar'; };
    date.addEventListener('change', () => { regDate = date.value; sync(); });
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: async e => {
      e.preventDefault(); err.textContent = '';
      const v = U.parseNum(kg.value);
      if (v == null) { err.textContent = 'Escribe tu peso en kg, por ejemplo 80,4.'; return; }
      if (!U.isYmd(date.value) || date.value > U.today()) { err.textContent = 'La fecha no es válida (no puede ser futura).'; return; }
      try { store.save('weight', { date: date.value, kg: U.round(v, 2), note: note.value.trim() }); } catch (x) { err.textContent = /peso/.test(x.message) ? 'El peso debe estar entre 20 y 400 kg.' : x.message; return; }
      let extra = '';
      if (file.files && file.files[0]) { try { await A.photos.add(file.files[0], { date: date.value, tag: tag.value }); extra = ' Foto guardada en este dispositivo.'; } catch (x) { extra = ' La foto no se guardó: ' + x.message; } }
      regDate = null; A.ui.toast('Peso guardado.' + extra); again();
    } },
    h('h2', null, 'Registrar peso'),
    field('w-date', 'Fecha', date), field('w-kg', 'Peso (kg)', kg, 'Se acepta coma o punto.'), field('w-note', 'Nota', note), hint,
    h('details', { class: 'more' }, h('summary', null, 'Agregar una foto (opcional)'), field('w-photo', 'Foto', file, 'Se guarda solo en este dispositivo. También puedes agregarla después en Medidas y fotos.'), field('w-tag', 'Tipo', tag)),
    err, h('div', { class: 'row-end' }, btn)));
    sync();

    /* Historial */
    const rows = series.slice().reverse().slice(0, regShown);
    const list = h('ul', { class: 'rows', 'aria-label': 'Pesos registrados' });
    rows.forEach(p => {
      const i = series.indexOf(p), prev = i > 0 ? series[i - 1] : null, r = recs[p.date];
      list.appendChild(h('li', { class: 'row' },
        h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, U.fmtDate(p.date)), r && r.note ? h('span', { class: 'hint' }, r.note) : null),
        h('strong', null, kgText(p.value)), h('span', { class: 'delta' }, prev ? signed(U.round(p.value - prev.value, 2), 1) : ''),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Editar ' + U.fmtDate(p.date), onclick: () => { date.value = p.date; regDate = p.date; sync(); kg.focus(); date.scrollIntoView({ block: 'center' }); } }, 'Editar'),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar ' + U.fmtDate(p.date), onclick: () => removeWithUndo('weight', r, () => store.save('weight', { date: r.date, kg: r.kg, note: r.note }), again) }, 'Eliminar')));
    });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Historial'),
      series.length ? list : h('p', { class: 'muted' }, 'Aún no hay pesos registrados.'),
      series.length > regShown ? h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { regShown += 30; again(); } }, 'Mostrar más')) : null));
  });

  /* ---------- Peso · Pasos ---------- */
  let stepsRange = 14;
  wrapView('peso/pasos', (el, again) => {
    const goalRec = store.get('goal', 'goal_steps'), goal = goalRec ? goalRec.target : null, today = U.today();
    const list = store.list('steps'), by = {}; list.forEach(r => { by[r.date] = r; });
    const ss = C.stepsStats(list, goal, today), f0 = n => n == null ? '–' : U.fmtNum(n, 0);
    el.appendChild(tiles([tile('Promedio (7 días)', f0(ss.avg7), 'pasos por día'), tile('Racha', goal ? ss.streak + (ss.streak === 1 ? ' día' : ' días') : '–', goal ? 'Mejor: ' + ss.best : 'Define una meta'), tile('Meta cumplida (30 d)', ss.pct30 == null ? '–' : ss.pct30 + ' %', 'de los últimos 30 días')]));

    const date = dateInput('s-date'), cnt = h('input', { class: 'txt', id: 's-count', type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Ej. 8500' }), err = errBox();
    const btn = h('button', { class: 'btn', type: 'submit' }, 'Guardar');
    const sync = () => { const r = by[date.value]; cnt.value = r ? String(r.count) : ''; btn.textContent = r ? 'Actualizar' : 'Guardar'; };
    date.addEventListener('change', sync);
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); err.textContent = '';
      const v = U.parseNum(cnt.value);
      if (v == null || !Number.isInteger(v) || v < 0 || v > 200000) { err.textContent = 'Escribe los pasos como número entero (0 a 200.000).'; return; }
      if (!U.isYmd(date.value) || date.value > today) { err.textContent = 'La fecha no es válida (no puede ser futura).'; return; }
      try { store.save('steps', { date: date.value, count: v }); } catch (x) { err.textContent = x.message; return; }
      A.ui.toast('Pasos guardados.'); again();
    } }, h('h2', null, 'Registrar pasos'), field('s-date', 'Fecha', date), field('s-count', 'Pasos del día', cnt), err, h('div', { class: 'row-end' }, btn)));
    sync();

    const gIn = h('input', { class: 'txt', id: 'g-steps', type: 'text', inputmode: 'numeric', value: goal ? String(goal) : '', placeholder: 'Ej. 8000' }), gErr = errBox();
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); gErr.textContent = '';
      const v = U.parseNum(gIn.value);
      if (v == null || !Number.isInteger(v) || v < 1000 || v > 100000) { gErr.textContent = 'La meta debe ser un número entero entre 1.000 y 100.000.'; return; }
      store.save('goal', { id: 'goal_steps', kind: 'steps', target: v }); A.ui.toast('Meta guardada.'); again();
    } }, h('h2', null, 'Meta diaria'), field('g-steps', 'Pasos por día', gIn, 'Con la meta se calculan la racha y el cumplimiento.'), gErr, h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'submit' }, 'Guardar meta'))));

    const pts = []; for (let i = stepsRange - 1; i >= 0; i--) { const d = U.ymd(U.addDays(U.parseYmd(today), -i)), r = by[d]; pts.push({ label: String(+d.slice(8)), y: r ? r.count : 0, tip: U.fmtDate(d) + (r ? '' : ' · sin registro') }); }
    const host = h('div');
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Pasos por día'), chips([[14, '14 días'], [30, '30 días'], [90, '90 días']], stepsRange, v => { stepsRange = v; again(); }, 'Periodo'), host));
    A.charts.bars(host, { ariaLabel: 'Gráfico de columnas: pasos por día, últimos ' + stepsRange + ' días.' + (goal ? ' Meta: ' + U.fmtNum(goal, 0) + ' pasos.' : ''), unit: 'pasos', decimals: 0, name: 'Pasos', pts: pts, goal: goal ? { y: goal, label: 'Meta ' + U.fmtNum(goal, 0) } : null });

    const rows = list.sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 14), ul = h('ul', { class: 'rows', 'aria-label': 'Pasos registrados' });
    rows.forEach(r => ul.appendChild(h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, U.fmtDate(r.date))), h('strong', null, U.fmtNum(r.count, 0)), goal ? h('span', { class: 'delta' }, r.count >= goal ? '✓ meta' : '') : null,
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar ' + U.fmtDate(r.date), onclick: () => removeWithUndo('steps', r, () => store.save('steps', { date: r.date, count: r.count }), again) }, 'Eliminar'))));
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Últimos registros'), rows.length ? ul : h('p', { class: 'muted' }, 'Aún no hay pasos registrados.')));
  });

  /* ---------- Peso · Medidas y fotos ---------- */
  const SITE_LABEL = { cintura: 'Cintura', cadera: 'Cadera', pecho: 'Pecho', brazo: 'Brazo', muslo: 'Muslo', cuello: 'Cuello', pantorrilla: 'Pantorrilla' };
  let msite = 'cintura', photoShown = 12, urls = [];
  const freeUrls = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; };
  wrapView('peso/medidas', (el, again) => {
    freeUrls();
    const all = store.list('measure'), today = U.today();
    /* --- Medidas --- */
    const date = dateInput('m-date'), site = h('select', { class: 'txt', id: 'm-site' }, S.SITES.map(s => h('option', { value: s, selected: s === msite }, SITE_LABEL[s]))), cm = h('input', { class: 'txt', id: 'm-cm', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'Ej. 91,5' }), err = errBox();
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); err.textContent = '';
      const v = U.parseNum(cm.value);
      if (v == null || v < 5 || v > 300) { err.textContent = 'Escribe la medida en cm (entre 5 y 300).'; return; }
      if (!U.isYmd(date.value) || date.value > today) { err.textContent = 'La fecha no es válida (no puede ser futura).'; return; }
      const same = all.filter(r => r.date === date.value && r.site === site.value)[0];
      try { store.save('measure', Object.assign(same ? { id: same.id } : {}, { date: date.value, site: site.value, cm: U.round(v, 1) })); } catch (x) { err.textContent = x.message; return; }
      msite = site.value; A.ui.toast('Medida guardada.'); again();
    } }, h('h2', null, 'Registrar medida'), field('m-date', 'Fecha', date), field('m-site', 'Zona', site), field('m-cm', 'Medida (cm)', cm, 'Mide siempre en el mismo punto y a la misma hora.'), err, h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'submit' }, 'Guardar'))));

    const bySite = {}; all.forEach(r => { (bySite[r.site] = bySite[r.site] || []).push(r); });
    Object.keys(bySite).forEach(k => bySite[k].sort((a, b) => a.date < b.date ? -1 : 1));
    const sites = S.SITES.filter(s => bySite[s]);
    if (sites.length) {
      const tbody = h('tbody', null, sites.map(s => { const a = bySite[s], f = a[0], l = a[a.length - 1];
        return h('tr', null, h('th', { scope: 'row' }, SITE_LABEL[s]), h('td', null, U.fmtNum(l.cm, 1) + ' cm'), h('td', null, a.length > 1 ? signed(U.round(l.cm - f.cm, 1), 1, 'cm') : '–'), h('td', null, U.fmtDate(l.date))); }));
      const sel = h('select', { class: 'txt', id: 'm-view', 'aria-label': 'Zona del gráfico', onchange: () => { msite = sel.value; again(); } }, sites.map(s => h('option', { value: s, selected: s === (bySite[msite] ? msite : sites[0]) }, SITE_LABEL[s])));
      const shown = bySite[msite] ? msite : sites[0], host = h('div'), pts = bySite[shown].map(r => ({ x: U.daysBetween('2000-01-01', r.date), y: r.cm }));
      el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Tus medidas'),
        h('div', { class: 'dt-scroll' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Zona', 'Última', 'Cambio total', 'Fecha'].map(x => h('th', { scope: 'col' }, x)))), tbody)),
        field('m-view', 'Ver evolución de', sel), host));
      A.charts.line(host, { ariaLabel: 'Gráfico de línea: ' + SITE_LABEL[shown].toLowerCase() + ' en cm a lo largo del tiempo.', unit: 'cm', decimals: 1, xFormat: x => longDate(U.ymd(U.addDays(U.parseYmd('2000-01-01'), x))), xTickFormat: x => U.fmtShort(U.ymd(U.addDays(U.parseYmd('2000-01-01'), x))),
        series: [{ name: SITE_LABEL[shown], kind: 'line', cls: 'c1', pts: pts, endLabel: true }, { name: SITE_LABEL[shown], kind: 'dots', cls: 'c1', pts: pts, hover: false, legend: false }] });
      const ul = h('ul', { class: 'rows' }, all.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 10).map(r => h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, SITE_LABEL[r.site]), h('span', { class: 'hint' }, U.fmtDate(r.date))), h('strong', null, U.fmtNum(r.cm, 1) + ' cm'),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar ' + SITE_LABEL[r.site] + ' ' + U.fmtDate(r.date), onclick: () => removeWithUndo('measure', r, () => store.save('measure', { id: r.id, date: r.date, site: r.site, cm: r.cm }), again) }, 'Eliminar'))));
      el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Últimas medidas'), ul));
    }

    /* --- Fotos --- */
    const pdate = dateInput('p-date'), ptag = h('select', { class: 'txt', id: 'p-tag' }, optionsOf(A.photos.TAGS, 'frente')), pnote = h('input', { class: 'txt', id: 'p-note', type: 'text', maxlength: 200, placeholder: 'Opcional' }), pfile = h('input', { class: 'file', id: 'p-file', type: 'file', accept: 'image/*' }), perr = errBox();
    const pbtn = h('button', { class: 'btn', type: 'submit' }, 'Guardar foto');
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: async e => {
      e.preventDefault(); perr.textContent = '';
      if (!pfile.files || !pfile.files[0]) { perr.textContent = 'Elige una foto.'; return; }
      if (!U.isYmd(pdate.value) || pdate.value > today) { perr.textContent = 'La fecha no es válida (no puede ser futura).'; return; }
      pbtn.disabled = true;
      try { await A.photos.add(pfile.files[0], { date: pdate.value, tag: ptag.value, note: pnote.value.trim() }); A.ui.toast('Foto guardada en este dispositivo.'); again(); }
      catch (x) { perr.textContent = x.message; pbtn.disabled = false; }
    } }, h('h2', null, 'Fotos de progreso'), h('p', { class: 'muted' }, 'Las fotos se guardan solo en este dispositivo: no van al respaldo ni se sincronizan.'),
    field('p-date', 'Fecha', pdate), field('p-tag', 'Tipo', ptag), field('p-note', 'Nota', pnote), field('p-file', 'Foto', pfile), perr, h('div', { class: 'row-end' }, pbtn)));

    const photos = A.photos.list();
    const gal = h('div', { class: 'gallery' }), tagName = t => (A.photos.TAGS.filter(x => x[0] === t)[0] || [0, 'Otra'])[1];
    const imgFor = (p, cls) => { const im = h('img', { class: cls || 'thumb', alt: 'Foto ' + tagName(p.tag).toLowerCase() + ' del ' + U.fmtDate(p.date), loading: 'lazy' }); A.photos.url(p.blobKey).then(u => { if (u) { urls.push(u); im.src = u; } else im.alt = 'Foto no disponible en este dispositivo'; }); return im; };
    photos.slice(0, photoShown).forEach(p => gal.appendChild(h('figure', { class: 'ph' }, imgFor(p), h('figcaption', null, h('span', null, U.fmtDate(p.date) + ' · ' + tagName(p.tag)), p.note ? h('span', { class: 'hint' }, p.note) : null,
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar foto del ' + U.fmtDate(p.date), onclick: async () => { if (await A.ui.confirm('¿Eliminar esta foto?', 'Se borra de este dispositivo y no se puede recuperar.', 'Eliminar', true)) { await A.photos.remove(p.id); again(); } } }, 'Eliminar')))));
    const sec = h('section', { class: 'card' }, h('h2', null, 'Galería'), photos.length ? gal : h('p', { class: 'muted' }, 'Aún no hay fotos.'));
    if (photos.length > photoShown) sec.appendChild(h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { photoShown += 12; again(); } }, 'Mostrar más')));
    el.appendChild(sec);

    if (photos.length >= 2) {
      const opts = photos.map(p => h('option', { value: p.id }, U.fmtDate(p.date) + ' ' + new Date(U.parseYmd(p.date)).getFullYear() + ' · ' + tagName(p.tag)));
      const before = h('select', { class: 'txt', id: 'c-before' }, opts.map(o => o.cloneNode(true))), after = h('select', { class: 'txt', id: 'c-after' }, opts.map(o => o.cloneNode(true)));
      before.value = photos[photos.length - 1].id; after.value = photos[0].id;
      const out = h('div', { class: 'compare' }), info = h('p', { class: 'muted', role: 'status' });
      const draw = () => { out.innerHTML = ''; const a = photos.filter(p => p.id === before.value)[0], b = photos.filter(p => p.id === after.value)[0]; if (!a || !b) return;
        out.appendChild(h('figure', { class: 'ph' }, imgFor(a, 'big'), h('figcaption', null, 'Antes · ' + U.fmtDate(a.date)))); out.appendChild(h('figure', { class: 'ph' }, imgFor(b, 'big'), h('figcaption', null, 'Después · ' + U.fmtDate(b.date))));
        const dd = U.daysBetween(a.date, b.date); info.textContent = dd === 0 ? 'Son del mismo día.' : dd > 0 ? dd + ' días entre las dos fotos.' : 'La foto «Antes» es posterior a «Después».'; };
      before.addEventListener('change', () => { freeUrls(); draw(); }); after.addEventListener('change', () => { freeUrls(); draw(); });
      el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Antes y después'), field('c-before', 'Antes', before), field('c-after', 'Después', after), info, out)); draw();
    }
  });

  /* ---------- Peso · Progreso ---------- */
  let progRange = 90;
  wrapView('peso/progreso', (el, again) => {
    const series = C.weightSeries(store.list('weight')), today = U.today(), goalRec = goalMain();
    if (!series.length) { el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Sin datos todavía'), h('p', { class: 'muted' }, 'Registra tu peso para ver la tendencia, la proyección y la comparación mes contra mes.'), h('a', { class: 'btn', href: '#/peso/registro' }, 'Registrar peso'))); return; }
    const st = C.stats(series), tr = C.trend(series), goal = goalRec ? { target: goalRec.target, targetDate: goalRec.targetDate, startValue: goalRec.startValue, startDate: goalRec.startDate } : null;
    el.appendChild(tiles([tile('Tendencia actual', kgText(st.avg), 'Promedio de 7 días'), tile('Cambio en 7 días', signed(st.d7, 1, 'kg'), st.d7 == null ? 'Faltan datos' : ''), tile('Cambio en 30 días', signed(st.d30, 1, 'kg'), st.d30 == null ? 'Faltan datos' : ''), tile('Desde el inicio', signed(st.sinceStart, 1, 'kg'), 'desde ' + U.fmtDate(st.first.date))]));

    /* Gráfico principal */
    const first = series[0].date, span = Math.max(14, U.daysBetween(first, today)), days = progRange === 'all' ? span : progRange;
    const startDate = progRange === 'all' ? first : U.ymd(U.addDays(U.parseYmd(today), -progRange)), X = d => U.daysBetween(startDate, d), dateOf = x => U.ymd(U.addDays(U.parseYmd(startDate), x));
    const xEnd = goal ? days + Math.max(7, Math.round(days * 0.2)) : days;
    const raw = series.filter(p => p.date >= startDate).map(p => ({ x: X(p.date), y: p.value })), trd = tr.filter(p => p.date >= startDate).map(p => ({ x: X(p.date), y: U.round(p.avg, 2) }));
    const proj = C.projection(series, goal), S2 = [{ name: 'Peso diario', kind: 'dots', cls: 'cm', pts: raw }, { name: 'Tendencia (7 días)', kind: 'line', cls: 'c1', pts: trd, endLabel: true, hover: true }];
    if (goal && goal.targetDate && goal.startDate) {
      const x1 = X(goal.startDate), x2 = X(goal.targetDate), yAt = x => goal.startValue + (goal.target - goal.startValue) * (x - x1) / (x2 - x1), a = Math.max(x1, 0), b = Math.min(x2, xEnd);
      if (b > a && x2 > x1) S2.push({ name: 'Plan hacia la meta', kind: 'dash', cls: 'c2', hover: false, pts: [{ x: a, y: U.round(yAt(a), 2) }, { x: b, y: U.round(yAt(b), 2) }] });
    }
    if (proj.status === 'en-camino') {
      const xl = X(series[series.length - 1].date), xr = Math.min(X(proj.reachDate), xEnd), yl = proj.current, yr = proj.current + proj.slope * (xr - xl);
      if (xr > xl) S2.push({ name: 'Proyección a tu ritmo', kind: 'dot', cls: 'c1', hover: false, pts: [{ x: xl, y: U.round(yl, 2) }, { x: xr, y: U.round(yr, 2) }] });
    }
    const host = h('div');
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Evolución del peso'), chips([[30, '30 días'], [90, '90 días'], [180, '6 meses'], ['all', 'Todo']], progRange, v => { progRange = v; again(); }, 'Periodo'), host));
    A.charts.line(host, { ariaLabel: 'Gráfico de línea del peso en kg. Último peso ' + kgText(series[series.length - 1].value) + ', tendencia ' + kgText(st.avg) + (goal ? ', meta ' + kgText(goal.target) : '') + '.', unit: 'kg', decimals: 1, xDomain: [0, xEnd], xFormat: x => longDate(dateOf(Math.round(x))), xTickFormat: x => U.fmtShort(dateOf(Math.round(x))), series: S2 });

    /* Proyección */
    const p = proj, rate = goal && goal.targetDate ? C.requiredRate(st.avg, goal, today) : null;
    let msg;
    if (p.status === 'sin-objetivo') msg = ['Define tu peso meta y la fecha en ', h('a', { href: '#/peso/objetivo' }, 'Objetivo'), ' para ver la proyección.'];
    else if (p.status === 'pocos-datos') msg = ['Aún no hay datos suficientes para proyectar: se necesitan al menos 5 pesos repartidos en 2 semanas.'];
    else if (p.status === 'logrado') msg = ['¡Ya llegaste a tu meta de ' + kgText(goal.target) + '! Tu peso actual estimado es ' + kgText(p.current) + '.'];
    else if (p.status === 'estable') msg = ['Tu peso está estable (' + signed(U.round(p.slope * 7, 2), 2, 'kg') + ' por semana). A este ritmo no llegarías a ' + kgText(goal.target) + '.'];
    else if (p.status === 'alejandose') msg = ['Tu peso se mueve en dirección contraria a la meta (' + signed(U.round(p.slope * 7, 2), 2, 'kg') + ' por semana).'];
    else { const when = p.aheadDays == null ? '' : p.aheadDays > 0 ? ' Es ' + p.aheadDays + ' días antes de tu fecha (' + longDate(goal.targetDate) + ').' : p.aheadDays < 0 ? ' Es ' + (-p.aheadDays) + ' días después de tu fecha (' + longDate(goal.targetDate) + ').' : ' Justo en tu fecha.'; msg = ['A tu ritmo de las últimas 4 semanas (' + signed(U.round(p.perWeek, 2), 2, 'kg') + ' por semana) llegarías a ' + kgText(goal.target) + ' el ' + longDate(p.reachDate) + ' (en ' + p.days + ' días).' + when]; }
    const kc = rate ? h('p', { class: 'muted' }, 'Para llegar a tu fecha necesitas ' + signed(U.round(rate.perWeek, 2), 2, 'kg') + ' por semana, que equivale a ' + (rate.kcalPerDay < 0 ? 'un déficit' : 'un superávit') + ' de unas ' + U.fmtNum(Math.abs(rate.kcalPerDay), 0) + ' kcal por día respecto de tu gasto (estimación: 7.700 kcal ≈ 1 kg).') : null;
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Proyección'), h('p', null, msg), kc));

    /* Mes contra mes */
    const mon = C.monthly(series), thisM = today.slice(0, 7), prevM = C.prevMonth(thisM);
    const tbody = h('tbody', null, mon.slice(-6).reverse().map(r => h('tr', null, h('th', { scope: 'row' }, r.month.slice(5) + '/' + r.month.slice(0, 4)), h('td', null, U.fmtNum(r.avg, 1) + ' kg'), h('td', null, U.fmtNum(r.min, 1) + ' – ' + U.fmtNum(r.max, 1)), h('td', null, r.delta == null ? '–' : signed(r.delta, 1, 'kg')), h('td', null, String(r.n)))));
    const cmpHost = h('div'), a = C.byDayOfMonth(series, thisM), b = C.byDayOfMonth(series, prevM);
    const sec = h('section', { class: 'card' }, h('h2', null, 'Mes contra mes'), h('div', { class: 'dt-scroll' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Mes', 'Promedio', 'Mín – máx', 'Cambio', 'Registros'].map(x => h('th', { scope: 'col' }, x)))), tbody)));
    if (a.length + b.length >= 2) { sec.appendChild(h('h3', { class: 'sub' }, 'Este mes frente al anterior, por día del mes')); sec.appendChild(cmpHost); }
    el.appendChild(sec);
    if (a.length + b.length >= 2) A.charts.line(cmpHost, { ariaLabel: 'Gráfico de línea: peso de este mes frente al mes anterior, por día del mes.', unit: 'kg', decimals: 1, xDomain: [1, 31], xLabel: 'Día del mes', xFormat: x => 'Día ' + Math.round(x), xTicks: () => [1, 8, 15, 22, 29].map(x => ({ x: x, label: String(x) })),
      series: [{ name: 'Mes anterior', kind: 'line', cls: 'cm', pts: b }, { name: 'Este mes', kind: 'line', cls: 'c1', pts: a, endLabel: true }] });
  });

  /* ---------- Peso · Objetivo ---------- */
  wrapView('peso/objetivo', (el, again) => {
    const series = C.weightSeries(store.list('weight')), st = C.stats(series), today = U.today(), g = goalMain();
    const startNow = st ? U.round(st.avg, 1) : null;
    const target = h('input', { class: 'txt', id: 'o-target', type: 'text', inputmode: 'decimal', value: g ? String(g.target).replace('.', ',') : '', placeholder: 'Ej. 75' });
    const tdate = h('input', { class: 'txt', id: 'o-date', type: 'date', value: g ? g.targetDate : '', min: U.ymd(U.addDays(U.parseYmd(today), 1)) });
    const sdate = h('input', { class: 'txt', id: 'o-sdate', type: 'date', value: g ? g.startDate : today, max: today });
    const sval = h('input', { class: 'txt', id: 'o-sval', type: 'text', inputmode: 'decimal', value: g ? String(g.startValue).replace('.', ',') : startNow != null ? String(startNow).replace('.', ',') : '' });
    const err = errBox();
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); err.textContent = '';
      const t = U.parseNum(target.value), sv = U.parseNum(sval.value);
      if (t == null || t < 30 || t > 300) { err.textContent = 'El peso meta debe estar entre 30 y 300 kg.'; return; }
      if (!U.isYmd(tdate.value) || tdate.value <= today || U.daysBetween(today, tdate.value) > 1100) { err.textContent = 'La fecha meta debe ser futura y estar dentro de los próximos 3 años.'; return; }
      if (sv == null || sv < 20 || sv > 400) { err.textContent = 'El peso inicial debe estar entre 20 y 400 kg.'; return; }
      if (!U.isYmd(sdate.value) || sdate.value > today) { err.textContent = 'La fecha de inicio no es válida.'; return; }
      if (Math.abs(sv - t) < 0.1) { err.textContent = 'El peso meta es igual al inicial.'; return; }
      store.save('goal', { id: 'goal_main_weight', kind: 'weight', target: U.round(t, 1), targetDate: tdate.value, startDate: sdate.value, startValue: U.round(sv, 1) });
      A.ui.toast(g ? 'Objetivo actualizado.' : 'Objetivo guardado.'); again();
    } }, h('h2', null, 'Tu objetivo de peso'),
    field('o-target', 'Peso meta (kg)', target), field('o-date', 'Fecha para lograrlo', tdate),
    h('details', { class: 'more', open: !st && !g }, h('summary', null, 'Punto de partida'), field('o-sdate', 'Fecha de inicio', sdate), field('o-sval', 'Peso inicial (kg)', sval, st ? 'Por defecto, tu tendencia actual.' : 'Aún no tienes pesos registrados: escríbelo a mano.')),
    err, h('div', { class: 'row-end' }, g ? h('button', { class: 'btn danger', type: 'button', onclick: () => {
      const ms = store.list('goal').filter(x => x.parentId === 'goal_main_weight'), snap = [g].concat(ms);
      snap.forEach(x => store.remove('goal', x.id));
      A.ui.toast('Objetivo eliminado.', { label: 'Deshacer', run: () => { snap.forEach(x => store.save('goal', x)); again(); } }); again();
    } }, 'Eliminar objetivo') : null, h('button', { class: 'btn', type: 'submit' }, 'Guardar objetivo'))));
    if (!g) return;

    /* Resumen del ritmo */
    const now = st ? st.avg : g.startValue, rate = C.requiredRate(now, g, today);
    const sum = h('section', { class: 'card' }, h('h2', null, 'Qué falta'));
    if (!rate) sum.appendChild(h('p', null, 'La fecha de tu objetivo ya pasó. Actualiza la fecha para seguir.'));
    else {
      sum.appendChild(tiles([tile('Faltan', signed(rate.remaining, 1, 'kg'), 'desde ' + kgText(now) + (st ? ' (tendencia)' : '')), tile('Plazo', rate.days + ' días', 'hasta ' + U.fmtDate(g.targetDate)), tile('Ritmo necesario', signed(U.round(rate.perWeek, 2), 2, 'kg') + '/sem', '≈ ' + U.fmtNum(Math.abs(rate.kcalPerDay), 0) + ' kcal/día ' + (rate.kcalPerDay < 0 ? 'de déficit' : 'de superávit'))]));
      if (rate.high) sum.appendChild(h('p', { class: 'note warn', role: 'note' }, 'Ese ritmo es alto: más de 1 kg por semana (o 1 % de tu peso) suele ser difícil de sostener. Considera una fecha más lejana o conversarlo con un profesional de la salud.'));
      sum.appendChild(h('p', { class: 'hint' }, 'Las kcal son una estimación (7.700 kcal ≈ 1 kg). Cuando registres tu comida, la app las comparará con tu consumo real.'));
    }
    el.appendChild(sum);

    /* Objetivos cortos */
    const every = h('select', { class: 'txt', id: 'ms-every' }, [[7, 'Cada semana'], [14, 'Cada 2 semanas'], [28, 'Cada 4 semanas']].map(o => h('option', { value: o[0], selected: o[0] === 14 }, o[1])));
    const old = store.list('goal').filter(x => x.parentId === 'goal_main_weight').sort((a, b) => a.targetDate < b.targetDate ? -1 : 1), tr = C.trend(series);
    const gen = h('button', { class: 'btn', type: 'button', onclick: async () => {
      if (!rate) { A.ui.toast('Primero actualiza la fecha del objetivo.'); return; }
      if (old.length && !(await A.ui.confirm('¿Reemplazar los objetivos cortos?', 'Se borran los actuales y se crean otros desde hoy hasta tu meta.', 'Reemplazar'))) return;
      old.forEach(x => store.remove('goal', x.id));
      C.milestones(now, g.target, today, g.targetDate, +every.value).forEach(m => store.save('goal', { kind: 'weight', target: m.target, targetDate: m.targetDate, startDate: today, startValue: U.round(now, 1), parentId: 'goal_main_weight' }));
      A.ui.toast('Objetivos cortos creados.'); again();
    } }, old.length ? 'Volver a generar' : 'Generar objetivos cortos');
    const ST = { logrado: ['✓', 'Logrado'], tarde: ['✓', 'Logrado (tarde)'], pendiente: ['○', 'Pendiente'], vencido: ['!', 'No logrado'] };
    const ul = h('ul', { class: 'rows', 'aria-label': 'Objetivos cortos' }, old.map(m => { const s = C.milestoneStatus(m, tr, today), l = ST[s.state];
      return h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, kgText(m.target)), h('span', { class: 'hint' }, 'para el ' + longDate(m.targetDate))), h('span', { class: 'status ' + s.state }, l[0] + ' ' + l[1]),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar objetivo de ' + kgText(m.target), onclick: () => removeWithUndo('goal', m, () => store.save('goal', m), again) }, 'Eliminar')); }));
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Objetivos cortos'), h('p', { class: 'muted' }, 'Puntos intermedios en línea recta desde hoy hasta tu meta. Se evalúan con tu tendencia de 7 días.'),
      field('ms-every', 'Frecuencia', every), h('div', { class: 'row-end' }, gen), old.length ? ul : null));
  });
})(window);
