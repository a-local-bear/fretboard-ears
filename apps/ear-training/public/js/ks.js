// Pure Karplus–Strong synthesis (no Web Audio here, so it can be unit-tested in Node).

export const DECAY_SECONDS = 3.2; // time for the fundamental to fall 60 dB
export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Delay length and playback-rate correction. The averaging loop filter adds half a sample of
 * delay, so the rendered pitch is sr/(N+0.5); playing at `rate` lands exactly on f.
 */
export function ksParams(f, sr) {
  const N = Math.max(2, Math.round(sr / f - 0.5));
  return { N, rate: (f * (N + 0.5)) / sr, rho: 10 ** (-3 / (DECAY_SECONDS * f)) };
}

/**
 * Render a plucked string at frequency f. Returns a peak-normalised Float32Array.
 * `rng` is injectable for deterministic tests.
 */
export function renderPluck(f, sr, { seconds = DECAY_SECONDS + 0.3, pluckPos = 0.18, rng = Math.random } = {}) {
  const { N, rho } = ksParams(f, sr);
  const len = Math.ceil(sr * seconds);
  const y = new Float32Array(len);

  // Excitation: white noise, pluck-position comb, two smoothing passes, DC removed.
  let exc = new Float32Array(N);
  for (let i = 0; i < N; i++) exc[i] = rng() * 2 - 1;
  const P = Math.max(1, Math.round(N * pluckPos));
  const comb = new Float32Array(N);
  for (let i = 0; i < N; i++) comb[i] = exc[i] - (i >= P ? exc[i - P] : 0);
  exc = comb;
  for (let pass = 0; pass < 2; pass++) {
    const s = new Float32Array(N);
    for (let i = 0; i < N; i++) s[i] = 0.5 * (exc[i] + exc[(i + N - 1) % N]);
    exc = s;
  }
  let mean = 0;
  for (let i = 0; i < N; i++) mean += exc[i];
  mean /= N;
  for (let i = 0; i < Math.min(N, len); i++) y[i] = exc[i] - mean;

  // Feedback loop: y[n] = rho · ½(y[n−N] + y[n−N−1]).
  for (let n = N; n < len; n++) y[n] = rho * 0.5 * (y[n - N] + (n - N - 1 >= 0 ? y[n - N - 1] : 0));

  // Short fade at the very end so a buffer never clicks off.
  const fade = Math.min(len, Math.round(sr * 0.25));
  for (let i = 0; i < fade; i++) y[len - 1 - i] *= i / fade;

  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
  if (peak > 0) for (let i = 0; i < len; i++) y[i] /= peak;
  return y;
}
