import { describe, expect, it } from 'vitest';
import { HAND_SIZE, createDeck, deal, dealUntilFair, findOpener, needsRedeal, shuffle } from './deck';
import { REDEAL_MIN_DOUBLES } from '../constants';
import type { Tile } from '../types';
import { t } from './testing';

describe('createDeck', () => {
  it('creates 28 unique tiles with a <= b in 0..6', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(28);
    expect(new Set(deck.map((x) => x.id)).size).toBe(28);
    for (const tile of deck) {
      expect(tile.a).toBeGreaterThanOrEqual(0);
      expect(tile.b).toBeLessThanOrEqual(6);
      expect(tile.a).toBeLessThanOrEqual(tile.b);
      expect(tile.id).toBe(`${tile.a}-${tile.b}`);
    }
  });

  it('contains exactly 7 doubles', () => {
    expect(createDeck().filter((x) => x.a === x.b)).toHaveLength(7);
  });
});

describe('shuffle', () => {
  it('returns a permutation and does not mutate the input', () => {
    const deck = createDeck();
    const before = deck.map((x) => x.id);
    const rng = seeded(42);
    const out = shuffle(deck, rng);
    expect(deck.map((x) => x.id)).toEqual(before);
    expect([...out.map((x) => x.id)].sort()).toEqual([...before].sort());
  });

  it('is Fisher-Yates: swaps i with rng(i + 1) from the end', () => {
    // rng always 0 -> each element i swaps with index 0.
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    // rng(n) = n - 1 -> every swap is with itself (identity).
    expect(shuffle([1, 2, 3, 4], (n) => n - 1)).toEqual([1, 2, 3, 4]);
  });

  it('asks rng for a bound of i + 1 for i = n-1 .. 1', () => {
    const bounds: number[] = [];
    shuffle([1, 2, 3, 4], (n) => {
      bounds.push(n);
      return 0;
    });
    expect(bounds).toEqual([4, 3, 2]);
  });
});

describe('deal', () => {
  it('gives 7 consecutive tiles to N, E, S, W in order', () => {
    const deck = createDeck();
    const hands = deal(deck);
    expect(hands.N).toEqual(deck.slice(0, 7));
    expect(hands.E).toEqual(deck.slice(7, 14));
    expect(hands.S).toEqual(deck.slice(14, 21));
    expect(hands.W).toEqual(deck.slice(21, 28));
  });

  it('rejects a deck that is not 28 tiles', () => {
    expect(() => deal(createDeck().slice(1))).toThrow();
  });
});

describe('findOpener', () => {
  it('returns the seat holding 6-6', () => {
    expect(findOpener({ N: [t(0, 1)], E: [t(2, 3)], S: [t(6, 6)], W: [t(4, 5)] })).toBe('S');
  });

  it('throws when nobody holds 6-6', () => {
    expect(() => findOpener({ N: [t(0, 1)], E: [], S: [], W: [] })).toThrow();
  });
});

function seeded(seed: number) {
  let s = seed;
  return (max: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
}

/** A deck whose first hand (N) holds `n` doubles; the other doubles are spread over E, S, W. */
function deckWithDoublesInNorth(n: number): Tile[] {
  const doubles = createDeck().filter((x) => x.a === x.b);
  const others = createDeck().filter((x) => x.a !== x.b);
  const hands: Tile[][] = [[...doubles.slice(0, n)], [], [], []];
  doubles.slice(n).forEach((d, i) => hands[1 + (i % 3)]!.push(d));
  for (const hand of hands) while (hand.length < HAND_SIZE) hand.push(others.shift()!);
  return hands.flat();
}

describe('needsRedeal (a hand with 5 or more doubles)', () => {
  it('is false for an ordinary deal', () => {
    expect(needsRedeal(deal(deckWithDoublesInNorth(2)))).toBe(false);
  });

  it('is false with 4 doubles in one hand', () => {
    expect(needsRedeal(deal(deckWithDoublesInNorth(4)))).toBe(false);
  });

  it(`is true with ${REDEAL_MIN_DOUBLES}, 6 or 7 doubles in one hand`, () => {
    expect(needsRedeal(deal(deckWithDoublesInNorth(5)))).toBe(true);
    expect(needsRedeal(deal(deckWithDoublesInNorth(6)))).toBe(true);
    expect(needsRedeal(deal(deckWithDoublesInNorth(7)))).toBe(true);
  });
});

describe('dealUntilFair', () => {
  it('deals once when the first deal is fair', () => {
    let calls = 0;
    const hands = dealUntilFair(() => {
      calls++;
      return deckWithDoublesInNorth(1);
    });
    expect(calls).toBe(1);
    expect(hands).toEqual(deal(deckWithDoublesInNorth(1)));
  });

  it('shuffles and deals again while a hand has 5 or more doubles', () => {
    const decks = [deckWithDoublesInNorth(5), deckWithDoublesInNorth(7), deckWithDoublesInNorth(3)];
    let calls = 0;
    const hands = dealUntilFair(() => decks[calls++]!);
    expect(calls).toBe(3);
    expect(hands).toEqual(deal(deckWithDoublesInNorth(3)));
  });

  it('gives up after maxTries so a broken shuffle cannot hang the server', () => {
    expect(() => dealUntilFair(() => deckWithDoublesInNorth(5), 10)).toThrow(/no fair deal in 10 shuffles/);
  });
});
