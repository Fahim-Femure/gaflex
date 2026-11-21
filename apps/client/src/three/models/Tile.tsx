import { RoundedBox } from '@react-three/drei';
import type { GroupProps } from '@react-three/fiber';
import { TILE } from '../layout/layoutChain';
import {
  bodyMaterial,
  dividerGeometry,
  dividerMaterial,
  faceMaterial,
  halfFaceGeometry,
  type TileVariant,
} from './materials';

const FACE_Z = TILE.thickness / 2 + 0.002;

/**
 * One domino (docs/06): RoundedBox 1 × 2 × 0.3, face toward local +Z,
 * `top` value on the +Y half. Used in the hand and on the table.
 */
export function Tile({
  top,
  bottom,
  variant = 'normal',
  ...props
}: { top: number; bottom: number; variant?: TileVariant } & GroupProps) {
  return (
    <group {...props}>
      <RoundedBox args={[TILE.width, TILE.length, TILE.thickness]} radius={0.08} smoothness={3} castShadow receiveShadow>
        <primitive object={bodyMaterial(variant)} attach="material" />
      </RoundedBox>
      {/* shared geometry/materials: never dispose them with a single tile */}
      <mesh dispose={null} position={[0, 0.5, FACE_Z]} geometry={halfFaceGeometry} material={faceMaterial(top, variant)} />
      <mesh dispose={null} position={[0, -0.5, FACE_Z]} geometry={halfFaceGeometry} material={faceMaterial(bottom, variant)} />
      <mesh dispose={null} position={[0, 0, FACE_Z + 0.003]} geometry={dividerGeometry} material={dividerMaterial} />
    </group>
  );
}
