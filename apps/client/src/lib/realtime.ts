import {
  EVENTS,
  type GameEvent,
  type PlayerView,
  type PublicRoom,
  type SessionData,
  type TableView,
} from '@gaflex/shared';
import { useGameStore } from '../store/useGameStore';
import { FLIGHT_MS, SLAM_FLIGHT_MS, SLAM_IMPACT_T } from '../three/animations/curves';
import { getSocket, request } from './socket';
import { playCetas, playTak, preloadCetas, unlockAudio } from './sound';

const store = useGameStore.getState;

let pendingLocalSlam: { tileId: string; at: number } | null = null;

/** Records a local push-slam so audio/animation still trigger if an ack/server lacks the flag. */
export function markLocalSlam(tileId: string) {
  pendingLocalSlam = { tileId, at: Date.now() };
}

/** Enriches a `played` event with `slam: true` if this client just pushed that tile forward. */
export function resolvePlayedEvent(event: GameEvent): GameEvent {
  if (event.type !== 'played' || !event.tile) return event;
  const p = pendingLocalSlam;
  if (p && p.tileId === event.tile.id && Date.now() - p.at < 5000) {
    pendingLocalSlam = null;
    return event.slam ? event : { ...event, slam: true };
  }
  return event;
}

/** Re-attach this tab's stored session to the current socket. */
export async function resumeSession() {
  const session = store().session;
  if (!session) {
    store().setResuming(false);
    return;
  }
  store().setResuming(true);
  const res = await request<SessionData>(EVENTS.SESSION_RESUME, { sessionToken: session.sessionToken });
  // The user may have created or joined another room while this was in flight
  // (requests buffered before connect are sent ahead of this resume).
  if (store().session?.sessionToken !== session.sessionToken) {
    store().setResuming(false);
    return;
  }
  if (res.ok) store().startSession(res.data);
  else if (res.error !== 'TIMEOUT') {
    store().endSession();
    store().showNotice('Sesimu di room ini sudah berakhir (room ditutup atau terlalu lama terputus).');
  }
  store().setResuming(false);
}

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** docs/05: the "tak" (or "cetas" on a push-slam) sounds right when the tile lands. */
function soundForEvent(event: GameEvent) {
  if (event.type !== 'played' || store().muted) return;
  const reduced = prefersReducedMotion();
  if (event.slam) {
    const impactDelaySec = (reduced ? 90 : SLAM_FLIGHT_MS * SLAM_IMPACT_T) / 1000;
    void playCetas(impactDelaySec);
    return;
  }
  const landing = reduced ? 120 : FLIGHT_MS * 0.8;
  window.setTimeout(() => playTak(), landing);
}

/** Wires socket lifecycle into the store. Call once at startup. */
export function initRealtime() {
  const socket = getSocket();
  // Browsers only unlock audio after a user gesture (pointerup/touchend/click for iOS/mobile).
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const) {
    window.addEventListener(ev, unlockAudio, { passive: true });
  }
  const hasAudio =
    typeof window !== 'undefined' &&
    Boolean(window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (hasAudio) void preloadCetas();

  socket.on('connect', () => {
    store().setConnection('online');
    void resumeSession();
  });
  socket.on('disconnect', () => store().setConnection('offline'));
  socket.on('connect_error', () => {
    store().setConnection('offline');
    store().setResuming(false);
  });
  socket.on(EVENTS.ROOM_STATE, (room: PublicRoom) => store().setRoom(room));
  socket.on(EVENTS.GAME_EVENT, (event: GameEvent) => {
    const resolved = resolvePlayedEvent(event);
    store().pushEvent(resolved);
    soundForEvent(resolved);
  });
  socket.on(EVENTS.GAME_TABLE_VIEW, (view: TableView) => store().setTableView(view));
  socket.on(EVENTS.GAME_PLAYER_VIEW, (view: PlayerView) => {
    store().setPlayerView(view);
    if (view.status === 'playing' && view.turn === view.seat && view.legalMoves.length > 0) {
      try {
        navigator.vibrate?.(30);
      } catch {
        // vibration unsupported
      }
    }
  });
  socket.on(EVENTS.ERROR, (err: { code?: string }) => {
    if (err?.code === 'ROOM_NOT_FOUND') {
      store().endSession();
      store().showNotice('Room sudah ditutup karena lama tidak aktif.');
    }
  });
}
