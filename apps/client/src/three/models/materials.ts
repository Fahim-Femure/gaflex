import { BoxGeometry, CanvasTexture, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { PIP_SPOTS } from '../../lib/chain';

/**
 * Resources shared by every tile (docs/06: one material set for all 28 tiles).
 * They live for the whole app session and are never disposed per tile.
 */
export type TileVariant = 'normal' | 'glow' | 'dim';

const IVORY = '#f3ead6';
const BODY: Record<TileVariant, MeshStandardMaterial> = {
  normal: new MeshStandardMaterial({ color: IVORY, roughness: 0.45 }),
  glow: new MeshStandardMaterial({ color: IVORY, roughness: 0.4, emissive: '#fff1b8', emissiveIntensity: 0.45 }),
  dim: new MeshStandardMaterial({ color: '#8f897b', roughness: 0.6 }),
};

export const bodyMaterial = (v: TileVariant) => BODY[v];

/** One canvas texture per pip value 0..6, created on first use and cached. */
const textures = new Map<number, CanvasTexture>();

function pipTexture(value: number): CanvasTexture {
  const cached = textures.get(value);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8f1e0';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = value === 1 ? '#b3362b' : '#151515';
  for (const cell of PIP_SPOTS[value] ?? []) {
    const cx = ((cell % 3) + 0.5) * (size / 3);
    const cy = (Math.floor(cell / 3) + 0.5) * (size / 3);
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  textures.set(value, texture);
  return texture;
}

const faces = new Map<string, MeshStandardMaterial>();

export function faceMaterial(value: number, variant: TileVariant): MeshStandardMaterial {
  const key = `${value}:${variant}`;
  let m = faces.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      map: pipTexture(value),
      roughness: 0.5,
      // No emissive on the face: it would wash the black pips out. Glow lives on the body.
      color: variant === 'dim' ? '#9c968a' : '#ffffff',
    });
    faces.set(key, m);
  }
  return m;
}

export const halfFaceGeometry = new PlaneGeometry(0.9, 0.9);
export const dividerGeometry = new BoxGeometry(0.78, 0.045, 0.01);
export const dividerMaterial = new MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.7 });
