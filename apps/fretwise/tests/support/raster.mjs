// A compact SVG rasteriser used only for visual checks from the test suite.
// It walks a (fake-dom) <svg> element tree, applies the real app stylesheet for
// the handful of properties that matter (fill, stroke, colour, opacity, custom
// properties) and writes a PNG.  It supports the SVG subset the app generates:
// path (all commands), rect, circle, ellipse, line, polyline, polygon, text
// (drawn with a tiny built-in pixel font), groups and transforms.

import zlib from 'node:zlib';
import { FElement } from './fake-dom.mjs';

// ---------------------------------------------------------------------------
// Stylesheet (very small CSS subset)
// ---------------------------------------------------------------------------
export function parseCss(text, { theme = 'light', width = 390 } = {}) {
  const rules = []; // {selector, decls: Map, order}
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  let order = 0;
  const mediaMatches = (query) => query.split(',').some((q) => q.split(/\band\b/).every((part) => {
    const p = part.trim();
    let m;
    if (/^(screen|all)$/.test(p) || p === '') return true;
    if ((m = /prefers-color-scheme:\s*(\w+)/.exec(p))) return m[1] === theme;
    if ((m = /min-width:\s*([\d.]+)px/.exec(p))) return width >= Number(m[1]);
    if ((m = /max-width:\s*([\d.]+)px/.exec(p))) return width <= Number(m[1]);
    if (/prefers-reduced-motion|hover|pointer|orientation|min-height|max-height|display-mode/.test(p)) return false;
    return false;
  }));
  const parseBlock = (body) => {
    let i = 0;
    while (i < body.length) {
      const open = body.indexOf('{', i);
      if (open < 0) break;
      const head = body.slice(i, open).trim();
      let depth = 1, j = open + 1;
      for (; j < body.length && depth > 0; j++) { if (body[j] === '{') depth++; else if (body[j] === '}') depth--; }
      const inner = body.slice(open + 1, j - 1);
      i = j;
      if (head.startsWith('@media')) { if (mediaMatches(head.slice(6))) parseBlock(inner); continue; }
      if (head.startsWith('@supports')) { parseBlock(inner); continue; }
      if (head.startsWith('@')) continue; // @font-face, @keyframes ...
      const decls = new Map();
      for (const part of inner.split(';')) {
        const k = part.indexOf(':');
        if (k > 0) decls.set(part.slice(0, k).trim(), part.slice(k + 1).trim().replace(/\s*!important$/, ''));
      }
      for (const selector of head.split(',')) rules.push({ selector: selector.trim(), decls, order: order++ });
    }
  };
  parseBlock(src);
  return rules;
}

const INHERITED = new Set(['fill', 'stroke', 'stroke-width', 'color', 'fill-opacity', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'font-size', 'text-anchor', 'fill-rule', 'visibility', 'font-weight', 'dominant-baseline']);
const PRESENTATION = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'font-size', 'text-anchor', 'fill-rule', 'color', 'display', 'visibility', 'dominant-baseline'];

