import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ContactShadows } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { SEAT_ORDER, type Placed, type Seat, type Tile as TileData } from '@gaflex/shared';
import { CameraRig } from '../animations/PlayerCamera';
import { DealAnimation } from '../animations/DealAnimation';
import { SeatTile } from '../animations/SeatTile';
import { TableTile } from '../animations/TableTile';
import type { CameraMode } from '../animations/cameraRig';
import { DEAL_MS, seatEdge, type Vec3 } from '../animations/curves';
import { lastHandPose } from '../animations/handPose';
import { CHAIN_BOUNDS, layoutChain, TABLE_BOUNDS } from '../layout/layoutChain';
import { tableYaw } from '../layout/orientation';
import { seatRow } from '../layout/seatRow';

const RIM = 0.8;
const LIFT = 0.35; // legal tiles rise (docs/05)
const SWIPE_PX = 40;

/**
 * The player's screen (docs/06 PlayerScene): one table seen from the player's own chair.
 * Own tiles stand in a row in front of the camera, faces toward it; opponents' tiles stand at
 * their edges showing their backs; the chain lies in the middle. `camera` switches to Intip.
 */
export function PlayerScene({
  mySeat,
  hand,
  handCounts,
  chain,
  legalIds,
  myTurn,
  selectedId,
  round,
  lastPlayed,
  dealRound,
  camera,
  reduced,
  onPick,
}: {
  mySeat: Seat;
  hand: TileData[];
  handCounts: Record<Seat, number>;
  chain: Placed[];
  legalIds: Set<string>;
  myTurn: boolean;
  selectedId: string | null;
  round: number;
  lastPlayed: { tileId: string; seat: Seat } | null;
  dealRound: number | null;
  camera: CameraMode;
  reduced: boolean;
  onPick: (tile: TileData) => void;
}) {
  const laid = useMemo(() => layoutChain(chain, CHAIN_BOUNDS), [chain]);
  const enterStart = useRef<number | null>(null);
  const swipe = useRef<{ tile: TileData; y: number } | null>(null);
  const pickRef = useRef(onPick);

  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  // A new round deals new rows: they stand up once the deal has landed.
  const dealing = dealRound !== null && !reduced;
  useLayoutEffect(() => {
    enterStart.current = performance.now() + (dealing ? DEAL_MS : 0);
    // only a new round restarts the entrance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Swipe up on a lit tile plays it (docs/05).
  useEffect(() => {
    const up = (e: PointerEvent) => {
      const s = swipe.current;
      swipe.current = null;
      if (s && s.y - e.clientY > SWIPE_PX) pickRef.current(s.tile);
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const myRow = seatRow(mySeat, hand.length);

  /** Where the tile just played starts its flight: its place in the player's row. */
  const flyFrom = (tileId: string): Vec3 | null => {
    if (lastPlayed?.tileId !== tileId) return null;
    if (lastPlayed.seat === mySeat) {
      const p = lastHandPose.get(tileId);
      if (p) return [p.x, p.y, p.z];
    } else {
      const row = seatRow(lastPlayed.seat, handCounts[lastPlayed.seat] + 1);
      const last = row[row.length - 1];
      if (last) return last.position;
    }
    return seatEdge(lastPlayed.seat, TABLE_BOUNDS);
  };

  return (
    <Canvas dpr={[1, 2]} frameloop="demand" shadows={false} aria-label="Meja dari kursimu (3D)" style={{ touchAction: 'none' }}>
      <CameraRig mode={camera} reduced={reduced} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 14, 10]} intensity={1.5} />
      <hemisphereLight args={['#fff8e8', '#0a2e22', 0.35]} />
      <group rotation={[0, tableYaw(mySeat), 0]}>
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
          opacity={0.5}
          blur={1.8}
          far={3}
        />

        {laid.map((t) => (
          <TableTile key={t.id} laid={t} reduced={reduced} flyFrom={flyFrom(t.id)} />
        ))}

        {/* own row: faces toward the camera */}
        {hand.map((tile, i) => {
          const legal = legalIds.has(tile.id);
          return (
            <SeatTile
              key={tile.id}
              id={tile.id}
              slot={myRow[i]!}
              values={{ top: tile.a, bottom: tile.b }}
              lift={legal ? LIFT + (selectedId === tile.id ? 0.3 : 0) : 0}
              variant={legal ? 'glow' : myTurn ? 'dim' : 'normal'}
              index={i}
              enterStart={enterStart}
              reduced={reduced}
              onTap={() => legal && onPick(tile)}
              onSwipeStart={(y) => {
                swipe.current = legal ? { tile, y } : null;
              }}
            />
          );
        })}

        {/* opponents: backs only — their values never reach this device */}
        {SEAT_ORDER.filter((s) => s !== mySeat).map((seat) => {
          const row = seatRow(seat, handCounts[seat]);
          return row.map((slot, i) => (
            <SeatTile
              key={`${seat}-${i}`}
              id={`${seat}-${i}`}
              slot={slot}
              index={i}
              enterStart={enterStart}
              reduced={reduced}
            />
          ));
        })}

        {dealRound !== null && !reduced && <DealAnimation key={dealRound} bounds={TABLE_BOUNDS} />}
      </group>
    </Canvas>
  );
}
