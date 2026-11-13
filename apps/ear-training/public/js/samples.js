// Recorded clean electric guitar samples (FatBoy soundfont, CC BY-SA 3.0; see samples/eg-clean/ATTRIBUTION.md).

export const SAMPLE_DIR = 'samples/eg-clean';
export const SAMPLE_RANGE = [40, 76]; // E2 … E5

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** MIDI → note name as used by the source files (flats), e.g. 58 → "Bb3", 60 → "C4". */
export const midiToName = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

export const sampleUrl = (midi) => `${SAMPLE_DIR}/${midi}.mp3`;
export const hasSample = (midi) => midi >= SAMPLE_RANGE[0] && midi <= SAMPLE_RANGE[1];

/**
 * Index of the first sample above `threshold` of the peak, backed off by `leadIn` samples.
 * Pure, so it can be tested without Web Audio.
 */
export function onsetIndex(data, peak, threshold = 0.01, leadIn = 0) {
  const limit = peak * threshold;
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > limit) return Math.max(0, i - leadIn);
  return 0;
}

const cache = new Map(); // midi → Promise<entry | null>

/**
 * Fetch, decode and trim one sample. Resolves to { buffer, rate, gain } or null on any failure
 * (the caller then falls back to the synth). `base` is the URL of the site root, for pages that
 * are not at the root themselves.
 */
export function loadSample(ctx, midi, base = '') {
  if (!hasSample(midi)) return Promise.resolve(null);
  if (!cache.has(midi)) {
    cache.set(midi, (async () => {
      try {
        const res = await fetch(base + sampleUrl(midi));
        if (!res.ok) throw new Error(res.status);
        const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
        // Peak over all channels; trim the MP3 encoder's leading silence so chords stay in time.
        let peak = 0;
        const chans = [];
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          const d = decoded.getChannelData(c);
          chans.push(d);
          for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
        }
        if (peak === 0) throw new Error('silent');
        const start = Math.min(...chans.map((d) => onsetIndex(d, peak, 0.01, Math.round(decoded.sampleRate * 0.002))));
        const buffer = ctx.createBuffer(decoded.numberOfChannels, decoded.length - start, decoded.sampleRate);
        chans.forEach((d, c) => buffer.copyToChannel(d.subarray(start), c));
        return { buffer, rate: 1, gain: 0.9 / peak };
      } catch {
        cache.delete(midi); // allow a retry later (e.g. after coming back online)
        return null;
      }
    })());
  }
  return cache.get(midi);
}
