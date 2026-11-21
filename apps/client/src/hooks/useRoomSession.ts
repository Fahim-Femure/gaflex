import type { MemberRole } from '@gaflex/shared';
import { useGameStore } from '../store/useGameStore';

/**
 * State of this device's membership in the room named by the URL.
 * 'pending' while a stored session is resuming, 'none' when this device must join first.
 */
export function useRoomSession(code: string | undefined, role: MemberRole) {
  const session = useGameStore((s) => s.session);
  const room = useGameStore((s) => s.room);
  const resuming = useGameStore((s) => s.resuming);

  const matches = !!session && session.code === code && session.role === role;
  if (matches && room) return { status: 'ready' as const, session, room };
  if (resuming || matches) return { status: 'pending' as const };
  return { status: 'none' as const };
}
