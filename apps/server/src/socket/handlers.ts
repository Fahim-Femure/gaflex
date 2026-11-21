import type { Server, Socket } from 'socket.io';
import { EVENTS, type Ack, type GameEvent, type SessionData } from '@gaflex/shared';
import type { RoomManager } from '../rooms/RoomManager';
import type { GameService } from '../game/GameService';

type AckFn = (res: Ack<unknown>) => void;

export const roomChannel = (code: string) => `room:${code}`;
export const tableChannel = (code: string) => `table:${code}`;

export type HandlerOptions = {
  /** Pause before each automatic pass so clients can show it (docs/04: 900 ms). */
  passDelayMs?: number;
};

export function registerHandlers(io: Server, manager: RoomManager, game: GameService, opts: HandlerOptions = {}) {
  const passDelayMs = opts.passDelayMs ?? 900;
  /** memberId -> the socket currently speaking for it (latest resume wins). */
  const memberSocket = new Map<string, string>();
  const passTimers = new Map<string, NodeJS.Timeout>();

  const broadcastRoom = (code: string) => {
    const room = manager.getPublicRoom(code);
    if (room) io.to(roomChannel(code)).emit(EVENTS.ROOM_STATE, room);
  };

  /** Views go out after events so clients can animate old -> new (docs/04). */
  const emitViews = (code: string, onlySocket?: string) => {
    const views = game.views(code);
    if (!views) return;
    io.to(onlySocket ?? roomChannel(code)).emit(EVENTS.GAME_TABLE_VIEW, views.table);
    for (const { memberId, view } of views.players) {
      const socketId = memberSocket.get(memberId);
      if (socketId && (!onlySocket || onlySocket === socketId)) io.to(socketId).emit(EVENTS.GAME_PLAYER_VIEW, view);
    }
  };

  const emitEvents = (code: string, events: GameEvent[]) => {
    for (const ev of events) io.to(roomChannel(code)).emit(EVENTS.GAME_EVENT, ev);
  };

  const schedulePasses = (code: string) => {
    clearTimeout(passTimers.get(code));
    passTimers.set(
      code,
      setTimeout(() => {
        passTimers.delete(code);
        const ev = game.autoPassStep(code);
        if (!ev) return;
        emitEvents(code, [ev]);
        emitViews(code);
        schedulePasses(code);
      }, passDelayMs),
    );
  };

  const afterGameChange = (code: string, events: GameEvent[]) => {
    emitEvents(code, events);
    broadcastRoom(code);
    emitViews(code);
    schedulePasses(code);
  };

  const bind = (socket: Socket, session: SessionData) => {
    const code = session.room.code;
    socket.data.memberId = session.memberId;
    memberSocket.set(session.memberId, socket.id);
    socket.join(roomChannel(code));
    if (session.role === 'table') socket.join(tableChannel(code));
    broadcastRoom(code);
    emitViews(code, socket.id); // a resumed or late device catches up on the game
  };

  io.on('connection', (socket) => {
    const on = (event: string, handler: (payload: unknown) => Ack<unknown>) => {
      socket.on(event, (payload: unknown, ack?: AckFn) => {
        let res: Ack<unknown>;
        try {
          res = handler(payload);
        } catch {
          res = { ok: false, error: 'INVALID_PAYLOAD' };
        }
        if (typeof ack === 'function') ack(res);
      });
    };

    /** Drop the member this socket spoke for before it becomes someone else. */
    const releaseCurrent = (keep?: string) => {
      const previous: string | undefined = socket.data.memberId;
      if (!previous || previous === keep || memberSocket.get(previous) !== socket.id) return;
      memberSocket.delete(previous);
      socket.data.memberId = undefined;
      const code = manager.release(previous);
      if (code) broadcastRoom(code);
    };

    const sessionHandler =
      (fn: (payload: never) => Ack<SessionData>, opts: { resume?: boolean } = {}) =>
      (payload: unknown) => {
        if (!opts.resume) releaseCurrent();
        const res = fn(payload as never);
        if (res.ok) {
          if (opts.resume) releaseCurrent(res.data.memberId);
          bind(socket, res.data);
        }
        return res;
      };

    /** Runs only for the socket currently bound to a member. */
    const asMember = (fn: (memberId: string, payload: never) => Ack<unknown>) => (payload: unknown) => {
      const memberId: string | undefined = socket.data.memberId;
      if (!memberId || memberSocket.get(memberId) !== socket.id) {
        return { ok: false, error: 'NOT_IN_ROOM' } as const;
      }
      return fn(memberId, (payload ?? {}) as never);
    };

    const seatAction = (fn: (memberId: string, payload: never) => Ack<{ code: string }>) =>
      asMember((id, p) => {
        const res = fn(id, p);
        if (res.ok) broadcastRoom(res.data.code);
        return res;
      });

    const gameAction = (fn: (memberId: string, payload: never) => Ack<{ code: string; events: GameEvent[] }>) =>
      asMember((id, p) => {
        const res = fn(id, p);
        if (!res.ok) return res;
        afterGameChange(res.data.code, res.data.events);
        return { ok: true, data: null };
      });

    on(EVENTS.ROOM_CREATE, sessionHandler((p) => manager.create(p)));
    on(EVENTS.ROOM_JOIN, sessionHandler((p) => manager.join(p)));
    on(EVENTS.ROOM_JOIN_TABLE, sessionHandler((p) => manager.joinTable(p)));
    on(EVENTS.SESSION_RESUME, sessionHandler((p) => manager.resume(p), { resume: true }));
    on(EVENTS.ROOM_PEEK, (p) => manager.peek(p as never));
    on(EVENTS.SEAT_TAKE, seatAction((id, p: { seat: never }) => manager.takeSeat(id, p.seat)));
    on(EVENTS.SEAT_LEAVE, seatAction((id) => manager.leaveSeat(id)));
    on(EVENTS.GAME_START, gameAction((id) => game.start(id)));
    on(EVENTS.GAME_PLAY, gameAction((id, p) => game.play(id, p)));
    on(EVENTS.ROUND_NEXT, gameAction((id) => game.nextRound(id)));

    socket.on('disconnect', () => {
      const memberId: string | undefined = socket.data.memberId;
      if (!memberId || memberSocket.get(memberId) !== socket.id) return;
      memberSocket.delete(memberId);
      const room = manager.disconnect(memberId);
      if (room) broadcastRoom(room.code);
    });
  });

  /** Run the manager's expiry and tell clients what changed. */
  const sweep = () => {
    const { changed, removed } = manager.sweep();
    changed.forEach(broadcastRoom);
    for (const code of removed) {
      clearTimeout(passTimers.get(code));
      passTimers.delete(code);
      io.to(roomChannel(code)).emit(EVENTS.ERROR, { code: 'ROOM_NOT_FOUND', message: 'Room sudah ditutup.' });
      io.in(roomChannel(code)).socketsLeave([roomChannel(code), tableChannel(code)]);
    }
  };

  const dispose = () => {
    passTimers.forEach((t) => clearTimeout(t));
    passTimers.clear();
  };

  return { sweep, dispose };
}
