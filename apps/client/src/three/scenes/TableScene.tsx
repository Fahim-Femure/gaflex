import { useLayoutEffect, useMemo, useRef } from 'react';
import { ContactShadows, OrthographicCamera } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MathUtils, type OrthographicCamera as OrthographicCameraImpl } from 'three';
import type { Placed, Seat } from '@gaflex/shared';
import type { LastPlayedMotion } from '../../hooks/useSceneMotion';
import { DealAnimation } from '../animations/DealAnimation';
import { TableImpactGroup } from '../animations/TableImpact';
import { TableTile } from '../animations/TableTile';
import { seatEdge } from '../animations/curves';
import { CHAIN_BOUNDS, layoutChain, type LaidTile } from '../layout/layoutChain';
import { tableYaw } from '../layout/orientation';
import { computeTableDisplayZoom, DISPLAY_RIM, TABLE_DISPLAY_BOUNDS } from '../layout/tableDisplayFraming';

const ZOOM_DAMP = 8;

/**
 * Pure overhead (90 deg straight down) orthographic camera that zooms closely around the active
 * chain so domino tiles appear large and legible on the Table Display.
 */
function TableCamera({
  laid,
  quarterTurn,
  reduced,
}: {
  laid: readonly LaidTile[];
  quarterTurn: boolean;
  reduced: boolean;
}) {
  const ref = useRef<OrthographicCameraImpl>(null);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const targetZoom = computeTableDisplayZoom(laid, size.width, size.height, quarterTurn);
  const curZoom = useRef(targetZoom);
  const lastSize = useRef<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const cam = ref.current;
    if (!cam) return;
    // Straight top-down along -Y requires up = [0, 0, -1] (North up) to avoid lookAt gimbal lock.
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    const snap =
      reduced || !lastSize.current || size.width !== lastSize.current.w || size.height !== lastSize.current.h;
    lastSize.current = { w: size.width, h: size.height };
    if (snap) {
      curZoom.current = targetZoom;
      cam.zoom = targetZoom;
      cam.updateProjectionMatrix();
    }
    invalidate();
  }, [targetZoom, size.width, size.height, reduced, invalidate]);

  useFrame((_, delta) => {
    const cam = ref.current;
    if (!cam || reduced) return;
    if (Math.abs(curZoom.current - targetZoom) <= 0.05) {
      if (curZoom.current !== targetZoom) {
        curZoom.current = targetZoom;
        cam.zoom = targetZoom;
        cam.updateProjectionMatrix();
      }
      return;
    }
    curZoom.current = MathUtils.lerp(curZoom.current, targetZoom, 1 - Math.exp(-ZOOM_DAMP * delta));
    cam.zoom = curZoom.current;
    cam.updateProjectionMatrix();
    invalidate();
  });

  return <OrthographicCamera ref={ref} makeDefault position={[0, 30, 0]} up={[0, 0, -1]} near={0.1} far={100} />;
}

/**
 * The table seen directly from above (docs/06 TableScene). `bottomSeat` is drawn nearest the
 * viewer (South on the Table Display).
 */
export function TableScene({
  chain,
  bottomSeat,
  lastPlayed,
  dealRound,
  reduced,
}: {
  chain: Placed[];
  bottomSeat: Seat;
  /** The tile that was just played and by whom; it flies in from that seat. */
  lastPlayed: LastPlayedMotion | null;
  /** Round number while a fresh deal is showing (empty table, full hands), else null. */
  dealRound: number | null;
  reduced: boolean;
}) {
  const laid = useMemo(() => layoutChain(chain, CHAIN_BOUNDS), [chain]);
  const yaw = tableYaw(bottomSeat);
  const quarterTurn = bottomSeat === 'E' || bottomSeat === 'W';

  return (
    <Canvas dpr={[1, 2]} frameloop="demand" aria-label="Meja (3D)">
      <TableCamera laid={laid} quarterTurn={quarterTurn} reduced={reduced} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 12, 6]} intensity={1.3} />
      <TableImpactGroup lastPlayed={lastPlayed} reduced={reduced} rotation={[0, yaw, 0]}>
        {/* wooden rim and felt fitted around the chain bounds */}
        <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry
            args={[2 * (TABLE_DISPLAY_BOUNDS.halfWidth + DISPLAY_RIM), 2 * (TABLE_DISPLAY_BOUNDS.halfDepth + DISPLAY_RIM)]}
          />
          <meshStandardMaterial color="#6b4423" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2 * TABLE_DISPLAY_BOUNDS.halfWidth, 2 * TABLE_DISPLAY_BOUNDS.halfDepth]} />
          <meshStandardMaterial color="#1c5c46" roughness={0.95} />
        </mesh>
        <ContactShadows
          position={[0, -0.04, 0]}
          scale={[2 * TABLE_DISPLAY_BOUNDS.halfWidth, 2 * TABLE_DISPLAY_BOUNDS.halfDepth]}
          opacity={0.45}
          blur={1.6}
          far={2}
        />
        {laid.map((t) => (
          <TableTile
            key={t.id}
            laid={t}
            reduced={reduced}
            flyFrom={lastPlayed?.tileId === t.id ? seatEdge(lastPlayed.seat, TABLE_DISPLAY_BOUNDS) : null}
            slam={lastPlayed?.tileId === t.id && lastPlayed.slam}
          />
        ))}
        {dealRound !== null && !reduced && <DealAnimation key={dealRound} bounds={TABLE_DISPLAY_BOUNDS} />}
      </TableImpactGroup>
    </Canvas>
  );
}
