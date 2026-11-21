import type { Seat } from '@gaflex/shared';
import { TABLE_BOUNDS, TILE } from './layoutChain';

export type StandingTile = {
  /** Centre of a tile standing on its short end (table frame: N = -Z, E = +X, S = +Z, W = -X). */
  position: [number, number, number];
  /** Y rotation; the tile face (local +Z) points toward its owner's seat. */
  yaw: number;
};

const EDGE_INSET = 1.2;
const SPACING = TILE.width + 0.08;

const YAW: Record<Seat, number> = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

/**
 * A player's tiles standing in a row on the felt in front of their seat, faces toward them,
 * like holding gaple tiles on a real table (reference: the player's POV video).
 * Opponents' rows therefore show us their backs.
 */
export function seatRow(seat: Seat, count: number): StandingTile[] {
  const y = TILE.length / 2;
  const yaw = YAW[seat];
  return Array.from({ length: count }, (_, i) => {
    // Left to right as seen by that player.
    const along = (i - (count - 1) / 2) * SPACING;
    let position: [number, number, number];
    switch (seat) {
      case 'S':
        position = [along, y, TABLE_BOUNDS.halfDepth - EDGE_INSET];
        break;
      case 'N':
        position = [-along, y, -(TABLE_BOUNDS.halfDepth - EDGE_INSET)];
        break;
      case 'E':
        position = [TABLE_BOUNDS.halfWidth - EDGE_INSET, y, -along];
        break;
      case 'W':
        position = [-(TABLE_BOUNDS.halfWidth - EDGE_INSET), y, along];
        break;
    }
    return { position, yaw };
  });
}
