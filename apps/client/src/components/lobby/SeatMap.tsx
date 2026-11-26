import type { ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { TEAM_OF_SEAT, type PublicRoom, type Seat } from '@gaflex/shared';
import { initialOf } from '../../lib/initial';
import { UI } from '../../lib/motion';

const SEAT_NAME: Record<Seat, string> = { N: 'Utara', E: 'Timur', S: 'Selatan', W: 'Barat' };

const AREA: Record<Seat, string> = {
  N: 'col-start-2 row-start-1',
  W: 'col-start-1 row-start-2',
  E: 'col-start-3 row-start-2',
  S: 'col-start-2 row-start-3',
};

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-current">
      <path d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm2 0h4V5a2 2 0 1 0-4 0v2Z" />
    </svg>
  );
}

export function SeatMap({
  room,
  myId,
  onPick,
  busySeat,
  canKick = false,
  onKick,
  kickingSeat,
  center,
}: {
  room: PublicRoom;
  myId?: string;
  onPick?: (seat: Seat) => void;
  busySeat?: Seat | null;
  canKick?: boolean;
  onKick?: (seat: Seat) => void;
  kickingSeat?: Seat | null;
  center?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <LayoutGroup>
    {/* minmax(0, …): a long name must truncate, never widen its column and squeeze the others */}
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] grid-rows-[auto_minmax(7rem,auto)_auto] gap-2">
      <div className="col-start-2 row-start-2 flex items-center justify-center rounded-[28px] bg-felt-deep p-3 text-center">
        {center}
      </div>
      {(['N', 'E', 'S', 'W'] as Seat[]).map((seat) => {
        const info = room.seats[seat];
        const mine = !!info && info.playerId === myId;
        const taken = !!info && !mine;
        const team = room.mode === 'team' ? `Tim ${TEAM_OF_SEAT[seat]}` : null;
        const canPick = !!onPick && !taken && !mine;
        const showKick = canKick && !!onKick && !!info && !info.connected && !mine;
        const status = mine ? 'kursi kamu' : info ? `diisi ${info.name}${info.connected ? '' : ', terputus'}` : 'kosong';

        return (
          <div key={seat} className={`${AREA[seat]} flex min-w-0 flex-col gap-1.5`}>
            <button
              type="button"
              disabled={!canPick || busySeat === seat}
              onClick={() => onPick?.(seat)}
              aria-label={`${SEAT_NAME[seat]}${team ? `, ${team}` : ''}: ${status}`}
              title={info?.name}
              className={`tappable flex min-h-24 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-[28px] px-1.5 py-3 text-center transition-transform duration-150 ease-[var(--ease-out)] motion-reduce:transition-none ${
                mine
                  ? 'bg-ivory text-felt-deep'
                  : taken
                    ? 'bg-felt-raised text-ivory'
                    : onPick
                      ? 'bg-felt-high text-ivory hover:bg-felt-raised active:scale-[0.97]'
                      : 'bg-felt-raised text-ivory/80'
              } disabled:cursor-default`}
            >
              <span className={`flex w-full min-w-0 flex-col items-center gap-0.5 ${canPick ? 'seat-pulse' : ''}`}>
                <span className="text-sm font-bold leading-tight opacity-80">{SEAT_NAME[seat]}</span>
                {team && <span className="text-sm font-bold leading-tight opacity-80">{team}</span>}
                <AnimatePresence mode="popLayout" initial={false}>
                  {info ? (
                    // docs/05: a player arriving pops in; a seat taken by someone else locks (fade + padlock)
                    <motion.span
                      key={info.playerId}
                      className="flex min-w-0 max-w-full flex-col items-center gap-1 text-sm font-extrabold leading-tight min-[380px]:text-base sm:text-lg"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.9)' }}
                      animate={{ opacity: 1, transform: 'scale(1)' }}
                      exit={{ opacity: 0 }}
                      transition={reduce ? { duration: UI.fast } : { type: 'spring', duration: 0.3, bounce: 0.2 }}
                    >
                      {mine && (
                        // docs/05: your avatar slides to the seat you pick
                        <motion.span
                          layoutId="my-avatar"
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-felt-deep text-sm font-black text-ivory"
                          transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.4, bounce: 0.15 }}
                        >
                          {initialOf(info.name)}
                        </motion.span>
                      )}
                      {/* names identify people: wrap to two lines rather than cut to "Ale…" */}
                      <span className="flex min-w-0 max-w-full items-start justify-center gap-1">
                        {taken && <LockIcon />}
                        <span className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">{info.name}</span>
                      </span>
                      {mine && <span className="text-sm font-bold opacity-80">kamu</span>}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="empty"
                      className="text-lg font-extrabold"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: UI.fast }}
                    >
                      {onPick ? 'Duduk sini' : 'Kosong'}
                    </motion.span>
                  )}
                </AnimatePresence>
                {info && !info.connected && <span className="text-sm font-bold text-pip-red-soft">Terputus</span>}
              </span>
            </button>
            {showKick && (
              <button
                type="button"
                disabled={kickingSeat === seat}
                onClick={() => onKick(seat)}
                aria-label={`Keluarkan ${info.name}`}
                className="tappable min-h-9 rounded-full bg-pip-red px-3 py-1 text-xs font-black text-ivory hover:opacity-90 disabled:opacity-45"
              >
                {kickingSeat === seat ? 'Mengeluarkan…' : 'Keluarkan'}
              </button>
            )}
          </div>
        );
      })}
    </div>
    </LayoutGroup>
  );
}
