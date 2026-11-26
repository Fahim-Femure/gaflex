import type { Seat } from '@gaflex/shared';
import { TABLE_BOUNDS } from '../layout/layoutChain';
import { easeInOutCubic, type Vec3 } from './curves';

export const CAMERA_FOV = 50;
/** docs/05: the View/Intip camera move takes 900 ms, ease-in-out. */
export const CAMERA_MS = 900;
export const CAMERA_ZOOM_MS = 260;
export const PEEK_ZOOM_MIN = 1;
export const PEEK_ZOOM_MAX = 2.2;
export const PEEK_ZOOM_STEP = 0.4;

export type CameraMode = 'pov' | 'peek';
export type CameraPoseValue = { position: Vec3; target: Vec3 };

const RIM = 0.8;
const ROW_HALF = 7 * 0.6 + 0.2; // seven standing tiles plus a margin

/** The table as the player sees it (their seat at +Z), after PlayerScene rotates it. */
export type ViewFrame = { rowZ: number; halfWidth: number; halfDepth: number };

/** South/North look across the short side of the 20×16 table; East/West across the long side. */
export function viewFrame(seat: Seat): ViewFrame {
  const sideways = seat === 'E' || seat === 'W';
  const halfWidth = sideways ? TABLE_BOUNDS.halfDepth : TABLE_BOUNDS.halfWidth;
  const halfDepth = sideways ? TABLE_BOUNDS.halfWidth : TABLE_BOUNDS.halfDepth;
  return { rowZ: halfDepth - 1.2, halfWidth, halfDepth };
}

/** Normalised screen position (-1..1 on both axes, +Y up) of a point seen from `pose`. */
export function projectPoint(pose: CameraPoseValue, aspect: number, p: Vec3): [number, number] {
  const t = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a: Vec3): Vec3 => {
    const l = Math.hypot(...a);
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const forward = norm(sub(pose.target, pose.position));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const v = sub(p, pose.position);
  const depth = dot(v, forward);
  return [dot(v, right) / (depth * t * aspect), dot(v, up) / (depth * t)];
}

/**
 * Camera presets in the table frame with the player's seat at +Z.
 * pov: eye level behind the player's own row, looking across the table (the reference video).
 * peek ("Intip"): high above, the whole table in view.
 */
export function cameraPreset(mode: CameraMode, aspect: number, seat: Seat, peekZoom = PEEK_ZOOM_MIN): CameraPoseValue {
  const frame = viewFrame(seat);
  if (mode === 'pov') return povPreset(aspect, frame);
  return peekPreset(aspect, frame, peekZoom);
}

const PEEK_TOP_LIMIT = 0.72; // keeps the top rim and top standing row below the top opponent's name chip
const PEEK_BOTTOM_LIMIT = -0.95;
const PEEK_SIDE_LIMIT = 0.94;

/**
 * Overhead Intip camera: shifts the look-at target slightly toward -Z so the whole table drops
 * below the top-edge opponent chip, and zooms out until rim + standing rows fit with clearance.
 * Values above PEEK_ZOOM_MIN lower the camera height proportionally and center toward [0, 0, 0].
 */
function peekPreset(aspect: number, frame: ViewFrame, peekZoom = PEEK_ZOOM_MIN): CameraPoseValue {
  const t = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const halfW = frame.halfWidth + RIM;
  const halfD = frame.halfDepth + RIM;
  const target: Vec3 = [0, 0, -0.9];
  const base = Math.max(halfD / t, halfW / (t * aspect));
  const pose = (k: number): CameraPoseValue => {
    const height = base * k;
    return { position: [0, height, target[2] + height * 0.22], target };
  };
  const fits = (p: CameraPoseValue) => {
    const [, nyRimTop] = projectPoint(p, aspect, [0, 0, -halfD]);
    const [, nyRowTop] = projectPoint(p, aspect, [0, 2, -frame.rowZ]);
    const [, nyRimBot] = projectPoint(p, aspect, [0, 0, halfD]);
    const nxSide = Math.max(
      Math.abs(projectPoint(p, aspect, [halfW, 0, halfD])[0]),
      Math.abs(projectPoint(p, aspect, [halfW, 0, -halfD])[0]),
    );
    return Math.max(nyRimTop, nyRowTop) <= PEEK_TOP_LIMIT && nyRimBot >= PEEK_BOTTOM_LIMIT && nxSide <= PEEK_SIDE_LIMIT;
  };
  let basePose = pose(1.5);
  for (let k = 1.0; k <= 1.8; k += 0.01) {
    const p = pose(k);
    if (fits(p)) {
      basePose = p;
      break;
    }
  }
  const z = Math.min(PEEK_ZOOM_MAX, Math.max(PEEK_ZOOM_MIN, peekZoom));
  if (z <= PEEK_ZOOM_MIN) return basePose;
  const blend = (z - PEEK_ZOOM_MIN) / (PEEK_ZOOM_MAX - PEEK_ZOOM_MIN);
  const targetZ = basePose.target[2] * (1 - blend);
  const height = basePose.position[1] / z;
  return { position: [0, height, targetZ + height * 0.22], target: [0, 0, targetZ] };
}

/** Highest a standing own tile reaches: its length plus the lift of a tile picked for a two-end choice. */
const ROW_TOP = 2 + 0.65;
/** Screen margins (normalised): the bottom keeps room for the error toast, the top for the HUD. */
const BOTTOM_LIMIT = -0.9;
const SIDE_LIMIT = 0.95;
const FAR_ROW_TOP_LIMIT = 0.75;

/**
 * Eye level behind the own row, looking across the table (the reference video). The camera starts
 * close (6 units behind the row) and backs off until the whole own row and the opposite row fit
 * on screen, for any seat (the table is 20×16, so East/West look along the long side) and any
 * landscape screen from a 19.5:9 phone to a 4:3 iPad.
 */
function povPreset(aspect: number, frame: ViewFrame): CameraPoseValue {
  const pose = (back: number): CameraPoseValue => ({
    position: [0, 4.8 + back * 0.2, frame.rowZ + back],
    target: [0, 0, -0.2], // the middle of the table, between the two rows
  });
  const corners: Vec3[] = [];
  for (const x of [-ROW_HALF, ROW_HALF]) {
    for (const z of [frame.rowZ - 0.3, frame.rowZ + 0.3]) {
      for (const y of [0, ROW_TOP]) corners.push([x, y, z]);
    }
  }
  const fits = (p: CameraPoseValue) =>
    corners.every((c) => {
      const [x, y] = projectPoint(p, aspect, c);
      return Math.abs(x) <= SIDE_LIMIT && y >= BOTTOM_LIMIT && y <= 1;
    }) && projectPoint(p, aspect, [0, 2, -frame.rowZ])[1] <= FAR_ROW_TOP_LIMIT;
  for (let back = 6; back < 40; back += 0.05) {
    const p = pose(back);
    if (fits(p)) return p;
  }
  return pose(40);
}

const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/** Pose `t` (0..1) of the way from `from` to `to`, eased in and out. */
export function cameraPose(from: CameraPoseValue, to: CameraPoseValue, t: number): CameraPoseValue {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const k = easeInOutCubic(t);
  return { position: lerp3(from.position, to.position, k), target: lerp3(from.target, to.target, k) };
}
