import * as THREE from 'three';
import { createMoonTextures } from '../world/moonTexture.js';
import { createEarthTexture } from '../world/earthTexture.js';
import { buildDashboard, checkCockpitVisibility, surfaceY } from './cockpitDashboard.js';
import { createScreens } from '../cockpit/screens.js';
import { createInteraction } from '../cockpit/interaction.js';
import { getLoadout } from '../game/state.js';
import { getItem } from '../data/gear.js';

export { surfaceY };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function checkFinite(geometry, name) {
  if (!geometry?.attributes?.position) return;
  const arr = geometry.attributes.position.array;
  for (let i = 0; i < arr.length; i += 3) {
    if (!isFinite(arr[i]) || !isFinite(arr[i + 1]) || !isFinite(arr[i + 2])) {
      console.warn(`NaN/Inf in geometry "${name}" at vertex ${i / 3}: (${arr[i]}, ${arr[i + 1]}, ${arr[i + 2]})`);
      return;
    }
  }
}

function addPart(scene, geo, mat, name, pos, rot) {
  checkFinite(geo, name);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// 1) The Cabin Shell
// ---------------------------------------------------------------------------
function buildShell(scene) {
  const shellGeo = new THREE.CylinderGeometry(1.9, 1.9, 4.2, 32, 1, true, -Math.PI / 2, Math.PI);
  shellGeo.rotateX(-Math.PI / 2);
  shellGeo.translate(0, 0, 0.3);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x1e2735, roughness: 0.85, metalness: 0.2, emissive: 0x0b1220, side: THREE.DoubleSide });
  addPart(scene, shellGeo, shellMat, 'cockpit-shell');

  const ribMat = new THREE.MeshStandardMaterial({ color: 0x2c3a52, metalness: 0.5, roughness: 0.5 });
  const ribGeo = new THREE.TorusGeometry(1.88, 0.02, 8, 32, Math.PI);
  checkFinite(ribGeo, 'cockpit-rib');
  for (const z of [-1.4, -0.7, 0.0, 0.7, 1.4, 2.1]) {
    const rib = new THREE.Mesh(ribGeo, ribMat); rib.position.set(0, 0, z); scene.add(rib);
  }

  const stripMat = new THREE.MeshStandardMaterial({ color: 0x9fc4ff, emissive: 0x9fc4ff, emissiveIntensity: 1.4 });
  const stripGeo = new THREE.BoxGeometry(0.04, 0.015, 3.8);
  checkFinite(stripGeo, 'cockpit-strip');
  for (const x of [-0.5, 0.5]) {
    const strip = new THREE.Mesh(stripGeo, stripMat); strip.position.set(x, 1.82, 0.3); scene.add(strip);
  }

  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 128; floorCanvas.height = 128;
  const fctx = floorCanvas.getContext('2d');
  fctx.fillStyle = '#141b27'; fctx.fillRect(0, 0, 128, 128);
  fctx.strokeStyle = '#1d2738'; fctx.lineWidth = 2; fctx.strokeRect(2, 2, 124, 124);
  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.wrapS = THREE.RepeatWrapping; floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 6);
  const floorGeo = new THREE.PlaneGeometry(3.8, 4.2);
  floorGeo.rotateX(-Math.PI / 2);
  addPart(scene, floorGeo, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0.1 }), 'floor', [0, 0, 0.3]);
  addPart(scene, new THREE.PlaneGeometry(3.8, 2.0), shellMat, 'backwall', [0, 1.0, 2.4], [0, Math.PI, 0]);
  addPart(scene, new THREE.TorusGeometry(0.45, 0.025, 8, 24), ribMat, 'hatch-rim', [0, 1.0, 2.38]);
  addPart(scene, new THREE.CircleGeometry(0.44, 24), new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.9 }), 'hatch', [0, 1.0, 2.375], [0, Math.PI, 0]);

  const outer = new THREE.Shape();
  outer.moveTo(-1.9, 0); outer.lineTo(1.9, 0); outer.lineTo(1.9, 2.0); outer.lineTo(-1.9, 2.0); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-1.5, 0.95); hole.lineTo(1.5, 0.95); hole.lineTo(1.2, 2.0); hole.lineTo(-1.2, 2.0); hole.closePath();
  outer.holes.push(hole);
  addPart(scene, new THREE.ShapeGeometry(outer), new THREE.MeshStandardMaterial({ color: 0x202a3a, roughness: 0.85, metalness: 0.2, side: THREE.DoubleSide }), 'bulkhead', [0, 0, -1.8]);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a4a66, emissive: 0x1a2c4a, emissiveIntensity: 0.4 });
  addPart(scene, new THREE.BoxGeometry(3.04, 0.04, 0.04), frameMat, 'f-b', [0, 0.95, -1.79]);
  addPart(scene, new THREE.BoxGeometry(2.44, 0.04, 0.04), frameMat, 'f-t', [0, 2.0, -1.79]);
  const sideAng = Math.atan2(0.3, 1.05);
  const sideGeo = new THREE.BoxGeometry(0.04, Math.hypot(0.3, 1.05), 0.04);
  addPart(scene, sideGeo, frameMat, 'f-l', [-1.35, 1.475, -1.79], [0, 0, -sideAng]);
  addPart(scene, sideGeo, frameMat, 'f-r', [1.35, 1.475, -1.79], [0, 0, sideAng]);
}

