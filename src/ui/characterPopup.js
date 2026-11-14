import * as THREE from 'three';
import buildCharacter from '../characters/astronaut.js';
import createGearPanel from './gearPanel.js';
import { setLoadout, setPhase } from '../game/state.js';
import { playBoardTransition, setOnBackToLaunchSite } from './boardTransition.js';

// ---------------------------------------------------------------------------
// NaN/Inf vertex checker helper
// ---------------------------------------------------------------------------
function checkFinite(geometry, name) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
  const array = geometry.attributes.position.array;
  for (let i = 0; i < array.length; i += 3) {
    if (!isFinite(array[i]) || !isFinite(array[i + 1]) || !isFinite(array[i + 2])) {
      console.warn(`NaN/Inf in geometry "${name}" at vertex ${i / 3}: (${array[i]}, ${array[i + 1]}, ${array[i + 2]})`);
      return;
    }
  }
}

export function createCharacterPopup() {
  const overlay = document.getElementById('character-popup');
  const closeBtn = document.getElementById('popup-close-btn');
  const viewportEl = document.getElementById('character-viewport');
  const hintEl = document.getElementById('viewport-hint');
  const gearListContainer = document.getElementById('gear-list');

  if (!overlay || !viewportEl) throw new Error('Required popup DOM elements not found');

  let isOpenState = false;
  let isBoarding = false;
  let animId = null;
  let lastTime = performance.now();
  let autoRotatePaused = false;
  let resumeTimer = null;
  const ROTATE_SPEED = 0.4;
  const closeCallbacks = [];
  const loadoutCallbacks = [];
  let onBackToSiteCallback = null;
  let gearPanel = null;
  let gearPanelOk = false;
  let boardButtonOk = false;

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.9, 4.2);
  camera.lookAt(0, 0.9, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  viewportEl.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.HemisphereLight(0x9db8e8, 0x1a2438, 0.9));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(3, 4, 3);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x7fa8ff, 1.1);
  rimLight.position.set(-3, 3, -3);
  scene.add(rimLight);

  // Platform & Character
  const rotatorGroup = new THREE.Group();
  scene.add(rotatorGroup);

  const platGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.06, 32);
  checkFinite(platGeo, 'platform');
  const platform = new THREE.Mesh(platGeo, new THREE.MeshStandardMaterial({ color: 0x1b2a44, roughness: 0.7, metalness: 0.1, flatShading: true }));
  platform.position.set(0, -0.03, 0);
  rotatorGroup.add(platform);

  const rimGeo = new THREE.TorusGeometry(0.89, 0.012, 8, 32);
  rimGeo.rotateX(Math.PI / 2);
  checkFinite(rimGeo, 'platformRim');
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: 0x4f86c6, emissive: 0x4f86c6, emissiveIntensity: 0.55 }));
  rotatorGroup.add(rim);

  const character = buildCharacter();
  rotatorGroup.add(character.group);

  function handleResize() {
    const w = viewportEl.clientWidth;
    const h = viewportEl.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, true);
  }

  function animate(now) {
    if (!isOpenState) return;
    animId = requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    if (!autoRotatePaused) rotatorGroup.rotation.y += ROTATE_SPEED * dt;
    renderer.render(scene, camera);
  }

  function open() {
    if (isOpenState) return;
    isOpenState = true;
    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.add('open');
    handleResize();
    if (gearPanel) {
      gearPanel.refresh();
      character.setOutfit(gearPanel.getSelection());
    }
    lastTime = performance.now();
    animId = requestAnimationFrame(animate);
    if (closeBtn) closeBtn.focus();
    if (hintEl) {
      hintEl.classList.remove('faded');
      setTimeout(() => hintEl.classList.add('faded'), 3500);
    }
  }

  function close() {
    if (!isOpenState) return;
    isOpenState = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    overlay.classList.remove('open');
    setTimeout(() => { if (!isOpenState) overlay.classList.add('hidden'); }, 250);
    for (const cb of closeCallbacks) {
      try { cb(); } catch (err) { console.error('onClose error:', err); }
    }
  }

  function getLoadout() {
    if (!gearPanel) {
      return {
        selection: { suit: null, helmet: null, gloves: null, boots: null, backpack: null },
        totals: { weight: 0, radiation: 0, oxygen: 0, mobility: 0, count: 0 },
        complete: false,
      };
    }
    return {
      selection: gearPanel.getSelection(),
      totals: gearPanel.getTotals(),
      complete: gearPanel.isComplete(),
    };
  }

  function handleBoardClick() {
    const loadout = getLoadout();
    setLoadout(loadout);
    isBoarding = true;
    close();

    playBoardTransition({
      onMidpoint: () => {
        const cockpit = (typeof window !== 'undefined' && window.cockpitScene) ? window.cockpitScene : null;
        if (!cockpit) {
          console.warn('Cockpit scene not available; returning to launch site');
          isBoarding = false;
          setPhase('launchSite');
          if (typeof window !== 'undefined' && typeof window.resumeEarthScene === 'function') {
            window.resumeEarthScene();
          }
          const appCanvas = document.querySelector('#app canvas');
          if (appCanvas) appCanvas.style.display = 'block';
          return;
        }

        setPhase('cockpit');
        if (typeof window !== 'undefined' && typeof window.pauseEarthScene === 'function') {
          window.pauseEarthScene();
        }
        const appCanvas = document.querySelector('#app canvas');
        if (appCanvas) appCanvas.style.display = 'none';

        const cockpitView = document.getElementById('cockpit-view');
        if (cockpitView) cockpitView.classList.remove('hidden');
        cockpit.start();
      },
    });
  }

  // Gear Panel & Board button
  try {
    if (gearListContainer) {
      gearPanel = createGearPanel(gearListContainer, {
        onChange: (selection, totals) => {
          character.setOutfit(selection);
          const loadout = { selection, totals, complete: gearPanel ? gearPanel.isComplete() : false };
          for (const cb of loadoutCallbacks) {
            try { cb(loadout); } catch (err) { console.error('loadoutChange error:', err); }
          }
        },
        onBoard: handleBoardClick,
      });
      gearPanelOk = true;
    }
  } catch (error) {
    console.error('EarthScene part failed: gearPanel', error);
  }

  try {
    const boardBtn = document.getElementById('board-button');
    if (boardBtn) boardButtonOk = true;
  } catch (error) {
    console.error('EarthScene part failed: boardButton', error);
  }

  setOnBackToLaunchSite(() => {
    const cockpit = (typeof window !== 'undefined' && window.cockpitScene) ? window.cockpitScene : null;
    if (cockpit) {
      cockpit.stop();
    }
    const cockpitView = document.getElementById('cockpit-view');
    if (cockpitView) cockpitView.classList.add('hidden');

    const appCanvas = document.querySelector('#app canvas');
    if (appCanvas) appCanvas.style.display = 'block';
    if (typeof window !== 'undefined' && typeof window.resumeEarthScene === 'function') {
      window.resumeEarthScene();
    }
    setPhase('launchSite');
    isBoarding = false;
    if (typeof onBackToSiteCallback === 'function') {
      onBackToSiteCallback();
    }
  });

  window.addEventListener('resize', () => {
    if (isOpenState) handleResize();
  });

  // Rotation controls
  let isDragging = false;
  let lastPointerX = 0;

  viewportEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isDragging = true;
    lastPointerX = e.clientX;
    autoRotatePaused = true;
    if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
    try { viewportEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });

  viewportEl.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    lastPointerX = e.clientX;
    rotatorGroup.rotation.y += dx * 0.008;
  });

  const onPointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    try { viewportEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { autoRotatePaused = false; }, 1500);
  };
  viewportEl.addEventListener('pointerup', onPointerUp);
  viewportEl.addEventListener('pointercancel', onPointerUp);

  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });

  window.addEventListener('keydown', (e) => {
    if (isOpenState && (e.key === 'Escape' || e.key === 'Esc')) {
      e.preventDefault();
      close();
    }
  });

  return {
    open,
    close,
    isOpen: () => isOpenState,
    onClose: (cb) => { if (typeof cb === 'function') closeCallbacks.push(cb); },
    character,
    gearPanel,
    gearPanelOk,
    boardButtonOk,
    isBoarding: () => isBoarding,
    getLoadout,
    onLoadoutChange: (cb) => { if (typeof cb === 'function') loadoutCallbacks.push(cb); },
    onBackToLaunchSite: (cb) => { onBackToSiteCallback = cb; },
  };
}

export default createCharacterPopup;
