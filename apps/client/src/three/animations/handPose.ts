/** Last world pose of each hand tile, so a played tile's ghost can leave from where it was. */
export const lastHandPose = new Map<string, { x: number; y: number; z: number; rz: number }>();
