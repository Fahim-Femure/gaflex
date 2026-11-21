import type { PublicRoom, Seat } from '@gaflex/shared';

export const SEAT_LABEL: Record<Seat, string> = { N: 'Utara', E: 'Timur', S: 'Selatan', W: 'Barat' };

export function seatName(room: PublicRoom | null, seat: Seat): string {
  return room?.seats[seat]?.name ?? SEAT_LABEL[seat];
}

/** Label for a score key: a seat (solo) or a team (A = N+S, B = E+W). */
export function scoreLabel(room: PublicRoom | null, key: string): string {
  if (key === 'A') return `Tim A (${seatName(room, 'N')} & ${seatName(room, 'S')})`;
  if (key === 'B') return `Tim B (${seatName(room, 'E')} & ${seatName(room, 'W')})`;
  return seatName(room, key as Seat);
}
