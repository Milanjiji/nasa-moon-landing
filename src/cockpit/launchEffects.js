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

// ---------------------------------------------------------------------------
// 1) Sky Dome Effect
// ---------------------------------------------------------------------------
function createSkyDome(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#050914'); grad.addColorStop(1, '#0e1a33');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(320, 24, 16);
  checkFinite(geo, 'launch-sky-dome');
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, transparent: true, opacity: 1, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'launch-sky-dome';
  mesh.renderOrder = -10;
  scene.add(mesh);

  return {
    setFade(skyFade) {
      mat.opacity = Math.max(0, Math.min(1, skyFade));
      mesh.visible = mat.opacity > 0.001;
    },
    reset() { mat.opacity = 1; mesh.visible = true; },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); texture.dispose(); },
  };
}

// ---------------------------------------------------------------------------
// 2) Ground Strip & Floodlights
// ---------------------------------------------------------------------------
function createGroundStrip(scene) {
  const group = new THREE.Group();
  group.name = 'launch-ground-group';

  const gCanvas = document.createElement('canvas');
  gCanvas.width = 128; gCanvas.height = 128;
  const gctx = gCanvas.getContext('2d');
  gctx.fillStyle = '#16231a'; gctx.fillRect(0, 0, 128, 128);
  gctx.fillStyle = '#1c2d22';
  for (let i = 0; i < 40; i++) gctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  const gTex = new THREE.CanvasTexture(gCanvas);
  gTex.wrapS = THREE.RepeatWrapping; gTex.wrapT = THREE.RepeatWrapping; gTex.repeat.set(16, 16);

  const discGeo = new THREE.CircleGeometry(600, 48);
  discGeo.rotateX(-Math.PI / 2);
  checkFinite(discGeo, 'launch-ground-disc');
  const discMat = new THREE.MeshBasicMaterial({ map: gTex, transparent: true, opacity: 1, depthWrite: false });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.set(0, -14, -100);
  group.add(disc);

  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = 64; lightCanvas.height = 64;
  const lctx = lightCanvas.getContext('2d');
  const lGrad = lctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  lGrad.addColorStop(0, 'rgba(215, 230, 255, 0.9)');
  lGrad.addColorStop(0.3, 'rgba(160, 200, 255, 0.4)');
  lGrad.addColorStop(1, 'rgba(160, 200, 255, 0)');
  lctx.fillStyle = lGrad; lctx.fillRect(0, 0, 64, 64);
  const lightTex = new THREE.CanvasTexture(lightCanvas);

  const sprites = [];
  const lightOffsets = [-30, -10, 10, 30];
  for (let i = 0; i < lightOffsets.length; i++) {
    const spMat = new THREE.SpriteMaterial({ map: lightTex, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85, depthWrite: false });
    const sp = new THREE.Sprite(spMat);
    sp.position.set(lightOffsets[i], -12, -90);
    sp.scale.set(16, 16, 1);
    group.add(sp);
    sprites.push({ sprite: sp, mat: spMat });
  }
  scene.add(group);

  return {
    update(altitudeKm) {
      if (altitudeKm >= 60) { group.visible = false; return; }
      group.visible = true;
      const frac = Math.min(1, altitudeKm / 60);
      disc.position.y = -14 - (frac * frac) * 406;
      const op = Math.max(0, 1 - frac);
      discMat.opacity = op;
      for (let i = 0; i < sprites.length; i++) sprites[i].mat.opacity = op * 0.85;
    },
    reset() {
      disc.position.y = -14; discMat.opacity = 1;
      for (let i = 0; i < sprites.length; i++) sprites[i].mat.opacity = 0.85;
      group.visible = true;
    },
    dispose() {
      scene.remove(group); discGeo.dispose(); discMat.dispose(); gTex.dispose(); lightTex.dispose();
      for (let i = 0; i < sprites.length; i++) sprites[i].mat.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 3) Speed Streaks Effect
// ---------------------------------------------------------------------------
function createSpeedStreaks(scene) {
  const count = 40;
  const streakGeo = new THREE.BoxGeometry(0.04, 1.8, 0.04);
  checkFinite(streakGeo, 'launch-streak-geo');
  const streakMat = new THREE.MeshBasicMaterial({ color: 0xcbe3ff, transparent: true, opacity: 0.25, depthWrite: false });
  const instMesh = new THREE.InstancedMesh(streakGeo, streakMat, count);
  instMesh.name = 'launch-speed-streaks';

  const dummy = new THREE.Object3D();
  const streakData = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 14, y = Math.random() * 24 - 4, z = -6 - Math.random() * 28;
    streakData.push({ x, y, z, speedMul: 0.8 + Math.random() * 0.5 });
    dummy.position.set(x, y, z); dummy.updateMatrix();
    instMesh.setMatrixAt(i, dummy.matrix);
  }
  instMesh.instanceMatrix.needsUpdate = true;
  scene.add(instMesh);

  return {
    update(altitudeKm, speedKmh, delta, prefersReduced) {
      if (prefersReduced || altitudeKm >= 60 || speedKmh < 100) { instMesh.visible = false; return; }
      instMesh.visible = true;
      streakMat.opacity = Math.max(0, 0.25 * (1 - altitudeKm / 60));
      const dy = (speedKmh * 0.003 + 2.0) * delta;
      for (let i = 0; i < count; i++) {
        const sd = streakData[i];
        sd.y -= dy * sd.speedMul;
        if (sd.y < -12) { sd.y = 16 + Math.random() * 4; sd.x = (Math.random() - 0.5) * 14; }
        dummy.position.set(sd.x, sd.y, sd.z); dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);
      }
      instMesh.instanceMatrix.needsUpdate = true;
    },
    reset() { instMesh.visible = false; streakMat.opacity = 0.25; },
    dispose() { scene.remove(instMesh); streakGeo.dispose(); streakMat.dispose(); },
  };
}

