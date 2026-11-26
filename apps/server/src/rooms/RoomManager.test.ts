import { beforeEach, describe, expect, it } from 'vitest';
import { RECONNECT_GRACE_MS, ROOM_IDLE_MS, type RoomCreatePayload } from '@gaflex/shared';
import { RoomManager } from './RoomManager';

const base: RoomCreatePayload = { name: 'Host', mode: 'solo', setup: 4 };

let clock = 0;
let manager: RoomManager;

beforeEach(() => {
  clock = 1_000;
  let n = 0;
  manager = new RoomManager({ now: () => clock, newId: () => `id${++n}` });
});

function ok<T>(res: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!res.ok) throw new Error(`expected ok, got ${res.error}`);
  return res.data;
}

describe('create', () => {
  it('creates a lobby room with a valid code and the creator as host', () => {
    const s = ok(manager.create(base));
    expect(s.room.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(s.room.hostId).toBe(s.memberId);
    expect(s.role).toBe('player');
    expect(s.room.status).toBe('lobby');
    expect(s.room.seats).toEqual({ N: null, E: null, S: null, W: null });
    expect(s.sessionToken.length).toBeGreaterThan(0);
  });

  it('never reuses an active room code', () => {
    // rng that repeats the same code first, then a new one
    const codes = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
    let c = 0;
    const m = new RoomManager({ codeGen: () => codes[c++]! });
    expect(ok(m.create(base)).room.code).toBe('AAAAAA');
    expect(ok(m.create(base)).room.code).toBe('BBBBBB');
  });

  it('rejects invalid payloads', () => {
    expect(manager.create({ ...base, name: '  ' })).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
    expect(manager.create({ ...base, mode: 'x' as never })).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
    expect(manager.create({ ...base, setup: 3 as never })).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
  });
});

describe('join and peek', () => {
  it('joins an existing room without a seat', () => {
    const host = ok(manager.create(base));
    const p = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    expect(p.role).toBe('player');
    expect(p.room.code).toBe(host.room.code);
    expect(p.memberId).not.toBe(host.memberId);
  });

  it('accepts a lowercase code', () => {
    const host = ok(manager.create(base));
    expect(manager.join({ code: host.room.code.toLowerCase(), name: 'Ani' }).ok).toBe(true);
  });

  it('rejects unknown codes', () => {
    expect(manager.join({ code: 'ZZZZZZ', name: 'Ani' })).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
  });

  it('rejects a fifth player', () => {
    const { room } = ok(manager.create(base));
    for (const name of ['B', 'C', 'D']) ok(manager.join({ code: room.code, name }));
    expect(manager.join({ code: room.code, name: 'E' })).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('peek reports mode, setup, free seats and table availability', () => {
    const host = ok(manager.create({ ...base, setup: 5, mode: 'team' }));
    ok(manager.takeSeat(host.memberId, 'S'));
    expect(ok(manager.peek({ code: host.room.code }))).toEqual({
      code: host.room.code,
      mode: 'team',
      setup: 5,
      freeSeats: ['N', 'E', 'W'],
      tableAvailable: true,
    });
  });
});

describe('seats', () => {
  it('takes a free seat and shows the name', () => {
    const host = ok(manager.create(base));
    const room = ok(manager.takeSeat(host.memberId, 'N'));
    expect(room.seats.N).toEqual({ playerId: host.memberId, name: 'Host', connected: true });
  });

  it('rejects a seat held by someone else', () => {
    const host = ok(manager.create(base));
    const p = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    ok(manager.takeSeat(host.memberId, 'N'));
    expect(manager.takeSeat(p.memberId, 'N')).toEqual({ ok: false, error: 'SEAT_TAKEN' });
  });

  it('moving seats frees the old one', () => {
    const host = ok(manager.create(base));
    ok(manager.takeSeat(host.memberId, 'N'));
    const room = ok(manager.takeSeat(host.memberId, 'E'));
    expect(room.seats.N).toBeNull();
    expect(room.seats.E?.playerId).toBe(host.memberId);
  });

  it('leaveSeat frees the seat', () => {
    const host = ok(manager.create(base));
    ok(manager.takeSeat(host.memberId, 'W'));
    expect(ok(manager.leaveSeat(host.memberId)).seats.W).toBeNull();
  });

  it('rejects seat actions from unknown members or table devices', () => {
    const host = ok(manager.create({ ...base, setup: 5 }));
    const table = ok(manager.joinTable({ code: host.room.code }));
    expect(manager.takeSeat('nobody', 'N')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    expect(manager.takeSeat(table.memberId, 'N')).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
  });

  it('rejects an invalid seat', () => {
    const host = ok(manager.create(base));
    expect(manager.takeSeat(host.memberId, 'X' as never)).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
  });
});

describe('seats during a game', () => {
  it('rejects seat changes once the room is not in the lobby', () => {
    const host = ok(manager.create(base));
    ok(manager.takeSeat(host.memberId, 'N'));
    manager.getRoomForGame(host.room.code)!.status = 'playing';
    expect(manager.takeSeat(host.memberId, 'E')).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
    expect(manager.leaveSeat(host.memberId)).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
  });
});

describe('a player who left the lobby', () => {
  it('does not keep the room full: a new player takes the slot and the old seat is freed', () => {
    const { room } = ok(manager.create(base));
    const ids = ['B', 'C', 'D'].map((name) => ok(manager.join({ code: room.code, name })));
    ok(manager.takeSeat(ids[1]!.memberId, 'E'));
    manager.disconnect(ids[1]!.memberId); // closed the tab
    const e = ok(manager.join({ code: room.code, name: 'E' }));
    expect(e.room.seats.E).toBeNull();
    expect(manager.resume({ sessionToken: ids[1]!.sessionToken })).toEqual({ ok: false, error: 'SESSION_INVALID' });
  });

  it('keeps its slot while nobody needs it, so a refresh still resumes', () => {
    const { room } = ok(manager.create(base));
    const p = ok(manager.join({ code: room.code, name: 'Ani' }));
    manager.disconnect(p.memberId);
    expect(manager.resume({ sessionToken: p.sessionToken }).ok).toBe(true);
  });

  it('during a game a disconnected player still holds the slot', () => {
    const { room } = ok(manager.create(base));
    const ids = ['B', 'C', 'D'].map((name) => ok(manager.join({ code: room.code, name })));
    manager.getRoomForGame(room.code)!.status = 'playing';
    manager.disconnect(ids[0]!.memberId);
    expect(manager.join({ code: room.code, name: 'E' })).toEqual({ ok: false, error: 'ROOM_FULL' });
  });
});

describe('release', () => {
  it('in the lobby removes the member and frees its slot', () => {
    const host = ok(manager.create(base));
    const p = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    ok(manager.takeSeat(p.memberId, 'E'));
    expect(manager.release(p.memberId)).toBe(host.room.code);
    expect(manager.getPublicRoom(host.room.code)?.seats.E).toBeNull();
    expect(manager.resume({ sessionToken: p.sessionToken })).toEqual({ ok: false, error: 'SESSION_INVALID' });
  });

  it('during a game keeps the seat and only marks the member disconnected', () => {
    const host = ok(manager.create(base));
    ok(manager.takeSeat(host.memberId, 'N'));
    manager.getRoomForGame(host.room.code)!.status = 'playing';
    manager.release(host.memberId);
    expect(manager.getPublicRoom(host.room.code)?.seats.N).toEqual({ playerId: host.memberId, name: 'Host', connected: false });
  });
});

describe('table device', () => {
  it('joins a 5-device room as the table', () => {
    const host = ok(manager.create({ ...base, setup: 5 }));
    const t = ok(manager.joinTable({ code: host.room.code }));
    expect(t.role).toBe('table');
    expect(t.room.tableDeviceId).toBe(t.memberId);
    expect(t.room.tableConnected).toBe(true);
  });

  it('is unavailable in a 4-device room or when a table is already connected', () => {
    const four = ok(manager.create(base));
    expect(manager.joinTable({ code: four.room.code })).toEqual({ ok: false, error: 'TABLE_UNAVAILABLE' });
    const five = ok(manager.create({ ...base, setup: 5 }));
    ok(manager.joinTable({ code: five.room.code }));
    expect(manager.joinTable({ code: five.room.code })).toEqual({ ok: false, error: 'TABLE_UNAVAILABLE' });
  });

  it('does not count toward the 4 players', () => {
    const { room } = ok(manager.create({ ...base, setup: 5 }));
    ok(manager.joinTable({ code: room.code }));
    for (const name of ['B', 'C', 'D']) ok(manager.join({ code: room.code, name }));
    expect(manager.join({ code: room.code, name: 'E' })).toEqual({ ok: false, error: 'ROOM_FULL' });
  });
});

describe('disconnect and resume', () => {
  it('marks a seated player disconnected but keeps the seat', () => {
    const host = ok(manager.create(base));
    ok(manager.takeSeat(host.memberId, 'N'));
    const room = manager.disconnect(host.memberId);
    expect(room?.seats.N).toEqual({ playerId: host.memberId, name: 'Host', connected: false });
  });

  it('resume by token restores the member and its seat', () => {
    const host = ok(manager.create(base));
    ok(manager.takeSeat(host.memberId, 'N'));
    manager.disconnect(host.memberId);
    const s = ok(manager.resume({ sessionToken: host.sessionToken }));
    expect(s.memberId).toBe(host.memberId);
    expect(s.room.seats.N?.connected).toBe(true);
  });

  it('rejects an unknown token', () => {
    expect(manager.resume({ sessionToken: 'nope' })).toEqual({ ok: false, error: 'SESSION_INVALID' });
  });

  it('sweep frees a seat after the reconnect grace period', () => {
    const host = ok(manager.create(base));
    const p = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    ok(manager.takeSeat(p.memberId, 'E'));
    manager.disconnect(p.memberId);

    clock += RECONNECT_GRACE_MS - 1;
    expect(manager.sweep().changed).toEqual([]);
    clock += 2;
    expect(manager.sweep().changed).toEqual([host.room.code]);

    expect(manager.getPublicRoom(host.room.code)?.seats.E).toBeNull();
    expect(manager.resume({ sessionToken: p.sessionToken })).toEqual({ ok: false, error: 'SESSION_INVALID' });
  });

  it('passes host to the next player when the host is swept', () => {
    const host = ok(manager.create(base));
    const p = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    manager.disconnect(host.memberId);
    clock += RECONNECT_GRACE_MS + 1;
    manager.sweep();
    expect(manager.getPublicRoom(host.room.code)?.hostId).toBe(p.memberId);
  });

  it('removes a room once every member is gone', () => {
    const host = ok(manager.create(base));
    manager.disconnect(host.memberId);
    clock += RECONNECT_GRACE_MS + 1;
    expect(manager.sweep().removed).toEqual([host.room.code]);
    expect(manager.getPublicRoom(host.room.code)).toBeNull();
  });

  it('frees the table slot when the table device is swept', () => {
    const host = ok(manager.create({ ...base, setup: 5 }));
    const t = ok(manager.joinTable({ code: host.room.code }));
    manager.disconnect(t.memberId);
    expect(manager.getPublicRoom(host.room.code)?.tableConnected).toBe(false);
    clock += RECONNECT_GRACE_MS + 1;
    manager.sweep();
    expect(manager.getPublicRoom(host.room.code)?.tableDeviceId).toBeNull();
  });
});

describe('idle expiry', () => {
  it('removes a room after 30 minutes without activity', () => {
    const host = ok(manager.create(base));
    clock += ROOM_IDLE_MS - 1;
    expect(manager.sweep().removed).toEqual([]);
    ok(manager.takeSeat(host.memberId, 'N')); // activity resets the timer
    clock += ROOM_IDLE_MS - 1;
    expect(manager.sweep().removed).toEqual([]);
    clock += 2;
    expect(manager.sweep().removed).toEqual([host.room.code]);
    expect(manager.resume({ sessionToken: host.sessionToken })).toEqual({ ok: false, error: 'SESSION_INVALID' });
  });
});

describe('kick (host removes a disconnected player)', () => {
  it('in lobby: frees seat and slot, and invalidates kicked session', () => {
    const host = ok(manager.create(base));
    const p = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    ok(manager.takeSeat(p.memberId, 'E'));
    manager.disconnect(p.memberId);

    const res = ok(manager.kick(host.memberId, 'E'));
    expect(res).toEqual({ code: host.room.code, kickedMemberId: p.memberId });
    expect(manager.getPublicRoom(host.room.code)?.seats.E).toBeNull();
    expect(manager.resume({ sessionToken: p.sessionToken })).toEqual({ ok: false, error: 'SESSION_INVALID' });
  });

  it('rejects kick by non-host, on self, on empty seat, or while target is connected', () => {
    const host = ok(manager.create(base));
    const ani = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    ok(manager.takeSeat(host.memberId, 'N'));
    ok(manager.takeSeat(ani.memberId, 'E'));

    expect(manager.kick(host.memberId, 'E')).toEqual({ ok: false, error: 'KICK_NOT_ALLOWED' });
    expect(manager.kick(host.memberId, 'S')).toEqual({ ok: false, error: 'KICK_NOT_ALLOWED' });
    expect(manager.kick(host.memberId, 'N')).toEqual({ ok: false, error: 'KICK_NOT_ALLOWED' });

    manager.disconnect(ani.memberId);
    const bob = ok(manager.join({ code: host.room.code, name: 'Bob' }));
    expect(manager.kick(bob.memberId, 'E')).toEqual({ ok: false, error: 'NOT_HOST' });
  });

  it('during a game: frees the seat so a newcomer can join and auto-take the single vacant seat', () => {
    const host = ok(manager.create(base));
    const seats = {
      N: host,
      E: ok(manager.join({ code: host.room.code, name: 'Ani' })),
      S: ok(manager.join({ code: host.room.code, name: 'Bob' })),
      W: ok(manager.join({ code: host.room.code, name: 'Citra' })),
    };
    ok(manager.takeSeat(seats.N.memberId, 'N'));
    ok(manager.takeSeat(seats.E.memberId, 'E'));
    ok(manager.takeSeat(seats.S.memberId, 'S'));
    ok(manager.takeSeat(seats.W.memberId, 'W'));
    manager.getRoomForGame(host.room.code)!.status = 'playing';

    manager.disconnect(seats.E.memberId);
    ok(manager.kick(host.memberId, 'E'));
    expect(manager.getPublicRoom(host.room.code)?.seats.E).toBeNull();

    const repl = ok(manager.join({ code: host.room.code, name: 'Dodi' }));
    expect(repl.room.seats.E).toEqual({ playerId: repl.memberId, name: 'Dodi', connected: true });
    expect(manager.join({ code: host.room.code, name: 'Extra' })).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('during a game with 2 vacant seats: replacement joins unseated and picks a free seat with takeSeat', () => {
    const host = ok(manager.create(base));
    const e = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    const s = ok(manager.join({ code: host.room.code, name: 'Bob' }));
    const w = ok(manager.join({ code: host.room.code, name: 'Citra' }));
    ok(manager.takeSeat(host.memberId, 'N'));
    ok(manager.takeSeat(e.memberId, 'E'));
    ok(manager.takeSeat(s.memberId, 'S'));
    ok(manager.takeSeat(w.memberId, 'W'));
    manager.getRoomForGame(host.room.code)!.status = 'playing';

    manager.disconnect(e.memberId);
    manager.disconnect(s.memberId);
    ok(manager.kick(host.memberId, 'E'));
    ok(manager.kick(host.memberId, 'S'));

    const repl = ok(manager.join({ code: host.room.code, name: 'Dodi' }));
    expect(repl.room.seats.E).toBeNull();
    expect(repl.room.seats.S).toBeNull();
    expect(manager.takeSeat(repl.memberId, 'N')).toEqual({ ok: false, error: 'SEAT_TAKEN' });
    const seated = ok(manager.takeSeat(repl.memberId, 'S'));
    expect(seated.seats.S).toEqual({ playerId: repl.memberId, name: 'Dodi', connected: true });
    // seated player still cannot switch seats mid-game
    expect(manager.takeSeat(host.memberId, 'E')).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
  });
});

describe('disband (host closes the lobby)', () => {
  it('removes the room and invalidates all member tokens', () => {
    const host = ok(manager.create({ ...base, setup: 5 }));
    const ani = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    const table = ok(manager.joinTable({ code: host.room.code }));

    expect(ok(manager.disband(host.memberId))).toEqual({ code: host.room.code });
    expect(manager.getPublicRoom(host.room.code)).toBeNull();
    expect(manager.resume({ sessionToken: host.sessionToken })).toEqual({ ok: false, error: 'SESSION_INVALID' });
    expect(manager.resume({ sessionToken: ani.sessionToken })).toEqual({ ok: false, error: 'SESSION_INVALID' });
    expect(manager.resume({ sessionToken: table.sessionToken })).toEqual({ ok: false, error: 'SESSION_INVALID' });
  });

  it('rejects non-host and disbanding outside the lobby', () => {
    const host = ok(manager.create(base));
    const ani = ok(manager.join({ code: host.room.code, name: 'Ani' }));
    expect(manager.disband(ani.memberId)).toEqual({ ok: false, error: 'NOT_HOST' });
    manager.getRoomForGame(host.room.code)!.status = 'playing';
    expect(manager.disband(host.memberId)).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
  });
});
