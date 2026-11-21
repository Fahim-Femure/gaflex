import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  MAX_PLAYERS,
  RECONNECT_GRACE_MS,
  ROOM_IDLE_MS,
  SEAT_ORDER,
  TARGET_SCORE_OPTIONS,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  sanitizeName,
  type Ack,
  type ErrorCode,
  type MemberRole,
  type PublicRoom,
  type Room,
  type RoomCodePayload,
  type RoomCreatePayload,
  type RoomJoinPayload,
  type RoomPeek,
  type Seat,
  type SessionData,
  type SessionResumePayload,
} from '@gaflex/shared';

type Member = {
  id: string;
  token: string;
  code: string;
  role: MemberRole;
  name: string;
  seat: Seat | null;
  connected: boolean;
  disconnectedAt: number | null;
};

type RoomRecord = { room: Room; memberIds: string[]; lastActivity: number };

export type RoomManagerOptions = {
  now?: () => number;
  newId?: () => string;
  newToken?: () => string;
  codeGen?: () => string;
};

const fail = (error: ErrorCode) => ({ ok: false as const, error });
const done = <T>(data: T) => ({ ok: true as const, data });

/** In-memory rooms. Owns every room rule that is not game logic. */
export class RoomManager {
  private rooms = new Map<string, RoomRecord>();
  private members = new Map<string, Member>();
  private tokens = new Map<string, string>(); // token -> memberId
  private now: () => number;
  private newId: () => string;
  private newToken: () => string;
  private codeGen: () => string;

  constructor(opts: RoomManagerOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? randomUUID;
    this.newToken = opts.newToken ?? (() => randomBytes(24).toString('base64url'));
    this.codeGen = opts.codeGen ?? (() => generateRoomCode(randomInt));
  }

  create(payload: RoomCreatePayload): Ack<SessionData> {
    const name = sanitizeName(payload?.name);
    if (
      !name ||
      (payload.mode !== 'solo' && payload.mode !== 'team') ||
      (payload.setup !== 4 && payload.setup !== 5) ||
      !(TARGET_SCORE_OPTIONS as readonly number[]).includes(payload.targetScore)
    ) {
      return fail('INVALID_PAYLOAD');
    }

    let code = this.codeGen();
    while (this.rooms.has(code)) code = this.codeGen();

    const room: Room = {
      code,
      hostId: '',
      mode: payload.mode,
      setup: payload.setup,
      seats: { N: null, E: null, S: null, W: null },
      tableDeviceId: null,
      status: 'lobby',
      game: null,
      targetScore: payload.targetScore,
    };
    const record: RoomRecord = { room, memberIds: [], lastActivity: this.now() };
    this.rooms.set(code, record);
    const member = this.addMember(record, 'player', name);
    room.hostId = member.id;
    return done(this.session(member));
  }

  peek(payload: RoomCodePayload): Ack<RoomPeek> {
    const record = this.findRecord(payload?.code);
    if (!record) return fail('ROOM_NOT_FOUND');
    const { room } = record;
    return done({
      code: room.code,
      mode: room.mode,
      setup: room.setup,
      freeSeats: SEAT_ORDER.filter((s) => room.seats[s] === null),
      tableAvailable: this.tableAvailable(record),
    });
  }

  join(payload: RoomJoinPayload): Ack<SessionData> {
    const record = this.findRecord(payload?.code);
    if (!record) return fail('ROOM_NOT_FOUND');
    const name = sanitizeName(payload.name);
    if (!name) return fail('INVALID_PAYLOAD');
    const players = record.memberIds.filter((id) => this.members.get(id)?.role === 'player');
    if (players.length >= MAX_PLAYERS) return fail('ROOM_FULL');
    const member = this.addMember(record, 'player', name);
    return done(this.session(member));
  }

