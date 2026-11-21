import { describe, expect, it } from 'vitest';
import { clearSession, loadSession, saveSession, type StoredSession } from './session';

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

const s: StoredSession = { code: 'ABC234', memberId: 'm1', role: 'player', sessionToken: 'tok' };

describe('session storage', () => {
  it('round-trips a saved session', () => {
    const store = memoryStorage();
    saveSession(s, store);
    expect(loadSession(store)).toEqual(s);
  });

  it('returns null when nothing or garbage is stored', () => {
    const store = memoryStorage();
    expect(loadSession(store)).toBeNull();
    store.setItem('gaflex:session', '{not json');
    expect(loadSession(store)).toBeNull();
    store.setItem('gaflex:session', JSON.stringify({ code: 'ABC234' }));
    expect(loadSession(store)).toBeNull();
  });

  it('clearSession removes it', () => {
    const store = memoryStorage();
    saveSession(s, store);
    clearSession(store);
    expect(loadSession(store)).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(loadSession(broken)).toBeNull();
    expect(() => saveSession(s, broken)).not.toThrow();
    expect(() => clearSession(broken)).not.toThrow();
  });
});
