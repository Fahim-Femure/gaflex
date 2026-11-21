import { PLAYER_NAME_MAX, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../constants';
import type { Rng } from '../rules/deck';

const CODE_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** For the join input: uppercase, keep alphabet characters only, cap length. */
export function normalizeRoomCode(input: string): string {
  return [...input.toUpperCase()]
    .filter((ch) => ROOM_CODE_ALPHABET.includes(ch))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: unknown): code is string {
  return typeof code === 'string' && CODE_RE.test(code);
}

export function generateRoomCode(rng: Rng): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[rng(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function sanitizeName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim().replace(/\s+/g, ' ').slice(0, PLAYER_NAME_MAX).trim();
  return name.length > 0 ? name : null;
}