function specificity(selector) {
  return (selector.match(/#[\w-]+/g) || []).length * 100 + (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!not)[\w-]+/g) || []).length * 10 +
    (selector.match(/(^|[\s>])[a-zA-Z]/g) || []).length;
}

function makeStyler(rules, rootEl, theme) {
  // :root custom properties act as globals
  const usable = [];
  const globals = new Map();
  for (const rule of rules) {
    const sel = rule.selector;
    const rootTheme = /^(:root|html)\[data-theme="?(\w+)"?\]$/.exec(sel);
    if (sel === ':root' || sel === 'html' || sel === 'body' || (rootTheme && rootTheme[2] === theme)) {
      for (const [k, v] of rule.decls) if (k.startsWith('--') || k === 'color') globals.set(k, v);
      continue;
    }
    if (/::|:(hover|active|focus|focus-visible|disabled|checked|root|is|where|has|nth|before|after)/.test(sel)) continue;
    try { rootEl.matches(sel); usable.push({ ...rule, spec: specificity(sel) }); } catch { /* selector not supported by the fake DOM */ }
  }
  usable.sort((a, b) => a.spec - b.spec || a.order - b.order);

  return function computed(el, parentStyle) {
    const style = new Map();
    if (parentStyle) {
      for (const [k, v] of parentStyle) if (INHERITED.has(k) || k.startsWith('--')) style.set(k, v);
    } else {
      for (const [k, v] of globals) style.set(k, v);
    }
    for (const name of PRESENTATION) { const v = el.getAttribute(name); if (v !== null) style.set(name, v); }
    for (const rule of usable) if (el.matches(rule.selector)) for (const [k, v] of rule.decls) style.set(k, v);
    for (const [k, v] of el._style) style.set(k, v);
    return style;
  };
}

function resolveVars(value, style, depth = 0) {
  if (typeof value !== 'string' || !value.includes('var(') || depth > 8) return value;
  return resolveVars(value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (m, name, fallback) => style.get(name) ?? fallback ?? ''), style, depth + 1);
}

const NAMED = { black: '#000000', white: '#ffffff', red: '#ff0000', gray: '#808080', grey: '#808080', transparent: '#00000000' };
function parseColor(value, style) {
  let v = resolveVars(String(value ?? '').trim(), style);
  if (!v || v === 'none') return null;
  if (v === 'currentColor' || v === 'currentcolor') v = resolveVars(style.get('color') || '#000', style);
  if (v.startsWith('url(')) return [128, 128, 128, 1];
  if (NAMED[v]) v = NAMED[v];
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/i.exec(v))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  if ((m = /^rgba?\(([^)]+)\)$/.exec(v))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map((x) => (x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x)));
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : (m[1].includes('%') && p[3] > 1 ? p[3] / 255 : p[3])];
  }
  if ((m = /^color-mix\(/.exec(v))) return [128, 128, 128, 1];
  return [255, 0, 255, 1]; // unknown colours show up as magenta so they get noticed
}
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function parseTransform(text) {
  let m = [1, 0, 0, 1, 0, 0];
  for (const [, fn, args] of String(text || '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (fn === 'translate') m = mul(m, [1, 0, 0, 1, a[0], a[1] || 0]);
    else if (fn === 'scale') m = mul(m, [a[0], 0, 0, a[1] ?? a[0], 0, 0]);
    else if (fn === 'rotate') {
      const r = (a[0] * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      if (a.length > 1) m = mul(m, [1, 0, 0, 1, a[1], a[2]]);
      m = mul(m, [c, s, -s, c, 0, 0]);
      if (a.length > 1) m = mul(m, [1, 0, 0, 1, -a[1], -a[2]]);
    } else if (fn === 'matrix') m = mul(m, a);
    else throw new Error('raster: unsupported transform ' + fn);
  }
  return m;
}

/** SVG path data -> list of subpaths, each {points: [[x,y]...], closed} */
export function flattenPath(d) {
  const tokens = String(d).match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const subpaths = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, i = 0, cmd = '', px = 0, py = 0, prev = '';
  const n = () => { if (i >= tokens.length || /[a-zA-Z]/.test(tokens[i])) throw new Error(`raster: path data ended early in "${String(d).slice(0, 40)}…"`); return Number(tokens[i++]); };
  const start = (nx, ny) => { cur = { points: [[nx, ny]], closed: false }; subpaths.push(cur); x = sx = nx; y = sy = ny; };
  const line = (nx, ny) => { if (!cur) start(x, y); cur.points.push([nx, ny]); x = nx; y = ny; };
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    const steps = Math.max(6, Math.min(40, Math.ceil((Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)) / 2)));
    const x0 = x, y0 = y;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      line(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
    }
  };
  const arc = (rx, ry, rot, large, sweep, x2, y2) => {
    const x1 = x, y1 = y;
    if (!rx || !ry || (x1 === x2 && y1 === y2)) { line(x2, y2); return; }
    rx = Math.abs(rx); ry = Math.abs(ry);
    const phi = (rot * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const xp = c * dx + s * dy, yp = -s * dx + c * dy;
    const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const sign = large !== sweep ? 1 : -1;
    const q = Math.max(0, rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp);
    const k = sign * Math.sqrt(q);
    const cxp = (k * rx * yp) / ry, cyp = (-k * ry * xp) / rx;
    const cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
    const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
    const steps = Math.max(6, Math.ceil(Math.abs(dt) / (Math.PI / 16)));
    for (let j = 1; j <= steps; j++) {
      const t = t1 + (dt * j) / steps;
      line(c * rx * Math.cos(t) - s * ry * Math.sin(t) + cx, s * rx * Math.cos(t) + c * ry * Math.sin(t) + cy);
    }
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    else if (cmd === 'M') cmd = 'L'; else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': start(ox + n(), oy + n()); break;
      case 'L': line(ox + n(), oy + n()); break;
      case 'H': line(ox + n(), y); break;
      case 'V': line(x, oy + n()); break;
      case 'C': { const a = [n(), n(), n(), n(), n(), n()]; px = ox + a[2]; py = oy + a[3]; cubic(ox + a[0], oy + a[1], px, py, ox + a[4], oy + a[5]); break; }
      case 'S': {
        const rx = /[CS]/i.test(prev) ? 2 * x - px : x, ry = /[CS]/i.test(prev) ? 2 * y - py : y;
        const a = [n(), n(), n(), n()]; px = ox + a[0]; py = oy + a[1]; cubic(rx, ry, px, py, ox + a[2], oy + a[3]); break;
      }
      case 'Q': {
        const a = [n(), n(), n(), n()]; px = ox + a[0]; py = oy + a[1];
        const ex = ox + a[2], ey = oy + a[3];
        cubic(x + (2 / 3) * (px - x), y + (2 / 3) * (py - y), ex + (2 / 3) * (px - ex), ey + (2 / 3) * (py - ey), ex, ey); break;
      }
      case 'T': {
        px = /[QT]/i.test(prev) ? 2 * x - px : x; py = /[QT]/i.test(prev) ? 2 * y - py : y;
        const ex = ox + n(), ey = oy + n();
        cubic(x + (2 / 3) * (px - x), y + (2 / 3) * (py - y), ex + (2 / 3) * (px - ex), ey + (2 / 3) * (py - ey), ex, ey); break;
      }
      case 'A': { const a = [n(), n(), n(), n(), n(), n(), n()]; arc(a[0], a[1], a[2], a[3] !== 0, a[4] !== 0, ox + a[5], oy + a[6]); break; }
      case 'Z': if (cur) { cur.closed = true; x = sx; y = sy; cur = null; } break;
      default: throw new Error('raster: unsupported path command ' + cmd);
    }
    prev = cmd;
  }
  return subpaths;
}

