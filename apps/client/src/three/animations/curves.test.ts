import { describe, expect, it } from 'vitest';
import { SEAT_ORDER } from '@gaflex/shared';
import {
  DEAL_MS,
  FLIGHT_MS,
  HAND_ENTER_MS,
  HAND_STAGGER_MS,
  dealPose,
  flightPose,
  handEnterPose,
  seatEdge,
} from './curves';

const bounds = { halfWidth: 9, halfDepth: 7 };
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('durations follow docs/05 (stage animations 600–1200 ms)', () => {
  it('deal is 1.2 s, flight within the stage range, hand stagger 80 ms', () => {
    expect(DEAL_MS).toBe(1200);
    expect(FLIGHT_MS).toBeGreaterThanOrEqual(600);
    expect(FLIGHT_MS).toBeLessThanOrEqual(1200);
    expect(HAND_STAGGER_MS).toBe(80);
  });
});

describe('seatEdge', () => {
  it('sits just outside the felt on the seat side (table frame)', () => {
    const s = seatEdge('S', bounds);
    expect(s[2]).toBeGreaterThan(bounds.halfDepth);
    expect(seatEdge('N', bounds)[2]).toBeLessThan(-bounds.halfDepth);
    expect(seatEdge('E', bounds)[0]).toBeGreaterThan(bounds.halfWidth);
    expect(seatEdge('W', bounds)[0]).toBeLessThan(-bounds.halfWidth);
  });
});

describe('flightPose', () => {
  const from: [number, number, number] = [0, 1, 9];
  const to: [number, number, number] = [3, 0.15, 0];

  it('starts at the seat and lands exactly on the target', () => {
    expect(dist(flightPose(from, to, 0).position, from)).toBeCloseTo(0);
    expect(dist(flightPose(from, to, 1).position, to)).toBeCloseTo(0);
  });

  it('arcs above both ends mid-flight', () => {
    expect(flightPose(from, to, 0.4).position[1]).toBeGreaterThan(from[1]);
  });

  it('bounces a little after touching down, then settles', () => {
    const touch = flightPose(from, to, 0.82).position[1];
    const bounce = flightPose(from, to, 0.91).position[1];
    expect(bounce).toBeGreaterThan(to[1]);
    expect(bounce - to[1]).toBeLessThan(0.4);
    expect(touch).toBeGreaterThanOrEqual(to[1] - 1e-9);
  });

  it('rotation progress runs 0 -> 1 and finishes before landing', () => {
    expect(flightPose(from, to, 0).spin).toBe(0);
    expect(flightPose(from, to, 0.85).spin).toBeCloseTo(1);
  });
});

describe('dealPose', () => {
  it('starts gathered in the centre and ends at each tile\'s seat, 7 per seat', () => {
    const perSeat = new Map<string, number>();
    for (let i = 0; i < 28; i++) {
      const start = dealPose(i, 0, bounds);
      expect(Math.hypot(start.position[0], start.position[2])).toBeLessThan(3);
      const end = dealPose(i, 1, bounds);
      perSeat.set(end.seat, (perSeat.get(end.seat) ?? 0) + 1);
      expect(dist(end.position, seatEdge(end.seat, bounds))).toBeLessThan(1.5);
    }
    expect(SEAT_ORDER.map((s) => perSeat.get(s))).toEqual([7, 7, 7, 7]);
  });

  it('spins in the first phase (angle changes while still central)', () => {
    const a = dealPose(0, 0, bounds);
    const b = dealPose(0, 0.3, bounds);
    expect(a.position).not.toEqual(b.position);
    expect(Math.hypot(b.position[0], b.position[2])).toBeLessThan(3);
  });
});

describe('handEnterPose', () => {
  it('waits for its stagger, rises, then flips to face the player', () => {
    const before = handEnterPose(3, 3 * HAND_STAGGER_MS - 1);
    expect(before.rise).toBe(0);
    expect(before.flip).toBe(0);
    const done = handEnterPose(3, 3 * HAND_STAGGER_MS + HAND_ENTER_MS);
    expect(done.rise).toBe(1);
    expect(done.flip).toBe(1);
  });

  it('later tiles start later', () => {
    const t = 200;
    expect(handEnterPose(0, t).rise).toBeGreaterThan(handEnterPose(2, t).rise);
  });

  it('rises before it flips', () => {
    const mid = handEnterPose(0, HAND_ENTER_MS * 0.35);
    expect(mid.rise).toBeGreaterThan(mid.flip);
  });
});
