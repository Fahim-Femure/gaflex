import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionData } from '@gaflex/shared';

let resolveResume: (v: unknown) => void = () => {};
vi.mock('./socket', () => ({
  getSocket: vi.fn(),
  request: vi.fn(() => new Promise((r) => (resolveResume = r))),
}));

const { resumeSession } = await import('./realtime');
const { useGameStore } = await import('../store/useGameStore');

const sessionData = (code: string, token: string): SessionData => ({
  memberId: `m-${code}`,
  role: 'player',
  sessionToken: token,
  room: {
    code,
    hostId: `m-${code}`,
    mode: 'solo',
    setup: 4,
    seats: { N: null, E: null, S: null, W: null },
    tableDeviceId: null,
    status: 'lobby',
    targetScore: 100,
    tableConnected: false,
  },
});

beforeEach(() => {
  useGameStore.getState().endSession();
});

describe('resumeSession', () => {
  it('a stale resume failing late does not end a session started meanwhile', async () => {
    useGameStore.getState().startSession(sessionData('OLD234', 'old-token'));
    const pending = resumeSession(); // resume of OLD234 in flight

    useGameStore.getState().startSession(sessionData('NEW234', 'new-token')); // user created a room

    resolveResume({ ok: false, error: 'SESSION_INVALID' });
    await pending;

    expect(useGameStore.getState().session?.code).toBe('NEW234');
  });

  it('a failed resume of the current session ends it', async () => {
    useGameStore.getState().startSession(sessionData('OLD234', 'old-token'));
    const pending = resumeSession();
    resolveResume({ ok: false, error: 'SESSION_INVALID' });
    await pending;
    expect(useGameStore.getState().session).toBeNull();
  });
});
