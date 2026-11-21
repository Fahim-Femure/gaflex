import { beforeEach, describe, expect, it } from 'vitest';
import { SEAT_ORDER, SKIP_AFTER_MS, shuffle, type Mode, type Seat, type Tile } from '@gaflex/shared';
import { RoomManager } from '../rooms/RoomManager';
import { GameService } from './GameService';

let manager: RoomManager;

function ok<T>(res: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!res.ok) throw new Error(`expected ok, got ${res.error}`);
  return res.data;
}

function seeded(seed: number) {
  let s = seed;
  return (max: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
}

/** Host + 3 players seated N, E, S, W. */
function seatedRoom(opts: { mode?: Mode; setup?: 4 | 5; seatAll?: boolean } = {}) {
  const host = ok(manager.create({ name: 'Host', mode: opts.mode ?? 'solo', setup: opts.setup ?? 4, targetScore: 100 }));
  const code = host.room.code;
  const ids: Record<Seat, string> = { N: host.memberId, E: '', S: '', W: '' };
  for (const seat of ['E', 'S', 'W'] as Seat[]) ids[seat] = ok(manager.join({ code, name: seat })).memberId;
  const seats = opts.seatAll === false ? SEAT_ORDER.slice(0, 3) : SEAT_ORDER;
  for (const seat of seats) ok(manager.takeSeat(ids[seat], seat));
  return { code, ids };
}

const unshuffled = (deck: Tile[]) => deck; // W holds 6-6

beforeEach(() => {
  manager = new RoomManager();
});

describe('start', () => {
  it('only the host can start', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids } = seatedRoom();
    expect(game.start(ids.E)).toEqual({ ok: false, error: 'NOT_HOST' });
  });

  it('needs 4 seated players', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids } = seatedRoom({ seatAll: false });
    expect(game.start(ids.N)).toEqual({ ok: false, error: 'NOT_READY' });
  });

  it('needs the table device in a 5-device room', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids, code } = seatedRoom({ setup: 5 });
    expect(game.start(ids.N)).toEqual({ ok: false, error: 'NOT_READY' });
    ok(manager.joinTable({ code }));
    expect(game.start(ids.N).ok).toBe(true);
  });

  it('deals 7 tiles each and gives the turn to the 6-6 holder', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    const room = manager.getRoomForGame(code)!;
    expect(room.status).toBe('playing');
    for (const seat of SEAT_ORDER) expect(room.game!.hands[seat]).toHaveLength(7);
    expect(room.game!.turn).toBe('W');
    expect(room.game!.scores).toEqual({ N: 0, E: 0, S: 0, W: 0 });
  });

  it('cannot start twice', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids } = seatedRoom();
    ok(game.start(ids.N));
    expect(game.start(ids.N)).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
  });
});

describe('play', () => {
  it('validates through the rules', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids } = seatedRoom();
    ok(game.start(ids.N));
    expect(game.play(ids.N, { tileId: '0-0', side: 'left' })).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(game.play(ids.W, { tileId: '5-6', side: 'left' })).toEqual({ ok: false, error: 'MUST_OPEN_WITH_DOUBLE_SIX' });
    expect(game.play(ids.W, { tileId: '0-0', side: 'left' })).toEqual({ ok: false, error: 'TILE_NOT_OWNED' });
  });

  it('places the tile, advances the turn and reports a played event', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    const res = ok(game.play(ids.W, { tileId: '6-6', side: 'left' }));
    expect(res.events).toEqual([{ type: 'played', seat: 'W', tile: { id: '6-6', a: 6, b: 6 }, side: 'left' }]);
    expect(manager.getRoomForGame(code)!.game!.turn).toBe('N');
  });

  it('rejects play before the game starts', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids } = seatedRoom();
    expect(game.play(ids.N, { tileId: '0-0', side: 'left' })).toEqual({ ok: false, error: 'NOT_READY' });
  });
});

describe('views', () => {
  it('each seated player gets only their own hand; the table gets none', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    const views = game.views(code)!;
    expect(views.players).toHaveLength(4);
    for (const { memberId, seat, view } of views.players) {
      expect(memberId).toBe(ids[seat]);
      expect(view.hand).toHaveLength(7);
      const others = SEAT_ORDER.filter((s) => s !== seat).flatMap(
        (s) => manager.getRoomForGame(code)!.game!.hands[s].map((t) => t.id),
      );
      const json = JSON.stringify(view);
      for (const id of others) expect(json).not.toContain(`"${id}"`);
    }
    expect(views.table).not.toHaveProperty('hand');
    expect(views.table.revealedHands).toBeNull();
  });
});

/** Plays greedily; auto-pass steps run whenever the seat to move has nothing. */
function playOutRound(game: GameService, code: string, ids: Record<Seat, string>) {
  let passes = 0;
  for (let i = 0; i < 300; i++) {
    const room = manager.getRoomForGame(code)!;
    if (room.status !== 'playing') return { passes, room };
    const step = game.autoPassStep(code);
    if (step) {
      expect(step.type).toBe('passed');
      passes++;
      continue;
    }
    const seat = room.game!.turn;
    const view = game.views(code)!.players.find((p) => p.seat === seat)!.view;
    expect(view.legalMoves.length).toBeGreaterThan(0);
    ok(game.play(ids[seat], view.legalMoves[0]!));
  }
  throw new Error('round did not end');
}

