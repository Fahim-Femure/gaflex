import { footprint, type LaidTile, type TableBounds } from './layoutChain';

/** Tighter felt bounds for the read-only Table Display (no standing rows around the edges). */
export const TABLE_DISPLAY_BOUNDS: TableBounds = { halfWidth: 8.6, halfDepth: 6.6 };
export const DISPLAY_RIM = 0.3;

const MIN_HALF_W = 5.4;
const MIN_HALF_D = 3.8;
const PAD_X = 1.4;
const PAD_Z = 1.2;

/**
 * Computes the orthographic zoom so the active chain fills as much of the Table Display as
 * possible (making tiles much larger early and mid-game), capped at the felt + rim bounds.
 */
export function computeTableDisplayZoom(
  laid: readonly LaidTile[],
  width: number,
  height: number,
  quarterTurn: boolean,
): number {
  let maxAbsX = 0;
  let maxAbsZ = 0;
  for (const tile of laid) {
    const box = footprint(tile);
    maxAbsX = Math.max(maxAbsX, Math.abs(box.minX), Math.abs(box.maxX));
    maxAbsZ = Math.max(maxAbsZ, Math.abs(box.minZ), Math.abs(box.maxZ));
  }
  const halfW = Math.min(TABLE_DISPLAY_BOUNDS.halfWidth + DISPLAY_RIM, Math.max(MIN_HALF_W, maxAbsX + PAD_X));
  const halfD = Math.min(TABLE_DISPLAY_BOUNDS.halfDepth + DISPLAY_RIM, Math.max(MIN_HALF_D, maxAbsZ + PAD_Z));
  const w = 2 * (quarterTurn ? halfD : halfW);
  const d = 2 * (quarterTurn ? halfW : halfD);
  return Math.min(width / Math.max(1e-6, w), height / Math.max(1e-6, d)) * 0.96;
}
