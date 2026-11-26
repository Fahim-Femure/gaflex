import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAnimate, useReducedMotion } from 'motion/react';
import { EASE_OUT, UI } from '../lib/motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  EVENTS,
  PLAYER_NAME_MAX,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
  sanitizeName,
  type RoomPeek,
  type SessionData,
} from '@gaflex/shared';
import { AppShell } from '../components/ui/AppShell';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { errorMessage } from '../lib/errors';
import { request } from '../lib/socket';
import { useGameStore } from '../store/useGameStore';

export function JoinPage() {
  const params = useParams();
  const navigate = useNavigate();
  const startSession = useGameStore((s) => s.startSession);
  const session = useGameStore((s) => s.session);

  const [code, setCode] = useState(() => normalizeRoomCode(params.code ?? ''));
  const [name, setName] = useState('');
  const [peek, setPeek] = useState<RoomPeek | null>(null);
  const [codeError, setCodeError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scope, animate] = useAnimate<HTMLFormElement>();
  const codeBox = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Already in this room on this device: go straight back.
  useEffect(() => {
    if (session && session.code === code) {
      navigate(session.role === 'table' ? `/room/${code}/table` : `/room/${code}/lobby`, { replace: true });
    }
  }, [session, code, navigate]);

  useEffect(() => {
    if (!isValidRoomCode(code)) return;
    let cancelled = false;
    request<RoomPeek>(EVENTS.ROOM_PEEK, { code }).then((res) => {
      if (cancelled) return;
      if (res.ok) setPeek(res.data);
      else setCodeError(errorMessage(res.error));
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // docs/05: a wrong code shakes the field (300 ms); reduced motion relies on the message alone.
  useEffect(() => {
    if (!codeError || reduce || !codeBox.current) return;
    animate(
      codeBox.current,
      { transform: ['translateX(0px)', 'translateX(-10px)', 'translateX(10px)', 'translateX(-6px)', 'translateX(6px)', 'translateX(0px)'] },
      { duration: 0.3, ease: 'easeOut' },
    );
  }, [codeError, reduce, animate]);

  /** docs/05: a correct code scales the form out before the seat picker. */
  const leave = async () => {
    if (!scope.current) return;
    const exit = animate(
      scope.current,
      reduce ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.96)' },
      { duration: UI.fast, ease: EASE_OUT },
    );
    // Never let navigation wait on an animation: a background tab may not run frames at all.
    await Promise.race([exit, new Promise((r) => window.setTimeout(r, UI.fast * 1000 + 80))]);
  };

  const onCodeChange = (value: string) => {
    setCode(normalizeRoomCode(value));
    setPeek(null);
    setCodeError('');
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!sanitizeName(name)) {
      setError('Isi nama kamu dulu.');
      return;
    }
    setBusy(true);
    setError('');
    if (session && session.code !== code) useGameStore.getState().endSession();
    const res = await request<SessionData>(EVENTS.ROOM_JOIN, { code, name });
    setBusy(false);
    if (!res.ok) return setError(errorMessage(res.error));
    await leave();
    startSession(res.data);
    navigate(`/room/${code}/lobby`);
  };

  const joinAsTable = async () => {
    setBusy(true);
    setError('');
    if (session && session.code !== code) useGameStore.getState().endSession();
    const res = await request<SessionData>(EVENTS.ROOM_JOIN_TABLE, { code });
    setBusy(false);
    if (!res.ok) return setError(errorMessage(res.error));
    await leave();
    startSession(res.data);
    navigate(`/room/${code}/table`);
  };

  return (
    <AppShell>
      <form ref={scope} onSubmit={join} className="flex flex-col gap-7 py-6" noValidate>
        <h1 className="text-4xl font-black tracking-tight">Gabung room</h1>

        <div ref={codeBox} className="flex flex-col gap-2">
          <TextField
            label="Kode room"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            maxLength={ROOM_CODE_LENGTH}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="ABC234"
            aria-invalid={codeError ? true : undefined}
            className="text-center text-5xl font-black tracking-[0.12em] tabular-nums min-h-20"
          />
          <p role="status" className="min-h-7 text-base font-bold">
            {codeError ? (
              <span className="text-pip-red-soft">{codeError}</span>
            ) : peek ? (
              `Room ${peek.mode === 'team' ? 'Tim' : 'Solo'} · ${peek.setup} device · ${peek.freeSeats.length} kursi kosong`
            ) : code.length > 0 && code.length < ROOM_CODE_LENGTH ? (
              `${ROOM_CODE_LENGTH - code.length} karakter lagi`
            ) : (
              ''
            )}
          </p>
        </div>

        <TextField
          label="Nama kamu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={PLAYER_NAME_MAX}
          autoComplete="nickname"
          enterKeyHint="go"
          placeholder="mis. Citra"
        />

        <div className="flex flex-col gap-3">
          <Button type="submit" disabled={!peek || busy}>
            {busy ? 'Menghubungkan…' : 'Gabung & pilih kursi'}
          </Button>
          {peek?.setup === 5 && (
            <Button variant="secondary" disabled={!peek.tableAvailable || busy} onClick={joinAsTable}>
              {peek.tableAvailable ? 'Jadikan device ini Meja' : 'Meja sudah terhubung'}
            </Button>
          )}
          <p role="alert" className="min-h-7 text-base font-bold text-pip-red-soft">
            {error}
          </p>
        </div>
      </form>
    </AppShell>
  );
}
