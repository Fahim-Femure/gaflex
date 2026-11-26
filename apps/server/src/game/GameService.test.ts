import { beforeEach, describe, expect, it } from 'vitest';
import { SCORE_LIMIT, SEAT_ORDER, SKIP_AFTER_MS, shuffle, type Mode, type Seat, type Tile } from '@gaflex/shared';
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
  const host = ok(manager.create({ name: 'Host', mode: opts.mode ?? 'solo', setup: opts.setup ?? 4 }));
  const code = host.room.code;
  const ids: Record<Seat, string> = { N: host.memberId, E: '', S: '', W: '' };
  for (const seat of ['E', 'S', 'W'] as Seat[]) ids[seat] = ok(manager.join({ code, name: seat })).memberId;
  const seats = opts.seatAll === false ? SEAT_ORDER.slice(0, 3) : SEAT_ORDER;
  for (const seat of seats) ok(manager.takeSeat(ids[seat], seat));
  return { code, ids };
}

const unshuffled = (deck: Tile[]) => deck; // N holds 0-0
const reversed = (deck: Tile[]) => [...deck].reverse(); // W holds 0-0

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

  it('deals 7 tiles each and gives the turn to the 0-0 holder', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    const room = manager.getRoomForGame(code)!;
    expect(room.status).toBe('playing');
    for (const seat of SEAT_ORDER) expect(room.game!.hands[seat]).toHaveLength(7);
    expect(room.game!.turn).toBe('N');
    expect(room.game!.scores).toEqual({ N: 0, E: 0, S: 0, W: 0 });
  });

  it('reshuffles and deals again when a hand gets 5 or more doubles', () => {
    const doublesFirst = (deck: Tile[]) => [...deck.filter((x) => x.a === x.b), ...deck.filter((x) => x.a !== x.b)];
    const decks = [doublesFirst, unshuffled]; // 1st deal: N holds all 7 doubles
    let calls = 0;
    const game = new GameService(manager, { shuffleDeck: (d) => decks[calls++]!(d) });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    expect(calls).toBe(2);
    const hands = manager.getRoomForGame(code)!.game!.hands;
    for (const seat of SEAT_ORDER) expect(hands[seat].filter((x) => x.a === x.b).length).toBeLessThan(5);
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
    expect(game.play(ids.E, { tileId: '2-3', side: 'left' })).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(game.play(ids.N, { tileId: '0-1', side: 'left' })).toEqual({ ok: false, error: 'MUST_OPEN_WITH_DOUBLE_ZERO' });
    expect(game.play(ids.N, { tileId: '6-6', side: 'left' })).toEqual({ ok: false, error: 'TILE_NOT_OWNED' });
  });

  it('places the tile, advances the turn and reports a played event', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    const res = ok(game.play(ids.N, { tileId: '0-0', side: 'left', slam: false }));
    expect(res.events).toEqual([{ type: 'played', seat: 'N', tile: { id: '0-0', a: 0, b: 0 }, side: 'left' }]);
    expect(manager.getRoomForGame(code)!.game!.turn).toBe('E');
  });

  it('propagates slam: true in the played event when pushed forward', () => {
    const game = new GameService(manager, { shuffleDeck: unshuffled });
    const { ids } = seatedRoom();
    ok(game.start(ids.N));
    const res = ok(game.play(ids.N, { tileId: '0-0', side: 'left', slam: true }));
    expect(res.events).toEqual([{ type: 'played', seat: 'N', tile: { id: '0-0', a: 0, b: 0 }, side: 'left', slam: true }]);
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
        // losers collect their own remaining pips; the winner collects nothing
        expect(view.scores[view.result!.winner]).toBe(0);
        for (const [key, pips] of Object.entries(view.result!.penalties)) expect(view.scores[key]).toBe(pips);
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

  it('deals again, keeps scores and starts round 2 with a double (shifting clockwise if needed)', () => {
    const game = new GameService(manager, { shuffleDeck: (d) => shuffle(d, seeded(4)) });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    playOutRound(game, code, ids);
    const before = game.views(code)!.table;
    ok(game.nextRound(ids.N));
    const room = manager.getRoomForGame(code)!;
    expect(room.status).toBe('playing');
    expect(room.game!.round).toBe(2);
    const expectedOrder = SEAT_ORDER.slice(SEAT_ORDER.indexOf(before.result!.startingSeat)).concat(
      SEAT_ORDER.slice(0, SEAT_ORDER.indexOf(before.result!.startingSeat)),
    );
    const expectedTurn = expectedOrder.find((s) => room.game!.hands[s].some((t) => t.a === t.b));
    expect(room.game!.turn).toBe(expectedTurn);
    expect(room.game!.scores).toEqual(before.scores);
    for (const seat of SEAT_ORDER) expect(room.game!.hands[seat]).toHaveLength(7);
    const starter = game.views(code)!.players.find((p) => p.seat === room.game!.turn)!.view;
    const starterDoubles = starter.hand.filter((t) => t.a === t.b);
    expect(starter.legalMoves).toHaveLength(starterDoubles.length);
    expect(game.views(code)!.table.result).toBeNull();
  });

  it('round 2 rejects non-double openers and shifts turn clockwise when startingSeat holds no doubles', () => {
    const noDoubleE: Tile[] = [
      { id: '0-0', a: 0, b: 0 },
      { id: '0-1', a: 0, b: 1 },
      { id: '0-2', a: 0, b: 2 },
      { id: '0-3', a: 0, b: 3 },
      { id: '0-4', a: 0, b: 4 },
      { id: '0-5', a: 0, b: 5 },
      { id: '0-6', a: 0, b: 6 },
      // E: zero doubles
      { id: '1-2', a: 1, b: 2 },
      { id: '1-3', a: 1, b: 3 },
      { id: '1-4', a: 1, b: 4 },
      { id: '1-5', a: 1, b: 5 },
      { id: '1-6', a: 1, b: 6 },
      { id: '2-3', a: 2, b: 3 },
      { id: '2-4', a: 2, b: 4 },
      // S: holds 3-3
      { id: '2-5', a: 2, b: 5 },
      { id: '2-6', a: 2, b: 6 },
      { id: '3-3', a: 3, b: 3 },
      { id: '3-4', a: 3, b: 4 },
      { id: '3-5', a: 3, b: 5 },
      { id: '3-6', a: 3, b: 6 },
      { id: '4-5', a: 4, b: 5 },
      // W: remaining tiles (holds 1-1, 2-2, 4-4, 5-5, 6-6 -> 5 doubles if unshuffled, put 1-1 in N instead!)
      { id: '4-6', a: 4, b: 6 },
      { id: '5-6', a: 5, b: 6 },
      { id: '1-1', a: 1, b: 1 },
      { id: '2-2', a: 2, b: 2 },
      { id: '4-4', a: 4, b: 4 },
      { id: '5-5', a: 5, b: 5 },
      { id: '6-6', a: 6, b: 6 },
    ];
    // Move 6-6 to N replacing 0-6 so W has 4 doubles (fair deal)
    const fairNoDoubleE = [...noDoubleE];
    const idx06 = fairNoDoubleE.findIndex((t) => t.id === '0-6');
    const idx66 = fairNoDoubleE.findIndex((t) => t.id === '6-6');
    [fairNoDoubleE[idx06], fairNoDoubleE[idx66]] = [fairNoDoubleE[idx66]!, fairNoDoubleE[idx06]!];

    const game = new GameService(manager, { shuffleDeck: () => fairNoDoubleE });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    const room = manager.getRoomForGame(code)!;
    // Inject a finished round-1 state won by E so round 2 starts from E (who has 0 doubles -> shifts to S).
    room.status = 'round_end';
    (game as unknown as { results: Map<string, unknown> }).results.set(code, {
      result: { reason: 'domino', winner: 'E', startingSeat: 'E', penalties: {}, pips: { N: 0, E: 0, S: 0, W: 0 } },
      loser: null,
    });
    ok(game.nextRound(ids.N));
    expect(room.game!.turn).toBe('S');
    expect(game.play(ids.S, { tileId: '2-5', side: 'left' })).toEqual({ ok: false, error: 'MUST_OPEN_WITH_DOUBLE' });
    expect(game.play(ids.S, { tileId: '3-3', side: 'left' }).ok).toBe(true);
  });

  it('after game_end, starts a fresh game from round 1 and keeps the game tally', () => {
    const game = new GameService(manager, { shuffleDeck: (d) => shuffle(d, seeded(5)) });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    playOutRound(game, code, ids);
    const room = manager.getRoomForGame(code)!;
    room.status = 'game_end';
    room.game!.tally = { N: 0, E: 1, S: 0, W: 0 };
    ok(game.nextRound(ids.N));
    expect(room.game!.round).toBe(1);
    expect(room.game!.scores).toEqual({ N: 0, E: 0, S: 0, W: 0 });
    expect(room.game!.tally).toEqual({ N: 0, E: 1, S: 0, W: 0 });
  });
});

