// Shared interface pieces: buttons, dialogs, the mascot, small widgets.

import { h, s, icon, r2 } from './dom.js';
import { symbolSvg } from './notation.js';
import { clamp } from './util.js';

/** the outline of a guitar pick — used for the mascot and the lesson buttons on the map */
export const PICK_PATH = 'M50 105C41 105 13 63 8 39 3 14 24 5 50 5s47 9 42 34C87 63 59 105 50 105Z';

/**
 * Plec, the pick.  mood: 'happy' | 'cheer' | 'sad' | 'think' | 'wink'
 */
export function mascot(mood = 'happy', cls = '') {
  const eye = (cx, dx = 0, dy = 0) => [
    s('ellipse', { class: 'mascot-eye', cx, cy: 44, rx: 8, ry: 10 }),
    s('circle', { class: 'mascot-pupil', cx: cx + dx, cy: 46 + dy, r: 4.2 }),
  ];
  const shut = (cx) => s('path', { class: 'mascot-line', d: `M${cx - 8} 48Q${cx} 37 ${cx + 8} 48` });
  const line = (d) => s('path', { class: 'mascot-line', d });
  const face = {
    happy: [eye(36), eye(64), line('M38 66Q50 78 62 66')],
    cheer: [shut(36), shut(64), s('path', { class: 'mascot-mouth', d: 'M37 63Q50 86 63 63Z' })],
    sad: [eye(36, 0, 3), eye(64, 0, 3), line('M39 75Q50 65 61 75'), line('M27 34L42 29'), line('M73 34L58 29')],
    think: [eye(36, 2, -3), eye(64, 2, -3), line('M42 70H58'), line('M56 29L72 26')],
    wink: [shut(36), eye(64), line('M38 66Q50 78 62 66')],
  }[mood] || [];
  return s('svg', { class: cls ? `mascot ${cls}` : 'mascot', viewBox: '0 0 100 114', 'aria-hidden': 'true' },
    s('path', { class: 'mascot-shadow', d: PICK_PATH, transform: 'translate(0 5)' }),
    s('path', { class: 'mascot-body', d: PICK_PATH }),
    s('path', { class: 'mascot-shine', d: 'M19 27C25 16 37 11 52 11' }),
    s('circle', { class: 'mascot-cheek', cx: 24, cy: 61, r: 5 }),
    s('circle', { class: 'mascot-cheek', cx: 76, cy: 61, r: 5 }),
    face);
}

/** kind: 'primary' | 'soft' | 'ghost' | 'good' | 'bad' */
export function button(label, { kind = 'primary', icon: ic, onclick, cls, disabled, title, attrs } = {}) {
  return h('button', { class: ['btn', `btn-${kind}`, cls], type: 'button', onclick, disabled, title, 'aria-label': label == null ? title : null, ...attrs },
    ic ? icon(ic) : null, label != null ? h('span', { class: 'btn-label' }, label) : null);
}

/** a note name with a properly drawn sharp or flat: "F#", "Bb", "E" */
export function noteLabel(nameId, cls = '') {
  const kind = nameId.length > 1 ? (nameId.endsWith('#') ? 'sharp' : 'flat') : null;
  const el = h('span', { class: cls ? `note-name ${cls}` : 'note-name', 'aria-label': kind ? `${nameId[0]} ${kind}` : nameId[0] }, nameId[0]);
  if (kind) {
    const glyph = symbolSvg(kind, { sp: 6 });
    glyph.setAttribute('class', 'acc');
    el.append(glyph);
  }
  return el;
}

