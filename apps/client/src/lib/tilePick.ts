import type { ErrorCode, Move, Side, Tile } from '@gaflex/shared';

export type PickContext = {
  myTurn: boolean;
  ends: [number, number] | null;
  /** From the server; used only to answer a tap, never shown as a hint (owner, 2026-11-22). */
  legalMoves: Move[];
};

export type PickOutcome =
  | { kind: 'error'; code: Extract<ErrorCode, 'NOT_YOUR_TURN' | 'INVALID_MOVE' | 'MUST_OPEN_WITH_DOUBLE_ZERO'> }
  | { kind: 'play'; side: Side }
  | { kind: 'choose' };

/** What a tap on one of the player's own tiles does. */
export function pickTile(tile: Tile, ctx: PickContext): PickOutcome {
  if (!ctx.myTurn) return { kind: 'error', code: 'NOT_YOUR_TURN' };
  const moves = ctx.legalMoves.filter((mv) => mv.tileId === tile.id);
  if (moves.length === 0) {
    return { kind: 'error', code: ctx.ends === null ? 'MUST_OPEN_WITH_DOUBLE_ZERO' : 'INVALID_MOVE' };
  }
  const sides = new Set(moves.map((mv) => mv.side));
  if (sides.size === 1 || ctx.ends === null) return { kind: 'play', side: moves[0]!.side };
  return { kind: 'choose' };
}
