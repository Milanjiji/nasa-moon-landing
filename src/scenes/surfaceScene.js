import * as THREE from 'three';
import { surfaceHeight, createSurfaceTerrain } from './surface/terrain.js';
import { createSurfaceLander } from './surface/lander.js';
import { createSurfaceSky, dirFromAngles } from './surface/sky.js';
import { WALK_RADIUS, FOOTPRINT_SPACING, getSurfaceStart } from '../game/surfaceStats.js';
import { SITES, getSite } from '../data/sites.js';
import { getMission, setMission } from '../game/state.js';
import { isDev } from '../dev/devFlag.js';
import { createBaseBuilder } from './surface/baseBuilder.js';
import { getWalkVectors, moveStep } from '../game/walkMath.js';
import { validateInstancedMeshes } from '../game/earthNav.js';

export function createSurfaceScene(containerElement) {
  if (!containerElement) throw new Error('Container required for surface scene');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 7000);
  camera.layers.enable(1);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const canvas = renderer.domElement;
  canvas.className = 'surface-canvas';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  containerElement.appendChild(canvas);

  let terrainInst = null;
  let landerInst = null;
  let skyInst = null;
  let baseBuilderInst = null;

  let currentSite = SITES[0];
  let currentStats = getSurfaceStart({}, {}, currentSite);

  // Player position and look state
  const playerPos = new THREE.Vector3(0, 0, -3.0);
  let yaw = 0;
  let pitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  // Controls state
  const keysDown = new Set();
  let touchWalkDir = 0;
  const tmpCamDir = new THREE.Vector3();
  let lastWalkVectors = { forward: { x: 0, z: -1 }, right: { x: 1, z: 0 } };
  let walkedDistance = 0;
  let isLeftStep = false;
  let bobPhase = 0;

  // Ladder animation state
  let isLadderDescending = false;
  let ladderElapsed = 0;
  const ladderDuration = 4.5;
  const ladderCallbacks = [];
  let freeControlsUnlocked = false;

  // Controls lock and camera fly
  let controlsLocked = false;
  let flyState = null;

  // Loop & timing
  const clock = new THREE.Clock();
  let isRunningState = false;
  let animId = null;
  let autoCheckTimer = null;

  // Dust puff pool (8 particles)
  const DUST_COUNT = 8;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  const dustVel = new Float32Array(DUST_COUNT * 3);
  const dustLife = new Float32Array(DUST_COUNT);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0x9098a4,
    size: 5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.frustumCulled = false;
  scene.add(dustPoints);

  function spawnDustPuff(x, y, z, moveAngle = null) {
    const kickX = typeof moveAngle === 'number' ? Math.sin(moveAngle) * 0.15 : 0;
    const kickZ = typeof moveAngle === 'number' ? Math.cos(moveAngle) * 0.15 : 0;
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPos[i * 3] = x + (Math.random() - 0.5) * 0.2;
      dustPos[i * 3 + 1] = y + 0.05;
      dustPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
      dustVel[i * 3] = (Math.random() - 0.5) * 0.3 + kickX;
      dustVel[i * 3 + 1] = 0.25 + Math.random() * 0.25;
      dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.3 + kickZ;
      dustLife[i] = 1.0;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.opacity = 0.5;
  }

  function puffAt(pos) {
    if (!pos) return;
    spawnDustPuff(pos.x, pos.y, pos.z);
  }

  function updateDust(dt) {
    if (dustMat.opacity <= 0.01) return;
    let anyAlive = false;
    for (let i = 0; i < DUST_COUNT; i++) {
      if (dustLife[i] > 0) {
        dustLife[i] -= dt * 1.2;
        dustPos[i * 3] += dustVel[i * 3] * dt;
        dustPos[i * 3 + 1] += dustVel[i * 3 + 1] * dt;
        dustPos[i * 3 + 2] += dustVel[i * 3 + 2] * dt;
        dustVel[i * 3 + 1] -= 0.35 * dt; // Moon gravity ~1/6th
        if (dustLife[i] > 0) anyAlive = true;
      }
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.opacity = anyAlive ? Math.max(0, dustMat.opacity - dt * 0.5) : 0;
  }

  function getSettings() {
    let s = { invertH: false, invertV: false, sensH: 1, sensV: 1 };
    try {
      const raw = localStorage.getItem('moonshot_settings_v1');
      if (raw) s = { ...s, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return s;
  }

  // Pointer drag look
  canvas.addEventListener('pointerdown', (e) => {
    if (controlsLocked || e.button !== 0 || e.target.closest('#settings-btn, #settings-panel, #cockpit-dev-back-btn, .surface-hud-btn')) return;
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (controlsLocked || !isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    const st = getSettings();
    const hMult = st.invertH ? -1 : 1;
    const vMult = st.invertV ? -1 : 1;
    const sensFactor = 0.0035;

    targetYaw -= dx * sensFactor * st.sensH * hMult;
    targetPitch += dy * sensFactor * st.sensV * vMult;

    if (isLadderDescending) {
      targetYaw = Math.max(-0.44, Math.min(0.44, targetYaw)); // +-25 deg
      targetPitch = Math.max(-0.61, Math.min(0.35, targetPitch)); // -35 to +20 deg
    } else {
      targetPitch = Math.max(-1.05, Math.min(1.48, targetPitch)); // -60 to +85 deg
    }
  });

  const onPointerUp = (e) => {
    if (isDragging) {
      isDragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  };
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (controlsLocked || e.target.tagName === 'INPUT') return;
    keysDown.add(e.key);
  });
  window.addEventListener('keyup', (e) => {
    if (controlsLocked) return;
    keysDown.delete(e.key);
  });

  function resize() {
    const w = containerElement.clientWidth || window.innerWidth;
    const h = containerElement.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function stop() {
    isRunningState = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (autoCheckTimer) { clearTimeout(autoCheckTimer); autoCheckTimer = null; }
  }

  function animate() {
    if (!isRunningState) return;
    animId = requestAnimationFrame(animate);

    const rawDelta = clock.getDelta();
    const dt = Math.min(0.08, rawDelta);
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (baseBuilderInst) {
      baseBuilderInst.update(dt);
    }

    yaw += (targetYaw - yaw) * 0.25;
    pitch += (targetPitch - pitch) * 0.25;

    if (flyState) {
      flyState.elapsed += dt;
      const p = Math.min(1.0, flyState.elapsed / flyState.duration);
      const ease = p * p * (3.0 - 2.0 * p);
      const lift = Math.sin(p * Math.PI) * 0.8;

      camera.position.x = flyState.startPos.x + (flyState.endPos.x - flyState.startPos.x) * ease;
      camera.position.y = flyState.startPos.y + (flyState.endPos.y - flyState.startPos.y) * ease + lift;
      camera.position.z = flyState.startPos.z + (flyState.endPos.z - flyState.startPos.z) * ease;

      yaw = flyState.startYaw + (flyState.endYaw - flyState.startYaw) * ease;
      pitch = flyState.startPitch + (flyState.endPitch - flyState.startPitch) * ease;
      targetYaw = yaw;
      targetPitch = pitch;
      camera.rotation.set(pitch, yaw, 0, 'YXZ');

      if (p >= 1.0) {
        camera.position.copy(flyState.endPos);
        yaw = flyState.endYaw;
        pitch = flyState.endPitch;
        targetYaw = yaw;
        targetPitch = pitch;
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
        camera.updateMatrixWorld(true);
        const cb = flyState.onDone;
        flyState = null;
        if (typeof cb === 'function') {
          try { cb(); } catch (err) { console.error(err); }
        }
      }
    } else if (isLadderDescending) {
      ladderElapsed += dt;
      const p = Math.min(1.0, ladderElapsed / ladderDuration);
      const ease = p * p * (3 - 2 * p);

      const rungDips = Math.sin(p * Math.PI * 8) * 0.04;
      const startY = 4.4;
      const targetY = surfaceHeight(0, -3.0) + 1.7;
      const curY = startY + (targetY - startY) * ease + rungDips * (1 - ease);
      const curZ = -3.2 + ( -3.0 - (-3.2) ) * ease;
      camera.position.set(0, curY, curZ);

      const curPitch = -0.314 * (1 - ease);
      camera.rotation.set(pitch + curPitch, yaw, 0, 'YXZ');

      if (p >= 1.0) {
        isLadderDescending = false;
        freeControlsUnlocked = true;
        pitch = 0; targetPitch = 0;
        for (let i = 0; i < ladderCallbacks.length; i++) {
          try { ladderCallbacks[i](); } catch (err) { console.error(err); }
        }
      }
    } else {
      camera.rotation.set(pitch, yaw, 0, 'YXZ');

      let forward = 0;
      let strafe = 0;

      if (!controlsLocked) {
        if (keysDown.has('w') || keysDown.has('W') || keysDown.has('ArrowUp')) forward += 1;
        if (keysDown.has('s') || keysDown.has('S') || keysDown.has('ArrowDown')) forward -= 1;
        if (keysDown.has('a') || keysDown.has('A') || keysDown.has('ArrowLeft')) strafe -= 1;
        if (keysDown.has('d') || keysDown.has('D') || keysDown.has('ArrowRight')) strafe += 1;
        if (touchWalkDir !== 0) forward += touchWalkDir;
      }

      forward = Math.max(-1, Math.min(1, forward));
      strafe = Math.max(-1, Math.min(1, strafe));

      camera.getWorldDirection(tmpCamDir);
      const walkVectors = getWalkVectors(tmpCamDir.x, tmpCamDir.z, lastWalkVectors);
      lastWalkVectors = walkVectors;

      const isWalking = forward !== 0 || strafe !== 0;
      if (isWalking) {
        const speed = currentStats.walkSpeed || 1.35;
        const { dx, dz } = moveStep({ forward, strafe }, walkVectors, speed, dt);

        const nextX = playerPos.x + dx;
        const nextZ = playerPos.z + dz;
        const nextDist = Math.hypot(nextX, nextZ);

        if (nextDist >= 3.0 && nextDist <= WALK_RADIUS) {
          playerPos.x = nextX;
          playerPos.z = nextZ;
        }

        const stepDist = Math.hypot(dx, dz);
        walkedDistance += stepDist;
        if (walkedDistance >= FOOTPRINT_SPACING) {
          walkedDistance = 0;
          isLeftStep = !isLeftStep;
          const moveAngle = Math.atan2(-dx, -dz);
          if (terrainInst) terrainInst.addFootprint(playerPos, moveAngle, isLeftStep);
          if (!prefersReduced) spawnDustPuff(playerPos.x, surfaceHeight(playerPos.x, playerPos.z), playerPos.z, moveAngle);
        }

        if (!prefersReduced) bobPhase += dt * 1.1 * Math.PI * 2;
      }

      const bobY = (!prefersReduced && isWalking) ? Math.sin(bobPhase) * 0.05 : 0;
      const groundY = surfaceHeight(playerPos.x, playerPos.z);
      camera.position.set(playerPos.x, groundY + 1.7 + bobY, playerPos.z);
    }

    if (skyInst?.update) skyInst.update(dt, prefersReduced);
    if (!prefersReduced) updateDust(dt);

    renderer.render(scene, camera);
  }

  function start(options = {}) {
    const site = options.site || getSite(getMission().landingSite || 'ridge') || SITES[0];
    const mission = getMission();
    const stats = options.stats || getSurfaceStart(mission, null, site);
    const skipLadder = Boolean(options.skipLadder);

    currentSite = site;
    currentStats = stats;

    camera.fov = stats.fov || 72;
    camera.updateProjectionMatrix();

    if (terrainInst) terrainInst.dispose();
    if (landerInst) landerInst.dispose();
    if (skyInst) skyInst.dispose();

    terrainInst = createSurfaceTerrain({ scene, site });
    landerInst = createSurfaceLander({ scene, site, damage: mission.damage || 'none' });
    skyInst = createSurfaceSky({ scene, site });

    if (baseBuilderInst) {
      baseBuilderInst.reset();
      baseBuilderInst.prepare(currentSite.id);
    } else {
      try {
        baseBuilderInst = createBaseBuilder({
          scene,
          getHeight: surfaceHeight,
          lander: landerInst,
          puffAt,
          site: currentSite
        });
        if (baseBuilderInst) {
          baseBuilderInst.prepare(currentSite.id);
        }
      } catch (err) {
        console.error('EarthScene part failed: base builder', err);
      }
    }

    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    playerPos.set(0, 0, -3.0);
    walkedDistance = 0;
    keysDown.clear();
    touchWalkDir = 0;

    if (skipLadder || prefersReduced) {
      isLadderDescending = false;
      freeControlsUnlocked = true;
      yaw = 0; pitch = 0; targetYaw = 0; targetPitch = 0;
      camera.position.set(0, surfaceHeight(0, -3.0) + 1.7, -3.0);
      for (let i = 0; i < ladderCallbacks.length; i++) {
        try { ladderCallbacks[i](); } catch (err) { console.error(err); }
      }
    } else {
      isLadderDescending = true;
      freeControlsUnlocked = false;
      ladderElapsed = 0;
      yaw = 0; pitch = -0.314; targetYaw = 0; targetPitch = -0.314; // -18 deg
      camera.position.set(0, 4.4, -3.2);
    }

    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.updateMatrixWorld(true);

    clock.start();
    isRunningState = true;
    resize();

    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(animate);

    if (isDev) {
      validateInstancedMeshes(scene);
      if (autoCheckTimer) clearTimeout(autoCheckTimer);
      autoCheckTimer = setTimeout(() => {
        try {
          if (typeof window !== 'undefined' && typeof window.__surfaceCheck === 'function') {
            window.__surfaceCheck(site.id);
          }
        } catch (err) {
          console.error('Surface check call error:', err);
        }
      }, (skipLadder || prefersReduced ? 1000 : 5500));
    }
  }

  function takePhoto() {
    return new Promise((resolve) => {
      try {
        renderer.render(scene, camera);
        const w = canvas.width;
        const h = canvas.height;
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d');

        const bw = Math.round(w * 0.02);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        const stripH = Math.max(36, Math.round(h * 0.07));
        ctx.drawImage(canvas, bw, bw, w - bw * 2, h - bw * 2 - stripH);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(bw, h - bw - stripH, w - bw * 2, stripH);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = `600 ${Math.round(stripH * 0.42)}px 'Space Grotesk', sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(`Earth from the Moon • ${currentSite.name}`, bw + 18, h - bw - stripH * 0.5);

        off.toBlob((blob) => {
          if (!blob) { resolve(false); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'earth-from-the-moon.png';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
            resolve(true);
          }, 150);
        }, 'image/png');
      } catch (err) {
        console.error('EarthScene part failed: takePhoto', err);
        resolve(false);
      }
    });
  }

  function getView() {
    return {
      yaw,
      pitch,
      position: camera.position.clone(),
      fov: camera.fov,
    };
  }

  function setWalk(dir) {
    touchWalkDir = dir === 1 ? 1 : (dir === -1 ? -1 : 0);
  }

  function lockControls(bool) {
    controlsLocked = Boolean(bool);
    if (controlsLocked) {
      keysDown.clear();
      isDragging = false;
      touchWalkDir = 0;
    }
  }

  function flyCamera(pose, seconds, onDone) {
    if (!pose || !pose.position) return;
    const dur = Math.max(0.01, seconds || 2.0);
    const endPos = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z);

    let endYawVal = yaw;
    let endPitchVal = pitch;

    if (pose.lookAt) {
      const dx = pose.lookAt.x - endPos.x;
      const dy = pose.lookAt.y - endPos.y;
      const dz = pose.lookAt.z - endPos.z;
      endYawVal = Math.atan2(-dx, -dz);
      endPitchVal = Math.atan2(dy, Math.hypot(dx, dz));
    } else {
      if (typeof pose.yaw === 'number') endYawVal = pose.yaw;
      if (typeof pose.pitch === 'number') endPitchVal = pose.pitch;
    }

    let diffYaw = endYawVal - yaw;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;

    flyState = {
      startPos: camera.position.clone(),
      endPos,
      startYaw: yaw,
      endYaw: yaw + diffYaw,
      startPitch: pitch,
      endPitch: endPitchVal,
      duration: dur,
      elapsed: 0,
      onDone,
    };
  }

  function getPose() {
    return {
      position: camera.position.clone(),
      yaw,
      pitch,
    };
  }

  function setPose(pose) {
    if (!pose) return;
    if (pose.position) {
      const nextX = pose.position.x;
      const nextZ = pose.position.z;
      const dist = Math.hypot(nextX, nextZ);
      let clampedX = nextX;
      let clampedZ = nextZ;
      if (dist < 3.0) {
        const factor = 3.0 / Math.max(0.001, dist);
        clampedX *= factor;
        clampedZ *= factor;
      } else if (dist > WALK_RADIUS) {
        const factor = WALK_RADIUS / dist;
        clampedX *= factor;
        clampedZ *= factor;
      }
      playerPos.set(clampedX, 0, clampedZ);
      const groundY = surfaceHeight(clampedX, clampedZ);
      const eyeY = Number.isFinite(pose.position.y) ? pose.position.y : groundY + 1.7;
      camera.position.set(clampedX, eyeY, clampedZ);
    }
    let nextYaw = typeof pose.yaw === 'number' ? pose.yaw : null;
    let nextPitch = typeof pose.pitch === 'number' ? pose.pitch : null;
    if (nextYaw === null && pose.lookAt && pose.position) {
      const dx = pose.lookAt.x - pose.position.x;
      const dy = pose.lookAt.y - (pose.position.y || 1.7);
      const dz = pose.lookAt.z - pose.position.z;
      nextYaw = Math.atan2(-dx, -dz);
      nextPitch = Math.atan2(dy, Math.hypot(dx, dz));
    }
    if (typeof nextYaw === 'number') {
      yaw = nextYaw;
      targetYaw = nextYaw;
    }
    if (typeof nextPitch === 'number') {
      pitch = nextPitch;
      targetPitch = nextPitch;
    }
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.updateMatrixWorld(true);
  }

  function onLadderDone(cb) {
    if (typeof cb === 'function') ladderCallbacks.push(cb);
  }

  function dispose() {
    stop();
    if (terrainInst) terrainInst.dispose();
    if (landerInst) landerInst.dispose();
    if (skyInst) skyInst.dispose();
    if (baseBuilderInst) { baseBuilderInst.dispose(); baseBuilderInst = null; }
    dustGeo.dispose();
    dustMat.dispose();
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    start,
    stop,
    isRunning: () => isRunningState,
    resize,
    takePhoto,
    getView,
    setWalk,
    lockControls,
    flyCamera,
    getPose,
    setPose,
    puffAt,
    getLander: () => landerInst,
    getBaseBuilder: () => baseBuilderInst,
    onLadderDone,
    dispose,
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
  };
}

export default createSurfaceScene;
