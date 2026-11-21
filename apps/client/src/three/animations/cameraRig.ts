import { TABLE_BOUNDS } from '../layout/layoutChain';
import { easeInOutCubic, type Vec3 } from './curves';

export const CAMERA_FOV = 50;
/** docs/05: the View/Intip camera move takes 900 ms, ease-in-out. */
export const CAMERA_MS = 900;

export type CameraMode = 'pov' | 'peek';
export type CameraPoseValue = { position: Vec3; target: Vec3 };

const RIM = 0.8;
const ROW_Z = TABLE_BOUNDS.halfDepth - 1.2;
const ROW_HALF = 7 * 0.6 + 0.2; // seven standing tiles plus a margin

/**
 * Camera presets in the table frame with the player's seat at +Z.
 * pov: eye level behind the player's own row, looking across the table (the reference video).
 * peek ("Intip"): high above, the whole table in view.
 */
export function cameraPreset(mode: CameraMode, aspect: number): CameraPoseValue {
  const t = Math.tan((CAMERA_FOV * Math.PI) / 360);
  if (mode === 'pov') {
    // Far enough back that the own row sits in the lower third and the chain fills the middle.
    const back = Math.max(6, ROW_HALF / (t * aspect));
    const height = 4.8 + back * 0.2;
    return { position: [0, height, ROW_Z + back], target: [0, 0, ROW_Z - 7] };
  }
  const halfW = TABLE_BOUNDS.halfWidth + RIM;
  const halfD = TABLE_BOUNDS.halfDepth + RIM;
  const height = Math.max(halfD / t, halfW / (t * aspect)) * 1.08;
  return { position: [0, height, height * 0.22], target: [0, 0, 0] };
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
