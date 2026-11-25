import { useReducedMotion } from 'motion/react';
import { SEAT_ORDER, type Seat, type TableView } from '@gaflex/shared';
import { useGameStore } from '../store/useGameStore';

export type LastPlayedMotion = { tileId: string; seat: Seat; slam: boolean; at: number };

/** Animation inputs for the 3D scenes, derived from the latest game event and view. */
export function useSceneMotion(view: TableView | null, _mySeat?: Seat) {
  const lastEvent = useGameStore((s) => s.lastEvent);
  const reduced = useReducedMotion() ?? false;
  const ev = lastEvent?.event;
  const played = ev?.type === 'played' && ev.tile && ev.seat ? ev : null;

  const freshDeal =
    !!view &&
    view.status === 'playing' && view.chain.length === 0 && SEAT_ORDER.every((s) => view.handCounts[s] === 7);

  return {
    reduced,
    lastPlayed: played
      ? ({ tileId: played.tile!.id, seat: played.seat!, slam: Boolean(played.slam), at: lastEvent!.at } satisfies LastPlayedMotion)
      : null,
    dealRound: freshDeal ? view!.round : null,
  };
}
