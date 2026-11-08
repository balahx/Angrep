/* Generador mínimo de PDF (sin librerías): títulos, párrafos, tablas y gráficos de línea, con paginación y número de página.
   Usa las fuentes estándar Helvetica y Helvetica-Bold (no se incrustan), así que el archivo es liviano y abre en cualquier visor. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const PW = 595.28, PH = 841.89, M = 48, LH = 1.3;
  /* Anchos de Helvetica (milésimas de em) para ASCII 32..126 */
  const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const CP1252 = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };
  const SUB = { '−': '-', '→': '->', '←': '<-', '✓': 'si', '✕': 'no', '≥': '>=', '≤': '<=', '≈': '~' };
  /* Texto → cadena de bytes cp1252 (lo que no existe en esa codificación se reemplaza) */
  function enc(s) {
    let o = ''; String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').split('').forEach(ch => {
      if (SUB[ch]) { o += SUB[ch]; return; } const c = ch.charCodeAt(0);
      if (c >= 32 && c < 127) o += ch; else if (c >= 160 && c <= 255) o += ch; else if (CP1252[ch]) o += String.fromCharCode(CP1252[ch]); else o += '?';
    });
    return o;
  }
  const esc = b => b.replace(/[\\()]/g, m => '\\' + m);
  const base = c => { const d = c.normalize('NFD').charCodeAt(0); return d >= 32 && d < 127 ? d : 63; };
  /* Ancho en puntos del texto con el cuerpo `size` */
  function width(text, size, bold) {
    let w = 0; for (const ch of enc(text)) { const c = ch.charCodeAt(0), cc = c >= 32 && c < 127 ? c : c >= 160 && c <= 255 ? base(ch) : 63; w += W[(cc >= 32 && cc < 127 ? cc : 63) - 32]; }
    return w / 1000 * size * (bold ? 1.06 : 1);
  }
  /* Parte un texto en líneas que quepan en `maxW` */
  function wrap(text, size, maxW, bold) {
    const out = []; String(text == null ? '' : text).split(/\n/).forEach(par => {
      let line = ''; par.split(/\s+/).filter(Boolean).forEach(word => {
        while (width(word, size, bold) > maxW) { let k = word.length; while (k > 1 && width(word.slice(0, k), size, bold) > maxW) k--; if (line) { out.push(line); line = ''; } out.push(word.slice(0, k)); word = word.slice(k); }
        const t = line ? line + ' ' + word : word; if (width(t, size, bold) <= maxW) line = t; else { out.push(line); line = word; }
      }); out.push(line);
    });
    return out;
  }
  const clip = (text, size, maxW, bold) => { let t = String(text == null ? '' : text); if (width(t, size, bold) <= maxW) return t; while (t.length > 1 && width(t + '…', size, bold) > maxW) t = t.slice(0, -1); return t + '…'; };
  const f2 = n => (Math.round(n * 100) / 100).toString();

  /* Documento: pages[] con operaciones de contenido; `y` baja desde el borde superior */
  function Doc(opts) {
    opts = opts || {}; const d = { pages: [], title: opts.title || 'Documento', footer: opts.footer || '', y: 0, cur: null };
    const newPage = () => { d.cur = []; d.pages.push(d.cur); d.y = M; };
    const room = h => d.y + h <= PH - M - 14, ensure = h => { if (!d.cur || !room(h)) newPage(); };
    const text = (s, x, y, size, bold, gray) => { d.cur.push((gray != null ? f2(gray) + ' g ' : '0 g ') + 'BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + f2(x) + ' ' + f2(PH - y) + ' Td (' + esc(enc(s)) + ') Tj ET'); };
    newPage();
    d.heading = (s, level) => { const size = level === 2 ? 12.5 : 16, gap = level === 2 ? 10 : 14; ensure(size * LH + gap + 16); d.y += gap; text(s, M, d.y + size, size, true); d.y += size * LH; if (level !== 2) { d.cur.push('0.75 G 0.6 w ' + f2(M) + ' ' + f2(PH - d.y - 2) + ' m ' + f2(PW - M) + ' ' + f2(PH - d.y - 2) + ' l S'); d.y += 6; } };
    d.para = (s, o) => { o = o || {}; const size = o.size || 10, lines = wrap(s, size, PW - 2 * M, o.bold); lines.forEach(l => { ensure(size * LH); text(l, M, d.y + size, size, o.bold, o.gray); d.y += size * LH; }); d.y += o.gap == null ? 4 : o.gap; };
    d.space = n => { d.y += n; };
    /* Cifras destacadas en una fila: [[etiqueta, valor], …] */
    d.stats = items => { const n = items.length, gap = 8, w = (PW - 2 * M - gap * (n - 1)) / n, h = 44; ensure(h + 6);
      items.forEach((it, i) => { const x = M + i * (w + gap); d.cur.push('0.85 G 0.6 w ' + f2(x) + ' ' + f2(PH - d.y - h) + ' ' + f2(w) + ' ' + h + ' re S');
        text(clip(it[0], 8, w - 12), x + 6, d.y + 14, 8, false, 0.4); text(clip(it[1], 14, w - 12, true), x + 6, d.y + 33, 14, true); }); d.y += h + 8; };
    /* Tabla: cols = [{ label, w (fracción), align }]; rows = arreglos de texto */
    d.table = (cols, rows) => {
      const total = PW - 2 * M, ws = cols.map(c => c.w * total), size = 9, rh = 15;
      const head = () => { ensure(rh * 2); d.cur.push('0.93 g ' + f2(M) + ' ' + f2(PH - d.y - rh + 3) + ' ' + f2(total) + ' ' + rh + ' re f'); let x = M;
        cols.forEach((c, i) => { const t = clip(c.label, size, ws[i] - 8, true), tx = c.align === 'right' ? x + ws[i] - 4 - width(t, size, true) : x + 4; text(t, tx, d.y + 9, size, true); x += ws[i]; }); d.y += rh; };
      head();
      rows.forEach((r, ri) => { if (!room(rh)) { newPage(); head(); } if (ri % 2) d.cur.push('0.97 g ' + f2(M) + ' ' + f2(PH - d.y - rh + 3) + ' ' + f2(total) + ' ' + rh + ' re f'); let x = M;
        cols.forEach((c, i) => { const t = clip(r[i], size, ws[i] - 8), tx = c.align === 'right' ? x + ws[i] - 4 - width(t, size) : x + 4; text(t, tx, d.y + 9, size, false); x += ws[i]; }); d.y += rh; });
      d.y += 8;
    };
    /* Gráfico de línea: points [{x (número), y}], xLabels [[x, texto]] */
    d.line = (points, o) => {
      o = o || {}; const h = o.height || 120, w = PW - 2 * M, pad = { l: 34, r: 8, t: 8, b: 16 }; ensure(h + 24);
      if (o.title) { text(o.title, M, d.y + 9, 9, true); d.y += 14; }
      const pts = points.filter(p => isFinite(p.x) && isFinite(p.y)); if (pts.length < 2) { d.para('Hay muy pocos datos para dibujar el gráfico.', { size: 9, gray: 0.4 }); return; }
      let x0 = Math.min.apply(null, pts.map(p => p.x)), x1 = Math.max.apply(null, pts.map(p => p.x)), y0 = Math.min.apply(null, pts.map(p => p.y)), y1 = Math.max.apply(null, pts.map(p => p.y));
      if (y1 === y0) { y0 -= 1; y1 += 1; } const m = (y1 - y0) * 0.1; y0 -= m; y1 += m; if (x1 === x0) x1 += 1;
      const px = x => M + pad.l + (x - x0) / (x1 - x0) * (w - pad.l - pad.r), py = y => d.y + pad.t + (1 - (y - y0) / (y1 - y0)) * (h - pad.t - pad.b);
      d.cur.push('0.88 G 0.5 w');
      for (let i = 0; i <= 3; i++) { const yv = y0 + (y1 - y0) * i / 3, yy = py(yv); d.cur.push(f2(M + pad.l) + ' ' + f2(PH - yy) + ' m ' + f2(M + w - pad.r) + ' ' + f2(PH - yy) + ' l S'); const t = (Math.round(yv * 10) / 10).toString().replace('.', ','); text(t, M + pad.l - 4 - width(t, 7.5), yy + 2.5, 7.5, false, 0.4); }
      d.cur.push('0.1 0.45 0.45 RG 1.4 w ' + pts.map((p, i) => f2(px(p.x)) + ' ' + f2(PH - py(p.y)) + (i ? ' l' : ' m')).join(' ') + ' S');
      if (pts.length <= 40) pts.forEach(p => d.cur.push('0.1 0.45 0.45 rg ' + f2(px(p.x) - 1.6) + ' ' + f2(PH - py(p.y) - 1.6) + ' 3.2 3.2 re f'));
      (o.xLabels || []).forEach(l => { const t = String(l[1]), tx = Math.min(Math.max(px(l[0]) - width(t, 7.5) / 2, M + pad.l), PW - M - pad.r - width(t, 7.5)); text(t, tx, d.y + h - 3, 7.5, false, 0.4); });
      d.y += h + 6;
    };
    d.finish = () => build(d);
    return d;
  }

  /* Arma los objetos del archivo y la tabla de referencias cruzadas */
  function build(d) {
    const n = d.pages.length, objs = [], add = s => { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>');
    add('<< /Type /Pages /Kids [' + d.pages.map((p, i) => (5 + i * 2) + ' 0 R').join(' ') + '] /Count ' + n + ' >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    d.pages.forEach((ops, i) => {
      const foot = 'BT /F1 8 Tf 0.45 g ' + f2(M) + ' ' + f2(M - 20) + ' Td (' + esc(enc(d.footer)) + ') Tj ET BT /F1 8 Tf 0.45 g ' + f2(PW - M - width('Página ' + (i + 1) + ' de ' + n, 8)) + ' ' + f2(M - 20) + ' Td (' + esc(enc('Página ' + (i + 1) + ' de ' + n)) + ') Tj ET';
      const content = ops.join('\n') + '\n' + foot, pid = add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f2(PW) + ' ' + f2(PH) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (objs.length + 2) + ' 0 R >>');
      add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
    });
    const info = add('<< /Title (' + esc(enc(d.title)) + ') /Producer (Seguimiento personal) >>');
    let out = '%PDF-1.4\n%âãÏÓ\n'; const off = [];
    objs.forEach((o, i) => { off.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = out.length; out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    const u8 = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u8[i] = out.charCodeAt(i) & 255;
    return u8;
  }

  const P = { Doc, width, wrap, clip, enc };
  A.pdf = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
