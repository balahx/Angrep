/* Gráficos SVG sin librerías: línea (varias series) y columnas. Se dibujan al ancho real y se redibujan al cambiar de tamaño.
   Reglas aplicadas: líneas de 2 px, marcas de 8 px con anillo del color de la superficie, rejilla fina y apagada, leyenda cuando hay
   2 o más series, etiqueta solo al final de la serie, texto en colores de texto (no del dato), tooltip con cursor vertical,
   teclado (← →) y tabla de datos equivalente. Los colores salen de variables CSS (--c1, --c2, --cm) y cambian solos en modo oscuro. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util, h = A.ui.h, NS = 'http://www.w3.org/2000/svg';
  const live = [];

  const svg = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); if (parent) parent.appendChild(e); return e; };
  const fmt = (v, d) => U.fmtNum(v, Math.abs(v) >= 1000 ? 0 : (d == null ? 1 : d));

  function niceTicks(min, max, n) {
    if (!(max > min)) { min -= 1; max += 1; }
    const raw = (max - min) / (n || 4), pow = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pow;
    const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow, lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step, t = [];
    for (let v = lo; v <= hi + step / 2; v += step) t.push(U.round(v, 6));
    return { ticks: t, min: t[0], max: t[t.length - 1] };
  }

  /* Muestra de la serie en la leyenda y en el tooltip: trazo corto con el mismo patrón y color que la línea */
  function key(s) {
    const k = svg('svg', { viewBox: '0 0 28 10', width: 28, height: 10, 'aria-hidden': 'true', class: 'key' });
    if (s.kind === 'dots') svg('circle', { cx: 14, cy: 5, r: 4, class: 'f-' + s.cls }, k);
    else svg('line', { x1: 1, y1: 5, x2: 27, y2: 5, class: 'ch-line s-' + s.cls + (s.kind === 'dash' ? ' dash' : s.kind === 'dot' ? ' dot' : '') }, k);
    return k;
  }

  /* Estructura común: leyenda, lienzo, tooltip y tabla de datos */
  function frame(host, spec, legendSeries) {
    host.classList.add('chart'); host.innerHTML = '';
    const plot = h('div', { class: 'chart-plot', tabindex: '0', role: 'group', 'aria-label': spec.ariaLabel + ' Con las flechas del teclado recorres los puntos.' });
    const tip = h('div', { class: 'tip', hidden: true });
    const parts = [];
    if (legendSeries.length >= 2) parts.push(h('ul', { class: 'legend' }, legendSeries.map(s => h('li', null, key(s), h('span', null, s.name)))));
    parts.push(plot); plot.appendChild(tip);
    host.append.apply(host, parts);
    return { plot: plot, tip: tip };
  }
  function dataTable(host, head, rows, note) {
    const t = h('table', { class: 'dt' }, h('thead', null, h('tr', null, head.map(x => h('th', { scope: 'col' }, x)))), h('tbody', null, rows.map(r => h('tr', null, r.map((c, i) => h(i ? 'td' : 'th', i ? null : { scope: 'row' }, c))))));
    host.appendChild(h('details', { class: 'dt-wrap' }, h('summary', null, 'Ver los datos en tabla'), note ? h('p', { class: 'hint' }, note) : null, h('div', { class: 'dt-scroll' }, t)));
  }
  /* Posiciona el tooltip junto al punto sin salirse del gráfico */
  function placeTip(tip, plot, px, W) {
    tip.hidden = false;
    const w = tip.offsetWidth || 150;
    tip.style.left = Math.max(4, Math.min(W - w - 4, px + 12 > W - w ? px - w - 12 : px + 12)) + 'px';
  }

  /* ---------- Línea ----------
     spec: { ariaLabel, unit, decimals, series:[{ name, kind:'line'|'dash'|'dot'|'dots', cls:'c1'|'c2'|'cm', pts:[{x,y}], endLabel?, hover? }],
             xDomain?, xTicks?(x0,x1)->[{x,label}], xFormat(x)->texto, xLabel? } */
  function line(host, spec) {
    let W = 0, idx = 0, xs = [];
    const hoverSeries = () => spec.series.filter(s => s.hover !== false);
    const F = frame(host, spec, spec.series.filter(s => s.legend !== false));
    const wrap = F.plot;
    xs = Array.from(new Set([].concat.apply([], hoverSeries().map(s => s.pts.map(p => p.x))))).sort((a, b) => a - b);

    function draw() {
      W = Math.max(260, Math.round(wrap.clientWidth || host.clientWidth || 320));
      const H = W < 520 ? 240 : 300, m = { l: 46, r: 14, t: 16, b: 28 };
      wrap.querySelectorAll('svg.plotsvg').forEach(n => n.remove());
      const all = [].concat.apply([], spec.series.map(s => s.pts));
      if (!all.length) return;
      const dom = spec.xDomain || [Math.min.apply(null, all.map(p => p.x)), Math.max.apply(null, all.map(p => p.x))];
      const x0 = dom[0], x1 = dom[1] > dom[0] ? dom[1] : dom[0] + 1;
      const ys = all.map(p => p.y), nt = niceTicks(Math.min.apply(null, ys), Math.max.apply(null, ys), 4);
      const sx = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r), sy = y => H - m.b - (y - nt.min) / (nt.max - nt.min) * (H - m.t - m.b);
      const s = svg('svg', { class: 'plotsvg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
      nt.ticks.forEach(v => { svg('line', { x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v), class: v === nt.min ? 'ch-axis' : 'ch-grid' }, s); const t = svg('text', { x: m.l - 8, y: sy(v) + 4, 'text-anchor': 'end', class: 'ch-tick' }, s); t.textContent = fmt(v, spec.decimals); });
      const ticks = spec.xTicks ? spec.xTicks(x0, x1) : [0, 1, 2, 3].map(i => { const x = Math.round(x0 + (x1 - x0) * i / 3); const f = spec.xTickFormat || spec.xFormat; return { x: x, label: f ? f(x) : String(x) }; });
      const maxLabels = Math.max(2, Math.floor((W - m.l - m.r) / 70));
      const step = Math.ceil(ticks.length / maxLabels);
      ticks.forEach((t, i) => { if (i % step) return; const e = svg('text', { x: Math.min(W - m.r - 4, Math.max(m.l + 4, sx(t.x))), y: H - 8, 'text-anchor': 'middle', class: 'ch-tick' }, s); e.textContent = t.label; });
      spec.series.forEach(se => {
        const pts = se.pts.slice().sort((a, b) => a.x - b.x);
        if (!pts.length) return;
        if (se.kind === 'dots') { const ring = pts.length <= 150; pts.forEach(p => svg('circle', { cx: sx(p.x), cy: sy(p.y), r: ring ? 4 : 3, class: 'f-' + se.cls + (ring ? ' ch-ring' : '') }, s)); }
        else if (pts.length === 1) svg('circle', { cx: sx(pts[0].x), cy: sy(pts[0].y), r: 4, class: 'f-' + se.cls + ' ch-ring' }, s);
        else svg('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' '), class: 'ch-line s-' + se.cls + (se.kind === 'dash' ? ' dash' : se.kind === 'dot' ? ' dot' : '') }, s);
        if (se.endLabel) {
          const p = pts[pts.length - 1], cx = sx(p.x), cy = sy(p.y);
          svg('circle', { cx: cx, cy: cy, r: 5, class: 'f-' + se.cls + ' ch-ring' }, s);
          const t = svg('text', { x: cx > W / 2 ? cx - 8 : cx + 8, y: Math.max(m.t + 10, cy - 10), 'text-anchor': cx > W / 2 ? 'end' : 'start', class: 'ch-end' }, s);
          t.textContent = (se.endText || fmt(p.y, spec.decimals) + (spec.unit ? ' ' + spec.unit : ''));
        }
      });
      const cross = svg('line', { y1: m.t, y2: H - m.b, class: 'ch-cross', visibility: 'hidden' }, s), hot = svg('g', { class: 'hot' }, s);
      const hit = svg('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: 'transparent' }, s);
      wrap.insertBefore(s, F.tip);

      function show(i) {
        if (!xs.length) return; idx = Math.max(0, Math.min(xs.length - 1, i));
        const x = xs[idx], px = sx(x);
        cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
        hot.innerHTML = ''; F.tip.innerHTML = '';
        F.tip.appendChild(h('div', { class: 'tip-x' }, spec.xFormat ? spec.xFormat(x) : String(x)));
        hoverSeries().forEach(se => {
          const p = se.pts.filter(q => q.x === x)[0]; if (!p) return;
          svg('circle', { cx: px, cy: sy(p.y), r: 5, class: 'f-' + se.cls + ' ch-ring' }, hot);
          F.tip.appendChild(h('div', { class: 'tip-row' }, key(se), h('strong', null, fmt(p.y, spec.decimals) + (spec.unit ? ' ' + spec.unit : '')), h('span', { class: 'muted' }, se.name)));
        });
        placeTip(F.tip, wrap, px, W);
      }
      const hide = () => { cross.setAttribute('visibility', 'hidden'); hot.innerHTML = ''; F.tip.hidden = true; };
      const near = ev => { const r = s.getBoundingClientRect(), px = ev.clientX - r.left; let best = 0, bd = 1e9; xs.forEach((x, i) => { const d = Math.abs(sx(x) - px); if (d < bd) { bd = d; best = i; } }); return best; };
      hit.addEventListener('pointermove', ev => show(near(ev))); hit.addEventListener('pointerdown', ev => show(near(ev))); hit.addEventListener('pointerleave', hide);
      wrap.onkeydown = ev => { if (ev.key === 'ArrowRight') { show(idx + 1); ev.preventDefault(); } else if (ev.key === 'ArrowLeft') { show(idx - 1); ev.preventDefault(); } else if (ev.key === 'Escape') hide(); };
      wrap.onfocus = () => show(xs.length - 1); wrap.onblur = hide;
    }
    draw();
    /* tabla equivalente (límite de filas para no inflar la pantalla) */
    const hs = hoverSeries(), MAX = 150, shown = xs.length > MAX ? xs.slice(-MAX) : xs;
    dataTable(host, [spec.xLabel || 'Fecha'].concat(hs.map(s => s.name + (spec.unit ? ' (' + spec.unit + ')' : ''))),
      shown.slice().reverse().map(x => [spec.xFormat ? spec.xFormat(x) : String(x)].concat(hs.map(se => { const p = se.pts.filter(q => q.x === x)[0]; return p ? fmt(p.y, spec.decimals) : '–'; }))),
      xs.length > MAX ? 'Se muestran los últimos ' + MAX + ' puntos.' : null);
    return track(host, draw);
  }

  /* ---------- Columnas ----------
     spec: { ariaLabel, unit, decimals, pts:[{ label, y, tip? }], goal?:{ y, label }, name } */
  function bars(host, spec) {
    let W = 0, idx = 0;
    const F = frame(host, spec, []), wrap = F.plot, n = spec.pts.length;
    function draw() {
      W = Math.max(260, Math.round(wrap.clientWidth || host.clientWidth || 320));
      const H = 220, m = { l: 46, r: 14, t: 16, b: 28 };
      wrap.querySelectorAll('svg.plotsvg').forEach(x => x.remove());
      const top = Math.max(spec.goal ? spec.goal.y : 0, Math.max.apply(null, spec.pts.map(p => p.y).concat([1])));
      const nt = niceTicks(0, top, 4), slot = (W - m.l - m.r) / Math.max(1, n), bw = Math.min(24, Math.max(4, slot * 0.6));
      const sy = y => H - m.b - y / nt.max * (H - m.t - m.b), s = svg('svg', { class: 'plotsvg', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true', focusable: 'false' });
      nt.ticks.forEach(v => { svg('line', { x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v), class: v === 0 ? 'ch-axis' : 'ch-grid' }, s); const t = svg('text', { x: m.l - 8, y: sy(v) + 4, 'text-anchor': 'end', class: 'ch-tick' }, s); t.textContent = fmt(v, 0); });
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - m.l - m.r) / 44))));
      const bar = [], r = 4;
      spec.pts.forEach((p, i) => {
        const cx = m.l + slot * (i + .5), x = cx - bw / 2, y = sy(p.y), base = sy(0), hgt = base - y;
        if (hgt > 0.5) {
          const d = hgt <= r ? 'M' + x + ' ' + y + 'h' + bw + 'V' + base + 'H' + x + 'Z' : 'M' + x + ' ' + (y + r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' -' + r + 'h' + (bw - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'V' + base + 'H' + x + 'Z';
          bar[i] = svg('path', { d: d, class: 'f-c1 bar' }, s);
        }
        if (i % every === 0) { const t = svg('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'ch-tick' }, s); t.textContent = p.label; }
      });
      if (spec.goal) {
        svg('line', { x1: m.l, x2: W - m.r, y1: sy(spec.goal.y), y2: sy(spec.goal.y), class: 'ch-line s-c2 dash' }, s);
        const t = svg('text', { x: W - m.r - 2, y: sy(spec.goal.y) - 6, 'text-anchor': 'end', class: 'ch-end' }, s); t.textContent = spec.goal.label;
      }
      wrap.insertBefore(s, F.tip);
      function show(i) {
        idx = Math.max(0, Math.min(n - 1, i)); bar.forEach(b => b && b.classList.remove('on'));
        if (bar[idx]) bar[idx].classList.add('on');
        const p = spec.pts[idx]; F.tip.innerHTML = '';
        F.tip.appendChild(h('div', { class: 'tip-x' }, p.tip || p.label));
        F.tip.appendChild(h('div', { class: 'tip-row' }, h('strong', null, fmt(p.y, spec.decimals) + (spec.unit ? ' ' + spec.unit : '')), spec.goal ? h('span', { class: 'muted' }, p.y >= spec.goal.y ? 'Meta cumplida' : 'Bajo la meta') : null));
        placeTip(F.tip, wrap, m.l + slot * (idx + .5), W);
      }
      const hide = () => { bar.forEach(b => b && b.classList.remove('on')); F.tip.hidden = true; };
      const hit = svg('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: 'transparent' }, s);
      const near = ev => Math.floor((ev.clientX - s.getBoundingClientRect().left - m.l) / slot);
      hit.addEventListener('pointermove', ev => show(near(ev))); hit.addEventListener('pointerdown', ev => show(near(ev))); hit.addEventListener('pointerleave', hide);
      wrap.onkeydown = ev => { if (ev.key === 'ArrowRight') { show(idx + 1); ev.preventDefault(); } else if (ev.key === 'ArrowLeft') { show(idx - 1); ev.preventDefault(); } else if (ev.key === 'Escape') hide(); };
      wrap.onfocus = () => show(n - 1); wrap.onblur = hide;
    }
    draw();
    dataTable(host, ['Día', (spec.name || 'Valor') + (spec.unit ? ' (' + spec.unit + ')' : '')], spec.pts.slice().reverse().map(p => [p.tip || p.label, fmt(p.y, spec.decimals)]));
    return track(host, draw);
  }

  /* Redibuja al cambiar el ancho; destroyAll() corta los observadores al cambiar de pantalla */
  function track(host, draw) {
    let last = 0, raf = 0, ro = null;
    if (root.ResizeObserver) {
      ro = new ResizeObserver(() => { const w = host.clientWidth; if (Math.abs(w - last) < 4) return; last = w; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (host.isConnected) draw(); }); });
      last = host.clientWidth; ro.observe(host);
    }
    const c = { destroy: () => { if (ro) ro.disconnect(); } };
    live.push(c); return c;
  }
  const destroyAll = () => { live.splice(0).forEach(c => c.destroy()); };

  A.charts = { line, bars, destroyAll, niceTicks };
})(window);
