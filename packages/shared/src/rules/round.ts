import { DEAD_DOUBLE_ZERO_POINTS, MIN_ROUND_PENALTY, SEAT_ORDER, TEAM_OF_SEAT } from '../constants';
import type { GameState, Mode, Seat, Team, Tile } from '../types';
import { legalMoves, openingRule } from './moves';

export type RoundResult = {
  reason: 'domino' | 'blocked';
  winner: Seat | Team;
  /** Seat that opens the next round. */
  startingSeat: Seat;
  /** Pips added to each loser's score: solo per losing seat, team per losing team. */
  penalties: Record<string, number>;
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
 * opener on an empty table lifts the opening tile rule so the game cannot get stuck.
 */
export function skipTurn(state: GameState): GameState {
  return { ...passTurn(state), openerWaived: state.openerWaived || state.chain.length === 0 };
}

export function isBlocked(state: GameState): boolean {
  if (state.chain.length === 0) return false;
  const rule = openingRule(state);
  return SEAT_ORDER.every((seat) => legalMoves(state.hands[seat], state.ends, rule).length === 0);
}

/** Remaining 0-0 in hand at round end counts as DEAD_DOUBLE_ZERO_POINTS (25). */
export function tilePoints(tile: Tile): number {
  return tile.a === 0 && tile.b === 0 ? DEAD_DOUBLE_ZERO_POINTS : tile.a + tile.b;
}

export function handPips(hand: readonly Tile[]): number {
  return hand.reduce((sum, x) => sum + tilePoints(x), 0);
}

const thresholdPenalty = (total: number) => (total < MIN_ROUND_PENALTY ? 0 : total);

export function scoreRound(state: GameState, mode: Mode): RoundResult | null {
  const pips = Object.fromEntries(SEAT_ORDER.map((s) => [s, handPips(state.hands[s])])) as Record<
    Seat,
    number
  >;
  const order = orderFrom(state.lastActor ?? state.turn);

  const teamTotal = (team: Team) =>
    SEAT_ORDER.filter((s) => TEAM_OF_SEAT[s] === team).reduce((n, s) => n + pips[s], 0);
  const otherTeam = (team: Team): Team => (team === 'A' ? 'B' : 'A');
  /** Solo: every other seat is charged its own pips if >= MIN_ROUND_PENALTY (below 10 = 0). */
  const soloPenalties = (winner: Seat) =>
    Object.fromEntries(SEAT_ORDER.filter((s) => s !== winner).map((s) => [s, thresholdPenalty(pips[s])]));

  const emptied = SEAT_ORDER.find((s) => state.hands[s].length === 0);
  if (emptied) {
    if (mode === 'solo') {
      return { reason: 'domino', winner: emptied, startingSeat: emptied, penalties: soloPenalties(emptied), pips };
    }
    const team = TEAM_OF_SEAT[emptied];
    const losing = otherTeam(team);
    return {
      reason: 'domino',
      winner: team,
      startingSeat: emptied,
      penalties: { [losing]: thresholdPenalty(teamTotal(losing)) },
      pips,
    };
  }

  if (!isBlocked(state)) return null;

  // First seat in `candidates` order with the minimum value; ties resolved by turn order.
  const lowest = (candidates: Seat[], value: (s: Seat) => number): Seat =>
    candidates.reduce((best, s) => (value(s) < value(best) ? s : best));

  if (mode === 'solo') {
    const winner = lowest(order, (s) => pips[s]);
    return { reason: 'blocked', winner, startingSeat: winner, penalties: soloPenalties(winner), pips };
  }

  const winningTeam = TEAM_OF_SEAT[lowest(order, (s) => teamTotal(TEAM_OF_SEAT[s]))];
  const losingTeam = otherTeam(winningTeam);
  const startingSeat = lowest(
    order.filter((s) => TEAM_OF_SEAT[s] === winningTeam),
    (s) => pips[s],
  );
  return {
    reason: 'blocked',
    winner: winningTeam,
    startingSeat,
    penalties: { [losingTeam]: thresholdPenalty(teamTotal(losingTeam)) },
    pips,
  };
}
