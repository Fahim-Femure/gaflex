import { describe, expect, it } from 'vitest';
import { applyRoundResult, gameWinner, initScores, startRound } from './game';
import { createDeck, deal } from './deck';
import { makeState, t } from './testing';
import type { RoundResult } from './round';

describe('initScores', () => {
  it('solo keeps one score per seat, team one per team', () => {
    expect(initScores('solo')).toEqual({ N: 0, E: 0, S: 0, W: 0 });
    expect(initScores('team')).toEqual({ A: 0, B: 0 });
  });
});

describe('startRound', () => {
  const hands = deal(createDeck()); // unshuffled: 6-6 is the last tile -> W

  it('round 1: the 6-6 holder starts and scores are fresh', () => {
    const s = startRound({ hands, round: 1, startingSeat: null, scores: { N: 0, E: 0, S: 0, W: 0 } });
    expect(s.turn).toBe('W');
    expect(s.round).toBe(1);
    expect(s.chain).toEqual([]);
    expect(s.ends).toBeNull();
    expect(s.passStreak).toBe(0);
    expect(s.lastActor).toBeNull();
    expect(s.winner).toBeNull();
    expect(s.hands).toEqual(hands);
  });

  it('later rounds: the previous winner starts and scores carry over', () => {
    const s = startRound({ hands, round: 2, startingSeat: 'E', scores: { A: 12, B: 3 } });
    expect(s.turn).toBe('E');
    expect(s.round).toBe(2);
    expect(s.scores).toEqual({ A: 12, B: 3 });
  });

  it('later rounds require a starting seat', () => {
    expect(() => startRound({ hands, round: 2, startingSeat: null, scores: {} })).toThrow();
  });
});

describe('applyRoundResult', () => {
  const result = (winner: RoundResult['winner'], points: number): RoundResult => ({
    reason: 'domino',
    winner,
    startingSeat: 'N',
    points,
    pips: { N: 0, E: 0, S: 0, W: 0 },
  });

  it('adds the points to the winner key without mutating', () => {
    const scores = { N: 5, E: 0, S: 0, W: 0 };
    expect(applyRoundResult(scores, result('N', 20))).toEqual({ N: 25, E: 0, S: 0, W: 0 });
    expect(scores.N).toBe(5);
    expect(applyRoundResult({ A: 0, B: 40 }, result('B', 7))).toEqual({ A: 0, B: 47 });
  });
});

describe('gameWinner', () => {
  it('is null below the target', () => {
    expect(gameWinner({ A: 99, B: 10 }, 100)).toBeNull();
  });

  it('returns the key that reached the target', () => {
    expect(gameWinner({ A: 100, B: 10 }, 100)).toBe('A');
    expect(gameWinner({ N: 3, E: 151, S: 0, W: 0 }, 150)).toBe('E');
  });

  it('picks the highest when several reach the target', () => {
    expect(gameWinner({ N: 104, E: 120, S: 0, W: 0 }, 100)).toBe('E');
  });

  it('ignores a state with a winner field (sanity on fixtures)', () => {
    expect(makeState({ hands: { N: [t(1, 1)], E: [], S: [], W: [] } }).winner).toBeNull();
  });
});