// ---------------------------------------------------------------------------
// 2) The Window Glass
// ---------------------------------------------------------------------------
function buildWindow(scene) {
  const winShape = new THREE.Shape();
  winShape.moveTo(-1.5, 0.95); winShape.lineTo(1.5, 0.95); winShape.lineTo(1.2, 2.0); winShape.lineTo(-1.2, 2.0); winShape.closePath();
  const winGeo = new THREE.ShapeGeometry(winShape);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  addPart(scene, winGeo, glassMat, 'glass', [0, 0, -1.808], [0.21, 0, 0]);

  const sCanvas = document.createElement('canvas');
  sCanvas.width = 256; sCanvas.height = 256;
  const sctx = sCanvas.getContext('2d');
  sctx.clearRect(0, 0, 256, 256);
  sctx.strokeStyle = 'rgba(230, 240, 255, 0.06)'; sctx.lineWidth = 14;
  sctx.beginPath(); sctx.moveTo(30, 240); sctx.lineTo(220, 20); sctx.stroke();
  addPart(scene, winGeo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sCanvas), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }), 'scratch', [0, 0, -1.804], [0.21, 0, 0]);
}

// ---------------------------------------------------------------------------
// 3) Outside View (Stars, Moon, Earth)
// ---------------------------------------------------------------------------
function buildOutside(scene, updateFns) {
  scene.background = new THREE.Color('#02030a');

  const starGeo = new THREE.BufferGeometry();
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    let vx, vy, vz, len;
    do { vx = Math.random() * 2 - 1; vy = Math.random() * 2 - 1; vz = Math.random() * 2 - 1; len = Math.hypot(vx, vy, vz); } while (len < 1e-6);
    const inv = 300 / len;
    positions[i * 3] = vx * inv; positions[i * 3 + 1] = vy * inv; positions[i * 3 + 2] = vz * inv;
    const c = Math.random() < 0.6 ? [0.95, 0.98, 1.0] : (Math.random() < 0.85 ? [0.82, 0.9, 1.0] : [1.0, 0.92, 0.82]);
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  checkFinite(starGeo, 'cockpit-stars');
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2, vertexColors: true, sizeAttenuation: false, fog: false }));
  stars.frustumCulled = false;
  scene.add(stars);

  const moonTextures = createMoonTextures();
  const moon = addPart(scene, new THREE.SphereGeometry(40, 64, 64), new THREE.MeshStandardMaterial({
    map: moonTextures.map, bumpMap: moonTextures.bumpMap, bumpScale: 0.04,
    emissiveMap: moonTextures.map, emissive: 0xffffff, emissiveIntensity: 0.4,
    roughness: 0.85, metalness: 0.02,
  }), 'moon', [35, 28, -220]);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128; glowCanvas.height = 128;
  const gctx = glowCanvas.getContext('2d');
  const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(215, 230, 255, 0.45)'); grad.addColorStop(0.5, 'rgba(170, 200, 255, 0.15)'); grad.addColorStop(1, 'rgba(170, 200, 255, 0)');
  gctx.fillStyle = grad; gctx.fillRect(0, 0, 128, 128);
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), blending: THREE.AdditiveBlending, transparent: true }));
  glowSprite.position.set(35, 28, -225);
  glowSprite.scale.set(120, 120, 1);
  scene.add(glowSprite);

  const earth = addPart(scene, new THREE.SphereGeometry(120, 48, 48), new THREE.MeshStandardMaterial({ map: createEarthTexture(), roughness: 0.8, metalness: 0.1 }), 'earth', [-80, -150, -260]);
  addPart(scene, new THREE.SphereGeometry(124, 48, 48), new THREE.MeshBasicMaterial({ color: 0x5aa0ff, transparent: true, opacity: 0.35, side: THREE.BackSide, blending: THREE.AdditiveBlending }), 'atmo', [-80, -150, -260]);

  updateFns.push((delta) => {
    moon.rotation.y += delta * 0.01;
    earth.rotation.y += delta * 0.005;
  });
}

