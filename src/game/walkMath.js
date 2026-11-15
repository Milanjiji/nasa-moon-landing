// ---------------------------------------------------------------------------
// Pure Walking Direction & Movement Math
// ---------------------------------------------------------------------------

const DEFAULT_VECTORS = Object.freeze({
  forward: Object.freeze({ x: 0, z: -1 }),
  right: Object.freeze({ x: 1, z: 0 }),
});

export function getWalkVectors(forwardX, forwardZ, fallback = null) {
  const x = Number(forwardX);
  const z = Number(forwardZ);

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    if (fallback && fallback.forward && fallback.right) {
      return {
        forward: { x: fallback.forward.x, z: fallback.forward.z },
        right: { x: fallback.right.x, z: fallback.right.z },
      };
    }
    return {
      forward: { x: DEFAULT_VECTORS.forward.x, z: DEFAULT_VECTORS.forward.z },
      right: { x: DEFAULT_VECTORS.right.x, z: DEFAULT_VECTORS.right.z },
    };
  }

  const len = Math.hypot(x, z);
  if (len < 1e-5) {
    if (fallback && fallback.forward && fallback.right) {
      return {
        forward: { x: fallback.forward.x, z: fallback.forward.z },
        right: { x: fallback.right.x, z: fallback.right.z },
      };
    }
    return {
      forward: { x: DEFAULT_VECTORS.forward.x, z: DEFAULT_VECTORS.forward.z },
      right: { x: DEFAULT_VECTORS.right.x, z: DEFAULT_VECTORS.right.z },
    };
  }

  const fx = x / len;
  const fz = z / len;

  // Handedness: camera looking toward -Z (fx = 0, fz = -1) -> right is (+1, 0)
  // right = (-fz, fx) -> (-(-1), 0) = (1, 0)
  const rx = -fz;
  const rz = fx;

  return {
    forward: { x: fx, z: fz },
    right: { x: rx, z: rz },
  };
}

export function moveStep(input, vectors, speed = 1.35, delta = 0) {
  let f = input?.forward || 0;
  let s = input?.strafe || 0;

  if (f === 0 && s === 0) {
    return { dx: 0, dz: 0 };
  }

  const len = Math.hypot(f, s);
  if (len > 0) {
    f /= len;
    s /= len;
  }

  const dist = (speed || 0) * (delta || 0);
  const fwd = vectors?.forward || DEFAULT_VECTORS.forward;
  const rgt = vectors?.right || DEFAULT_VECTORS.right;

  const dx = (fwd.x * f + rgt.x * s) * dist;
  const dz = (fwd.z * f + rgt.z * s) * dist;

  return { dx, dz };
}

export default {
  getWalkVectors,
  moveStep,
};
