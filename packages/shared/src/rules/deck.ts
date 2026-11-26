import { OPENER_TILE, REDEAL_MIN_DOUBLES, SEAT_ORDER } from '../constants';
import type { Seat, Tile } from '../types';

/** Returns an integer in [0, maxExclusive). Server passes crypto.randomInt. */
export type Rng = (maxExclusive: number) => number;

export const HAND_SIZE = 7;
export const DECK_SIZE = 28;

export function createDeck(): Tile[] {
  const deck: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      deck.push({ id: `${a}-${b}`, a, b });
    }
  }
  return deck;
}

export function shuffle<T>(deck: readonly T[], rng: Rng): T[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function deal(deck: readonly Tile[]): Record<Seat, Tile[]> {
  if (deck.length !== DECK_SIZE) {
    throw new Error(`deal: expected ${DECK_SIZE} tiles, got ${deck.length}`);
  }
  const hands = {} as Record<Seat, Tile[]>;
  SEAT_ORDER.forEach((seat, i) => {
    hands[seat] = deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE);
  });
  return hands;
}

export const isDouble = (tile: Tile): boolean => tile.a === tile.b;

/** House rule: a hand holding REDEAL_MIN_DOUBLES or more doubles (balak) voids the deal. */
export function needsRedeal(hands: Record<Seat, readonly Tile[]>): boolean {
  return SEAT_ORDER.some((s) => hands[s].filter(isDouble).length >= REDEAL_MIN_DOUBLES);
}

/** Shuffles (via `nextDeck`) and deals until no hand needs a redeal. */
export function dealUntilFair(nextDeck: () => Tile[], maxTries = 1000): Record<Seat, Tile[]> {
  for (let i = 0; i < maxTries; i++) {
    const hands = deal(nextDeck());
    if (!needsRedeal(hands)) return hands;
  }
  throw new Error(`dealUntilFair: no fair deal in ${maxTries} shuffles`);
}

export function isOpenerTile(tile: Tile): boolean {
  return tile.a === OPENER_TILE.a && tile.b === OPENER_TILE.b;
}

export function findOpener(hands: Record<Seat, readonly Tile[]>): Seat {
  const seat = SEAT_ORDER.find((s) => hands[s].some(isOpenerTile));
  if (!seat) throw new Error('findOpener: no seat holds the opener tile');
  return seat;
}
