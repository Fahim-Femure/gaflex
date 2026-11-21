import { describe, expect, it } from 'vitest';
import {
  EVENTS,
  OPENER_TILE,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SEAT_ORDER,
  TARGET_SCORE_OPTIONS,
  DEFAULT_TARGET_SCORE,
  TEAM_OF_SEAT,
} from '../index';

describe('seat constants', () => {
  it('orders turns clockwise N -> E -> S -> W', () => {
    expect(SEAT_ORDER).toEqual(['N', 'E', 'S', 'W']);
  });

  it('puts opposite seats on the same team (N+S = A, E+W = B)', () => {
    expect(TEAM_OF_SEAT).toEqual({ N: 'A', S: 'A', E: 'B', W: 'B' });
  });
});

describe('game constants', () => {
  it('opens round one with the 6-6 tile', () => {
    expect(OPENER_TILE).toEqual({ a: 6, b: 6 });
  });

  it('defaults target score to 100 with 50/100/150 options', () => {
    expect(DEFAULT_TARGET_SCORE).toBe(100);
    expect(TARGET_SCORE_OPTIONS).toEqual([50, 100, 150]);
  });
});

describe('room code constants', () => {
  it('uses 6 characters', () => {
    expect(ROOM_CODE_LENGTH).toBe(6);
  });

  it('excludes ambiguous characters 0, O, 1, I', () => {
    for (const ch of ['0', 'O', '1', 'I']) {
      expect(ROOM_CODE_ALPHABET).not.toContain(ch);
    }
    expect(ROOM_CODE_ALPHABET).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
  });
});

describe('socket event names', () => {
  it('matches the protocol in docs/04', () => {
    expect(EVENTS).toEqual({
      ROOM_CREATE: 'room:create',
      ROOM_JOIN: 'room:join',
      ROOM_PEEK: 'room:peek',
      ROOM_JOIN_TABLE: 'room:join_table',
      SEAT_TAKE: 'seat:take',
      SEAT_LEAVE: 'seat:leave',
      GAME_START: 'game:start',
      GAME_PLAY: 'game:play',
      GAME_SKIP: 'game:skip',
      ROUND_NEXT: 'round:next',
      SESSION_RESUME: 'session:resume',
      ROOM_STATE: 'room:state',
      GAME_PLAYER_VIEW: 'game:player_view',
      GAME_TABLE_VIEW: 'game:table_view',
      GAME_EVENT: 'game:event',
      ERROR: 'error',
    });
  });
});
