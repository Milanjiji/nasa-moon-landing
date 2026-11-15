// ---------------------------------------------------------------------------
// Earth Navigation Dev Check (Dev only)
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { indicatorSide } from '../game/earthNav.js';

export function computeEarthNavCheck() {
  const earth = typeof window !== 'undefined' ? window.earthScene : null;
  const cam = earth?.camera;
  const padCenter = earth?.launchSite?.padCenter;

  const camPos = cam ? `(${cam.position.x.toFixed(1)}, ${cam.position.y.toFixed(1)}, ${cam.position.z.toFixed(1)})` : '(0, 0, 0)';
  let distToPad = 'N/A';
  let side = 'none';

  if (cam && padCenter) {
    const dist = Math.hypot(cam.position.x - padCenter.x, cam.position.z - padCenter.z);
    distToPad = dist.toFixed(1);

    const target = new THREE.Vector3(padCenter.x, padCenter.y + 12, padCenter.z);
    const local = target.clone();
    cam.worldToLocal(local);
    const ndc = target.clone().project(cam);
    side = indicatorSide(local.x, local.z, ndc.x, ndc.y);
  }

  const walkingEnabled = Boolean(earth?.isWalkingAllowed?.());

  const rows = [
    {
      cameraPosition: camPos,
      distanceToPad: distToPad,
      pointerSide: side,
      walkingEnabled: walkingEnabled,
    },
  ];

  if (typeof console !== 'undefined' && console.table) {
    console.table(rows);
  }
  return rows;
}
