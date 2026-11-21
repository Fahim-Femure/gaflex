import { describe, expect, it } from 'vitest';
import { SCORE_LIMIT } from '../constants';
import { applyGameResult, applyRoundResult, gameLoser, initScores, startRound } from './game';
import { createDeck, deal } from './deck';
import { t } from './testing';
import type { RoundResult } from './round';

const fresh = { N: 0, E: 0, S: 0, W: 0 };

describe('initScores', () => {
  it('solo keeps one score per seat, team one per team', () => {
    expect(initScores('solo')).toEqual({ N: 0, E: 0, S: 0, W: 0 });
    expect(initScores('team')).toEqual({ A: 0, B: 0 });
  });
});

describe('startRound', () => {
  const hands = deal(createDeck()); // unshuffled: 6-6 is the last tile -> W

  it('round 1: the 6-6 holder starts and scores are fresh', () => {
    const s = startRound({ hands, round: 1, startingSeat: null, scores: fresh, tally: fresh });
    expect(s.turn).toBe('W');
    expect(s.round).toBe(1);
    expect(s.chain).toEqual([]);
    expect(s.ends).toBeNull();
    expect(s.passStreak).toBe(0);
    expect(s.lastActor).toBeNull();
    expect(s.winner).toBeNull();
    expect(s.hands).toEqual(hands);
  });

  it('later rounds: the previous winner starts; scores and the game tally carry over', () => {
    const s = startRound({ hands, round: 2, startingSeat: 'E', scores: { A: 12, B: 3 }, tally: { A: 1, B: 0 } });
    expect(s.turn).toBe('E');
    expect(s.round).toBe(2);
    expect(s.scores).toEqual({ A: 12, B: 3 });
    expect(s.tally).toEqual({ A: 1, B: 0 });
  });

  it('later rounds require a starting seat', () => {
    expect(() => startRound({ hands, round: 2, startingSeat: null, scores: {}, tally: {} })).toThrow();
  });

  it('starts with the 6-6 opener rule in force', () => {
    const one = { N: [t(6, 6)], E: [], S: [], W: [] };
    expect(startRound({ hands: one, round: 1, startingSeat: null, scores: {}, tally: {} }).openerWaived).toBe(false);
  });
});

describe('applyRoundResult (losers collect their remaining pips)', () => {
  const result = (penalties: Record<string, number>): RoundResult => ({
    reason: 'domino',
    winner: 'N',
    startingSeat: 'N',
    penalties,
    pips: { N: 0, E: 0, S: 0, W: 0 },
  });

  it('solo: adds each loser its own pips; the winner gets nothing', () => {
    const scores = { N: 5, E: 10, S: 0, W: 2 };
    expect(applyRoundResult(scores, result({ E: 7, S: 3, W: 11 }))).toEqual({ N: 5, E: 17, S: 3, W: 13 });
    expect(scores.E).toBe(10); // not mutated
  });

  it('team: adds the losing team the pips of both its players', () => {
    expect(applyRoundResult({ A: 0, B: 40 }, result({ B: 25 }))).toEqual({ A: 0, B: 65 });
  });
});

describe(`gameLoser (a score above ${SCORE_LIMIT}, i.e. reaching ${SCORE_LIMIT + 1}, loses)`, () => {
  it(`is null up to ${SCORE_LIMIT}`, () => {
    expect(gameLoser({ A: SCORE_LIMIT, B: 10 })).toBeNull();
  });

  it(`returns the key that reached ${SCORE_LIMIT + 1}`, () => {
    expect(gameLoser({ A: SCORE_LIMIT + 1, B: 10 })).toBe('A');
    expect(gameLoser({ N: 3, E: 140, S: 0, W: 0 })).toBe('E');
  });

  it('picks the highest when several pass the limit in the same round', () => {
    expect(gameLoser({ N: 104, E: 120, S: 0, W: 0 })).toBe('E');
  });

  it('breaks an exact tie by key order (N, E, S, W / A, B)', () => {
    expect(gameLoser({ N: 0, E: 110, S: 110, W: 0 })).toBe('E');
  });
});

describe('applyGameResult (the game tally, e.g. 1-0)', () => {
  it('team: the other team wins the game', () => {
    expect(applyGameResult({ A: 0, B: 0 }, 'A', 'team')).toEqual({ A: 0, B: 1 });
    expect(applyGameResult({ A: 2, B: 1 }, 'B', 'team')).toEqual({ A: 3, B: 1 });
  });

  it('solo: the player who passed the limit gets one more loss', () => {
    const tally = { N: 0, E: 1, S: 0, W: 0 };
    expect(applyGameResult(tally, 'E', 'solo')).toEqual({ N: 0, E: 2, S: 0, W: 0 });
    expect(tally.E).toBe(1); // not mutated
  });
});
