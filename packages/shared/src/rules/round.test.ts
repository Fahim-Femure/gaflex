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

  it('solo: charges remaining pips >= 10, while pips below 10 yield 0 penalty', () => {
    const s = makeState({ hands, chain: chainAt(t(0, 0)), ends: [0, 0], lastActor: 'E' });
    expect(scoreRound(s, 'solo')).toEqual({
      reason: 'domino',
      winner: 'E',
      startingSeat: 'E',
      penalties: { N: 0, S: 0, W: 11 },
      pips: { N: 3, E: 0, S: 7, W: 11 },
    });
  });

  it('solo: exact threshold check (9 -> 0, 10 -> 10, 0-0 -> 25)', () => {
    const border = { N: [t(3, 6)], E: [], S: [t(4, 6)], W: [t(0, 0)] }; // N9 S10 W25
    const s = makeState({ hands: border, chain: chainAt(t(6, 6)), ends: [6, 6], lastActor: 'E' });
    expect(scoreRound(s, 'solo')).toEqual({
      reason: 'domino',
      winner: 'E',
      startingSeat: 'E',
      penalties: { N: 0, S: 10, W: 25 },
      pips: { N: 9, E: 0, S: 10, W: 25 },
    });
  });

  it('team: checks the < 10 threshold against the combined total of the losing team', () => {
    // E (team B) empties; losing team A = N 3 + S 7 = 10 -> charged 10.
    const s = makeState({ hands, chain: chainAt(t(0, 0)), ends: [0, 0], lastActor: 'E' });
    const res = scoreRound(s, 'team');
    expect(res?.winner).toBe('B');
    expect(res?.startingSeat).toBe('E');
    expect(res?.penalties).toEqual({ A: 10 });

    // Below 10 combined (4 + 5 = 9) -> penalty 0
    const lowTeam = { N: [t(1, 3)], E: [], S: [t(2, 3)], W: [t(5, 6)] }; // N4 + S5 = 9
    const sLow = makeState({ hands: lowTeam, chain: chainAt(t(0, 0)), ends: [0, 0], lastActor: 'E' });
    expect(scoreRound(sLow, 'team')?.penalties).toEqual({ A: 0 });

    // Both players < 10 individually (6 + 6 = 12 >= 10) -> still charged 12
    const combinedOver = { N: [t(2, 4)], E: [], S: [t(1, 5)], W: [t(5, 6)] }; // N6 + S6 = 12
    const sCombined = makeState({ hands: combinedOver, chain: chainAt(t(0, 0)), ends: [0, 0], lastActor: 'E' });
    expect(scoreRound(sCombined, 'team')?.penalties).toEqual({ A: 12 });
  });
});

describe('scoreRound — blocked (gaple)', () => {
  it('solo: lowest pips wins; losers with >= 10 pips are charged', () => {
    // N 3, E 7, S 10, W 12
    const s = blockedState({ N: [t(1, 2)], E: [t(3, 4)], S: [t(5, 5)], W: [t(6, 6)] }, 'S');
    expect(scoreRound(s, 'solo')).toEqual({
      reason: 'blocked',
      winner: 'N',
      startingSeat: 'N',
      penalties: { E: 0, S: 10, W: 12 },
      pips: { N: 3, E: 7, S: 10, W: 12 },
    });
  });

  it('solo: a remaining 0-0 counts as 25 points for deciding blocked winner and penalties', () => {
    // Chain is [6-6] so nobody without 6 can move; N holds [0-0] = 25, E holds [1-4] = 5 -> E wins!
    const s = makeState({
      hands: { N: [t(0, 0)], E: [t(1, 4)], S: [t(2, 3), t(0, 1)], W: [t(4, 5)] }, // N 25, E 5, S 6, W 9
      chain: chainAt(t(6, 6)),
      ends: [6, 6],
      lastActor: 'N',
    });
    expect(scoreRound(s, 'solo')).toEqual({
      reason: 'blocked',
      winner: 'E',
      startingSeat: 'E',
      penalties: { N: 25, S: 0, W: 0 },
      pips: { N: 25, E: 5, S: 6, W: 9 },
    });
  });

  it('solo tie: the last actor wins when tied (inclusive)', () => {
    // S 7, W 7 tied lowest; last actor W -> order W, N, E, S -> W
    const s = blockedState({ N: [t(5, 6)], E: [t(4, 6)], S: [t(3, 4)], W: [t(2, 5)] }, 'W');
    const res = scoreRound(s, 'solo');
    expect(res?.winner).toBe('W');
    expect(res?.penalties).toEqual({ N: 11, E: 10, S: 0 });
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
      penalties: { B: 17 },
      pips: { N: 3, E: 7, S: 12, W: 10 },
    });
  });

  it('team: 0-0 counts as 25 points in team total and starter selection', () => {
    // A: N [0-0](25) + S [1-1](2) = 27; B: E [2-3](5) + W [4-5](9) = 14 -> B wins, starter E
    const s = makeState({
      hands: { N: [t(0, 0)], E: [t(2, 3)], S: [t(1, 1)], W: [t(4, 5)] },
      chain: chainAt(t(6, 6)),
      ends: [6, 6],
      lastActor: 'N',
    });
    expect(scoreRound(s, 'team')).toEqual({
      reason: 'blocked',
      winner: 'B',
      startingSeat: 'E',
      penalties: { A: 27 },
      pips: { N: 25, E: 5, S: 2, W: 9 },
    });
  });

  it('team tie on totals: team of the first seat from the last actor (inclusive)', () => {
    // A: N 3 + S 12 = 15; B: E 5 + W 10 = 15; last actor E -> team B
    const s = blockedState({ N: [t(1, 2)], E: [t(2, 3)], S: [t(6, 6)], W: [t(5, 5)] }, 'E');
    const res = scoreRound(s, 'team');
    expect(res?.winner).toBe('B');
    expect(res?.startingSeat).toBe('E');
    expect(res?.penalties).toEqual({ A: 15 });
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
    const hands = { N: [t(0, 0)], E: [t(1, 2)], S: [], W: [] };
    const s = skipTurn(makeState({ hands, turn: 'N', round: 1 }));
    expect(s.turn).toBe('E');
    expect(isFirstMoveOfGame(s)).toBe(false);
    expect(legalMoves(s.hands.E, s.ends, isFirstMoveOfGame(s))).toEqual([{ tileId: '1-2', side: 'left' }]);
  });

  it('keeps the 0-0 rule when the table is not empty', () => {
    const s = skipTurn(makeState({ turn: 'N', round: 1, chain: chainAt(t(0, 0)), ends: [0, 0] }));
    expect(s.openerWaived).toBe(false);
  });

  it('does not mutate the input state', () => {
    const before = makeState({ turn: 'N' });
    const copy = structuredClone(before);
    skipTurn(before);
    expect(before).toEqual(copy);
  });
});
