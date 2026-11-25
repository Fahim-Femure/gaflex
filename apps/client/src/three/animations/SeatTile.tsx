import { useEffect, useRef, type MutableRefObject } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import type { Tile as TileData } from '@gaflex/shared';
import type { StandingTile } from '../layout/seatRow';
import { TILE } from '../layout/layoutChain';
import { bodyMaterial, type TileVariant } from '../models/materials';
import { Tile } from '../models/Tile';
import { handEnterPose } from './curves';
import { lastHandPose } from './handPose';

const DAMP = 14; // slide/lift damping (docs/06: damping in useFrame, no React render per frame)
const LYING_DROP = TILE.thickness / 2 - TILE.length / 2; // centre height change from standing to lying

export type TileDragState = {
  tile: TileData;
  id: string;
  startX: number;
  startY: number;
  push: number;
} | null;

/**
 * One tile standing in a seat's row. With `values` it shows its face (the player's own tiles);
 * without, it is an opponent's tile seen from the back. On a new deal it starts face-down on the
 * felt and stands up (docs/05: stagger 80 ms, then flip toward the player).
 * Dragging/pushing a player's tile forward leans and slides it toward the table before firing a slam.
 */
export function SeatTile({
  id,
  slot,
  values,
  lift = 0,
  variant = 'normal',
  index,
  enterStart,
  reduced,
  dragRef,
  wasRecentSlam,
  onTap,
  onPushStart,
}: {
  id: string;
  slot: StandingTile;
  values?: { top: number; bottom: number };
  lift?: number;
  variant?: TileVariant;
  index: number;
  enterStart: MutableRefObject<number | null>;
  reduced: boolean;
  dragRef?: MutableRefObject<TileDragState>;
  wasRecentSlam?: () => boolean;
  onTap?: () => void;
  onPushStart?: (clientX: number, clientY: number) => void;
}) {
  const outer = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const cur = useRef({ x: slot.position[0], z: slot.position[2], lift, push: 0 });
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => invalidate(), [slot, lift, variant, invalidate]);

  useFrame((_, delta) => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const c = cur.current;
    const targetPush = dragRef?.current?.id === id ? dragRef.current.push : 0;
    const k = reduced ? 1 : 1 - Math.exp(-DAMP * delta);
    c.x = MathUtils.lerp(c.x, slot.position[0], k);
    c.z = MathUtils.lerp(c.z, slot.position[2], k);
    c.lift = MathUtils.lerp(c.lift, lift, k);
    c.push = MathUtils.lerp(c.push, targetPush, k);

    let rise = 1;
    let flip = 1;
    if (enterStart.current !== null && !reduced) {
      ({ rise, flip } = handEnterPose(index, performance.now() - enterStart.current));
    }
    o.position.set(c.x, slot.position[1], c.z);
    o.rotation.set(0, slot.yaw, 0);
    // Lying face-down (+90° about X) -> standing; pushing forward leans (-X) and slides onto the felt (-Z).
    i.rotation.set((Math.PI / 2) * (1 - flip) - c.push * 0.28, 0, 0);
    i.position.set(0, c.lift + c.push * 0.22 + LYING_DROP * (1 - flip), -2 * (1 - rise) - c.push * 0.9);

    if (values) lastHandPose.set(id, { x: c.x, y: slot.position[1] + c.lift, z: c.z, rz: 0 });

    const settling =
      Math.abs(c.x - slot.position[0]) > 0.002 ||
      Math.abs(c.z - slot.position[2]) > 0.002 ||
      Math.abs(c.lift - lift) > 0.002 ||
      Math.abs(c.push - targetPush) > 0.002;
    if (settling || rise < 1 || flip < 1) invalidate();
  });

  return (
    <group ref={outer} position={slot.position} rotation={[0, slot.yaw, 0]}>
      <group
        ref={inner}
        onPointerDown={
          onPushStart
            ? (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onPushStart(e.nativeEvent.clientX, e.nativeEvent.clientY);
              }
            : undefined
        }
        onClick={
          onTap
            ? (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                if (e.delta <= 12 && !wasRecentSlam?.()) onTap();
              }
            : undefined
        }
      >
        {values ? (
          <Tile top={values.top} bottom={values.bottom} variant={variant} />
        ) : (
          <RoundedBox args={[TILE.width, TILE.length, TILE.thickness]} radius={0.08} smoothness={2} castShadow>
            <primitive object={bodyMaterial('normal')} attach="material" />
          </RoundedBox>
        )}
      </group>
    </group>
  );
}
