import { unlockAudio } from '../../lib/sound';
import { useGameStore } from '../../store/useGameStore';
import { Button } from './Button';

/** Per-device mute for the "tak" of tiles landing. */
export function SoundToggle({ className = '' }: { className?: string }) {
  const muted = useGameStore((s) => s.muted);
  const toggle = useGameStore((s) => s.toggleMuted);
  return (
    <Button
      variant="secondary"
      aria-pressed={!muted}
      aria-label={muted ? 'Suara mati, ketuk untuk menyalakan' : 'Suara nyala, ketuk untuk mematikan'}
      className={`min-h-11 px-4 text-base ${muted ? 'line-through opacity-70' : ''} ${className}`}
      onClick={() => {
        unlockAudio();
        toggle();
      }}
    >
      Suara
    </Button>
  );
}
