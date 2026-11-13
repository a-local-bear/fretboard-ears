// Tiny DOM helpers.  All UI in the app is built with h() / s() — no innerHTML —
// which keeps user-entered text (profile names) safely out of markup.

import { ICONS } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyProps(el, props, isSvg) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') {
      const cls = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
      if (cls) el.setAttribute('class', cls);
    } else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) if (v != null && v !== false) el.style.setProperty(prop, String(v));
    } else if (key === 'dataset') {
      for (const [k, v] of Object.entries(value)) if (v != null) el.dataset[k] = String(v);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (!isSvg && (key === 'value' || key === 'checked' || key === 'disabled' || key === 'hidden')) {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
}

function addChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === true) continue;
    el.append(typeof child === 'object' ? child : String(child));
  }
}

/** create an HTML element: h('button', {class: 'btn', onclick}, 'Label') */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props, false);
  addChildren(el, children);
  return el;
}

/** create an SVG element */
export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props, true);
  addChildren(el, children);
  return el;
}

/** replace the contents of a node */
export function mount(parent, ...children) {
  parent.replaceChildren();
  addChildren(parent, children);
  return parent;
}

/** an inline icon; `name` is a key of ICONS */
export function icon(name, cls) {
  if (!ICONS[name]) throw new Error(`unknown icon "${name}"`);
  return s('svg', { class: cls ? `icon ${cls}` : 'icon', viewBox: '0 0 256 256', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: ICONS[name], fill: 'currentColor' }));
}

/** round a coordinate for compact SVG attributes */
export const r2 = (n) => Math.round(n * 100) / 100;

export const on = (target, type, fn, opts) => {
  target.addEventListener(type, fn, opts);
  return () => target.removeEventListener(type, fn, opts);
};
