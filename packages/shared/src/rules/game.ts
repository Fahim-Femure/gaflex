import { SCORE_LIMIT, SEAT_ORDER } from '../constants';
import type { GameState, Mode, Seat, Team, Tile } from '../types';
import { findOpener, isDouble } from './deck';
import { orderFrom, type RoundResult } from './round';

/** Solo scores are keyed by seat, team scores by team. */
export type ScoreKey = Seat | Team;

export function initScores(mode: Mode): Record<string, number> {
  return mode === 'team' ? { A: 0, B: 0 } : Object.fromEntries(SEAT_ORDER.map((s) => [s, 0]));
}

export function startRound(input: {
  hands: Record<Seat, Tile[]>;
  round: number;
  /** Winner of the previous round; null only for round 1. */
  startingSeat: Seat | null;
  scores: Record<string, number>;
  /** Games decided so far; carried across games. */
  tally: Record<string, number>;
}): GameState {
  let turn: Seat;
  if (input.round === 1) {
    turn = findOpener(input.hands);
  } else if (input.startingSeat) {
    turn = orderFrom(input.startingSeat).find((s) => input.hands[s].some(isDouble)) ?? input.startingSeat;
  } else {
    throw new Error('startRound: rounds after the first need a starting seat');
  }
  return {
    hands: input.hands,
    chain: [],
    ends: null,
    turn,
    passStreak: 0,
    round: input.round,
    scores: { ...input.scores },
    tally: { ...input.tally },
    lastActor: null,
    winner: null,
    openerWaived: false,
  };
}

/** Losers collect their remaining pips (docs/02). */
export function applyRoundResult(scores: Record<string, number>, result: RoundResult): Record<string, number> {
  const next = { ...scores };
  for (const [key, pips] of Object.entries(result.penalties)) next[key] = (next[key] ?? 0) + pips;
  return next;
}

/** The key that went above SCORE_LIMIT and so lost the game (highest if several), or null. */
export function gameLoser(scores: Record<string, number>): ScoreKey | null {
  let worst: string | null = null;
  for (const [key, value] of Object.entries(scores)) {
    if (value > SCORE_LIMIT && (worst === null || value > scores[worst]!)) worst = key;
  }
  return worst as ScoreKey | null;
}

/** Records a finished game: team -> the other team wins it; solo -> the loser gets one more loss. */
export function applyGameResult(
  tally: Record<string, number>,
  loser: ScoreKey,
  mode: Mode,
): Record<string, number> {
  const key = mode === 'team' ? (loser === 'A' ? 'B' : 'A') : loser;
  return { ...tally, [key]: (tally[key] ?? 0) + 1 };
}
