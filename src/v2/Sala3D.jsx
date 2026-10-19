import { useEffect, useRef } from 'react';

// Sala isométrica en canvas que se puede girar (arrastrando o con las flechas). Cada silla
// encendida es un día de espera. Es decorativa: el dato siempre va también en texto.

const hexRGB = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec((c || '').trim());
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128];
};
const rgbStr = (a, k = 1) => `rgb(${a.map((v) => Math.round(Math.max(0, Math.min(255, v * k)))).join(',')})`;
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function crearSala(canvas, o, reduce) {
  const { cols, rows } = o;
  const N = cols * rows;
  const ctx = canvas.getContext('2d');
  const cur = new Float32Array(N);
  const tgt = new Float32Array(N);
  const wait = new Float32Array(N);
  const labels = o.labels || null;
  const range = o.range == null ? Math.PI : o.range;
  const sway = !reduce;
  const pitch = 0.6;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  let W = 0; let H = 0; let dpr = 1; let s = 1; let cx0 = 0; let userYaw = 0; let drag = null;
  let raf = 0; let last = 0; let alive = true; let shown = true; let col = null; let C = 1; let S = 0;
  const order = [];
  for (let r = rows - 1; r >= 0; r--) for (let c = 0; c < cols; c++) order.push(r * cols + c);

  function colors() {
    const cs = getComputedStyle(document.documentElement);
    const g = (k) => hexRGB(cs.getPropertyValue(k));
    const bg = g('--bg');
    col = {
      amber: g('--amber'), board: mixc(bg, g('--line'), 0.5), empty: mixc(bg, g('--line-strong'), 0.55),
      fg: cs.getPropertyValue('--fg').trim(), shadow: (bg[0] + bg[1] + bg[2]) / 3 < 128 ? 0.35 : 0.16,
    };
  }
  const pr = (x, y, z) => {
    const rx = x * C - y * S; const ry = x * S + y * C;
    return [cx0 + rx * s, H * 0.57 + (ry * sp - z * cp) * s];
  };
  function poly(pts, base, k, lw) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = rgbStr(base, k); ctx.fill();
    ctx.lineJoin = 'round'; ctx.strokeStyle = rgbStr(base, k); ctx.lineWidth = Math.max(1, lw * s); ctx.stroke();
  }
  function box(x0, y0, z0, x1, y1, z1, base, lwT = 0.12, lwS = 0.12) {
    poly([pr(x0, y0, z1), pr(x1, y0, z1), pr(x1, y1, z1), pr(x0, y1, z1)], base, 1.18, lwT);
    const sides = [[1, 0, x1, y0, x1, y1], [-1, 0, x0, y1, x0, y0], [0, 1, x1, y1, x0, y1], [0, -1, x0, y0, x1, y0]];
    for (const [nx, ny, ax, ay, bx, by] of sides) {
      if (nx * S + ny * C <= 0.001) continue;
      const k = 0.7 - 0.18 * (nx * C - ny * S);
      poly([pr(ax, ay, z0), pr(bx, by, z0), pr(bx, by, z1), pr(ax, ay, z1)], base, k, lwS);
    }
  }
  function resize() {
    const b = canvas.getBoundingClientRect();
    if (!b.width) return;
    dpr = Math.min(2, window.devicePixelRatio || 1); W = b.width; H = b.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); kick();
  }
  function draw(now) {
    if (!col) colors();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const yaw = (o.yaw || 0) + userYaw + (sway && !drag ? Math.sin(now / 2800) * 0.09 : 0);
    C = Math.cos(yaw); S = Math.sin(yaw);
    const padL = labels ? (W < 420 ? 96 : 124) : 0;
    cx0 = padL + (W - padL) / 2;
    const D = Math.hypot(cols + 0.9, rows + 0.9);
    s = Math.min(((W - padL) * 0.95) / D, (H * 0.86) / (D * sp + 1.3 * cp));
    const hx = cols / 2 + 0.45; const hy = rows / 2 + 0.45; const R = 0.28;
    box(-hx + R, -hy + R, -0.3, hx - R, hy - R, 0, col.board, R * 2, 0.1);
    const list = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c; const f = cur[i]; const x = c - (cols - 1) / 2; const y = r - (rows - 1) / 2;
        const lift = f * 0.1 + (f > 0 && f < 1 ? Math.sin(f * Math.PI) * 0.2 : 0);
        list.push([x * S + y * C, x, y, lift, mixc(col.empty, col.amber, f)]);
      }
    }
    ctx.globalAlpha = col.shadow;
    for (const [, x, y] of list) {
      const e = 0.36; const d = 0.1;
      poly([pr(x - e + d, y - e + d, 0.01), pr(x + e + d, y - e + d, 0.01), pr(x + e + d, y + e + d, 0.01), pr(x - e + d, y + e + d, 0.01)], [0, 0, 0], 1, 0.1);
    }
    ctx.globalAlpha = 1;
    list.sort((a, b) => a[0] - b[0]);
    for (const [, x, y, lift, cc] of list) {
      box(x - 0.27, y - 0.27, lift, x + 0.27, y + 0.27, lift + 0.28, cc, 0.14, 0.14);
      box(x - 0.27, y - 0.27, lift + 0.28, x + 0.27, y - 0.2, lift + 0.84, cc, 0.14, 0.14);
    }
    if (labels) {
      ctx.fillStyle = col.fg; ctx.font = '700 11px "Atkinson Hyperlegible",system-ui,sans-serif'; ctx.textAlign = 'right';
      labels.forEach((t, r) => { const p = pr(-hx - 0.15, r - (rows - 1) / 2, 0); ctx.fillText(t, p[0], p[1] + 4); });
    }
  }
  function tick(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    let moving = false;
    for (let i = 0; i < N; i++) {
      if (wait[i] > 0) { wait[i] -= dt; moving = true; continue; }
      const d = tgt[i] - cur[i];
      if (Math.abs(d) > 0.003) { cur[i] += Math.sign(d) * Math.min(Math.abs(d), dt * 3.2); moving = true; } else cur[i] = tgt[i];
    }
    draw(now);
    if (shown && !document.hidden && (moving || sway || drag)) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && alive && W) raf = requestAnimationFrame(tick); }
  function setT(a) {
    let k = 0;
    for (let j = 0; j < N; j++) {
      const i = order[j];
      if (tgt[i] !== a[i]) { tgt[i] = a[i]; if (reduce) cur[i] = a[i]; else wait[i] = k++ * 0.014; }
    }
    kick();
  }
  const down = (e) => { drag = { x: e.clientX, u: userYaw }; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } canvas.style.cursor = 'grabbing'; kick(); };
  const move = (e) => { if (!drag) return; userYaw = Math.max(-range, Math.min(range, drag.u + (e.clientX - drag.x) * 0.008)); kick(); };
  const end = () => { drag = null; canvas.style.cursor = 'grab'; kick(); };
  const key = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); e.stopPropagation();
    userYaw = Math.max(-range, Math.min(range, userYaw + (e.key === 'ArrowLeft' ? -0.15 : 0.15))); kick();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', key);
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const vo = new IntersectionObserver((es) => { shown = es[0].isIntersecting; if (shown) kick(); }); vo.observe(canvas);
  const mo = new MutationObserver(() => { colors(); kick(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const onScheme = () => { colors(); kick(); };
  mq.addEventListener('change', onScheme);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);
  resize();
  return {
    fill(n) { const a = new Float32Array(N); for (let j = 0; j < N; j++) a[order[j]] = j < n ? 1 : 0; setT(a); },
    rowsV(vals) { const a = new Float32Array(N); vals.forEach((v, r) => { for (let c = 0; c < cols; c++) a[r * cols + c] = c < Math.round(v) ? 1 : 0; }); setT(a); },
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); vo.disconnect(); mo.disconnect();
      mq.removeEventListener('change', onScheme); document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('keydown', key);
    },
  };
}

