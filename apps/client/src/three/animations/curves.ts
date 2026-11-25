import { SEAT_ORDER, type Seat } from '@gaflex/shared';
import type { TableBounds } from '../layout/layoutChain';

/** Stage animations (docs/05: 600–1200 ms; push-slam is faster and punchier). */
export const DEAL_MS = 1200;
export const FLIGHT_MS = 750;
export const SLAM_FLIGHT_MS = 440;
export const SLAM_IMPACT_T = 0.7;
export const HAND_ENTER_MS = 500;
export const HAND_STAGGER_MS = 80;

export type Vec3 = [number, number, number];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOutCubic = (x: number) => 1 - (1 - clamp01(x)) ** 3;
export const easeInOutCubic = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};

/** Point just off the felt on a seat's side, slightly raised (table frame: N = -Z, S = +Z). */
export function seatEdge(seat: Seat, bounds: TableBounds): Vec3 {
  const m = 1.2;
  switch (seat) {
    case 'N':
      return [0, 0.6, -(bounds.halfDepth + m)];
    case 'S':
      return [0, 0.6, bounds.halfDepth + m];
    case 'E':
      return [bounds.halfWidth + m, 0.6, 0];
    case 'W':
      return [-(bounds.halfWidth + m), 0.6, 0];
  }
}

const TRAVEL_END = 0.8; // the rest of the flight is the landing bounce
const ARC = 3;
const BOUNCE = 0.25;
const SLAM_ARC = 4.2;
const SLAM_BOUNCE = 0.16;

/**
 * A played tile flying from its seat to its place on the chain (docs/06 useTileFlight):
 * quadratic Bézier arc, rotation finished before touchdown, then a small bounce.
 * When `slam` is true (push-forward throw), it winds up higher, accelerates into impact at
 * SLAM_IMPACT_T, and settles with a crisp recoil.
 * `spin` is 0..1 progress for slerping from the start rotation to the final one.
 */
export function flightPose(from: Vec3, to: Vec3, t: number, slam = false): { position: Vec3; spin: number } {
  const impactT = slam ? SLAM_IMPACT_T : TRAVEL_END;
  const spinEnd = slam ? 0.58 : 0.75;
  const spin = easeInOutCubic(t / spinEnd);
  if (t <= impactT) {
    const raw = clamp01(t / impactT);
    const u = slam ? 0.35 * raw + 0.65 * raw * raw : easeOutCubic(raw);
    const arc = slam ? SLAM_ARC : ARC;
    const ctrl: Vec3 = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + arc, (from[2] + to[2]) / 2];
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    return {
      position: [
        a * from[0] + b * ctrl[0] + c * to[0],
        a * from[1] + b * ctrl[1] + c * to[1],
        a * from[2] + b * ctrl[2] + c * to[2],
      ],
      spin,
    };
  }
  const v = clamp01((t - impactT) / (1 - impactT));
  const bounce = slam ? SLAM_BOUNCE : BOUNCE;
  return { position: [to[0], to[1] + bounce * Math.sin(Math.PI * v) * (1 - v), to[2]], spin };
}

const GATHER_END = 0.45;

/**
 * Shuffle-and-deal (docs/05: 28 tiles spin in the centre, then 7 fly to each seat, 1.2 s).
 * `t` is 0..1 over DEAL_MS.
 */
export function dealPose(index: number, t: number, bounds: TableBounds): { position: Vec3; seat: Seat; yaw: number } {
  const seat = SEAT_ORDER[index % 4]!;
  const angle0 = (index / 28) * Math.PI * 2;
  const r = 1.6 + (index % 2) * 0.6;
  const spinAngle = angle0 + easeInOutCubic(Math.min(t, GATHER_END) / GATHER_END) * Math.PI * 1.5;
  const ring: Vec3 = [r * Math.cos(spinAngle), 0.3 + (index % 3) * 0.05, r * Math.sin(spinAngle)];
  if (t <= GATHER_END) return { position: ring, seat, yaw: spinAngle };

  const u = easeInOutCubic((t - GATHER_END) / (1 - GATHER_END));
  const edge = seatEdge(seat, bounds);
  const k = Math.floor(index / 4) - 3; // -3..3 along the seat's edge
  const along = seat === 'N' || seat === 'S' ? ([k * 0.2, 0, 0] as Vec3) : ([0, 0, k * 0.2] as Vec3);
  const target: Vec3 = [edge[0] + along[0], edge[1], edge[2] + along[2]];
  return {
    position: [ring[0] + (target[0] - ring[0]) * u, ring[1] + (target[1] - ring[1]) * u, ring[2] + (target[2] - ring[2]) * u],
    seat,
    yaw: spinAngle,
  };
}

/** Hand entrance (docs/05): staggered 80 ms, rise from below, then flip to face the player. */
export function handEnterPose(index: number, elapsedMs: number): { rise: number; flip: number } {
  const local = elapsedMs - index * HAND_STAGGER_MS;
  if (local < 0) return { rise: 0, flip: 0 };
  return {
    rise: easeOutCubic(local / (HAND_ENTER_MS * 0.5)),
    flip: easeInOutCubic((local - HAND_ENTER_MS * 0.35) / (HAND_ENTER_MS * 0.65)),
  };
}
