import { describe, expect, it } from 'vitest';
import { CHAIN_BOUNDS, layoutChain, TILE } from './layoutChain';
import { computeTableDisplayZoom, DISPLAY_RIM, TABLE_DISPLAY_BOUNDS } from './tableDisplayFraming';

describe('computeTableDisplayZoom', () => {
  it('zooms closely on an empty or early table so tiles look large', () => {
    const zEmpty = computeTableDisplayZoom([], 1180, 820, false);
    const zOne = computeTableDisplayZoom(
      layoutChain([{ tile: { id: '0-0', a: 0, b: 0 }, side: 'left', flipped: false, order: 0 }], CHAIN_BOUNDS),
      1180,
      820,
      false,
    );
    expect(zEmpty).toBeGreaterThan(95); // > 95 px per unit on 1180x820 iPad
    expect(zOne).toBeGreaterThan(95);
    expect(zOne * TILE.width).toBeGreaterThan(90);
  });

  it('zooms out smoothly as the chain spreads, never clipping outside the display felt', () => {
    const spread = layoutChain(
      [
        { tile: { id: '0-0', a: 0, b: 0 }, side: 'left', flipped: false, order: 0 },
        { tile: { id: '0-6', a: 0, b: 6 }, side: 'right', flipped: false, order: 1 },
        { tile: { id: '5-6', a: 5, b: 6 }, side: 'right', flipped: true, order: 2 },
        { tile: { id: '4-5', a: 4, b: 5 }, side: 'right', flipped: true, order: 3 },
        { tile: { id: '0-1', a: 0, b: 1 }, side: 'left', flipped: true, order: 4 },
        { tile: { id: '1-2', a: 1, b: 2 }, side: 'left', flipped: true, order: 5 },
      ],
      CHAIN_BOUNDS,
    );
    const zMid = computeTableDisplayZoom(spread, 1180, 820, false);
    const maxW = 2 * (TABLE_DISPLAY_BOUNDS.halfWidth + DISPLAY_RIM);
    const maxD = 2 * (TABLE_DISPLAY_BOUNDS.halfDepth + DISPLAY_RIM);
    const minZoom = Math.min(1180 / maxW, 820 / maxD) * 0.96;
    expect(zMid).toBeGreaterThanOrEqual(minZoom);
    expect(zMid).toBeLessThan(computeTableDisplayZoom([], 1180, 820, false));
  });
});
