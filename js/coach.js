/* Plan del entrenador (fase 9): el administrador lo carga desde el Excel y lo publica; las cuentas autorizadas lo guardan en el dispositivo.
   En Firebase son 2 documentos: config/plan (versión, chico) y plans/data (el plan comprimido, ~20 KB). Se vuelve a bajar solo si cambia la versión. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const store = A.store, U = A.util;
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  async function pipe(bytes, Stream, mode) { const s = new Blob([bytes]).stream().pipeThrough(new Stream(mode)); return new Uint8Array(await new Response(s).arrayBuffer()); }
  const encode = async obj => b64(await pipe(new TextEncoder().encode(JSON.stringify(obj)), CompressionStream, 'deflate'));
  const decode = async z => JSON.parse(new TextDecoder().decode(await pipe(unb64(z), DecompressionStream, 'deflate')));

  /* Lo que se publica: el plan sin el texto original de cada celda (ocupa mucho y no se usa) */
  const compact = plan => { const p = JSON.parse(JSON.stringify(plan)); p.weeks.forEach(w => w.sessions.forEach(s => s.items.forEach(it => { delete it.raw; }))); delete p.warnings; return p; };

  let mem = null;   // plan ya descomprimido
  const cache = () => store.getLocal().coachPlan || null;
  const C = {
    encode, decode, compact,
    info: () => { const c = cache(); return c ? { ver: c.ver, name: c.name, weeks: c.weeks } : null; },
    async load() { const c = cache(); if (!c) return null; if (mem && mem.ver === c.ver) return mem.plan; try { const plan = await decode(c.z); mem = { ver: c.ver, plan: plan }; return plan; } catch (e) { return null; } },
    clear() { mem = null; if (cache()) store.setLocal({ coachPlan: null }); },
    /* Publica (administrador): guarda en Firebase y deja la copia en este dispositivo */
    async publish(parsed, name) {
      const plan = compact(parsed), ver = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14), z = await encode(plan);
      if (z.length > 800000) throw new Error('El plan comprimido es demasiado grande para guardarlo (' + Math.round(z.length / 1000) + ' KB).');
      const meta = { ver: ver, name: String(name || 'Plan del entrenador').slice(0, 120), weeks: plan.weeks.length };
      await A.cloud.plan.publish(meta, z); mem = null; store.setLocal({ coachPlan: { ver: ver, name: meta.name, weeks: meta.weeks, z: z, at: Date.now() } });
      return meta;
    },
    /* Baja el plan solo si hay una versión nueva (1 lectura chica; la grande, solo cuando cambia). Sin acceso, borra la copia local. */
    async refresh(force) {
      if (!A.cloud.signedIn()) return { state: 'off' };
      if (!A.cloud.canPlan()) { C.clear(); return { state: 'sin-acceso' }; }
      const last = store.getLocal().coachCheckedAt || 0; if (!force && Date.now() - last < 6 * 3600 * 1000 && cache()) return { state: 'al-dia' };
      try {
        const meta = await A.cloud.plan.meta();
        if (!meta) { C.clear(); store.setLocal({ coachCheckedAt: Date.now() }); return { state: 'sin-plan' }; }
        const c = cache(); store.setLocal({ coachCheckedAt: Date.now() });
        if (c && c.ver === meta.ver) return { state: 'al-dia' };
        const d = await A.cloud.plan.data(); if (!d || d.ver !== meta.ver || !d.z) return { state: 'error', message: 'El plan publicado está incompleto. Pídele al administrador que lo publique de nuevo.' };
        await decode(d.z); mem = null; store.setLocal({ coachPlan: { ver: meta.ver, name: meta.name, weeks: meta.weeks, z: d.z, at: Date.now() } });
        return { state: 'nuevo' };
      } catch (e) { return { state: e && e.code === 'offline' ? 'offline' : 'error', message: e && e.message }; }
    },

    /* ---- Lectura del plan ---- */
    exName: (plan, id) => { const e = (plan.exercises || {})[id]; return e ? (e.es || e.en || id) : id; },
    itemName(plan, it) { return it.alts.map(alt => alt.map(p => C.exName(plan, p.exId)).join(' + ')).join(' o '); },
    dayName: n => ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][n] || ('Día ' + n),
    /* Máximo propio del primer ejercicio del esquema (para pasar % a kilos) */
    maxOf(plan, it) {
      const p = it.alts[0] && it.alts[0][0]; if (!p) return null; const nm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(), want = [C.exName(plan, p.exId), ((plan.exercises || {})[p.exId] || {}).en].filter(Boolean).map(nm);
      const ex = store.list('exercise').filter(e => e.discipline === 'halterofilia' && e.max && want.indexOf(nm(e.name)) >= 0)[0]; return ex ? ex.max * (p.mult || 1) : null;
    },
    /* Una semana del plan → días de la rutina de Halterofilia (crea los ejercicios que falten) */
    toRoutine(plan, week) {
      const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(), exs = store.list('exercise').filter(e => e.discipline === 'halterofilia'), days = [];
      const exFor = name => { let e = exs.filter(x => norm(x.name) === norm(name))[0]; if (!e) { e = store.save('exercise', { name: name.slice(0, 120), discipline: 'halterofilia', rest: 120 }); exs.push(e); } return e; };
      week.sessions.forEach(s => {
        const items = []; s.items.forEach(it => { const ex = exFor(C.itemName(plan, it)); (it.sets && it.sets.length ? it.sets : [{ pct: 0, reps: '1', sets: 1 }]).forEach(st => { const reps = parseInt(String(st.reps), 10) || 1, o = { exId: ex.id, sets: Math.max(1, Math.min(20, +st.sets || 1)), reps: Math.min(100, reps) }; if (st.pct > 0 && st.pct <= 150) o.pct = st.pct; items.push(o); }); });
        if (items.length) days.push({ id: U.uid(), name: s.name || C.dayName(s.day), dow: s.day % 7, items: items });
      });
      return days;
    }
  };
  A.coach = C;
})(window);