// ---------------------------------------------------------------------------
// 4) Seats
// ---------------------------------------------------------------------------
function buildSeats(scene) {
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a3345, roughness: 0.8, flatShading: true });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3a4a66, roughness: 0.6 });

  function addSeat(x, hasBelt) {
    addPart(scene, new THREE.BoxGeometry(0.55, 0.16, 0.55), seatMat, `cushion-${x}`, [x, 0.42, 0.45]);
    addPart(scene, new THREE.BoxGeometry(0.52, 0.85, 0.12), seatMat, `back-${x}`, [x, 0.95, 0.75], [-0.1, 0, 0]);
    addPart(scene, new THREE.BoxGeometry(0.32, 0.22, 0.1), seatMat, `head-${x}`, [x, 1.45, 0.81]);
    addPart(scene, new THREE.BoxGeometry(0.06, 0.06, 0.45), pipeMat, `arm-l-${x}`, [x - 0.28, 0.60, 0.45]);
    addPart(scene, new THREE.BoxGeometry(0.06, 0.06, 0.45), pipeMat, `arm-r-${x}`, [x + 0.28, 0.60, 0.45]);
    if (hasBelt) {
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x182030, roughness: 0.9 });
      addPart(scene, new THREE.BoxGeometry(0.06, 0.7, 0.02), beltMat, 'belt1', [x - 0.12, 0.92, 0.70], [-0.1, 0, 0.12]);
      addPart(scene, new THREE.BoxGeometry(0.06, 0.7, 0.02), beltMat, 'belt2', [x + 0.12, 0.92, 0.70], [-0.1, 0, -0.12]);
      addPart(scene, new THREE.BoxGeometry(0.08, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 }), 'buckle', [x, 0.72, 0.68]);
    }
  }
  addSeat(-0.55, false);
  addSeat(0.65, true);
}

// ---------------------------------------------------------------------------
// 5) Lighting
// ---------------------------------------------------------------------------
function buildLighting(scene) {
  scene.add(new THREE.HemisphereLight(0x6f8fc4, 0x141b27, 0.55));
  const pDash = new THREE.PointLight(0x6fa8ff, 5.0, 4.0, 2.0); pDash.position.set(0, 1.4, -1.2); scene.add(pDash);
  const pCeil = new THREE.PointLight(0xcfe0ff, 3.0, 5.0, 2.0); pCeil.position.set(0, 1.7, 0.2); scene.add(pCeil);
  const pAmber = new THREE.PointLight(0xffb36b, 1.5, 3.0, 2.0); pAmber.position.set(0.7, 1.0, 0.3); scene.add(pAmber);
  const dirMoon = new THREE.DirectionalLight(0xdbe8ff, 1.3);
  dirMoon.position.set(3.5, 2.8, -15.0);
  dirMoon.target.position.set(0, 0.8, -1.4);
  scene.add(dirMoon);
  scene.add(dirMoon.target);
}

