import { describe, expect, it } from 'vitest';
import type { Move } from '@gaflex/shared';
import { pickTile, type PickContext } from './tilePick';

const tile = (a: number, b: number) => ({ id: `${a}-${b}`, a, b });

const ctx = (over: Partial<PickContext> = {}): PickContext => ({
  myTurn: true,
  ends: [3, 5],
  legalMoves: [],
  ...over,
});

describe('pickTile (no hints: every tile can be tapped, the rules answer)', () => {
  it('tapping out of turn says it is not your turn', () => {
    expect(pickTile(tile(3, 4), ctx({ myTurn: false }))).toEqual({ kind: 'error', code: 'NOT_YOUR_TURN' });
  });

  it('a tile that fits no end is refused with "tidak cocok"', () => {
    const moves: Move[] = [{ tileId: '5-6', side: 'right' }];
    expect(pickTile(tile(1, 2), ctx({ legalMoves: moves }))).toEqual({ kind: 'error', code: 'INVALID_MOVE' });
  });

  it('round 1 on an empty table: anything but 0-0 must open with 0-0', () => {
    const moves: Move[] = [{ tileId: '0-0', side: 'left' }];
    expect(pickTile(tile(2, 3), ctx({ ends: null, legalMoves: moves }))).toEqual({
      kind: 'error',
      code: 'MUST_OPEN_WITH_DOUBLE_ZERO',
    });
    expect(pickTile(tile(0, 0), ctx({ ends: null, legalMoves: moves }))).toEqual({ kind: 'play', side: 'left' });
  });

  it('a tile that fits one end is played there', () => {
    const moves: Move[] = [{ tileId: '4-5', side: 'right' }];
    expect(pickTile(tile(4, 5), ctx({ legalMoves: moves }))).toEqual({ kind: 'play', side: 'right' });
  });

  it('a tile that fits both ends asks which end', () => {
    const moves: Move[] = [
      { tileId: '3-5', side: 'left' },
      { tileId: '3-5', side: 'right' },
    ];
    expect(pickTile(tile(3, 5), ctx({ legalMoves: moves }))).toEqual({ kind: 'choose' });
  });
});
