import * as THREE from 'three';
import { flattenFactor, CLEAR_ZONES } from '../../game/baseLayout.js';

function checkFinite(geometry, name) {
  if (!geometry?.attributes?.position) return;
  const arr = geometry.attributes.position.array;
  for (let i = 0; i < arr.length; i += 3) {
    if (!isFinite(arr[i]) || !isFinite(arr[i + 1]) || !isFinite(arr[i + 2])) {
      console.warn(`NaN/Inf in geometry "${name}" at vertex ${i / 3}`);
      return;
    }
  }
}

const CRATERS = [
  { x: 30, z: -35, r: 8, depth: 1.2 },
  { x: -40, z: -25, r: 12, depth: 1.4 },
  { x: 55, z: 20, r: 10, depth: 1.3 },
  { x: -28, z: 45, r: 9, depth: 1.1 },
  { x: 15, z: 65, r: 14, depth: 1.4 },
  { x: -60, z: -50, r: 11, depth: 1.2 },
  { x: 70, z: -40, r: 13, depth: 1.3 },
  { x: -50, z: 35, r: 10, depth: 1.0 },
  { x: 35, z: -75, r: 12, depth: 1.2 },
  { x: -75, z: 10, r: 15, depth: 1.4 },
  { x: 60, z: 55, r: 11, depth: 1.1 },
  { x: -20, z: -80, r: 10, depth: 1.2 },
  { x: 80, z: 15, r: 13, depth: 1.3 },
  { x: 45, z: 40, r: 9, depth: 1.0 },
];

export function surfaceHeight(x, z) {
  const d = Math.hypot(x, z);
  if (d <= 8) return 0;

  const t = Math.max(0, Math.min(1, (d - 8) / 16));
  const blend = t * t * (3 - 2 * t);

  const undulation =
    Math.sin(x * 0.04 + z * 0.03) * 0.75 +
    Math.cos(x * 0.03 - z * 0.05) * 0.55 +
    Math.sin(x * 0.08) * Math.cos(z * 0.07) * 0.35;

  let craterDisp = 0;
  for (let i = 0; i < CRATERS.length; i++) {
    const c = CRATERS[i];
    const cd = Math.hypot(x - c.x, z - c.z);
    if (cd < c.r * 1.4) {
      const u = cd / c.r;
      if (u < 1.0) {
        craterDisp -= c.depth * Math.pow(1 - u * u, 2);
      } else {
        const rimU = (u - 1.0) / 0.4;
        craterDisp += c.depth * 0.25 * Math.sin(Math.PI * rimU);
      }
    }
  }

  const rawH = blend * (undulation + craterDisp);
  const flat = flattenFactor(x, z);
  return rawH * (1.0 - flat);
}

