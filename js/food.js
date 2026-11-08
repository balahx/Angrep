/* Cálculos de alimentación (puros, sin DOM): gasto diario, kcal y macros objetivo, totales por día,
   coherencia de una etiqueta, cumplimiento e importación de alimentos desde JSON. Se prueban en Node (tests/unit.js). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util || (typeof require !== 'undefined' ? require('./util.js') : null);
  const S = A.schema || (typeof require !== 'undefined' ? require('./schema.js') : null);
  const KCAL_PER_KG = 7700;
  const TOL_KCAL = 0.10;       // un día cuenta como «en meta» si las kcal quedan a ±10 % del objetivo
  const TOL_PROT = 0.90;       // y la proteína llega al menos al 90 % de su meta
  const UNITS = ['g', 'ml', 'porción', 'unidad'];

  const num = v => typeof v === 'number' && isFinite(v);
  const r1 = n => U.round(n, 1);
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- Gasto y objetivo ---------- */
  function ageOf(birth, today) {
    const b = U.parseYmd(birth), t = U.parseYmd(today || U.today());
    if (!b || !t) return null;
    let a = t.getFullYear() - b.getFullYear();
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
    return a;
  }
  /* Metabolismo basal (Mifflin-St Jeor): 10·kg + 6,25·cm − 5·edad + 5 (hombre) o −161 (mujer) */
  function bmr(o) { return 10 * o.kg + 6.25 * o.heightCm - 5 * o.age + (o.sex === 'M' ? 5 : -161); }
  /* Datos que faltan en el perfil o el peso para poder calcular (lista vacía si está todo) */
  function missing(profile, kg, today) {
    const m = [];
    if (!profile.sex) m.push('sexo'); if (!profile.heightCm) m.push('estatura');
    const age = profile.birth ? ageOf(profile.birth, today) : null;
    if (age == null || age < 14 || age > 100) m.push('fecha de nacimiento'); if (!profile.activity) m.push('nivel de actividad'); if (!num(kg)) m.push('un peso registrado');
    return m;
  }
  /* Gasto y objetivo sugerido. `rate` = kg por semana que se quiere cambiar (negativo = bajar). */
  function recommend(profile, kg, rate, today) {
    if (missing(profile, kg, today).length) return null;
    const age = ageOf(profile.birth, today), b = bmr({ kg: kg, heightCm: profile.heightCm, age: age, sex: profile.sex });
    const tdee = b * S.ACTIVITY[profile.activity], adj = (rate || 0) * KCAL_PER_KG / 7;
    const target = Math.round((tdee + adj) / 10) * 10;
    const floor = Math.round(b / 10) * 10;                   // bajo el basal no se recomienda sostener
    return { bmr: Math.round(b), tdee: Math.round(tdee), adjust: Math.round(adj), target: target, floor: floor, belowFloor: target < floor, rate: rate || 0 };
  }
  /* Kcal diarias que equivalen a un cambio semanal en kg */
  const kcalForRate = perWeek => Math.round(perWeek * KCAL_PER_KG / 7);

  /* Macros sugeridos: proteína 1,8 g/kg, grasa 25 % de las kcal, el resto carbohidratos. Todo se puede ajustar. */
  function macroDefaults(kcal, kg) {
    const p = Math.round((num(kg) ? kg : 70) * 1.8), f = Math.round(kcal * 0.25 / 9), c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
    return { p: p, c: c, f: f };
  }
  const kcalOfMacros = (p, c, f) => 4 * (p || 0) + 4 * (c || 0) + 9 * (f || 0);

  /* ---------- Alimentos ---------- */
  /* Valores de un alimento para una cantidad (el alimento guarda los valores de `amount` unidades) */
  function scale(food, qty) {
    const k = qty / food.amount, m = v => v == null ? null : r1(v * k);
    return { kcal: r1(food.kcal * k), p: m(food.p), c: m(food.c), f: m(food.f) };
  }
  /* ¿Las kcal de la etiqueta cuadran con los macros? (4·p + 4·c + 9·f, con margen por fibra y redondeos) */
  function coherence(o) {
    if (![o.p, o.c, o.f].every(num) || !num(o.kcal)) return { ok: true, checked: false };
    const exp = kcalOfMacros(o.p, o.c, o.f), big = Math.max(o.kcal, exp, 1), diff = Math.abs(o.kcal - exp);
    return { ok: diff <= 15 || diff / big <= 0.2, checked: true, expected: Math.round(exp), diff: Math.round(diff) };
  }
  /* Busca en la base propia: favoritos primero, luego por coincidencia al inicio y después en cualquier parte */
  function search(foods, q) {
    const t = norm(q), live = foods.filter(f => !f.deleted);
    const rank = f => (f.fav ? 0 : 3) + (!t ? 0 : norm(f.name).indexOf(t) === 0 ? 0 : norm(f.name).indexOf(t) > 0 ? 1 : 9);
    return live.filter(f => rank(f) < 9).sort((a, b) => rank(a) - rank(b) || norm(a.name).localeCompare(norm(b.name)));
  }

  /* Importar alimentos desde JSON (p. ej. lo que devuelve Claude al leer fotos de etiquetas).
     Formato: [{ nombre, unidad, cantidad, kcal, p, c, f }] o { alimentos: [...] }. Acepta también name/unit/amount. */
  function parseFoods(text, existing) {
    let raw;
    try { raw = JSON.parse(String(text).replace(/^﻿/, '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); } catch (e) { return { foods: [], errors: ['El texto no es un JSON válido.'], dup: 0 }; }
    const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.alimentos) ? raw.alimentos : raw && Array.isArray(raw.foods) ? raw.foods : null;
    if (!list) return { foods: [], errors: ['No encontré una lista de alimentos. Debe ser una lista, o un objeto con «alimentos».'], dup: 0 };
    const have = {}; (existing || []).forEach(f => { if (!f.deleted) have[norm(f.name)] = 1; });
    const out = [], errors = []; let dup = 0;
    list.forEach((it, i) => {
      const n = (k1, k2) => { const v = it[k1] != null ? it[k1] : it[k2]; return v == null || v === '' ? null : U.parseNum(v); };
      const unit = String(it.unidad || it.unit || 'g').toLowerCase();
      const f = { name: String(it.nombre || it.name || '').trim(), unit: UNITS.indexOf(unit) >= 0 ? unit : 'g', amount: n('cantidad', 'amount') == null ? 100 : n('cantidad', 'amount'), kcal: n('kcal', 'kcal'), p: n('p', 'proteinas'), c: n('c', 'carbohidratos'), f: n('f', 'grasas'), source: 'json' };
      if (f.kcal == null) { errors.push('Fila ' + (i + 1) + (f.name ? ' (' + f.name + ')' : '') + ': faltan las kcal.'); return; }
      ['p', 'c', 'f'].forEach(k => { if (f[k] == null) delete f[k]; });
      const why = S.check('food', f);
      if (why) { errors.push('Fila ' + (i + 1) + (f.name ? ' (' + f.name + ')' : '') + ': dato no válido (' + why + ').'); return; }
      const key = norm(f.name);
      if (have[key]) { dup++; return; }
      have[key] = 1; out.push(f);
    });
    return { foods: out, errors: errors, dup: dup };
  }

  /* ---------- Totales por día ---------- */
  const sum = (arr, k) => arr.reduce((t, x) => t + (num(x[k]) ? x[k] : 0), 0);
  const hasMacro = arr => arr.some(x => num(x.p) || num(x.c) || num(x.f));
  /* Totales de un día: si hay comidas, suman las comidas; si no, valen los totales rápidos del día. */
  function dayTotal(meals, quick) {
    if (meals && meals.length) return { source: 'comidas', n: meals.length, kcal: r1(sum(meals, 'kcal')), p: r1(sum(meals, 'p')), c: r1(sum(meals, 'c')), f: r1(sum(meals, 'f')), macros: hasMacro(meals) };
    if (quick) return { source: 'rapido', n: 0, kcal: quick.kcal, p: quick.p == null ? 0 : quick.p, c: quick.c == null ? 0 : quick.c, f: quick.f == null ? 0 : quick.f, macros: [quick.p, quick.c, quick.f].some(num) };
    return null;
  }
  /* Serie [{date, total}] para un rango (días sin registro quedan con total null) */
  function series(meals, nutri, from, to) {
    const bm = {}, qm = {}; meals.forEach(m => { (bm[m.date] = bm[m.date] || []).push(m); }); nutri.forEach(q => { qm[q.date] = q; });
    const out = []; for (let d = from; d <= to; d = U.ymd(U.addDays(U.parseYmd(d), 1))) out.push({ date: d, total: dayTotal(bm[d], qm[d]) });
    return out;
  }
  /* ¿Cumplió el día? goal = { kcal, p, c, f } (todo opcional salvo kcal) */
  function dayStatus(total, goal) {
    if (!total) return { logged: false };
    const kOk = !goal || !goal.kcal ? null : Math.abs(total.kcal - goal.kcal) <= goal.kcal * TOL_KCAL;
    const pOk = !goal || !goal.p || !total.macros ? null : total.p >= goal.p * TOL_PROT;
    const ok = kOk == null ? null : kOk && pOk !== false;
    return { logged: true, kcalOk: kOk, protOk: pOk, ok: ok, diff: goal && goal.kcal ? Math.round(total.kcal - goal.kcal) : null };
  }
  /* Cumplimiento: días registrados en meta, % de los últimos `days`, racha actual y mejor racha (solo cuentan días registrados) */
  function compliance(ser, goal, today, days) {
    const win = ser.filter(s => s.date <= today).slice(-(days || 30)), st = ser.filter(s => s.date <= today).map(s => dayStatus(s.total, goal));
    const w = win.map(s => dayStatus(s.total, goal)), logged = w.filter(x => x.logged).length, ok = w.filter(x => x.ok).length;
    let streak = 0, best = 0, run = 0;
    st.forEach(x => { if (x.ok) { run++; best = Math.max(best, run); } else run = 0; });
    for (let i = st.length - 1; i >= 0; i--) { if (st[i].ok) streak++; else if (i === st.length - 1 && !st[i].logged) continue; else break; }
    return { days: win.length, logged: logged, ok: ok, pct: logged ? Math.round(100 * ok / logged) : null, streak: streak, best: best };
  }
  /* Promedio de kcal y macros de los días con registro del rango */
  function average(ser) {
    const t = ser.filter(s => s.total); if (!t.length) return null;
    const m = k => r1(t.reduce((a, s) => a + s.total[k], 0) / t.length);
    return { n: t.length, kcal: Math.round(t.reduce((a, s) => a + s.total.kcal, 0) / t.length), p: m('p'), c: m('c'), f: m('f') };
  }
  /* Déficit/superávit acumulado frente al objetivo en días registrados (kcal) y su equivalente en kg */
  function balance(ser, goalKcal) {
    const t = ser.filter(s => s.total); if (!t.length || !goalKcal) return null;
    const kcal = t.reduce((a, s) => a + (s.total.kcal - goalKcal), 0);
    return { n: t.length, kcal: Math.round(kcal), kg: U.round(kcal / KCAL_PER_KG, 2) };
  }

  const F = { UNITS, TOL_KCAL, TOL_PROT, KCAL_PER_KG, norm, ageOf, bmr, missing, recommend, kcalForRate, macroDefaults, kcalOfMacros, scale, coherence, search, parseFoods, dayTotal, series, dayStatus, compliance, average, balance };
  A.food = F;
  if (typeof module !== 'undefined' && module.exports) module.exports = F;
})(typeof window !== 'undefined' ? window : globalThis);
