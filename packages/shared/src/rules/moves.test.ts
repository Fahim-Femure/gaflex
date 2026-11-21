import { describe, expect, it } from 'vitest';
import { applyMove, legalMoves } from './moves';
import { makeState, t } from './testing';

describe('legalMoves', () => {
  it('first move of round 1: only 6-6 is legal', () => {
    const hand = [t(1, 2), t(6, 6), t(3, 6)];
    expect(legalMoves(hand, null, true)).toEqual([{ tileId: '6-6', side: 'left' }]);
  });

  it('first move of round 1 without 6-6: nothing is legal', () => {
    expect(legalMoves([t(1, 2)], null, true)).toEqual([]);
  });

  it('first move of a later round: any tile is legal', () => {
    const hand = [t(1, 2), t(0, 0)];
    expect(legalMoves(hand, null, false)).toEqual([
      { tileId: '1-2', side: 'left' },
      { tileId: '0-0', side: 'left' },
    ]);
  });

  it('lists only tiles matching an open end', () => {
    const hand = [t(2, 5), t(1, 1), t(4, 6)];
    expect(legalMoves(hand, [5, 4], false)).toEqual([
      { tileId: '2-5', side: 'left' },
      { tileId: '4-6', side: 'right' },
    ]);
  });

  it('a tile matching both ends yields both sides', () => {
    expect(legalMoves([t(3, 5)], [3, 5], false)).toEqual([
      { tileId: '3-5', side: 'left' },
      { tileId: '3-5', side: 'right' },
    ]);
  });

  it('equal ends yield both sides for a matching tile', () => {
    expect(legalMoves([t(2, 3)], [3, 3], false)).toEqual([
      { tileId: '2-3', side: 'left' },
      { tileId: '2-3', side: 'right' },
    ]);
  });

  it('no matching tile -> empty (pass)', () => {
    expect(legalMoves([t(0, 1), t(2, 2)], [5, 6], false)).toEqual([]);
  });
});

describe('applyMove', () => {
  const opening = () =>
    makeState({
      hands: { N: [t(6, 6), t(1, 6)], E: [t(2, 3)], S: [], W: [] },
      turn: 'N',
    });

  it('rejects a move when it is not the seat turn', () => {
    const res = applyMove(opening(), { seat: 'E', tileId: '2-3', side: 'left' });
    expect(res).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
  });

  it('rejects a tile the seat does not hold', () => {
    const res = applyMove(opening(), { seat: 'N', tileId: '2-3', side: 'left' });
    expect(res).toEqual({ ok: false, error: 'TILE_NOT_OWNED' });
  });

  it('rejects a round-1 opener that is not 6-6', () => {
    const res = applyMove(opening(), { seat: 'N', tileId: '1-6', side: 'left' });
    expect(res).toEqual({ ok: false, error: 'MUST_OPEN_WITH_DOUBLE_SIX' });
  });

  it('opens the chain with 6-6 and sets ends', () => {
    const res = applyMove(opening(), { seat: 'N', tileId: '6-6', side: 'left' });
    if (!res.ok) throw new Error(res.error);
    expect(res.state.ends).toEqual([6, 6]);
    expect(res.state.chain).toEqual([{ tile: t(6, 6), side: 'left', flipped: false, order: 0 }]);
    expect(res.state.hands.N).toEqual([t(1, 6)]);
    expect(res.state.lastActor).toBe('N');
    expect(res.state.passStreak).toBe(0);
    expect(res.state.turn).toBe('N'); // turn advance is nextTurn's job
  });

  it('later round: any opener is allowed', () => {
    const state = makeState({ round: 2, hands: { N: [t(1, 6)], E: [], S: [], W: [] } });
    const res = applyMove(state, { seat: 'N', tileId: '1-6', side: 'right' });
    if (!res.ok) throw new Error(res.error);
    expect(res.state.ends).toEqual([1, 6]);
  });

  it('rejects a tile that does not match the chosen end', () => {
    const state = makeState({
      hands: { N: [t(2, 4)], E: [], S: [], W: [] },
      chain: [{ tile: t(4, 5), side: 'left', flipped: false, order: 0 }],
      ends: [4, 5],
    });
    const res = applyMove(state, { seat: 'N', tileId: '2-4', side: 'right' });
    expect(res).toEqual({ ok: false, error: 'INVALID_MOVE' });
  });

  it('left placement: new left end is the non-matching side; flipped when a matches', () => {
    const chain = [{ tile: t(4, 5), side: 'left' as const, flipped: false, order: 0 }];
    // 2-4 on left: shows [2|4] touching 4 -> not flipped, new left = 2
    const s1 = makeState({ hands: { N: [t(2, 4)], E: [], S: [], W: [] }, chain, ends: [4, 5] });
    const r1 = applyMove(s1, { seat: 'N', tileId: '2-4', side: 'left' });
    if (!r1.ok) throw new Error(r1.error);
    expect(r1.state.ends).toEqual([2, 5]);
    expect(r1.state.chain[1]).toEqual({ tile: t(2, 4), side: 'left', flipped: false, order: 1 });

    // 4-6 on left: must show [6|4] -> flipped, new left = 6
    const s2 = makeState({ hands: { N: [t(4, 6)], E: [], S: [], W: [] }, chain, ends: [4, 5] });
    const r2 = applyMove(s2, { seat: 'N', tileId: '4-6', side: 'left' });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.state.ends).toEqual([6, 5]);
    expect(r2.state.chain[1]!.flipped).toBe(true);
  });

  it('right placement: new right end is the non-matching side; flipped when b matches', () => {
    const chain = [{ tile: t(4, 5), side: 'left' as const, flipped: false, order: 0 }];
    const s1 = makeState({ hands: { N: [t(5, 6)], E: [], S: [], W: [] }, chain, ends: [4, 5] });
    const r1 = applyMove(s1, { seat: 'N', tileId: '5-6', side: 'right' });
    if (!r1.ok) throw new Error(r1.error);
    expect(r1.state.ends).toEqual([4, 6]);
    expect(r1.state.chain[1]!.flipped).toBe(false);

    const s2 = makeState({ hands: { N: [t(0, 5)], E: [], S: [], W: [] }, chain, ends: [4, 5] });
    const r2 = applyMove(s2, { seat: 'N', tileId: '0-5', side: 'right' });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.state.ends).toEqual([4, 0]);
    expect(r2.state.chain[1]!.flipped).toBe(true);
  });

  it('a double keeps the end value and resets the pass streak', () => {
    const state = makeState({
      hands: { N: [t(5, 5)], E: [], S: [], W: [] },
      chain: [{ tile: t(4, 5), side: 'left', flipped: false, order: 0 }],
      ends: [4, 5],
      passStreak: 2,
    });
    const res = applyMove(state, { seat: 'N', tileId: '5-5', side: 'right' });
    if (!res.ok) throw new Error(res.error);
    expect(res.state.ends).toEqual([4, 5]);
    expect(res.state.passStreak).toBe(0);
  });

  it('does not mutate the input state', () => {
    const state = opening();
    const snapshot = structuredClone(state);
    applyMove(state, { seat: 'N', tileId: '6-6', side: 'left' });
    expect(state).toEqual(snapshot);
  });
});
