import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_TARGET_SCORE, EVENTS, PLAYER_NAME_MAX, sanitizeName, type DeviceSetup, type Mode, type SessionData } from '@gaflex/shared';
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
  const [targetScore, setTargetScore] = useState<number>(DEFAULT_TARGET_SCORE);
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
    const res = await request<SessionData>(EVENTS.ROOM_CREATE, { name, mode, setup, targetScore });
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
            { value: 4, label: '4 device', hint: 'Meja dilihat lewat tombol View' },
            { value: 5, label: '5 device', hint: 'Device ke-5 jadi meja' },
          ]}
        />
        <Segmented<number>
          label="Target skor"
          value={targetScore}
          onChange={setTargetScore}
          options={[50, 100, 150].map((v) => ({ value: v, label: String(v) }))}
        />
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
