// A small stand-in for the browser, so the real app code can be exercised from
// `node --test` on machines without a browser.  It implements only what the app
// uses: a DOM tree with events and simple selectors, a virtual clock that drives
// timers / requestAnimationFrame / Date / performance.now, localStorage, and a
// Web Audio double that validates the calls it receives.
//
// Nothing here is shipped to the browser.

const SVG_NS = 'http://www.w3.org/2000/svg';
const real = {
  setImmediate: globalThis.setImmediate,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  Date: globalThis.Date,
  fetch: globalThis.fetch,
};

const kebab = (s) => (s.startsWith('--') ? s : s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()));
const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------
// Selectors (tag, #id, .class, [attr], [attr=v], :not(), :checked, :disabled,
// :first-child, :last-child; descendant and child combinators; comma lists)
// ---------------------------------------------------------------------------
function parseCompound(text) {
  const c = { tag: null, id: null, classes: [], attrs: [], pseudos: [] };
  let rest = text;
  while (rest) {
    let m;
    if ((m = /^(\*|[a-zA-Z][\w-]*)/.exec(rest))) c.tag = m[1] === '*' ? null : m[1].toLowerCase();
    else if ((m = /^#([\w-]+)/.exec(rest))) c.id = m[1];
    else if ((m = /^\.([\w-]+)/.exec(rest))) c.classes.push(m[1]);
    else if ((m = /^\[([\w-]+)(?:([~^$*|]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/.exec(rest))) c.attrs.push({ name: m[1], op: m[2] || null, value: m[3] ?? m[4] ?? m[5] ?? '' });
    else if ((m = /^:([\w-]+)(?:\(([^)]*)\))?/.exec(rest))) c.pseudos.push({ name: m[1], arg: m[2] ? parseCompound(m[2]) : null });
    else throw new Error(`fake-dom: unsupported selector "${text}"`);
    rest = rest.slice(m[0].length);
  }
  return c;
}
function parseSelector(text) {
  return text.split(',').map((alt) => {
    const tokens = alt.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
    const steps = [];
    let combinator = ' ';
    for (const tok of tokens) {
      if (tok === '>') { combinator = '>'; continue; }
      steps.push({ combinator, compound: parseCompound(tok) });
      combinator = ' ';
    }
    return steps;
  });
}
function matchCompound(el, c) {
  if (c.tag && el.localName !== c.tag) return false;
  if (c.id && el.getAttribute('id') !== c.id) return false;
  for (const cls of c.classes) if (!el.classList.contains(cls)) return false;
  for (const a of c.attrs) {
    const v = el.getAttribute(a.name);
    if (v === null) return false;
    if (a.op === '=' && v !== a.value) return false;
    if (a.op === '^=' && !v.startsWith(a.value)) return false;
    if (a.op === '$=' && !v.endsWith(a.value)) return false;
    if (a.op === '*=' && !v.includes(a.value)) return false;
    if (a.op === '~=' && !v.split(/\s+/).includes(a.value)) return false;
  }
  for (const p of c.pseudos) {
    if (p.name === 'not') { if (matchCompound(el, p.arg)) return false; }
    else if (p.name === 'checked') { if (!el.checked) return false; }
    else if (p.name === 'disabled') { if (!el.disabled) return false; }
    else if (p.name === 'first-child') { if (el.parentNode?.children[0] !== el) return false; }
    else if (p.name === 'last-child') { if (el.parentNode?.children.at(-1) !== el) return false; }
    else throw new Error(`fake-dom: unsupported pseudo-class :${p.name}`);
  }
  return true;
}
function matchSteps(el, steps, i = steps.length - 1) {
  if (!matchCompound(el, steps[i].compound)) return false;
  if (i === 0) return true;
  if (steps[i].combinator === '>') return el.parentNode instanceof FElement && matchSteps(el.parentNode, steps, i - 1);
  for (let p = el.parentNode; p instanceof FElement; p = p.parentNode) if (matchSteps(p, steps, i - 1)) return true;
  return false;
}
const matchesSelector = (el, sel) => parseSelector(sel).some((steps) => matchSteps(el, steps));

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------
class FEventTarget {
  constructor() { this._listeners = {}; }
  addEventListener(type, fn, opts) {
    if (typeof fn !== 'function') throw new TypeError(`addEventListener("${type}") needs a function`);
    (this._listeners[type] ||= []).push({ fn, once: Boolean(opts && opts.once) });
  }
  removeEventListener(type, fn) {
    const list = this._listeners[type];
    const i = list ? list.findIndex((l) => l.fn === fn) : -1;
    if (i >= 0) list.splice(i, 1);
  }
  dispatchEvent(ev) {
    if (!ev.target) ev.target = this;
    for (let node = this; node; node = ev.bubbles ? node._eventParent() : null) {
      ev.currentTarget = node;
      for (const l of (node._listeners[ev.type] || []).slice()) {
        if (l.once) node.removeEventListener(ev.type, l.fn);
        try { l.fn.call(node, ev); } catch (err) { env.errors.push(err); }
        if (ev._halt) break;
      }
      if (ev._stopped) break;
    }
    return !ev.defaultPrevented;
  }
  _eventParent() { return null; }
}

export class FEvent {
  constructor(type, init = {}) {
    this.bubbles = true;
    Object.assign(this, init);
    this.type = type;
    this.defaultPrevented = false;
    this.timeStamp = init.timeStamp ?? env.clock.now;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._stopped = true; }
  stopImmediatePropagation() { this._stopped = true; this._halt = true; }
}

class FNode extends FEventTarget {
  constructor() { super(); this.parentNode = null; this.childNodes = []; }
  get ownerDocument() { return env.document; }
  get parentElement() { return this.parentNode instanceof FElement ? this.parentNode : null; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes.at(-1) ?? null; }
  get nextSibling() { const s = this.parentNode?.childNodes; return s ? s[s.indexOf(this) + 1] ?? null : null; }
  get previousSibling() { const s = this.parentNode?.childNodes; return s ? s[s.indexOf(this) - 1] ?? null : null; }
  get isConnected() { for (let n = this; n; n = n.parentNode) if (n === env.document) return true; return false; }
  _eventParent() { return this.parentNode || (this === env.document ? env.window : null); }
  contains(other) { for (let n = other; n; n = n.parentNode) if (n === this) return true; return false; }
  _adopt(item) {
    if (item instanceof FFragment) return item.childNodes.splice(0).map((n) => { n.parentNode = this; return n; });
    const node = item instanceof FNode ? item : new FText(item);
    if (node.contains(this)) throw new Error('fake-dom: cannot insert a node into its own descendant');
    node.parentNode?.removeChild(node);
    node.parentNode = this;
    return [node];
  }
  appendChild(node) { this.childNodes.push(...this._adopt(node)); return node; }
  append(...items) { for (const it of items) this.childNodes.push(...this._adopt(it)); }
  prepend(...items) { const add = items.flatMap((it) => this._adopt(it)); this.childNodes.unshift(...add); }
  insertBefore(node, ref) {
    if (!ref) return this.appendChild(node);
    const add = this._adopt(node);
    const i = this.childNodes.indexOf(ref);
    if (i < 0) throw new Error('fake-dom: insertBefore reference is not a child');
    this.childNodes.splice(i, 0, ...add);
    return node;
  }
  removeChild(node) {
    const i = this.childNodes.indexOf(node);
    if (i < 0) throw new Error('fake-dom: removeChild of a node that is not a child');
    this.childNodes.splice(i, 1);
    node.parentNode = null;
    return node;
  }
  remove() { this.parentNode?.removeChild(this); }
  replaceChildren(...items) { for (const c of this.childNodes.splice(0)) c.parentNode = null; this.append(...items); }
  replaceWith(...items) {
    const parent = this.parentNode;
    if (!parent) return;
    const ref = this.nextSibling;
    parent.removeChild(this);
    for (const it of items) parent.insertBefore(it instanceof FNode ? it : new FText(it), ref);
  }
  before(...items) { for (const it of items) this.parentNode.insertBefore(it instanceof FNode ? it : new FText(it), this); }
  after(...items) { const ref = this.nextSibling; for (const it of items) this.parentNode.insertBefore(it instanceof FNode ? it : new FText(it), ref); }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { this.replaceChildren(); if (v !== '' && v != null) this.append(String(v)); }
}

class FText extends FNode {
  constructor(data) { super(); this.nodeType = 3; this.data = String(data); }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
  get nodeValue() { return this.data; }
}

class FFragment extends FNode {
  constructor() { super(); this.nodeType = 11; }
  get children() { return this.childNodes.filter((c) => c instanceof FElement); }
  querySelector(sel) { return queryAll(this, sel, true)[0] ?? null; }
  querySelectorAll(sel) { return queryAll(this, sel, false); }
}

function queryAll(root, sel, firstOnly) {
  const alts = parseSelector(sel);
  const out = [];
  const walk = (node) => {
    for (const c of node.childNodes) {
      if (!(c instanceof FElement)) continue;
      if (alts.some((steps) => matchSteps(c, steps))) { out.push(c); if (firstOnly) return true; }
      if (walk(c)) return true;
    }
    return false;
  };
  walk(root);
  return out;
}

const BOOLEAN_PROPS = ['disabled', 'checked', 'hidden', 'selected', 'readOnly', 'required', 'open'];
const STRING_PROPS = { id: 'id', title: 'title', href: 'href', src: 'src', type: 'type', name: 'name', placeholder: 'placeholder', htmlFor: 'for', alt: 'alt', rel: 'rel', lang: 'lang', role: 'role' };

export class FElement extends FNode {
  constructor(tag, ns = null) {
    super();
    this.nodeType = 1;
    this.namespaceURI = ns || 'http://www.w3.org/1999/xhtml';
    this.localName = ns === SVG_NS ? tag : tag.toLowerCase();
    this.tagName = ns === SVG_NS ? tag : tag.toUpperCase();
    this.attributes = new Map();
    this._style = new Map();
    this._value = '';
    this.scrollTop = 0;
    this.scrollLeft = 0;
    const el = this;
    this.style = new Proxy({
      setProperty: (name, value) => { if (value === '' || value == null) el._style.delete(name); else el._style.set(name, String(value)); },
      removeProperty: (name) => { el._style.delete(name); },
      getPropertyValue: (name) => el._style.get(name) ?? '',
    }, {
      get: (t, p) => (p === 'cssText' ? el._cssText() : p in t ? t[p] : typeof p === 'string' ? el._style.get(kebab(p)) ?? '' : undefined),
      set: (t, p, v) => { if (p === 'cssText') el._setCssText(v); else t.setProperty(kebab(p), v); return true; },
    });
    this.classList = {
      add: (...names) => { const s = el._classes(); for (const n of names) { if (/\s/.test(n) || !n) throw new Error(`fake-dom: bad class token "${n}"`); s.add(n); } el._setClasses(s); },
      remove: (...names) => { const s = el._classes(); for (const n of names) s.delete(n); el._setClasses(s); },
      toggle: (name, force) => { const s = el._classes(); const on = force === undefined ? !s.has(name) : Boolean(force); if (on) s.add(name); else s.delete(name); el._setClasses(s); return on; },
      contains: (name) => el._classes().has(name),
      get length() { return el._classes().size; },
    };
    this.dataset = new Proxy({}, {
      get: (t, p) => (typeof p === 'string' ? el.getAttribute('data-' + kebab(p)) ?? undefined : undefined),
      set: (t, p, v) => { el.setAttribute('data-' + kebab(p), String(v)); return true; },
      deleteProperty: (t, p) => { el.removeAttribute('data-' + kebab(p)); return true; },
      has: (t, p) => typeof p === 'string' && el.hasAttribute('data-' + kebab(p)),
    });
  }
  _classes() { return new Set((this.attributes.get('class') || '').split(/\s+/).filter(Boolean)); }
  _setClasses(set) { this.attributes.set('class', [...set].join(' ')); }
  _cssText() { return [...this._style].map(([k, v]) => `${k}: ${v}`).join('; '); }
  _setCssText(text) {
    this._style.clear();
    for (const part of String(text).split(';')) { const i = part.indexOf(':'); if (i > 0) this._style.set(part.slice(0, i).trim(), part.slice(i + 1).trim()); }
  }
  setAttribute(name, value) {
    if (typeof name !== 'string' || !/^[a-zA-Z_:][\w:.-]*$/.test(name)) throw new Error(`fake-dom: bad attribute name "${name}"`);
    if (name === 'style') this._setCssText(value); else this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    if (name === 'style') return this._style.size ? this._cssText() : null;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  hasAttribute(name) { return name === 'style' ? this._style.size > 0 : this.attributes.has(name); }
  removeAttribute(name) { if (name === 'style') this._style.clear(); else this.attributes.delete(name); }
  toggleAttribute(name, force) { const on = force === undefined ? !this.hasAttribute(name) : Boolean(force); if (on) this.setAttribute(name, ''); else this.removeAttribute(name); return on; }
  get className() { return this.attributes.get('class') || ''; }
  set className(v) { this.attributes.set('class', String(v)); }
  get value() { return this._value; }
  set value(v) { this._value = String(v); }
  get tabIndex() { return Number(this.getAttribute('tabindex') ?? -1); }
  set tabIndex(v) { this.setAttribute('tabindex', v); }
  get children() { return this.childNodes.filter((c) => c instanceof FElement); }
  get childElementCount() { return this.children.length; }
  get firstElementChild() { return this.children[0] ?? null; }
  get lastElementChild() { return this.children.at(-1) ?? null; }
  get nextElementSibling() { const s = this.parentNode?.children; return s ? s[s.indexOf(this) + 1] ?? null : null; }
  get previousElementSibling() { const s = this.parentNode?.children; return s ? s[s.indexOf(this) - 1] ?? null : null; }
  get innerHTML() { return this.childNodes.map(serialize).join(''); }
  set innerHTML(v) { if (v !== '') throw new Error('fake-dom: innerHTML may only be cleared; build nodes with h()/s() instead'); this.replaceChildren(); }
  get outerHTML() { return serialize(this); }
  matches(sel) { return matchesSelector(this, sel); }
  closest(sel) { for (let n = this; n instanceof FElement; n = n.parentNode) if (n.matches(sel)) return n; return null; }
  querySelector(sel) { return queryAll(this, sel, true)[0] ?? null; }
  querySelectorAll(sel) { return queryAll(this, sel, false); }
  getElementsByClassName(name) { return queryAll(this, '.' + name, false); }
  getBoundingClientRect() {
    const r = this._rect || { x: 0, y: 0, width: env.window.innerWidth, height: 48 };
    return { x: r.x, y: r.y, left: r.x, top: r.y, width: r.width, height: r.height, right: r.x + r.width, bottom: r.y + r.height };
  }
  get clientWidth() { return this.getBoundingClientRect().width; }
  get clientHeight() { return this.getBoundingClientRect().height; }
  get offsetWidth() { return this.getBoundingClientRect().width; }
  get offsetHeight() { return this.getBoundingClientRect().height; }
  get scrollHeight() { return this.getBoundingClientRect().height; }
  get scrollWidth() { return this.getBoundingClientRect().width; }
  get offsetParent() { return this.parentElement; }
  focus() { env.document.activeElement = this; this.dispatchEvent(new FEvent('focus', { bubbles: false })); }
  blur() { if (env.document.activeElement === this) env.document.activeElement = env.document.body; this.dispatchEvent(new FEvent('blur', { bubbles: false })); }
  click() {
    if (this.disabled) return;
    const ev = new FEvent('click', { button: 0, detail: 1 });
    this.dispatchEvent(ev);
    // default action of a link: follow it (only in-page "#..." links change the fake location)
    const link = this.closest('a[href]');
    if (link && !ev.defaultPrevented) {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) env.window.location.hash = href; else env.navigations.push(href);
    }
  }
  select() {}
  scrollIntoView() {}
  scrollTo() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  hasPointerCapture() { return false; }
  animate(keyframes, options) {
    if (!Array.isArray(keyframes) && typeof keyframes !== 'object') throw new TypeError('animate() needs keyframes');
    const duration = typeof options === 'number' ? options : options?.duration ?? 0;
    const anim = { onfinish: null, cancel() {}, finish() {}, playState: 'running' };
    anim.finished = new Promise((resolve) => env.window.setTimeout(() => { anim.playState = 'finished'; anim.onfinish?.(); resolve(anim); }, duration));
    return anim;
  }
  getContext() { return null; } // <canvas>: no drawing surface here
  cloneNode(deep) {
    const copy = new FElement(this.localName, this.namespaceURI === SVG_NS ? SVG_NS : null);
    for (const [k, v] of this.attributes) copy.attributes.set(k, v);
    for (const [k, v] of this._style) copy._style.set(k, v);
    if (deep) for (const c of this.childNodes) copy.appendChild(c instanceof FElement ? c.cloneNode(true) : new FText(c.data));
    return copy;
  }
}
for (const prop of BOOLEAN_PROPS) {
  const attr = prop.toLowerCase();
  Object.defineProperty(FElement.prototype, prop, {
    get() { return this.hasAttribute(attr); },
    set(v) { if (v) this.setAttribute(attr, ''); else this.removeAttribute(attr); },
  });
}
for (const [prop, attr] of Object.entries(STRING_PROPS)) {
  Object.defineProperty(FElement.prototype, prop, {
    get() { return this.getAttribute(attr) ?? ''; },
    set(v) { this.setAttribute(attr, v); },
  });
}

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
export function serialize(node) {
  if (node instanceof FText) return escapeText(node.data);
  if (!(node instanceof FElement)) return node.childNodes.map(serialize).join('');
  let attrs = '';
  for (const [k, v] of node.attributes) attrs += ` ${k}="${escapeAttr(v)}"`;
  if (node._style.size) attrs += ` style="${escapeAttr(node._cssText())}"`;
  if (node.localName === 'svg' && !node.attributes.has('xmlns')) attrs += ` xmlns="${SVG_NS}"`;
  if (VOID.has(node.localName)) return `<${node.localName}${attrs}>`;
  return `<${node.localName}${attrs}>${node.childNodes.map(serialize).join('')}</${node.localName}>`;
}

class FDocument extends FNode {
  constructor() {
    super();
    this.nodeType = 9;
    this.documentElement = new FElement('html');
    this.head = new FElement('head');
    this.body = new FElement('body');
    this.appendChild(this.documentElement);
    this.documentElement.append(this.head, this.body);
    this.activeElement = this.body;
    this.visibilityState = 'visible';
    this.hidden = false;
    this.readyState = 'complete';
    this.title = '';
    this.fonts = { ready: Promise.resolve(), load: async () => [], check: () => true };
  }
  createElement(tag) { if (!/^[a-zA-Z][\w-]*$/.test(tag)) throw new Error(`fake-dom: bad tag "${tag}"`); return new FElement(tag); }
  createElementNS(ns, tag) { return new FElement(tag, ns); }
  createTextNode(text) { return new FText(text); }
  createDocumentFragment() { return new FFragment(); }
  getElementById(id) { return queryAll(this, `[id="${id}"]`, true)[0] ?? null; }
  querySelector(sel) { return queryAll(this, sel, true)[0] ?? null; }
  querySelectorAll(sel) { return queryAll(this, sel, false); }
}

// ---------------------------------------------------------------------------
// Web Audio double: records what gets scheduled and rejects invalid calls the
// way a real AudioContext would.
// ---------------------------------------------------------------------------
class FAudioParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  _t(t, what) { if (!Number.isFinite(t) || t < 0) throw new RangeError(`AudioParam.${what}: bad time ${t}`); }
  _v(v, what) { if (!Number.isFinite(v)) throw new TypeError(`AudioParam.${what}: non-finite value ${v}`); }
  setValueAtTime(v, t) { this._v(v, 'setValueAtTime'); this._t(t, 'setValueAtTime'); this.events.push(['set', v, t]); this.value = v; return this; }
  linearRampToValueAtTime(v, t) { this._v(v, 'linearRamp'); this._t(t, 'linearRamp'); this.events.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) {
    this._v(v, 'exponentialRamp'); this._t(t, 'exponentialRamp');
    if (v === 0) throw new RangeError('AudioParam.exponentialRampToValueAtTime: value must not be 0');
    this.events.push(['exp', v, t]); return this;
  }
  setTargetAtTime(v, t, c) { this._v(v, 'setTarget'); this._t(t, 'setTarget'); if (!(c >= 0)) throw new RangeError('AudioParam.setTargetAtTime: bad time constant'); this.events.push(['target', v, t]); return this; }
  cancelScheduledValues(t) { this._t(t, 'cancelScheduledValues'); return this; }
  cancelAndHoldAtTime(t) { this._t(t, 'cancelAndHoldAtTime'); return this; }
}
class FAudioNode {
  constructor(ctx, kind) { this.context = ctx; this.kind = kind; this.outputs = []; }
  connect(dest) {
    if (!(dest instanceof FAudioNode) && !(dest instanceof FAudioParam)) throw new TypeError(`${this.kind}.connect: destination is not an AudioNode`);
    this.outputs.push(dest);
    return dest;
  }
  disconnect() { this.outputs = []; }
}
class FSourceNode extends FAudioNode {
  constructor(ctx, kind) { super(ctx, kind); this.onended = null; this._started = false; }
  start(when = 0, offset = 0, duration) {
    if (this._started) throw new Error(`${this.kind}.start: cannot call start more than once`);
    if (!Number.isFinite(when) || when < 0) throw new RangeError(`${this.kind}.start: bad time ${when}`);
    if (this.kind === 'buffer' && !this.buffer) throw new Error('buffer source started without a buffer');
    this._started = true;
    this.startTime = Math.max(when, this.context.currentTime);
    this.context.log.push({ kind: this.kind, when: this.startTime, node: this, offset, duration });
  }
  stop(when = 0) {
    if (!this._started) throw new Error(`${this.kind}.stop: cannot call stop without calling start first`);
    if (!Number.isFinite(when) || when < 0) throw new RangeError(`${this.kind}.stop: bad time ${when}`);
    this.stopTime = when;
    const delay = Math.max(0, (when - this.context.currentTime) * 1000);
    env.window.setTimeout(() => this.onended?.(), delay);
  }
}
class FAudioBuffer {
  constructor(channels, length, sampleRate) {
    if (!(channels >= 1) || !(length >= 1) || !(sampleRate >= 3000)) throw new Error(`createBuffer: bad arguments (${channels}, ${length}, ${sampleRate})`);
    this.numberOfChannels = channels; this.length = Math.floor(length); this.sampleRate = sampleRate;
    this.duration = this.length / sampleRate;
    this._data = Array.from({ length: channels }, () => new Float32Array(this.length));
  }
  getChannelData(c) { if (!this._data[c]) throw new Error('getChannelData: bad channel'); return this._data[c]; }
  copyToChannel(src, c) { this.getChannelData(c).set(src.subarray(0, this.length)); }
}
class FAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.state = 'suspended';
    this.baseLatency = 0.005;
    this.outputLatency = 0.02;
    this.log = [];
    this.destination = new FAudioNode(this, 'destination');
    this._t0 = env.clock.now;
    env.audioContexts.push(this);
  }
  get currentTime() { return (env.clock.now - this._t0) / 1000; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  getOutputTimestamp() { return { contextTime: Math.max(0, this.currentTime - this.outputLatency), performanceTime: env.clock.now }; }
  createGain() { const n = new FAudioNode(this, 'gain'); n.gain = new FAudioParam(1); return n; }
  createOscillator() { const n = new FSourceNode(this, 'osc'); n.type = 'sine'; n.frequency = new FAudioParam(440); n.detune = new FAudioParam(0); return n; }
  createBufferSource() { const n = new FSourceNode(this, 'buffer'); n.buffer = null; n.playbackRate = new FAudioParam(1); n.detune = new FAudioParam(0); n.loop = false; return n; }
  createBuffer(c, l, r) { return new FAudioBuffer(c, l, r); }
  createBiquadFilter() { const n = new FAudioNode(this, 'biquad'); n.type = 'lowpass'; n.frequency = new FAudioParam(350); n.Q = new FAudioParam(1); n.gain = new FAudioParam(0); return n; }
  createDynamicsCompressor() {
    const n = new FAudioNode(this, 'compressor');
    for (const p of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[p] = new FAudioParam(0);
    return n;
  }
  createAnalyser() {
    const ctx = this;
    const n = new FAudioNode(this, 'analyser');
    n.fftSize = 2048; n.smoothingTimeConstant = 0.8;
    n.getFloatTimeDomainData = (out) => {
      if (!(out instanceof Float32Array)) throw new TypeError('getFloatTimeDomainData needs a Float32Array');
      env.mic.fill(out, ctx.sampleRate, env.clock.now / 1000);
    };
    n.getByteTimeDomainData = (out) => out.fill(128);
    return n;
  }
  createMediaStreamSource(stream) {
    if (!stream || typeof stream.getTracks !== 'function') throw new TypeError('createMediaStreamSource needs a MediaStream');
    return new FAudioNode(this, 'mediaStreamSource');
  }
}

// A pretend microphone: tests call env.mic.play(midi) and the analyser returns a
// plucked-string-like signal (decaying harmonics) from that moment on.
function makeMic() {
  const mic = {
    notes: [], // {freq, start, level}
    noise: 0.002,
    play(midi, { level = 0.25 } = {}) { mic.notes.push({ freq: 440 * 2 ** ((midi - 69) / 12), start: env.clock.now / 1000, level }); if (mic.notes.length > 2) mic.notes.shift(); },
    silence() { mic.notes = []; },
    fill(out, sampleRate, tEnd) {
      const t0 = tEnd - out.length / sampleRate;
      let seed = Math.floor(tEnd * 1000) | 1;
      for (let i = 0; i < out.length; i++) {
        const t = t0 + i / sampleRate;
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        let v = (seed / 0x7fffffff - 0.5) * 2 * mic.noise;
        for (let k = 0; k < mic.notes.length; k++) {
          const n = mic.notes[k];
          const next = mic.notes[k + 1];
          const age = t - n.start;
          if (age < 0 || (next && t >= next.start)) continue; // one string: a new note cuts the old one
          const envl = n.level * Math.min(1, age / 0.004) * Math.exp(-age * 1.8);
          const w = 2 * Math.PI * n.freq * age;
          v += envl * (Math.sin(w) + 0.5 * Math.sin(2 * w) + 0.33 * Math.sin(3 * w) + 0.2 * Math.sin(4 * w) + 0.1 * Math.sin(5 * w));
        }
        out[i] = v;
      }
    },
  };
  return mic;
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
export let env = null;

export function installFakeDom(options = {}) {
  const { width = 390, height = 844, url = 'http://192.168.1.64:8420/', secure = false, microphone = false, startDate = '2026-11-13T09:00:00' } = options;
  const timers = new Map();
  let seq = 0;
  const clock = {
    now: 0,
    base: new real.Date(startDate).getTime(),
    pending: new Set(),
    /** wait for promise chains (and any in-flight fetches) to settle */
    async flush() {
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => real.setImmediate(r));
        if (clock.pending.size) { await Promise.allSettled([...clock.pending]); i = 0; }
      }
    },
    /** run every timer that falls due within the next `ms` virtual milliseconds */
    async advance(ms) {
      const target = clock.now + ms;
      for (;;) {
        await clock.flush();
        let next = null;
        for (const t of timers.values()) if (t.time <= target && (!next || t.time < next.time || (t.time === next.time && t.id < next.id))) next = t;
        if (!next) break;
        clock.now = Math.max(clock.now, next.time);
        if (next.every) next.time += next.every; else timers.delete(next.id);
        try { next.fn(); } catch (err) { env.errors.push(err); }
      }
      clock.now = target;
      await clock.flush();
    },
    /** jump the calendar (e.g. to the next day) without running timers */
    setDate(iso) { clock.base = new real.Date(iso).getTime() - clock.now; },
    timerCount: () => timers.size,
  };
  const addTimer = (fn, ms, every, args) => {
    if (typeof fn !== 'function') throw new TypeError('timer callback must be a function');
    const id = ++seq;
    timers.set(id, { id, time: clock.now + Math.max(0, Number(ms) || 0), every: every ? Math.max(1, Number(ms) || 0) : 0, fn: () => fn(...args) });
    return id;
  };
  const dropTimer = (handle) => { timers.delete(Number(handle)); };

  class FakeDate extends real.Date {
    constructor(...args) { if (args.length === 0) super(clock.base + clock.now); else super(...args); }
    static now() { return clock.base + clock.now; }
  }

  const document = new FDocument();
  const storage = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(String(k), String(v)); },
      removeItem: (k) => { map.delete(k); },
      clear: () => map.clear(),
      key: (i) => [...map.keys()][i] ?? null,
      get length() { return map.size; },
      _map: map,
    };
  };

  const loc = new URL(url);
  const window = new FEventTarget();
  const location = {
    get href() { return loc.href; },
    set href(v) { location.assign(v); },
    get protocol() { return loc.protocol; },
    get host() { return loc.host; },
    get hostname() { return loc.hostname; },
    get port() { return loc.port; },
    get origin() { return loc.origin; },
    get pathname() { return loc.pathname; },
    get search() { return loc.search; },
    get hash() { return loc.hash; },
    set hash(v) {
      const before = loc.hash;
      loc.hash = v;
      if (loc.hash !== before) addTimer(() => window.dispatchEvent(new FEvent('hashchange', { bubbles: false })), 0, false, []);
    },
    assign(v) { env.navigations.push(String(v)); const next = new URL(v, loc.href); if (next.origin === loc.origin && next.pathname === loc.pathname) location.hash = next.hash; },
    replace(v) { location.assign(v); },
    reload() { env.navigations.push('reload'); },
    toString() { return loc.href; },
  };
  const history = {
    replaceState(state, title, to) { if (to != null) loc.href = new URL(to, loc.href).href; },
    pushState(state, title, to) { if (to != null) loc.href = new URL(to, loc.href).href; },
    back() {},
    get length() { return 1; },
  };

  const mic = makeMic();
  const navigator = {
    userAgent: 'FretwiseFakeBrowser/1.0', language: 'en-US', languages: ['en-US'], maxTouchPoints: 5, onLine: true,
    vibrate() { return true; },
    clipboard: { writeText: async () => {} },
  };
  if (microphone) {
    navigator.mediaDevices = {
      getUserMedia: async (constraints) => {
        if (!constraints || !constraints.audio) throw new TypeError('getUserMedia: audio constraint required');
        if (env.micPermission === 'denied') throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
        const track = { kind: 'audio', stopped: false, stop() { this.stopped = true; }, getSettings: () => ({ sampleRate: 48000 }) };
        env.micTracks.push(track);
        return { getTracks: () => [track], getAudioTracks: () => [track] };
      },
    };
  }

  class Observer { constructor(cb) { this.cb = cb; env.observers.push(this); } observe(el) { this.target = el; } unobserve() {} disconnect() { this.target = null; } }

  Object.assign(window, {
    document, location, history, navigator,
    localStorage: storage(), sessionStorage: storage(),
    innerWidth: width, innerHeight: height, devicePixelRatio: 2,
    isSecureContext: secure || loc.protocol === 'https:' || loc.hostname === 'localhost',
    setTimeout: (fn, ms, ...args) => addTimer(fn, ms, false, args),
    setInterval: (fn, ms, ...args) => addTimer(fn, ms, true, args),
    clearTimeout: dropTimer,
    clearInterval: dropTimer,
    requestAnimationFrame: (fn) => addTimer(() => fn(clock.now), 16, false, []),
    cancelAnimationFrame: dropTimer,
    queueMicrotask: (fn) => Promise.resolve().then(fn),
    matchMedia: (query) => ({ matches: Boolean(env.media[query]), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    scrollTo() {}, scrollBy() {},
    alert: (msg) => { env.dialogs.push(['alert', msg]); },
    confirm: (msg) => { env.dialogs.push(['confirm', msg]); return env.confirmAnswer; },
    prompt: (msg) => { env.dialogs.push(['prompt', msg]); return null; },
    AudioContext: FAudioContext,
    ResizeObserver: Observer, IntersectionObserver: Observer, MutationObserver: Observer,
    Event: FEvent, CustomEvent: FEvent, KeyboardEvent: FEvent, PointerEvent: FEvent, MouseEvent: FEvent,
    Node: FNode, Element: FElement, HTMLElement: FElement, SVGElement: FElement,
    performance: { now: () => clock.now, timeOrigin: clock.base },
    Date: FakeDate,
    fetch: (input, init) => {
      const target = typeof input === 'string' && !/^https?:/.test(input) ? `${env.apiBase}/${input.replace(/^\//, '')}` : input;
      const p = env.fetchImpl(target, init);
      clock.pending.add(p);
      const done = () => clock.pending.delete(p);
      p.then(done, done);
      return p;
    },
  });
  window.window = window;
  window.self = window;
  window.globalThis = window;

  env = {
    window, document, clock, mic,
    errors: [], dialogs: [], navigations: [], observers: [], audioContexts: [], micTracks: [],
    media: {}, confirmAnswer: true, micPermission: 'granted',
    apiBase: loc.origin,
    fetchImpl: () => Promise.reject(new Error('fake-dom: no fetch handler installed')),
    /** dispatch an event on an element */
    fire(el, type, init) { const ev = new FEvent(type, init); el.dispatchEvent(ev); return ev; },
    /** press a key (dispatched on the window, like a physical keyboard with nothing focused) */
    key(key, init = {}) { const ev = new FEvent('keydown', { key, code: init.code ?? key, ...init }); (env.document.activeElement || document.body).dispatchEvent(ev); return ev; },
    /** fail loudly if app code threw inside an event handler or timer */
    assertNoErrors() {
      if (!env.errors.length) return;
      const first = env.errors[0];
      const more = env.errors.length > 1 ? ` (+${env.errors.length - 1} more)` : '';
      env.errors = [];
      throw new Error(`app code threw${more}: ${first?.stack || first}`);
    },
    restore() { for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } process.off('unhandledRejection', onRejection); env = null; },
  };

  const saved = [];
  const globals = {
    window, document, navigator, location, history,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    setTimeout: window.setTimeout, setInterval: window.setInterval, clearTimeout: window.clearTimeout, clearInterval: window.clearInterval,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame,
    matchMedia: window.matchMedia, getComputedStyle: window.getComputedStyle,
    AudioContext: FAudioContext, ResizeObserver: Observer, IntersectionObserver: Observer,
    Event: FEvent, CustomEvent: FEvent, Node: FNode, Element: FElement, HTMLElement: FElement, SVGElement: FElement,
    performance: window.performance, Date: FakeDate, fetch: window.fetch,
    alert: window.alert, confirm: window.confirm,
  };
  for (const [k, v] of Object.entries(globals)) {
    saved.push([k, Object.getOwnPropertyDescriptor(globalThis, k)]);
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true, enumerable: true });
  }
  const onRejection = (err) => { env?.errors.push(err); };
  process.on('unhandledRejection', onRejection);
  return env;
}

export { real, SVG_NS };
