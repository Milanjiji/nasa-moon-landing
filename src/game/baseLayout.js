// ---------------------------------------------------------------------------
// Moon Base Layout, Zones & Camera Poses (Pure Data & Math)
// ---------------------------------------------------------------------------

export const BASE_SITES = {
  hatch: { x: 2.4, z: 0 },
  habitat: { x: 10, z: -16, r: 7 },
  solar: { x: -12, z: -18, r: 8 },
  air: { x: 18, z: -6, r: 5 },
  shield: { x: 10, z: -16, r: 7 },
};

export const CLEAR_ZONES = [
  { id: 'habitat', x: 10, z: -16, r: 7 },
  { id: 'solar', x: -12, z: -18, r: 8 },
  { id: 'air', x: 18, z: -6, r: 5 },
];

export const PATH_STRIPS = [
  { from: { x: 2.4, z: 0 }, to: { x: 10, z: -16 }, width: 1.8 },
  { from: { x: 2.4, z: 0 }, to: { x: -12, z: -18 }, width: 1.8 },
  { from: { x: 2.4, z: 0 }, to: { x: 18, z: -6 }, width: 1.8 },
];

function distToSegment(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  const projX = x1 + t * dx;
  const projZ = z1 + t * dz;
  return Math.hypot(px - projX, pz - projZ);
}

export function flattenFactor(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;

  let maxFactor = 0;

  // 1. Module zones
  for (let i = 0; i < CLEAR_ZONES.length; i++) {
    const zone = CLEAR_ZONES[i];
    const dist = Math.hypot(x - zone.x, z - zone.z);
    if (dist <= zone.r) {
      return 1.0;
    }
    if (dist < zone.r + 4.0) {
      const u = (dist - zone.r) / 4.0;
      const smooth = 1.0 - u * u * (3.0 - 2.0 * u);
      if (smooth > maxFactor) maxFactor = smooth;
    }
  }

  // 2. Path strips from hatch to modules
  for (let i = 0; i < PATH_STRIPS.length; i++) {
    const p = PATH_STRIPS[i];
    const dist = distToSegment(x, z, p.from.x, p.from.z, p.to.x, p.to.z);
    if (dist <= p.width) {
      const u = dist / p.width;
      const pathSmooth = 0.85 * (1.0 - u * u * (3.0 - 2.0 * u));
      if (pathSmooth > maxFactor) maxFactor = pathSmooth;
    }
  }

  return Math.max(0, Math.min(1.0, maxFactor));
}

export const CAMERA_POSES = {
  hatch: {
    position: { x: 7.5, y: 2.2, z: -3.5 },
    lookAt: { x: 2.4, y: 1.2, z: 0.0 },
  },
  solar: {
    position: { x: -3.0, y: 3.0, z: -7.5 },
    lookAt: { x: -12.0, y: 1.5, z: -18.0 },
  },
  habitat: {
    position: { x: 0.0, y: 3.0, z: -6.5 },
    lookAt: { x: 10.0, y: 1.5, z: -16.0 },
  },
  air: {
    position: { x: 8.5, y: 3.0, z: 4.0 },
    lookAt: { x: 18.0, y: 1.5, z: -6.0 },
  },
  shield: {
    position: { x: 0.0, y: 3.0, z: -6.5 },
    lookAt: { x: 10.0, y: 1.5, z: -16.0 },
  },
  wide: {
    position: { x: -16.0, y: 9.0, z: 8.0 },
    lookAt: { x: 4.0, y: 1.5, z: -14.0 },
  },
};

export default {
  BASE_SITES,
  CLEAR_ZONES,
  PATH_STRIPS,
  flattenFactor,
  CAMERA_POSES,
};
