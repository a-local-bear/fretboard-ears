// Microphone input: listens to a real guitar and reports the notes it hears.
//
// Browsers only hand out the microphone on secure pages (https:// or
// http://localhost), which is why the server also listens on an https port.

import { createPitchDetector, NoteTracker } from './pitch.js';
import { audio } from './audio.js';

const noteListeners = new Set();
let stream = null, source = null, analyser = null, sink = null;
let timer = null, detect = null, buffer = null, tracker = null;
let state = 'off'; // 'off' | 'starting' | 'on'

function tick() {
  analyser.getFloatTimeDomainData(buffer);
  const frame = detect(buffer);
  mic.level = frame.rms;
  const note = tracker.push(frame);
  if (note) for (const fn of [...noteListeners]) fn(note);
}

export const mic = {
  /** loudness of the most recent frame (0..~0.5) */
  level: 0,
  get state() { return state; },
  get on() { return state === 'on'; },
  /** can this page ask for the microphone at all? */
  get supported() {
    return Boolean(window.isSecureContext && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
  },
  /** why not, in words */
  get unsupportedReason() {
    if (!window.isSecureContext) return 'insecure';
    return 'unavailable';
  },
  /** the note sounding right now: {midi, cents, freq, rms} or null */
  get current() { return state === 'on' && tracker ? tracker.current : null; },

  /** Ask for the microphone and start listening.  Call from a tap. */
  async start() {
    if (state === 'on') return;
    if (state === 'starting') throw new Error('microphone is already starting');
    if (!mic.supported) throw Object.assign(new Error('microphone is not available on this page'), { name: 'NotSupportedError' });
    state = 'starting';
    try {
      const ctx = audio.unlock();
      if (!ctx) throw Object.assign(new Error('audio is not available'), { name: 'NotSupportedError' });
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      // a silent path to the speakers keeps some browsers processing the graph, without feedback
      sink = ctx.createGain();
      sink.gain.value = 0;
      source.connect(analyser);
      analyser.connect(sink);
      sink.connect(ctx.destination);
      detect = createPitchDetector(ctx.sampleRate);
      buffer = new Float32Array(analyser.fftSize);
      tracker = new NoteTracker();
      timer = setInterval(tick, 30);
      state = 'on';
    } catch (err) {
      state = 'off';
      mic.stop();
      throw err;
    }
  },

  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (stream) for (const t of stream.getTracks()) t.stop();
    for (const node of [source, analyser, sink]) { try { node?.disconnect(); } catch { /* already gone */ } }
    stream = source = analyser = sink = tracker = null;
    state = 'off';
    mic.level = 0;
  },

  /** forget the note that is ringing, so the next pluck is reported even if it is the same pitch */
  rearm() { if (tracker) tracker.latched = null; },

  /** fn({midi, cents, freq}) is called once for every note played; returns an unsubscribe function */
  onNote(fn) {
    noteListeners.add(fn);
    return () => noteListeners.delete(fn);
  },
};
