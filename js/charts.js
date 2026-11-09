// Progress charts for the stats screen. Each is a pure function returning an SVG string (or an empty-state
// <p>), sized by viewBox so it scales to its container. Colour only in strokes and text; hairline axes.

import { weeklySeries } from './stats.js';
import { noteColor, solfegeName } from './data.js';

const W = 320;
const ACCENT = '#c8ff2e';
const AXIS = 'stroke:var(--line-2,#3d3d3d);stroke-width:1;fill:none';
const TXT = 'font:9px ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;fill:var(--muted,#8a8a8a)';
export const MIN_WEEK_ANSWERS = 5; // weeks with fewer answers are drawn dotted and thin
export const MIN_NOTE_ANSWERS = 3; // a note needs this many answers in a week to get a sparkline point

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (x) => Math.round(x * 10) / 10;
const empty = (msg) => `<p class="chart-empty">${esc(msg)}</p>`;
const svg = (h, label, body) =>
  `<svg class="chart" viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2024-03-04" → "4 Mar". */
const weekLabel = (k) => { const [, m, d] = k.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

const PAD = { l: 30, r: 8, t: 8, b: 20 };
/** x of week i of n inside the plot. One week sits in the middle. */
const xAt = (i, n) => (n <= 1 ? PAD.l + (W - PAD.l - PAD.r) / 2 : PAD.l + ((W - PAD.l - PAD.r) * i) / (n - 1));

/** First, last and (when there is room) middle week labels along the bottom. */
function xLabels(series, h) {
  const n = series.length;
  const idx = n === 1 ? [0] : n < 6 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];
  return idx.map((i) => {
    const anchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    const x = n === 1 ? xAt(0, 1) : i === 0 ? PAD.l : i === n - 1 ? W - PAD.r : xAt(i, n);
    return `<text x="${r1(x)}" y="${h - 5}" text-anchor="${anchor}" style="${TXT}">${weekLabel(series[i].week)}</text>`;
  }).join('');
}

/**
 * Line through points [{x, y, thin}] given by week index `i`. Consecutive weeks are joined; a segment
 * touching a thin week is dotted and thinner; weeks with no neighbours are drawn as dots.
 */
function line(pts, color, width = 2) {
  const byIdx = new Map(pts.map((p) => [p.i, p]));
  let out = '';
  for (const p of pts) {
    const nx = byIdx.get(p.i + 1);
    const joined = nx || byIdx.get(p.i - 1);
    if (nx) {
      const sparse = p.thin || nx.thin;
      out += `<line x1="${r1(p.x)}" y1="${r1(p.y)}" x2="${r1(nx.x)}" y2="${r1(nx.y)}" stroke="${color}" stroke-width="${sparse ? 1 : width}" stroke-linecap="round"${sparse ? ' stroke-dasharray="1 3"' : ''}/>`;
    }
    if (!joined) out += `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="${p.thin ? 1.5 : width + 0.5}" fill="${color}"/>`;
  }
  return out;
}

const frame = (h) => `<path d="M${PAD.l} ${PAD.t}V${h - PAD.b}H${W - PAD.r}" style="${AXIS}"/>`;
const yLabel = (y, text) => `<text x="${PAD.l - 5}" y="${r1(y + 3)}" text-anchor="end" style="${TXT}">${text}</text>`;

/** #40: weekly first-try accuracy, 0–100%. */
export function accuracyChart(series) {
  const weeks = series || [];
  if (!weeks.some((w) => w.acc != null)) return empty('Accuracy by week appears after your first answers.');
  const h = 140;
  const yOf = (v) => PAD.t + (h - PAD.t - PAD.b) * (1 - v);
  const n = weeks.length;
  const pts = [];
  weeks.forEach((w, i) => { if (w.acc != null) pts.push({ i, x: xAt(i, n), y: yOf(w.acc), thin: w.n < MIN_WEEK_ANSWERS }); });
  const last = [...weeks].reverse().find((w) => w.acc != null);
  const label = `Weekly first-try accuracy over ${n} week${n === 1 ? '' : 's'}; latest ${Math.round(last.acc * 100)} percent on ${last.n} answers. Dotted lines mark weeks with fewer than ${MIN_WEEK_ANSWERS} answers.`;
  return svg(h, label, frame(h) + [0, 0.5, 1].map((v) => yLabel(yOf(v), `${v * 100}%`)).join('') + xLabels(weeks, h) + line(pts, ACCENT));
}

/** #42: weekly median response time in seconds. */
export function responseChart(series) {
  const weeks = series || [];
  if (!weeks.some((w) => w.medianMs != null)) return empty('Response times appear once answers have been timed.');
  const h = 140;
  const n = weeks.length;
  const top = Math.max(2, Math.ceil(Math.max(...weeks.map((w) => (w.medianMs || 0) / 1000))));
  const yOf = (v) => PAD.t + (h - PAD.t - PAD.b) * (1 - v / top);
  const pts = [];
  weeks.forEach((w, i) => { if (w.medianMs != null) pts.push({ i, x: xAt(i, n), y: yOf(w.medianMs / 1000), thin: w.n < MIN_WEEK_ANSWERS }); });
  const last = [...weeks].reverse().find((w) => w.medianMs != null);
  const label = `Weekly median response time over ${n} week${n === 1 ? '' : 's'}; latest ${(last.medianMs / 1000).toFixed(1)} seconds. Lower is faster.`;
  return svg(h, label, frame(h) + yLabel(yOf(0), '0s') + yLabel(yOf(top), `${top}s`) + xLabels(weeks, h) + line(pts, ACCENT));
}

/** #43: notes answered per week as thin bars. */
export function volumeChart(series) {
  const weeks = series || [];
  if (!weeks.some((w) => w.n > 0)) return empty('Notes per week appear after your first answers.');
  const h = 120;
  const n = weeks.length;
  const max = Math.max(...weeks.map((w) => w.n));
  const yOf = (v) => PAD.t + (h - PAD.t - PAD.b) * (1 - v / max);
  const bw = Math.max(1, Math.min(8, ((W - PAD.l - PAD.r) / n) * 0.5));
  const bars = weeks.map((w, i) => (w.n
    ? `<rect x="${r1(xAt(i, n) - bw / 2)}" y="${r1(yOf(w.n))}" width="${r1(bw)}" height="${r1(h - PAD.b - yOf(w.n))}" fill="${ACCENT}"/>`
    : '')).join('');
  const total = weeks.reduce((s, w) => s + w.n, 0);
  const label = `Notes answered per week over ${n} week${n === 1 ? '' : 's'}; ${total} in total, busiest week ${max}.`;
  return svg(h, label, frame(h) + yLabel(yOf(max), max) + yLabel(yOf(0), 0) + xLabels(weeks, h) + bars);
}

/** #41: one sparkline of weekly accuracy per note played, two per row, stroked in the note's colour. */
export function noteSparklines(series) {
  const weeks = series || [];
  const notes = [...new Set(weeks.flatMap((w) => Object.keys(w.heard).map(Number)))].sort((a, b) => a - b);
  if (!notes.length) return empty('Per-note trends appear after your first answers.');
  const cw = 150; // cell width
  const gap = W - 2 * cw;
  const rh = 46;
  const h = Math.ceil(notes.length / 2) * rh;
  const n = weeks.length;
  const px0 = 40; // plot starts this far into a cell
  const pw = cw - px0 - 4;
  let body = '';
  const summary = [];
  notes.forEach((note, k) => {
    const x0 = (k % 2) * (cw + gap);
    const y0 = Math.floor(k / 2) * rh;
    const color = noteColor(note);
    const yOf = (v) => y0 + 6 + 28 * (1 - v);
    const pts = [];
    let latest = null;
    weeks.forEach((w, i) => {
      if (!(w.heard[note] >= MIN_NOTE_ANSWERS)) return;
      const v = (w.correct[note] || 0) / w.heard[note];
      latest = v;
      pts.push({ i, x: x0 + px0 + (n <= 1 ? pw / 2 : (pw * i) / (n - 1)), y: yOf(v), thin: false });
    });
    const pct = latest == null ? '–' : `${Math.round(latest * 100)}%`;
    summary.push(`${solfegeName(note)} ${pct}`);
    body += `<text x="${x0}" y="${y0 + 16}" style="font:700 12px ui-monospace,Menlo,monospace;fill:${color}">${esc(solfegeName(note))}</text>`
      + `<text x="${x0}" y="${y0 + 30}" style="${TXT}">${pct}</text>`
      + `<path d="M${x0 + px0} ${y0 + 6}V${y0 + 34}H${x0 + cw - 4}" style="${AXIS}"/>`
      + line(pts, color, 1.5);
  });
  const label = `Weekly first-try accuracy per note over ${n} week${n === 1 ? '' : 's'}; latest: ${summary.join(', ')}.`;
  return svg(h, label, body);
}

/** All four charts for the stats screen, as one HTML string. */
export function progressHTML(agg, now) {
  const s = weeklySeries(agg, now);
  const block = (title, chart) => `<div class="chartblock"><h3 class="sub">${title}</h3>${chart}</div>`;
  return [
    block('Accuracy per week', accuracyChart(s)),
    block('By note', noteSparklines(s)),
    block('Median response time', responseChart(s)),
    block('Notes per week', volumeChart(s)),
  ].join('');
}