describe('a full round', () => {
  for (const mode of ['solo', 'team'] as const) {
    it(`${mode}: ends, scores the result, and auto-passes along the way`, () => {
      let totalPasses = 0;
      for (let seed = 1; seed <= 20; seed++) {
        manager = new RoomManager();
        const rng = seeded(seed);
        const game = new GameService(manager, { shuffleDeck: (d) => shuffle(d, rng) });
        const { ids, code } = seatedRoom({ mode });
        ok(game.start(ids.N));
        const { passes, room } = playOutRound(game, code, ids);
        totalPasses += passes;
        expect(['round_end', 'game_end']).toContain(room.status);
        const view = game.views(code)!.table;
        expect(view.result).not.toBeNull();
        expect(view.scores[view.result!.winner]).toBe(view.result!.points);
        expect(view.revealedHands).not.toBeNull();
      }
      expect(totalPasses).toBeGreaterThan(0);
    });
  }
});

describe('nextRound', () => {
  it('is host-only and only after a round ends', () => {
    const game = new GameService(manager, { shuffleDeck: (d) => shuffle(d, seeded(3)) });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    expect(game.nextRound(ids.N)).toEqual({ ok: false, error: 'ROUND_IN_PROGRESS' });
    playOutRound(game, code, ids);
    expect(game.nextRound(ids.E)).toEqual({ ok: false, error: 'NOT_HOST' });
  });

  it('deals again, keeps scores and lets the previous winner start with any tile', () => {
    const game = new GameService(manager, { shuffleDeck: (d) => shuffle(d, seeded(4)) });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    playOutRound(game, code, ids);
    const before = game.views(code)!.table;
    ok(game.nextRound(ids.N));
    const room = manager.getRoomForGame(code)!;
    expect(room.status).toBe('playing');
    expect(room.game!.round).toBe(2);
    expect(room.game!.turn).toBe(before.result!.startingSeat);
    expect(room.game!.scores).toEqual(before.scores);
    for (const seat of SEAT_ORDER) expect(room.game!.hands[seat]).toHaveLength(7);
    const starter = game.views(code)!.players.find((p) => p.seat === room.game!.turn)!.view;
    expect(starter.legalMoves).toHaveLength(7);
    expect(game.views(code)!.table.result).toBeNull();
  });

  it('after game_end, starts a fresh game from round 1', () => {
    const game = new GameService(manager, { shuffleDeck: (d) => shuffle(d, seeded(5)) });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    playOutRound(game, code, ids);
    const room = manager.getRoomForGame(code)!;
    room.status = 'game_end';
    ok(game.nextRound(ids.N));
    expect(room.game!.round).toBe(1);
    expect(room.game!.scores).toEqual({ N: 0, E: 0, S: 0, W: 0 });
  });
});

describe('skip (host skips a disconnected player on turn)', () => {
  let clock: number;
  let game: GameService;
  beforeEach(() => {
    clock = 1_000_000;
    manager = new RoomManager({ now: () => clock });
    game = new GameService(manager, { shuffleDeck: unshuffled, now: () => clock });
  });

  it('only the host can skip', () => {
    const { ids } = seatedRoom();
    ok(game.start(ids.N));
    manager.disconnect(ids.W);
    clock += SKIP_AFTER_MS;
    expect(game.skip(ids.E)).toEqual({ ok: false, error: 'NOT_HOST' });
  });

  it('needs a game in progress', () => {
    const { ids } = seatedRoom();
    expect(game.skip(ids.N)).toEqual({ ok: false, error: 'NOT_READY' });
  });

  it('refuses while the player on turn is connected', () => {
    const { ids } = seatedRoom();
    ok(game.start(ids.N));
    clock += SKIP_AFTER_MS;
    expect(game.skip(ids.N)).toEqual({ ok: false, error: 'SKIP_NOT_ALLOWED' });
  });

  it(`refuses before the player has been gone ${SKIP_AFTER_MS} ms`, () => {
    const { ids } = seatedRoom();
    ok(game.start(ids.N));
    manager.disconnect(ids.W);
    clock += SKIP_AFTER_MS - 1;
    expect(game.skip(ids.N)).toEqual({ ok: false, error: 'SKIP_NOT_ALLOWED' });
  });

  it('passes the turn with a skipped event; a skipped 6-6 opener lets the next seat open freely', () => {
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N)); // W holds 6-6
    manager.disconnect(ids.W);
    clock += SKIP_AFTER_MS;
    const res = ok(game.skip(ids.N));
    expect(res.events).toEqual([{ type: 'passed', seat: 'W', skipped: true }]);
    expect(manager.getRoomForGame(code)!.game!.turn).toBe('N');
    const north = game.views(code)!.players.find((p) => p.seat === 'N')!.view;
    expect(north.legalMoves).toHaveLength(7);
  });
});
