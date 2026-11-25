import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { Seat } from '@gaflex/shared';
import { SLAM_FLIGHT_MS, SLAM_IMPACT_T } from './curves';

const JOLT_MS = 140;
const JOLT_DEPTH = 0.14;

/**
 * Adds a brief vertical table recoil when a pushed ("cetas") tile lands on the table.
 * Shared by PlayerScene and TableScene.
 */
export function TableImpactGroup({
  lastPlayed,
  reduced,
  rotation,
  children,
}: {
  lastPlayed: { tileId: string; seat: Seat; slam: boolean; at: number } | null;
  reduced: boolean;
  rotation?: [number, number, number];
  children: ReactNode;
}) {
  const ref = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const jolt = useRef<{ impactAt: number } | null>(null);
  const seenAt = useRef<number | null>(null);

  useEffect(() => {
    if (!lastPlayed || lastPlayed.at === seenAt.current) return;
    seenAt.current = lastPlayed.at;
    if (!lastPlayed.slam || reduced) return;
    jolt.current = { impactAt: performance.now() + SLAM_FLIGHT_MS * SLAM_IMPACT_T };
    invalidate();
  }, [lastPlayed, reduced, invalidate]);

  useFrame(() => {
    const g = ref.current;
    const j = jolt.current;
    if (!g || !j) return;
    const now = performance.now();
    if (now < j.impactAt) {
      invalidate();
      return;
    }
    const p = Math.min(1, (now - j.impactAt) / JOLT_MS);
    g.position.y = -JOLT_DEPTH * Math.sin(Math.PI * p) * (1 - p);
    if (p < 1) {
      invalidate();
    } else {
      g.position.y = 0;
      jolt.current = null;
    }
  });

  return (
    <group ref={ref} rotation={rotation}>
      {children}
    </group>
  );
}
