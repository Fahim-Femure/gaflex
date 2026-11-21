import { SEAT_ORDER, type Seat } from '@gaflex/shared';

export type Slot = 'bottom' | 'left' | 'top' | 'right';

/** Screen slots in clockwise order, as seen from above with the viewer at the bottom. */
const SLOTS: Slot[] = ['bottom', 'left', 'top', 'right'];

/** Where `seat` appears when `bottom` is the seat nearest the viewer (docs/06). */
export function seatSlot(seat: Seat, bottom: Seat): Slot {
  const offset = (SEAT_ORDER.indexOf(seat) - SEAT_ORDER.indexOf(bottom) + 4) % 4;
  return SLOTS[offset]!;
}

/** Y rotation of the table so that `bottom` (table frame: N = -Z, E = +X, S = +Z, W = -X) faces +Z. */
export function tableYaw(bottom: Seat): number {
  return { S: 0, W: Math.PI / 2, N: Math.PI, E: -Math.PI / 2 }[bottom];
}
