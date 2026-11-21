import { Navigate, useParams } from 'react-router-dom';
import { SCORE_LIMIT, SEAT_ORDER, type PublicRoom, type Seat, type TableView } from '@gaflex/shared';
import { RoomCode } from '../components/lobby/RoomCode';
import { SeatMap } from '../components/lobby/SeatMap';
import { ChainView } from '../components/table/ChainView';
import { ResultPanel } from '../components/table/ResultPanel';
import { AppShell } from '../components/ui/AppShell';
import { usePassBadge } from '../hooks/usePassBadge';
import { useRoomSession } from '../hooks/useRoomSession';
import { scoreLabel, seatName } from '../lib/names';
import { tallyText } from '../lib/tally';
import { useGameStore } from '../store/useGameStore';
import { useSceneMotion } from '../hooks/useSceneMotion';
import { SceneBoundary } from '../components/table/SceneBoundary';
import { SeatStatus } from '../components/table/SeatStatus';
import { SoundToggle } from '../components/ui/SoundToggle';
import { TableScene } from '../three/scenes';

const AREA: Record<Seat, string> = {
  N: 'col-start-2 row-start-1',
  W: 'col-start-1 row-start-2',
  E: 'col-start-3 row-start-2',
  S: 'col-start-2 row-start-3',
};

/** Live 2D table for device 5 (3D in Phase 4). South sits at the bottom. */
function TableBoard({ view, room }: { view: TableView; room: PublicRoom }) {
  const passSeat = usePassBadge();
  const motion = useSceneMotion(view);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-black tracking-tight">Ronde {view.round}</h1>
        <SoundToggle />
        <p className="w-full text-lg font-bold">
          {Object.entries(view.scores)
            .map(([k, v]) => `${scoreLabel(room, k)}: ${v}`)
            .join(' · ')}{' '}
          / {SCORE_LIMIT}
        </p>
        <p className="w-full text-base font-semibold">{tallyText(room, room.mode, view.tally)}</p>
      </div>
      <div className="grid grid-cols-[minmax(7rem,1fr)_minmax(0,4fr)_minmax(7rem,1fr)] grid-rows-[auto_1fr_auto] gap-3">
        <div className="col-start-2 row-start-2 flex flex-col gap-2">
          <div className="h-[58dvh] min-h-72 overflow-hidden rounded-[28px] bg-felt-deep">
            <SceneBoundary fallback={<ChainView chain={view.chain} ends={view.ends} size="md" />}>
              <TableScene
                chain={view.chain}
                bottomSeat="S"
                lastPlayed={motion.lastPlayed}
                dealRound={motion.dealRound}
                reduced={motion.reduced}
              />
            </SceneBoundary>
          </div>
          <p className="text-center text-lg font-bold">
            {view.ends ? `Ujung kiri ${view.ends[0]} · ujung kanan ${view.ends[1]}` : 'Meja masih kosong'}
          </p>
        </div>
        {SEAT_ORDER.map((seat) => {
          const isTurn = view.status === 'playing' && view.turn === seat;
          return (
            <SeatStatus
              key={seat}
              className={AREA[seat]}
              large
              name={seatName(room, seat)}
              count={view.handCounts[seat]}
              isTurn={isTurn}
              passed={passSeat === seat}
              offline={room.seats[seat]?.connected === false}
            />
          );
        })}
      </div>
      {(view.status === 'round_end' || view.status === 'game_end') && (
        <ResultPanel view={view} room={room} isHost={false} celebrate />
      )}
    </div>
  );
}

/** Table Display (device 5). Read-only. */
export function TablePage() {
  const { code } = useParams();
  const state = useRoomSession(code, 'table');
  const tableView = useGameStore((s) => s.tableView);

  if (state.status === 'none') return <Navigate to={`/join/${code ?? ''}`} replace />;
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
    return (
      <AppShell wide>
        <TableBoard view={tableView} room={room} />
      </AppShell>
    );
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