// ---------------------------------------------------------------------------
// 6) Look Controls & Sway
// ---------------------------------------------------------------------------
function buildLookControls(camera, canvas, updateFns) {
  camera.rotation.order = 'YXZ';
  const startYaw = camera.rotation.y, startPitch = camera.rotation.x;
  const YAW_MIN = startYaw - 75 * (Math.PI / 180), YAW_MAX = startYaw + 75 * (Math.PI / 180);
  const PITCH_MIN = startPitch - 35 * (Math.PI / 180), PITCH_MAX = startPitch + 30 * (Math.PI / 180);
  let yaw = startYaw, pitch = startPitch, targetYaw = startYaw, targetPitch = startPitch;
  let isDragging = false, lastX = 0, lastY = 0;

  function getSettings() {
    const s = { invertH: false, invertV: false, sensH: 1, sensV: 1 };
    try {
      const raw = localStorage.getItem('moonshot_settings_v1');
      if (raw) Object.assign(s, JSON.parse(raw));
    } catch { /* ignore */ }
    return s;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('#settings-btn, #settings-panel, #cockpit-dev-back-btn')) return;
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    const s = getSettings();
    targetYaw -= dx * 0.0035 * s.sensH * (s.invertH ? -1 : 1);
    targetPitch += dy * 0.0035 * s.sensV * (s.invertV ? -1 : 1);
    targetYaw = Math.max(YAW_MIN, Math.min(YAW_MAX, targetYaw));
    targetPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, targetPitch));
  });

  const onPointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  const baseCamPos = new THREE.Vector3(-0.55, 1.15, 0.35);
  let swayTime = 0;
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  updateFns.push((delta) => {
    yaw += (targetYaw - yaw) * 0.2; pitch += (targetPitch - pitch) * 0.2;
    camera.rotation.y = yaw; camera.rotation.x = pitch;
    if (!prefersReduced) {
      swayTime += delta * 0.8;
      camera.position.set(baseCamPos.x + Math.sin(swayTime) * 0.004, baseCamPos.y + Math.cos(swayTime * 0.7) * 0.003, baseCamPos.z);
    }
  });

  const hintEl = document.getElementById('cockpit-look-hint');
  if (hintEl) {
    hintEl.classList.remove('faded');
    setTimeout(() => { hintEl.classList.add('faded'); }, 5000);
  }
}

