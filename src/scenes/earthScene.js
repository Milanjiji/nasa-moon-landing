import * as THREE from 'three';
import createLaunchSite from './launchSite.js';
import createCharacterPopup from '../ui/characterPopup.js';
import { getPhase, setPhase } from '../game/state.js';
import { createMoonTextures } from '../world/moonTexture.js';
import createCockpitScene from './cockpitScene.js';

const STAR_COUNT = 3500;
const MOON_ROTATION_SPEED = 0.025;
const TREE_PINE_COUNT = 125;
const TREE_ROUND_COUNT = 125;

// Pitch limits: stop the player from looking under the ground,
// while still letting them look up toward the Moon.
// PITCH_MIN allows at least 80 degrees up (~-1.4 rad) to see the rocket/tower.
const PITCH_MIN = -1.5;
const PITCH_MAX = 0.35;

// Module-level launch pad reference for terrain flattening.
let launchPadCenter = null;
let launchPadBaseHeight = 0;

const SKY_TOP = '#050914';
const SKY_HORIZON = '#14264a';
const FOG_COLOR = 0x1a2c4d;

// ---------------------------------------------------------------------------
// NaN checker helper: scans a geometry's position attribute for non-finite
// values and warns with the geometry name and first bad vertex index.
// ---------------------------------------------------------------------------
function checkFinite(geometry, name) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
  const array = geometry.attributes.position.array;
  for (let i = 0; i < array.length; i += 3) {
    if (
      !isFinite(array[i]) ||
      !isFinite(array[i + 1]) ||
      !isFinite(array[i + 2])
    ) {
      console.warn(
        `NaN/Inf in geometry "${name}" at vertex ${i / 3}: ` +
          `(${array[i]}, ${array[i + 1]}, ${array[i + 2]})`
      );
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Terrain height: almost flat within 12 units of the player, growing into
// smooth rolling hills farther away (amplitude ~3-9 units).
// Uses safe smoothstep (clamped t, no divide by zero).
// ---------------------------------------------------------------------------
function terrainHeight(x, z) {
  const dPlayer = Math.sqrt(x * x + z * z);
  let tPlayer = (dPlayer - 12) / (80 - 12);
  tPlayer = Math.max(0, Math.min(1, tPlayer));
  const falloffPlayer = tPlayer * tPlayer * (3 - 2 * tPlayer);
  const noise =
    Math.sin(x * 0.05 + z * 0.03) * 3.0 +
    Math.cos(x * 0.04 - z * 0.06) * 2.5 +
    Math.sin(x * 0.03) * Math.cos(z * 0.03) * 2.0 +
    Math.sin(x * 0.08 + z * 0.05) * 1.5;
  let height = falloffPlayer * noise;

  if (launchPadCenter) {
    const dPad = Math.sqrt(
      (x - launchPadCenter.x) * (x - launchPadCenter.x) +
        (z - launchPadCenter.z) * (z - launchPadCenter.z)
    );
    let tPad = (dPad - 30) / (50 - 30);
    tPad = Math.max(0, Math.min(1, tPad));
    const padFalloff = tPad * tPad * (3 - 2 * tPad);
    height = padFalloff * height + (1 - padFalloff) * launchPadBaseHeight;
  }

  return height;
}

const STAR_VERTEX = `
  attribute float size;
  attribute vec3 color;
  attribute float twinkle;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uTime;
  uniform float uPixelRatio;
  void main() {
    vColor = color;
    vTwinkle = twinkle;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uPixelRatio;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_FRAGMENT = `
  uniform float uTime;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    float r = length(gl_PointCoord - vec2(0.5));
    if (r > 0.5) discard;
    float soft = 1.0 - (r / 0.5);
    soft = pow(soft, 3.0);
    float twinkle = 0.85 + 0.15 * sin(uTime * 2.5 + vTwinkle);
    gl_FragColor = vec4(vColor, soft * twinkle * 0.95);
  }
`;

export default class EarthScene {
  constructor(container, settings = null) {
    this.container = container;
    this.uTime = 0;

    this.settings = settings || { invertH: false, invertV: false, sensH: 1, sensV: 1 };

    this.scene = new THREE.Scene();

    this.currentLocation = 'start';
    this.characterPopup = null;

    // Status tracking for each setup step.
    this.setupStatus = {
      rendererCamera: false,
      sky: false,
      lights: false,
      moon: false,
      stars: false,
      ground: false,
      ridges: false,
      launchSite: false,
      trees: false,
      drag: false,
      prepare: false,
      popup: false,
      gear: false,
      board: false,
      cockpit: false,
      dashboard: false,
      screens: false,
      interaction: false,
    };

    // ---- Renderer and camera (essential) ----
    try {
      const skyCanvas = document.createElement('canvas');
      skyCanvas.width = 64;
      skyCanvas.height = 256;
      const skyCtx = skyCanvas.getContext('2d');
      const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
      skyGrad.addColorStop(0, SKY_TOP);
      skyGrad.addColorStop(1, SKY_HORIZON);
      skyCtx.fillStyle = skyGrad;
      skyCtx.fillRect(0, 0, 64, 256);
      this.scene.background = new THREE.CanvasTexture(skyCanvas);

      this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0035);

      this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(0, 1.7 + terrainHeight(0, 0), 0);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(width, height);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;
      this.container.appendChild(this.renderer.domElement);

      this.yaw = 0;
      this.pitch = -0.5;

      this.setupStatus.rendererCamera = true;
    } catch (error) {
      console.error('EarthScene part failed: rendererCamera', error);
    }

    // ---- Sky gradient ----
    try {
      // Already set up in rendererCamera block above via this.scene.background
      this.setupStatus.sky = true;
    } catch (error) {
      console.error('EarthScene part failed: sky', error);
    }

    // ---- Lights ----
    try {
      this.initLights();
      this.setupStatus.lights = true;
    } catch (error) {
      console.error('EarthScene part failed: lights', error);
    }

    // ---- Moon ----
    try {
      this.initMoon();
      this.setupStatus.moon = true;
    } catch (error) {
      console.error('EarthScene part failed: moon', error);
    }

    // ---- Stars ----
    try {
      this.initStars();
      this.setupStatus.stars = true;
    } catch (error) {
      console.error('EarthScene part failed: stars', error);
    }

    // ---- Launch site (computes pad center, builds pad/rocket/tower/lights) ----
    try {
      this.launchSite = createLaunchSite({
        scene: this.scene,
        groundHeight: terrainHeight,
        startYaw: 0,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
      });
      launchPadCenter = this.launchSite.padCenter;
      launchPadBaseHeight = launchPadCenter.y;
      this.setupStatus.launchSite = true;
    } catch (error) {
      console.error('EarthScene part failed: launchSite', error);
    }

    // ---- Ground ----
    try {
      this.initGround();
      this.setupStatus.ground = true;
    } catch (error) {
      console.error('EarthScene part failed: ground', error);
    }

    // ---- Far ridges ----
    try {
      this.initFarRidges();
      this.setupStatus.ridges = true;
    } catch (error) {
      console.error('EarthScene part failed: ridges', error);
    }

    // ---- Trees ----
    try {
      this.initTrees();
      this.setupStatus.trees = true;
    } catch (error) {
      console.error('EarthScene part failed: trees', error);
    }

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.isDragging = false;
    this.pointer = { x: 0, y: 0 };

    // ---- Drag controls ----
    try {
      this.addInputHandlers();
      this.addResizeHandler();
      this.setupStatus.drag = true;
    } catch (error) {
      console.error('EarthScene part failed: drag', error);
    }

    // Save original camera state for dev key E (return to start).
    this.originalPosition = this.camera.position.clone();
    this.originalYaw = this.yaw;
    this.originalPitch = this.pitch;

    // ---- Dev keys: R = launch pad, E = back to start ----
    try {
      const padKeyHandler = (e) => {
        // Ignore when settings panel or character popup is open, or during cockpit phase.
        const panel = document.getElementById('settings-panel');
        if (panel && panel.classList.contains('open')) return;
        if (getPhase() === 'cockpit' || (this.characterPopup && this.characterPopup.isOpen())) return;
        if (!this.launchSite) return;

        if (e.key === 'r' || e.key === 'R') {
          const vp = this.launchSite.viewPoint;
          this.camera.position.copy(vp.position);
          this.lookAtPoint(vp.lookAt);
          this.setLocation('launchSite');
        } else if (e.key === 'e' || e.key === 'E') {
          this.camera.position.copy(this.originalPosition);
          this.yaw = this.originalYaw;
          this.pitch = this.originalPitch;
          this.camera.rotation.order = 'YXZ';
          this.camera.rotation.y = this.yaw;
          this.camera.rotation.x = this.pitch;
          this.setLocation('start');
        }
      };
      window.addEventListener('keydown', padKeyHandler);
      console.log('Dev keys: R = launch pad, E = back to start');
    } catch (error) {
      console.error('EarthScene part failed: devKeys', error);
    }

    // ---- Prepare button ----
    try {
      this.initPrepareButton();
      this.setupStatus.prepare = true;
    } catch (error) {
      console.error('EarthScene part failed: prepareButton', error);
    }

    // ---- Character popup ----
    try {
      this.characterPopup = createCharacterPopup();
      this.setupStatus.popup = true;
      if (this.characterPopup) {
        if (this.characterPopup.gearPanelOk) {
          this.setupStatus.gear = true;
        }
        if (this.characterPopup.boardButtonOk) {
          this.setupStatus.board = true;
        }
        this.characterPopup.onClose(() => {
          this.onPopupClosed();
        });
        this.characterPopup.onBackToLaunchSite(() => {
          this.onBackToLaunchSite();
        });
      }
    } catch (error) {
      console.error('EarthScene part failed: characterPopup', error);
    }

    // ---- Cockpit scene ----
    try {
      const cockpitContainer = document.getElementById('cockpit-view');
      if (cockpitContainer) {
        this.cockpitScene = createCockpitScene(cockpitContainer);
        if (this.cockpitScene) {
          this.setupStatus.cockpit = true;
          if (this.cockpitScene.dashboardOk) {
            this.setupStatus.dashboard = true;
          }
          if (this.cockpitScene.screensOk) {
            this.setupStatus.screens = true;
          }
          if (this.cockpitScene.interactionOk) {
            this.setupStatus.interaction = true;
          }
          if (typeof window !== 'undefined') {
            window.cockpitScene = this.cockpitScene;
          }
        }
      }
    } catch (error) {
      console.error('EarthScene part failed: cockpit', error);
    }

    // Dev button in cockpit: return to launch site
    try {
      const devBackBtn = document.getElementById('cockpit-dev-back-btn');
      if (devBackBtn) {
        devBackBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          /* TEMPORARY: dev button to return to launch site */
          if (this.cockpitScene) {
            this.cockpitScene.stop();
          }
          const cockpitView = document.getElementById('cockpit-view');
          if (cockpitView) cockpitView.classList.add('hidden');

          const appCanvas = document.querySelector('#app canvas');
          if (appCanvas) appCanvas.style.display = 'block';

          if (typeof window !== 'undefined' && typeof window.resumeEarthScene === 'function') {
            window.resumeEarthScene();
          }
          this.currentLocation = 'launchSite';
          setPhase('launchSite');
          if (this.launchSite && this.camera) {
            const vp = this.launchSite.viewPoint;
            this.camera.position.copy(vp.position);
            this.lookAtPoint(vp.lookAt);
          }
          this.updatePrepareButtonVisibility();
        });
      }
    } catch (error) {
      console.error('EarthScene part failed: cockpitDevBtn', error);
    }

    // ---- Status summary ----
    try {
      const skyStatus = this.setupStatus.sky ? 'ok' : 'FAILED';
      const moonStatus = this.setupStatus.moon ? 'ok' : 'FAILED';
      const starsStatus = this.setupStatus.stars ? 'ok' : 'FAILED';
      const groundStatus = this.setupStatus.ground ? 'ok' : 'FAILED';
      const ridgesStatus = this.setupStatus.ridges ? 'ok' : 'FAILED';
      const launchSiteStatus = this.setupStatus.launchSite ? 'ok' : 'FAILED';
      const treesStatus = this.setupStatus.trees ? 'ok' : 'FAILED';
      const treeCount = this.setupStatus.trees
        ? TREE_PINE_COUNT + TREE_ROUND_COUNT
        : 0;
      const dragStatus = this.setupStatus.drag ? 'ok' : 'FAILED';
      const padCenterStatus = launchPadCenter
        ? `(${launchPadCenter.x.toFixed(1)},${launchPadCenter.z.toFixed(1)})`
        : 'n/a';
      const prepareStatus = this.setupStatus.prepare ? 'ok' : 'FAILED';
      const popupStatus = this.setupStatus.popup ? 'ok' : 'FAILED';
      const gearStatus = this.setupStatus.gear ? 'ok' : 'FAILED';
      const boardStatus = this.setupStatus.board ? 'ok' : 'FAILED';
      const cockpitStatus = this.setupStatus.cockpit ? 'ok' : 'FAILED';
      const dashboardStatus = this.setupStatus.dashboard ? 'ok' : 'FAILED';
      const screensStatus = this.setupStatus.screens ? 'ok' : 'FAILED';
      const interactionStatus = this.setupStatus.interaction ? 'ok' : 'FAILED';
      const currentPhase = getPhase();

      const statusMessage = `EarthScene ready: sky=${skyStatus} moon=${moonStatus} stars=${starsStatus} ground=${groundStatus} ridges=${ridgesStatus} launchSite=${launchSiteStatus} trees=${treesStatus} (${treeCount} trees) drag=${dragStatus} padCenter=${padCenterStatus} prepare=${prepareStatus} popup=${popupStatus} gear=${gearStatus} board=${boardStatus} cockpit=${cockpitStatus} dashboard=${dashboardStatus} screens=${screensStatus} interaction=${interactionStatus} phase=${currentPhase}`;
      console.log(statusMessage);
    } catch (error) {
      console.error('EarthScene part failed: status', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Lighting
  // ---------------------------------------------------------------------------
  initLights() {
    const hemi = new THREE.HemisphereLight(0x7f9fd6, 0x2f5d36, 1.1);
    this.scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xbcd0ff, 1.6);
    dirLight.position.set(0, 11, -12);
    this.scene.add(dirLight);

    const glow = new THREE.PointLight(0xffffff, 0.7, 30);
    glow.position.set(0, 10, -16);
    this.scene.add(glow);
  }

  // ---------------------------------------------------------------------------
  // Grass texture (procedural, night-green)
  // ---------------------------------------------------------------------------
  createGrassTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2f5d36';
    ctx.fillRect(0, 0, size, size);

    // Lighter speckles.
    ctx.fillStyle = 'rgba(61, 115, 67, 0.5)';
    for (let i = 0; i < 4500; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * size,
        Math.random() * size,
        1 + Math.random() * 2.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Darker speckles.
    ctx.fillStyle = 'rgba(36, 74, 44, 0.55)';
    for (let i = 0; i < 4500; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * size,
        Math.random() * size,
        1 + Math.random() * 2.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Short grass strokes.
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 2 + Math.random() * 6;
      const ang = Math.random() * Math.PI * 2;
      ctx.strokeStyle =
        Math.random() > 0.5
          ? 'rgba(90, 140, 80, 0.4)'
          : 'rgba(50, 90, 60, 0.45)';
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    // One tile ≈ 6 units on a 600-unit ground: 600 / 6 = 100 repeats
    tex.repeat.set(100, 100);
    return tex;
  }

  // ---------------------------------------------------------------------------
  // Stars (above horizon only, varied sizes, twinkle, no fog, no sizeAttenuation)
  // ---------------------------------------------------------------------------
  initStars() {
    const geometry = new THREE.BufferGeometry();
    geometry.name = 'stars';
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const colors = new Float32Array(STAR_COUNT * 3);
    const twinkle = new Float32Array(STAR_COUNT);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Random unit vector with y > 0.05 (above horizon), normalized safely.
      let vx, vy, vz, len;
      do {
        vx = Math.random() * 2 - 1;
        vy = Math.random() * 0.95 + 0.05;
        vz = Math.random() * 2 - 1;
        len = Math.sqrt(vx * vx + vy * vy + vz * vz);
      } while (len < 1e-6);
      const invLen = 1 / len;
      vx *= invLen;
      vy *= invLen;
      vz *= invLen;

      const r = 30 + Math.random() * 130;
      positions[i * 3] = vx * r;
      positions[i * 3 + 1] = vy * r;
      positions[i * 3 + 2] = vz * r;

      // Size: 80% small, 17% medium, 3% big.
      const roll = Math.random();
      let s;
      if (roll < 0.8) {
        s = 1.5 + Math.random() * 1.0;
      } else if (roll < 0.97) {
        s = 3.0 + Math.random() * 1.5;
      } else {
        s = 6.0 + Math.random() * 3.0;
      }
      sizes[i] = s;

      const pick = Math.random();
      let c;
      if (pick < 0.6) c = [0.95, 0.98, 1.0];
      else if (pick < 0.85) c = [0.82, 0.9, 1.0];
      else c = [1.0, 0.94, 0.78];
      const bright = 0.85 + Math.random() * 0.3;
      colors[i * 3] = c[0] * bright;
      colors[i * 3 + 1] = c[1] * bright;
      colors[i * 3 + 2] = c[2] * bright;

      twinkle[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('twinkle', new THREE.BufferAttribute(twinkle, 1));

    checkFinite(geometry, 'stars');

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: false,
    });

    this.stars = new THREE.Points(geometry, material);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  // ---------------------------------------------------------------------------
  // Moon
  // ---------------------------------------------------------------------------
  initMoon() {
    const { map, bumpMap } = createMoonTextures();
    const geometry = new THREE.SphereGeometry(2.2, 64, 64);
    geometry.name = 'moon';
    checkFinite(geometry, 'moon');
    const material = new THREE.MeshStandardMaterial({
      map,
      emissiveMap: map,
      emissive: 0xffffff,
      emissiveIntensity: 0.45,
      bumpMap,
      bumpScale: 0.02,
      roughness: 0.85,
      metalness: 0.02,
    });
    this.moon = new THREE.Mesh(geometry, material);
    this.moon.position.set(0, 9, -13);
    this.moon.scale.set(1, 1, 1);
    this.scene.add(this.moon);
  }

  // ---------------------------------------------------------------------------
  // Ground (600x600, 160x160 segments, displaced by terrainHeight)
  // ---------------------------------------------------------------------------
  initGround() {
    const grassTex = this.createGrassTexture();

    const groundMaterial = new THREE.MeshStandardMaterial({
      map: grassTex,
      color: 0xffffff, // white so the texture shows its own color
      roughness: 1,
      metalness: 0,
    });

    const seg = 160;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600, seg, seg),
      groundMaterial
    );
    ground.name = 'ground';
    ground.rotation.x = -Math.PI / 2;
    const pos = ground.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = -pos.getY(i); // local Y maps to world -Z after rotation.x = -PI/2
      pos.setZ(i, terrainHeight(x, z));
    }
    pos.needsUpdate = true;
    ground.geometry.computeVertexNormals();
    checkFinite(ground.geometry, 'ground');
    this.scene.add(ground);
  }

  // ---------------------------------------------------------------------------
  // Far ridges: 3 smooth silhouette rings at 220, 300, 380 units
  // ---------------------------------------------------------------------------
  initFarRidges() {
    const ridgeData = [
      { radius: 220, baseHeight: 10, color: '#1a2f45' },
      { radius: 300, baseHeight: 14, color: '#223d57' },
      { radius: 380, baseHeight: 18, color: '#2c4a68' },
    ];

    for (const rd of ridgeData) {
      const segments = 256;
      const geo = new THREE.CylinderGeometry(
        rd.radius,
        rd.radius,
        0.2,
        segments,
        1,
        true
      );
      geo.name = `ridge-${rd.radius}`;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const angle = Math.atan2(z, x);
        const h =
          rd.baseHeight +
          Math.sin(angle * 2.3) * 12 +
          Math.cos(angle * 1.7) * 8;
        pos.setY(i, h);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      checkFinite(geo, `ridge-${rd.radius}`);

      const mat = new THREE.MeshStandardMaterial({
        color: rd.color,
        roughness: 1,
        metalness: 0,
        emissive: new THREE.Color(rd.color).multiplyScalar(0.4),
        emissiveIntensity: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0, 0);
      this.scene.add(mesh);
    }
  }

  // ---------------------------------------------------------------------------
  // Trees: unit-sized geometries, InstancedMesh, proper placement
  // ---------------------------------------------------------------------------
  mergeTreeParts(parts, colors) {
    let total = 0;
    for (const p of parts) total += p.geometry.attributes.position.count;
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    let off = 0;
    const tmpV = new THREE.Vector3();
    const tmpN = new THREE.Vector3();
    for (let pIdx = 0; pIdx < parts.length; pIdx++) {
      const p = parts[pIdx];
      const g = p.geometry;
      const m = p.matrix || new THREE.Matrix4();
      // Extract rotation+scale (no translation) for normal transformation.
      const rot = new THREE.Matrix4().copy(m).setPosition(0, 0, 0);
      const c = colors ? colors[pIdx] : [1, 1, 1];
      for (let i = 0; i < g.attributes.position.count; i++) {
        tmpV.set(
          g.attributes.position.getX(i),
          g.attributes.position.getY(i),
          g.attributes.position.getZ(i)
        ).applyMatrix4(m);
        pos[off * 3] = tmpV.x;
        pos[off * 3 + 1] = tmpV.y;
        pos[off * 3 + 2] = tmpV.z;

        tmpN
          .set(
            g.attributes.normal.getX(i),
            g.attributes.normal.getY(i),
            g.attributes.normal.getZ(i)
          )
          .applyMatrix4(rot)
          .normalize();
        // Guard against zero-length normal -> NaN.
        if (!isFinite(tmpN.x) || !isFinite(tmpN.y) || !isFinite(tmpN.z)) {
          tmpN.set(0, 1, 0);
        }
        nor[off * 3] = tmpN.x;
        nor[off * 3 + 1] = tmpN.y;
        nor[off * 3 + 2] = tmpN.z;

        col[off * 3] = c[0];
        col[off * 3 + 1] = c[1];
        col[off * 3 + 2] = c[2];
        off++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }

  buildTreeParts(kind) {
    const parts = [];
    const colors = [];

    if (kind === 'pine') {
      // Trunk: radius 0.08, height 0.15, base at y=0.
      const trunkGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8);
      parts.push({
        geometry: trunkGeo,
        matrix: new THREE.Matrix4().makeTranslation(0, 0.075, 0),
      });
      colors.push([0.29, 0.21, 0.14]); // trunk #4a3524

      // 3 stacked cones: radius 0.55, height 0.28 each.
      for (let l = 0; l < 3; l++) {
        const cg = new THREE.ConeGeometry(0.55, 0.28, 8);
        const m = new THREE.Matrix4().makeTranslation(
          0,
          0.15 + l * 0.28 + 0.14,
          0
        );
        parts.push({ geometry: cg, matrix: m });
        colors.push([0.16, 0.42, 0.24]); // pine crown #2a6a3c
      }
    } else {
      // Round tree trunk: radius 0.1, height 0.15.
      const trunkGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 8);
      parts.push({
        geometry: trunkGeo,
        matrix: new THREE.Matrix4().makeTranslation(0, 0.075, 0),
      });
      colors.push([0.29, 0.21, 0.14]); // trunk #4a3524

      // Round crown: icosahedron radius 0.35.
      const cg = new THREE.IcosahedronGeometry(0.35, 1);
      const m = new THREE.Matrix4().makeTranslation(0, 0.15 + 0.35, 0);
      parts.push({ geometry: cg, matrix: m });
      colors.push([0.23, 0.48, 0.26]); // round crown #3a7a42
    }

    return this.mergeTreeParts(parts, colors);
  }

  initTrees() {
    const pineGeo = this.buildTreeParts('pine');
    pineGeo.name = 'pine-tree';
    checkFinite(pineGeo, 'pine-tree');
    const roundGeo = this.buildTreeParts('round');
    roundGeo.name = 'round-tree';
    checkFinite(roundGeo, 'round-tree');

    const pineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x0f2517,
      emissiveIntensity: 0.2,
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    const roundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x0e2f1a,
      emissiveIntensity: 0.2,
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });

    this.pineTrees = new THREE.InstancedMesh(pineGeo, pineMat, TREE_PINE_COUNT);
    this.pineTrees.name = 'pine-trees';
    this.pineTrees.frustumCulled = false;
    this.roundTrees = new THREE.InstancedMesh(
      roundGeo,
      roundMat,
      TREE_ROUND_COUNT
    );
    this.roundTrees.name = 'round-trees';
    this.roundTrees.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const placed = [];
    const minDistSq = 4.5 * 4.5;

    const isPositionValid = (x, z) => {
      // Must be at least 12 units from player.
      if (x * x + z * z < 12 * 12) return false;
      // Clear 10-degree path straight toward Moon (-Z).
      if (z < 0 && Math.abs(x) < 3) return false;
      // No trees within 55 units of the launch pad.
      if (launchPadCenter) {
        const dx = x - launchPadCenter.x;
        const dz = z - launchPadCenter.z;
        if (dx * dx + dz * dz < 55 * 55) return false;
      }
      // Minimum distance from already-placed trees.
      for (const p of placed) {
        const dx = x - p.x;
        const dz = z - p.z;
        if (dx * dx + dz * dz < minDistSq) return false;
      }
      return true;
    };

    const place = (kind, x, z, scale, rotY) => {
      const h = terrainHeight(x, z);
      let s;
      if (kind === 'pine') {
        s = 5 + Math.random() * 4; // 5-9
      } else {
        s = 4 + Math.random() * 3; // 4-7
      }
      const w = 0.45 + Math.random() * 0.25; // 0.45-0.7
      dummy.position.set(x, h, z);
      dummy.rotation.y = rotY;
      dummy.scale.set(s * w, s, s * w);
      dummy.updateMatrix();

      let mesh;
      if (kind === 'pine') {
        mesh = this.pineTrees;
      } else {
        mesh = this.roundTrees;
      }

      mesh.setMatrixAt(mesh.count, dummy.matrix);
      mesh.count += 1;
      placed.push({ x, z });
    };

    let pinePlaced = 0;
    let roundPlaced = 0;

    // Place pine trees: first 60 in front view cone, rest around/behind.
    for (let i = 0; i < TREE_PINE_COUNT; i++) {
      let x, z;
      const front = pinePlaced < 60;
      let tries = 0;
      do {
        if (front) {
          const d = 18 + Math.random() * 52;
          const aDeg = 5 + Math.random() * 65; // 5 to 70 degrees
          const a = (aDeg * Math.PI) / 180;
          const side = Math.random() < 0.5 ? -1 : 1;
          x = Math.sin(a) * d * side;
          z = -Math.cos(a) * d;
        } else {
          const d = 15 + Math.sqrt(Math.random()) * 105;
          const a = Math.random() * Math.PI * 2;
          x = Math.cos(a) * d;
          z = Math.sin(a) * d;
        }
        tries++;
      } while (!isPositionValid(x, z) && tries < 100);
      if (!isPositionValid(x, z)) continue;
      place('pine', x, z, 0, Math.random() * Math.PI);
      pinePlaced += 1;
    }

    // Place round trees: first 60 in front view cone, rest around/behind.
    for (let i = 0; i < TREE_ROUND_COUNT; i++) {
      let x, z;
      const front = roundPlaced < 60;
      let tries = 0;
      do {
        if (front) {
          const d = 18 + Math.random() * 52;
          const aDeg = 5 + Math.random() * 65; // 5 to 70 degrees
          const a = (aDeg * Math.PI) / 180;
          const side = Math.random() < 0.5 ? -1 : 1;
          x = Math.sin(a) * d * side;
          z = -Math.cos(a) * d;
        } else {
          const d = 15 + Math.sqrt(Math.random()) * 105;
          const a = Math.random() * Math.PI * 2;
          x = Math.cos(a) * d;
          z = Math.sin(a) * d;
        }
        tries++;
      } while (!isPositionValid(x, z) && tries < 100);
      if (!isPositionValid(x, z)) continue;
      place('round', x, z, 0, Math.random() * Math.PI);
      roundPlaced += 1;
    }

    this.pineTrees.instanceMatrix.needsUpdate = true;
    this.roundTrees.instanceMatrix.needsUpdate = true;

    console.log(
      `[Trees] pine: placed ${pinePlaced}/${TREE_PINE_COUNT} trees. ` +
        `round: placed ${roundPlaced}/${TREE_ROUND_COUNT} trees.`
    );

    this.scene.add(this.pineTrees);
    this.scene.add(this.roundTrees);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  addInputHandlers() {
    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      if (getPhase() === 'cockpit' || (this.characterPopup && this.characterPopup.isOpen())) return;
      if (
        e.target.closest(
          '#start-overlay, #start-btn, #settings-panel, #settings-btn, #prepare-container, #prepare-btn, #character-popup, #cockpit-placeholder, #board-transition-overlay'
        )
      ) {
        return;
      }
      this.isDragging = true;
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.pointer.x;
      const dy = e.clientY - this.pointer.y;
      const hMult = this.settings.invertH ? -1 : 1;
      const vMult = this.settings.invertV ? -1 : 1;
      this.yaw -= dx * 0.0035 * this.settings.sensH * hMult;
      this.pitch += dy * 0.0035 * this.settings.sensV * vMult;
      this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch));
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    this.container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  addResizeHandler() {
    const onResize = () => {
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);
  }

  update(delta) {
    this.moon.rotation.y += delta * MOON_ROTATION_SPEED;
    this.uTime += delta;
    if (this.stars && this.stars.material.uniforms) {
      this.stars.material.uniforms.uTime.value = this.uTime;
    }
    if (this.launchSite) {
      this.launchSite.update(delta);
    }
  }

  lookAtPoint(targetVector) {
    if (!targetVector || !this.camera) return;
    const dir = new THREE.Vector3().subVectors(targetVector, this.camera.position);
    this.yaw = Math.atan2(-dir.x, -dir.z);
    const rawPitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, rawPitch));
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  setLocation(name) {
    if (name !== 'start' && name !== 'launchSite') return;
    this.currentLocation = name;
    if (name === 'launchSite') {
      setPhase('launchSite');
      if (this.prepareBtn) {
        this.prepareBtn.classList.remove('fade-out');
      }
      if (this.launchSite && this.camera) {
        const vp = this.launchSite.viewPoint;
        this.camera.position.copy(vp.position);
        this.lookAtPoint(vp.lookAt);
      }
    } else if (name === 'start') {
      setPhase('earth');
      if (this.camera && this.originalPosition) {
        this.camera.position.copy(this.originalPosition);
        this.yaw = this.originalYaw;
        this.pitch = this.originalPitch;
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;
      }
    }
    this.updatePrepareButtonVisibility();
  }

  initPrepareButton() {
    this.prepareContainer = document.getElementById('prepare-container');
    this.prepareBtn = document.getElementById('prepare-btn');

    if (this.prepareBtn) {
      this.prepareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.characterPopup) {
          console.warn('Character popup not initialized');
          return;
        }
        if (this.prepareContainer) {
          this.prepareContainer.classList.remove('visible');
          this.prepareContainer.classList.add('hidden');
        }
        this.characterPopup.open();
      });
    }

    const updateVis = () => {
      this.updatePrepareButtonVisibility();
    };

    if (typeof MutationObserver !== 'undefined') {
      const panel = document.getElementById('settings-panel');
      if (panel) {
        const panelObserver = new MutationObserver(updateVis);
        panelObserver.observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });
      }
      const overlay = document.getElementById('start-overlay');
      if (overlay) {
        const overlayObserver = new MutationObserver(updateVis);
        overlayObserver.observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });
      }
    }

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        setTimeout(updateVis, 50);
        setTimeout(updateVis, 1050);
      });
    }

    window.addEventListener('click', () => {
      setTimeout(updateVis, 0);
    });

    this.updatePrepareButtonVisibility();
  }

  onPopupClosed() {
    if (this.characterPopup && this.characterPopup.isBoarding()) {
      return;
    }
    if (this.prepareBtn && getPhase() === 'launchSite') {
      this.prepareBtn.focus();
    }
    if (this.currentLocation === 'launchSite' && getPhase() === 'launchSite') {
      this.updatePrepareButtonVisibility();
    }
  }

  onBackToLaunchSite() {
    this.currentLocation = 'launchSite';
    setPhase('launchSite');
    if (this.launchSite && this.camera) {
      const vp = this.launchSite.viewPoint;
      this.camera.position.copy(vp.position);
      this.lookAtPoint(vp.lookAt);
    }
    this.updatePrepareButtonVisibility();
  }

  isOverlayGone() {
    const overlay = document.getElementById('start-overlay');
    if (!overlay) return true;
    return overlay.style.display === 'none' || overlay.classList.contains('fade-out');
  }

  isSettingsClosed() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return true;
    return !panel.classList.contains('open');
  }

  updatePrepareButtonVisibility() {
    if (!this.prepareContainer) return;
    const isPopupOpen = this.characterPopup && this.characterPopup.isOpen();
    const isBoarding = this.characterPopup && this.characterPopup.isBoarding();
    const shouldBeVisible =
      this.currentLocation === 'launchSite' &&
      getPhase() === 'launchSite' &&
      !isBoarding &&
      this.isSettingsClosed() &&
      this.isOverlayGone() &&
      !isPopupOpen;

    if (shouldBeVisible) {
      this.prepareContainer.classList.remove('hidden');
      this.prepareContainer.classList.add('visible');
    } else {
      this.prepareContainer.classList.remove('visible');
      this.prepareContainer.classList.add('hidden');
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
