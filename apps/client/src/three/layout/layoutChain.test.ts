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
  startRound,
  type Placed,
  type Tile,
} from '@gaflex/shared';
import { chainSequence } from '../../lib/chain';
import { CHAIN_BOUNDS, footprint, layoutChain, TILE, type LaidTile } from './layoutChain';

const t = (a: number, b: number): Tile => ({ id: `${a}-${b}`, a, b });
const bounds = { halfWidth: 9, halfDepth: 7 };
const close = (x: number, y: number) => Math.abs(x - y) < 1e-9;

/** Unit vector of the tile's local +Y after its rotation (flat on the table). */
function longAxis(l: LaidTile): [number, number] {
  const rz = l.rotation[2];
  return [-Math.sin(rz), -Math.cos(rz)];
}

describe('layoutChain basics', () => {
  it('returns nothing for an empty chain', () => {
    expect(layoutChain([], bounds)).toEqual([]);
  });

  it('lays the first tile flat at the centre, long axis along X, top value toward the left', () => {
    const [first] = layoutChain([{ tile: t(3, 5), side: 'left', flipped: false, order: 0 }], bounds);
    expect(first!.position).toEqual([0, TILE.thickness / 2, 0]);
    expect(first!.rotation[0]).toBeCloseTo(-Math.PI / 2);
    const [ax, az] = longAxis(first!);
    expect(close(ax, -1) && close(az, 0)).toBe(true);
    expect([first!.top, first!.bottom]).toEqual([3, 5]);
  });

  it('places right tiles toward +X and left tiles toward -X, end to end', () => {
    const chain: Placed[] = [
      { tile: t(3, 5), side: 'left', flipped: false, order: 0 },
      { tile: t(5, 6), side: 'right', flipped: false, order: 1 },
      { tile: t(1, 3), side: 'left', flipped: false, order: 2 },
    ];
    const laid = layoutChain(chain, bounds);
    expect(laid.map((l) => l.id)).toEqual(['1-3', '3-5', '5-6']);
    const step = TILE.length + TILE.gap;
    expect(laid[0]!.position[0]).toBeCloseTo(-step);
    expect(laid[2]!.position[0]).toBeCloseTo(step);
    expect(laid[0]!.position[2]).toBeCloseTo(0);
  });

  it('keeps the displayed values from chainSequence (top = left value)', () => {
    const chain: Placed[] = [
      { tile: t(6, 6), side: 'left', flipped: false, order: 0 },
      { tile: t(4, 6), side: 'left', flipped: false, order: 1 },
      { tile: t(1, 6), side: 'right', flipped: true, order: 2 },
    ];
    const laid = layoutChain(chain, bounds);
    expect(laid.map((l) => [l.top, l.bottom])).toEqual(chainSequence(chain).map((c) => [c.left, c.right]));
  });

  it('lays a double crosswise and shortens the step past it', () => {
    const chain: Placed[] = [
      { tile: t(2, 5), side: 'left', flipped: false, order: 0 },
      { tile: t(5, 5), side: 'right', flipped: false, order: 1 },
      { tile: t(5, 6), side: 'right', flipped: false, order: 2 },
    ];
    const laid = layoutChain(chain, bounds);
    const [ax, az] = longAxis(laid[1]!);
    expect(close(Math.abs(az), 1) && close(ax, 0)).toBe(true); // crosswise: long axis along Z
    const doubleX = TILE.length / 2 + TILE.gap + TILE.width / 2;
    expect(laid[1]!.position[0]).toBeCloseTo(doubleX);
    expect(laid[2]!.position[0]).toBeCloseTo(doubleX + TILE.width / 2 + TILE.gap + TILE.length / 2);
  });
});

/** Plays a seeded greedy game with the real rules and returns the final chain. */
function playedChain(seed: number): Placed[] {
  let s = seed;
  const rng = (max: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
  const hands = deal(shuffle(createDeck(), rng));
  let state = startRound({ hands, round: 1, startingSeat: null, scores: {}, tally: {} });
  expect(state.turn).toBe(findOpener(hands));
  for (let i = 0; i < 200 && !scoreRound(state, 'solo'); i++) {
    const moves = legalMoves(state.hands[state.turn], state.ends, isFirstMoveOfGame(state));
    if (moves.length === 0) {
      state = passTurn(state);
      continue;
    }
    // alternate sides to grow both arms
    const move = moves[i % moves.length]!;
    const res = applyMove(state, { seat: state.turn, ...move });
    if (!res.ok) throw new Error(res.error);
    state = nextTurn(res.state);
  }
  return state.chain;
}

/** A full 28-tile chain that only ever grows to the right (worst case for one arm). */
function longRightChain(): Placed[] {
  const chain: Placed[] = [];
  let end = 0;
  const used = new Set<string>();
  const deck = createDeck();
  for (let order = 0; order < 28; order++) {
    const tile = deck.find((x) => !used.has(x.id) && (order === 0 || x.a === end || x.b === end));
    if (!tile) break;
    used.add(tile.id);
    const flipped = order > 0 && tile.a !== end;
    end = order === 0 ? tile.b : flipped ? tile.a : tile.b;
    chain.push({ tile, side: 'right', flipped, order });
  }
  return chain;
}

function assertFitsAndNoOverlap(laid: LaidTile[], bounds = { halfWidth: 9, halfDepth: 7 }) {
  const boxes = laid.map(footprint);
  for (const b of boxes) {
    expect(b.minX).toBeGreaterThanOrEqual(-bounds.halfWidth - 1e-9);
    expect(b.maxX).toBeLessThanOrEqual(bounds.halfWidth + 1e-9);
    expect(b.minZ).toBeGreaterThanOrEqual(-bounds.halfDepth - 1e-9);
    expect(b.maxZ).toBeLessThanOrEqual(bounds.halfDepth + 1e-9);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
      const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
      if (overlapX > 1e-6 && overlapZ > 1e-6) {
        throw new Error(`tiles ${laid[i]!.id} and ${laid[j]!.id} overlap`);
      }
    }
  }
}

describe('layoutChain snake', () => {
  it('turns a long one-sided chain into a snake that stays on the table', () => {
    const chain = longRightChain();
    expect(chain.length).toBeGreaterThan(10);
    const laid = layoutChain(chain, bounds);
    expect(laid).toHaveLength(chain.length);
    assertFitsAndNoOverlap(laid);
    expect(laid.some((l) => Math.abs(l.position[2]) > 1)).toBe(true); // it did turn
  });

  it('real games fit the chain area left free by the standing rows, without overlap (300 seeds)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      try {
        assertFitsAndNoOverlap(layoutChain(playedChain(seed), CHAIN_BOUNDS), CHAIN_BOUNDS);
      } catch (e) {
        throw new Error(`seed ${seed}: ${(e as Error).message}`, { cause: e });
      }
    }
  });

  it('real games: every chain fits and no two tiles overlap (100 seeds)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const laid = layoutChain(playedChain(seed), bounds);
      try {
        assertFitsAndNoOverlap(laid);
      } catch (e) {
        throw new Error(`seed ${seed}: ${(e as Error).message}`, { cause: e });
      }
    }
  });
});
