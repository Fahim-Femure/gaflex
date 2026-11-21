import type { Placed } from '@gaflex/shared';

export type ChainItem = { id: string; left: number; right: number; double: boolean };

/**
 * Chain in table order (left end -> right end) with the values each tile shows.
 * Convention from the rules: an unflipped tile reads [a|b] left to right.
 */
export function chainSequence(chain: readonly Placed[]): ChainItem[] {
  const item = (p: Placed): ChainItem => {
    const [left, right] = p.flipped ? [p.tile.b, p.tile.a] : [p.tile.a, p.tile.b];
    return { id: p.tile.id, left, right, double: p.tile.a === p.tile.b };
  };
  const sorted = [...chain].sort((x, y) => x.order - y.order);
  const [first, ...rest] = sorted;
  if (!first) return [];
  const lefts = rest.filter((p) => p.side === 'left').reverse();
  const rights = rest.filter((p) => p.side === 'right');
  return [...lefts, first, ...rights].map(item);
}

/** Cells (0..8, row-major 3x3) holding a pip for each value 0..6. */
export const PIP_SPOTS: readonly (readonly number[])[] = [
  [],
  [4],
  [2, 6],
  [2, 4, 6],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];
