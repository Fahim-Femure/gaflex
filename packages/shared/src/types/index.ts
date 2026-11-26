export type Seat = 'N' | 'E' | 'S' | 'W';
export type Team = 'A' | 'B';

/** Domino tile; invariant a <= b. */
export type Tile = { id: string; a: number; b: number };

export type Side = 'left' | 'right';

export type Placed = { tile: Tile; side: Side; flipped: boolean; order: number };

export type Mode = 'solo' | 'team';
export type DeviceSetup = 4 | 5;

export type SeatInfo = { playerId: string; name: string; connected: boolean };

export type RoomStatus = 'lobby' | 'playing' | 'round_end' | 'game_end';

export type GameState = {
  hands: Record<Seat, Tile[]>;
  chain: Placed[];
  ends: [number, number] | null;
  turn: Seat;
  passStreak: number;
  round: number;
  /** Penalty pips collected this game (solo: per seat, team: per team). Above SCORE_LIMIT loses. */
  scores: Record<string, number>;
  /** Games decided so far; team: games won per team, solo: games lost per seat. */
  tally: Record<string, number>;
  lastActor: Seat | null;
  winner: Seat | Team | null;
  /** True once the host skipped a disconnected round-1 opener: the next seat may open with any tile. */
  openerWaived: boolean;
};

export type Room = {
  code: string;
  hostId: string;
  mode: Mode;
  setup: DeviceSetup;
  seats: Record<Seat, SeatInfo | null>;
  tableDeviceId: string | null;
  status: RoomStatus;
  game: GameState | null;
};

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'SEAT_TAKEN'
  | 'TABLE_UNAVAILABLE'
  | 'SESSION_INVALID'
  | 'NOT_IN_ROOM'
  | 'INVALID_PAYLOAD'
  | 'NOT_HOST'
  | 'NOT_READY'
  | 'GAME_IN_PROGRESS'
  | 'ROUND_IN_PROGRESS'
  | 'NOT_YOUR_TURN'
  | 'TILE_NOT_OWNED'
  | 'INVALID_MOVE'
  | 'MUST_OPEN_WITH_DOUBLE_ZERO'
  | 'MUST_OPEN_WITH_DOUBLE'
  | 'SKIP_NOT_ALLOWED'
  | 'KICK_NOT_ALLOWED'
  | 'ROOM_KICKED'
  | 'ROOM_DISBANDED';

export type Ack<T> = { ok: true; data: T } | { ok: false; error: ErrorCode };

// ---- Room protocol (docs/04-REALTIME-PROTOCOL.md) ----

/** What every room member receives in `room:state`: the Room without the game. */
export type PublicRoom = Omit<Room, 'game'> & { tableConnected: boolean };

export type MemberRole = 'player' | 'table';

export type RoomCreatePayload = { name: string; mode: Mode; setup: DeviceSetup };
export type RoomJoinPayload = { code: string; name: string };
export type RoomCodePayload = { code: string };
export type SeatTakePayload = { seat: Seat };
export type MemberKickPayload = { seat: Seat };
export type SessionResumePayload = { sessionToken: string };
export type GamePlayPayload = { tileId: string; side: Side; slam?: boolean };

/** Returned by create, join, join_table and resume. */
export type SessionData = {
  memberId: string;
  role: MemberRole;
  sessionToken: string;
  room: PublicRoom;
};

/** Pre-join summary for the join screen. */
export type RoomPeek = {
  code: string;
  mode: Mode;
  setup: DeviceSetup;
  freeSeats: Seat[];
  tableAvailable: boolean;
};
