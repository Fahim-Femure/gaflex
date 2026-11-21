import { motion, useReducedMotion } from 'motion/react';
import { SCORE_LIMIT, SEAT_ORDER, type PublicRoom, type TableView } from '@gaflex/shared';
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
  busy,
  celebrate = false,
}: {
  view: TableView;
  room: PublicRoom;
  isHost: boolean;
  onNext?: () => void;
  busy?: boolean;
  /** This screen belongs to the winner (or is the table display): show confetti. */
  celebrate?: boolean;
}) {
  const reduce = useReducedMotion();
  const result = view.result;
  if (!result) return null;
  const gameOver = view.status === 'game_end';
  const winnerText = scoreLabel(room, result.winner);
  const loserText = view.gameLoser ? scoreLabel(room, view.gameLoser) : '';
  const penaltyOf = (key: string) => result.penalties[key] ?? 0;
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
          menambah sisa titiknya
        </p>
        {gameOver && (
          <p className="text-lg font-black">
            Titik lewat {SCORE_LIMIT}. {tallyText(room, view.mode, view.tally)}
          </p>
        )}
      </div>

      {view.revealedHands && (
        <ul className="flex flex-col gap-3">
          {SEAT_ORDER.map((seat) => (
            <li key={seat} className="flex flex-col gap-1">
              <span className="text-base font-bold">
                {seatName(room, seat)} · {result.pips[seat]} titik
              </span>
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
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-black">Titik kalah (batas {SCORE_LIMIT})</h3>
        <ul className="flex flex-col gap-0.5 text-lg font-semibold">
          {Object.entries(view.scores).map(([key, value]) => (
            <li key={key} className="flex justify-between gap-4">
              <span>
                {scoreLabel(room, key)}
                {penaltyOf(key) > 0 && <span className="font-bold"> +{penaltyOf(key)}</span>}
              </span>
              <span className="font-black tabular-nums">
                <CountUp from={value - penaltyOf(key)} to={value} /> / {SCORE_LIMIT}
              </span>
            </li>
          ))}
        </ul>
        {!gameOver && <p className="text-base font-semibold">{tallyText(room, view.mode, view.tally)}</p>}
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
