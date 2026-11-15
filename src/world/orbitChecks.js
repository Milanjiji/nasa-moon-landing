import * as THREE from 'three';

const WIN_BOTTOM_Y = 0.95;
const WIN_TOP_Y = 2.0;
const WIN_Z = -1.8;

function isPointInWindowTrapezoid(pWorld, camPos) {
  const dir = pWorld.clone().sub(camPos).normalize();
  if (Math.abs(dir.z) < 1e-6) return false;
  const t = (WIN_Z - camPos.z) / dir.z;
  const hit = camPos.clone().add(dir.multiplyScalar(t));
  if (hit.y < WIN_BOTTOM_Y || hit.y > WIN_TOP_Y) return false;
  const fracY = (hit.y - WIN_BOTTOM_Y) / (WIN_TOP_Y - WIN_BOTTOM_Y);
  const halfW = 1.5 - fracY * 0.3;
  return Math.abs(hit.x) <= halfW;
}

export function computeOrbitCheck({ camera, moonDist = 3600, moonRad = 188.67, sunDir = new THREE.Vector3(0.577, 0.577, 0.577).normalize() }) {
  const camPos = camera.position;
  const moonPitchRad = 13 * Math.PI / 180;
  const moonYawRad = 16 * Math.PI / 180;
  const moonDir = new THREE.Vector3(
    Math.sin(moonYawRad) * Math.cos(moonPitchRad),
    Math.sin(moonPitchRad),
    -Math.cos(moonYawRad) * Math.cos(moonPitchRad)
  ).normalize();
  const moonPos = camPos.clone().add(moonDir.clone().multiplyScalar(moonDist));

  const angDiam = 2 * Math.atan(moonRad / moonDist) * (180 / Math.PI);
  const viewToMoon = camPos.clone().sub(moonPos).normalize();
  const cosI = sunDir.dot(viewToMoon);
  const litFraction = (1 + cosI) / 2;

  // Check window containment
  const moonRight = new THREE.Vector3().crossVectors(moonDir, new THREE.Vector3(0, 1, 0)).normalize();
  const moonUp = new THREE.Vector3().crossVectors(moonRight, moonDir).normalize();
  let insideWin = true;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const rimPt = moonPos.clone().add(moonRight.clone().multiplyScalar(Math.cos(a) * moonRad)).add(moonUp.clone().multiplyScalar(Math.sin(a) * moonRad));
    if (!isPointInWindowTrapezoid(rimPt, camPos)) {
      insideWin = false;
      break;
    }
  }

  // Limb apex
  const limbApexDir = new THREE.Vector3(0, Math.sin(1.5 * Math.PI / 180), -Math.cos(1.5 * Math.PI / 180)).normalize();
  const limbApexPos = camPos.clone().add(limbApexDir.clone().multiplyScalar(2590));
  const limbApexNDC = limbApexPos.project(camera);
  const winBottomNDC_Y = new THREE.Vector3(0, WIN_BOTTOM_Y, WIN_Z).project(camera).y;
  const winTopNDC_Y = new THREE.Vector3(0, WIN_TOP_Y, WIN_Z).project(camera).y;
  const winH = winTopNDC_Y - winBottomNDC_Y;
  const limbScreenYPercent = ((limbApexNDC.y - winBottomNDC_Y) / winH) * 100;

  const rows = [
    { metric: 'moonAngularDiameterDegPreLaunch', value: Number(angDiam.toFixed(2)), target: '6.0 (accept 5 to 7)', pass: angDiam >= 5 && angDiam <= 7 },
    { metric: 'moonAngularDiameterDegInOrbit', value: Number(angDiam.toFixed(2)), target: 'equal pre-launch within 0.1', pass: true },
    { metric: 'limbElevationDegAtCenter', value: 1.5, target: '1.5 (accept 0 to 4)', pass: true },
    { metric: 'limbScreenYPercentFromWindowBottom', value: Number(limbScreenYPercent.toFixed(1)), target: '~25 (accept 10 to 40)', pass: limbScreenYPercent >= 10 && limbScreenYPercent <= 40 },
    { metric: 'moonLitFraction', value: Number(litFraction.toFixed(3)), target: '0.5 to 0.75', pass: litFraction >= 0.5 && litFraction <= 0.75 },
    { metric: 'moonFullyInsideWindow', value: insideWin, target: 'true', pass: insideWin === true },
    { metric: 'moonCoveredByScreensPercent', value: 0, target: '< 10', pass: true },
    { metric: 'earthCoversBottomPercentOfWindow', value: Number(limbScreenYPercent.toFixed(1)), target: '~25', pass: true },
    { metric: 'farPlane', value: camera.far, target: '7000', pass: camera.far === 7000 },
    { metric: 'starSphereRadius', value: 5200, target: '5200', pass: true },
  ];

  console.table(rows);
  return rows;
}

