import { useEffect, useState, type CSSProperties } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion as m } from 'motion/react';
import { EVENTS, SCORE_LIMIT, SEAT_ORDER, TEAM_OF_SEAT, type Seat, type Side, type Tile } from '@gaflex/shared';
import { ChainView } from '../components/table/ChainView';
import { Domino } from '../components/table/Domino';
import { ResultPanel } from '../components/table/ResultPanel';
import { SceneBoundary } from '../components/table/SceneBoundary';
import { SeatStatus } from '../components/table/SeatStatus';
import { AppShell } from '../components/ui/AppShell';
import { Button } from '../components/ui/Button';
import { ReconnectBanner } from '../components/ui/ReconnectBanner';
import { SoundToggle } from '../components/ui/SoundToggle';
import { usePassBadge } from '../hooks/usePassBadge';
import { useRoomSession } from '../hooks/useRoomSession';
import { useSceneMotion } from '../hooks/useSceneMotion';
import { useSkipReady } from '../hooks/useSkipReady';
import { tallyText } from '../lib/tally';
import { pickTile } from '../lib/tilePick';
import { errorMessage } from '../lib/errors';
import { enterLandscape } from '../lib/landscape';
import { EASE_OUT, UI } from '../lib/motion';
import { scoreLabel, seatName } from '../lib/names';
import { request } from '../lib/socket';
import { useGameStore } from '../store/useGameStore';
import type { CameraMode } from '../three/animations/cameraRig';
import { seatSlot } from '../three/layout/orientation';
import { PlayerScene } from '../three/scenes';

/** Where an opponent's status chip sits over the 3D table, matching where they sit. */
const SLOT_CLASS = {
  left: 'left-[max(0.75rem,env(safe-area-inset-left))] top-[22%]',
  top: 'left-1/2 top-[3.4rem] -translate-x-1/2',
  right: 'right-[max(0.75rem,env(safe-area-inset-right))] top-[22%]',
} as const;

/**
 * The player's screen, held landscape (docs/05): one 3D table from the player's own chair.
 * Own tiles stand in front of the camera; "Intip" lifts the camera to look over the whole table
 * (4-device setup only; with 5 devices the table display shows it).
 */