describe(`game end (a score above ${SCORE_LIMIT} loses)`, () => {
  it(`stays a round end while every score is at most ${SCORE_LIMIT}`, () => {
    const game = new GameService(manager, { shuffleDeck: (d) => shuffle(d, seeded(6)) });
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N));
    const { room } = playOutRound(game, code, ids);
    expect(room.status).toBe('round_end');
    expect(game.views(code)!.table.gameLoser).toBeNull();
    expect(room.game!.tally).toEqual({ N: 0, E: 0, S: 0, W: 0 });
  });

  it('solo: the player who passes the limit loses and gets one loss in the tally', () => {
    const game = new GameService(manager, { shuffleDeck: (d) => shuffle(d, seeded(6)) });
    const { ids, code } = seatedRoom({ mode: 'solo' });
    ok(game.start(ids.N));
    const room = manager.getRoomForGame(code)!;
    room.game!.scores = { N: SCORE_LIMIT, E: SCORE_LIMIT, S: SCORE_LIMIT, W: SCORE_LIMIT };
    playOutRound(game, code, ids);
    const view = game.views(code)!.table;
    expect(room.status).toBe('game_end');
    const worst = Math.max(...Object.values(view.scores));
    expect(view.gameLoser).not.toBeNull();
    expect(view.scores[view.gameLoser!]).toBe(worst);
    expect(worst).toBeGreaterThan(SCORE_LIMIT);
    expect(view.tally).toEqual({ N: 0, E: 0, S: 0, W: 0, [view.gameLoser!]: 1 });
  });

  it('team: the team that passes the limit loses; the other team leads 1-0', () => {
    const game = new GameService(manager, { shuffleDeck: (d) => shuffle(d, seeded(7)) });
    const { ids, code } = seatedRoom({ mode: 'team' });
    ok(game.start(ids.N));
    const room = manager.getRoomForGame(code)!;
    room.game!.scores = { A: SCORE_LIMIT, B: SCORE_LIMIT };
    playOutRound(game, code, ids);
    const view = game.views(code)!.table;
    expect(room.status).toBe('game_end');
    const loser = view.gameLoser!;
    expect(['A', 'B']).toContain(loser);
    expect(view.result!.winner).not.toBe(loser);
    expect(view.tally).toEqual(loser === 'A' ? { A: 0, B: 1 } : { A: 1, B: 0 });
  });
});