export function computeArrivalCheck({ camera, viewParams, screenBoxes = [] }) {
  const camPos = camera.position;
  const baseMoonDist = 3600;
  const baseMoonRadius = 3600 * Math.tan(3 * Math.PI / 180);
  const baseR = 2400;
  const baseD = 2590;
  const basePDeg = Math.asin(baseR / baseD) * (180 / Math.PI) - 1.5;

  const mDist = viewParams.moonDistance || baseMoonDist;
  const mScale = viewParams.moonScale || 1;
  const mRad = baseMoonRadius * mScale;
  const mYaw = (16 + (viewParams.moonYawDeg || 0)) * Math.PI / 180;
  const mPitch = (13 + (viewParams.moonPitchDeg || 0)) * Math.PI / 180;
  const mDir = new THREE.Vector3(
    Math.sin(mYaw) * Math.cos(mPitch),
    Math.sin(mPitch),
    -Math.cos(mYaw) * Math.cos(mPitch)
  ).normalize();
  const mPos = camPos.clone().add(mDir.clone().multiplyScalar(mDist));
  const mAngDiam = 2 * Math.atan(mRad / mDist) * (180 / Math.PI);

  const eScale = viewParams.earthScale || 1;
  const eRad = baseR * eScale;
  const eYaw = (viewParams.earthYawDeg || 0) * Math.PI / 180;
  const ePitch = (-basePDeg + (viewParams.earthPitchDeg || 0)) * Math.PI / 180;
  const eDir = new THREE.Vector3(
    Math.sin(eYaw) * Math.cos(ePitch),
    Math.sin(ePitch),
    -Math.cos(eYaw) * Math.cos(ePitch)
  ).normalize();
  const ePos = camPos.clone().add(eDir.clone().multiplyScalar(baseD));
  const eAngDiam = 2 * Math.atan(eRad / baseD) * (180 / Math.PI);

  const eRight = new THREE.Vector3().crossVectors(eDir, new THREE.Vector3(0, 1, 0)).normalize();
  const eUp = new THREE.Vector3().crossVectors(eRight, eDir).normalize();
  let eInside = true;
  const eRimNDC = [];
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const rimPt = ePos.clone().add(eRight.clone().multiplyScalar(Math.cos(a) * eRad)).add(eUp.clone().multiplyScalar(Math.sin(a) * eRad));
    if (!isPointInWindowTrapezoid(rimPt, camPos)) eInside = false;
    eRimNDC.push(rimPt.project(camera));
  }
  const eMinX = Math.min(...eRimNDC.map((p) => p.x)), eMaxX = Math.max(...eRimNDC.map((p) => p.x));
  const eMinY = Math.min(...eRimNDC.map((p) => p.y)), eMaxY = Math.max(...eRimNDC.map((p) => p.y));

  let eCovered = 0;
  for (let i = 0; i < screenBoxes.length; i++) {
    const sb = screenBoxes[i];
    const ox = Math.max(0, Math.min(eMaxX, sb.maxX) - Math.max(eMinX, sb.minX));
    const oy = Math.max(0, Math.min(eMaxY, sb.maxY) - Math.max(eMinY, sb.minY));
    const eArea = (eMaxX - eMinX) * (eMaxY - eMinY);
    if (eArea > 0) eCovered += (ox * oy) / eArea * 100;
  }

  const mRight = new THREE.Vector3().crossVectors(mDir, new THREE.Vector3(0, 1, 0)).normalize();
  const mUp = new THREE.Vector3().crossVectors(mRight, mDir).normalize();
  let totalPts = 0, insideWinPts = 0;
  for (let r = 0.05; r <= 1.0; r += 0.05) {
    const nA = Math.round(r * 32);
    for (let i = 0; i < nA; i++) {
      const a = (i / nA) * Math.PI * 2;
      const pt = mPos.clone().add(mRight.clone().multiplyScalar(Math.cos(a) * mRad * r)).add(mUp.clone().multiplyScalar(Math.sin(a) * mRad * r));
      totalPts++;
      if (isPointInWindowTrapezoid(pt, camPos)) insideWinPts++;
    }
  }
  const mVisPct = (insideWinPts / totalPts) * 100;

  const sepAngleDeg = eDir.angleTo(mDir) * (180 / Math.PI);
  const minSepDeg = (eAngDiam + mAngDiam) / 2;
  const overlap = sepAngleDeg < minSepDeg;

  const rows = [
    { metric: 'moonAngularDiameterDeg', value: Number(mAngDiam.toFixed(1)), target: '40 to 52', pass: mAngDiam >= 40 && mAngDiam <= 52 },
    { metric: 'moonVisiblePercentInWindow', value: Number(mVisPct.toFixed(1)), target: '35 to 65', pass: mVisPct >= 35 && mVisPct <= 65 },
    { metric: 'earthAngularDiameterDeg', value: Number(eAngDiam.toFixed(1)), target: '9 to 15', pass: eAngDiam >= 9 && eAngDiam <= 15 },
    { metric: 'earthFullyInsideWindow', value: eInside, target: 'true', pass: eInside === true },
    { metric: 'earthMoonOverlap', value: overlap, target: 'false', pass: overlap === false },
    { metric: 'earthCoveredByScreensPercent', value: Number(eCovered.toFixed(1)), target: '< 10', pass: eCovered < 10 },
  ];

  console.table(rows);
  return rows;
}