  joinTable(payload: RoomCodePayload): Ack<SessionData> {
    const record = this.findRecord(payload?.code);
    if (!record) return fail('ROOM_NOT_FOUND');
    if (!this.tableAvailable(record)) return fail('TABLE_UNAVAILABLE');
    const previous = record.room.tableDeviceId;
    if (previous) this.removeMember(previous); // a disconnected table is replaced
    const member = this.addMember(record, 'table', 'Meja');
    record.room.tableDeviceId = member.id;
    return done(this.session(member));
  }

  takeSeat(memberId: string, seat: Seat): Ack<PublicRoom> {
    const member = this.members.get(memberId);
    if (!member || member.role !== 'player') return fail('NOT_IN_ROOM');
    if (!SEAT_ORDER.includes(seat)) return fail('INVALID_PAYLOAD');
    const record = this.rooms.get(member.code)!;
    if (record.room.status !== 'lobby') return fail('GAME_IN_PROGRESS');
    const holder = record.room.seats[seat];
    if (holder && holder.playerId !== member.id) return fail('SEAT_TAKEN');
    if (member.seat && member.seat !== seat) record.room.seats[member.seat] = null;
    member.seat = seat;
    record.room.seats[seat] = { playerId: member.id, name: member.name, connected: member.connected };
    this.touch(record);
    return done(this.toPublic(record));
  }

  leaveSeat(memberId: string): Ack<PublicRoom> {
    const member = this.members.get(memberId);
    if (!member || member.role !== 'player') return fail('NOT_IN_ROOM');
    const record = this.rooms.get(member.code)!;
    if (record.room.status !== 'lobby') return fail('GAME_IN_PROGRESS');
    if (member.seat) record.room.seats[member.seat] = null;
    member.seat = null;
    this.touch(record);
    return done(this.toPublic(record));
  }

  resume(payload: SessionResumePayload): Ack<SessionData> {
    const id = typeof payload?.sessionToken === 'string' ? this.tokens.get(payload.sessionToken) : undefined;
    const member = id ? this.members.get(id) : undefined;
    if (!member) return fail('SESSION_INVALID');
    this.setConnected(member, true);
    this.touch(this.rooms.get(member.code)!);
    return done(this.session(member));
  }

  /**
   * The member's device moved on (it created or joined another room, or joined again).
   * In the lobby the member is removed at once so it does not hold a player slot;
   * during a game it is only marked disconnected so its seat and hand survive.
   * Returns the room code to broadcast, or null.
   */
  release(memberId: string): string | null {
    const member = this.members.get(memberId);
    if (!member) return null;
    const code = member.code;
    const record = this.rooms.get(code)!;
    if (record.room.status !== 'lobby') {
      this.setConnected(member, false);
      return code;
    }
    this.removeMember(memberId);
    if (record.memberIds.length === 0) {
      this.removeRoom(code);
      return null;
    }
    return code;
  }

  /** Returns the room to broadcast, or null when the member is unknown. */
  disconnect(memberId: string): PublicRoom | null {
    const member = this.members.get(memberId);
    if (!member) return null;
    this.setConnected(member, false);
    return this.toPublic(this.rooms.get(member.code)!);
  }

  /** Expires idle rooms and members past the reconnect grace. Call periodically. */
  sweep(): { changed: string[]; removed: string[] } {
    const now = this.now();
    const changed: string[] = [];
    const removed: string[] = [];
    for (const [code, record] of [...this.rooms]) {
      if (now - record.lastActivity >= ROOM_IDLE_MS) {
        this.removeRoom(code);
        removed.push(code);
        continue;
      }
      // Seats are only freed in the lobby; in-game handling arrives with the game loop.
      if (record.room.status !== 'lobby') continue;
      const expired = record.memberIds.filter((id) => {
        const m = this.members.get(id)!;
        return !m.connected && m.disconnectedAt !== null && now - m.disconnectedAt >= RECONNECT_GRACE_MS;
      });
      if (expired.length === 0) continue;
      expired.forEach((id) => this.removeMember(id));
      if (record.memberIds.length === 0) {
        this.removeRoom(code);
        removed.push(code);
      } else {
        changed.push(code);
      }
    }
    return { changed, removed };
  }

