import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket } from 'socket.io-client';
import {
  EVENTS,
  shuffle,
  type Ack,
  type GameEvent,
  type PlayerView,
  type Seat,
  type SessionData,
  type TableView,
} from '@gaflex/shared';
import { createGameServer, type GameServer } from '../app';

let server: GameServer | null = null;
const sockets: Socket[] = [];

afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await server?.close();
  server = null;
});

function seeded(seed: number) {
  let s = seed;
  return (max: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
}

async function start(seed: number) {
  const rng = seeded(seed);
  server = createGameServer({ corsOrigin: '*', passDelayMs: 5, game: { shuffleDeck: (d) => shuffle(d, rng) } });
  await new Promise<void>((resolve) => server!.httpServer.listen(0, resolve));
  return `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
}

async function client(url: string): Promise<Socket> {
  const s = connectClient(url, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  await new Promise<void>((resolve, reject) => {
    s.once('connect', () => resolve());
    s.once('connect_error', reject);
  });
  return s;
}

async function must<T>(s: Socket, event: string, payload: unknown): Promise<T> {
  const res: Ack<T> = await s.timeout(2000).emitWithAck(event, payload);
  if (!res.ok) throw new Error(`${event}: ${res.error}`);
  return res.data;
}

const tileIds = (json: string) => [...json.matchAll(/"(\d-\d)"/g)].map((m) => m[1]!);

describe('game loop over Socket.IO', () => {
  it('plays a full round: auto-pass, events before views, no leaked hands', async () => {
    const url = await start(7);
    const seats: Seat[] = ['N', 'E', 'S', 'W'];
    const clients = await Promise.all(seats.map(() => client(url)));
    const host = clients[0]!;
    const { room } = await must<SessionData>(host, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 4, targetScore: 100 });
    for (let i = 1; i < 4; i++) await must(clients[i]!, EVENTS.ROOM_JOIN, { code: room.code, name: `P${i}` });
    for (let i = 0; i < 4; i++) await must(clients[i]!, EVENTS.SEAT_TAKE, { seat: seats[i] });

    const problems: string[] = [];
    const events: GameEvent[] = [];
    let chainIds = new Set<string>();

    let lastTable: TableView | null = null;
    host.on(EVENTS.GAME_TABLE_VIEW, (v: TableView) => {
      lastTable = v;
      chainIds = new Set(v.chain.map((p) => p.tile.id));
    });
    host.on(EVENTS.GAME_EVENT, (ev: GameEvent) => {
      events.push(ev);
      if (ev.type === 'played' && chainIds.has(ev.tile!.id)) problems.push(`view arrived before event for ${ev.tile!.id}`);
    });

    // Each client is a bot that plays its first legal move.
    clients.forEach((s, i) => {
      s.on(EVENTS.GAME_PLAYER_VIEW, (v: PlayerView) => {
        if (v.seat !== seats[i]) problems.push(`client ${i} got seat ${v.seat}`);
        if (v.status === 'playing') {
          const allowed = new Set([...v.hand.map((t) => t.id), ...v.chain.map((p) => p.tile.id)]);
          for (const id of tileIds(JSON.stringify(v))) if (!allowed.has(id)) problems.push(`seat ${v.seat} saw ${id}`);
        }
        if (v.status === 'playing' && v.legalMoves.length > 0) {
          s.emit(EVENTS.GAME_PLAY, v.legalMoves[0], () => {});
        }
      });
    });

    const over = new Promise<GameEvent>((resolve) => {
      host.on(EVENTS.GAME_EVENT, (ev: GameEvent) => {
        if (ev.type === 'round_end' || ev.type === 'game_end') resolve(ev);
      });
    });

    await must(host, EVENTS.GAME_START, {});
    await over;

    // final table view (sent right after the event) carries the result and the reveal
    await new Promise((r) => setTimeout(r, 100));
    const finalView = lastTable as TableView | null;
    if (!finalView) throw new Error('no table view');
    expect(finalView.result).not.toBeNull();
    expect(finalView.revealedHands).not.toBeNull();
    expect(events.filter((e) => e.type === 'played').length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'passed')).toBe(true);
    expect(problems).toEqual([]);
  }, 15_000);

  it('5-device setup: the table device follows the whole round and never sees a hand', async () => {
    const url = await start(11);
    const seats: Seat[] = ['N', 'E', 'S', 'W'];
    const clients = await Promise.all(seats.map(() => client(url)));
    const table = await client(url);
    const { room } = await must<SessionData>(clients[0]!, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'team', setup: 5, targetScore: 100 });
    for (let i = 1; i < 4; i++) await must(clients[i]!, EVENTS.ROOM_JOIN, { code: room.code, name: `P${i}` });
    await must(table, EVENTS.ROOM_JOIN_TABLE, { code: room.code });
    for (let i = 0; i < 4; i++) await must(clients[i]!, EVENTS.SEAT_TAKE, { seat: seats[i] });

    const problems: string[] = [];
    const tableViews: TableView[] = [];
    table.on(EVENTS.GAME_PLAYER_VIEW, () => problems.push('table device got a player view'));
    table.on(EVENTS.GAME_TABLE_VIEW, (v: TableView) => {
      tableViews.push(v);
      if (v.status === 'playing') {
        const onTable = new Set(v.chain.map((p) => p.tile.id));
        for (const id of tileIds(JSON.stringify(v))) if (!onTable.has(id)) problems.push(`table saw ${id} off the chain`);
      }
    });
    clients.forEach((s) =>
      s.on(EVENTS.GAME_PLAYER_VIEW, (v: PlayerView) => {
        if (v.status === 'playing' && v.legalMoves.length > 0) s.emit(EVENTS.GAME_PLAY, v.legalMoves[0], () => {});
      }),
    );
    const over = new Promise<void>((resolve) =>
      table.on(EVENTS.GAME_EVENT, (ev: GameEvent) => {
        if (ev.type === 'round_end' || ev.type === 'game_end') resolve();
      }),
    );

    await must(clients[0]!, EVENTS.GAME_START, {});
    await over;
    await new Promise((r) => setTimeout(r, 100));

    expect(problems).toEqual([]);
    expect(tableViews.length).toBeGreaterThan(5);
    const last = tableViews[tableViews.length - 1]!;
    expect(last.result?.winner === 'A' || last.result?.winner === 'B').toBe(true);
    expect(last.revealedHands).not.toBeNull(); // the reveal at round end is public
  }, 15_000);

  it('5-device setup: the game cannot start until the table device is connected', async () => {
    const url = await start(2);
    const seats: Seat[] = ['N', 'E', 'S', 'W'];
    const clients = await Promise.all(seats.map(() => client(url)));
    const { room } = await must<SessionData>(clients[0]!, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 5, targetScore: 100 });
    for (let i = 1; i < 4; i++) await must(clients[i]!, EVENTS.ROOM_JOIN, { code: room.code, name: `P${i}` });
    for (let i = 0; i < 4; i++) await must(clients[i]!, EVENTS.SEAT_TAKE, { seat: seats[i] });
    expect(await clients[0]!.timeout(2000).emitWithAck(EVENTS.GAME_START, {})).toEqual({ ok: false, error: 'NOT_READY' });
  });

  it('rejects a move out of turn', async () => {
    const url = await start(1);
    const seats: Seat[] = ['N', 'E', 'S', 'W'];
    const clients = await Promise.all(seats.map(() => client(url)));
    const { room } = await must<SessionData>(clients[0]!, EVENTS.ROOM_CREATE, { name: 'Host', mode: 'solo', setup: 4, targetScore: 100 });
    for (let i = 1; i < 4; i++) await must(clients[i]!, EVENTS.ROOM_JOIN, { code: room.code, name: `P${i}` });
    for (let i = 0; i < 4; i++) await must(clients[i]!, EVENTS.SEAT_TAKE, { seat: seats[i] });
    const views = clients.map(
      (s) => new Promise<PlayerView>((resolve) => s.once(EVENTS.GAME_PLAYER_VIEW, resolve)),
    );
    await must(clients[0]!, EVENTS.GAME_START, {});
    const all = await Promise.all(views);
    const idle = all.findIndex((v) => v.turn !== v.seat);
    const res = await clients[idle]!.timeout(2000).emitWithAck(EVENTS.GAME_PLAY, { tileId: all[idle]!.hand[0]!.id, side: 'left' });
    expect(res).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
  });
});