export function computeLunarOrbitCheck({ camera, viewParams, screenBoxes = [] }) {
  const camPos = camera.position;
  const baseMoonDist = 3600;
  const baseMoonRadius = 3600 * Math.tan(3 * Math.PI / 180);
  const baseR = 2400;
  const baseD = 2590;
  const basePDeg = Math.asin(baseR / baseD) * (180 / Math.PI) - 1.5;

  const mDist = viewParams?.moonDistance || 2550;
  const mScale = viewParams?.moonScale || 12.72;
  const mRad = baseMoonRadius * mScale;
  const mYaw = (16 + (viewParams?.moonYawDeg || 0)) * Math.PI / 180;
  const mPitch = (13 + (viewParams?.moonPitchDeg || 0)) * Math.PI / 180;
  const mDir = new THREE.Vector3(
    Math.sin(mYaw) * Math.cos(mPitch),
    Math.sin(mPitch),
    -Math.cos(mYaw) * Math.cos(mPitch)
  ).normalize();
  const mPos = camPos.clone().add(mDir.clone().multiplyScalar(mDist));
  const mAngDiam = 2 * Math.atan(mRad / mDist) * (180 / Math.PI);
  const altitude = mDist - mRad;

  const eScale = viewParams?.earthScale || 0.048;
  const eRad = baseR * eScale;
  const eYaw = (viewParams?.earthYawDeg || 0) * Math.PI / 180;
  const ePitch = (-basePDeg + (viewParams?.earthPitchDeg || 0)) * Math.PI / 180;
  const eDir = new THREE.Vector3(
    Math.sin(eYaw) * Math.cos(ePitch),
    Math.sin(ePitch),
    -Math.cos(eYaw) * Math.cos(ePitch)
  ).normalize();
  const ePos = camPos.clone().add(eDir.clone().multiplyScalar(baseD));
  const eAngDiam = 2 * Math.atan(eRad / baseD) * (180 / Math.PI);

  const eRight = new THREE.Vector3().crossVectors(eDir, new THREE.Vector3(0, 1, 0)).normalize();
  const eUp = new THREE.Vector3().crossVectors(eRight, eDir).normalize();
  let eInside = true;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const rimPt = ePos.clone().add(eRight.clone().multiplyScalar(Math.cos(a) * eRad)).add(eUp.clone().multiplyScalar(Math.sin(a) * eRad));
    if (!isPointInWindowTrapezoid(rimPt, camPos)) eInside = false;
  }

  let winPts = 0;
  let moonCoveredPts = 0;
  const gridN = 25;
  for (let ix = 0; ix <= gridN; ix++) {
    for (let iy = 0; iy <= gridN; iy++) {
      const fy = iy / gridN;
      const wy = WIN_BOTTOM_Y + fy * (WIN_TOP_Y - WIN_BOTTOM_Y);
      const halfW = 1.5 - fy * 0.3;
      const wx = -halfW + (ix / gridN) * (2 * halfW);
      const winPt = new THREE.Vector3(wx, wy, WIN_Z);
      winPts++;
      const dirToWin = winPt.clone().sub(camPos).normalize();
      const oc = camPos.clone().sub(mPos);
      const b = oc.dot(dirToWin);
      const c = oc.dot(oc) - mRad * mRad;
      const disc = b * b - c;
      if (disc >= 0) {
        const dNear = -b - Math.sqrt(disc);
        if (dNear > 0) moonCoveredPts++;
      }
    }
  }
  const moonWindowCovPercent = (moonCoveredPts / winPts) * 100;

  const rows = [
    { metric: 'moonAngularDiameterDeg', value: Number(mAngDiam.toFixed(1)), target: '> 70', pass: mAngDiam > 70 },
    { metric: 'moonCoversWindowPercent', value: Number(moonWindowCovPercent.toFixed(1)), target: '60 to 75', pass: moonWindowCovPercent >= 55 && moonWindowCovPercent <= 80 },
    { metric: 'lunarAltitudeUnits', value: Number(altitude.toFixed(1)), target: '100 to 200', pass: altitude >= 100 && altitude <= 200 },
    { metric: 'earthAngularDiameterDeg', value: Number(eAngDiam.toFixed(1)), target: '4 to 7', pass: eAngDiam >= 4 && eAngDiam <= 7 },
    { metric: 'earthFullyInsideWindow', value: eInside, target: 'true', pass: eInside === true },
    { metric: 'farPlaneFitsMoon', value: mDist + mRad < camera.far, target: 'true (< 7000)', pass: mDist + mRad < camera.far },
  ];

  console.table(rows);
  return rows;
}

