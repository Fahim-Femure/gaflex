import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { EVENTS, PLAYER_NAME_MAX, SCORE_LIMIT, sanitizeName, type DeviceSetup, type Mode, type SessionData } from '@gaflex/shared';
import { AppShell } from '../components/ui/AppShell';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { TextField } from '../components/ui/TextField';
import { errorMessage } from '../lib/errors';
import { request } from '../lib/socket';
import { useGameStore } from '../store/useGameStore';

export function CreatePage() {
  const navigate = useNavigate();
  const startSession = useGameStore((s) => s.startSession);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('solo');
  const [setup, setSetup] = useState<DeviceSetup>(4);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sanitizeName(name)) {
      setError('Isi nama kamu dulu.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await request<SessionData>(EVENTS.ROOM_CREATE, { name, mode, setup });
    setBusy(false);
    if (!res.ok) {
      setError(errorMessage(res.error));
      return;
    }
    startSession(res.data);
    navigate(`/room/${res.data.room.code}/lobby`);
  };

  return (
    <AppShell>
      <form onSubmit={submit} className="flex flex-col gap-7 py-6" noValidate>
        <h1 className="text-4xl font-black tracking-tight">Buat room</h1>
        <TextField
          label="Nama kamu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={PLAYER_NAME_MAX}
          autoComplete="nickname"
          enterKeyHint="next"
          placeholder="mis. Budi"
        />
        <Segmented<Mode>
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'solo', label: 'Solo', hint: '4 saling lawan' },
            { value: 'team', label: 'Tim', hint: 'Utara+Selatan vs Timur+Barat' },
          ]}
        />
        <Segmented<DeviceSetup>
          label="Jumlah device"
          value={setup}
          onChange={setSetup}
          options={[
            { value: 4, label: '4 device', hint: 'Meja dilihat lewat tombol Intip' },
            { value: 5, label: '5 device', hint: 'Device ke-5 jadi meja' },
          ]}
        />
        <p className="text-base font-semibold">
          Yang kalah tiap ronde mengumpulkan sisa titik kartunya. Lewat {SCORE_LIMIT} (mencapai {SCORE_LIMIT + 1}) = kalah
          satu game.
        </p>
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Membuat room…' : 'Buat Room'}
          </Button>
          <p role="alert" className="min-h-7 text-base font-bold text-pip-red-soft">
            {error}
          </p>
        </div>
      </form>
    </AppShell>
  );
}
