// Settings that belong to this device rather than to a player:
// whether sound is on, how answers are given here (tap or microphone), theme.

const KEY = 'fretwise.device';
const DEFAULTS = { profile: null, standalone: false, sound: true, input: 'tap', theme: 'auto', tapOffset: 0 };
const listeners = new Set();
let cache = null;

function load() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { saved = {}; }
  cache = { ...DEFAULTS, ...saved };
  return cache;
}

export const prefs = {
  get(key) { return load()[key]; },
  set(key, value) {
    load()[key] = value;
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode: keep it for this visit only */ }
    for (const fn of [...listeners]) fn(key, value);
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

/** apply the chosen colour theme to the page */
export function applyTheme() {
  const theme = prefs.get('theme');
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}
