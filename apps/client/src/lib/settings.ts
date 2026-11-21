import { deviceStorage } from './session';

const MUTED_KEY = 'gaflex:muted';

/** Per-device sound preference (a convenience: losing it only turns sound back on). */
export function loadMuted(storage: Storage | null = deviceStorage()): boolean {
  try {
    return storage?.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean, storage: Storage | null = deviceStorage()): void {
  try {
    storage?.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // blocked storage: the choice lasts until reload
  }
}
