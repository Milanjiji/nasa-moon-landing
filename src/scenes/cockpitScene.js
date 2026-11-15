import * as THREE from 'three';
import { createMoonTextures } from '../world/moonTexture.js';
import { createOrbitEarth } from '../world/orbitEarth.js';
import { computeOrbitCheck, computeArrivalCheck, computeLunarOrbitCheck, computeLandingSkyCheck } from '../world/orbitChecks.js';
import { ORBIT_VIEW, ARRIVAL_VIEW, LUNAR_ORBIT_VIEW, LANDING_SKY_VIEW } from '../game/outsideViews.js';
import { buildShell, buildWindow, buildSeats, buildLighting } from './cockpitCabin.js';
import { buildDashboard, checkCockpitVisibility, surfaceY } from './cockpitDashboard.js';
import { createScreens } from '../cockpit/screens.js';
import { createInteraction } from '../cockpit/interaction.js';
import { getLoadout, getMission, setMission } from '../game/state.js';
import { getItem } from '../data/gear.js';
import { createLaunchEffects } from '../cockpit/launchEffects.js';
import { createLaunchController } from '../cockpit/launchController.js';
import { createFlightEffects } from '../cockpit/flightEffects.js';
import { createFlightController } from '../cockpit/flightController.js';
import { createLandingController } from '../cockpit/landingController.js';
import { createFloaters } from '../cockpit/floaters.js';

export { surfaceY };

let globalOutsideRig = null;
export function getOutsideRig() {
  return globalOutsideRig;
}

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

