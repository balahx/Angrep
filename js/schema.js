/* Modelo de datos: tipos de registro, reglas de validación e ids.
   Cada registro lleva { id, updatedAt, deviceId, deleted? }. El borrado es lógico (deleted:true) para poder sincronizar.
   Los tipos «diarios» tienen id fijo por fecha (weight_2026-11-07): así dos dispositivos no crean el mismo día dos veces.
   Los tipos con synced:false se quedan en este dispositivo (fotos, documentos, bitácora de importaciones). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util || (typeof require !== 'undefined' ? require('./util.js') : null);

  const DISCIPLINES = ['halterofilia', 'pesas', 'cardio', 'otro'];
  const SLOTS = ['desayuno', 'almuerzo', 'once', 'cena', 'colacion'];
  const SITES = ['cintura', 'cadera', 'pecho', 'brazo', 'muslo', 'cuello', 'pantorrilla'];
  const GOAL_KINDS = ['weight', 'steps', 'kcal', 'macros', 'sessions'];
  const MEAS = ['kg', 'reps', 'time', 'distance'];
  const ACTIVITY = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, alto: 1.725, muyalto: 1.9 };

  const isNum = (v, min, max) => typeof v === 'number' && isFinite(v) && v >= min && v <= max;
  const optNum = (v, min, max) => v == null || isNum(v, min, max);
  const isStr = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= (max || 200);
  const optStr = (v, max) => v == null || (typeof v === 'string' && v.length <= (max || 2000));
  const date = v => U.isYmd(v);

  /* validate devuelve '' si está bien, o el motivo */
  const TYPES = {
    weight: { daily: true, synced: true, validate: o => !date(o.date) ? 'fecha' : !isNum(o.kg, 20, 400) ? 'peso (20–400 kg)' : !optStr(o.note) ? 'nota' : '' },
    steps: { daily: true, synced: true, validate: o => !date(o.date) ? 'fecha' : !(Number.isInteger(o.count) && o.count >= 0 && o.count <= 200000) ? 'pasos (0–200000)' : '' },
    measure: { synced: true, validate: o => !date(o.date) ? 'fecha' : SITES.indexOf(o.site) < 0 ? 'zona' : !isNum(o.cm, 5, 300) ? 'medida (5–300 cm)' : '' },
    goal: { synced: true, validate: o => GOAL_KINDS.indexOf(o.kind) < 0 ? 'tipo de objetivo' : !isNum(o.target, 0, 1e6) ? 'valor objetivo' : o.targetDate != null && !date(o.targetDate) ? 'fecha objetivo' : o.startDate != null && !date(o.startDate) ? 'fecha de inicio' : !optNum(o.startValue, 0, 1e6) ? 'valor inicial' : '' },
    food: { synced: true, validate: o => !isStr(o.name, 120) ? 'nombre' : !isNum(o.amount, 0.01, 1e5) ? 'cantidad' : !isNum(o.kcal, 0, 1e5) ? 'kcal' : !optNum(o.p, 0, 1e4) || !optNum(o.c, 0, 1e4) || !optNum(o.f, 0, 1e4) ? 'macros' : '' },
    meal: { synced: true, validate: o => !date(o.date) ? 'fecha' : SLOTS.indexOf(o.slot) < 0 ? 'comida del día' : !isStr(o.name, 120) ? 'nombre' : !isNum(o.kcal, 0, 1e5) ? 'kcal' : !optNum(o.p, 0, 1e4) || !optNum(o.c, 0, 1e4) || !optNum(o.f, 0, 1e4) ? 'macros' : '' },
    nutriday: { daily: true, synced: true, validate: o => !date(o.date) ? 'fecha' : !isNum(o.kcal, 0, 1e5) ? 'kcal' : !optNum(o.p, 0, 1e4) || !optNum(o.c, 0, 1e4) || !optNum(o.f, 0, 1e4) ? 'macros' : '' },
    exercise: { synced: true, validate: o => !isStr(o.name, 120) ? 'nombre' : DISCIPLINES.indexOf(o.discipline) < 0 ? 'disciplina' : o.meas != null && MEAS.indexOf(o.meas) < 0 ? 'medida' : !optNum(o.max, 0, 1000) ? 'máximo' : '' },
    plan: { synced: true, validate: o => !isStr(o.name, 120) ? 'nombre' : DISCIPLINES.indexOf(o.discipline) < 0 ? 'disciplina' : ['weekly', 'cycle'].indexOf(o.kind) < 0 ? 'tipo de plan' : '' },
    session: { synced: true, validate: o => DISCIPLINES.indexOf(o.discipline) < 0 ? 'disciplina' : !date(o.date) ? 'fecha' : !Array.isArray(o.items) ? 'ejercicios' : o.mode != null && ['live', 'quick'].indexOf(o.mode) < 0 ? 'modo' : !optNum(o.rpe, 0, 10) ? 'RPE' : '' },
    /* Solo en este dispositivo */
    photo: { synced: false, validate: o => !date(o.date) ? 'fecha' : !isStr(o.blobKey, 80) ? 'archivo' : '' },
    doc: { synced: false, validate: o => !isStr(o.name, 200) ? 'nombre' : '' },
    importlog: { synced: false, validate: o => !isStr(o.source, 60) ? 'origen' : '' }
  };
  const SYNCED = Object.keys(TYPES).filter(t => TYPES[t].synced);

  /* Id de un registro: fijo por fecha en los diarios, aleatorio en el resto */
  function idFor(type, o) { return TYPES[type].daily ? type + '_' + o.date : (o.id || U.uid()); }
  /* Motivo por el que el registro no vale, o '' */
  function check(type, o) {
    const T = TYPES[type];
    if (!T) return 'tipo desconocido';
    if (!o || typeof o !== 'object' || Array.isArray(o)) return 'registro vacío';
    return T.validate(o);
  }

  const S = { TYPES, SYNCED, DISCIPLINES, SLOTS, SITES, GOAL_KINDS, MEAS, ACTIVITY, idFor, check };
  A.schema = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
