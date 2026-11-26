import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket } from 'socket.io-client';
import { EVENTS, type Ack, type PublicRoom, type RoomPeek, type SessionData } from '@gaflex/shared';
import { createGameServer, type GameServer } from '../app';

let server: GameServer | null = null;
const sockets: Socket[] = [];
let url = '';

afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await server?.close();
  server = null;
});

async function start() {
  server = createGameServer({ corsOrigin: '*' });
  await new Promise<void>((resolve) => server!.httpServer.listen(0, resolve));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
}

async function client(): Promise<Socket> {
  const s = connectClient(url, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  await new Promise<void>((resolve, reject) => {
    s.once('connect', () => resolve());
    s.once('connect_error', reject);
  });
  return s;
}

function request<T>(s: Socket, event: string, payload: unknown): Promise<Ack<T>> {
  return s.timeout(2000).emitWithAck(event, payload);
}

async function must<T>(p: Promise<Ack<T>>): Promise<T> {
  const res = await p;
  if (!res.ok) throw new Error(`expected ok, got ${res.error}`);
  return res.data;
}

/** Resolves with the first room:state that satisfies the predicate. */
function waitForRoom(s: Socket, pred: (r: PublicRoom) => boolean): Promise<PublicRoom> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('room:state timeout')), 3000);
    const on = (room: PublicRoom) => {
      if (!pred(room)) return;
      clearTimeout(timer);
      s.off(EVENTS.ROOM_STATE, on);
      resolve(room);
    };
    s.on(EVENTS.ROOM_STATE, on);
  });
}

const full = (r: PublicRoom) => Object.values(r.seats).every((x) => x !== null) && r.tableConnected;

