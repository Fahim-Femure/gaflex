import type { Placed } from '@gaflex/shared';
import { chainSequence } from '../../lib/chain';

/** Tile size in world units (docs/06: 1 : 2 : 0.3). */
export const TILE = { width: 1, length: 2, thickness: 0.3, gap: 0.06 } as const;

export type TableBounds = { halfWidth: number; halfDepth: number };

/** Felt area of the 3D table. */
export const TABLE_BOUNDS: TableBounds = { halfWidth: 10, halfDepth: 8 };

/** Where the chain may snake: the felt minus the strips where players' tiles stand (docs/06). */
export const CHAIN_BOUNDS: TableBounds = { halfWidth: 8.2, halfDepth: 6.2 };

export type LaidTile = {
  id: string;
  /** Centre of the tile lying flat on the table (y = half thickness). */
  position: [number, number, number];
  /** Euler XYZ. The tile's local +Y (its `top` half) points toward the chain's left end. */
  rotation: [number, number, number];
  top: number;
  bottom: number;
  double: boolean;
};

type Vec = [number, number]; // (x, z)

const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k];

/** Euler for a flat tile whose local +Y points along `axis` (x, z). */
function flatRotation(axis: Vec): [number, number, number] {
  return [-Math.PI / 2, 0, Math.atan2(-axis[0], -axis[1])];
}

type Arm = {
  cursor: Vec; // point on the chain line at the arm's open end
  dir: Vec; // growth direction
  prevHalfPerp: number; // half extent of the last tile across `dir`
  mode: 'run' | 'connector';
  connectorPlaced: boolean;
  lastRunX: number; // X direction of the run before the current connector
  turnSign: 1 | -1; // right arm snakes toward +Z, left arm toward -Z
  towardLeftEnd: 1 | -1; // +Y points along dir (left arm) or against it (right arm)
};

/**
 * Pure layout of the chain on a table centred at the origin (docs/06).
 * Grows from the centre to both sides, turns 90° near the edge (snake), doubles lie crosswise.
 * Returns tiles in table order (left end -> right end).
 */
export function layoutChain(chain: readonly Placed[], bounds: TableBounds): LaidTile[] {
  const seq = chainSequence(chain);
  if (seq.length === 0) return [];
  const sorted = [...chain].sort((a, b) => a.order - b.order);
  const firstId = sorted[0]!.tile.id;
  const firstIndex = seq.findIndex((s) => s.id === firstId);
  const { width: W, length: L, gap, thickness } = TILE;
  const y = thickness / 2;

  const out = new Map<string, Omit<LaidTile, 'top' | 'bottom' | 'double' | 'id'>>();

  const first = seq[firstIndex]!;
  const firstExt = first.double ? W : L;
  out.set(first.id, {
    position: [0, y, 0],
    rotation: flatRotation(first.double ? [0, -1] : [-1, 0]),
  });
  const firstHalfPerp = first.double ? L / 2 : W / 2;

  const makeArm = (sign: 1 | -1): Arm => ({
    cursor: [(sign * firstExt) / 2, 0],
    dir: [sign, 0],
    prevHalfPerp: firstHalfPerp,
    mode: 'run',
    connectorPlaced: false,
    lastRunX: sign,
    turnSign: sign,
    towardLeftEnd: sign === 1 ? -1 : 1,
  });

  const place = (arm: Arm, item: (typeof seq)[number]) => {
    let newDir: Vec | null = null;
    if (arm.mode === 'connector' && arm.connectorPlaced) {
      newDir = [-arm.lastRunX, 0]; // snake back the other way
    } else if (arm.mode === 'run') {
      const ext = item.double ? W : L;
      const far = arm.cursor[0] + arm.dir[0] * (gap + ext);
      if (Math.abs(far) > bounds.halfWidth) newDir = [0, arm.turnSign];
    }

    if (newDir) {
      // Corner: the turning tile lies inline, tucked against the last tile's final unit.
      const base = add(arm.cursor, arm.dir, -W / 2);
      const center = add(base, newDir, arm.prevHalfPerp + gap + L / 2);
      arm.cursor = add(base, newDir, arm.prevHalfPerp + gap + L);
      if (arm.mode === 'run') {
        arm.lastRunX = arm.dir[0];
        arm.mode = 'connector';
        arm.connectorPlaced = true;
      } else {
        arm.mode = 'run';
        arm.connectorPlaced = false;
      }
      arm.dir = newDir;
      arm.prevHalfPerp = W / 2;
      out.set(item.id, { position: [center[0], y, center[1]], rotation: flatRotation(scale(newDir, arm.towardLeftEnd)) });
      return;
    }

    // Straight placement; a double lies crosswise when its width across the line fits the table.
    const crossFits =
      arm.dir[0] !== 0 ? Math.abs(arm.cursor[1]) + L / 2 <= bounds.halfDepth : Math.abs(arm.cursor[0]) + L / 2 <= bounds.halfWidth;
    const crosswise = item.double && crossFits;
    const ext = crosswise ? W : L;
    const center = add(arm.cursor, arm.dir, gap + ext / 2);
    arm.cursor = add(arm.cursor, arm.dir, gap + ext);
    arm.prevHalfPerp = crosswise ? L / 2 : W / 2;
    const axis: Vec = crosswise ? [-arm.dir[1], arm.dir[0]] : scale(arm.dir, arm.towardLeftEnd);
    out.set(item.id, { position: [center[0], y, center[1]], rotation: flatRotation(axis) });
  };

  const right = makeArm(1);
  const left = makeArm(-1);
  for (let i = firstIndex + 1; i < seq.length; i++) place(right, seq[i]!);
  for (let i = firstIndex - 1; i >= 0; i--) place(left, seq[i]!);

  return seq.map((s) => ({ id: s.id, top: s.left, bottom: s.right, double: s.double, ...out.get(s.id)! }));
}

const scale = (v: Vec, k: number): Vec => [v[0] * k, v[1] * k];

/** Axis-aligned footprint on the table (tiles only ever lie along X or Z). */
export function footprint(l: LaidTile) {
  const rz = l.rotation[2];
  const alongX = Math.abs(Math.sin(rz)) > 0.5;
  const hx = alongX ? TILE.length / 2 : TILE.width / 2;
  const hz = alongX ? TILE.width / 2 : TILE.length / 2;
  return { minX: l.position[0] - hx, maxX: l.position[0] + hx, minZ: l.position[2] - hz, maxZ: l.position[2] + hz };
}