  getPublicRoom(code: string): PublicRoom | null {
    const record = this.rooms.get(code);
    return record ? this.toPublic(record) : null;
  }

  getMember(memberId: string): Readonly<Member> | undefined {
    return this.members.get(memberId);
  }

  /** Mutable room for the game service (the only other writer of Room). */
  getRoomForGame(code: string): Room | undefined {
    return this.rooms.get(code)?.room;
  }

  /** Records activity so a room in play is not expired as idle. */
  touchRoom(code: string) {
    const record = this.rooms.get(code);
    if (record) this.touch(record);
  }

  /** Seated players with their member ids, for per-player views. */
  seatedMembers(code: string): { memberId: string; seat: Seat }[] {
    const room = this.rooms.get(code)?.room;
    if (!room) return [];
    return SEAT_ORDER.flatMap((seat) => {
      const info = room.seats[seat];
      return info ? [{ memberId: info.playerId, seat }] : [];
    });
  }

  // ---- internals ----

  private findRecord(code: unknown): RoomRecord | undefined {
    if (typeof code !== 'string') return undefined;
    const normalized = normalizeRoomCode(code);
    return isValidRoomCode(normalized) ? this.rooms.get(normalized) : undefined;
  }

  private tableAvailable(record: RoomRecord): boolean {
    if (record.room.setup !== 5) return false;
    const id = record.room.tableDeviceId;
    return !id || !this.members.get(id)?.connected;
  }

  private addMember(record: RoomRecord, role: MemberRole, name: string): Member {
    const member: Member = {
      id: this.newId(),
      token: this.newToken(),
      code: record.room.code,
      role,
      name,
      seat: null,
      connected: true,
      disconnectedAt: null,
    };
    this.members.set(member.id, member);
    this.tokens.set(member.token, member.id);
    record.memberIds.push(member.id);
    this.touch(record);
    return member;
  }

  private removeMember(id: string) {
    const member = this.members.get(id);
    if (!member) return;
    const record = this.rooms.get(member.code);
    this.members.delete(id);
    this.tokens.delete(member.token);
    if (!record) return;
    record.memberIds = record.memberIds.filter((x) => x !== id);
    if (member.seat) record.room.seats[member.seat] = null;
    if (record.room.tableDeviceId === id) record.room.tableDeviceId = null;
    if (record.room.hostId === id) {
      const next = record.memberIds.find((x) => this.members.get(x)?.role === 'player');
      record.room.hostId = next ?? '';
    }
  }

  private removeRoom(code: string) {
    const record = this.rooms.get(code);
    if (!record) return;
    for (const id of record.memberIds) {
      const m = this.members.get(id);
      if (m) this.tokens.delete(m.token);
      this.members.delete(id);
    }
    this.rooms.delete(code);
  }

  private setConnected(member: Member, connected: boolean) {
    member.connected = connected;
    member.disconnectedAt = connected ? null : this.now();
    const record = this.rooms.get(member.code)!;
    const seatInfo = member.seat ? record.room.seats[member.seat] : null;
    if (seatInfo) seatInfo.connected = connected;
  }

  private touch(record: RoomRecord) {
    record.lastActivity = this.now();
  }

  private session(member: Member): SessionData {
    return {
      memberId: member.id,
      role: member.role,
      sessionToken: member.token,
      room: this.toPublic(this.rooms.get(member.code)!),
    };
  }

  private toPublic(record: RoomRecord): PublicRoom {
    const { game: _game, ...rest } = record.room;
    const tableId = record.room.tableDeviceId;
    return {
      ...structuredClone(rest),
      tableConnected: tableId ? Boolean(this.members.get(tableId)?.connected) : false,
    };
  }
}
