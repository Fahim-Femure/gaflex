import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Quaternion, type Group } from 'three';
import type { LaidTile } from '../layout/layoutChain';
import { Tile } from '../models/Tile';
import { FLIGHT_MS, SLAM_FLIGHT_MS, flightPose, type Vec3 } from './curves';

const REDUCED_MS = 160;
const REDUCED_SLAM_MS = 110;

/**
 * A chain tile. When it is the tile just played, it flies in from the player's seat
 * (docs/05: slides from the seat, turns to its orientation, lands with a small bounce).
 * When `slam` is true (pushed forward), it accelerates down with a firmer impact.
 * Reduced motion: no travel or spin, only a short settle in place.
 */
export function TableTile({
  laid,
  flyFrom,
  slam = false,
  reduced,
}: {
  laid: LaidTile;
  flyFrom: Vec3 | null;
  slam?: boolean;
  reduced: boolean;
}) {
  const ref = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{ start: number; from: Vec3 | null; slam: boolean } | null>(null);
  const qTo = useMemo(() => new Quaternion().setFromEuler(new Euler(...laid.rotation)), [laid.rotation]);
  const qFrom = useMemo(
    () => new Quaternion().setFromEuler(new Euler(laid.rotation[0], laid.rotation[1], laid.rotation[2] + Math.PI / 2)),
    [laid.rotation],
  );

  // Decide once, on mount, whether this tile arrives with a flight.
  useLayoutEffect(() => {
    if (flyFrom) {
      anim.current = { start: performance.now(), from: reduced ? null : flyFrom, slam };
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
      const t = Math.min(1, elapsed / (a.slam ? REDUCED_SLAM_MS : REDUCED_MS));
      const base = a.slam ? 0.92 : 0.96;
      g.scale.setScalar(base + (1 - base) * t);
      if (t < 1) invalidate();
      else anim.current = null;
      return;
    }
    const duration = a.slam ? SLAM_FLIGHT_MS : FLIGHT_MS;
    const t = Math.min(1, elapsed / duration);
    const pose = flightPose(a.from, laid.position, t, a.slam);
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
