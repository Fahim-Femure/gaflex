import { describe, expect, it } from 'vitest';
import { isBlocked, nextTurn, passTurn, scoreRound, skipTurn } from './round';
import { isFirstMoveOfGame, legalMoves } from './moves';
import { makeState, t } from './testing';
import type { Placed, Seat, Tile } from '../types';

const chainAt = (tile: Tile): Placed[] => [{ tile, side: 'left', flipped: false, order: 0 }];

/** Table ends are [0, 0]; hands without a 0 cannot move -> blocked. */
function blockedState(hands: Record<Seat, Tile[]>, lastActor: Seat) {
  return makeState({ hands, chain: chainAt(t(0, 0)), ends: [0, 0], lastActor });
}

describe('nextTurn', () => {
  it('advances clockwise N -> E -> S -> W -> N', () => {
    expect(nextTurn(makeState({ turn: 'N' })).turn).toBe('E');
    expect(nextTurn(makeState({ turn: 'S' })).turn).toBe('W');
    expect(nextTurn(makeState({ turn: 'W' })).turn).toBe('N');
  });

  it('leaves the pass streak alone', () => {
    expect(nextTurn(makeState({ passStreak: 2 })).passStreak).toBe(2);
  });
});

describe('passTurn', () => {
  it('counts the pass and moves to the next seat', () => {
    const s = passTurn(makeState({ turn: 'E', passStreak: 1 }));
    expect(s.turn).toBe('S');
    expect(s.passStreak).toBe(2);
  });
});

describe('isBlocked', () => {
  it('is false on an empty table', () => {
    expect(isBlocked(makeState({ hands: { N: [t(1, 2)], E: [], S: [], W: [] } }))).toBe(false);
  });

  it('is false while any seat has a legal move', () => {
    const s = blockedState({ N: [t(1, 2)], E: [t(3, 4)], S: [t(0, 5)], W: [t(6, 6)] }, 'N');
    expect(isBlocked(s)).toBe(false);
  });

  it('is true when no seat can move', () => {
    const s = blockedState({ N: [t(1, 2)], E: [t(3, 4)], S: [t(5, 5)], W: [t(6, 6)] }, 'N');
    expect(isBlocked(s)).toBe(true);
  });
});

describe('scoreRound — round not over', () => {
  it('returns null while hands remain and play is possible', () => {
    const s = blockedState({ N: [t(0, 1)], E: [t(3, 4)], S: [t(5, 5)], W: [t(6, 6)] }, 'W');
    expect(scoreRound(s, 'solo')).toBeNull();
  });
});

describe('scoreRound — domino (hand emptied)', () => {
  const hands = { N: [t(1, 2)], E: [], S: [t(3, 4)], W: [t(5, 6)] }; // pips N3 S7 W11

  it('solo: winner scores all opponents pips', () => {
    const s = makeState({ hands, chain: chainAt(t(0, 0)), ends: [0, 0], lastActor: 'E' });
    expect(scoreRound(s, 'solo')).toEqual({
      reason: 'domino',
      winner: 'E',
      startingSeat: 'E',
      points: 21,
      pips: { N: 3, E: 0, S: 7, W: 11 },
    });
  });

  it('team: winner team scores only the two opposing hands', () => {
    // E (team B) empties; opponents are N+S (team A) = 3 + 7. W (teammate) not counted.
    const s = makeState({ hands, chain: chainAt(t(0, 0)), ends: [0, 0], lastActor: 'E' });
    const res = scoreRound(s, 'team');
    expect(res?.winner).toBe('B');
    expect(res?.startingSeat).toBe('E');
    expect(res?.points).toBe(10);
  });
});

