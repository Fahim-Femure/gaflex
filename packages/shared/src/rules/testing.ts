// Test-only helpers for building rule fixtures. Not exported from the package.
import type { GameState, Seat, Tile } from '../types';

export function t(a: number, b: number): Tile {
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return { id: `${lo}-${hi}`, a: lo, b: hi };
}

export function makeState(partial: Partial<GameState> = {}): GameState {
  const emptyHands: Record<Seat, Tile[]> = { N: [], E: [], S: [], W: [] };
  return {
    hands: emptyHands,
    chain: [],
    ends: null,
    turn: 'N',
    passStreak: 0,
    round: 1,
    scores: {},
    tally: {},
    lastActor: null,
    winner: null,
    openerWaived: false,
    ...partial,
  };
}
