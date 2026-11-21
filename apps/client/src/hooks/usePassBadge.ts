import type { Seat } from '@gaflex/shared';
import { useGameStore } from '../store/useGameStore';

/** Seat whose PAS badge is showing right now (docs/05: visible 900 ms). */
export function usePassBadge(): Seat | null {
  return useGameStore((s) => s.passBadge);
}