describe('scoreRound — blocked (gaple)', () => {
  it('solo: lowest pips wins and scores the other three hands', () => {
    // N 3, E 7, S 10, W 12
    const s = blockedState({ N: [t(1, 2)], E: [t(3, 4)], S: [t(5, 5)], W: [t(6, 6)] }, 'S');
    expect(scoreRound(s, 'solo')).toEqual({
      reason: 'blocked',
      winner: 'N',
      startingSeat: 'N',
      points: 29,
      pips: { N: 3, E: 7, S: 10, W: 12 },
    });
  });

  it('solo tie: the last actor wins when tied (inclusive)', () => {
    // S 7, W 7 tied lowest; last actor W -> order W, N, E, S -> W
    const s = blockedState({ N: [t(5, 6)], E: [t(4, 6)], S: [t(3, 4)], W: [t(2, 5)] }, 'W');
    const res = scoreRound(s, 'solo');
    expect(res?.winner).toBe('W');
    expect(res?.points).toBe(11 + 10 + 7);
  });

  it('solo tie: first tied seat in turn order from the last actor', () => {
    // E 7, S 7 tied; last actor W -> order W, N, E, S -> E
    const s = blockedState({ N: [t(5, 6)], E: [t(3, 4)], S: [t(2, 5)], W: [t(6, 6)] }, 'W');
    expect(scoreRound(s, 'solo')?.winner).toBe('E');
  });

  it('team: lower team total wins; starter is its lower-pip member', () => {
    // A: N 3 + S 12 = 15; B: E 7 + W 10 = 17 -> A wins, starter N
    const s = blockedState({ N: [t(1, 2)], E: [t(3, 4)], S: [t(6, 6)], W: [t(5, 5)] }, 'E');
    expect(scoreRound(s, 'team')).toEqual({
      reason: 'blocked',
      winner: 'A',
      startingSeat: 'N',
      points: 17,
      pips: { N: 3, E: 7, S: 12, W: 10 },
    });
  });

  it('team tie on totals: team of the first seat from the last actor (inclusive)', () => {
    // A: N 3 + S 12 = 15; B: E 5 + W 10 = 15; last actor E -> team B
    const s = blockedState({ N: [t(1, 2)], E: [t(2, 3)], S: [t(6, 6)], W: [t(5, 5)] }, 'E');
    const res = scoreRound(s, 'team');
    expect(res?.winner).toBe('B');
    expect(res?.startingSeat).toBe('E');
    expect(res?.points).toBe(15);
  });

  it('team member tie: starter is the first member in order from the last actor', () => {
    // A: N 7 + S 7 = 14; B: E 11 + W 12 = 23; last actor E -> order E, S, W, N -> S
    const s = blockedState({ N: [t(3, 4)], E: [t(5, 6)], S: [t(2, 5)], W: [t(6, 6)] }, 'E');
    const res = scoreRound(s, 'team');
    expect(res?.winner).toBe('A');
    expect(res?.startingSeat).toBe('S');
  });
});

describe('skipTurn (host skips a disconnected seat)', () => {
  it('counts as a pass and moves to the next seat', () => {
    const s = skipTurn(makeState({ turn: 'E', passStreak: 1, chain: chainAt(t(0, 0)), ends: [0, 0] }));
    expect(s.turn).toBe('S');
    expect(s.passStreak).toBe(2);
  });

  it('skipping the round-1 opener lets the next seat open with any tile', () => {
    const hands = { N: [t(6, 6)], E: [t(1, 2)], S: [], W: [] };
    const s = skipTurn(makeState({ hands, turn: 'N', round: 1 }));
    expect(s.turn).toBe('E');
    expect(isFirstMoveOfGame(s)).toBe(false);
    expect(legalMoves(s.hands.E, s.ends, isFirstMoveOfGame(s))).toEqual([{ tileId: '1-2', side: 'left' }]);
  });

  it('keeps the 6-6 rule when the table is not empty', () => {
    const s = skipTurn(makeState({ turn: 'N', round: 1, chain: chainAt(t(6, 6)), ends: [6, 6] }));
    expect(s.openerWaived).toBe(false);
  });

  it('does not mutate the input state', () => {
    const before = makeState({ turn: 'N' });
    const copy = structuredClone(before);
    skipTurn(before);
    expect(before).toEqual(copy);
  });
});