export function createCockpitScene(containerElement) {
  if (!containerElement) throw new Error('Container element required for cockpit scene');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 7000);
  const baseCamPos = new THREE.Vector3(-0.55, 1.15, 0.35);
  camera.position.copy(baseCamPos);
  camera.lookAt(0.0, 1.20, -1.8);
  camera.rotation.order = 'YXZ';
  camera.layers.enable(1);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const canvas = renderer.domElement;
  canvas.className = 'cockpit-canvas';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  containerElement.appendChild(canvas);

  const outsideRig = new THREE.Group();
  outsideRig.name = 'outside-rig';
  scene.add(outsideRig);
  globalOutsideRig = outsideRig;

  const sunDir = new THREE.Vector3(0.577, 0.577, 0.577).normalize();
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sunLight.position.copy(sunDir.clone().multiplyScalar(5000));
  sunLight.target.position.set(0, 0, 0);
  sunLight.layers.set(1);
  sunLight.target.layers.set(1);
  outsideRig.add(sunLight);
  outsideRig.add(sunLight.target);

  const outsideHemi = new THREE.HemisphereLight(0x0a1226, 0x000000, 0.15);
  outsideHemi.layers.set(1);
  outsideRig.add(outsideHemi);

  const starGeo = new THREE.BufferGeometry();
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    let vx, vy, vz, len;
    do { vx = Math.random() * 2 - 1; vy = Math.random() * 2 - 1; vz = Math.random() * 2 - 1; len = Math.hypot(vx, vy, vz); } while (len < 1e-6);
    const inv = 5200 / len;
    positions[i * 3] = vx * inv; positions[i * 3 + 1] = vy * inv; positions[i * 3 + 2] = vz * inv;
    const c = Math.random() < 0.6 ? [0.95, 0.98, 1.0] : (Math.random() < 0.85 ? [0.82, 0.9, 1.0] : [1.0, 0.92, 0.82]);
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  checkFinite(starGeo, 'cockpit-stars');
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2, vertexColors: true, sizeAttenuation: false, fog: false }));
  stars.frustumCulled = false;
  stars.renderOrder = -20;
  stars.layers.set(1);
  outsideRig.add(stars);

  const baseMoonRad = 3600 * Math.tan(3 * Math.PI / 180);
  const moonTextures = createMoonTextures();
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(baseMoonRad, 64, 64), new THREE.MeshStandardMaterial({
    map: moonTextures.map, bumpMap: moonTextures.bumpMap, bumpScale: 0.04,
    emissiveMap: moonTextures.map, emissive: 0xffffff, emissiveIntensity: 0.04,
    roughness: 0.85, metalness: 0.02,
  }));
  moonMesh.name = 'moon';
  moonMesh.layers.set(1);
  outsideRig.add(moonMesh);

  const baseGlowSize = baseMoonRad * 2 * 2.2;
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = 128; glowCanvas.height = 128;
  const gctx = glowCanvas.getContext('2d'), grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(215, 230, 255, 0.25)'); grad.addColorStop(0.5, 'rgba(170, 200, 255, 0.08)'); grad.addColorStop(1, 'rgba(170, 200, 255, 0)');
  gctx.fillStyle = grad; gctx.fillRect(0, 0, 128, 128);
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), blending: THREE.AdditiveBlending, transparent: true, opacity: 0.25 }));
  glowSprite.layers.set(1);
  outsideRig.add(glowSprite);

  const orbitEarthInst = createOrbitEarth({ R: 2400, sunDir });
  outsideRig.add(orbitEarthInst.earthGroup);

  const baseEarthDist = 2590;
  const baseEarthPitchDeg = Math.asin(2400 / 2590) * (180 / Math.PI) - 1.5;

  const DEFAULT_VIEW = { ...ORBIT_VIEW };
  const outsideView = { ...DEFAULT_VIEW };

  function applyOutsideView() {
    const eRadPitch = (-baseEarthPitchDeg + outsideView.earthPitchDeg) * (Math.PI / 180);
    const eRadYaw = outsideView.earthYawDeg * (Math.PI / 180);
    const eDir = new THREE.Vector3(Math.sin(eRadYaw) * Math.cos(eRadPitch), Math.sin(eRadPitch), -Math.cos(eRadYaw) * Math.cos(eRadPitch)).normalize();
    orbitEarthInst.earthGroup.position.copy(baseCamPos).addScaledVector(eDir, baseEarthDist);
    orbitEarthInst.earthGroup.position.y += outsideView.earthOffsetY;
    orbitEarthInst.earthGroup.scale.set(outsideView.earthScale, outsideView.earthScale, outsideView.earthScale);

    const mRadPitch = (13 + outsideView.moonPitchDeg) * (Math.PI / 180);
    const mRadYaw = (16 + outsideView.moonYawDeg) * (Math.PI / 180);
    const mDir = new THREE.Vector3(Math.sin(mRadYaw) * Math.cos(mRadPitch), Math.sin(mRadPitch), -Math.cos(mRadYaw) * Math.cos(mRadPitch)).normalize();
    moonMesh.position.copy(baseCamPos).addScaledVector(mDir, outsideView.moonDistance);
    moonMesh.scale.set(outsideView.moonScale, outsideView.moonScale, outsideView.moonScale);

    glowSprite.position.copy(moonMesh.position);
    glowSprite.scale.set(baseGlowSize * outsideView.moonScale, baseGlowSize * outsideView.moonScale, 1);
    if (glowSprite.material) {
      const glowDistFactor = Math.max(0, Math.min(1, (outsideView.moonDistance - 400) / 3200));
      const scaleFade = outsideView.moonScale > 2.0 ? 0 : 1;
      glowSprite.material.opacity = 0.25 * glowDistFactor * scaleFade;
      glowSprite.visible = glowSprite.material.opacity > 0.005;
    }
  }
  applyOutsideView();

  function getOutsideView() {
    return { ...outsideView };
  }

  function setOutsideView(params) {
    if (!params || typeof params !== 'object') return;
    for (const [k, v] of Object.entries(params)) {
      if (typeof v !== 'number' || !isFinite(v)) { console.warn(`Invalid outside view ${k}:`, v); continue; }
      if (k in outsideView) outsideView[k] = v;
    }
    applyOutsideView();
  }

  let activeTween = null;
  function tweenOutsideView(target, seconds = 1.0, onDone) {
    if (!target || typeof target !== 'object') return;
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const dur = prefersReduced ? 0.2 : Math.max(0.05, seconds);
    const startVals = { ...outsideView }, endVals = {};
    for (const [k, v] of Object.entries(target)) { if (typeof v === 'number' && isFinite(v) && k in outsideView) endVals[k] = v; }
    activeTween = { startVals, endVals, duration: dur, elapsed: 0, onDone };
  }

  const updateFns = [];
  try { buildShell(scene); } catch (e) { console.error('EarthScene part failed: cockpit shell', e); }
  try { buildWindow(scene); } catch (e) { console.error('EarthScene part failed: cockpit window', e); }
  try { buildSeats(scene); } catch (e) { console.error('EarthScene part failed: cockpit seats', e); }
  try { buildLighting(scene); } catch (e) { console.error('EarthScene part failed: cockpit lighting', e); }

  let screenAnchors = {}, launchButtonMesh = null, interactiveTargets = [], sampleButtonsList = [];
  try {
    const dashResult = buildDashboard(scene, camera, updateFns);
    screenAnchors = dashResult.anchors;
    launchButtonMesh = dashResult.launchButton;
    sampleButtonsList = dashResult.sampleButtons;
    interactiveTargets = dashResult.interactiveTargets || [];
  } catch (e) { console.error('EarthScene part failed: cockpit dashboard', e); }

  let screensInstance = null;
  try { screensInstance = createScreens({ anchors: screenAnchors, getLoadout, renderer }); } catch (e) { console.error('EarthScene part failed: cockpit screens', e); }

  let floatersInstance = null;
  try { floatersInstance = createFloaters({ scene, camera, surfaceY }); } catch (e) { console.error('EarthScene part failed: orbit floaters', e); }

  let lastFrameObj = null;
  let launchEffectsInstance = null, launchControllerInstance = null;
  let flightEffectsInstance = null, flightControllerInstance = null;
  let landingControllerInstance = null;
  try {
    const root = containerElement || document.body;
    launchEffectsInstance = createLaunchEffects({ scene, camera, renderer, outside: { stars, moon: moonMesh, glowSprite, orbitEarth: orbitEarthInst }, uiRoot: root });
    const origSetFrame = launchEffectsInstance.setFrame;
    launchEffectsInstance.setFrame = (frame, delta) => { lastFrameObj = frame; origSetFrame(frame, delta); };
    launchControllerInstance = createLaunchController({ screens: screensInstance, effects: launchEffectsInstance, getLoadout, launchButtonMesh, uiRoot: root });

    flightEffectsInstance = createFlightEffects({ scene, camera, cabinLights: [], outsideRig, uiRoot: root });
    flightControllerInstance = createFlightController({ screens: screensInstance, effects: flightEffectsInstance, getLoadout, setOutsideView, uiRoot: root, floaters: floatersInstance });
    launchControllerInstance.onContinue(() => {
      const card = document.getElementById('orbit-reached-card');
      if (card) { card.style.opacity = '0'; card.style.display = 'none'; }
      if (flightControllerInstance) flightControllerInstance.start();
    });

    try {
      landingControllerInstance = createLandingController({
        scene, camera, cockpitScene: { setOutsideView }, screens: screensInstance,
        getLoadout, setOutsideView, uiRoot: root, floaters: floatersInstance,
      });
      flightControllerInstance.onLandPressed(() => {
        if (landingControllerInstance) landingControllerInstance.start();
      });
    } catch (e) { console.error('EarthScene part failed: landing', e); }
  } catch (error) { console.error('EarthScene part failed: launch or flight', error); }

  let customLaunchCallback = null;
  let interactionInstance = null;
  try {
    interactionInstance = createInteraction({
      domElement: canvas, camera, getTargets: () => interactiveTargets,
      onLaunchPressed: () => {
        if (typeof customLaunchCallback === 'function') customLaunchCallback();
        else if (launchControllerInstance) launchControllerInstance.start();
      },
      onLog: (text) => { if (screensInstance) screensInstance.setLogLine(text); },
    });
  } catch (e) { console.error('EarthScene part failed: cockpit interaction', e); }

  camera.rotation.order = 'YXZ';
  const startYaw = camera.rotation.y, startPitch = camera.rotation.x;
  const YAW_MIN = startYaw - 75 * (Math.PI / 180), YAW_MAX = startYaw + 75 * (Math.PI / 180);
  const PITCH_MIN = startPitch - 35 * (Math.PI / 180), PITCH_MAX = startPitch + 30 * (Math.PI / 180);
  let yaw = startYaw, pitch = startPitch, targetYaw = startYaw, targetPitch = startPitch;
  let isDragging = false, lastX = 0, lastY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('#settings-btn, #settings-panel, #cockpit-dev-back-btn')) return;
    isDragging = true; lastX = e.clientX; lastY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    targetYaw = Math.max(YAW_MIN, Math.min(YAW_MAX, targetYaw - dx * 0.0035));
    targetPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, targetPitch + dy * 0.0035));
  });
  const onPointerUp = (e) => { if (isDragging) { isDragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ } } };
  canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerUp);

  let swayTime = 0;
  const clock = new THREE.Clock();
  let isRunningState = false, animId = null, hasCheckedVisibility = false, hasScreenFitChecked = false;

  function resize() {
    const w = containerElement.clientWidth || window.innerWidth, h = containerElement.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function animate() {
    if (!isRunningState) return;
    animId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (activeTween) {
      activeTween.elapsed += delta;
      const p = Math.min(1.0, activeTween.elapsed / activeTween.duration);
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      const nextVals = {};
      for (const k of Object.keys(activeTween.endVals)) {
        nextVals[k] = activeTween.startVals[k] + (activeTween.endVals[k] - activeTween.startVals[k]) * ease;
      }
      setOutsideView(nextVals);
      if (p >= 1.0) {
        const cb = activeTween.onDone;
        activeTween = null;
        if (typeof cb === 'function') cb();
      }
    }

    yaw += (targetYaw - yaw) * 0.2; pitch += (targetPitch - pitch) * 0.2;
    camera.rotation.y = yaw; camera.rotation.x = pitch;

    if (floatersInstance) floatersInstance.update(delta, lastFrameObj, prefersReduced);
    const drift = floatersInstance ? floatersInstance.getDriftOffset() : { posX: 0, posY: 0, roll: 0, idleSwayWeight: 1.0 };
    if (!prefersReduced) {
      swayTime += delta * 0.8;
      const sx = Math.sin(swayTime) * 0.004 * drift.idleSwayWeight;
      const sy = Math.cos(swayTime * 0.7) * 0.003 * drift.idleSwayWeight;
      camera.position.set(baseCamPos.x + sx + drift.posX, baseCamPos.y + sy + drift.posY, baseCamPos.z);
      const landingRoll = landingControllerInstance ? landingControllerInstance.getRollOffset() : 0;
      camera.rotation.z = drift.roll + landingRoll;
    } else {
      camera.position.copy(baseCamPos);
      camera.rotation.z = 0;
    }

    moonMesh.rotation.y += delta * (prefersReduced ? 0.0005 : (outsideView.moonScale > 5 ? 0.015 : 0.002));
    orbitEarthInst.update(delta, prefersReduced);

    for (let i = 0; i < updateFns.length; i++) { try { updateFns[i](delta); } catch { /* ignore */ } }
    if (screensInstance) screensInstance.update(delta);
    if (launchControllerInstance) launchControllerInstance.update(delta);
    if (flightControllerInstance) flightControllerInstance.update(delta);
    if (landingControllerInstance) landingControllerInstance.update(delta);
    renderer.render(scene, camera);
  }

  function start() {
    if (isRunningState) return;
    isRunningState = true;
    clock.getDelta();
    if (screensInstance) screensInstance.reset();
    if (launchControllerInstance) launchControllerInstance.reset();
    if (flightControllerInstance) flightControllerInstance.reset();
    if (landingControllerInstance) landingControllerInstance.reset();
    if (floatersInstance) floatersInstance.reset();
    setOutsideView(DEFAULT_VIEW);

    if (interactionInstance) {
      try {
        const l = typeof getLoadout === 'function' ? getLoadout() : null, sel = l ? l.selection : null;
        const itemNames = sel ? ['suit', 'helmet', 'gloves', 'boots', 'backpack'].map((c) => getItem(c, sel[c])?.name).filter(Boolean) : [];
        interactionInstance.setAriaSummary(`Cockpit screens show gear: ${itemNames.length > 0 ? itemNames.join(', ') : 'no gear chosen'}.`);
      } catch { /* ignore */ }
    }

    resize();
    animId = requestAnimationFrame(animate);

    if (!hasCheckedVisibility) {
      hasCheckedVisibility = true;
      setTimeout(() => {
        try { checkCockpitVisibility(scene, camera, screenAnchors, launchButtonMesh, sampleButtonsList); } catch (err) { console.error('Visibility check failed:', err); }
      }, 1000);
    }

    if (!hasScreenFitChecked) {
      hasScreenFitChecked = true;
      setTimeout(() => {
        try { if (typeof window !== 'undefined' && typeof window.__screenFitCheck === 'function') window.__screenFitCheck(); } catch (err) { console.error('Screen fit check failed:', err); }
      }, 3000);
    }
  }

  function stop() {
    if (!isRunningState) return;
    isRunningState = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (launchControllerInstance) launchControllerInstance.abort();
    if (flightControllerInstance) flightControllerInstance.abort();
    if (landingControllerInstance) landingControllerInstance.abort();
  }

  if (typeof window !== 'undefined') {
    window.__arrivalPreview = () => {
      setOutsideView(ARRIVAL_VIEW);
      return computeArrivalCheck({ camera, viewParams: outsideView, screenBoxes: [] });
    };
    window.__lunarPreview = () => {
      setOutsideView(LUNAR_ORBIT_VIEW);
      return computeLunarOrbitCheck({ camera, viewParams: outsideView, screenBoxes: [] });
    };
    window.__orbitPreview = () => {
      setOutsideView(DEFAULT_VIEW);
      return computeOrbitCheck({ camera, moonDist: 3600, moonRad: baseMoonRad, sunDir });
    };
    window.__orbitCheck = () => computeOrbitCheck({ camera, moonDist: 3600, moonRad: baseMoonRad, sunDir });
    window.__devFlight = () => { if (flightControllerInstance) flightControllerInstance.start(); };
    window.__devFlightSkip = (sec) => { if (flightControllerInstance) flightControllerInstance.skipTo(sec); };
    window.__devLanding = (siteId) => {
      const mission = getMission();
      setMission({ landingSite: siteId || mission.landingSite || 'ridge', fuelMargin: mission.fuelMargin ?? 20 });
      setOutsideView(LUNAR_ORBIT_VIEW);
      ['orbit-reached-card', 'storm-decision-dialog', 'storm-result-dialog', 'site-choice-dialog'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) { el.style.opacity = '0'; el.style.display = 'none'; }
      });
      if (landingControllerInstance) landingControllerInstance.start();
    };
    window.__devLandingSkip = (sec) => { if (landingControllerInstance) landingControllerInstance.skipTo(sec); };
    window.__landingSkyPreview = () => {
      setOutsideView(LANDING_SKY_VIEW);
      return computeLandingSkyCheck({ camera, viewParams: outsideView, screenBoxes: [], glowSprite });
    };
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    start, stop, resize,
    isRunning: () => isRunningState,
    getScreenAnchors: () => screenAnchors,
    getLaunchButton: () => launchButtonMesh,
    getOutsideRig: () => outsideRig,
    getOutsideView, setOutsideView, tweenOutsideView,
    dashboardOk: Boolean(screenAnchors.main),
    screensOk: Boolean(screensInstance),
    interactionOk: Boolean(interactionInstance),
    launchOk: Boolean(launchControllerInstance),
    flightOk: Boolean(flightControllerInstance),
    landingOk: Boolean(landingControllerInstance),
    getFlightController: () => flightControllerInstance,
    getLandingController: () => landingControllerInstance,
    startFlight: () => { if (flightControllerInstance) flightControllerInstance.start(); },
    startLanding: () => { if (landingControllerInstance) landingControllerInstance.start(); },
    resetLaunch: () => {
      [launchControllerInstance, flightControllerInstance, landingControllerInstance, floatersInstance].forEach((inst) => { if (inst) inst.reset(); });
      setOutsideView(DEFAULT_VIEW);
    },
    getLaunchController: () => launchControllerInstance,
    onLaunchComplete: (cb) => { if (launchControllerInstance) launchControllerInstance.onLaunchComplete(cb); },
    onContinue: (cb) => { if (launchControllerInstance) launchControllerInstance.onContinue(cb); },
    onLaunchPressed: (cb) => { customLaunchCallback = cb; },
    dispose: () => {
      stop();
      window.removeEventListener('resize', resize);
      [launchControllerInstance, flightControllerInstance, landingControllerInstance, launchEffectsInstance, flightEffectsInstance, floatersInstance].forEach((inst) => { if (inst) inst.dispose(); });
      orbitEarthInst.dispose();
    },
  };
}

export default createCockpitScene;
