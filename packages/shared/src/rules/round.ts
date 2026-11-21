import { SEAT_ORDER, TEAM_OF_SEAT } from '../constants';
import type { GameState, Mode, Seat, Team, Tile } from '../types';
import { isFirstMoveOfGame, legalMoves } from './moves';

export type RoundResult = {
  reason: 'domino' | 'blocked';
  winner: Seat | Team;
  /** Seat that opens the next round. */
  startingSeat: Seat;
  points: number;
  pips: Record<Seat, number>;
};

export function nextSeat(seat: Seat): Seat {
  return SEAT_ORDER[(SEAT_ORDER.indexOf(seat) + 1) % SEAT_ORDER.length]!;
}

/** Seats in turn order starting at `seat` (inclusive). */
export function orderFrom(seat: Seat): Seat[] {
  const i = SEAT_ORDER.indexOf(seat);
  return [...SEAT_ORDER.slice(i), ...SEAT_ORDER.slice(0, i)];
}

export function nextTurn(state: GameState): GameState {
  return { ...state, turn: nextSeat(state.turn) };
}

/** Current seat passes (server decides it has no legal move). */
export function passTurn(state: GameState): GameState {
  return { ...state, passStreak: state.passStreak + 1, turn: nextSeat(state.turn) };
}

/**
 * Host skips the current seat (its player is disconnected). Counts as a pass; skipping the
 * round-1 opener on an empty table lifts the 6-6 rule so the game cannot get stuck.
 */
export function skipTurn(state: GameState): GameState {
  return { ...passTurn(state), openerWaived: state.openerWaived || isFirstMoveOfGame(state) };
}

export function isBlocked(state: GameState): boolean {
  if (state.chain.length === 0) return false;
  const first = isFirstMoveOfGame(state);
  return SEAT_ORDER.every((seat) => legalMoves(state.hands[seat], state.ends, first).length === 0);
}

const handPips = (hand: readonly Tile[]) => hand.reduce((sum, x) => sum + x.a + x.b, 0);

export function scoreRound(state: GameState, mode: Mode): RoundResult | null {
  const pips = Object.fromEntries(SEAT_ORDER.map((s) => [s, handPips(state.hands[s])])) as Record<
    Seat,
    number
  >;
  const order = orderFrom(state.lastActor ?? state.turn);

  const emptied = SEAT_ORDER.find((s) => state.hands[s].length === 0);
  if (emptied) {
    if (mode === 'solo') {
      const points = SEAT_ORDER.filter((s) => s !== emptied).reduce((n, s) => n + pips[s], 0);
      return { reason: 'domino', winner: emptied, startingSeat: emptied, points, pips };
    }
    const team = TEAM_OF_SEAT[emptied];
    const points = SEAT_ORDER.filter((s) => TEAM_OF_SEAT[s] !== team).reduce((n, s) => n + pips[s], 0);
    return { reason: 'domino', winner: team, startingSeat: emptied, points, pips };
  }

  if (!isBlocked(state)) return null;

  // First seat in `candidates` order with the minimum value; ties resolved by turn order.
  const lowest = (candidates: Seat[], value: (s: Seat) => number): Seat =>
    candidates.reduce((best, s) => (value(s) < value(best) ? s : best));

  if (mode === 'solo') {
    const winner = lowest(order, (s) => pips[s]);
    const points = SEAT_ORDER.filter((s) => s !== winner).reduce((n, s) => n + pips[s], 0);
    return { reason: 'blocked', winner, startingSeat: winner, points, pips };
  }

  const teamTotal = (team: Team) =>
    SEAT_ORDER.filter((s) => TEAM_OF_SEAT[s] === team).reduce((n, s) => n + pips[s], 0);
  const winningTeam = TEAM_OF_SEAT[lowest(order, (s) => teamTotal(TEAM_OF_SEAT[s]))];
  const losingTeam: Team = winningTeam === 'A' ? 'B' : 'A';
  const startingSeat = lowest(
    order.filter((s) => TEAM_OF_SEAT[s] === winningTeam),
    (s) => pips[s],
  );
  return { reason: 'blocked', winner: winningTeam, startingSeat, points: teamTotal(losingTeam), pips };
}
