import type { Placed, Seat, Side, Tile } from '@gaflex/shared';
import { CHAIN_BOUNDS, layoutChain, type LaidTile } from './layoutChain';
import { tableYaw } from './orientation';

export type EndOption = {
  side: Side;
  endValue: number;
  laid: LaidTile;
};

export type EndChoice = {
  leftOption: EndOption;
  rightOption: EndOption;
};

/** Rotates table-frame (x, z) into the viewer frame for `seat` (viewer faces -Z from +Z). */
function toViewXZ(x: number, z: number, yaw: number): [number, number] {
  return [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
}

/**
 * Resolves which table end is visually on the player's own left vs right from their seat POV,
 * simulating where `tile` would land on both ends in `layoutChain`.
 */
export function resolveEndChoice(
  chain: readonly Placed[],
  ends: readonly [number, number],
  tile: Tile,
  seat: Seat,
): EndChoice {
  const nextOrder = chain.reduce((m, p) => Math.max(m, p.order), -1) + 1;
  const candidateId = `__candidate_${tile.id}`;
  const candTile: Tile = { ...tile, id: candidateId };

  const leftPlaced: Placed = {
    tile: candTile,
    side: 'left',
    flipped: tile.b !== ends[0],
    order: nextOrder,
  };
  const rightPlaced: Placed = {
    tile: candTile,
    side: 'right',
    flipped: tile.a !== ends[1],
    order: nextOrder,
  };

  const laidLeft = layoutChain([...chain, leftPlaced], CHAIN_BOUNDS).find((l) => l.id === candidateId)!;
  const laidRight = layoutChain([...chain, rightPlaced], CHAIN_BOUNDS).find((l) => l.id === candidateId)!;

  const yaw = tableYaw(seat);
  const [vxL, vzL] = toViewXZ(laidLeft.position[0], laidLeft.position[2], yaw);
  const [vxR, vzR] = toViewXZ(laidRight.position[0], laidRight.position[2], yaw);

  // Visually compare screen-left (-X) first; when straight horizontal from East/West (vx equal),
  // align with the upcoming snake turn direction (nearer +Z arm for West turns -X, East reverses).
  const leftIsChainLeft = Math.abs(vxL - vxR) > 0.05 ? vxL < vxR : vzL > vzR;

  const chainLeftOpt: EndOption = { side: 'left', endValue: ends[0], laid: laidLeft };
  const chainRightOpt: EndOption = { side: 'right', endValue: ends[1], laid: laidRight };

  return leftIsChainLeft
    ? { leftOption: chainLeftOpt, rightOption: chainRightOpt }
    : { leftOption: chainRightOpt, rightOption: chainLeftOpt };
}
