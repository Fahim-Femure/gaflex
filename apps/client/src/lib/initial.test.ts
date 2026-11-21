import { describe, expect, it } from 'vitest';
import { initialOf } from './initial';

describe('initialOf', () => {
  it('takes the first letter, upper-cased', () => {
    expect(initialOf('budi')).toBe('B');
    expect(initialOf('Jo')).toBe('J');
  });

  it('keeps a whole emoji instead of half a surrogate pair', () => {
    expect(initialOf('🀄Bang Jago')).toBe('🀄');
    expect(initialOf('👩‍👧 Ibu')).toBe('👩‍👧');
  });

  it('keeps combined diacritics together', () => {
    expect(initialOf('ánh')).toBe('Á');
    expect(initialOf('éva')).toBe('É');
  });

  it('falls back for empty names', () => {
    expect(initialOf('  ')).toBe('?');
  });
});
