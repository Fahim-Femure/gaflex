import { useEffect, useState } from 'react';
import { SKIP_AFTER_MS } from '@gaflex/shared';

/**
 * True once the player on turn has been offline SKIP_AFTER_MS, counted from when this device saw
 * it (the server enforces the real limit). `offlineSeat` is that seat while it is offline on its
 * turn, otherwise null.
 */
export function useSkipReady(offlineSeat: string | null): boolean {
  const [readySeat, setReadySeat] = useState<string | null>(null);

  useEffect(() => {
    if (offlineSeat === null) return;
    const timer = setTimeout(() => setReadySeat(offlineSeat), SKIP_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setReadySeat(null); // back online or turn moved on: the next outage waits again
    };
  }, [offlineSeat]);

  return offlineSeat !== null && readySeat === offlineSeat;
}
