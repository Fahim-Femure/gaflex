/**
 * The "tak" of a tile landing on the table (docs/05), synthesised with Web Audio:
 * a short band-passed noise burst over a low knock. No audio files to load or license.
 * Browsers only allow audio after a user gesture; `unlockAudio` is called on the first tap.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

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

export function unlockAudio() {
  const c = context();
  if (c?.state === 'suspended') void c.resume();
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
