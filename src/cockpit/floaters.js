import * as THREE from 'three';

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

export function createFloaters({ scene, camera, surfaceY }) {
  const group = new THREE.Group();
  group.name = 'cockpit-floaters';
  scene.add(group);

  const SLOPE_X = Math.atan2(0.30, 1.10);
  const BOX = { minX: -1.1, maxX: 0.9, minY: 1.0, maxY: 1.9, minZ: -0.9, maxZ: 0.4 };

  const restingPen = { pos: new THREE.Vector3(-0.46, surfaceY(-0.85) + 0.007, -0.85), rot: new THREE.Euler(SLOPE_X, 0.25, 0) };
  const restingNotebook = { pos: new THREE.Vector3(-0.60, surfaceY(-0.92) + 0.007, -0.92), rot: new THREE.Euler(SLOPE_X, -0.15, 0) };
  const restingClipboard = { pos: new THREE.Vector3(-0.72, surfaceY(-0.88) + 0.006, -0.88), rot: new THREE.Euler(SLOPE_X, 0.12, 0) };

  let penMesh = null;
  let notebookMesh = null;
  let clipboardMesh = null;
  let bubbleMesh = null;
  let strapMesh = null;
  let dustMesh = null;
  let bubbleMat = null;
  let strapMat = null;
  let dustMat = null;

  try {
    const penGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 10);
    checkFinite(bodyGeo, 'floater-pen-body');
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45, metalness: 0.2, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.06;
    penGroup.add(body);

    const tipGeo = new THREE.ConeGeometry(0.006, 0.02, 10);
    checkFinite(tipGeo, 'floater-pen-tip');
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2, flatShading: true });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = 0.13;
    penGroup.add(tip);

    penMesh = penGroup;
    penMesh.name = 'floater-pen';
    penMesh.rotation.z = Math.PI / 2;
    group.add(penMesh);
  } catch (err) {
    console.error('EarthScene part failed: orbit pen', err);
  }

  try {
    const nbGeo = new THREE.BoxGeometry(0.09, 0.01, 0.12);
    checkFinite(nbGeo, 'floater-notebook');
    const nbMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.65, flatShading: true });
    notebookMesh = new THREE.Mesh(nbGeo, nbMat);
    notebookMesh.name = 'floater-notebook';
    group.add(notebookMesh);
  } catch (err) {
    console.error('EarthScene part failed: orbit notebook', err);
  }

  try {
    const clipGroup = new THREE.Group();
    const boardGeo = new THREE.BoxGeometry(0.10, 0.006, 0.14);
    checkFinite(boardGeo, 'floater-board');
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7, flatShading: true });
    const board = new THREE.Mesh(boardGeo, boardMat);
    clipGroup.add(board);

    const metalClipGeo = new THREE.BoxGeometry(0.04, 0.012, 0.018);
    checkFinite(metalClipGeo, 'floater-clip');
    const metalClipMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.3, flatShading: true });
    const clip = new THREE.Mesh(metalClipGeo, metalClipMat);
    clip.position.set(0, 0.006, -0.06);
    clipGroup.add(clip);

    clipboardMesh = clipGroup;
    clipboardMesh.name = 'floater-clipboard';
    group.add(clipboardMesh);
  } catch (err) {
    console.error('EarthScene part failed: orbit clipboard', err);
  }

  try {
    const bubbleGeo = new THREE.SphereGeometry(0.025, 16, 16);
    checkFinite(bubbleGeo, 'floater-bubble');
    bubbleMat = new THREE.MeshStandardMaterial({
      color: 0xbde0fe,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    bubbleMesh.name = 'floater-bubble';
    bubbleMesh.visible = false;
    group.add(bubbleMesh);
  } catch (err) {
    console.error('EarthScene part failed: orbit bubble', err);
  }

  try {
    const strapGeo = new THREE.BoxGeometry(0.18, 0.004, 0.02);
    checkFinite(strapGeo, 'floater-strap');
    strapMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.7,
      transparent: true,
      opacity: 0,
      flatShading: true,
    });
    strapMesh = new THREE.Mesh(strapGeo, strapMat);
    strapMesh.name = 'floater-strap';
    strapMesh.visible = false;
    group.add(strapMesh);
  } catch (err) {
    console.error('EarthScene part failed: orbit strap', err);
  }

  const DUST_COUNT = 14;
  let dustDummy = null;
  const dustPositions = [];
  try {
    const dGeo = new THREE.SphereGeometry(0.004, 6, 6);
    checkFinite(dGeo, 'floater-dust');
    dustMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    dustMesh = new THREE.InstancedMesh(dGeo, dustMat, DUST_COUNT);
    dustMesh.name = 'floater-dust';
    dustMesh.visible = false;
    dustDummy = new THREE.Object3D();

    for (let i = 0; i < DUST_COUNT; i++) {
      const p = new THREE.Vector3(
        BOX.minX + 0.2 + Math.random() * (BOX.maxX - BOX.minX - 0.4),
        BOX.minY + 0.1 + Math.random() * (BOX.maxY - BOX.minY - 0.2),
        BOX.minZ + 0.2 + Math.random() * (BOX.maxZ - BOX.minZ - 0.4)
      );
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03
      );
      dustPositions.push({ pos: p, vel: v });
      dustDummy.position.copy(p);
      dustDummy.updateMatrix();
      dustMesh.setMatrixAt(i, dustDummy.matrix);
    }
    dustMesh.instanceMatrix.needsUpdate = true;
    group.add(dustMesh);
  } catch (err) {
    console.error('EarthScene part failed: orbit dust', err);
  }

  const itemsState = [
    { mesh: penMesh, rest: restingPen, vel: new THREE.Vector3(0.03, 0.025, -0.02), rotVel: new THREE.Vector3(0.2, 0.4, 0.1), liftTarget: new THREE.Vector3(-0.45, 1.25, -0.75) },
    { mesh: notebookMesh, rest: restingNotebook, vel: new THREE.Vector3(-0.025, 0.035, 0.02), rotVel: new THREE.Vector3(0.3, 0.1, 0.25), liftTarget: new THREE.Vector3(-0.60, 1.30, -0.80) },
    { mesh: clipboardMesh, rest: restingClipboard, vel: new THREE.Vector3(0.02, -0.02, 0.035), rotVel: new THREE.Vector3(0.15, 0.25, 0.35), liftTarget: new THREE.Vector3(-0.75, 1.28, -0.72) },
    { mesh: bubbleMesh, rest: null, vel: new THREE.Vector3(0.025, 0.02, -0.025), rotVel: new THREE.Vector3(0.1, 0.1, 0.1), liftTarget: null },
    { mesh: strapMesh, rest: null, vel: new THREE.Vector3(-0.03, 0.02, 0.02), rotVel: new THREE.Vector3(0.2, 0.3, 0.15), liftTarget: null },
  ];

  let isWeightless = false;
  let liftTime = 0;
  let fadeAlpha = 0;
  let driftTime = 0;
  let driftWeight = 0;
  let wobbleTime = 0;
  let settling = false;
  let settleDuration = 4.0;
  let settleElapsed = 0;
  const settleStarts = [];

  function settle(duration = 4.0) {
    settling = true;
    settleDuration = Math.max(0.5, duration);
    settleElapsed = 0;
    settleStarts.length = 0;
    for (let i = 0; i < itemsState.length; i++) {
      const it = itemsState[i];
      if (it.mesh) {
        settleStarts.push({
          pos: it.mesh.position.clone(),
          rot: it.mesh.rotation.clone(),
        });
      } else {
        settleStarts.push(null);
      }
    }
  }

  function resetPositions() {
    isWeightless = false;
    settling = false;
    settleElapsed = 0;
    liftTime = 0;
    fadeAlpha = 0;
    driftTime = 0;
    driftWeight = 0;
    wobbleTime = 0;

    if (penMesh) { penMesh.position.copy(restingPen.pos); penMesh.rotation.copy(restingPen.rot); }
    if (notebookMesh) { notebookMesh.position.copy(restingNotebook.pos); notebookMesh.rotation.copy(restingNotebook.rot); }
    if (clipboardMesh) { clipboardMesh.position.copy(restingClipboard.pos); clipboardMesh.rotation.copy(restingClipboard.rot); }

    if (bubbleMesh) {
      bubbleMesh.position.set(-0.25, 1.45, -0.55);
      bubbleMesh.visible = false;
      if (bubbleMat) bubbleMat.opacity = 0;
    }
    if (strapMesh) {
      strapMesh.position.set(-0.15, 1.35, -0.35);
      strapMesh.visible = false;
      if (strapMat) strapMat.opacity = 0;
    }
    if (dustMesh) {
      dustMesh.visible = false;
      if (dustMat) dustMat.opacity = 0;
    }
  }

  function update(delta, frame, prefersReduced) {
    if (settling) {
      settleElapsed += delta;
      const p = Math.min(1.0, settleElapsed / settleDuration);
      const ease = p * p * (3 - 2 * p);
      driftWeight = Math.max(0, 1.0 - (settleElapsed / 2.0));

      for (let i = 0; i < itemsState.length; i++) {
        const it = itemsState[i];
        const start = settleStarts[i];
        if (!it.mesh || !start) continue;

        if (it.rest) {
          it.mesh.position.lerpVectors(start.pos, it.rest.pos, ease);
          it.mesh.rotation.x = start.rot.x + (it.rest.rot.x - start.rot.x) * ease;
          it.mesh.rotation.y = start.rot.y + (it.rest.rot.y - start.rot.y) * ease;
          it.mesh.rotation.z = start.rot.z + (it.rest.rot.z - start.rot.z) * ease;
        } else {
          if (it.mesh.material) {
            it.mesh.material.opacity = Math.max(0, (1 - p) * 0.7);
            if (p >= 1.0) it.mesh.visible = false;
          }
        }
      }

      if (dustMesh && dustMat) {
        dustMat.opacity = Math.max(0, (1 - p) * 0.5);
        if (p >= 1.0) dustMesh.visible = false;
      }

      if (p >= 1.0) {
        settling = false;
        isWeightless = false;
      }
      return;
    }

    const gVal = (frame && typeof frame.g === 'number') ? frame.g : 1.0;
    const stage = frame?.stage;
    const nowWeightless = (gVal === 0) || stage === 'coast' || stage === 'orbit';

    if (nowWeightless) {
      isWeightless = true;
    }

    // Pre-cutoff rattle
    if (!isWeightless) {
      const shake = (frame && frame.shake) ? frame.shake : 0;
      if (shake > 0 && !prefersReduced) {
        const jx = (Math.random() - 0.5) * 0.003 * shake;
        const jz = (Math.random() - 0.5) * 0.003 * shake;
        if (penMesh) penMesh.position.set(restingPen.pos.x + jx, restingPen.pos.y, restingPen.pos.z + jz);
        if (notebookMesh) notebookMesh.position.set(restingNotebook.pos.x + jx, restingNotebook.pos.y, restingNotebook.pos.z + jz);
        if (clipboardMesh) clipboardMesh.position.set(restingClipboard.pos.x + jx, restingClipboard.pos.y, restingClipboard.pos.z + jz);
      }
      return;
    }

    // Weightless fade-in of bubble, strap, dust
    if (fadeAlpha < 1.0) {
      fadeAlpha = Math.min(1.0, fadeAlpha + delta / 1.0);
      if (bubbleMesh) { bubbleMesh.visible = true; if (bubbleMat) bubbleMat.opacity = 0.65 * fadeAlpha; }
      if (strapMesh) { strapMesh.visible = true; if (strapMat) strapMat.opacity = 0.9 * fadeAlpha; }
      if (dustMesh) { dustMesh.visible = true; if (dustMat) dustMat.opacity = 0.5 * fadeAlpha; }
    }

    if (prefersReduced) {
      driftWeight = 0;
      return;
    }

    // Camera drift fading in over 2 seconds
    if (driftWeight < 1.0) {
      driftWeight = Math.min(1.0, driftWeight + delta / 2.0);
    }
    driftTime += delta;
    wobbleTime += delta;

    // Lift off phase over 3 seconds
    liftTime += delta;
    const isLifting = liftTime < 3.0;
    const liftT = Math.min(1.0, liftTime / 3.0);
    const easeLift = 1 - Math.pow(1 - liftT, 3);

    for (let i = 0; i < itemsState.length; i++) {
      const it = itemsState[i];
      if (!it.mesh) continue;

      if (it.rest && isLifting) {
        it.mesh.position.lerpVectors(it.rest.pos, it.liftTarget, easeLift);
        it.mesh.rotation.x += it.rotVel.x * delta * 0.5;
        it.mesh.rotation.y += it.rotVel.y * delta * 0.5;
        continue;
      }

      // Drift freely inside bounding box
      it.mesh.position.addScaledVector(it.vel, delta);
      it.mesh.rotation.x += it.rotVel.x * delta;
      it.mesh.rotation.y += it.rotVel.y * delta;
      it.mesh.rotation.z += it.rotVel.z * delta;

      // Soft bounce off box walls
      const p = it.mesh.position;
      if (p.x < BOX.minX && it.vel.x < 0) it.vel.x = -it.vel.x;
      if (p.x > BOX.maxX && it.vel.x > 0) it.vel.x = -it.vel.x;
      if (p.y < BOX.minY && it.vel.y < 0) it.vel.y = -it.vel.y;
      if (p.y > BOX.maxY && it.vel.y > 0) it.vel.y = -it.vel.y;
      if (p.z < BOX.minZ && it.vel.z < 0) it.vel.z = -it.vel.z;
      if (p.z > BOX.maxZ && it.vel.z > 0) it.vel.z = -it.vel.z;

      // Repulsion from camera (minimum distance 0.25)
      const distToCam = p.distanceTo(camera.position);
      if (distToCam < 0.25 && distToCam > 0.001) {
        const rep = p.clone().sub(camera.position).normalize();
        p.addScaledVector(rep, (0.25 - distToCam) * 2.0 * delta);
      }
    }

    // Strap wobble
    if (strapMesh) {
      strapMesh.scale.x = 1.0 + 0.08 * Math.sin(wobbleTime * 3.5);
      strapMesh.rotation.z += 0.05 * Math.cos(wobbleTime * 4.0) * delta;
    }

    // Dust specks
    if (dustMesh && dustDummy) {
      for (let i = 0; i < dustPositions.length; i++) {
        const d = dustPositions[i];
        d.pos.addScaledVector(d.vel, delta);
        if (d.pos.x < BOX.minX || d.pos.x > BOX.maxX) d.vel.x = -d.vel.x;
        if (d.pos.y < BOX.minY || d.pos.y > BOX.maxY) d.vel.y = -d.vel.y;
        if (d.pos.z < BOX.minZ || d.pos.z > BOX.maxZ) d.vel.z = -d.vel.z;

        const distCam = d.pos.distanceTo(camera.position);
        if (distCam < 0.25 && distCam > 0.001) {
          const rep = d.pos.clone().sub(camera.position).normalize();
          d.pos.addScaledVector(rep, (0.25 - distCam) * delta);
        }

        dustDummy.position.copy(d.pos);
        dustDummy.updateMatrix();
        dustMesh.setMatrixAt(i, dustDummy.matrix);
      }
      dustMesh.instanceMatrix.needsUpdate = true;
    }
  }

  function getDriftOffset() {
    if (driftWeight <= 0.001) {
      return { posX: 0, posY: 0, roll: 0, idleSwayWeight: 1.0 };
    }
    const bobX = Math.sin(driftTime * (2 * Math.PI / 9.0)) * 0.025 * driftWeight;
    const bobY = Math.cos(driftTime * (2 * Math.PI / 13.0)) * 0.025 * driftWeight;
    const roll = Math.sin(driftTime * (2 * Math.PI / 17.0)) * (0.6 * Math.PI / 180.0) * driftWeight;
    return {
      posX: bobX,
      posY: bobY,
      roll,
      idleSwayWeight: Math.max(0, 1.0 - driftWeight),
    };
  }

  function dispose() {
    scene.remove(group);
  }

  resetPositions();

  return {
    group,
    update,
    reset: resetPositions,
    settle,
    getDriftOffset,
    dispose,
  };
}

export default createFloaters;
