import type { ErrorCode, GameState, Placed, Seat, Side, Tile } from '../types';
import { isDouble, isOpenerTile } from './deck';

export type Move = { tileId: string; side: Side };
export type PlayMove = Move & { seat: Seat };
export type MoveResult = { ok: true; state: GameState } | { ok: false; error: ErrorCode };
export type OpeningRule = 'double_zero' | 'double' | 'any';

/** What tile rule applies on an empty table: round 1 = 0-0, round 2+ = any balak, or any if waived. */
export function openingRule(state: Pick<GameState, 'round' | 'chain' | 'openerWaived'>): OpeningRule {
  if (state.chain.length > 0 || state.openerWaived) return 'any';
  return state.round === 1 ? 'double_zero' : 'double';
}

/** Round 1 with an empty table: the opener must be 0-0 (unless the host skipped the opener). */
export function isFirstMoveOfGame(state: Pick<GameState, 'round' | 'chain' | 'openerWaived'>): boolean {
  return openingRule(state) === 'double_zero';
}

function matches(tile: Tile, value: number): boolean {
  return tile.a === value || tile.b === value;
}

export function legalMoves(
  hand: readonly Tile[],
  ends: readonly [number, number] | null,
  opening: boolean | OpeningRule,
): Move[] {
  if (ends === null) {
    const rule: OpeningRule = typeof opening === 'boolean' ? (opening ? 'double_zero' : 'any') : opening;
    const candidates =
      rule === 'double_zero' ? hand.filter(isOpenerTile) : rule === 'double' ? hand.filter(isDouble) : hand;
    return candidates.map((tile) => ({ tileId: tile.id, side: 'left' }));
  }
  const moves: Move[] = [];
  for (const tile of hand) {
    if (matches(tile, ends[0])) moves.push({ tileId: tile.id, side: 'left' });
    if (matches(tile, ends[1])) moves.push({ tileId: tile.id, side: 'right' });
  }
  return moves;
}

/**
 * Places a tile. Display convention: a tile shown unflipped reads [a|b] left to right.
 * Does not advance the turn (see nextTurn).
 */
export function applyMove(state: GameState, move: PlayMove): MoveResult {
  if (move.seat !== state.turn) return { ok: false, error: 'NOT_YOUR_TURN' };

  const hand = state.hands[move.seat];
  const tile = hand.find((x) => x.id === move.tileId);
  if (!tile) return { ok: false, error: 'TILE_NOT_OWNED' };

  let placed: Placed;
  let ends: [number, number];
  const order = state.chain.length;

  if (state.ends === null) {
    const rule = openingRule(state);
    if (rule === 'double_zero' && !isOpenerTile(tile)) {
      return { ok: false, error: 'MUST_OPEN_WITH_DOUBLE_ZERO' };
    }
    if (rule === 'double' && !isDouble(tile)) {
      return { ok: false, error: 'MUST_OPEN_WITH_DOUBLE' };
    }
    placed = { tile, side: move.side, flipped: false, order };
    ends = [tile.a, tile.b];
  } else if (move.side === 'left') {
    const left = state.ends[0];
    if (!matches(tile, left)) return { ok: false, error: 'INVALID_MOVE' };
    const flipped = tile.b !== left;
    placed = { tile, side: 'left', flipped, order };
    ends = [flipped ? tile.b : tile.a, state.ends[1]];
  } else {
    const right = state.ends[1];
    if (!matches(tile, right)) return { ok: false, error: 'INVALID_MOVE' };
    const flipped = tile.a !== right;
    placed = { tile, side: 'right', flipped, order };
    ends = [state.ends[0], flipped ? tile.a : tile.b];
  }

  return {
    ok: true,
    state: {
      ...state,
      hands: { ...state.hands, [move.seat]: hand.filter((x) => x.id !== tile.id) },
      chain: [...state.chain, placed],
      ends,
      passStreak: 0,
      lastActor: move.seat,
    },
  };
}
