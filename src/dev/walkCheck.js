// ---------------------------------------------------------------------------
// Moon Surface Walk Vector Direction Check (Dev only)
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { getWalkVectors } from '../game/walkMath.js';

export function computeWalkCheck() {
  const realCam = typeof window !== 'undefined' ? window.surfaceScene?.getCamera?.() : null;
  const cam = realCam || new THREE.PerspectiveCamera();

  const prevOrder = cam.rotation.order;
  const prevX = cam.rotation.x;
  const prevY = cam.rotation.y;
  const prevZ = cam.rotation.z;

  cam.rotation.order = 'YXZ';

  const angles = [0, 90, 180, 270];
  const rows = [];
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  for (let i = 0; i < angles.length; i++) {
    const deg = angles[i];
    const rad = deg * (Math.PI / 180);
    cam.rotation.set(0, rad, 0);
    cam.updateMatrixWorld(true);

    cam.getWorldDirection(fwd);
    right.set(1, 0, 0).applyQuaternion(cam.quaternion);

    const walk = getWalkVectors(fwd.x, fwd.z);

    const fwdMatch = Math.abs(fwd.x - walk.forward.x) < 0.001 && Math.abs(fwd.z - walk.forward.z) < 0.001;
    const rightMatch = Math.abs(right.x - walk.right.x) < 0.001 && Math.abs(right.z - walk.right.z) < 0.001;

    rows.push({
      yaw: deg,
      camForward: `(${fwd.x.toFixed(2)}, ${fwd.z.toFixed(2)})`,
      walkForward: `(${walk.forward.x.toFixed(2)}, ${walk.forward.z.toFixed(2)})`,
      forwardMatch: fwdMatch,
      camRight: `(${right.x.toFixed(2)}, ${right.z.toFixed(2)})`,
      walkRight: `(${walk.right.x.toFixed(2)}, ${walk.right.z.toFixed(2)})`,
      rightMatch: rightMatch,
    });
  }

  cam.rotation.order = prevOrder;
  cam.rotation.set(prevX, prevY, prevZ);
  cam.updateMatrixWorld(true);

  if (typeof console !== 'undefined' && console.table) {
    console.table(rows);
  }
  return rows;
}
