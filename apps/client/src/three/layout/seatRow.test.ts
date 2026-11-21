import { describe, expect, it } from 'vitest';
import type { Seat } from '@gaflex/shared';
import { TABLE_BOUNDS, CHAIN_BOUNDS, TILE } from './layoutChain';
import { seatRow } from './seatRow';

const facing = (yaw: number): [number, number] => [Math.sin(yaw), Math.cos(yaw)];

describe('seatRow (tiles standing at a seat, like a real player\'s row)', () => {
  it('returns one standing tile per card, base on the felt', () => {
    const row = seatRow('S', 7);
    expect(row).toHaveLength(7);
    for (const t of row) expect(t.position[1]).toBeCloseTo(TILE.length / 2);
  });

  it('lines the row up along the seat edge, centred, left to right for that player', () => {
    const row = seatRow('S', 7);
    const xs = row.map((t) => t.position[0]);
    expect(xs[3]).toBeCloseTo(0);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(TILE.width);
    for (const t of row) expect(t.position[2]).toBeCloseTo(row[0]!.position[2]);
  });

  it('faces each tile toward its own seat (so opponents show us their backs)', () => {
    const outward: Record<Seat, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
    for (const seat of ['N', 'E', 'S', 'W'] as Seat[]) {
      const [fx, fz] = facing(seatRow(seat, 3)[0]!.yaw);
      expect(fx).toBeCloseTo(outward[seat][0]);
      expect(fz).toBeCloseTo(outward[seat][1]);
    }
  });

  it('stays on the felt and outside the chain area', () => {
    for (const seat of ['N', 'E', 'S', 'W'] as Seat[]) {
      for (const t of seatRow(seat, 7)) {
        const [x, , z] = t.position;
        expect(Math.abs(x)).toBeLessThanOrEqual(TABLE_BOUNDS.halfWidth);
        expect(Math.abs(z)).toBeLessThanOrEqual(TABLE_BOUNDS.halfDepth);
        const insideChain = Math.abs(x) < CHAIN_BOUNDS.halfWidth && Math.abs(z) < CHAIN_BOUNDS.halfDepth;
        expect(insideChain).toBe(false);
      }
    }
  });
});
