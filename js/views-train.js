/* Pantallas de «Entrenamientos» (fase 4), primera parte: Sesión (en vivo y rápida), Historial y Progreso de Halterofilia y Pesas. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, field = A.ui.field, U = A.util, store = A.store, T = A.train, W = A.vw;
  const tile = W.tile, tiles = W.tiles, wrapView = W.wrapView, dateInput = W.dateInput, errBox = W.errBox, optionsOf = W.optionsOf, removeWithUndo = W.removeWithUndo, chips = W.chips, signed = W.signed;
  const DISC_LABEL = { halterofilia: 'Halterofilia', pesas: 'Pesas', cardio: 'Cardio' };
  const REST = { halterofilia: 120, pesas: 90 };
  const readNum = (inp, optional) => { const t = String(inp.value).trim(); if (!t) return optional ? null : NaN; const v = U.parseNum(t); return v == null ? NaN : v; };
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); };
  const exOf = disc => store.list('exercise').filter(e => e.discipline === disc).sort((a, b) => a.name.localeCompare(b.name));
  const sessionsOf = disc => store.list('session').filter(s => s.discipline === disc);
  A.vw.exOf = exOf; A.vw.REST = REST; A.vw.DISC_LABEL = DISC_LABEL; A.vw.readNum = readNum;
  const SEEDS = { halterofilia: ['Arranque', 'Envión', 'Sentadilla trasera', 'Sentadilla frontal', 'Tirón de arranque', 'Tirón de envión', 'Press de fuerza'], pesas: ['Press de banca', 'Sentadilla', 'Peso muerto', 'Press militar', 'Remo con barra', 'Dominadas'] };
  W.SEEDS = SEEDS;
  const setLine = it => T.doneSets(it).map(x => U.fmtNum(x.kg, 1) + '×' + x.reps).join(' · ');

  /* ---- Borrador de la sesión: se guarda en el dispositivo para que sobreviva si cierras la app a mitad de entreno ---- */
  const draftOf = disc => (store.getLocal()['draft_' + disc]) || null;
  const saveDraft = (disc, d) => store.setLocal({ ['draft_' + disc]: d });

  /* Pitido y vibración al terminar el descanso (si el navegador lo permite) */
  function ding() { try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); const C = root.AudioContext || root.webkitAudioContext; if (!C) return; const c = new C(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); g.gain.value = 0.08; o.frequency.value = 880; o.start(); o.stop(c.currentTime + 0.35); } catch (e) { /* sin sonido */ } }

  function sessionView(disc) {
    wrapView('entrenos/' + disc + '/hoy', (el, again) => {
      const today = U.today(), d = draftOf(disc), exs = exOf(disc), plans = store.list('plan').filter(p => p.discipline === disc), plan = plans[0] || null;
      if (!d) return startCard(el, again, disc, today, exs, plan);
      const live = d.mode === 'live', save = () => saveDraft(disc, d);
      const head = h('section', { class: 'card' }, h('h2', null, live ? 'Sesión en vivo' : 'Registro rápido'), h('p', { class: 'muted' }, W.longDate(d.date) + (d.dayName ? ' · ' + d.dayName : '')));
      let elapsed = null, rest = null, restTxt = null;
      if (live) {
        elapsed = h('strong', { class: 'big', role: 'timer', 'aria-label': 'Tiempo de sesión' });
        restTxt = h('span', { class: 'big', role: 'timer', 'aria-label': 'Descanso' });
        rest = h('div', { class: 'rest' }, h('span', null, 'Descanso: '), restTxt,
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { d.restEnd = Math.max(Date.now(), d.restEnd || 0) + 15000; d.restOn = true; save(); } }, '+15 s'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { d.restEnd = null; d.restOn = false; save(); } }, 'Saltar'));
        head.appendChild(h('p', null, 'Tiempo: ', elapsed)); head.appendChild(rest);
        const tick = first => { if (!first && !head.isConnected) { clearInterval(iv); return; } elapsed.textContent = mmss((Date.now() - d.startedAt) / 1000);
          if (d.restEnd) { const left = (d.restEnd - Date.now()) / 1000; if (left <= 0) { d.restEnd = null; if (d.restOn) { d.restOn = false; save(); ding(); } restTxt.textContent = '0:00'; } else restTxt.textContent = mmss(left); } else restTxt.textContent = '–'; };
        const iv = setInterval(tick, 500); tick(true);
      }
      el.appendChild(head);

      d.items.forEach((it, ii) => {
        const rows = h('div', { class: 'sets' });
        it.sets.forEach((s, si) => {
          const kg = h('input', { class: 'txt', type: 'text', inputmode: 'decimal', value: s.kg == null ? '' : String(s.kg).replace('.', ','), 'aria-label': 'Kilos de la serie ' + (si + 1) + ' de ' + it.name }),
            reps = h('input', { class: 'txt', type: 'text', inputmode: 'numeric', value: s.reps == null ? '' : String(s.reps), 'aria-label': 'Repeticiones de la serie ' + (si + 1) + ' de ' + it.name }),
            ok = h('button', { class: 'btn sm setok', type: 'button', 'aria-pressed': String(s.done !== false && !!s.done), 'aria-label': 'Serie ' + (si + 1) + ' hecha', onclick: () => {
              s.done = !s.done; save();
              if (s.done && live) { d.restEnd = Date.now() + (it.rest || REST[disc] || 90) * 1000; d.restOn = true; save(); }
              again(); } }, s.done ? '✓' : '○');
          kg.addEventListener('input', () => { const v = U.parseNum(kg.value); s.kg = v == null ? null : v; save(); });
          reps.addEventListener('input', () => { const v = U.parseNum(reps.value); s.reps = v == null ? null : Math.round(v); save(); });
          rows.appendChild(h('div', { class: 'set' }, h('span', { class: 'set-n' }, String(si + 1)), kg, h('span', { class: 'muted' }, 'kg ×'), reps,
            ok, h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Quitar serie ' + (si + 1), onclick: () => { it.sets.splice(si, 1); save(); again(); } }, '×')));
        });
        const hist = T.history(sessionsOf(disc), T.key(it)), sug = hist.length ? T.suggestNext(hist, it.reps) : null, last = hist[hist.length - 1];
        const hint = [it.plan ? 'Plan: ' + it.plan : null, last ? 'Última vez: ' + U.fmtNum(last.topKg, 1) + ' kg × ' + last.topReps : null, sug ? sug.why : null].filter(Boolean).join(' · ');
        const quick = h('input', { class: 'txt', type: 'text', placeholder: 'Ej. 3x5@80', 'aria-label': 'Agregar series de ' + it.name }), qerr = errBox();
        el.appendChild(h('section', { class: 'card' }, h('h3', { class: 'sub' }, it.name), hint ? h('p', { class: 'hint' }, hint) : null, rows,
          h('div', { class: 'row-end wrap' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { const p = it.sets[it.sets.length - 1]; it.sets.push({ kg: p ? p.kg : null, reps: p ? p.reps : null, done: false }); save(); again(); } }, 'Agregar serie'),
            h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { d.items.splice(ii, 1); save(); again(); } }, 'Quitar ejercicio')),
          h('div', { class: 'quickadd' }, quick, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { const r = T.parseSets(quick.value); if (!r) { qerr.textContent = 'Escribe series así: 3x5@80 (series × repeticiones @ kilos).'; return; } r.forEach(x => { x.done = !live; it.sets.push(x); }); save(); again(); } }, 'Agregar')), qerr));
      });

      /* Agregar ejercicio */
      const sel = h('select', { class: 'txt', id: 'se-ex' }, [h('option', { value: '' }, exs.length ? 'Elige un ejercicio…' : 'Aún no tienes ejercicios')].concat(exs.map(e => h('option', { value: e.id }, e.name)))), nn = h('input', { class: 'txt', id: 'se-new', type: 'text', maxlength: 120, placeholder: 'o escribe uno nuevo' }), aerr = errBox();
      el.appendChild(h('section', { class: 'card form' }, h('h3', { class: 'sub' }, 'Agregar ejercicio'), field('se-ex', 'Ejercicio', sel), field('se-new', 'Nuevo', nn), aerr,
        h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => {
          aerr.textContent = ''; let ex = exs.filter(e => e.id === sel.value)[0], name = nn.value.trim();
          if (!ex && !name) { aerr.textContent = 'Elige un ejercicio o escribe el nombre.'; return; }
          if (!ex) { ex = exs.filter(e => e.name.toLowerCase() === name.toLowerCase())[0]; if (!ex) { try { ex = store.save('exercise', { name: name, discipline: disc, meas: 'kg', rest: REST[disc] || 90 }); } catch (x) { aerr.textContent = x.message; return; } } }
          d.items.push({ exId: ex.id, name: ex.name, rest: ex.rest || REST[disc] || 90, sets: [{ kg: ex.max ? null : null, reps: null, done: false }] }); save(); again(); } }, 'Agregar'))));

      /* Terminar */
      const rpe = h('input', { class: 'txt', id: 'se-rpe', type: 'text', inputmode: 'decimal', placeholder: '0 a 10', value: d.rpe == null ? '' : String(d.rpe) }), notes = h('textarea', { class: 'txt area', id: 'se-notes', rows: 2, maxlength: 500 }, d.notes || ''), ferr = errBox();
      rpe.addEventListener('input', () => { const v = U.parseNum(rpe.value); d.rpe = v; save(); }); notes.addEventListener('input', () => { d.notes = notes.value; save(); });
      el.appendChild(h('section', { class: 'card form' }, h('h3', { class: 'sub' }, 'Terminar'), field('se-rpe', 'Esfuerzo de la sesión (RPE 0 a 10)', rpe, 'Opcional. 10 = no podías más.'), field('se-notes', 'Notas', notes), ferr,
        h('div', { class: 'row-end wrap' }, h('button', { class: 'btn ghost', type: 'button', onclick: async () => { if (await A.ui.confirm('¿Descartar la sesión?', 'Se pierde lo que anotaste en esta sesión.', 'Descartar')) { saveDraft(disc, null); again(); } } }, 'Descartar'),
          h('button', { class: 'btn', type: 'button', onclick: () => {
            ferr.textContent = ''; const rv = d.rpe == null || d.rpe === '' ? null : Number(d.rpe);
            if (rv != null && (isNaN(rv) || rv < 0 || rv > 10)) { ferr.textContent = 'El esfuerzo va de 0 a 10.'; return; }
            const items = d.items.map(it => ({ exId: it.exId, name: it.name, rest: it.rest, sets: it.sets.filter(s => (live ? s.done : s.done !== false) && s.reps > 0 && s.kg != null && s.kg >= 0).map(s => ({ kg: s.kg, reps: s.reps, done: true })) })).filter(it => it.sets.length);
            if (!items.length) { ferr.textContent = live ? 'Marca al menos una serie como hecha (el círculo).' : 'Agrega al menos una serie con kilos y repeticiones.'; return; }
            let rec; try { rec = store.save('session', { discipline: disc, date: d.date, mode: d.mode, items: items, rpe: rv, notes: (d.notes || '').trim() || null, startedAt: live ? d.startedAt : null, endedAt: live ? Date.now() : null, dayName: d.dayName || null }); } catch (x) { ferr.textContent = x.message; return; }
            saveDraft(disc, null);
            const recs = T.newRecords(sessionsOf(disc), rec), st = T.sessionStats(rec);
            A.ui.toast('Sesión guardada: ' + U.fmtNum(st.tonnage, 0) + ' kg de tonelaje' + (recs.length ? ' · ¡récord en ' + recs.map(r => r.name).join(', ') + '!' : '.')); again(); } }, 'Terminar y guardar'))));
    });
  }

  function startCard(el, again, disc, today, exs, plan) {
    const dIn = dateInput('st-date', today), mode = { v: 'live' }, days = plan ? T.planDay(plan, today) : [];
    const begin = (day) => {
      const date = dIn.value; if (!U.isYmd(date) || date > today) { err.textContent = 'La fecha no es válida.'; return; }
      const hist = k => T.history(sessionsOf(disc), k);
      const items = day ? day.items.map(pi => { const ex = store.get('exercise', pi.exId); if (!ex) return null; const n = pi.sets || 3, kgPlan = pi.pct != null ? T.kgFromPct(ex.max, pi.pct) : pi.kg != null ? pi.kg : null, sug = kgPlan == null ? T.suggestNext(hist(ex.id), pi.reps) : null, kg = kgPlan != null ? kgPlan : sug ? sug.kg : null, sets = []; for (let i = 0; i < n; i++) sets.push({ kg: kg, reps: pi.reps || null, done: false });
        return { exId: ex.id, name: ex.name, rest: ex.rest || REST[disc] || 90, reps: pi.reps, plan: n + '×' + (pi.reps || '?') + (pi.pct != null ? ' al ' + pi.pct + ' %' : pi.kg != null ? ' con ' + pi.kg + ' kg' : ''), sets: sets }; }).filter(Boolean) : [];
      saveDraft(disc, { mode: mode.v, date: date, startedAt: Date.now(), items: items, dayName: day ? day.name : null }); again();
    };
    const err = errBox(), seg = h('div');
    const drawSeg = () => { seg.innerHTML = ''; seg.appendChild(chips([['live', 'En vivo'], ['quick', 'Registro rápido']], mode.v, v => { mode.v = v; drawSeg(); }, 'Tipo de sesión')); };
    drawSeg();
    const sessions = sessionsOf(disc).sort((a, b) => a.date < b.date ? 1 : -1), last = sessions[0];
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Nueva sesión de ' + DISC_LABEL[disc].toLowerCase()),
      h('p', { class: 'muted' }, 'En vivo: temporizador de descanso y tiempo de sesión. Rápido: anotas lo que hiciste, con la fecha que quieras.'), seg, field('st-date', 'Fecha', dIn), err,
      days.length ? days.map(day => h('button', { class: 'btn', type: 'button', onclick: () => begin(day) }, 'Empezar con la rutina de hoy: ' + day.name)) : null,
      h('div', { class: 'row-end' }, h('button', { class: days.length ? 'btn ghost' : 'btn', type: 'button', onclick: () => begin(null) }, 'Empezar sesión vacía')),
      !plan ? h('p', { class: 'hint' }, ['Si armas tu rutina en ', h('a', { href: '#/entrenos/' + disc + '/plan' }, 'Plan'), ', aquí podrás empezar con un toque.']) : !days.length ? h('p', { class: 'hint' }, 'Hoy no tienes un día asignado en tu rutina.') : null));
    if (last) { const st = T.sessionStats(last); el.appendChild(h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Última sesión'), h('p', { class: 'muted' }, W.longDate(last.date) + ' · ' + st.exercises + ' ejercicios · ' + st.sets + ' series · ' + U.fmtNum(st.tonnage, 0) + ' kg de tonelaje'))); }
  }

  /* ---------- Historial ---------- */
  let histShown = 20;
  function historyView(disc) {
    wrapView('entrenos/' + disc + '/historial', (el, again) => {
      const all = sessionsOf(disc).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.updatedAt || 0) - (a.updatedAt || 0));
      if (!all.length) { el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Sin sesiones todavía'), h('p', { class: 'muted' }, 'Cuando termines una sesión aparece aquí.'), h('a', { class: 'btn', href: '#/entrenos/' + disc + '/hoy' }, 'Empezar una sesión'))); return; }
      const ul = h('ul', { class: 'hist' });
      all.slice(0, histShown).forEach(s => { const st = T.sessionStats(s);
        ul.appendChild(h('li', null, h('details', { class: 'more' }, h('summary', null, h('span', { class: 'row-t' }, U.fmtDate(s.date) + (s.dayName ? ' · ' + s.dayName : '')), h('span', { class: 'muted' }, ' ' + st.exercises + ' ej. · ' + U.fmtNum(st.tonnage, 0) + ' kg')),
          h('ul', { class: 'hist-items' }, (s.items || []).map(it => h('li', null, h('strong', null, it.name), ' ', h('span', { class: 'muted' }, setLine(it))))),
          h('p', { class: 'hint' }, [st.sets + ' series', st.reps + ' repeticiones', st.minutes != null ? st.minutes + ' min' : null, st.rpe != null ? 'RPE ' + U.fmtNum(st.rpe, 1) : null, st.load != null ? 'carga ' + st.load : null, s.mode === 'live' ? 'en vivo' : 'rápida', s.source === 'halterofilia' ? 'importada' : null].filter(Boolean).join(' · ')), s.notes ? h('p', { class: 'muted' }, s.notes) : null,
          h('div', { class: 'row-end' }, h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar sesión del ' + U.fmtDate(s.date), onclick: () => removeWithUndo('session', s, () => store.save('session', s), again, 'Sesión eliminada.') }, 'Eliminar')))));
      });
      el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Sesiones anteriores'), ul, all.length > histShown ? h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { histShown += 20; again(); } }, 'Mostrar más')) : null));
    });
  }

  /* ---------- Progreso ---------- */
  let progEx = {}, progMetric = {};
  function progressView(disc) {
    wrapView('entrenos/' + disc + '/progreso', (el, again) => {
      const today = U.today(), ss = sessionsOf(disc);
      if (!ss.length) { el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Sin datos todavía'), h('p', { class: 'muted' }, 'Registra una sesión para ver tonelaje, 1RM estimado y récords.'), h('a', { class: 'btn', href: '#/entrenos/' + disc + '/hoy' }, 'Empezar una sesión'))); return; }
      const from30 = U.ymd(U.addDays(U.parseYmd(today), -29)), last30 = ss.filter(s => s.date >= from30), wk = T.weekly(ss, disc, today), cur = wk.filter(w => w.week === T.weekOf(today))[0] || { tonnage: 0, sets: 0, sessions: 0 };
      const recs = T.records(ss), recent = ss.map(s => ({ s: s, n: T.newRecords(ss, s) })).filter(x => x.s.date >= from30 && x.n.length).length;
      el.appendChild(tiles([tile('Sesiones (30 días)', String(last30.length)), tile('Tonelaje de la semana', U.fmtNum(cur.tonnage, 0) + ' kg', cur.sets + ' series'), tile('Sesiones con récord', String(recent), 'últimos 30 días'), tile('Ejercicios con datos', String(recs.length))]));

      /* Tonelaje por semana */
      const bh = h('div'), last8 = wk.slice(-8);
      el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Tonelaje por semana'), bh));
      A.charts.bars(bh, { ariaLabel: 'Gráfico de columnas: tonelaje por semana, últimas ' + last8.length + ' semanas.', unit: 'kg', decimals: 0, name: 'Tonelaje', pts: last8.map(w => ({ label: U.fmtShort(w.week), y: w.tonnage, tip: 'Semana del ' + U.fmtShort(w.week) + ' · ' + w.sessions + (w.sessions === 1 ? ' sesión' : ' sesiones') })) });

      /* Evolución de un ejercicio */
      const sel = h('select', { class: 'txt', id: 'pg-ex', 'aria-label': 'Ejercicio', onchange: () => { progEx[disc] = sel.value; again(); } }, recs.map(r => h('option', { value: r.key, selected: r.key === (progEx[disc] || recs[0].key) }, r.name)));
      const k = progEx[disc] && recs.some(r => r.key === progEx[disc]) ? progEx[disc] : recs[0].key, hist = T.history(ss, k), rec = recs.filter(r => r.key === k)[0], metric = progMetric[disc] || 'e1rm', host = h('div');
      const X = date => U.daysBetween('2000-01-01', date), dateOf = x => U.ymd(U.addDays(U.parseYmd('2000-01-01'), Math.round(x)));
      el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Evolución por ejercicio'), field('pg-ex', 'Ejercicio', sel), chips([['e1rm', '1RM estimado'], ['kg', 'Mayor peso']], metric, v => { progMetric[disc] = v; again(); }, 'Qué medir'),
        host, h('p', { class: 'hint' }, 'El 1RM estimado usa la fórmula de Epley y solo con series de hasta 12 repeticiones.')));
      const pts = hist.filter(x => metric === 'kg' || x.e1rm != null).map(x => ({ x: X(x.date), y: metric === 'kg' ? x.topKg : x.e1rm }));
      if (pts.length) A.charts.line(host, { ariaLabel: 'Gráfico de línea: ' + (metric === 'kg' ? 'mayor peso' : '1RM estimado') + ' de ' + rec.name + ' por sesión.', unit: 'kg', decimals: 1, xFormat: x => W.longDate(dateOf(x)), xTickFormat: x => U.fmtShort(dateOf(x)), series: [{ name: metric === 'kg' ? 'Mayor peso' : '1RM estimado', kind: 'line', cls: 'c1', pts: pts, endLabel: true, hover: true }] });
      else host.appendChild(h('p', { class: 'muted' }, 'Este ejercicio aún no tiene series con repeticiones para estimar el 1RM.'));

      /* Récords */
      el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Récords'), h('div', { class: 'dt-scroll' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Ejercicio', 'Mayor peso', '1RM est.', 'Sesiones'].map(x => h('th', { scope: 'col' }, x)))),
        h('tbody', null, recs.map(r => h('tr', null, h('th', { scope: 'row' }, r.name), h('td', null, U.fmtNum(r.maxKg, 1) + ' kg · ' + U.fmtShort(r.maxKgDate)), h('td', null, r.maxE1rm == null ? '–' : U.fmtNum(r.maxE1rm, 1) + ' kg'), h('td', null, String(r.sessions)))))))));
    });
  }

  ['halterofilia', 'pesas'].forEach(d => { sessionView(d); historyView(d); progressView(d); });
})(window);
