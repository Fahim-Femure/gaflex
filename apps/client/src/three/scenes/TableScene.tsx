import { useLayoutEffect, useMemo, useRef } from 'react';
import { ContactShadows, OrthographicCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import type { OrthographicCamera as OrthographicCameraImpl } from 'three';
import type { Placed, Seat } from '@gaflex/shared';
import { DealAnimation } from '../animations/DealAnimation';
import { TableTile } from '../animations/TableTile';
import { seatEdge } from '../animations/curves';
import { CHAIN_BOUNDS, layoutChain, TABLE_BOUNDS } from '../layout/layoutChain';
import { tableYaw } from '../layout/orientation';

const RIM = 0.8;

/** Orthographic-like top view, slightly tilted, zoomed to fit the canvas. */
function TableCamera({ quarterTurn }: { quarterTurn: boolean }) {
  const ref = useRef<OrthographicCameraImpl>(null);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  // After a quarter turn the table's long side runs up the screen.
  const w = 2 * ((quarterTurn ? TABLE_BOUNDS.halfDepth : TABLE_BOUNDS.halfWidth) + RIM);
  const d = 2 * ((quarterTurn ? TABLE_BOUNDS.halfWidth : TABLE_BOUNDS.halfDepth) + RIM);
  const zoom = Math.min(size.width / w, size.height / (d * 0.96)) * 0.98;

  useLayoutEffect(() => {
    ref.current?.lookAt(0, 0, 0);
    invalidate();
  }, [zoom, invalidate]);

  return <OrthographicCamera ref={ref} makeDefault position={[0, 30, 9]} zoom={zoom} near={0.1} far={100} />;
}

/**
 * The table seen from above (docs/06 TableScene). `bottomSeat` is drawn nearest the viewer:
 * the player's own seat on their phone, South on the Table Display.
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
  lastPlayed: { tileId: string; seat: Seat } | null;
  /** Round number while a fresh deal is showing (empty table, full hands), else null. */
  dealRound: number | null;
  reduced: boolean;
}) {
  const laid = useMemo(() => layoutChain(chain, CHAIN_BOUNDS), [chain]);
  const yaw = tableYaw(bottomSeat);
  const quarterTurn = bottomSeat === 'E' || bottomSeat === 'W';

  return (
    <Canvas dpr={[1, 2]} frameloop="demand" aria-label="Meja (3D)">
      <TableCamera quarterTurn={quarterTurn} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 12, 6]} intensity={1.3} />
      <group rotation={[0, yaw, 0]}>
        {/* wooden rim and felt */}
        <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2 * (TABLE_BOUNDS.halfWidth + RIM), 2 * (TABLE_BOUNDS.halfDepth + RIM)]} />
          <meshStandardMaterial color="#6b4423" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2 * TABLE_BOUNDS.halfWidth, 2 * TABLE_BOUNDS.halfDepth]} />
          <meshStandardMaterial color="#1c5c46" roughness={0.95} />
        </mesh>
        <ContactShadows
          position={[0, -0.04, 0]}
          scale={[2 * TABLE_BOUNDS.halfWidth, 2 * TABLE_BOUNDS.halfDepth]}
          opacity={0.45}
          blur={1.6}
          far={2}
        />
        {laid.map((t) => (
          <TableTile
            key={t.id}
            laid={t}
            reduced={reduced}
            flyFrom={lastPlayed?.tileId === t.id ? seatEdge(lastPlayed.seat, TABLE_BOUNDS) : null}
          />
        ))}
        {dealRound !== null && !reduced && <DealAnimation key={dealRound} bounds={TABLE_BOUNDS} />}
      </group>
    </Canvas>
  );
}
