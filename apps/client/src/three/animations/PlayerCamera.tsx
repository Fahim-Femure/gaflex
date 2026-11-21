import { useEffect, useLayoutEffect, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import type { Seat } from '@gaflex/shared';
import { CAMERA_FOV, CAMERA_MS, cameraPose, cameraPreset, type CameraMode, type CameraPoseValue } from './cameraRig';

/**
 * docs/06 useCameraRig: moves between the player's POV and the Intip (peek) view.
 * A new mode mid-move starts from where the camera is, so it can be interrupted.
 * Reduced motion: it switches at once (the page fades instead).
 */
export function CameraRig({ mode, reduced, seat }: { mode: CameraMode; reduced: boolean; seat: Seat }) {
  const ref = useRef<PerspectiveCameraImpl>(null);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const aspect = size.width / Math.max(1, size.height);
  const current = useRef<CameraPoseValue>(cameraPreset(mode, aspect, seat));
  const tween = useRef<{ from: CameraPoseValue; start: number } | null>(null);
  const target = useRef(new Vector3());

  // Mode change: tween from the current pose.
  useEffect(() => {
    tween.current = reduced ? null : { from: current.current, start: performance.now() };
    if (reduced) current.current = cameraPreset(mode, aspect, seat);
    invalidate();
    // aspect handled below; only a mode change starts a move
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reduced, invalidate]);

  // Resize or a different seat: settle on the new framing without animating.
  useLayoutEffect(() => {
    if (!tween.current) current.current = cameraPreset(mode, aspect, seat);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, seat, invalidate]);

  useFrame(() => {
    const cam = ref.current;
    if (!cam) return;
    const goal = cameraPreset(mode, aspect, seat);
    const tw = tween.current;
    if (tw) {
      const t = Math.min(1, (performance.now() - tw.start) / CAMERA_MS);
      current.current = cameraPose(tw.from, goal, t);
      if (t < 1) invalidate();
      else tween.current = null;
    }
    const pose = current.current;
    cam.position.set(...pose.position);
    cam.lookAt(target.current.set(...pose.target));
  });

  return <PerspectiveCamera ref={ref} makeDefault fov={CAMERA_FOV} near={0.1} far={200} />;
}
