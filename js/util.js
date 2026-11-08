/* Utilidades puras (sin DOM): fechas, números, ids, promedios. Se usan en la app y en las pruebas de Node. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const pad = n => (n < 10 ? '0' : '') + n;
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  /* «2026-11-07» → Date local (null si no es una fecha real) */
  function parseYmd(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  const isYmd = s => !!parseYmd(s);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const today = () => ymd(new Date());
  /* Lunes de la semana de la fecha dada */
  function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); }
  /* Días entre dos fechas «AAAA-MM-DD» (b − a) */
  function daysBetween(a, b) { const x = parseYmd(a), y = parseYmd(b); return x && y ? Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000) : null; }

  function uid() {
    const c = root.crypto;
    let r = '';
    if (c && c.getRandomValues) { const a = new Uint8Array(6); c.getRandomValues(a); a.forEach(b => { r += (b < 16 ? '0' : '') + b.toString(16); }); }
    else r = Math.random().toString(16).slice(2, 14).padEnd(12, '0');
    return Date.now().toString(36) + r;
  }

  /* Acepta «72,5», «72.5» y «1.234,5». Devuelve null si no es un número. */
  function parseNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let t = String(v == null ? '' : v).trim().replace(/\s/g, '');
    if (!t) return null;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
    const n = parseFloat(t);
    return isFinite(n) ? n : null;
  }
  const round = (n, d) => { const f = Math.pow(10, d || 0); return Math.round((n + Number.EPSILON) * f) / f; };
  /* Número con coma decimal: 72,5 */
  const fmtNum = (n, d) => n == null || !isFinite(n) ? '–' : round(n, d == null ? 1 : d).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: d == null ? 1 : d });
  const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fmtDate(s) { const d = parseYmd(s); return d ? DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] : String(s || ''); }
  /* «7 nov»: fecha corta para los ejes de los gráficos */
  function fmtShort(s) { const d = parseYmd(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] : String(s || ''); }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Promedio móvil por fecha: para cada punto, promedio de los valores de los últimos `days` días (incluido el propio).
     points = [{ date:'AAAA-MM-DD', value:n }] ordenados o no. Devuelve [{ date, value, avg, n }] ordenado por fecha. */
  function trailingAvg(points, days) {
    const pts = points.filter(p => isYmd(p.date) && isFinite(p.value)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    return pts.map(p => {
      const inWin = pts.filter(q => { const k = daysBetween(q.date, p.date); return k != null && k >= 0 && k < days; });
      const sum = inWin.reduce((t, q) => t + q.value, 0);
      return { date: p.date, value: p.value, avg: sum / inWin.length, n: inWin.length };
    });
  }
  /* «0.10.0» > «0.9.0»: comparación numérica por partes (1 si a>b, −1 si a<b, 0 si iguales) */
  function cmpVersion(a, b) {
    const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  }

  const U = { pad, ymd, parseYmd, isYmd, addDays, today, mondayOf, daysBetween, uid, parseNum, round, fmtNum, fmtDate, fmtShort, esc, trailingAvg, cmpVersion };
  A.util = U;
  if (typeof module !== 'undefined' && module.exports) module.exports = U;
})(typeof window !== 'undefined' ? window : globalThis);