/** Sala que se llena con `dias` sillas (máximo cols × rows). */
export function Sala3D({ dias, etiqueta, leyenda, cols = 6, rows = 5, yaw = 0.62, reduce }) {
  const ref = useRef(null);
  const api = useRef(null);
  useEffect(() => {
    api.current = crearSala(ref.current, { cols, rows, yaw }, reduce);
    return () => api.current.destroy();
  }, [cols, rows, yaw, reduce]);
  useEffect(() => { api.current?.fill(Math.min(Math.round(dias ?? 0), cols * rows)); }, [dias, cols, rows]);
  return (
    <div className="v-room">
      <canvas ref={ref} tabIndex={0} role="img" aria-label={etiqueta} />
      {leyenda && <p className="v-rcap">{leyenda}</p>}
    </div>
  );
}

/** Fila 3D: una fila de sillas por unidad, con su nombre a la izquierda. */
export function Fila3D({ valores, nombres, etiqueta, leyenda, cols = 10, reduce }) {
  const ref = useRef(null);
  const api = useRef(null);
  const clave = nombres.join('|');
  useEffect(() => {
    if (!nombres.length) return undefined;
    api.current = crearSala(ref.current, { cols, rows: nombres.length, yaw: 0.5, range: 0.55, labels: nombres }, reduce);
    return () => api.current.destroy();
  }, [clave, cols, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.rowsV(valores); }, [valores]);
  if (!nombres.length) return null;
  return (
    <div className="v-room v-room--tall">
      <canvas ref={ref} tabIndex={0} role="img" aria-label={etiqueta} />
      {leyenda && <p className="v-rcap">{leyenda}</p>}
    </div>
  );
}
