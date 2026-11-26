import { describe, expect, it } from 'vitest';
import type { Placed, Tile } from '@gaflex/shared';
import { resolveEndChoice } from './endChoice';

const t = (a: number, b: number): Tile => ({ id: `${a}-${b}`, a, b });

/**
 * Simple horizontal chain: left end at -X (val 2), right end at +X (val 5)
 * Wait: for N/S facing +/-Z, E/W view is tested both short and snaked.
 */
const straightChain: Placed[] = [
  { tile: t(0, 0), side: 'left', flipped: false, order: 0 },
  { tile: t(0, 2), side: 'left', flipped: false, order: 1 },
  { tile: t(0, 5), side: 'right', flipped: false, order: 2 },
];

describe('resolveEndChoice (POV left/right mapping per seat)', () => {
  it('South sees chain left (-X) on left and chain right (+X) on right', () => {
    const choice = resolveEndChoice(straightChain, [2, 5], t(2, 5), 'S');
    expect(choice.leftOption.side).toBe('left');
    expect(choice.leftOption.endValue).toBe(2);
    expect(choice.rightOption.side).toBe('right');
    expect(choice.rightOption.endValue).toBe(5);
  });

  it('North sits opposite South, so chain right (+X) is on North’s left and chain left (-X) is on North’s right', () => {
    const choice = resolveEndChoice(straightChain, [2, 5], t(2, 5), 'N');
    expect(choice.leftOption.side).toBe('right');
    expect(choice.leftOption.endValue).toBe(5);
    expect(choice.rightOption.side).toBe('left');
    expect(choice.rightOption.endValue).toBe(2);
  });

  it('handles identical open ends [3, 3] distinctly for South vs North', () => {
    const equalEndsChain: Placed[] = [
      { tile: t(0, 0), side: 'left', flipped: false, order: 0 },
      { tile: t(0, 3), side: 'left', flipped: false, order: 1 },
      { tile: t(0, 3), side: 'right', flipped: false, order: 2 },
    ];
    const south = resolveEndChoice(equalEndsChain, [3, 3], t(3, 3), 'S');
    const north = resolveEndChoice(equalEndsChain, [3, 3], t(3, 3), 'N');
    expect(south.leftOption.side).toBe('left');
    expect(south.rightOption.side).toBe('right');
    expect(north.leftOption.side).toBe('right');
    expect(north.rightOption.side).toBe('left');
  });

  it('East and West match snaked left/right directions and are consistent before snaking', () => {
    // Build a long chain that snakes (-Z for left arm, +Z for right arm)
    const snaked: Placed[] = [{ tile: t(0, 0), side: 'left', flipped: false, order: 0 }];
    for (let i = 1; i <= 5; i++) {
      snaked.push({ tile: t(i, 6), side: 'left', flipped: false, order: snaked.length });
      snaked.push({ tile: t(0, i), side: 'right', flipped: false, order: snaked.length });
    }
    snaked.push({ tile: t(1, 2), side: 'left', flipped: false, order: snaked.length });
    snaked.push({ tile: t(1, 5), side: 'right', flipped: false, order: snaked.length });
    const westSnaked = resolveEndChoice(snaked, [2, 5], t(2, 5), 'W');
    const eastSnaked = resolveEndChoice(snaked, [2, 5], t(2, 5), 'E');
    expect(westSnaked.leftOption.side).toBe('left');
    expect(westSnaked.rightOption.side).toBe('right');
    expect(eastSnaked.leftOption.side).toBe('right');
    expect(eastSnaked.rightOption.side).toBe('left');

    // Straight un-snaked chain follows the same choice so turning corners never flips buttons
    const westStraight = resolveEndChoice(straightChain, [2, 5], t(2, 5), 'W');
    const eastStraight = resolveEndChoice(straightChain, [2, 5], t(2, 5), 'E');
    expect(westStraight.leftOption.side).toBe('left');
    expect(eastStraight.leftOption.side).toBe('right');
  });
});