function createRegolithTexture(lightHex, darkHex) {
  if (typeof document === 'undefined') return new THREE.Texture();
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = lightHex || '#b9bcc4';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  const cLight = new THREE.Color(lightHex || '#b9bcc4');
  const cDark = new THREE.Color(darkHex || '#7d8089');

  for (let i = 0; i < data.length; i += 4) {
    const n = Math.random() * 0.35 - 0.175;
    const factor = Math.max(0, Math.min(1, 0.5 + n));
    const r = THREE.MathUtils.lerp(cDark.r, cLight.r, factor) * 255;
    const g = THREE.MathUtils.lerp(cDark.g, cLight.g, factor) * 255;
    const b = THREE.MathUtils.lerp(cDark.b, cLight.b, factor) * 255;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Draw procedural micro-craters
  for (let i = 0; i < 90; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const cr = 4 + Math.random() * 18;

    const grad = ctx.createRadialGradient(cx - cr * 0.2, cy - cr * 0.2, cr * 0.1, cx, cy, cr);
    grad.addColorStop(0, darkHex || '#555860');
    grad.addColorStop(0.7, darkHex || '#666a72');
    grad.addColorStop(1, lightHex || '#c0c3cb');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(50, 50);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  return texture;
}

export function createSurfaceTerrain({ scene, site }) {
  const sData = site?.surface || {
    groundLight: '#b9bcc4',
    groundDark: '#7d8089',
    wallHeightDeg: 0,
  };

  const group = new THREE.Group();
  group.name = 'surface-terrain-group';
  scene.add(group);

  let terrainMesh = null;
  let regolithTexture = null;
  let bouldersMesh = null;
  let horizonGroup = null;
  let footprintsMesh = null;

  // 1. Ground Plane (1200 x 1200, 220 x 220 segments)
  try {
    const geo = new THREE.PlaneGeometry(1200, 1200, 220, 220);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      pos.setY(i, surfaceHeight(vx, vz));
    }
    geo.computeVertexNormals();
    checkFinite(geo, 'surface-ground-plane');

    regolithTexture = createRegolithTexture(sData.groundLight, sData.groundDark);
    const mat = new THREE.MeshStandardMaterial({
      map: regolithTexture,
      bumpMap: regolithTexture,
      bumpScale: 1.2,
      roughness: 1.0,
      metalness: 0.0,
    });

    terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.name = 'surface-ground';
    terrainMesh.receiveShadow = true;
    group.add(terrainMesh);
  } catch (err) {
    console.error('EarthScene part failed: surface terrain ground', err);
  }

  // 2. Boulders (InstancedMesh of 90 rocks)
  try {
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    checkFinite(rockGeo, 'surface-rock-geo');
    const rockMat = new THREE.MeshStandardMaterial({
      color: sData.groundDark || '#7d8089',
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });

    const rockCount = 90;
    bouldersMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    bouldersMesh.name = 'surface-boulders';
    bouldersMesh.castShadow = true;
    bouldersMesh.receiveShadow = true;
    bouldersMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const cDark = new THREE.Color(sData.groundDark || '#7d8089');
    const cLight = new THREE.Color(sData.groundLight || '#b9bcc4');

    let placed = 0;
    let seed = 12345;
    function pseudo() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    while (placed < rockCount) {
      const dist = 6 + pseudo() * 74;
      const angle = pseudo() * Math.PI * 2;
      const rx = Math.sin(angle) * dist;
      const rz = -Math.cos(angle) * dist;

      if (Math.hypot(rx, rz) < 5 || Math.hypot(rx, rz + 3) < 4) continue;

      let inClearZone = false;
      for (let zIdx = 0; zIdx < CLEAR_ZONES.length; zIdx++) {
        const cz = CLEAR_ZONES[zIdx];
        if (Math.hypot(rx - cz.x, rz - cz.z) < cz.r) {
          inClearZone = true;
          break;
        }
      }
      if (inClearZone) continue;

      const scaleXZ = 0.15 + pseudo() * 1.25;
      const scaleY = scaleXZ * (0.45 + pseudo() * 0.35);
      const ry = surfaceHeight(rx, rz) + scaleY * 0.7;

      dummy.position.set(rx, ry, rz);
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      dummy.rotation.set(pseudo() * 0.4, pseudo() * Math.PI * 2, pseudo() * 0.4);
      dummy.updateMatrix();

      bouldersMesh.setMatrixAt(placed, dummy.matrix);

      const colorFactor = pseudo();
      const col = new THREE.Color().lerpColors(cDark, cLight, colorFactor);
      bouldersMesh.setColorAt(placed, col);
      placed++;
    }
    bouldersMesh.instanceMatrix.needsUpdate = true;
    if (bouldersMesh.instanceColor) bouldersMesh.instanceColor.needsUpdate = true;
    group.add(bouldersMesh);
  } catch (err) {
    console.error('EarthScene part failed: surface boulders', err);
  }

  // 3. Horizon: far hills (ridge) or crater wall (crater)
  try {
    horizonGroup = new THREE.Group();
    horizonGroup.name = 'surface-horizon';
    group.add(horizonGroup);

    if (sData.wallHeightDeg > 0) {
      // Crater wall ring at radius 300
      const segs = 256;
      const wallRad = 300;
      const baseH = wallRad * Math.tan((sData.wallHeightDeg * Math.PI) / 180);
      const wallGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(segs * 2 * 3);

      for (let i = 0; i < segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const varDeg = Math.sin(theta * 5.0) * 1.0 + Math.cos(theta * 11.0) * 0.5;
        const curH = baseH + wallRad * Math.tan((varDeg * Math.PI) / 180);

        // Bottom vertex on ground
        const idxBot = i * 2 * 3;
        pos[idxBot] = sinT * wallRad;
        pos[idxBot + 1] = 0;
        pos[idxBot + 2] = -cosT * wallRad;

        // Top vertex at wall peak
        const idxTop = (i * 2 + 1) * 3;
        pos[idxTop] = sinT * wallRad;
        pos[idxTop + 1] = curH;
        pos[idxTop + 2] = -cosT * wallRad;
      }

      const indices = [];
      for (let i = 0; i < segs; i++) {
        const next = (i + 1) % segs;
        const b0 = i * 2;
        const t0 = i * 2 + 1;
        const b1 = next * 2;
        const t1 = next * 2 + 1;
        indices.push(b0, t0, b1);
        indices.push(t0, t1, b1);
      }
      wallGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      wallGeo.setIndex(indices);
      wallGeo.computeVertexNormals();
      checkFinite(wallGeo, 'surface-crater-wall');

      const wallMat = new THREE.MeshStandardMaterial({
        color: sData.groundDark || '#3a404c',
        roughness: 0.95,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.name = 'crater-wall';
      horizonGroup.add(wallMesh);

      // Emissive sunlit rim line along top edge
      const rimGeo = new THREE.BufferGeometry();
      const rimPos = new Float32Array(segs * 3);
      for (let i = 0; i < segs; i++) {
        rimPos[i * 3] = pos[(i * 2 + 1) * 3];
        rimPos[i * 3 + 1] = pos[(i * 2 + 1) * 3 + 1] + 0.1;
        rimPos[i * 3 + 2] = pos[(i * 2 + 1) * 3 + 2];
      }
      rimGeo.setAttribute('position', new THREE.BufferAttribute(rimPos, 3));
      const rimMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
      const rimLine = new THREE.LineLoop(rimGeo, rimMat);
      rimLine.name = 'crater-wall-rim';
      horizonGroup.add(rimLine);
    } else {
      // Two soft silhouette hill rings at radius 700 and 1000
      const radii = [700, 1000];
      const heights = [35, 55];
      const tints = [sData.groundDark || '#7d8089', sData.groundLight || '#b9bcc4'];

      for (let rIdx = 0; rIdx < radii.length; rIdx++) {
        const rad = radii[rIdx];
        const segs = 256;
        const hillGeo = new THREE.BufferGeometry();
        const pos = new Float32Array(segs * 2 * 3);

        for (let i = 0; i < segs; i++) {
          const theta = (i / segs) * Math.PI * 2;
          const sinT = Math.sin(theta);
          const cosT = Math.cos(theta);
          const hVar = Math.sin(theta * 6.0) * 12 + Math.cos(theta * 14.0) * 6;
          const curH = heights[rIdx] + hVar;

          const idxB = i * 2 * 3;
          pos[idxB] = sinT * rad;
          pos[idxB + 1] = 0;
          pos[idxB + 2] = -cosT * rad;

          const idxT = (i * 2 + 1) * 3;
          pos[idxT] = sinT * rad;
          pos[idxT + 1] = curH;
          pos[idxT + 2] = -cosT * rad;
        }

        const indices = [];
        for (let i = 0; i < segs; i++) {
          const next = (i + 1) % segs;
          indices.push(i * 2, i * 2 + 1, next * 2);
          indices.push(i * 2 + 1, next * 2 + 1, next * 2);
        }
        hillGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        hillGeo.setIndex(indices);
        checkFinite(hillGeo, `surface-hills-${rad}`);

        const hillMat = new THREE.MeshBasicMaterial({
          color: tints[rIdx],
          side: THREE.DoubleSide,
        });
        const hillMesh = new THREE.Mesh(hillGeo, hillMat);
        hillMesh.name = `surface-hills-${rad}`;
        horizonGroup.add(hillMesh);
      }
    }
  } catch (err) {
    console.error('EarthScene part failed: surface horizon', err);
  }

  // 4. Footprints pool (64 instances)
  const footprintCount = 64;
  let footprintIndex = 0;
  try {
    const fpGeo = new THREE.PlaneGeometry(0.12, 0.3);
    fpGeo.rotateX(-Math.PI / 2);
    checkFinite(fpGeo, 'surface-footprint-geo');

    const fpMat = new THREE.MeshBasicMaterial({
      color: 0x222630,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    footprintsMesh = new THREE.InstancedMesh(fpGeo, fpMat, footprintCount);
    footprintsMesh.name = 'surface-footprints';
    footprintsMesh.frustumCulled = false;

    // Initialize far below ground
    const dummy = new THREE.Object3D();
    dummy.position.set(0, -100, 0);
    dummy.scale.set(0.001, 0.001, 0.001);
    dummy.updateMatrix();
    for (let i = 0; i < footprintCount; i++) {
      footprintsMesh.setMatrixAt(i, dummy.matrix);
    }
    footprintsMesh.instanceMatrix.needsUpdate = true;
    group.add(footprintsMesh);
  } catch (err) {
    console.error('EarthScene part failed: surface footprints', err);
  }

  function addFootprint(pos, angle, isLeft) {
    if (!footprintsMesh) return;
    const dummy = new THREE.Object3D();
    const sideOffset = isLeft ? -0.16 : 0.16;
    const offX = Math.cos(angle) * sideOffset;
    const offZ = -Math.sin(angle) * sideOffset;
    const px = pos.x + offX;
    const pz = pos.z + offZ;
    const py = surfaceHeight(px, pz) + 0.015;

    dummy.position.set(px, py, pz);
    dummy.rotation.y = angle;
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();

    footprintsMesh.setMatrixAt(footprintIndex % footprintCount, dummy.matrix);
    footprintsMesh.instanceMatrix.needsUpdate = true;
    footprintIndex++;
  }

  function dispose() {
    if (terrainMesh) {
      terrainMesh.geometry.dispose();
      terrainMesh.material.map?.dispose();
      terrainMesh.material.dispose();
    }
    if (bouldersMesh) {
      bouldersMesh.geometry.dispose();
      bouldersMesh.material.dispose();
    }
    if (footprintsMesh) {
      footprintsMesh.geometry.dispose();
      footprintsMesh.material.dispose();
    }
    if (horizonGroup) {
      horizonGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }
    scene.remove(group);
  }

  return {
    group,
    h: surfaceHeight,
    addFootprint,
    dispose,
  };
}

export default createSurfaceTerrain;
