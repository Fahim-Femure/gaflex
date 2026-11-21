import { describe, expect, it } from 'vitest';
import type { Seat } from '@gaflex/shared';
import { seatSlot, tableYaw } from './orientation';

/** Where a table-frame point (x, z) ends up after the yaw (three.js Y rotation). */
function rotate([x, z]: [number, number], yaw: number): [number, number] {
  return [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
}

const SEAT_POS: Record<Seat, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

describe('seatSlot', () => {
  it('table display: south at the bottom, west left, north top, east right', () => {
    expect((['S', 'W', 'N', 'E'] as Seat[]).map((s) => seatSlot(s, 'S'))).toEqual(['bottom', 'left', 'top', 'right']);
  });

  it('a player always sees their own seat at the bottom; clockwise play puts the next seat on the left', () => {
    for (const me of ['N', 'E', 'S', 'W'] as Seat[]) expect(seatSlot(me, me)).toBe('bottom');
    expect(seatSlot('S', 'E')).toBe('left'); // after E comes S
    expect(seatSlot('N', 'E')).toBe('right');
    expect(seatSlot('W', 'E')).toBe('top');
  });
});

describe('tableYaw', () => {
  it('rotates the table so the bottom seat faces the camera (+Z) and slots agree', () => {
    const slotPos = { bottom: [0, 1], top: [0, -1], left: [-1, 0], right: [1, 0] } as const;
    for (const bottom of ['N', 'E', 'S', 'W'] as Seat[]) {
      const yaw = tableYaw(bottom);
      for (const seat of ['N', 'E', 'S', 'W'] as Seat[]) {
        const [x, z] = rotate(SEAT_POS[seat], yaw);
        const [ex, ez] = slotPos[seatSlot(seat, bottom)];
        expect(x).toBeCloseTo(ex);
        expect(z).toBeCloseTo(ez);
      }
    }
  });
});