describe('lobby over Socket.IO', () => {
  it('5 devices join one room, take seats and all see the same state live', async () => {
    await start();
    const [host, b, c, d, table] = await Promise.all([client(), client(), client(), client(), client()]);

    const created = await must(
      request<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'team', setup: 5 }),
    );
    const code = created.room.code;

    const peek = await must(request<RoomPeek>(b, EVENTS.ROOM_PEEK, { code }));
    expect(peek).toMatchObject({ setup: 5, mode: 'team', tableAvailable: true });

    for (const [s, name] of [[b, 'Budi'], [c, 'Citra'], [d, 'Dewi']] as const) {
      await must(request<SessionData>(s, EVENTS.ROOM_JOIN, { code, name }));
    }
    const tableSession = await must(request<SessionData>(table, EVENTS.ROOM_JOIN_TABLE, { code }));
    expect(tableSession.role).toBe('table');

    const allSeeFull = [host, b, c, d, table].map((s) => waitForRoom(s, full));
    await must(request(host, EVENTS.SEAT_TAKE, { seat: 'N' }));
    await must(request(b, EVENTS.SEAT_TAKE, { seat: 'E' }));
    await must(request(c, EVENTS.SEAT_TAKE, { seat: 'S' }));
    await must(request(d, EVENTS.SEAT_TAKE, { seat: 'W' }));

    const rooms = await Promise.all(allSeeFull);
    for (const r of rooms) {
      expect(r.seats.N?.name).toBe('Host');
      expect(r.seats.E?.name).toBe('Budi');
      expect(r.seats.S?.name).toBe('Citra');
      expect(r.seats.W?.name).toBe('Dewi');
    }
  });

  it('rejects a taken seat with SEAT_TAKEN', async () => {
    await start();
    const [host, b] = await Promise.all([client(), client()]);
    const { room } = await must(
      request<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 4 }),
    );
    await must(request(b, EVENTS.ROOM_JOIN, { code: room.code, name: 'Budi' }));
    await must(request(host, EVENTS.SEAT_TAKE, { seat: 'S' }));
    expect(await request(b, EVENTS.SEAT_TAKE, { seat: 'S' })).toEqual({ ok: false, error: 'SEAT_TAKEN' });
  });

  it('a socket that joins again replaces its old member instead of leaving a ghost', async () => {
    await start();
    const [host, b, c, d] = await Promise.all([client(), client(), client(), client()]);
    const { room } = await must(
      request<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 4 }),
    );
    await must(request(b, EVENTS.ROOM_JOIN, { code: room.code, name: 'Budi' }));
    await must(request(b, EVENTS.ROOM_JOIN, { code: room.code, name: 'Budi' })); // retried join
    await must(request(c, EVENTS.ROOM_JOIN, { code: room.code, name: 'Citra' }));
    // host + Budi + Citra = 3 players, so a 4th must fit
    await must(request(d, EVENTS.ROOM_JOIN, { code: room.code, name: 'Dewi' }));
  });

  it('room:leave frees the slot and the seat at once, and the device is out of the room', async () => {
    await start();
    const [host, b, c, d, e] = await Promise.all([client(), client(), client(), client(), client()]);
    const { room } = await must(
      request<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 4 }),
    );
    for (const [s, name] of [[b, 'Budi'], [c, 'Citra'], [d, 'Dewi']] as const) {
      await must(request(s, EVENTS.ROOM_JOIN, { code: room.code, name }));
    }
    await must(request(b, EVENTS.SEAT_TAKE, { seat: 'E' }));
    expect(await request(e, EVENTS.ROOM_JOIN, { code: room.code, name: 'Eka' })).toEqual({ ok: false, error: 'ROOM_FULL' });

    const freed = waitForRoom(host, (r) => r.seats.E === null);
    expect(await request(b, EVENTS.ROOM_LEAVE, {})).toEqual({ ok: true, data: null });
    await freed;
    expect(await request(b, EVENTS.SEAT_TAKE, { seat: 'E' })).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    await must(request(e, EVENTS.ROOM_JOIN, { code: room.code, name: 'Eka' }));
  });

  it('a player who closed the tab in the lobby does not keep the room full', async () => {
    await start();
    const [host, b, c, d, e] = await Promise.all([client(), client(), client(), client(), client()]);
    const { room } = await must(
      request<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 4 }),
    );
    for (const [s, name] of [[b, 'Budi'], [c, 'Citra'], [d, 'Dewi']] as const) {
      await must(request(s, EVENTS.ROOM_JOIN, { code: room.code, name }));
    }
    const offline = waitForRoom(host, () => true);
    b.disconnect();
    await offline;
    await must(request(e, EVENTS.ROOM_JOIN, { code: room.code, name: 'Eka' }));
  });

  it('rejects seat actions from a socket that has not joined', async () => {
    await start();
    const s = await client();
    expect(await request(s, EVENTS.SEAT_TAKE, { seat: 'N' })).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
  });

  it('a refreshed player resumes its seat with the session token', async () => {
    await start();
    const [host, b] = await Promise.all([client(), client()]);
    const { room } = await must(
      request<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 4 }),
    );
    const budi = await must(request<SessionData>(b, EVENTS.ROOM_JOIN, { code: room.code, name: 'Budi' }));
    await must(request(b, EVENTS.SEAT_TAKE, { seat: 'E' }));

    const seesOffline = waitForRoom(host, (r) => r.seats.E?.connected === false);
    b.disconnect();
    await seesOffline;

    const seesOnline = waitForRoom(host, (r) => r.seats.E?.connected === true);
    const b2 = await client();
    const resumed = await must(request<SessionData>(b2, EVENTS.SESSION_RESUME, { sessionToken: budi.sessionToken }));
    expect(resumed.memberId).toBe(budi.memberId);
    expect(resumed.room.seats.E?.playerId).toBe(budi.memberId);
    await seesOnline;

    // the resumed socket can act again
    await must(request(b2, EVENTS.SEAT_TAKE, { seat: 'W' }));
  });

  it('an old socket closing after a resume does not mark the member offline', async () => {
    await start();
    const host = await client();
    const created = await must(
      request<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 4 }),
    );
    await must(request(host, EVENTS.SEAT_TAKE, { seat: 'N' }));
    const second = await client();
    await must(request(second, EVENTS.SESSION_RESUME, { sessionToken: created.sessionToken }));
    host.disconnect();
    // give the server a moment to process the disconnect, then check via a fresh peek-less resume
    await new Promise((r) => setTimeout(r, 100));
    const room = await must(request<PublicRoom>(second, EVENTS.SEAT_TAKE, { seat: 'N' }));
    expect(room.seats.N?.connected).toBe(true);
  });

  it('host disbands the lobby: notifies all members and closes the room', async () => {
    await start();
    const [host, b, table] = await Promise.all([client(), client(), client()]);
    const { room } = await must(
      request<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 5 }),
    );
    await must(request(b, EVENTS.ROOM_JOIN, { code: room.code, name: 'Budi' }));
    await must(request(table, EVENTS.ROOM_JOIN_TABLE, { code: room.code }));

    const bErr = new Promise<{ code: string }>((resolve) => b.once(EVENTS.ERROR, resolve));
    const tErr = new Promise<{ code: string }>((resolve) => table.once(EVENTS.ERROR, resolve));
    expect(await request(host, EVENTS.ROOM_DISBAND, {})).toEqual({ ok: true, data: null });
    expect((await bErr).code).toBe('ROOM_DISBANDED');
    expect((await tErr).code).toBe('ROOM_DISBANDED');
    expect(await request(b, EVENTS.SEAT_TAKE, { seat: 'N' })).toEqual({ ok: false, error: 'NOT_IN_ROOM' });
    expect(await request(host, EVENTS.ROOM_PEEK, { code: room.code })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
  });

  it('host kicks a disconnected player in the lobby and frees the seat', async () => {
    await start();
    const [host, b, c] = await Promise.all([client(), client(), client()]);
    const { room } = await must(
      request<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 4 }),
    );
    await must(request(b, EVENTS.ROOM_JOIN, { code: room.code, name: 'Budi' }));
    await must(request(b, EVENTS.SEAT_TAKE, { seat: 'E' }));

    expect(await request(host, EVENTS.MEMBER_KICK, { seat: 'E' })).toEqual({ ok: false, error: 'KICK_NOT_ALLOWED' });

    const offline = waitForRoom(host, (r) => r.seats.E?.connected === false);
    b.disconnect();
    await offline;

    const freed = waitForRoom(host, (r) => r.seats.E === null);
    expect(await request(host, EVENTS.MEMBER_KICK, { seat: 'E' })).toEqual({ ok: true, data: null });
    await freed;

    await must(request(c, EVENTS.ROOM_JOIN, { code: room.code, name: 'Citra' }));
    await must(request(c, EVENTS.SEAT_TAKE, { seat: 'E' }));
  });
});