// ---------------------------------------------------------------------------
// 4) 2D DOM Overlays (Engine Flame, G-Vignette, Flash, Caption)
// ---------------------------------------------------------------------------
function createDomOverlays(uiRoot) {
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15;overflow:hidden;';

  const flameEl = document.createElement('div');
  flameEl.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse at bottom, rgba(255,150,60,0.55) 0%, rgba(255,120,30,0.22) 28%, transparent 55%);opacity:0;display:none;';
  container.appendChild(flameEl);

  const vignetteEl = document.createElement('div');
  vignetteEl.style.cssText = 'position:absolute;inset:0;background:radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.85) 100%);opacity:0;display:none;';
  container.appendChild(vignetteEl);

  const flashEl = document.createElement('div');
  flashEl.style.cssText = 'position:absolute;inset:0;background:#ffffff;opacity:0;display:none;transition:opacity 0.15s ease;';
  container.appendChild(flashEl);

  const captionEl = document.createElement('div');
  captionEl.setAttribute('aria-live', 'polite');
  captionEl.style.cssText = 'position:absolute;bottom:42px;left:50%;transform:translateX(-50%);font-family:\'Space Grotesk\', sans-serif;font-size:1.05rem;font-weight:600;color:#e8f3ff;background:rgba(7,18,42,0.85);border:1px solid #3fd0ff;border-radius:999px;padding:8px 24px;opacity:0;display:none;transition:opacity 0.3s ease;';
  container.appendChild(captionEl);

  uiRoot.appendChild(container);
  let smoothedVignette = 0, flashTimer = null;

  return {
    setFlame(flameVal, prefersReduced) {
      if (flameVal <= 0.01) { flameEl.style.display = 'none'; flameEl.style.opacity = '0'; return; }
      flameEl.style.display = 'block';
      flameEl.style.opacity = (flameVal * (prefersReduced ? 0.9 : 0.8 + 0.2 * Math.random())).toFixed(3);
    },
    setVignette(gVal, delta) {
      const target = Math.max(0, Math.min(1, (gVal - 2.2) / 1.6)) * 0.6;
      smoothedVignette += (target - smoothedVignette) * Math.min(1, delta * 5);
      if (smoothedVignette <= 0.005) { vignetteEl.style.display = 'none'; vignetteEl.style.opacity = '0'; }
      else { vignetteEl.style.display = 'block'; vignetteEl.style.opacity = smoothedVignette.toFixed(3); }
    },
    triggerFlash(peak) {
      if (flashTimer) clearTimeout(flashTimer);
      flashEl.style.display = 'block'; flashEl.style.opacity = peak.toString();
      flashTimer = setTimeout(() => { flashEl.style.opacity = '0'; flashTimer = setTimeout(() => { flashEl.style.display = 'none'; }, 150); }, 100);
    },
    setCaption(text) {
      if (!text) { captionEl.style.opacity = '0'; setTimeout(() => { captionEl.style.display = 'none'; }, 300); return; }
      captionEl.textContent = text; captionEl.style.display = 'block';
      requestAnimationFrame(() => { captionEl.style.opacity = '1'; });
    },
    reset() {
      flameEl.style.display = 'none'; flameEl.style.opacity = '0';
      vignetteEl.style.display = 'none'; vignetteEl.style.opacity = '0';
      flashEl.style.display = 'none'; flashEl.style.opacity = '0';
      captionEl.style.display = 'none'; captionEl.style.opacity = '0';
      smoothedVignette = 0;
      if (flashTimer) clearTimeout(flashTimer);
    },
    dispose() { if (container.parentNode) container.parentNode.removeChild(container); },
  };
}

