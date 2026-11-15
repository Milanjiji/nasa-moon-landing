// ---------------------------------------------------------------------------
// Earth Navigation Pure Helpers (no DOM)
// ---------------------------------------------------------------------------

export function easeInOut(t) {
  if (typeof t !== 'number' || !Number.isFinite(t)) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export function shortestAngleDelta(fromRad, toRad) {
  if (!Number.isFinite(fromRad) || !Number.isFinite(toRad)) {
    return 0;
  }
  let diff = (toRad - fromRad) % (Math.PI * 2);
  if (diff > Math.PI) {
    diff -= Math.PI * 2;
  } else if (diff < -Math.PI) {
    diff += Math.PI * 2;
  }
  return diff;
}

export function lerpAngle(fromRad, toRad, t) {
  if (!Number.isFinite(fromRad) || !Number.isFinite(toRad) || !Number.isFinite(t)) {
    return Number.isFinite(fromRad) ? fromRad : 0;
  }
  return fromRad + shortestAngleDelta(fromRad, toRad) * t;
}

export function clampWalk(x, z, centerX = 0, centerZ = 0, radius = 135) {
  const safeX = Number.isFinite(x) ? x : (Number.isFinite(centerX) ? centerX : 0);
  const safeZ = Number.isFinite(z) ? z : (Number.isFinite(centerZ) ? centerZ : 0);
  const safeCX = Number.isFinite(centerX) ? centerX : 0;
  const safeCZ = Number.isFinite(centerZ) ? centerZ : 0;
  const safeR = Number.isFinite(radius) && radius > 0 ? radius : 135;

  const dx = safeX - safeCX;
  const dz = safeZ - safeCZ;
  const dist = Math.hypot(dx, dz);
  if (dist <= safeR) {
    return { x: safeX, z: safeZ };
  }
  if (dist === 0) {
    return { x: safeCX, z: safeCZ };
  }
  const factor = safeR / dist;
  return {
    x: safeCX + dx * factor,
    z: safeCZ + dz * factor,
  };
}

export function distance2D(ax, az, bx, bz) {
  if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(bx) || !Number.isFinite(bz)) {
    return 0;
  }
  return Math.hypot(ax - bx, az - bz);
}

export function nearPad(px, pz, padX, padZ, wasNear = false) {
  if (!Number.isFinite(px) || !Number.isFinite(pz) || !Number.isFinite(padX) || !Number.isFinite(padZ)) {
    return Boolean(wasNear);
  }
  const dist = Math.hypot(px - padX, pz - padZ);
  if (dist < 40) {
    return true;
  }
  if (dist > 55) {
    return false;
  }
  return Boolean(wasNear);
}

export function indicatorSide(localX, localZ, ndcX, ndcY) {
  if (!Number.isFinite(localX) || !Number.isFinite(localZ) || !Number.isFinite(ndcX) || !Number.isFinite(ndcY)) {
    return 'none';
  }
  if (localZ < 0 && Math.abs(ndcX) < 0.9 && Math.abs(ndcY) < 0.9) {
    return 'none';
  }
  return localX > 0 ? 'right' : 'left';
}

export function validateInstancedMeshes(scene) {
  if (!scene || typeof scene.traverse !== 'function') {
    return;
  }
  scene.traverse((obj) => {
    if (obj.isInstancedMesh) {
      const matCount = obj.instanceMatrix ? obj.instanceMatrix.count : 0;
      if (obj.count > matCount) {
        console.warn(`[validateInstancedMeshes] ${obj.name || 'unnamed'}: count (${obj.count}) > instanceMatrix.count (${matCount})`);
      }
      if (obj.instanceColor && obj.instanceColor.count < obj.count) {
        console.warn(`[validateInstancedMeshes] ${obj.name || 'unnamed'}: instanceColor.count (${obj.instanceColor.count}) < count (${obj.count})`);
      }
    }
  });
}
