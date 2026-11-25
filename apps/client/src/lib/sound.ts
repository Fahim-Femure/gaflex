import cetasUrl from '../assets/sounds/cetas.mp3';

/**
 * Tile audio engine:
 * - `playTak`: synthesised Web Audio knock for a normal tap play.
 * - `playCetas`: preloaded & dynamics-boosted `cetas.mp3` sample for a firm push-forward slam,
 *   trimmed past leading silence and scheduled so the crack transient hits at exact touchdown.
 * Browsers only allow audio after a user gesture; `unlockAudio` is called on the first tap.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let cetasLoaded: { buffer: AudioBuffer; impactOffsetSec: number; preGain: number } | null = null;
let cetasPromise: Promise<void> | null = null;

const LEAD_IN_SEC = 0.22;
const TAIL_SEC = 0.95;

export type CetasAnalysis = { impactOffsetSec: number; preGain: number };
export type CetasPlaybackPlan = { when: number; offset: number; duration: number };

/** Finds the transient impact offset past leading silence and computes a punchy pre-gain. */
export function analyzeCetasSamples(samples: ArrayLike<number>, sampleRate: number): CetasAnalysis {
  if (samples.length === 0 || sampleRate <= 0) return { impactOffsetSec: 0, preGain: 2.0 };
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]!);
    if (v > peak) peak = v;
  }
  if (peak <= 0) return { impactOffsetSec: 0, preGain: 2.0 };
  const threshold = peak * 0.55;
  let impactIdx = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]!) >= threshold) {
      impactIdx = i;
      break;
    }
  }
  const rawGain = (1 / Math.max(0.1, peak)) * 1.75;
  const preGain = Math.min(3.2, Math.max(1.8, rawGain));
  return { impactOffsetSec: impactIdx / sampleRate, preGain };
}

/**
 * Schedules playback so `when + (impactOffsetSec - offset) === nowSec + impactDelaySec`,
 * including up to 220 ms of pre-impact whoosh while trimming leading & trailing silence.
 */
export function computeCetasPlayback(
  nowSec: number,
  impactDelaySec: number,
  impactOffsetSec: number,
  bufferDurationSec: number,
): CetasPlaybackPlan {
  const delay = Math.max(0, impactDelaySec);
  const lead = Math.min(LEAD_IN_SEC, impactOffsetSec, delay);
  const offset = Math.max(0, impactOffsetSec - lead);
  const when = nowSec + delay - lead;
  const remaining = Math.max(0.05, bufferDurationSec - offset);
  const duration = Math.min(remaining, lead + TAIL_SEC);
  return { when, offset, duration };
}

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  const length = Math.floor(ctx.sampleRate * 0.08);
  noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  return ctx;
}

function analyzeDecoded(buffer: AudioBuffer): CetasAnalysis {
  let best = { impactOffsetSec: 0, preGain: 2.0 };
  let maxPeak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]!);
      if (v > peak) peak = v;
    }
    if (peak > maxPeak) {
      maxPeak = peak;
      best = analyzeCetasSamples(data, buffer.sampleRate);
    }
  }
  return best;
}

export function preloadCetas(): Promise<void> {
  if (cetasLoaded || cetasPromise) return cetasPromise ?? Promise.resolve();
  const c = context();
  if (!c || typeof fetch !== 'function') return Promise.resolve();
  cetasPromise = fetch(cetasUrl)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('cetas fetch failed'))))
    .then((arr) => c.decodeAudioData(arr))
    .then((buffer) => {
      const analysis = analyzeDecoded(buffer);
      cetasLoaded = { buffer, ...analysis };
    })
    .catch(() => {
      cetasPromise = null; // allow retry on next interaction if offline
    });
  return cetasPromise;
}

export function unlockAudio() {
  const c = context();
  if (c?.state === 'suspended') void c.resume();
  void preloadCetas();
}

export function playTak(volume = 0.6) {
  const c = context();
  if (!c || !noise || c.state !== 'running') return;
  const t = c.currentTime;

  // the click of hard plastic on wood
  const src = c.createBufferSource();
  src.buffer = noise;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400;
  band.Q.value = 1.2;
  const clickGain = c.createGain();
  clickGain.gain.setValueAtTime(volume, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src.connect(band).connect(clickGain).connect(c.destination);
  src.start(t);

  // the body of the knock
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(240, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.06);
  const knockGain = c.createGain();
  knockGain.gain.setValueAtTime(volume * 0.5, t);
  knockGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(knockGain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Plays the boosted "cetas" slam audio so its main crack hits at `impactDelaySec`. */
export function playCetas(impactDelaySec = 0) {
  const c = context();
  if (!c) return;
  void preloadCetas();
  if (c.state !== 'running') return;
  if (!cetasLoaded) {
    window.setTimeout(() => playTak(1.0), Math.max(0, impactDelaySec * 1000));
    return;
  }

  const { buffer, impactOffsetSec, preGain } = cetasLoaded;
  const plan = computeCetasPlayback(c.currentTime, impactDelaySec, impactOffsetSec, buffer.duration);

  const src = c.createBufferSource();
  src.buffer = buffer;

  const boost = c.createGain();
  boost.gain.value = preGain;

  // DynamicsCompressor boosts perceived loudness and punch while preventing digital clipping.
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -5;
  comp.knee.value = 4;
  comp.ratio.value = 14;
  comp.attack.value = 0.001;
  comp.release.value = 0.09;

  const out = c.createGain();
  out.gain.value = 1.15;

  src.connect(boost).connect(comp).connect(out).connect(c.destination);
  src.start(plan.when, plan.offset, plan.duration);
}