// ---------------------------------------------------------------------------
// 5) Main Launch Visual Effects Manager
// ---------------------------------------------------------------------------
export function createLaunchEffects({ scene, camera, renderer, outside, uiRoot }) {
  if (!scene || !camera || !uiRoot) throw new Error('scene, camera, and uiRoot required for createLaunchEffects');

  let skyDome = null, groundStrip = null, speedStreaks = null, domOverlays = null;
  try { skyDome = createSkyDome(scene); } catch (e) { console.error('EarthScene part failed: launch sky dome', e); }
  try { groundStrip = createGroundStrip(scene); } catch (e) { console.error('EarthScene part failed: launch ground strip', e); }
  try { speedStreaks = createSpeedStreaks(scene); } catch (e) { console.error('EarthScene part failed: launch speed streaks', e); }
  try { domOverlays = createDomOverlays(uiRoot); } catch (e) { console.error('EarthScene part failed: launch dom overlays', e); }

  const baseEarthOrbitY = -2372.54;

  const interiorMats = [];
  scene.traverse((obj) => {
    if (obj.isMesh && (obj.name === 'cockpit-strip' || obj.name === 'trim-front' || obj.name === 'trim-back')) {
      if (obj.material?.emissive) {
        interiorMats.push({ mat: obj.material, origEmissive: obj.material.emissive.clone(), origIntensity: obj.material.emissiveIntensity });
      }
    }
  });

  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  let shakeTime = 0, prevShakeX = 0, prevShakeY = 0, prevShakeZ = 0, prevRotX = 0, prevRotY = 0;
  let lastSeparationFired = false, lastIgnitionFired = false;

  function setFrame(frame, delta) {
    camera.position.x -= prevShakeX; camera.position.y -= prevShakeY; camera.position.z -= prevShakeZ;
    camera.rotation.x -= prevRotX; camera.rotation.y -= prevRotY;

    if (!prefersReduced && frame.shake > 0) {
      shakeTime += delta;
      const s1 = Math.sin(shakeTime * 11 * Math.PI * 2), s2 = Math.sin(shakeTime * 17 * Math.PI * 2 + 1.3), s3 = Math.sin(shakeTime * 23 * Math.PI * 2 + 2.7);
      const ampPos = 0.012 * frame.shake, ampRot = (0.18 * Math.PI / 180) * frame.shake;
      prevShakeX = (s1 * 0.5 + s2 * 0.3 + s3 * 0.2) * ampPos;
      prevShakeY = (s2 * 0.5 + s3 * 0.3 + s1 * 0.2) * ampPos;
      prevShakeZ = (s3 * 0.5 + s1 * 0.3 + s2 * 0.2) * ampPos * 0.5;
      prevRotX = (s1 * 0.6 + s3 * 0.4) * ampRot;
      prevRotY = (s2 * 0.6 + s1 * 0.4) * ampRot;
      camera.position.x += prevShakeX; camera.position.y += prevShakeY; camera.position.z += prevShakeZ;
      camera.rotation.x += prevRotX; camera.rotation.y += prevRotY;
    } else {
      prevShakeX = 0; prevShakeY = 0; prevShakeZ = 0; prevRotX = 0; prevRotY = 0;
    }

    if (skyDome) skyDome.setFade(frame.skyFade);
    if (groundStrip) groundStrip.update(frame.altitudeKm);
    if (speedStreaks) speedStreaks.update(frame.altitudeKm, frame.speedKmh, delta, prefersReduced);

    if (outside?.orbitEarth?.earthGroup) {
      const easeRise = frame.earthRise < 0.5 ? 2 * frame.earthRise * frame.earthRise : -1 + (4 - 2 * frame.earthRise) * frame.earthRise;
      const curY = baseEarthOrbitY - 700 * (1 - easeRise);
      outside.orbitEarth.earthGroup.position.y = curY;
    }

    if (outside?.stars?.material) {
      outside.stars.material.size = 2.0 * (1.0 + 0.25 * (1.0 - frame.skyFade));
    }

    if (domOverlays) {
      domOverlays.setFlame(frame.flame, prefersReduced);
      domOverlays.setVignette(frame.g, delta);
      if (!prefersReduced) {
        if (frame.stage === 'ignition' && !lastIgnitionFired) { lastIgnitionFired = true; domOverlays.triggerFlash(0.12); }
        if (frame.stage === 'separation' && !lastSeparationFired) { lastSeparationFired = true; domOverlays.triggerFlash(0.35); }
      }
    }

    if (frame.stage === 'prelaunch' || frame.stage === 'ignition') {
      const pulse = 0.5 + 0.5 * Math.sin(shakeTime * Math.PI * 2);
      for (let i = 0; i < interiorMats.length; i++) {
        interiorMats[i].mat.emissive.setHex(0xffb020);
        interiorMats[i].mat.emissiveIntensity = interiorMats[i].origIntensity * (0.8 + 0.6 * pulse);
      }
    } else {
      for (let i = 0; i < interiorMats.length; i++) {
        interiorMats[i].mat.emissive.copy(interiorMats[i].origEmissive);
        interiorMats[i].mat.emissiveIntensity = interiorMats[i].origIntensity;
      }
    }
  }

  function reset() {
    camera.position.x -= prevShakeX; camera.position.y -= prevShakeY; camera.position.z -= prevShakeZ;
    camera.rotation.x -= prevRotX; camera.rotation.y -= prevRotY;
    prevShakeX = 0; prevShakeY = 0; prevShakeZ = 0; prevRotX = 0; prevRotY = 0;
    shakeTime = 0; lastSeparationFired = false; lastIgnitionFired = false;

    if (skyDome) skyDome.reset();
    if (groundStrip) groundStrip.reset();
    if (speedStreaks) speedStreaks.reset();
    if (domOverlays) domOverlays.reset();

    if (outside?.orbitEarth?.earthGroup) {
      outside.orbitEarth.earthGroup.position.y = baseEarthOrbitY - 700;
    }
    if (outside?.stars?.material) outside.stars.material.size = 2.0;
    for (let i = 0; i < interiorMats.length; i++) {
      interiorMats[i].mat.emissive.copy(interiorMats[i].origEmissive);
      interiorMats[i].mat.emissiveIntensity = interiorMats[i].origIntensity;
    }
  }

  function setCaption(text) { if (domOverlays) domOverlays.setCaption(text); }

  function dispose() {
    reset();
    if (skyDome) skyDome.dispose();
    if (groundStrip) groundStrip.dispose();
    if (speedStreaks) speedStreaks.dispose();
    if (domOverlays) domOverlays.dispose();
  }

  reset();

  return { setFrame, setCaption, reset, dispose };
}

export default createLaunchEffects;
