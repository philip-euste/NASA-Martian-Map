// frontend/src/simulator/shared/projection.ts
//
// First-person camera projection helpers.
//
// A PerspectiveCamera's `fov` is the VERTICAL field of view. Holding it fixed
// means the horizontal field of view grows with the viewport aspect ratio: a
// 70° vertical FOV on a 2:1 visor is ~110° horizontal, which bends straight
// terrain features near the edges. We instead target a horizontal FOV close to
// human binocular vision and derive the vertical FOV from the aspect ratio,
// clamped so very wide or very tall viewports stay usable.

export interface FovOptions {
  horizontalFovDeg: number;
  minVerticalFovDeg: number;
  maxVerticalFovDeg: number;
}

export const DEFAULT_FIRST_PERSON_FOV: FovOptions = {
  horizontalFovDeg: 90,
  minVerticalFovDeg: 48,
  maxVerticalFovDeg: 72,
};

export function verticalFovForAspect(
  aspect: number,
  options: FovOptions = DEFAULT_FIRST_PERSON_FOV
): number {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    return options.maxVerticalFovDeg;
  }
  const h = (options.horizontalFovDeg * Math.PI) / 180;
  const v = (2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI;
  return Math.min(options.maxVerticalFovDeg, Math.max(options.minVerticalFovDeg, v));
}

export function horizontalFovFor(verticalFovDeg: number, aspect: number): number {
  const v = (verticalFovDeg * Math.PI) / 180;
  return (2 * Math.atan(Math.tan(v / 2) * aspect) * 180) / Math.PI;
}
