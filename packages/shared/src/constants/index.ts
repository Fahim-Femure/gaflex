import type { Seat, Team } from '../types';

export const SEAT_ORDER: readonly Seat[] = ['N', 'E', 'S', 'W'];

export const TEAM_OF_SEAT: Readonly<Record<Seat, Team>> = { N: 'A', S: 'A', E: 'B', W: 'B' };

/** Round-one opener. Change here to alter the house rule. */
export const OPENER_TILE = { a: 6, b: 6 } as const;

/**
 * Losers collect their remaining pips; whoever goes above this (reaches 101) loses the game
 * (owner, 2026-11-22). Fixed: the host no longer picks a target.
 */
export const SCORE_LIMIT = 100;

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A hand with this many doubles (balak) or more is reshuffled and dealt again (owner, 2026-11-22). */
export const REDEAL_MIN_DOUBLES = 5;

export const MAX_PLAYERS = 4;
export const PLAYER_NAME_MAX = 16;
/** A disconnected member keeps its seat this long (docs/01: 2 minutes). */
export const RECONNECT_GRACE_MS = 2 * 60_000;
/** The host may skip a player on turn once they have been disconnected this long (owner, 2026-11-22). */
export const SKIP_AFTER_MS = 15_000;
/** A room with no activity is removed after this long (docs/01: 30 minutes). */
export const ROOM_IDLE_MS = 30 * 60_000;

export { EVENTS } from './events';
