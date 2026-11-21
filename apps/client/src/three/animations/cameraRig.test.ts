import { describe, expect, it } from 'vitest';
import { SEAT_ORDER } from '@gaflex/shared';
import { CAMERA_FOV, CAMERA_MS, cameraPose, cameraPreset, projectPoint, viewFrame } from './cameraRig';
import { TABLE_BOUNDS, TILE } from '../layout/layoutChain';
import { seatRow } from '../layout/seatRow';
import { tableYaw } from '../layout/orientation';
import type { Vec3 } from './curves';

const landscape = 812 / 375; // the play screen is held landscape
const portrait = 375 / 600;
const tanHalf = Math.tan((CAMERA_FOV * Math.PI) / 360);

/** Phones (19.5:9, 844×390) and iPads (1180×820, with Safari bars, 4:3). */
const SCREENS = [
  ['phone 19.5:9', 2.4],
  ['phone 844×390', 844 / 390],
  ['iPad with browser bars', 1180 / 740],
  ['iPad 1180×820', 1180 / 820],
  ['iPad 4:3', 4 / 3],
] as const;

/** A seat-frame point rotated the way PlayerScene rotates the table (player's seat at +Z). */
function toViewFrame(p: Vec3, yaw: number): Vec3 {
  const [x, y, z] = p;
  return [x * Math.cos(yaw) + z * Math.sin(yaw), y, -x * Math.sin(yaw) + z * Math.cos(yaw)];
}

const MAX_LIFT = 0.65; // the tile picked for a two-end choice rises this much

describe('cameraPreset POV keeps the own row of 7 tiles fully on screen', () => {
  for (const seat of SEAT_ORDER) {
    for (const [name, aspect] of SCREENS) {
      it(`seat ${seat}, ${name}`, () => {
        const pov = cameraPreset('pov', aspect, seat);
        const yaw = tableYaw(seat);
        for (const tile of seatRow(seat, 7)) {
          const [cx, , cz] = toViewFrame(tile.position, yaw);
          for (const dx of [-TILE.width / 2, TILE.width / 2]) {
            for (const dz of [-TILE.thickness / 2, TILE.thickness / 2]) {
              for (const y of [0, TILE.length + MAX_LIFT]) {
                const [nx, ny] = projectPoint(pov, aspect, [cx + dx, y, cz + dz]);
                expect(Math.abs(nx)).toBeLessThanOrEqual(0.95);
                expect(ny).toBeGreaterThanOrEqual(-0.9); // above the bottom edge (error toast lives there)
                expect(ny).toBeLessThanOrEqual(1);
              }
            }
          }
        }
      });
    }
  }

  for (const seat of SEAT_ORDER) {
    for (const [name, aspect] of SCREENS) {
      it(`seat ${seat}, ${name}: the opposite row stays below the top HUD`, () => {
        const pov = cameraPreset('pov', aspect, seat);
        const far = viewFrame(seat).rowZ;
        const [, ny] = projectPoint(pov, aspect, [0, TILE.length, -far]);
        expect(ny).toBeLessThan(0.75);
        expect(ny).toBeGreaterThan(-0.2);
      });
    }
  }
});

describe('cameraPreset POV shape', () => {
  it("sits behind the player's own edge (+Z), low, looking across the table", () => {
    for (const seat of SEAT_ORDER) {
      const pov = cameraPreset('pov', landscape, seat);
      expect(pov.position[2]).toBeGreaterThan(viewFrame(seat).halfDepth);
      expect(pov.target[2]).toBeLessThan(pov.position[2]);
      const dz = pov.position[2] - pov.target[2];
      expect(pov.position[1]).toBeLessThan(dz); // low angle, like sitting at the table
    }
  });

  it('South and North frame the table the same way; East and West the same way', () => {
    expect(cameraPreset('pov', landscape, 'N')).toEqual(cameraPreset('pov', landscape, 'S'));
    expect(cameraPreset('pov', landscape, 'E')).toEqual(cameraPreset('pov', landscape, 'W'));
  });

  it('East/West sit further back than South/North (their own edge is the far one)', () => {
    expect(cameraPreset('pov', landscape, 'E').position[2]).toBeGreaterThan(cameraPreset('pov', landscape, 'S').position[2]);
  });
});

describe('viewFrame (the table seen with the player at the bottom)', () => {
  it('South/North look along the short side, East/West along the long side', () => {
    expect(viewFrame('S')).toEqual({ rowZ: TABLE_BOUNDS.halfDepth - 1.2, halfWidth: 10, halfDepth: 8 });
    expect(viewFrame('E')).toEqual({ rowZ: TABLE_BOUNDS.halfWidth - 1.2, halfWidth: 8, halfDepth: 10 });
  });
});

describe('cameraPreset Intip', () => {
  for (const seat of SEAT_ORDER) {
    for (const [name, aspect] of [...SCREENS, ['portrait fallback', portrait] as const]) {
      it(`shows the whole table from above (seat ${seat}, ${name})`, () => {
        const peek = cameraPreset('peek', aspect, seat);
        const { halfWidth, halfDepth } = viewFrame(seat);
        const h = peek.position[1];
        expect(h * tanHalf).toBeGreaterThan(halfDepth);
        expect(h * tanHalf * aspect).toBeGreaterThan(halfWidth);
        expect(Math.abs(peek.target[0]) + Math.abs(peek.target[2])).toBeLessThan(1);
      });
    }
  }

  it('is well above the POV', () => {
    expect(cameraPreset('peek', landscape, 'S').position[1]).toBeGreaterThan(
      cameraPreset('pov', landscape, 'S').position[1] * 1.5,
    );
  });
});

describe('projectPoint', () => {
  it('puts the look-at target in the middle of the screen', () => {
    const pov = cameraPreset('pov', landscape, 'S');
    const [x, y] = projectPoint(pov, landscape, pov.target);
    expect(Math.abs(x)).toBeLessThan(1e-9);
    expect(Math.abs(y)).toBeLessThan(1e-9);
  });
});

describe('cameraPose (docs/05: 900 ms ease-in-out between presets)', () => {
  it('takes 900 ms', () => {
    expect(CAMERA_MS).toBe(900);
  });

  it('interpolates from the current pose to the preset, eased', () => {
    const from = cameraPreset('pov', landscape, 'S');
    const to = cameraPreset('peek', landscape, 'S');
    expect(cameraPose(from, to, 0)).toEqual(from);
    expect(cameraPose(from, to, 1)).toEqual(to);
    const early = cameraPose(from, to, 0.1).position[1];
    const linearEarly = from.position[1] + (to.position[1] - from.position[1]) * 0.1;
    expect(early).toBeLessThan(linearEarly); // ease-in-out starts gently
  });
});
