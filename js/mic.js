// Microphone input: listens for notes played on the guitar while the app itself is quiet.

import { detectPitch, freqToMidi, NoteTracker, VOICE, voiceMidi } from './pitch.js';

const FRAME = 2048;
const INTERVAL_MS = 40;
const ECHO_TAIL = 0.15; // seconds after the app's own sound ends before listening again

let stream = null;
let source = null;
let analyser = null;
let timer = null;
const tracker = new NoteTracker();
let voiceFn = null;

/**
 * Voice mode: while a handler is set, every analysis tick (not just stable notes) goes to
 * fn(fractional MIDI | null, performance.now() in ms) instead of the guitar note tracker, using
 * the vocal range and clarity bar of pitch.js VOICE. fn(null, t) is also called while the app itself
 * is sounding. Pass null to return to guitar mode.
 */
export function setVoice(fn) {
  if (!fn && voiceFn) tracker.reset({ requireOnset: true }); // ignore whatever rings from the guitar now
  voiceFn = fn || null;
}

export const micSupported = () => !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
export const micActive = () => !!stream;

/**
 * Start listening. Resolves when the mic is live; rejects if permission is refused.
 * @param {AudioContext} ctx
 * @param {object} o
 * @param {() => number} o.quietAt  context time when the app's own sound has finished
 * @param {(midi: number) => void} o.onNote   a stable note was played (rounded MIDI)
 * @param {(info: {midi: number, cents: number} | null) => void} o.onHear  live pitch for display
 */
export async function startMic(ctx, { quietAt, onNote, onHear }) {
  if (stream) return;
  // Voice processing (echo cancellation, noise suppression, auto gain) mangles sustained tones.
  const s = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  stream = s;
  source = ctx.createMediaStreamSource(s);
  analyser = ctx.createAnalyser();
  analyser.fftSize = FRAME;
  source.connect(analyser); // not to the speakers
  const buf = new Float32Array(FRAME);
  tracker.reset();
  let listening = true;

  timer = setInterval(() => {
    if (ctx.currentTime < quietAt() + ECHO_TAIL) {
      // The app is playing: don't let it answer itself.
      if (voiceFn) voiceFn(null, performance.now());
      if (listening) { listening = false; tracker.reset({ requireOnset: true }); onHear(null); }
      return;
    }
    listening = true;
    analyser.getFloatTimeDomainData(buf);
    if (voiceFn) {
      voiceFn(voiceMidi(detectPitch(buf, ctx.sampleRate, { minFreq: VOICE.minFreq, maxFreq: VOICE.maxFreq })), performance.now());
      return;
    }
    const r = detectPitch(buf, ctx.sampleRate);
    const midi = r && r.clarity >= tracker.minClarity && r.rms >= tracker.minRms ? freqToMidi(r.freq) : null;
    onHear(midi == null ? null : { midi: Math.round(midi), cents: Math.round((midi - Math.round(midi)) * 100) });
    const note = tracker.push({ midi, clarity: r?.clarity ?? 0, rms: r?.rms ?? 0 });
    if (note != null) onNote(note);
  }, INTERVAL_MS);
}

/** Stop listening and release the microphone (the browser's mic indicator turns off). */
export function stopMic() {
  clearInterval(timer);
  timer = null;
  source?.disconnect();
  stream?.getTracks().forEach((t) => t.stop());
  stream = source = analyser = null;
}
