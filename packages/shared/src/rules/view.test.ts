import { describe, expect, it } from 'vitest';
import { toPlayerView, toTableView, type ViewContext } from './view';
import { makeState, t } from './testing';

const hands = { N: [t(6, 6), t(1, 2)], E: [t(3, 4)], S: [t(0, 5), t(2, 2), t(4, 4)], W: [] };
const ctx: ViewContext = { status: 'playing', mode: 'solo', result: null, gameLoser: null };

describe('toTableView', () => {
  it('exposes hand counts but no tiles', () => {
    const view = toTableView(makeState({ hands, turn: 'N' }), ctx);
    expect(view.handCounts).toEqual({ N: 2, E: 1, S: 3, W: 0 });
    expect(view).not.toHaveProperty('hands');
    expect(view.revealedHands).toBeNull();
    expect(JSON.stringify(view)).not.toContain('"6-6"');
  });

  it('carries the penalty scores, the game tally and who lost the game', () => {
    const state = makeState({ hands, scores: { N: 101, E: 3, S: 0, W: 9 }, tally: { N: 1, E: 0, S: 0, W: 0 } });
    const view = toTableView(state, { ...ctx, status: 'game_end', gameLoser: 'N' });
    expect(view.scores).toEqual({ N: 101, E: 3, S: 0, W: 9 });
    expect(view.tally).toEqual({ N: 1, E: 0, S: 0, W: 0 });
    expect(view.gameLoser).toBe('N');
    expect(view).not.toHaveProperty('targetScore');
  });

  it('reveals all hands once the round is over', () => {
    const result = { reason: 'domino' as const, winner: 'W' as const, startingSeat: 'W' as const, penalties: { N: 0, E: 0, S: 0 }, pips: { N: 0, E: 0, S: 0, W: 0 } };
    const view = toTableView(makeState({ hands }), { ...ctx, status: 'round_end', result });
    expect(view.revealedHands).toEqual(hands);
    expect(view.result).toEqual(result);
  });
});

describe('toPlayerView', () => {
  it('includes only the own hand', () => {
    const view = toPlayerView(makeState({ hands, turn: 'E' }), 'S', ctx);
    expect(view.seat).toBe('S');
    expect(view.hand).toEqual(hands.S);
    const json = JSON.stringify(view);
    expect(json).not.toContain('"6-6"');
    expect(json).not.toContain('"3-4"');
  });

  it('lists legal moves only on the own turn', () => {
    const state = makeState({ hands, turn: 'N' });
    expect(toPlayerView(state, 'N', ctx).legalMoves).toEqual([{ tileId: '6-6', side: 'left' }]);
    expect(toPlayerView(state, 'S', ctx).legalMoves).toEqual([]);
  });

  it('lists no moves when the round is not playing', () => {
    const state = makeState({ hands, turn: 'N' });
    expect(toPlayerView(state, 'N', { ...ctx, status: 'round_end' }).legalMoves).toEqual([]);
  });
});
