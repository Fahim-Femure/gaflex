import { describe, expect, it } from 'vitest';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode, sanitizeName } from './index';
import { ROOM_CODE_ALPHABET } from '../constants';

describe('normalizeRoomCode', () => {
  it('uppercases and drops characters outside the alphabet', () => {
    expect(normalizeRoomCode(' ab-c d2 ')).toBe('ABCD2');
  });

  it('drops ambiguous characters 0, O, 1, I', () => {
    expect(normalizeRoomCode('o0i1ab')).toBe('AB');
  });

  it('caps at 6 characters', () => {
    expect(normalizeRoomCode('abcdefghjk')).toBe('ABCDEF');
  });
});

describe('isValidRoomCode', () => {
  it('accepts exactly 6 alphabet characters', () => {
    expect(isValidRoomCode('ABC234')).toBe(true);
  });

  it('rejects wrong length, lowercase and ambiguous characters', () => {
    expect(isValidRoomCode('ABC23')).toBe(false);
    expect(isValidRoomCode('abc234')).toBe(false);
    expect(isValidRoomCode('ABC230')).toBe(false);
  });
});

describe('generateRoomCode', () => {
  it('builds 6 characters from rng indexes into the alphabet', () => {
    const picks = [0, 1, 2, 3, 30, 31];
    let i = 0;
    const code = generateRoomCode((max) => {
      expect(max).toBe(ROOM_CODE_ALPHABET.length);
      return picks[i++]!;
    });
    expect(code).toBe('ABCD89');
    expect(isValidRoomCode(code)).toBe(true);
  });
});

describe('sanitizeName', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizeName('  Budi   Santoso ')).toBe('Budi Santoso');
  });

  it('caps at 16 characters', () => {
    expect(sanitizeName('Abcdefghijklmnopqrstu')).toBe('Abcdefghijklmnop');
  });

  it('returns null for empty or non-string input', () => {
    expect(sanitizeName('   ')).toBeNull();
    expect(sanitizeName(42)).toBeNull();
  });
});
