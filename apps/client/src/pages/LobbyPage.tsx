import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { EVENTS, SCORE_LIMIT, SEAT_ORDER, type Seat } from '@gaflex/shared';
import { RoomCode } from '../components/lobby/RoomCode';
import { SeatMap } from '../components/lobby/SeatMap';
import { AppShell } from '../components/ui/AppShell';
import { Button } from '../components/ui/Button';
import { errorMessage } from '../lib/errors';
import { request } from '../lib/socket';
import { useRoomSession } from '../hooks/useRoomSession';
import { leaveRoom, leftRoom } from '../lib/leave';
import { useGameStore } from '../store/useGameStore';

export function LobbyPage() {
  const { code } = useParams();
  const state = useRoomSession(code, 'player');
  const [busySeat, setBusySeat] = useState<Seat | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  // Leaving the lobby any way (logo, Back, "Keluar room") frees the slot at once, so the
  // room does not stay "full" with someone who has gone. Moving on to the game does not.
  useEffect(() => {
    return () => {
      const session = useGameStore.getState().session;
      if (code && session?.code === code && leftRoom(window.location.pathname, code)) void leaveRoom();
    };
  }, [code]);

  if (state.status === 'none') return <Navigate to={`/join/${code ?? ''}`} replace />;
  if (state.status === 'pending') {
    return (
      <AppShell>
        <p role="status" className="py-10 text-xl font-bold">
          Menyambung ke room…
        </p>
      </AppShell>
    );
  }

  const { room, session } = state;
  if (room.status !== 'lobby') return <Navigate to={`/room/${room.code}/play`} replace />;
  const mySeat = SEAT_ORDER.find((s) => room.seats[s]?.playerId === session.memberId) ?? null;
  const seated = SEAT_ORDER.filter((s) => room.seats[s]).length;
  const isHost = room.hostId === session.memberId;
  const tableReady = room.setup === 4 || room.tableConnected;
  const ready = seated === 4 && tableReady;

  const pick = async (seat: Seat) => {
    setBusySeat(seat);
    setError('');
    const res = await request(EVENTS.SEAT_TAKE, { seat });
    setBusySeat(null);
    if (!res.ok) setError(errorMessage(res.error));
  };

  const startGame = async () => {
    setStarting(true);
    setError('');
    const res = await request(EVENTS.GAME_START, {});
    setStarting(false);
    if (!res.ok) setError(errorMessage(res.error));
  };

  const leave = async () => {
    setError('');
    const res = await request(EVENTS.SEAT_LEAVE, {});
    if (!res.ok) setError(errorMessage(res.error));
  };

  return (
    <AppShell wide>
      <div className="grid gap-8 py-4 md:grid-cols-[1fr_320px] md:items-start">
        <section aria-labelledby="lobby-title" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 id="lobby-title" className="text-4xl font-black tracking-tight">
              {mySeat ? 'Tunggu pemain lain' : 'Pilih kursi'}
            </h1>
            <p className="text-lg font-semibold">
              {room.mode === 'team' ? 'Mode Tim' : 'Mode Solo'} · {room.setup} device · kalah bila titik lewat{' '}
              {SCORE_LIMIT}.{' '}
              {mySeat ? 'Kursimu sesuai tempat dudukmu di meja.' : 'Pilih kursi sesuai posisi dudukmu di meja nyata.'}
            </p>
          </div>

          <SeatMap
            room={room}
            myId={session.memberId}
            onPick={pick}
            busySeat={busySeat}
            center={
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-black tabular-nums">{seated}/4</span>
                <span className="text-sm font-bold">kursi terisi</span>
              </div>
            }
          />

          <p role="alert" className="min-h-7 text-base font-bold text-pip-red-soft">
            {error}
          </p>

          <ul className="flex flex-col gap-1 text-lg font-semibold">
            {room.setup === 5 && (
              <li>{room.tableConnected ? 'Device meja terhubung.' : 'Menunggu device meja bergabung.'}</li>
            )}
            <li>{seated === 4 ? 'Semua kursi terisi.' : `Menunggu ${4 - seated} pemain lagi.`}</li>
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row">
            {isHost ? (
              <Button disabled={!ready || starting} onClick={startGame} aria-describedby="start-hint" className="sm:flex-1">
                {starting ? 'Membagi kartu…' : 'Mulai'}
              </Button>
            ) : null}
            {mySeat && (
              <Button variant="secondary" onClick={leave} className="sm:flex-1">
                Tinggalkan kursi
              </Button>
            )}
            {/* the unmount cleanup above tells the server and forgets the session */}
            <Button variant="ghost" onClick={() => navigate('/')} className="sm:flex-1">
              Keluar room
            </Button>
          </div>
          <p id="start-hint" className="text-base font-semibold">
            {isHost
              ? ready
                ? 'Semua siap. Tekan Mulai untuk membagi kartu.'
                : 'Tombol Mulai aktif saat 4 kursi terisi' + (room.setup === 5 ? ' dan meja terhubung.' : '.')
              : 'Host akan memulai permainan.'}
          </p>
        </section>

        <RoomCode code={room.code} />
      </div>
    </AppShell>
  );
}