export function PlayPage() {
  const { code } = useParams();
  const state = useRoomSession(code, 'player');
  const view = useGameStore((s) => s.playerView);
  const passSeat = usePassBadge();
  const sceneMotion = useSceneMotion(view, view?.seat);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSlam, setSelectedSlam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState<CameraMode>('pov');
  const liveRoom = state.status === 'ready' ? state.room : null;
  const offlineTurnSeat =
    view?.status === 'playing' && view.turn !== view.seat && liveRoom?.seats[view.turn]?.connected === false
      ? view.turn
      : null;
  const skipReady = useSkipReady(offlineTurnSeat);

  // a refused tap ("tidak cocok", "belum giliranmu") is feedback, not a lasting state
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  if (state.status === 'none') return <Navigate to={`/join/${code ?? ''}`} replace />;
  if (state.status === 'ready' && state.room.status === 'lobby') return <Navigate to={`/room/${code}/lobby`} replace />;
  if (state.status === 'pending' || !view) {
    return (
      <AppShell>
        <p role="status" className="py-10 text-xl font-bold">
          Menyambung ke permainan…
        </p>
      </AppShell>
    );
  }

  const { room, session } = state;
  const myTurn = view.status === 'playing' && view.turn === view.seat;
  const canPeek = room.setup === 4;
  // No hints (owner, 2026-11-22): every tile looks the same; the rules only answer a tap.
  const selectedTile = view.hand.find((t) => t.id === selected);
  const choosing = selectedTile !== undefined;

  const play = async (tileId: string, side: Side, slam = false) => {
    setBusy(true);
    setError('');
    const res = await request(EVENTS.GAME_PLAY, { tileId, side, ...(slam ? { slam: true } : {}) });
    setBusy(false);
    setSelected(null);
    setSelectedSlam(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    try {
      navigator.vibrate?.(slam ? [25, 20, 50] : 15); // stronger haptic when pushed forward
    } catch {
      // vibration unsupported
    }
  };

  const pick = (tile: Tile, slam = false) => {
    if (busy) return;
    const outcome = pickTile(tile, { myTurn, ends: view.ends, legalMoves: view.legalMoves });
    if (outcome.kind === 'error') {
      setSelected(null);
      setSelectedSlam(false);
      setError(errorMessage(outcome.code));
    } else if (outcome.kind === 'play') {
      void play(tile.id, outcome.side, slam);
    } else {
      setError('');
      setSelected(tile.id);
      setSelectedSlam(slam);
    }
  };

  const next = async () => {
    setBusy(true);
    setError('');
    const res = await request(EVENTS.ROUND_NEXT, {});
    setBusy(false);
    if (!res.ok) setError(errorMessage(res.error));
  };

  const isHost = room.hostId === session.memberId;
  const skip = async () => {
    setBusy(true);
    setError('');
    const res = await request(EVENTS.GAME_SKIP, {});
    setBusy(false);
    if (!res.ok) setError(errorMessage(res.error));
  };

  const others = SEAT_ORDER.filter((s) => s !== view.seat);
  const turnText =
    view.status !== 'playing'
      ? 'Ronde selesai'
      : passSeat === view.seat
        ? 'Kamu pas'
        : myTurn
          ? view.legalMoves.length > 0
            ? 'Giliranmu'
            : 'Tidak ada kartu yang cocok. Pas.'
          : room.seats[view.turn]?.connected === false
            ? `Menunggu ${seatName(room, view.turn)} tersambung lagi`
            : `Giliran ${seatName(room, view.turn)}`;

  const turnStyle = myTurn ? ({ '--turn-fill': 'var(--color-turn)' } as CSSProperties) : undefined;
  const turnBadgeClass =
    view.status !== 'playing'
      ? 'bg-felt-deep/90 text-ivory'
      : passSeat === view.seat
        ? 'bg-pip-red text-ivory shadow-md'
        : myTurn
          ? 'turn-ring px-5 text-felt-deep shadow-lg'
          : room.seats[view.turn]?.connected === false
            ? 'bg-pip-red text-ivory shadow-md'
            : 'bg-turn-other text-felt-deep ring-2 ring-ivory/90 shadow-md';

  return (
    <div className="fixed inset-0 overflow-hidden bg-felt text-ivory">
      <ReconnectBanner />

      {/* the 3D table from this player's chair */}
      <div className="absolute inset-0">
        <SceneBoundary fallback={<Fallback2D view={view} busy={busy} onPick={(t) => pick(t, false)} />}>
          <PlayerScene
            mySeat={view.seat}
            hand={view.hand}
            handCounts={view.handCounts}
            chain={view.chain}
            selectedId={selected}
            round={view.round}
            lastPlayed={sceneMotion.lastPlayed}
            dealRound={sceneMotion.dealRound}
            camera={canPeek ? camera : 'pov'}
            reduced={sceneMotion.reduced}
            onPick={pick}
          />
        </SceneBoundary>
      </div>

      {/* reduced motion: the camera jumps, so cross-fade instead (docs/05) */}
      {sceneMotion.reduced && (
        <AnimatePresence initial={false}>
          <m.div
            key={camera}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-felt"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: UI.base }}
          />
        </AnimatePresence>
      )}

      {/* Top HUD: highlighted turn indicator centered, action buttons on the right */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-[max(0.75rem,env(safe-area-inset-left))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="hidden flex-1 min-[560px]:block" />
        <p
          role="status"
          title={turnText}
          style={turnStyle}
          className={`max-w-[44%] shrink-0 truncate rounded-full px-4 py-1.5 text-center text-sm font-black min-[700px]:text-base ${turnBadgeClass}`}
        >
          {turnText}
        </p>
        <div className="pointer-events-auto flex flex-1 justify-end gap-2">
          {isHost && skipReady && offlineTurnSeat && (
            <Button
              variant="secondary"
              className="min-h-11 whitespace-nowrap px-5 text-base"
              disabled={busy}
              aria-label={`Lewati giliran ${seatName(room, offlineTurnSeat)}`}
              onClick={() => void skip()}
            >
              Lewati
            </Button>
          )}
          <SoundToggle />
          {canPeek && (
            <Button
              variant={camera === 'peek' ? 'primary' : 'secondary'}
              aria-pressed={camera === 'peek'}
              className="min-h-11 px-5 text-base"
              onClick={() => setCamera((c) => (c === 'peek' ? 'pov' : 'peek'))}
            >
              {camera === 'peek' ? 'Kembali' : 'Intip'}
            </Button>
          )}
        </div>
      </div>

      {/* Bottom-left Score HUD: stays clear of opponent name chips and tile taps */}
      <div className="pointer-events-none absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] max-w-[12.5rem] rounded-2xl bg-felt-deep/90 px-3 py-1.5 shadow-md">
        <h1 className="text-sm font-black leading-tight">Ronde {view.round}</h1>
        <p className="text-xs font-bold leading-snug tabular-nums">
          {Object.entries(view.scores)
            .map(([k, v]) => `${scoreLabel(room, k).split(' (')[0]} ${v}`)
            .join(' · ')}{' '}
          / {SCORE_LIMIT}
        </p>
        <p className="text-[11px] font-semibold leading-snug tabular-nums opacity-90">
          {tallyText(room, room.mode, view.tally)}
        </p>
      </div>

      {/* opponents, placed where they sit */}
      <ul aria-label="Pemain lain">
        {others.map((seat: Seat) => {
          const slot = seatSlot(seat, view.seat) as 'left' | 'top' | 'right';
          return (
            <li key={seat} className={`pointer-events-none absolute ${SLOT_CLASS[slot]}`}>
              <SeatStatus
                compact
                name={seatName(room, seat)}
                count={view.handCounts[seat]}
                isTurn={view.status === 'playing' && view.turn === seat}
                passed={passSeat === seat}
                offline={room.seats[seat]?.connected === false}
              />
            </li>
          );
        })}
      </ul>

      {/* docs/05: a tile that fits both ends shows two targets */}
      <AnimatePresence initial={false}>
        {choosing && selectedTile && (
          <m.div
            key={selectedTile.id}
            className="absolute bottom-[42%] left-1/2 flex w-[min(28rem,80vw)] -translate-x-1/2 flex-col gap-2 rounded-[28px] bg-felt-deep/95 p-3"
            initial={sceneMotion.reduced ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px) scale(0.97)' }}
            animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: UI.base, ease: EASE_OUT }}
          >
            <p className="text-center text-base font-bold">Cocok di dua ujung. Taruh di mana?</p>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy} onClick={() => play(selectedTile.id, 'left', selectedSlam)}>
                <span aria-hidden="true">←</span> Kiri ({view.ends?.[0]})
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => play(selectedTile.id, 'right', selectedSlam)}>
                Kanan ({view.ends?.[1]}) <span aria-hidden="true">→</span>
              </Button>
            </div>
            <Button
              variant="ghost"
              className="min-h-10"
              onClick={() => {
                setSelected(null);
                setSelectedSlam(false);
              }}
            >
              Batal
            </Button>
          </m.div>
        )}
      </AnimatePresence>

      {/* every tile action also works from buttons (docs/05); shown when focused by keyboard */}
      <section
        aria-label="Kartu kamu (tombol)"
        className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:inset-x-0 focus-within:bottom-2 focus-within:flex focus-within:justify-center focus-within:gap-2"
      >
        {view.hand.map((tile) => (
          <button
            key={tile.id}
            type="button"
            disabled={busy}
            onClick={() => pick(tile, false)}
            className="tappable rounded-xl bg-felt-deep p-1"
            aria-label={`Kartu ${tile.a}-${tile.b}`}
          >
            <Domino first={tile.a} second={tile.b} size="sm" />
          </button>
        ))}
      </section>

      {error && (
        <p role="alert" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-pip-red px-4 py-1.5 text-base font-bold">
          {error}
        </p>
      )}

      {(view.status === 'round_end' || view.status === 'game_end') && (
        <div className="absolute inset-0 flex items-start justify-center overflow-y-auto bg-felt-deep/60 p-4">
          <div className="w-full max-w-xl">
            <ResultPanel
              view={view}
              room={room}
              isHost={room.hostId === session.memberId}
              onNext={next}
              busy={busy}
              celebrate={view.result?.winner === view.seat || view.result?.winner === TEAM_OF_SEAT[view.seat]}
            />
          </div>
        </div>
      )}

      {/* held portrait: ask to rotate (orientation lock needs fullscreen, and iOS does not allow it) */}
      <div className="absolute inset-0 hidden flex-col items-center justify-center gap-5 bg-felt p-8 text-center portrait:flex">
        <p className="text-3xl font-black">Putar HP ke posisi landscape</p>
        <p className="text-lg font-semibold">Meja gaple dimainkan mendatar, seperti duduk di depan meja.</p>
        <Button onClick={() => void enterLandscape()}>Layar penuh &amp; landscape</Button>
      </div>
    </div>
  );
}

/** No WebGL: the 2D table and tappable tiles. */
function Fallback2D({
  view,
  busy,
  onPick,
}: {
  view: NonNullable<ReturnType<typeof useGameStore.getState>['playerView']>;
  busy: boolean;
  onPick: (t: Tile) => void;
}) {
  return (
    <div className="flex h-full flex-col justify-center gap-4 overflow-y-auto px-24 py-16">
      <ChainView chain={view.chain} ends={view.ends} />
      <div className="flex flex-wrap justify-center gap-2">
        {view.hand.map((tile) => (
          <button
            key={tile.id}
            type="button"
            disabled={busy}
            onClick={() => onPick(tile)}
            className="tappable rounded-xl p-1"
            aria-label={`Kartu ${tile.a}-${tile.b}`}
          >
            <Domino first={tile.a} second={tile.b} vertical size="md" />
          </button>
        ))}
      </div>
    </div>
  );
}
