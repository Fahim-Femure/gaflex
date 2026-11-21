import { describe, expect, it } from 'vitest';
import { leftRoom } from './leave';

describe('leftRoom (did navigating away from the lobby leave the room?)', () => {
  it('going to the landing page, create or join leaves', () => {
    expect(leftRoom('/', 'ABC234')).toBe(true);
    expect(leftRoom('/create', 'ABC234')).toBe(true);
    expect(leftRoom('/join/ABC234', 'ABC234')).toBe(true);
  });

  it('moving on to the game screens of the same room does not', () => {
    expect(leftRoom('/room/ABC234/play', 'ABC234')).toBe(false);
    expect(leftRoom('/room/ABC234/table', 'ABC234')).toBe(false);
    expect(leftRoom('/room/ABC234/lobby', 'ABC234')).toBe(false);
  });

  it('another room counts as leaving', () => {
    expect(leftRoom('/room/XYZ789/lobby', 'ABC234')).toBe(true);
  });
});
