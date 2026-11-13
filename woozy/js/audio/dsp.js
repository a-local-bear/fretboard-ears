// Plucked-string synthesis (Karplus–Strong) rendered to a plain Float32Array.
// Kept free of Web Audio so Node can test that every note comes out in tune.

export const midiHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Renders one plucked note.
//   returns { data, rate } — play `data` at playbackRate `rate` to land exactly
//   on pitch.  The delay line is a whole number of samples, so the raw render
//   is a few cents off; the rate makes up the difference.
export function renderPluck(midi, sampleRate, { seconds, random = Math.random } = {}) {
  const freq = midiHz(midi);

  // The feedback loop averages neighbouring samples: (1-b)·x[n] + b·x[n+1].
  // That damps the harmonics faster than the fundamental, like a real string.
  // The damping grows with the cube of the pitch, so b is eased off for high
  // notes to keep them from dying within half a second.
  const w = (2 * Math.PI * freq) / sampleRate;
  const budget = 4 / (8.68 * freq * (1 - Math.cos(w))); // allow ≈4 dB/s of filter loss
  const b = budget >= 0.25 ? 0.5 : (1 - Math.sqrt(1 - 4 * budget)) / 2;

  // The filter reads one sample *ahead* in the delay line, so the loop's
  // effective length is N − b samples.
  const N = Math.max(4, Math.round(sampleRate / freq + b));
  const actual = sampleRate / (N - b);

  // Ring time of the fundamental: ~11 s on the low E, shorter higher up.
  const t60 = Math.max(4, 11 - (midi - 40) * 0.1);
  const loopGain = Math.min(0.99995, 10 ** (-3 / (actual * t60)));
  const length = Math.floor(sampleRate * (seconds ?? Math.min(4.5, t60 * 0.6)));
  const data = new Float32Array(length);

  // Excitation: one period of noise, low-passed twice around the ring so it
  // has no seam — a soft pick rather than a harpsichord quill.
  const ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = random() * 2 - 1;
  const soften = 0.25;
  for (let pass = 0; pass < 2; pass++) {
    let lp = ring[N - 1];
    for (let k = 0; k < 2 * N; k++) {
      const i = k % N;
      lp += soften * (ring[i] - lp);
      ring[i] = lp;
    }
  }
  let mean = 0;
  for (let i = 0; i < N; i++) mean += ring[i];
  mean /= N;
  let peak = 1e-9;
  for (let i = 0; i < N; i++) {
    ring[i] -= mean;
    peak = Math.max(peak, Math.abs(ring[i]));
  }
  for (let i = 0; i < N; i++) ring[i] /= peak;

  let i = 0;
  for (let n = 0; n < length; n++) {
    const j = i + 1 === N ? 0 : i + 1;
    const s = ring[i];
    data[n] = s;
    ring[i] = loopGain * ((1 - b) * s + b * ring[j]);
    i = j;
  }

  // Fade the tail so a note that outlasts its buffer never clicks.
  const fade = Math.min(length, Math.floor(sampleRate * 0.5));
  for (let k = 0; k < fade; k++) data[length - 1 - k] *= k / fade;

  return { data, rate: freq / actual };
}

// A burst of decaying, slightly dark noise: the impulse response for a small
// plate-ish reverb.  Returns [left, right].
export function renderImpulse(sampleRate, seconds = 1.8, random = Math.random) {
  const length = Math.floor(sampleRate * seconds);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let lpL = 0;
  let lpR = 0;
  for (let n = 0; n < length; n++) {
    const t = n / length;
    const env = (1 - t) ** 2 * Math.exp(-3.2 * t);
    lpL += 0.35 * (random() * 2 - 1 - lpL);
    lpR += 0.35 * (random() * 2 - 1 - lpR);
    left[n] = lpL * env;
    right[n] = lpR * env;
  }
  return [left, right];
}
