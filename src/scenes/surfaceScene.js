import * as THREE from 'three';
import { surfaceHeight, createSurfaceTerrain } from './surface/terrain.js';
import { createSurfaceLander } from './surface/lander.js';
import { createSurfaceSky, dirFromAngles } from './surface/sky.js';
import { WALK_RADIUS, FOOTPRINT_SPACING, getSurfaceStart } from '../game/surfaceStats.js';
import { SITES, getSite } from '../data/sites.js';
import { getMission, setMission } from '../game/state.js';

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
  let walkedDistance = 0;
  let isLeftStep = false;
  let bobPhase = 0;

  // Ladder animation state
  let isLadderDescending = false;
  let ladderElapsed = 0;
  const ladderDuration = 4.5;
  const ladderCallbacks = [];
  let freeControlsUnlocked = false;

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

  function spawnDustPuff(x, y, z) {
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPos[i * 3] = x + (Math.random() - 0.5) * 0.2;
      dustPos[i * 3 + 1] = y + 0.05;
      dustPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
      dustVel[i * 3] = (Math.random() - 0.5) * 0.3;
      dustVel[i * 3 + 1] = 0.25 + Math.random() * 0.25;
      dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      dustLife[i] = 1.0;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.opacity = 0.5;
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
    if (e.button !== 0 || e.target.closest('#settings-btn, #settings-panel, #cockpit-dev-back-btn, .surface-hud-btn')) return;
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
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
    if (e.target.tagName === 'INPUT') return;
    keysDown.add(e.key);
  });
  window.addEventListener('keyup', (e) => {
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

    yaw += (targetYaw - yaw) * 0.25;
    pitch += (targetPitch - pitch) * 0.25;

    if (isLadderDescending) {
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

      if (keysDown.has('w') || keysDown.has('W') || keysDown.has('ArrowUp')) forward += 1;
      if (keysDown.has('s') || keysDown.has('S') || keysDown.has('ArrowDown')) forward -= 1;
      if (keysDown.has('a') || keysDown.has('A') || keysDown.has('ArrowLeft')) strafe -= 1;
      if (keysDown.has('d') || keysDown.has('D') || keysDown.has('ArrowRight')) strafe += 1;
      if (touchWalkDir !== 0) forward += touchWalkDir;

      const isWalking = forward !== 0 || strafe !== 0;
      if (isWalking) {
        const len = Math.hypot(forward, strafe);
        forward /= len;
        strafe /= len;

        const spd = (currentStats.walkSpeed || 1.35) * dt;
        const dx = (Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * spd;
        const dz = (-Math.cos(yaw) * forward + Math.sin(yaw) * strafe) * spd;

        const nextX = playerPos.x + dx;
        const nextZ = playerPos.z + dz;
        const nextDist = Math.hypot(nextX, nextZ);

        if (nextDist >= 3.0 && nextDist <= WALK_RADIUS) {
          playerPos.x = nextX;
          playerPos.z = nextZ;
        }

        walkedDistance += spd;
        if (walkedDistance >= FOOTPRINT_SPACING) {
          walkedDistance = 0;
          isLeftStep = !isLeftStep;
          if (terrainInst) terrainInst.addFootprint(playerPos, yaw, isLeftStep);
          if (!prefersReduced) spawnDustPuff(playerPos.x, surfaceHeight(playerPos.x, playerPos.z), playerPos.z);
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

    clock.start();
    isRunningState = true;
    resize();

    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(animate);

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

  function onLadderDone(cb) {
    if (typeof cb === 'function') ladderCallbacks.push(cb);
  }

  function dispose() {
    stop();
    if (terrainInst) terrainInst.dispose();
    if (landerInst) landerInst.dispose();
    if (skyInst) skyInst.dispose();
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
    onLadderDone,
    dispose,
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
  };
}

export default createSurfaceScene;
