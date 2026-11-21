import { SEAT_ORDER, type Mode, type PublicRoom } from '@gaflex/shared';
import { seatName } from './names';

/** The games decided so far: team = games won ("Tim A 1 – 0 Tim B"), solo = games lost per player. */
export function tallyText(room: PublicRoom | null, mode: Mode, tally: Record<string, number>): string {
  const n = (key: string) => tally[key] ?? 0;
  if (mode === 'team') return `Tim A ${n('A')} – ${n('B')} Tim B`;
  return `Kalah: ${SEAT_ORDER.map((s) => `${seatName(room, s)} ${n(s)}`).join(' · ')}`;
}
