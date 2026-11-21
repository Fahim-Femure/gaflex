import { randomInt } from 'node:crypto';
import {
  SEAT_ORDER,
  SKIP_AFTER_MS,
  applyMove,
  applyRoundResult,
  createDeck,
  deal,
  gameWinner,
  initScores,
  isFirstMoveOfGame,
  legalMoves,
  nextTurn,
  passTurn,
  scoreRound,
  shuffle,
  skipTurn,
  startRound,
  toPlayerView,
  toTableView,
  type Ack,
  type ErrorCode,
  type GameEvent,
  type GamePlayPayload,
  type PlayerView,
  type Room,
  type RoundResult,
  type ScoreKey,
  type Seat,
  type TableView,
  type Tile,
} from '@gaflex/shared';
import type { RoomManager } from '../rooms/RoomManager';

export type GameServiceOptions = {
  /** Server shuffle; tests inject a fixed order. Default: Fisher-Yates with crypto.randomInt. */
  shuffleDeck?: (deck: Tile[]) => Tile[];
  /** Clock for the skip delay; tests share it with the RoomManager. */
  now?: () => number;
};

export type Views = {
  table: TableView;
  players: { memberId: string; seat: Seat; view: PlayerView }[];
};

type Outcome = { code: string; events: GameEvent[] };

const fail = (error: ErrorCode) => ({ ok: false as const, error });
const done = <T>(data: T) => ({ ok: true as const, data });

/** Server-authoritative game loop on top of the rooms. */
export class GameService {
  private shuffleDeck: (deck: Tile[]) => Tile[];
  private now: () => number;
  /** Last round's result per room; cleared when a round starts. */
  private results = new Map<string, { result: RoundResult; winner: ScoreKey | null }>();

  constructor(
    private manager: RoomManager,
    opts: GameServiceOptions = {},
  ) {
    this.shuffleDeck = opts.shuffleDeck ?? ((deck) => shuffle(deck, randomInt));
    this.now = opts.now ?? Date.now;
  }

  start(memberId: string): Ack<Outcome> {
    const found = this.hostRoom(memberId);
    if (!found.ok) return found;
    const room = found.data;
    if (room.status !== 'lobby') return fail('GAME_IN_PROGRESS');
    const seated = SEAT_ORDER.every((s) => room.seats[s] !== null);
    const tableReady = room.setup === 4 || this.manager.getPublicRoom(room.code)?.tableConnected === true;
    if (!seated || !tableReady) return fail('NOT_READY');
    this.deal(room, 1, null, initScores(room.mode));
    return done({ code: room.code, events: [] });
  }

  play(memberId: string, payload: GamePlayPayload): Ack<Outcome> {
    const member = this.manager.getMember(memberId);
    if (!member || member.role !== 'player' || !member.seat) return fail('NOT_IN_ROOM');
    const room = this.manager.getRoomForGame(member.code)!;
    if (room.status !== 'playing' || !room.game) return fail('NOT_READY');
    if (typeof payload?.tileId !== 'string' || (payload.side !== 'left' && payload.side !== 'right')) {
      return fail('INVALID_PAYLOAD');
    }

    const tile = room.game.hands[member.seat].find((t) => t.id === payload.tileId);
    const res = applyMove(room.game, { seat: member.seat, tileId: payload.tileId, side: payload.side });
    if (!res.ok) return res;

    const events: GameEvent[] = [{ type: 'played', seat: member.seat, tile, side: payload.side }];
    room.game = res.state;
    const result = scoreRound(room.game, room.mode);
    if (result) events.push(this.finishRound(room, result));
    else room.game = nextTurn(room.game);
    this.manager.touchRoom(room.code);
    return done({ code: room.code, events });
  }

  /**
   * Host skips the seat on turn after its player has been disconnected for SKIP_AFTER_MS.
   * Counts as a pass (docs/02).
   */
  skip(memberId: string): Ack<Outcome> {
    const found = this.hostRoom(memberId);
    if (!found.ok) return found;
    const room = found.data;
    if (room.status !== 'playing' || !room.game) return fail('NOT_READY');
    const seat = room.game.turn;
    const playerId = room.seats[seat]?.playerId;
    const player = playerId ? this.manager.getMember(playerId) : undefined;
    const goneSince = player && !player.connected ? player.disconnectedAt : null;
    if (goneSince === null || this.now() - goneSince < SKIP_AFTER_MS) return fail('SKIP_NOT_ALLOWED');
    room.game = skipTurn(room.game);
    this.manager.touchRoom(room.code);
    return done({ code: room.code, events: [{ type: 'passed', seat, skipped: true }] });
  }

  /**
   * If the seat to move has no legal move, records its pass and returns the event.
   * The socket layer calls this on a timer so each pass is visible (docs/04: 900 ms).
   */
  autoPassStep(code: string): GameEvent | null {
    const room = this.manager.getRoomForGame(code);
    if (!room || room.status !== 'playing' || !room.game) return null;
    const { game } = room;
    if (legalMoves(game.hands[game.turn], game.ends, isFirstMoveOfGame(game)).length > 0) return null;
    const seat = game.turn;
    room.game = passTurn(game);
    return { type: 'passed', seat };
  }

  nextRound(memberId: string): Ack<Outcome> {
    const found = this.hostRoom(memberId);
    if (!found.ok) return found;
    const room = found.data;
    if (room.status === 'playing') return fail('ROUND_IN_PROGRESS');
    if (room.status === 'lobby' || !room.game) return fail('NOT_READY');

    if (room.status === 'game_end') {
      this.deal(room, 1, null, initScores(room.mode));
    } else {
      const last = this.results.get(room.code)!;
      this.deal(room, room.game.round + 1, last.result.startingSeat, room.game.scores);
    }
    return done({ code: room.code, events: [] });
  }

  views(code: string): Views | null {
    const room = this.manager.getRoomForGame(code);
    if (!room?.game) return null;
    const last = this.results.get(code);
    const ctx = {
      status: room.status,
      mode: room.mode,
      targetScore: room.targetScore,
      result: last?.result ?? null,
      gameWinner: last?.winner ?? null,
    };
    const game = room.game;
    return {
      table: toTableView(game, ctx),
      players: this.manager
        .seatedMembers(code)
        .map(({ memberId, seat }) => ({ memberId, seat, view: toPlayerView(game, seat, ctx) })),
    };
  }

  // ---- internals ----

  private hostRoom(memberId: string): Ack<Room> {
    const member = this.manager.getMember(memberId);
    if (!member || member.role !== 'player') return fail('NOT_IN_ROOM');
    const room = this.manager.getRoomForGame(member.code)!;
    if (room.hostId !== memberId) return fail('NOT_HOST');
    return done(room);
  }

  private deal(room: Room, round: number, startingSeat: Seat | null, scores: Record<string, number>) {
    const hands = deal(this.shuffleDeck(createDeck()));
    room.game = startRound({ hands, round, startingSeat, scores });
    room.status = 'playing';
    this.results.delete(room.code);
    this.manager.touchRoom(room.code);
  }

  private finishRound(room: Room, result: RoundResult): GameEvent {
    const game = room.game!;
    const scores = applyRoundResult(game.scores, result);
    const winner = gameWinner(scores, room.targetScore);
    room.game = { ...game, scores, winner: result.winner };
    room.status = winner ? 'game_end' : 'round_end';
    this.results.set(room.code, { result, winner });
    return winner ? { type: 'game_end', seat: null } : { type: 'round_end', seat: null };
  }
}
