import { describe, expect, it } from 'vitest';
import { loadMuted, saveMuted } from './settings';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('mute setting', () => {
  it('defaults to sound on', () => {
    expect(loadMuted(memoryStorage())).toBe(false);
  });

  it('remembers the choice on this device', () => {
    const s = memoryStorage();
    saveMuted(true, s);
    expect(loadMuted(s)).toBe(true);
    saveMuted(false, s);
    expect(loadMuted(s)).toBe(false);
  });

  it('never throws when storage is blocked', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(loadMuted(broken)).toBe(false);
    expect(() => saveMuted(true, broken)).not.toThrow();
  });
});
