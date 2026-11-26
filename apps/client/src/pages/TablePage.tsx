import { Navigate, useParams } from 'react-router-dom';
import { SCORE_LIMIT, SEAT_ORDER, type PublicRoom, type TableView } from '@gaflex/shared';
import { RoomCode } from '../components/lobby/RoomCode';
import { SeatMap } from '../components/lobby/SeatMap';
import { ChainView } from '../components/table/ChainView';
import { ResultPanel } from '../components/table/ResultPanel';
import { SceneBoundary } from '../components/table/SceneBoundary';
import { AppShell } from '../components/ui/AppShell';
import { ReconnectBanner } from '../components/ui/ReconnectBanner';
import { SoundToggle } from '../components/ui/SoundToggle';
import { useRoomSession } from '../hooks/useRoomSession';
import { useSceneMotion } from '../hooks/useSceneMotion';
import { scoreLabel } from '../lib/names';
import { tallyText } from '../lib/tally';
import { useGameStore } from '../store/useGameStore';
import { TableScene } from '../three/scenes';

/**
 * Full-viewport overhead 3D table for device 5 (no player panels shown).
 * South sits at the bottom.
 */
function TableBoard({ view, room }: { view: TableView; room: PublicRoom }) {
  const motion = useSceneMotion(view);
  return (
    <div className="fixed inset-0 overflow-hidden bg-felt text-ivory">
      <ReconnectBanner />

      <div className="absolute inset-0">
        <SceneBoundary
          fallback={
            <div className="flex h-full items-center justify-center p-6">
              <ChainView chain={view.chain} ends={view.ends} size="lg" />
            </div>
          }
        >
          <TableScene
            chain={view.chain}
            bottomSeat="S"
            lastPlayed={motion.lastPlayed}
            dealRound={motion.dealRound}
            reduced={motion.reduced}
          />
        </SceneBoundary>
      </div>

      {/* Sound toggle at top-right */}
      <div className="pointer-events-auto absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))]">
        <SoundToggle />
      </div>

      {/* Compact Round/Score/Tally corner pill at bottom-left */}
      <div className="pointer-events-none absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] max-w-[16rem] rounded-2xl bg-felt-deep/90 px-3.5 py-2 shadow-md">
        <h1 className="text-base font-black leading-tight">Ronde {view.round}</h1>
        <p className="text-sm font-bold leading-snug tabular-nums">
          {Object.entries(view.scores)
            .map(([k, v]) => `${scoreLabel(room, k).split(' (')[0]} ${v}`)
            .join(' · ')}{' '}
          / {SCORE_LIMIT}
        </p>
        <p className="text-xs font-semibold leading-snug tabular-nums opacity-90">
          {tallyText(room, room.mode, view.tally)}
        </p>
      </div>

      {(view.status === 'round_end' || view.status === 'game_end') && (
        <div className="absolute inset-0 flex items-start justify-center overflow-y-auto bg-felt-deep/60 p-4">
          <div className="w-full max-w-xl">
            <ResultPanel view={view} room={room} isHost={false} celebrate />
          </div>
        </div>
      )}

      <p className="pointer-events-none fixed bottom-[max(0.35rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] text-[11px] font-semibold text-ivory/55">
        © 2026 Fahim
      </p>
    </div>
  );
}

/** Table Display (device 5). Read-only. */
export function TablePage() {
  const { code } = useParams();
  const state = useRoomSession(code, 'table');
  const tableView = useGameStore((s) => s.tableView);
  const hasNotice = useGameStore((s) => s.notice !== null);

  if (state.status === 'none') {
    return <Navigate to={hasNotice ? '/' : `/join/${code ?? ''}`} replace />;
  }
  if (state.status === 'pending') {
    return (
      <AppShell wide>
        <p role="status" className="py-10 text-xl font-bold">
          Menyambung ke room…
        </p>
      </AppShell>
    );
  }

  const { room } = state;
  if (room.status !== 'lobby' && tableView) {
    return <TableBoard view={tableView} room={room} />;
  }

  const seated = SEAT_ORDER.filter((s) => room.seats[s]).length;
  return (
    <AppShell wide>
      <div className="grid flex-1 gap-8 py-4 md:grid-cols-[1fr_360px] md:items-center">
        <section aria-labelledby="table-title" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 id="table-title" className="text-4xl font-black tracking-tight">
              Meja
            </h1>
            <p className="text-lg font-semibold">
              {seated === 4 ? 'Semua pemain sudah duduk. Menunggu host memulai.' : `Menunggu ${4 - seated} pemain duduk.`}
            </p>
          </div>
          <SeatMap room={room} center={<span className="text-xl font-black">Meja gaple</span>} />
        </section>
        <RoomCode code={room.code} large />
      </div>
    </AppShell>
  );
}