function ellipsePoints(cx, cy, rx, ry, n = 48) {
  return Array.from({ length: n }, (_, k) => [cx + rx * Math.cos((2 * Math.PI * k) / n), cy + ry * Math.sin((2 * Math.PI * k) / n)]);
}
function rectPoints(x, y, w, h, rx, ry) {
  if (!(rx > 0) && !(ry > 0)) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  rx = Math.min(rx || ry, w / 2); ry = Math.min(ry || rx, h / 2);
  const pts = [];
  const corner = (cx, cy, a0) => { for (let k = 0; k <= 8; k++) { const a = a0 + (Math.PI / 2) * (k / 8); pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } };
  corner(x + w - rx, y + ry, -Math.PI / 2); corner(x + w - rx, y + h - ry, 0); corner(x + rx, y + h - ry, Math.PI / 2); corner(x + rx, y + ry, Math.PI);
  return pts;
}

/** outline of a stroked polyline as a list of polygons (quads + round joins/caps) */
function strokePolys(points, closed, width, cap) {
  const polys = [];
  const hw = width / 2;
  const pts = closed ? [...points, points[0]] : points;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-9) continue;
    const nx = (-(y1 - y0) / len) * hw, ny = ((x1 - x0) / len) * hw;
    let ex = 0, ey = 0;
    if (cap === 'square' && !closed) { ex = ((x1 - x0) / len) * hw; ey = ((y1 - y0) / len) * hw; }
    const a = k === 0 ? [x0 - ex, y0 - ey] : [x0, y0], b = k === pts.length - 2 ? [x1 + ex, y1 + ey] : [x1, y1];
    polys.push([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
  }
  const joints = closed ? points : cap === 'round' ? points : points.slice(1, -1);
  if (hw > 0.6) for (const [jx, jy] of joints) polys.push(ellipsePoints(jx, jy, hw, hw, 16));
  return polys;
}

