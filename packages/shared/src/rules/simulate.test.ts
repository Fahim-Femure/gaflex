import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createDeck,
  deal,
  findOpener,
  isFirstMoveOfGame,
  legalMoves,
  nextTurn,
  passTurn,
  scoreRound,
  shuffle,
} from './index';
import { makeState } from './testing';
import type { Mode } from '../types';

function seeded(seed: number) {
  let s = seed;
  return (max: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
}

/** Plays a whole round greedily (first legal move) using only the public rules. */
function playRound(seed: number, mode: Mode) {
  const hands = deal(shuffle(createDeck(), seeded(seed)));
  let state = makeState({ hands, turn: findOpener(hands) });
  for (let step = 0; step < 200; step++) {
    const result = scoreRound(state, mode);
    if (result) return { state, result };
    const moves = legalMoves(state.hands[state.turn], state.ends, isFirstMoveOfGame(state));
    if (moves.length === 0) {
      state = passTurn(state);
      continue;
    }
    const res = applyMove(state, { seat: state.turn, ...moves[0]! });
    if (!res.ok) throw new Error(`legal move rejected: ${res.error}`);
    state = nextTurn(res.state);
  }
  throw new Error('round did not terminate');
}

describe('full round simulation', () => {
  for (const mode of ['solo', 'team'] as const) {
    it(`${mode}: 50 seeded rounds terminate and conserve all 28 tiles`, () => {
      const reasons = new Set<string>();
      for (let seed = 1; seed <= 50; seed++) {
        const { state, result } = playRound(seed, mode);
        const inHands = Object.values(state.hands).reduce((n, h) => n + h.length, 0);
        expect(inHands + state.chain.length).toBe(28);
        expect(state.chain[0]!.tile.id).toBe('6-6');
        // the winner is never charged; each charged key holds the pips left in its hands
        expect(result.penalties).not.toHaveProperty(result.winner);
        for (const pips of Object.values(result.penalties)) expect(pips).toBeGreaterThanOrEqual(0);
        reasons.add(result.reason);
      }
      expect(reasons.has('domino')).toBe(true);
    });
  }
});
