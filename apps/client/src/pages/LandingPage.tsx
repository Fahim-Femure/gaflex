import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/ui/AppShell';
import { Button } from '../components/ui/Button';
import { LogoTiles } from '../components/ui/LogoTiles';
import { resumeSession } from '../lib/realtime';
import { useGameStore } from '../store/useGameStore';

const roomPath = (s: { code: string; role: string }) =>
  s.role === 'table' ? `/room/${s.code}/table` : `/room/${s.code}/lobby`;

export function LandingPage() {
  const navigate = useNavigate();
  const session = useGameStore((s) => s.session);
  const lastSession = useGameStore((s) => s.lastSession);
  const adoptLastSession = useGameStore((s) => s.adoptLastSession);

  const back = () => {
    if (session) return navigate(roomPath(session));
    const adopted = adoptLastSession();
    if (!adopted) return;
    void resumeSession();
    navigate(roomPath(adopted));
  };
  const resumable = session ?? lastSession;

  return (
    <AppShell>
      <section className="flex flex-1 flex-col justify-center gap-10 py-10">
        <div className="flex flex-col gap-4">
          <LogoTiles />
          <h1 className="text-7xl font-black leading-none tracking-tight">GAFLEX</h1>
          <p className="text-xl font-semibold leading-snug">
            Gaple double-six untuk 4 orang di satu meja. Tiap pemain pegang kartunya di HP sendiri.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate('/create')}>Buat Room</Button>
          <Button variant="secondary" onClick={() => navigate('/join')}>
            Gabung Room
          </Button>
          {resumable && (
            <Button variant="ghost" onClick={back}>
              Kembali ke room {resumable.code}
            </Button>
          )}
        </div>
      </section>
    </AppShell>
  );
}
