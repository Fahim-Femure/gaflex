import { describe, expect, it } from 'vitest';
import type { Placed, Tile } from '@gaflex/shared';
import { chainSequence, PIP_SPOTS } from './chain';

const t = (a: number, b: number): Tile => ({ id: `${a}-${b}`, a, b });

describe('chainSequence', () => {
  it('returns an empty list for an empty table', () => {
    expect(chainSequence([])).toEqual([]);
  });

  it('lays tiles out left to right with their facing values', () => {
    // played: 6-6 open, then 4-6 left (flipped -> [4|6]... shows 4 outward), 6-1 right, 2-4 left
    const chain: Placed[] = [
      { tile: t(6, 6), side: 'left', flipped: false, order: 0 },
      { tile: t(4, 6), side: 'left', flipped: false, order: 1 }, // shows [4|6]
      { tile: t(1, 6), side: 'right', flipped: true, order: 2 }, // shows [6|1]
      { tile: t(2, 4), side: 'left', flipped: false, order: 3 }, // shows [2|4]
    ];
    expect(chainSequence(chain).map((x) => [x.left, x.right, x.double])).toEqual([
      [2, 4, false],
      [4, 6, false],
      [6, 6, true],
      [6, 1, false],
    ]);
  });

  it('keeps the tile id for keys and animation', () => {
    const chain: Placed[] = [{ tile: t(3, 5), side: 'right', flipped: false, order: 0 }];
    expect(chainSequence(chain)[0]!.id).toBe('3-5');
  });
});

describe('PIP_SPOTS', () => {
  it('has the right number of spots for 0..6', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => PIP_SPOTS[n]!.length)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('uses cells 0..8 of a 3x3 grid', () => {
    for (const spots of PIP_SPOTS) for (const c of spots) expect(c >= 0 && c <= 8).toBe(true);
  });
});
