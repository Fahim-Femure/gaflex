import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Quaternion, type Group } from 'three';
import type { LaidTile } from '../layout/layoutChain';
import { Tile } from '../models/Tile';
import { FLIGHT_MS, flightPose, type Vec3 } from './curves';

const REDUCED_MS = 160;

/**
 * A chain tile. When it is the tile just played, it flies in from the player's seat
 * (docs/05: slides from the seat, turns to its orientation, lands with a small bounce).
 * Reduced motion: no travel or spin, only a short settle in place.
 */
export function TableTile({ laid, flyFrom, reduced }: { laid: LaidTile; flyFrom: Vec3 | null; reduced: boolean }) {
  const ref = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{ start: number; from: Vec3 | null } | null>(null);
  const qTo = useMemo(() => new Quaternion().setFromEuler(new Euler(...laid.rotation)), [laid.rotation]);
  const qFrom = useMemo(
    () => new Quaternion().setFromEuler(new Euler(laid.rotation[0], laid.rotation[1], laid.rotation[2] + Math.PI / 2)),
    [laid.rotation],
  );

  // Decide once, on mount, whether this tile arrives with a flight.
  useLayoutEffect(() => {
    if (flyFrom) {
      anim.current = { start: performance.now(), from: reduced ? null : flyFrom };
      invalidate();
    }
    // mount only: later prop changes must not replay the flight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const g = ref.current;
    const a = anim.current;
    if (!g || !a) return;
    const elapsed = performance.now() - a.start;
    if (!a.from) {
      const t = Math.min(1, elapsed / REDUCED_MS);
      g.scale.setScalar(0.96 + 0.04 * t);
      if (t < 1) invalidate();
      else anim.current = null;
      return;
    }
    const t = Math.min(1, elapsed / FLIGHT_MS);
    const pose = flightPose(a.from, laid.position, t);
    g.position.set(...pose.position);
    g.quaternion.slerpQuaternions(qFrom, qTo, pose.spin);
    if (t < 1) {
      invalidate();
    } else {
      g.position.set(...laid.position);
      g.quaternion.copy(qTo);
      anim.current = null;
    }
  });

  return (
    <group ref={ref} position={laid.position} rotation={laid.rotation}>
      <Tile top={laid.top} bottom={laid.bottom} />
    </group>
  );
}
