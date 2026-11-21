import { SEAT_ORDER } from '../constants';
import type { GameState, Mode, Seat, Team, Tile } from '../types';
import { findOpener } from './deck';
import type { RoundResult } from './round';

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
}): GameState {
  let turn: Seat;
  if (input.round === 1) {
    turn = findOpener(input.hands);
  } else if (input.startingSeat) {
    turn = input.startingSeat;
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
    lastActor: null,
    winner: null,
    openerWaived: false,
  };
}

export function applyRoundResult(scores: Record<string, number>, result: RoundResult): Record<string, number> {
  return { ...scores, [result.winner]: (scores[result.winner] ?? 0) + result.points };
}

/** The key that reached the target (highest if several), or null. */
export function gameWinner(scores: Record<string, number>, target: number): ScoreKey | null {
  let best: string | null = null;
  for (const [key, value] of Object.entries(scores)) {
    if (value >= target && (best === null || value > scores[best]!)) best = key;
  }
  return best as ScoreKey | null;
}