// ---------------------------------------------------------------------------
// Pixel font for <text> (5x7, upper case)
// ---------------------------------------------------------------------------
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [30, 1, 1, 14, 1, 1, 30], 4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '+': [0, 4, 4, 31, 4, 4, 0], '-': [0, 0, 0, 31, 0, 0, 0], '&': [12, 18, 20, 8, 21, 18, 13], '#': [10, 10, 31, 10, 31, 10, 10], '♯': [10, 10, 31, 10, 31, 10, 10],
  '♭': [16, 16, 22, 25, 17, 17, 30], '/': [1, 1, 2, 4, 8, 16, 16], '.': [0, 0, 0, 0, 0, 12, 12], ':': [0, 12, 12, 0, 12, 12, 0], '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4], ' ': [0, 0, 0, 0, 0, 0, 0], '=': [0, 0, 31, 0, 31, 0, 0], ',': [0, 0, 0, 0, 12, 4, 8], "'": [4, 4, 0, 0, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], '%': [24, 25, 2, 4, 8, 19, 3], '×': [0, 17, 10, 4, 10, 17, 0], '♩': [2, 2, 2, 2, 14, 30, 12],
};
function textPolys(text, x, y, size, anchor) {
  const unit = size / 9; // glyph cell is 5x7 units, cap height ~0.78em
  const advance = 6 * unit;
  const chars = [...String(text)];
  const total = chars.length * advance - unit;
  let cx = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  const polys = [];
  for (const ch of chars) {
    const rows = FONT[ch] || FONT[ch.toUpperCase()];
    if (!rows) {
      const t = unit * 0.6; // unknown glyph: hollow box
      polys.push([[cx, y - 7 * unit], [cx + 5 * unit, y - 7 * unit], [cx + 5 * unit, y], [cx, y], [cx, y - 7 * unit],
        [cx + t, y - 7 * unit + t], [cx + t, y - t], [cx + 5 * unit - t, y - t], [cx + 5 * unit - t, y - 7 * unit + t], [cx + t, y - 7 * unit + t]]);
    } else {
      rows.forEach((bits, r) => {
        for (let c = 0; c < 5; c++) if (bits & (16 >> c)) {
          const px = cx + c * unit, py = y - (7 - r) * unit;
          polys.push([[px, py], [px + unit, py], [px + unit, py + unit], [px, py + unit]]);
        }
      });
    }
    cx += advance;
  }
  return polys;
}

