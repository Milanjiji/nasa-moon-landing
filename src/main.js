import * as THREE from 'three';
import EarthScene from './scenes/earthScene.js';

const container = document.getElementById('app');
const overlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');

// Attach the start button listener as early as possible so it works
// even if the 3D scene fails to initialize.
startBtn.addEventListener('click', () => {
  console.log('Going to the Moon');
  overlay.classList.add('fade-out');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 1000);
});

// ---- Settings (independent of the 3D scene) ----
const settings = { invertH: false, invertV: false, sensH: 1, sensV: 1 };
try {
  const raw = localStorage.getItem('moonshot_settings_v1');
  if (raw) {
    const s = JSON.parse(raw);
    if (typeof s.invertH === 'boolean') settings.invertH = s.invertH;
    if (typeof s.invertV === 'boolean') settings.invertV = s.invertV;
    if (typeof s.sensH === 'number') settings.sensH = s.sensH;
    if (typeof s.sensV === 'number') settings.sensV = s.sensV;
  }
} catch (e) {
  // ignore
}

const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const cbH = document.getElementById('invertH');
const cbV = document.getElementById('invertV');
const sH = document.getElementById('sensH');
const sV = document.getElementById('sensV');
const resetBtn = document.getElementById('reset-btn');
const closeBtn = document.getElementById('close-btn');

function applySettingsUI() {
  if (cbH) cbH.checked = settings.invertH;
  if (cbV) cbV.checked = settings.invertV;
  if (sH) sH.value = settings.sensH;
  if (sV) sV.value = settings.sensV;
}

function saveSettings() {
  try {
    localStorage.setItem('moonshot_settings_v1', JSON.stringify(settings));
  } catch (e) {
    // ignore
  }
}

function openSettings() {
  if (settingsPanel) settingsPanel.classList.add('open');
}
function closeSettings() {
  if (settingsPanel) settingsPanel.classList.remove('open');
}

if (settingsBtn && settingsPanel) {
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSettings();
  });
}
if (cbH) cbH.addEventListener('change', (e) => {
  settings.invertH = e.target.checked;
  saveSettings();
});
if (cbV) cbV.addEventListener('change', (e) => {
  settings.invertV = e.target.checked;
  saveSettings();
});
if (sH) sH.addEventListener('input', (e) => {
  settings.sensH = parseFloat(e.target.value);
  saveSettings();
});
if (sV) sV.addEventListener('input', (e) => {
  settings.sensV = parseFloat(e.target.value);
  saveSettings();
});
if (resetBtn) resetBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settings.invertH = false;
  settings.invertV = false;
  settings.sensH = 1;
  settings.sensV = 1;
  saveSettings();
  applySettingsUI();
});
if (closeBtn) closeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  closeSettings();
});
container.addEventListener('click', (e) => {
  if (
    !e.target.closest('#settings-panel') &&
    !e.target.closest('#settings-btn')
  ) {
    closeSettings();
  }
});

applySettingsUI();

// ---- Create the 3D scene (after settings are wired) ----
let earthScene;
try {
  earthScene = new EarthScene(container, settings);
} catch (err) {
  console.error('Failed to initialize EarthScene:', err);
}

if (earthScene) {
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    earthScene.update(delta);
    earthScene.render();
  }

  animate();
}
