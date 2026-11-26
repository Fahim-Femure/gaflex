import { create } from 'zustand';
import type { GameEvent, PlayerView, PublicRoom, Seat, SessionData, TableView } from '@gaflex/shared';
import {
  clearSession,
  deviceStorage,
  loadSession,
  saveSession,
  tabStorage,
  type StoredSession,
} from '../lib/session';
import { loadMuted, saveMuted } from '../lib/settings';

export type Connection = 'connecting' | 'online' | 'offline';

type GameStore = {
  connection: Connection;
  /** This tab's membership. */
  session: StoredSession | null;
  /** Last membership on this device (another or a closed tab). Offered on the landing page. */
  lastSession: StoredSession | null;
  room: PublicRoom | null;
  /** True until this tab's stored session has been resumed or rejected. */
  resuming: boolean;
  playerView: PlayerView | null;
  tableView: TableView | null;
  /** Latest game event with its arrival time, for transient UI (PAS badge). */
  lastEvent: { event: GameEvent; at: number } | null;
  /** Seat showing the PAS badge right now. */
  passBadge: Seat | null;
  setPlayerView: (v: PlayerView) => void;
  setTableView: (v: TableView) => void;
  pushEvent: (e: GameEvent) => void;
  /** Sound off on this device. */
  muted: boolean;
  toggleMuted: () => void;
  /** A one-off message for the player (why they were sent back, what failed). */
  notice: { text: string; at: number } | null;
  showNotice: (text: string) => void;
  clearNotice: () => void;
  setConnection: (c: Connection) => void;
  setRoom: (room: PublicRoom) => void;
  setResuming: (r: boolean) => void;
  startSession: (data: SessionData) => void;
  adoptLastSession: () => StoredSession | null;
  endSession: () => void;
};

const tabSession = loadSession(tabStorage());

export const useGameStore = create<GameStore>((set, get) => ({
  connection: 'connecting',
  session: tabSession,
  lastSession: loadSession(deviceStorage()),
  room: null,
  resuming: tabSession !== null,
  playerView: null,
  tableView: null,
  lastEvent: null,
  setPlayerView: (playerView) => set({ playerView }),
  setTableView: (tableView) => set({ tableView }),
  passBadge: null,
  pushEvent: (event) => {
    const entry = { event, at: Date.now() };
    set({ lastEvent: entry, passBadge: event.type === 'passed' ? event.seat : null });
    if (event.type === 'passed') {
      // docs/05: the PAS badge disappears after 900 ms
      setTimeout(() => {
        if (get().lastEvent === entry) set({ passBadge: null });
      }, 900);
    }
  },
  muted: loadMuted(),
  toggleMuted: () => {
    const muted = !get().muted;
    saveMuted(muted);
    set({ muted });
  },
  notice: null,
  showNotice: (text) => set({ notice: { text, at: Date.now() } }),
  clearNotice: () => set({ notice: null }),
  setConnection: (connection) => set({ connection }),
  setRoom: (room) => {
    if (room.code === get().session?.code) set({ room });
  },
  setResuming: (resuming) => set({ resuming }),
  startSession: (data) => {
    const session: StoredSession = {
      code: data.room.code,
      memberId: data.memberId,
      role: data.role,
      sessionToken: data.sessionToken,
    };
    saveSession(session, tabStorage());
    saveSession(session, deviceStorage());
    // Views for this room may already have arrived (the server sends them before the ack).
    const prevCode = get().session?.code;
    const clearViews = data.room.status === 'lobby' || (prevCode !== undefined && prevCode !== session.code);
    set({
      session,
      lastSession: session,
      room: data.room,
      ...(clearViews ? { playerView: null, tableView: null, lastEvent: null } : {}),
    });
  },
  adoptLastSession: () => {
    const last = get().lastSession;
    if (!last) return null;
    saveSession(last, tabStorage());
    set({ session: last, room: null, resuming: true });
    return last;
  },
  endSession: () => {
    const current = get().session;
    clearSession(tabStorage());
    if (current && get().lastSession?.sessionToken === current.sessionToken) {
      clearSession(deviceStorage());
      set({ lastSession: null });
    }
    set({ session: null, room: null, playerView: null, tableView: null, lastEvent: null });
  },
}));
