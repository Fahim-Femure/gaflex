import type { MemberRole } from '@gaflex/shared';

export type StoredSession = {
  code: string;
  memberId: string;
  role: MemberRole;
  sessionToken: string;
};

const KEY = 'gaflex:session';

/** Per-tab: survives refresh, never leaks into another tab of the same browser. */
export function tabStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Per-device copy, only adopted on an explicit "Kembali ke room" (closed tab, app reopened). */
export function deviceStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const defaultStorage = deviceStorage;

function isStoredSession(x: unknown): x is StoredSession {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.code === 'string' &&
    typeof s.memberId === 'string' &&
    (s.role === 'player' || s.role === 'table') &&
    typeof s.sessionToken === 'string'
  );
}

export function loadSession(storage: Storage | null = defaultStorage()): StoredSession | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession, storage: Storage | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private mode or blocked storage: reconnect after refresh won't work, play still does.
  }
}

export function clearSession(storage: Storage | null = defaultStorage()): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // ignore
  }
}
