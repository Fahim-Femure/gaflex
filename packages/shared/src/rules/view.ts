import { SEAT_ORDER } from '../constants';
import type { GameState, Mode, Placed, RoomStatus, Seat, Tile } from '../types';
import type { ScoreKey } from './game';
import { isFirstMoveOfGame, legalMoves, type Move } from './moves';
import type { RoundResult } from './round';

/** Room-level facts a view needs that are not part of GameState. */
export type ViewContext = {
  status: RoomStatus;
  mode: Mode;
  targetScore: number;
  result: RoundResult | null;
  gameWinner: ScoreKey | null;
};

/** What the table device and the View mode see: no one's hand while playing. */
export type TableView = {
  status: RoomStatus;
  mode: Mode;
  targetScore: number;
  round: number;
  chain: Placed[];
  ends: [number, number] | null;
  turn: Seat;
  passStreak: number;
  lastActor: Seat | null;
  handCounts: Record<Seat, number>;
  scores: Record<string, number>;
  result: RoundResult | null;
  /** Every hand, only once the round is over (for the reveal). */
  revealedHands: Record<Seat, Tile[]> | null;
  gameWinner: ScoreKey | null;
};

export type PlayerView = TableView & {
  seat: Seat;
  hand: Tile[];
  /** Empty unless it is this seat's turn while playing. */
  legalMoves: Move[];
};

export type GameEvent = {
  type: 'played' | 'passed' | 'round_end' | 'game_end';
  seat: Seat | null;
  tile?: Tile;
  side?: 'left' | 'right';
  /** On `passed`: the host skipped this disconnected seat (not an automatic pass). */
  skipped?: boolean;
};

export function toTableView(state: GameState, ctx: ViewContext): TableView {
  const over = ctx.status === 'round_end' || ctx.status === 'game_end';
  return {
    status: ctx.status,
    mode: ctx.mode,
    targetScore: ctx.targetScore,
    round: state.round,
    chain: structuredClone(state.chain),
    ends: state.ends ? [state.ends[0], state.ends[1]] : null,
    turn: state.turn,
    passStreak: state.passStreak,
    lastActor: state.lastActor,
    handCounts: Object.fromEntries(SEAT_ORDER.map((s) => [s, state.hands[s].length])) as Record<Seat, number>,
    scores: { ...state.scores },
    result: ctx.result,
    revealedHands: over ? structuredClone(state.hands) : null,
    gameWinner: ctx.gameWinner,
  };
}

export function toPlayerView(state: GameState, seat: Seat, ctx: ViewContext): PlayerView {
  const myTurn = ctx.status === 'playing' && state.turn === seat;
  return {
    ...toTableView(state, ctx),
    seat,
    hand: structuredClone(state.hands[seat]),
    legalMoves: myTurn ? legalMoves(state.hands[seat], state.ends, isFirstMoveOfGame(state)) : [],
  };
}
