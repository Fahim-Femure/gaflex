import { describe, expect, it } from 'vitest';
import type { PublicRoom } from '@gaflex/shared';
import { tallyText } from './tally';

const room = {
  seats: {
    N: { playerId: 'n', name: 'Ani', connected: true },
    E: { playerId: 'e', name: 'Budi', connected: true },
    S: { playerId: 's', name: 'Citra', connected: true },
    W: { playerId: 'w', name: 'Dedi', connected: true },
  },
} as unknown as PublicRoom;

describe('tallyText (games decided so far)', () => {
  it('team: games won as "Tim A 1 – 0 Tim B"', () => {
    expect(tallyText(room, 'team', { A: 1, B: 0 })).toBe('Tim A 1 – 0 Tim B');
  });

  it('solo: games lost per player', () => {
    expect(tallyText(room, 'solo', { N: 0, E: 2, S: 0, W: 1 })).toBe('Kalah: Ani 0 · Budi 2 · Citra 0 · Dedi 1');
  });

  it('missing keys count as 0', () => {
    expect(tallyText(room, 'team', {})).toBe('Tim A 0 – 0 Tim B');
  });
});
