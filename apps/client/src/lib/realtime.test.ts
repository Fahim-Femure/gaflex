import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerView, SessionData } from '@gaflex/shared';

let resolveResume: (v: unknown) => void = () => {};
vi.mock('./socket', () => ({
  getSocket: vi.fn(),
  request: vi.fn(() => new Promise((r) => (resolveResume = r))),
}));

const { resumeSession, markLocalSlam, resolvePlayedEvent } = await import('./realtime');
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

describe('resolvePlayedEvent (local slam fallback)', () => {
  it('preserves slam: true from local push even if server omits slam, and consumes once', () => {
    markLocalSlam('0-0');
    const first = resolvePlayedEvent({ type: 'played', seat: 'S', tile: { id: '0-0', a: 0, b: 0 }, side: 'left' });
    expect(first.slam).toBe(true);
    const second = resolvePlayedEvent({ type: 'played', seat: 'S', tile: { id: '0-0', a: 0, b: 0 }, side: 'left' });
    expect(second.slam).toBeUndefined();
  });
});

describe('startSession view preservation', () => {
  const sampleView: PlayerView = {
    status: 'playing',
    mode: 'solo',
    round: 1,
    chain: [],
    ends: null,
    turn: 'E',
    passStreak: 0,
    lastActor: null,
    handCounts: { N: 7, E: 7, S: 7, W: 7 },
    scores: { N: 0, E: 0, S: 0, W: 0 },
    tally: { N: 0, E: 0, S: 0, W: 0 },
    result: null,
    revealedHands: null,
    gameLoser: null,
    seat: 'E',
    hand: [{ id: '0-0', a: 0, b: 0 }],
    legalMoves: [{ tileId: '0-0', side: 'left' }],
  };

  it('preserves views arrived just before ack when joining an active mid-game replacement', () => {
    useGameStore.getState().setPlayerView(sampleView);
    const active = sessionData('REP123', 'tok-1');
    active.room.status = 'playing';
    useGameStore.getState().startSession(active);
    expect(useGameStore.getState().playerView).toEqual(sampleView);
  });

  it('clears views when joining a lobby session', () => {
    useGameStore.getState().setPlayerView(sampleView);
    useGameStore.getState().startSession(sessionData('LOB123', 'tok-2'));
    expect(useGameStore.getState().playerView).toBeNull();
  });
});