/** a circular progress ring with content in the middle */
export function ring(fraction, { size = 44, stroke = 6, cls = '' } = {}, ...inside) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, mid = size / 2;
  return h('span', { class: cls ? `ring ${cls}` : 'ring', style: { width: `${size}px`, height: `${size}px` } },
    s('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, 'aria-hidden': 'true' },
      s('circle', { class: 'ring-track', cx: mid, cy: mid, r: r2(r), fill: 'none', 'stroke-width': stroke }),
      s('circle', {
        class: 'ring-fill', cx: mid, cy: mid, r: r2(r), fill: 'none', 'stroke-width': stroke, 'stroke-linecap': 'round',
        'stroke-dasharray': `${r2(c * clamp(fraction, 0, 1))} ${r2(c)}`, transform: `rotate(-90 ${mid} ${mid})`,
      })),
    h('span', { class: 'ring-in' }, inside));
}

export function stars(count, cls = '') {
  return h('span', { class: cls ? `stars ${cls}` : 'stars', role: 'img', 'aria-label': `${count} of 3 stars` },
    [1, 2, 3].map((i) => icon('star', i <= count ? 'star-on' : 'star-off')));
}

/**
 * A dialog.  `actions` may be an array of nodes or a function (close) => nodes.
 * Returns {el, close}.
 */
export function modal({ title, body, actions, onClose, cls, dismissable = true }) {
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    document.removeEventListener('keydown', onKey);
    wrap.remove();
    if (onClose) onClose();
  };
  const onKey = (ev) => { if (ev.key === 'Escape' && dismissable) { ev.stopPropagation(); close(); } };
  const acts = typeof actions === 'function' ? actions(close) : actions;
  const wrap = h('div', { class: 'modal-wrap', onclick: (ev) => { if (ev.target === wrap && dismissable) close(); } },
    h('div', { class: ['modal', cls], role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' },
      title ? h('h2', { class: 'modal-title' }, title) : null,
      h('div', { class: 'modal-body' }, body),
      acts && acts.length ? h('div', { class: 'modal-actions' }, acts) : null));
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  return { el: wrap, close };
}

/** ask a yes/no question; resolves true or false */
export function confirmDialog({ title, text, yes = 'Yes', no = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    modal({
      title, body: h('p', null, text), onClose: () => resolve(answer),
      actions: (close) => [
        button(no, { kind: 'soft', onclick: close }),
        button(yes, { kind: danger ? 'bad' : 'primary', onclick: () => { answer = true; close(); } }),
      ],
    });
  });
}

export function toast(text, { icon: ic, ms = 2600 } = {}) {
  let host = document.querySelector('.toasts');
  if (!host) { host = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.append(host); }
  const el = h('div', { class: 'toast' }, ic ? icon(ic) : null, h('span', null, text));
  host.append(el);
  setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 320); }, ms);
}

/** a burst of confetti that cleans up after itself */
export function confetti(host = document.body, count = 44) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#f08a24', '#1f9d63', '#4f8ef7', '#e25fa2', '#f6c343', '#12a594'];
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    box.append(h('i', {
      style: {
        '--x': `${(Math.random() * 100).toFixed(1)}%`, '--drift': `${((Math.random() - 0.5) * 180).toFixed(0)}px`,
        '--delay': `${(Math.random() * 0.45).toFixed(2)}s`, '--dur': `${(1.7 + Math.random() * 1.4).toFixed(2)}s`,
        '--spin': `${(Math.random() * 900 - 450).toFixed(0)}deg`, background: colors[i % colors.length],
      },
    }));
  }
  host.append(box);
  setTimeout(() => box.remove(), 3800);
}

/** a row of mutually exclusive choices */
export function segmented(options, value, onChange, label) {
  const wrap = h('div', { class: 'segmented', role: 'group', 'aria-label': label });
  const paint = (v) => { for (const b of wrap.children) b.setAttribute('aria-pressed', String(b.dataset.value === String(v))); };
  for (const o of options) {
    wrap.append(h('button', { type: 'button', dataset: { value: o.value }, onclick: () => { paint(o.value); onChange(o.value); } }, o.label));
  }
  paint(value);
  return wrap;
}

/** an on/off switch */
export function toggle(checked, onChange, label) {
  const el = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(Boolean(checked)), 'aria-label': label },
    h('span', { class: 'switch-knob' }));
  el.addEventListener('click', () => {
    const next = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return el;
}
