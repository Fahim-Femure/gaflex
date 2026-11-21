import { EVENTS } from '@gaflex/shared';
import { useGameStore } from '../store/useGameStore';
import { request } from './socket';

/** True when `pathname` is outside room `code` (the lobby was left, not advanced into the game). */
export function leftRoom(pathname: string, code: string): boolean {
  return !pathname.startsWith(`/room/${code}/`);
}

/**
 * Leaves the room for good: the server frees the slot and seat (lobby), and this tab
 * forgets the session so "Kembali ke room" is not offered for it.
 */
export async function leaveRoom(): Promise<void> {
  await request(EVENTS.ROOM_LEAVE, {});
  useGameStore.getState().endSession();
}
