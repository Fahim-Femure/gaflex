import { useLayoutEffect, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { TableBounds } from '../layout/layoutChain';
import { TILE } from '../layout/layoutChain';
import { bodyMaterial } from '../models/materials';
import { DEAL_MS, dealPose } from './curves';

/**
 * Shuffle & deal at the start of a round (docs/05/06 useDealAnimation): 28 face-down tiles
 * spin in the centre, then 7 fly toward each seat; 1.2 s total, then the group hides.
 * Mount it with a key per round; it plays once on mount. Not rendered under reduced motion.
 */
export function DealAnimation({ bounds }: { bounds: TableBounds }) {
  const group = useRef<Group>(null);
  const start = useRef(0);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    start.current = performance.now();
    invalidate();
  }, [invalidate]);

  useFrame(() => {
    const g = group.current;
    if (!g || !g.visible) return;
    const t = Math.min(1, (performance.now() - start.current) / DEAL_MS);
    g.children.forEach((child, i) => {
      const pose = dealPose(i, t, bounds);
      child.position.set(...pose.position);
      child.rotation.set(Math.PI / 2, 0, pose.yaw); // face down
    });
    if (t < 1) invalidate();
    else g.visible = false;
  });

  return (
    <group ref={group}>
      {Array.from({ length: 28 }, (_, i) => (
        <RoundedBox key={i} args={[TILE.width, TILE.length, TILE.thickness]} radius={0.08} smoothness={2}>
          <primitive object={bodyMaterial('normal')} attach="material" />
        </RoundedBox>
      ))}
    </group>
  );
}
