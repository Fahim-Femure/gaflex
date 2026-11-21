import { describe, expect, it } from 'vitest';
import { CAMERA_FOV, CAMERA_MS, cameraPose, cameraPreset } from './cameraRig';
import { TABLE_BOUNDS } from '../layout/layoutChain';

const landscape = 812 / 375; // the play screen is held landscape
const portrait = 375 / 600;
const tanHalf = Math.tan((CAMERA_FOV * Math.PI) / 360);

describe('cameraPreset', () => {
  it('POV sits behind the player\'s own edge (+Z), low, looking across the table', () => {
    const pov = cameraPreset('pov', landscape);
    expect(pov.position[2]).toBeGreaterThan(TABLE_BOUNDS.halfDepth);
    expect(pov.target[2]).toBeLessThan(pov.position[2]);
    const dz = pov.position[2] - pov.target[2];
    expect(pov.position[1]).toBeLessThan(dz); // low angle, like sitting at the table
  });

  for (const [name, aspect] of [
    ['landscape', landscape],
    ['portrait fallback', portrait],
  ] as const) {
    it(`POV keeps the whole own row of 7 tiles in frame (${name})`, () => {
      const pov = cameraPreset('pov', aspect);
      const rowZ = TABLE_BOUNDS.halfDepth - 1.2;
      const dist = Math.hypot(pov.position[2] - rowZ, pov.position[1] - 1);
      expect(dist * tanHalf * aspect).toBeGreaterThan(7 * 0.6);
    });

    it(`Intip shows the whole table from above (${name})`, () => {
      const peek = cameraPreset('peek', aspect);
      const h = peek.position[1];
      expect(h * tanHalf).toBeGreaterThan(TABLE_BOUNDS.halfDepth);
      expect(h * tanHalf * aspect).toBeGreaterThan(TABLE_BOUNDS.halfWidth);
      expect(Math.abs(peek.target[0]) + Math.abs(peek.target[2])).toBeLessThan(1);
    });
  }

  it('Intip is well above the POV', () => {
    expect(cameraPreset('peek', landscape).position[1]).toBeGreaterThan(cameraPreset('pov', landscape).position[1] * 1.5);
  });
});

describe('cameraPose (docs/05: 900 ms ease-in-out between presets)', () => {
  it('takes 900 ms', () => {
    expect(CAMERA_MS).toBe(900);
  });

  it('interpolates from the current pose to the preset, eased', () => {
    const from = cameraPreset('pov', landscape);
    const to = cameraPreset('peek', landscape);
    expect(cameraPose(from, to, 0)).toEqual(from);
    expect(cameraPose(from, to, 1)).toEqual(to);
    const early = cameraPose(from, to, 0.1).position[1];
    const linearEarly = from.position[1] + (to.position[1] - from.position[1]) * 0.1;
    expect(early).toBeLessThan(linearEarly); // ease-in-out starts gently
  });
});