// ---------------------------------------------------------------------------
// Main Cockpit Scene Factory
// ---------------------------------------------------------------------------
export function createCockpitScene(containerElement) {
  if (!containerElement) throw new Error('Container element required for cockpit scene');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
  camera.position.set(-0.55, 1.15, 0.35);
  camera.lookAt(0.0, 1.20, -1.8);
  camera.rotation.order = 'YXZ';

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

  const updateFns = [];
  let screenAnchors = {};
  let launchButtonMesh = null;
  let sampleButtonsList = [], interactiveTargets = [], dashboardOk = false;
  let screensOk = false, interactionOk = false, screensInstance = null;
  let interactionInstance = null, customLaunchCallback = null;
  let isRunningState = false, animId = null, hasCheckedVisibility = false;
  const clock = new THREE.Clock();

  function resize() {
    const w = containerElement.clientWidth || window.innerWidth;
    const h = containerElement.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  try { buildShell(scene); } catch (e) { console.error('EarthScene part failed: cockpit shell', e); }
  try { buildWindow(scene); } catch (e) { console.error('EarthScene part failed: cockpit window', e); }
  try { buildOutside(scene, updateFns); } catch (e) { console.error('EarthScene part failed: cockpit outside', e); }
  try {
    const dashResult = buildDashboard(scene, camera, updateFns);
    screenAnchors = dashResult.anchors;
    launchButtonMesh = dashResult.launchButton;
    sampleButtonsList = dashResult.sampleButtons;
    interactiveTargets = dashResult.interactiveTargets || [];
    dashboardOk = true;
  } catch (e) {
    console.error('EarthScene part failed: cockpit dashboard', e);
  }

  try {
    screensInstance = createScreens({
      anchors: screenAnchors,
      getLoadout,
      renderer,
    });
    screensOk = true;
  } catch (e) {
    console.error('EarthScene part failed: cockpit screens', e);
  }

  try {
    interactionInstance = createInteraction({
      domElement: canvas,
      camera,
      getTargets: () => interactiveTargets,
      onLaunchPressed: () => {
        if (typeof customLaunchCallback === 'function') {
          customLaunchCallback();
        } else {
          console.log('Launch button pressed');
          if (screensInstance && typeof screensInstance.setLogLine === 'function') {
            screensInstance.setLogLine('Launch sequence is not ready yet');
          }
        }
      },
      onLog: (text) => {
        if (screensInstance && typeof screensInstance.setLogLine === 'function') {
          screensInstance.setLogLine(text);
        }
      },
    });
    interactionOk = true;
  } catch (e) {
    console.error('EarthScene part failed: cockpit interaction', e);
  }

  try { buildSeats(scene); } catch (e) { console.error('EarthScene part failed: cockpit seats', e); }
  try { buildLighting(scene); } catch (e) { console.error('EarthScene part failed: cockpit lighting', e); }
  try { buildLookControls(camera, canvas, updateFns); } catch (e) { console.error('EarthScene part failed: cockpit controls', e); }

  window.addEventListener('resize', resize);
  resize();

  function animate() {
    if (!isRunningState) return;
    animId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    for (let i = 0; i < updateFns.length; i++) {
      try { updateFns[i](delta); } catch { /* ignore */ }
    }
    if (screensInstance) {
      try { screensInstance.update(delta); } catch { /* ignore */ }
    }
    renderer.render(scene, camera);
  }

  function start() {
    if (isRunningState) return;
    isRunningState = true;
    clock.getDelta();
    if (screensInstance) {
      try { screensInstance.reset(); } catch { /* ignore */ }
    }

    if (interactionInstance) {
      try {
        const l = typeof getLoadout === 'function' ? getLoadout() : null;
        const sel = l ? l.selection : null;
        const itemNames = sel ? ['suit', 'helmet', 'gloves', 'boots', 'backpack'].map((c) => getItem(c, sel[c])?.name).filter(Boolean) : [];
        const weightVal = l && l.totals ? l.totals.weight : 0;
        interactionInstance.setAriaSummary(`Cockpit screens show your gear: ${itemNames.length > 0 ? itemNames.join(', ') : 'no gear chosen'}, weight ${weightVal} of 60 kilograms.`);
      } catch { /* ignore */ }
    }

    resize();
    animId = requestAnimationFrame(animate);

    if (!hasCheckedVisibility) {
      hasCheckedVisibility = true;
      setTimeout(() => {
        try {
          checkCockpitVisibility(scene, camera, screenAnchors, launchButtonMesh, sampleButtonsList);
        } catch (chkErr) {
          console.error('Cockpit visibility check failed:', chkErr);
        }
      }, 1000);
    }
  }

  function stop() {
    if (!isRunningState) return;
    isRunningState = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  }

  function dispose() {
    stop();
    window.removeEventListener('resize', resize);
    if (interactionInstance) {
      try { interactionInstance.dispose(); } catch { /* ignore */ }
    }
  }

  return {
    start,
    stop,
    isRunning: () => isRunningState,
    getScreenAnchors: () => screenAnchors,
    getLaunchButton: () => launchButtonMesh,
    dashboardOk,
    screensOk,
    interactionOk,
    onLaunchPressed: (cb) => { customLaunchCallback = cb; },
    dispose,
    resize,
  };
}

export default createCockpitScene;