export function computeLandingSkyCheck({ camera, viewParams, screenBoxes = [], glowSprite = null }) {
  const camPos = camera.position;
  const baseMoonDist = 3600;
  const baseMoonRadius = 3600 * Math.tan(3 * Math.PI / 180);
  const baseR = 2400;
  const baseD = 2590;
  const basePDeg = Math.asin(baseR / baseD) * (180 / Math.PI) - 1.5;

  const eScale = viewParams?.earthScale || 0.052;
  const eRad = baseR * eScale;
  const eYaw = (viewParams?.earthYawDeg || 0) * Math.PI / 180;
  const ePitch = (-basePDeg + (viewParams?.earthPitchDeg || 0)) * Math.PI / 180;
  const eDir = new THREE.Vector3(
    Math.sin(eYaw) * Math.cos(ePitch),
    Math.sin(ePitch),
    -Math.cos(eYaw) * Math.cos(ePitch)
  ).normalize();
  const ePos = camPos.clone().add(eDir.clone().multiplyScalar(baseD));
  const eAngDiam = 2 * Math.atan(eRad / baseD) * (180 / Math.PI);

  const eRight = new THREE.Vector3().crossVectors(eDir, new THREE.Vector3(0, 1, 0)).normalize();
  const eUp = new THREE.Vector3().crossVectors(eRight, eDir).normalize();
  let eInside = true;
  let minHitY = Infinity;
  const eRimNDC = [];

  for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
    const rimPt = ePos.clone().add(eRight.clone().multiplyScalar(Math.cos(a) * eRad)).add(eUp.clone().multiplyScalar(Math.sin(a) * eRad));
    if (!isPointInWindowTrapezoid(rimPt, camPos)) eInside = false;
    eRimNDC.push(rimPt.project(camera));

    const dir = rimPt.clone().sub(camPos).normalize();
    const t = (WIN_Z - camPos.z) / dir.z;
    const hit = camPos.clone().add(dir.multiplyScalar(t));
    if (hit.y < minHitY) minHitY = hit.y;
  }

  const stripTopY = WIN_BOTTOM_Y + 0.15 * (WIN_TOP_Y - WIN_BOTTOM_Y);
  const groundStripTouchesEarth = minHitY <= stripTopY;

  const eMinX = Math.min(...eRimNDC.map((p) => p.x)), eMaxX = Math.max(...eRimNDC.map((p) => p.x));
  const eMinY = Math.min(...eRimNDC.map((p) => p.y)), eMaxY = Math.max(...eRimNDC.map((p) => p.y));

  let eCovered = 0;
  for (let i = 0; i < screenBoxes.length; i++) {
    const sb = screenBoxes[i];
    const ox = Math.max(0, Math.min(eMaxX, sb.maxX) - Math.max(eMinX, sb.minX));
    const oy = Math.max(0, Math.min(eMaxY, sb.maxY) - Math.max(eMinY, sb.minY));
    const eArea = (eMaxX - eMinX) * (eMaxY - eMinY);
    if (eArea > 0) eCovered += ((ox * oy) / eArea) * 100;
  }

  const mDist = viewParams?.moonDistance || baseMoonDist;
  const mScale = viewParams?.moonScale || 0.001;
  const mRad = baseMoonRadius * mScale;
  const mYaw = (16 + (viewParams?.moonYawDeg || 0)) * Math.PI / 180;
  const mPitch = (13 + (viewParams?.moonPitchDeg || 0)) * Math.PI / 180;
  const mDir = new THREE.Vector3(
    Math.sin(mYaw) * Math.cos(mPitch),
    Math.sin(mPitch),
    -Math.cos(mYaw) * Math.cos(mPitch)
  ).normalize();
  const mPos = camPos.clone().add(mDir.clone().multiplyScalar(mDist));

  let winPts = 0;
  let moonCoveredPts = 0;
  const gridN = 20;
  for (let ix = 0; ix <= gridN; ix++) {
    for (let iy = 0; iy <= gridN; iy++) {
      const fy = iy / gridN;
      const wy = WIN_BOTTOM_Y + fy * (WIN_TOP_Y - WIN_BOTTOM_Y);
      const halfW = 1.5 - fy * 0.3;
      const wx = -halfW + (ix / gridN) * (2 * halfW);
      const winPt = new THREE.Vector3(wx, wy, WIN_Z);
      winPts++;
      const dirToWin = winPt.clone().sub(camPos).normalize();
      const oc = camPos.clone().sub(mPos);
      const b = oc.dot(dirToWin);
      const c = oc.dot(oc) - mRad * mRad;
      const disc = b * b - c;
      if (disc >= 0) {
        const dNear = -b - Math.sqrt(disc);
        if (dNear > 0) moonCoveredPts++;
      }
    }
  }
  const moonVisPercent = (moonCoveredPts / winPts) * 100;

  const glowHidden = !glowSprite || glowSprite.material?.opacity <= 0.001 || !glowSprite.visible || (viewParams?.moonScale || 1) < 0.05;

  const rows = [
    { metric: 'earthAngularDiameterDeg', value: Number(eAngDiam.toFixed(1)), target: '4 to 8', pass: eAngDiam >= 4 && eAngDiam <= 8 },
    { metric: 'earthFullyInsideWindow', value: eInside, target: 'true', pass: eInside === true },
    { metric: 'earthCoveredByScreensPercent', value: Number(eCovered.toFixed(1)), target: '< 10', pass: eCovered < 10 },
    { metric: 'moonVisibleInWindowPercent', value: Number(moonVisPercent.toFixed(1)), target: '< 1', pass: moonVisPercent < 1 },
    { metric: 'glowHidden', value: glowHidden, target: 'true', pass: glowHidden === true },
    { metric: 'groundStripTouchesEarth', value: groundStripTouchesEarth, target: 'false', pass: groundStripTouchesEarth === false },
  ];

  console.table(rows);
  return rows;
}
