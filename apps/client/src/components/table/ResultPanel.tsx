import { motion, useReducedMotion } from 'motion/react';
import {
  DEAD_DOUBLE_ZERO_POINTS,
  MIN_ROUND_PENALTY,
  SCORE_LIMIT,
  SEAT_ORDER,
  TEAM_OF_SEAT,
  type PublicRoom,
  type Seat,
  type TableView,
} from '@gaflex/shared';
import { EASE_OUT, UI } from '../../lib/motion';
import { scoreLabel, seatName } from '../../lib/names';
import { tallyText } from '../../lib/tally';
import { Button } from '../ui/Button';
import { Domino } from './Domino';
import { Confetti, CountUp } from './RoundEffects';

export function ResultPanel({
  view,
  room,
  isHost,
  onNext,
  onKick,
  kickingSeat,
  busy,
  celebrate = false,
}: {
  view: TableView;
  room: PublicRoom;
  isHost: boolean;
  onNext?: () => void;
  onKick?: (seat: Seat) => void;
  kickingSeat?: Seat | null;
  busy?: boolean;
  /** This screen belongs to the winner (or is the table display): show confetti. */
  celebrate?: boolean;
}) {
  const reduce = useReducedMotion();
  const result = view.result;
  if (!result) return null;
  const gameOver = view.status === 'game_end';
  const hasVacantSeat = SEAT_ORDER.some((s) => room.seats[s] === null);
  const winnerText = scoreLabel(room, result.winner);
  const loserText = view.gameLoser ? scoreLabel(room, view.gameLoser) : '';
  const penaltyOf = (key: string) => result.penalties[key] ?? 0;
  const rawPointsOf = (key: string) =>
    view.mode === 'team'
      ? SEAT_ORDER.filter((s) => TEAM_OF_SEAT[s] === key).reduce((n, s) => n + result.pips[s], 0)
      : result.pips[key as Seat];
  let flipIndex = 0;

  return (
    <motion.section
      aria-labelledby="result-title"
      className="relative flex flex-col gap-5 rounded-[28px] bg-ivory p-5 text-felt-deep"
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(16px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: UI.slow, ease: EASE_OUT }}
    >
      {celebrate && <Confetti />}
      <div className="flex flex-col gap-1">
        <h2 id="result-title" className="text-3xl font-black tracking-tight">
          {gameOver ? `${loserText} kalah game ini!` : `${winnerText} menang ronde ${view.round}`}
        </h2>
        <p className="text-lg font-semibold">
          {result.reason === 'domino' ? 'Habis kartu' : 'Gaple: semua buntu, titik terkecil menang'} · yang kalah
          menambah sisa titiknya (di bawah {MIN_ROUND_PENALTY} tidak dihitung; balak 0-0 = {DEAD_DOUBLE_ZERO_POINTS})
        </p>
        {gameOver && (
          <p className="text-lg font-black">
            Titik lewat {SCORE_LIMIT}. {tallyText(room, view.mode, view.tally)}
          </p>
        )}
      </div>

      {view.revealedHands && (
        <ul className="flex flex-col gap-3">
          {SEAT_ORDER.map((seat) => {
            const hasDeadZero = view.revealedHands![seat].some((t) => t.a === 0 && t.b === 0);
            const seatInfo = room.seats[seat];
            const offline = seatInfo?.connected === false;
            const canKickThis = isHost && !!onKick && offline && seatInfo?.playerId !== room.hostId;
            return (
              <li key={seat} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-base font-bold">
                  <span>
                    {seatName(room, seat)} · {result.pips[seat]} titik
                    {hasDeadZero && ` (termasuk 0-0 = ${DEAD_DOUBLE_ZERO_POINTS})`}
                    {seatInfo === null && ' (kursi kosong)'}
                    {offline && <span className="text-pip-red"> (terputus)</span>}
                  </span>
                  {canKickThis && (
                    <button
                      type="button"
                      disabled={kickingSeat === seat || busy}
                      onClick={() => onKick(seat)}
                      aria-label={`Keluarkan ${seatName(room, seat)}`}
                      className="tappable min-h-8 rounded-full bg-pip-red px-3 py-1 text-xs font-black text-ivory hover:opacity-90 disabled:opacity-45"
                    >
                      {kickingSeat === seat ? '…' : 'Kick'}
                    </button>
                  )}
                </div>
              {/* ivory tiles need the felt behind them to read as tiles on the ivory panel */}
              <span className="flex min-h-10 flex-wrap items-center gap-1 self-start rounded-xl bg-felt px-2 py-1.5 text-ivory" style={{ perspective: '600px' }}>
                {view.revealedHands![seat].length === 0 ? (
                  <span className="text-base font-semibold">Habis</span>
                ) : (
                  view.revealedHands![seat].map((t) => {
                    // docs/05: remaining tiles turn face up, one after another
                    const i = flipIndex++;
                    return (
                      <motion.span
                        key={t.id}
                        className="inline-flex"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'rotateY(90deg)' }}
                        animate={{ opacity: 1, transform: 'rotateY(0deg)' }}
                        transition={{ duration: UI.slow, ease: EASE_OUT, delay: 0.15 + i * 0.04 }}
                      >
                        <Domino first={t.a} second={t.b} size="sm" />
                      </motion.span>
                    );
                  })
                )}
              </span>
            </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-black">Titik kalah (batas {SCORE_LIMIT})</h3>
        <ul className="flex flex-col gap-0.5 text-lg font-semibold">
          {Object.entries(view.scores).map(([key, value]) => {
            const penalty = penaltyOf(key);
            const raw = rawPointsOf(key);
            const waivedBelowTen = key !== result.winner && penalty === 0 && raw > 0;
            return (
              <li key={key} className="flex justify-between gap-4">
                <span>
                  {scoreLabel(room, key)}
                  {penalty > 0 && <span className="font-bold"> +{penalty}</span>}
                  {waivedBelowTen && (
                    <span className="text-sm font-semibold opacity-80"> (+0, di bawah {MIN_ROUND_PENALTY})</span>
                  )}
                </span>
                <span className="font-black tabular-nums">
                  <CountUp from={value - penalty} to={value} /> / {SCORE_LIMIT}
                </span>
              </li>
            );
          })}
        </ul>
        {!gameOver && <p className="text-base font-semibold">{tallyText(room, view.mode, view.tally)}</p>}
        {hasVacantSeat && (
          <p className="text-sm font-bold">
            Ada kursi kosong — kode room <span className="tracking-wider">{room.code}</span> untuk pemain pengganti.
          </p>
        )}
      </div>

      {isHost ? (
        <Button onClick={onNext} disabled={busy} className="bg-felt-deep! text-ivory! hover:bg-felt!">
          {gameOver ? 'Main lagi' : 'Ronde berikutnya'}
        </Button>
      ) : (
        <p className="text-lg font-bold">Menunggu host memulai {gameOver ? 'game baru' : 'ronde berikutnya'}.</p>
      )}
    </motion.section>
  );
}
