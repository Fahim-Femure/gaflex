import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSoundForTests,
  analyzeCetasSamples,
  computeCetasPlayback,
  playCetas,
} from './sound';

afterEach(() => {
  __resetSoundForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('analyzeCetasSamples', () => {
  it('finds the impact onset past leading silence and computes boosted pre-gain', () => {
    const sr = 1000;
    const samples = new Float32Array(3000);
    // 1.8 s silence, 0.2 s quiet whoosh (0.04), main crack at 2.02 s (peak 0.6)
    for (let i = 1800; i < 2010; i++) samples[i] = 0.04;
    samples[2018] = 0.4; // >= 0.6 * 0.55 = 0.33
    samples[2030] = -0.6;
    const analysis = analyzeCetasSamples(samples, sr);
    expect(analysis.impactOffsetSec).toBeCloseTo(2.018);
    expect(analysis.preGain).toBeGreaterThanOrEqual(2.5);
    expect(analysis.preGain).toBeLessThanOrEqual(3.2);
  });

  it('clamps preGain safely for quiet or already-loud buffers and handles empty buffers', () => {
    expect(analyzeCetasSamples(new Float32Array(0), 44100)).toEqual({ impactOffsetSec: 0, preGain: 2.0 });
    expect(analyzeCetasSamples(new Float32Array([0.05]), 1000).preGain).toBe(3.2);
    expect(analyzeCetasSamples(new Float32Array([1.0]), 1000).preGain).toBe(1.8);
  });
});

describe('computeCetasPlayback', () => {
  it('skips leading silence and aligns the impact sample with impactDelaySec', () => {
    const plan = computeCetasPlayback(10.0, 0.308, 2.018, 6.0);
    // plays 0.22 s of pre-impact whoosh, so starts at now + (0.308 - 0.22) = 10.088
    expect(plan.when).toBeCloseTo(10.088);
    expect(plan.offset).toBeCloseTo(2.018 - 0.22);
    // impact time = when + (impactOffsetSec - offset) = 10.308
    expect(plan.when + (2.018 - plan.offset)).toBeCloseTo(10.308);
    expect(plan.duration).toBeGreaterThan(0.9);
    expect(plan.duration).toBeLessThan(1.3);
  });

  it('starts immediately and trims lead-in when impactDelaySec is shorter (reduced motion)', () => {
    const plan = computeCetasPlayback(5.0, 0.09, 2.018, 6.0);
    expect(plan.when).toBeCloseTo(5.0);
    expect(plan.offset).toBeCloseTo(2.018 - 0.09);
    expect(plan.when + (2.018 - plan.offset)).toBeCloseTo(5.09);
  });
});

describe('playCetas async unlock & decode resilience', () => {
  function makeAudioMocks(opts: { staysSuspended?: boolean; resumeDelayMs?: number } = {}) {
    const started: Array<{ when?: number; offset?: number; duration?: number }> = [];
    const samples = new Float32Array(4000);
    samples[2000] = 0.5;
    const decodedBuffer = {
      sampleRate: 1000,
      duration: 4.0,
      numberOfChannels: 1,
      getChannelData: () => samples,
    };
    const makeNode = () => ({
      connect: vi.fn((next) => next),
      gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      Q: { value: 0 },
      type: 'bandpass',
      buffer: null as unknown,
      start: vi.fn((when?: number, offset?: number, duration?: number) => {
        started.push({ when, offset, duration });
      }),
      stop: vi.fn(),
    });

    const ctx = {
      state: 'suspended' as string,
      currentTime: 10.0,
      sampleRate: 1000,
      destination: {},
      resume: vi.fn(async () => {
        if (opts.resumeDelayMs) await new Promise((r) => setTimeout(r, opts.resumeDelayMs));
        if (!opts.staysSuspended) ctx.state = 'running';
      }),
      createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(80) })),
      createBufferSource: vi.fn(() => makeNode()),
      createGain: vi.fn(() => makeNode()),
      createDynamicsCompressor: vi.fn(() => makeNode()),
      createBiquadFilter: vi.fn(() => makeNode()),
      createOscillator: vi.fn(() => makeNode()),
      decodeAudioData: vi.fn(async () => decodedBuffer),
    };

    vi.stubGlobal('AudioContext', vi.fn(function AudioContextMock() { return ctx; }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
    );
    return { ctx, started };
  }

  it('awaits async resume() and decodeAudioData() and adjusts remaining impactDelaySec', async () => {
    const { ctx, started } = makeAudioMocks({ resumeDelayMs: 50 });
    await playCetas(0.308);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(started).toHaveLength(1);
    const call = started[0]!;
    // Total scheduled time (when + (impactOffset - offset)) must be <= 10 + 0.308 because ~50ms elapsed
    const scheduledImpact = call.when! + (2.0 - call.offset!);
    expect(scheduledImpact).toBeGreaterThanOrEqual(10.0);
    expect(scheduledImpact).toBeLessThan(10.308);
  });

  it('falls back to HTMLAudioElement when AudioContext stays suspended', async () => {
    makeAudioMocks({ staysSuspended: true });
    const audioPlay = vi.fn(async () => {});
    const audioInstances: Array<{ volume: number; currentTime: number; play: typeof audioPlay }> = [];
    vi.stubGlobal(
      'Audio',
      vi.fn(function AudioMock() {
        const inst = { volume: 0, currentTime: 0, play: audioPlay };
        audioInstances.push(inst);
        return inst;
      }),
    );

    await playCetas(0.05);
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0]!.volume).toBe(1);
    expect(audioInstances[0]!.currentTime).toBeCloseTo(1.85);
    expect(audioPlay).toHaveBeenCalledTimes(1);
  });
});