describe('skip (host skips a disconnected player on turn)', () => {
  let clock: number;
  let game: GameService;
  beforeEach(() => {
    clock = 1_000_000;
    manager = new RoomManager({ now: () => clock });
    game = new GameService(manager, { shuffleDeck: reversed, now: () => clock });
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

  it('passes the turn with a skipped event; a skipped 0-0 opener lets the next seat open freely', () => {
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N)); // W holds 0-0
    manager.disconnect(ids.W);
    clock += SKIP_AFTER_MS;
    const res = ok(game.skip(ids.N));
    expect(res.events).toEqual([{ type: 'passed', seat: 'W', skipped: true }]);
    expect(manager.getRoomForGame(code)!.game!.turn).toBe('N');
    const north = game.views(code)!.players.find((p) => p.seat === 'N')!.view;
    expect(north.legalMoves).toHaveLength(7);
  });

  it('allows immediate skip when the disconnected player has already been kicked', () => {
    const { ids, code } = seatedRoom();
    ok(game.start(ids.N)); // W holds 0-0
    manager.disconnect(ids.W);
    ok(manager.kick(ids.N, 'W'));
    // no 15s wait needed once kicked
    const res = ok(game.skip(ids.N));
    expect(res.events).toEqual([{ type: 'passed', seat: 'W', skipped: true }]);
    expect(manager.getRoomForGame(code)!.game!.turn).toBe('N');
  });
});
