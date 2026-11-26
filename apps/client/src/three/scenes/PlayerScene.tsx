import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { ContactShadows } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { SEAT_ORDER, type Placed, type Seat, type Side, type Tile as TileData } from '@gaflex/shared';
import type { LastPlayedMotion } from '../../hooks/useSceneMotion';
import { CameraRig } from '../animations/PlayerCamera';
import { DealAnimation } from '../animations/DealAnimation';
import { SeatTile, type TileDragState } from '../animations/SeatTile';
import { TableImpactGroup } from '../animations/TableImpact';
import { TableTile } from '../animations/TableTile';
import type { CameraMode } from '../animations/cameraRig';
import { DEAL_MS, seatEdge, type Vec3 } from '../animations/curves';
import { lastHandPose } from '../animations/handPose';
import { unlockAudio } from '../../lib/sound';
import type { EndOption } from '../layout/endChoice';
import { CHAIN_BOUNDS, layoutChain, TABLE_BOUNDS } from '../layout/layoutChain';
import { tableYaw } from '../layout/orientation';
import { seatRow } from '../layout/seatRow';
import { endTargetGeometry, endTargetMaterial } from '../models/materials';

const RIM = 0.8;
const LIFT = 0.35; // the tile picked for a two-end choice rises (docs/05)
const PUSH_THRESHOLD_PX = 22;

/** Exposes R3F's on-demand `invalidate` to window pointer listeners outside the Canvas. */
function CanvasBridge({ invalidateRef }: { invalidateRef: MutableRefObject<(() => void) | null> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidateRef.current = invalidate;
    return () => {
      invalidateRef.current = null;
    };
  }, [invalidate, invalidateRef]);
  return null;
}

/**
 * The player's screen (docs/06 PlayerScene): one table seen from the player's own chair.
 * Own tiles stand in a row in front of the camera, faces toward it; opponents' tiles stand at
 * their edges showing their backs; the chain lies in the middle. `camera` switches to Intip.
 * Tapping a tile plays normally; pushing it forward plays with a "cetas" slam.
 */
export function PlayerScene({
  mySeat,
  hand,
  handCounts,
  chain,
  selectedId,
  round,
  lastPlayed,
  dealRound,
  camera,
  peekZoom = 1,
  endTargets = null,
  reduced,
  onPick,
  onPickSide,
}: {
  mySeat: Seat;
  hand: TileData[];
  handCounts: Record<Seat, number>;
  chain: Placed[];
  selectedId: string | null;
  round: number;
  lastPlayed: LastPlayedMotion | null;
  dealRound: number | null;
  camera: CameraMode;
  peekZoom?: number;
  endTargets?: readonly EndOption[] | null;
  reduced: boolean;
  onPick: (tile: TileData, slam: boolean) => void;
  onPickSide?: (side: Side) => void;
}) {
  const laid = useMemo(() => layoutChain(chain, CHAIN_BOUNDS), [chain]);
  const enterStart = useRef<number | null>(null);
  const dragRef = useRef<TileDragState>(null);
  const lastSlamAt = useRef(0);
  const invalidateRef = useRef<(() => void) | null>(null);
  const pickRef = useRef(onPick);

  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    invalidateRef.current?.();
  }, [endTargets]);

  // A new round deals new rows: they stand up once the deal has landed.
  const dealing = dealRound !== null && !reduced;
  useLayoutEffect(() => {
    enterStart.current = performance.now() + (dealing ? DEAL_MS : 0);
    // only a new round restarts the entrance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Push-forward gesture: lean the tile as the pointer moves up, release past threshold to slam it.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dy = d.startY - e.clientY;
      const nextPush = Math.min(1, Math.max(0, dy / PUSH_THRESHOLD_PX));
      if (Math.abs(nextPush - d.push) > 0.001) {
        d.push = nextPush;
        invalidateRef.current?.();
      }
    };
    const end = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      invalidateRef.current?.();
      if (e.type === 'pointerup') {
        const dy = d.startY - e.clientY;
        const dx = Math.abs(e.clientX - d.startX);
        if (dy >= PUSH_THRESHOLD_PX && dy > dx * 0.6) {
          unlockAudio();
          lastSlamAt.current = performance.now();
          pickRef.current(d.tile, true);
        }
      }
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  const wasRecentSlam = () => performance.now() - lastSlamAt.current < 160;
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
      <CanvasBridge invalidateRef={invalidateRef} />
      <CameraRig mode={camera} reduced={reduced} seat={mySeat} peekZoom={peekZoom} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 14, 10]} intensity={1.5} />
      <hemisphereLight args={['#fff8e8', '#0a2e22', 0.35]} />
      <TableImpactGroup lastPlayed={lastPlayed} reduced={reduced} rotation={[0, tableYaw(mySeat), 0]}>
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
          <TableTile
            key={t.id}
            laid={t}
            reduced={reduced}
            flyFrom={flyFrom(t.id)}
            slam={lastPlayed?.tileId === t.id && lastPlayed.slam}
          />
        ))}

        {/* clickable table targets when a tile fits both open ends */}
        {endTargets?.map((opt) => (
          <mesh
            key={`target-${opt.side}`}
            dispose={null}
            position={[opt.laid.position[0], 0.01, opt.laid.position[2]]}
            rotation={opt.laid.rotation}
            geometry={endTargetGeometry}
            material={endTargetMaterial}
            onClick={(e) => {
              e.stopPropagation();
              onPickSide?.(opt.side);
            }}
          />
        ))}

        {/* own row: faces toward the camera */}
        {/* no hints (owner, 2026-11-22): every tile looks alike; only the one picked rises */}
        {hand.map((tile, i) => (
          <SeatTile
            key={tile.id}
            id={tile.id}
            slot={myRow[i]!}
            values={{ top: tile.a, bottom: tile.b }}
            lift={selectedId === tile.id ? LIFT + 0.3 : 0}
            index={i}
            enterStart={enterStart}
            reduced={reduced}
            dragRef={dragRef}
            wasRecentSlam={wasRecentSlam}
            onTap={() => onPick(tile, false)}
            onPushStart={(clientX, clientY) => {
              dragRef.current = { tile, id: tile.id, startX: clientX, startY: clientY, push: 0 };
            }}
          />
        ))}

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
      </TableImpactGroup>
    </Canvas>
  );
}
