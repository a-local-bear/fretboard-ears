// Tiny DOM helpers — the whole app is plain DOM, no framework.

const SVG_NS = 'http://www.w3.org/2000/svg';
const PROPS = new Set(['value', 'checked', 'selected', 'disabled', 'textContent', 'innerHTML', 'className', 'htmlFor', 'open']);

function apply(el, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'data') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (PROPS.has(key)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
}

function append(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}

// h('button', { class: 'btn', onClick }, 'Play')
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    kids.unshift(props);
  } else if (props) {
    apply(el, props);
  }
  append(el, kids);
  return el;
}

export function s(tag, props, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  if (props) for (const [k, v] of Object.entries(props)) if (v != null && v !== false) el.setAttribute(k, v);
  append(el, kids);
  return el;
}

export const clear = (el) => {
  while (el.firstChild) el.firstChild.remove();
  return el;
};

export function select(options, value, onChange, props = {}) {
  const el = h('select', { class: 'select', ...props, onChange: (e) => onChange(e.target.value) });
  for (const opt of options) {
    if (opt.group) {
      const group = h('optgroup', { label: opt.group });
      for (const o of opt.options) group.append(h('option', { value: o.value, selected: o.value === value }, o.label));
      el.append(group);
    } else {
      el.append(h('option', { value: opt.value, selected: opt.value === value }, opt.label));
    }
  }
  el.value = value;
  return el;
}

export const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function debounce(fn, ms) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = (...args) => {
    clearTimeout(timer);
    fn(...args);
  };
  return wrapped;
}

// Inline icons (stroke = currentColor).
const ICONS = {
  play: '<path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M14.5 6l-6 6 6 6"/>',
  right: '<path d="M9.5 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  dice: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>',
  sound: '<path d="M4 10v4h3l4 3.5v-11L7 10zM15 9.5a3.5 3.5 0 010 5M17.5 7a7 7 0 010 10"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 019.5 5a7.5 7.5 0 109.5 9.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 00-2-2h-7a2 2 0 00-2 2v7a2 2 0 002 2h2"/>',
  swap: '<path d="M7 8h11l-3-3M17 16H6l3 3"/>',
  edit: '<path d="M5 19l1-4L16.5 4.5l3 3L9 18z"/>',
  wave: '<path d="M3 13c2.200-5 4-5 6 0s3.800 5 6 0 3.800-5 6 0" stroke-width="2.600"/>',
  guitar: '<path d="M14 4l6 6M17 7l-5.2 5.2M9.5 9.5c-2 0-2.2 2-3.5 2.6-2 .9-3 2.6-3 4.2 0 2.6 2.1 4.7 4.7 4.7 1.6 0 3.3-1 4.2-3 .6-1.300 2.600-1.500 2.600-3.500"/><circle cx="8.300" cy="15.700" r="1.300"/>',
};

export function icon(name, size = 18) {
  const el = s('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'icon', 'aria-hidden': 'true',
  });
  el.innerHTML = ICONS[name] || '';
  return el;
}
