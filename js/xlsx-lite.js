/* Lector mínimo de .xlsx sin librerías: lee la primera hoja y devuelve { grid, merges } como espera plan-import.js.
   Un .xlsx es un ZIP con XML; se descomprime con DecompressionStream (navegador) o zlib (Node, para las pruebas). */
(function (root) {
  'use strict';
  const td = new TextDecoder('utf-8');
  async function inflate(bytes) {
    if (typeof DecompressionStream !== 'undefined') { const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); }
    return new Uint8Array(require('zlib').inflateRawSync(Buffer.from(bytes)));
  }
  async function unzip(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('No parece un archivo .xlsx');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Archivo dañado');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
      const lo = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), data = u8.subarray(lo, lo + csize);
      files[name] = { method: method, data: data };
    }
    return { has: n => !!files[n], async text(n) { const f = files[n]; if (!f) return null; return td.decode(f.method === 0 ? f.data : await inflate(f.data)); } };
  }
  const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
  const colNum = s => { let n = 0; for (let i = 0; i < s.length; i++) n = n * 26 + s.charCodeAt(i) - 64; return n - 1; };
  const tx = x => { let o = '', m; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; while ((m = re.exec(x))) o += m[1]; return unesc(o); };

  async function readXlsx(buf) {
    const z = await unzip(buf), ssx = await z.text('xl/sharedStrings.xml'), strings = [];
    if (ssx) { const re = /<si>([\s\S]*?)<\/si>|<si\/>/g; let m; while ((m = re.exec(ssx))) strings.push(m[1] ? tx(m[1]) : ''); }
    const wb = await z.text('xl/workbook.xml'), rel = await z.text('xl/_rels/workbook.xml.rels'); let path = 'xl/worksheets/sheet1.xml';
    if (wb && rel) { const rid = (/<sheet\b[^>]*\br:id="([^"]+)"/.exec(wb) || [])[1], t = rid && new RegExp('<Relationship\\b[^>]*\\bId="' + rid + '"[^>]*>').exec(rel); const tg = t && /Target="([^"]+)"/.exec(t[0]); if (tg) path = tg[1].replace(/^\//, '').replace(/^(?!xl\/)/, 'xl/'); }
    const sx = await z.text(path); if (!sx) throw new Error('No encuentro la hoja del Excel');
    const grid = []; const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
    while ((m = re.exec(sx))) {
      const at = m[1], r = /\br="([A-Z]+)(\d+)"/.exec(at); if (!r) continue; const body = m[2] || '', t = (/\bt="(\w+)"/.exec(at) || [])[1], v = (/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1];
      let val = null;
      if (t === 's') val = v == null ? null : strings[+v]; else if (t === 'inlineStr') val = tx(body); else if (t === 'str' || t === 'e') val = v == null ? null : unesc(v); else if (t === 'b') val = v === '1'; else if (v != null && v !== '') val = +v;
      if (val == null || val === '') continue;
      const ri = +r[2] - 1, ci = colNum(r[1]); (grid[ri] = grid[ri] || [])[ci] = val;
    }
    for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = [];
    const merges = []; const mre = /<mergeCell\s+ref="([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?"/g;
    while ((m = mre.exec(sx))) merges.push({ r1: +m[2] - 1, c1: colNum(m[1]), r2: +(m[4] || m[2]) - 1, c2: colNum(m[3] || m[1]) });
    return { grid: grid, merges: merges };
  }
  const api = { readXlsx: readXlsx, unzip: unzip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.XlsxLite = api;
})(typeof window !== 'undefined' ? window : globalThis);
