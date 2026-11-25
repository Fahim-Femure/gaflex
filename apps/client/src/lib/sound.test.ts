import { describe, expect, it } from 'vitest';
import { analyzeCetasSamples, computeCetasPlayback } from './sound';

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