// ---------------------------------------------------------------------------
// Scan conversion
// ---------------------------------------------------------------------------
function fillPolys(img, polys, color, rule = 'nonzero') {
  if (!color || color[3] <= 0) return;
  const { w, h, data } = img;
  const edges = [];
  let minY = Infinity, maxY = -Infinity;
  for (const poly of polys) {
    for (let k = 0; k < poly.length; k++) {
      const [x0, y0] = poly[k], [x1, y1] = poly[(k + 1) % poly.length];
      if (!Number.isFinite(x0 + y0 + x1 + y1) || y0 === y1) continue;
      const down = y1 > y0;
      edges.push({ ya: down ? y0 : y1, yb: down ? y1 : y0, xa: down ? x0 : x1, slope: (x1 - x0) / (y1 - y0), dir: down ? 1 : -1 });
      minY = Math.min(minY, y0, y1); maxY = Math.max(maxY, y0, y1);
    }
  }
  if (!edges.length) return;
  const [r, g, b, a] = color;
  const y0 = Math.max(0, Math.ceil(minY - 0.5)), y1 = Math.min(h - 1, Math.floor(maxY - 0.5));
  const xs = [];
  for (let py = y0; py <= y1; py++) {
    const yc = py + 0.5;
    xs.length = 0;
    for (const e of edges) if (yc >= e.ya && yc < e.yb) xs.push([e.xa + (yc - e.ya) * e.slope, e.dir]);
    if (xs.length < 2) continue;
    xs.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let k = 0; k + 1 < xs.length; k++) {
      wind += xs[k][1];
      const inside = rule === 'evenodd' ? (k + 1) % 2 === 1 : wind !== 0;
      if (!inside) continue;
      const xa = Math.max(0, Math.ceil(xs[k][0] - 0.5)), xb = Math.min(w - 1, Math.ceil(xs[k + 1][0] - 0.5) - 1);
      for (let px = xa, o = (py * w + xa) * 4; px <= xb; px++, o += 4) {
        data[o] = r * a + data[o] * (1 - a);
        data[o + 1] = g * a + data[o + 1] * (1 - a);
        data[o + 2] = b * a + data[o + 2] * (1 - a);
        data[o + 3] = 255 * a + data[o + 3] * (1 - a);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
/**
 * Render an <svg> element.  Options:
 *   scale       device pixels per SVG user unit (default 2)
 *   css         stylesheet text (the app's CSS)
 *   theme       'light' | 'dark'
 *   background  page colour behind the drawing
 *   contextClasses  class names of pretend ancestors (e.g. ['lesson']) so descendant selectors match
 */
export function renderSvg(svgEl, { scale = 2, css = '', theme = 'light', background = '#ffffff', ss = 3, contextClasses = [] } = {}) {
  if (!(svgEl instanceof FElement) || svgEl.localName !== 'svg') throw new Error('renderSvg needs an <svg> element');
  const vb = (svgEl.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const [vx, vy, vw, vh] = vb.length === 4 ? vb : [0, 0, num(svgEl.getAttribute('width'), 300), num(svgEl.getAttribute('height'), 150)];
  const W = Math.ceil(vw * scale), H = Math.ceil(vh * scale);
  const img = { w: W * ss, h: H * ss, data: new Float32Array(W * ss * H * ss * 4) };
  const bg = parseColor(background, new Map());
  for (let o = 0; o < img.data.length; o += 4) { img.data[o] = bg[0]; img.data[o + 1] = bg[1]; img.data[o + 2] = bg[2]; img.data[o + 3] = 255; }

  // give the svg pretend ancestors so rules like ".lesson .staff" can match
  let root = svgEl;
  const originalParent = svgEl.parentNode;
  let wrapper = null;
  if (!originalParent && contextClasses.length) {
    wrapper = new FElement('div');
    wrapper.setAttribute('class', contextClasses.join(' '));
    wrapper.appendChild(svgEl);
    root = wrapper;
  }
  const styler = makeStyler(parseCss(css, { theme, width: 390 }), root, theme);
  const ancestors = [];
  for (let p = svgEl.parentNode; p instanceof FElement; p = p.parentNode) ancestors.unshift(p);
  let inherited = null;
  for (const a of ancestors) inherited = styler(a, inherited);

  const base = mul([scale * ss, 0, 0, scale * ss, 0, 0], [1, 0, 0, 1, -vx, -vy]);
  const draw = (el, parentStyle, matrix, opacity) => {
    const style = styler(el, parentStyle);
    if (resolveVars(style.get('display') || '', style) === 'none' || style.get('visibility') === 'hidden') return;
    const m = el.getAttribute('transform') ? mul(matrix, parseTransform(el.getAttribute('transform'))) : matrix;
    const alpha = opacity * num(resolveVars(style.get('opacity') ?? '1', style), 1);
    const tag = el.localName;
    if (tag === 'g' || tag === 'svg' || tag === 'a') { for (const c of el.children) draw(c, style, m, alpha); return; }
    if (['defs', 'title', 'desc', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'style'].includes(tag)) return;

    const A = (name, d = 0) => num(el.getAttribute(name), d);
    let subpaths = [];
    if (tag === 'path') subpaths = flattenPath(el.getAttribute('d') || '');
    else if (tag === 'rect') subpaths = [{ points: rectPoints(A('x'), A('y'), A('width'), A('height'), A('rx', NaN), A('ry', NaN)), closed: true }];
    else if (tag === 'circle') subpaths = [{ points: ellipsePoints(A('cx'), A('cy'), A('r'), A('r')), closed: true }];
    else if (tag === 'ellipse') subpaths = [{ points: ellipsePoints(A('cx'), A('cy'), A('rx'), A('ry')), closed: true }];
    else if (tag === 'line') subpaths = [{ points: [[A('x1'), A('y1')], [A('x2'), A('y2')]], closed: false }];
    else if (tag === 'polyline' || tag === 'polygon') {
      const v = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
      const pts = [];
      for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
      subpaths = [{ points: pts, closed: tag === 'polygon' }];
    } else if (tag === 'text') {
      const size = num(resolveVars(style.get('font-size') || '16', style), 16);
      const baseline = resolveVars(style.get('dominant-baseline') || el.getAttribute('dominant-baseline') || '', style);
      const dy = baseline === 'central' || baseline === 'middle' ? size * 0.36 : 0;
      const polys = textPolys(el.textContent, A('x'), A('y') + dy, size, resolveVars(style.get('text-anchor') || 'start', style));
      const fill = parseColor(style.get('fill') ?? '#000', style);
      if (fill) fillPolys(img, polys.map((p) => p.map(([px, py]) => apply(m, px, py))), [fill[0], fill[1], fill[2], fill[3] * alpha * num(resolveVars(style.get('fill-opacity') ?? '1', style), 1)], 'evenodd');
      return;
    } else throw new Error(`raster: unsupported element <${tag}>`);

    // like a browser: everything except <line> is filled black unless told otherwise
    const fill = tag === 'line' ? null : parseColor(style.get('fill') ?? '#000', style);
    if (fill) {
      const polys = subpaths.filter((sp) => sp.points.length >= 3).map((sp) => sp.points.map(([px, py]) => apply(m, px, py)));
      fillPolys(img, polys, [fill[0], fill[1], fill[2], fill[3] * alpha * num(resolveVars(style.get('fill-opacity') ?? '1', style), 1)], resolveVars(style.get('fill-rule') || 'nonzero', style));
    }
    const stroke = parseColor(style.get('stroke') ?? 'none', style);
    const sw = num(resolveVars(style.get('stroke-width') ?? '1', style), 1);
    if (stroke && sw > 0) {
      const sx = Math.hypot(m[0], m[1]);
      const cap = resolveVars(style.get('stroke-linecap') || 'butt', style);
      const col = [stroke[0], stroke[1], stroke[2], stroke[3] * alpha * num(resolveVars(style.get('stroke-opacity') ?? '1', style), 1)];
      for (const sp of subpaths) {
        const pts = sp.points.map(([px, py]) => apply(m, px, py));
        // draw the whole outline in one pass so overlapping pieces do not double-blend
        fillPolys(img, strokePolys(pts, sp.closed, sw * sx, cap).map(orient), col, 'nonzero');
      }
    }
  };
  // every stroke piece must wind the same way for the non-zero rule to union them
  function orient(poly) {
    let area = 0;
    for (let k = 0; k < poly.length; k++) { const [x0, y0] = poly[k], [x1, y1] = poly[(k + 1) % poly.length]; area += x0 * y1 - x1 * y0; }
    return area < 0 ? poly.slice().reverse() : poly;
  }
  for (const c of svgEl.children) draw(c, styler(svgEl, inherited), base, 1);
  if (wrapper) wrapper.removeChild(svgEl);

  // box-filter down to the output size
  const out = Buffer.alloc(W * H * 4);
  const n = ss * ss;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < ss; j++) for (let k = 0, o = ((y * ss + j) * img.w + x * ss) * 4; k < ss; k++, o += 4) { r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; }
    const o = (y * W + x) * 4;
    out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); out[o + 3] = 255;
  }
  return { width: W, height: H, data: out };
}

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

/** paste several rendered images into one sheet (stacked vertically, with a gap) */
export function stack(images, { gap = 12, background = [255, 255, 255] } = {}) {
  const width = Math.max(...images.map((i) => i.width));
  const height = images.reduce((a, i) => a + i.height, 0) + gap * (images.length + 1);
  const data = Buffer.alloc(width * height * 4);
  for (let o = 0; o < data.length; o += 4) { data[o] = background[0]; data[o + 1] = background[1]; data[o + 2] = background[2]; data[o + 3] = 255; }
  let y = gap;
  for (const im of images) {
    for (let r = 0; r < im.height; r++) im.data.copy(data, ((y + r) * width) * 4, r * im.width * 4, (r + 1) * im.width * 4);
    y += im.height + gap;
  }
  return { width, height, data };
}
