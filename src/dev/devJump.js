import { isDev } from './devFlag.js';
import {
  GEAR_PRESETS,
  DEFAULT_GEAR_PRESET,
  STORM_PRESETS,
  DEFAULT_STORM_PRESET,
  LANDING_PRESETS,
  DEFAULT_LANDING_PRESET,
  BASE_PRESETS,
  DEFAULT_BASE_PRESET,
  JUMP_ORDER,
  buildMission,
  parseDevParams,
} from './presets.js';
import { computeTotals } from '../data/gear.js';
import { getSite } from '../data/sites.js';
import { getSurfaceStart } from '../game/surfaceStats.js';
import { setPhase, setLoadout, setMission, getMission, getLoadout } from '../game/state.js';
import { computeBase } from '../game/baseSetup.js';
import { CAMERA_POSES } from '../game/baseLayout.js';
import { computeBaseCheck } from './baseChecks.js';
import { computeWalkCheck } from './walkCheck.js';
import { computeEarthNavCheck } from './earthNavCheck.js';

if (typeof window !== 'undefined') {
  window.__baseCheck = computeBaseCheck;
  window.__walkCheck = computeWalkCheck;
  window.__earthNavCheck = computeEarthNavCheck;
}

const jumps = new Map();

export function registerJump(name, fn) {
  if (typeof name === 'string' && typeof fn === 'function') {
    jumps.set(name, fn);
  }
}

export function getJumpNames() {
  const set = new Set([...JUMP_ORDER, ...jumps.keys()]);
  return Array.from(set).filter((name) => jumps.has(name));
}

function switchToCockpit() {
  if (typeof window !== 'undefined' && typeof window.pauseEarthScene === 'function') {
    window.pauseEarthScene();
  }
  const appCanvas = document.querySelector('#app canvas');
  if (appCanvas) {
    appCanvas.style.display = 'none';
  }
  const cockpitView = document.getElementById('cockpit-view');
  if (cockpitView) {
    cockpitView.classList.remove('hidden');
    cockpitView.style.display = 'block';
  }
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.id = 'dev-jump-toast';
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#ef4444;color:#ffffff;padding:12px 24px;border-radius:8px;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;font-size:0.95rem;font-weight:600;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,0.5);';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);
}

// 1. earth: normal start without the overlay
registerJump('earth', () => {
  setPhase('earth');
});

// 2. launchSite: facing the rocket pad, Prepare button visible
registerJump('launchSite', () => {
  const earth = (typeof window !== 'undefined') ? window.earthScene : null;
  if (earth && earth.launchSite && earth.camera) {
    const vp = earth.launchSite.viewPoint;
    earth.camera.position.copy(vp.position);
    earth.lookAtPoint(vp.lookAt);
    earth.setLocation('launchSite');
  }
  setPhase('launchSite');
});

// 3. gear: launch site plus gear popup open with preset applied
registerJump('gear', () => {
  const earth = (typeof window !== 'undefined') ? window.earthScene : null;
  if (earth && earth.launchSite && earth.camera) {
    const vp = earth.launchSite.viewPoint;
    earth.camera.position.copy(vp.position);
    earth.lookAtPoint(vp.lookAt);
    earth.setLocation('launchSite');
  }
  setPhase('launchSite');
  if (earth && earth.characterPopup) {
    earth.characterPopup.open();
  }
});

// 4. cockpit: cockpit running before launch
registerJump('cockpit', () => {
  switchToCockpit();
  setPhase('cockpit');
  if (window.cockpitScene?.start) {
    window.cockpitScene.start();
  }
});

// 5. orbit: cockpit at end of launch, orbit card open, floaters floating
registerJump('orbit', () => {
  switchToCockpit();
  setPhase('cockpit');
  const mission = getMission();
  if (window.cockpitScene?.start) {
    window.cockpitScene.start();
  }
  if (window.cockpitScene?.skipToOrbit) {
    window.cockpitScene.skipToOrbit(mission.fuelMargin);
  }
});

// 6. flight: flight just started (first frame of TLI burn)
registerJump('flight', () => {
  switchToCockpit();
  setPhase('cockpit');
  if (window.cockpitScene?.start) {
    window.cockpitScene.start();
  }
  if (window.cockpitScene?.startFlight) {
    window.cockpitScene.startFlight();
  }
});

// 7. storm: flight at the storm decision, red lights & effects
registerJump('storm', () => {
  switchToCockpit();
  setPhase('cockpit');
  if (window.cockpitScene?.start) {
    window.cockpitScene.start();
  }
  if (window.cockpitScene?.jumpToStorm) {
    window.cockpitScene.jumpToStorm();
  }
});

// 8. stormResult: storm result card open with chosen preset
registerJump('stormResult', (params) => {
  switchToCockpit();
  setPhase('cockpit');
  if (window.cockpitScene?.start) {
    window.cockpitScene.start();
  }
  const stormKey = params?.storm && STORM_PRESETS[params.storm] ? params.storm : DEFAULT_STORM_PRESET;
  const stormPreset = STORM_PRESETS[stormKey];
  if (window.cockpitScene?.jumpToStormResult) {
    window.cockpitScene.jumpToStormResult(stormPreset);
  }
});

// 9. lunarOrbit: lunar orbit view with site panel open
registerJump('lunarOrbit', (params) => {
  switchToCockpit();
  setPhase('cockpit');
  if (window.cockpitScene?.start) {
    window.cockpitScene.start();
  }
  const siteId = params?.site || 'ridge';
  if (window.cockpitScene?.jumpToLunarOrbit) {
    window.cockpitScene.jumpToLunarOrbit(siteId);
  }
});

// 10. landing: landing flip just starting
registerJump('landing', (params) => {
  switchToCockpit();
  setPhase('cockpit');
  const siteId = params?.site || 'ridge';
  setMission({ landingSite: siteId });
  if (window.cockpitScene?.start) {
    window.cockpitScene.start();
  }
  if (window.cockpitScene?.startLanding) {
    window.cockpitScene.startLanding();
  }
});

// 11. decision: landing hazard decision panel open
registerJump('decision', (params) => {
  switchToCockpit();
  setPhase('cockpit');
  const siteId = params?.site || 'ridge';
  setMission({ landingSite: siteId });
  if (window.cockpitScene?.start) {
    window.cockpitScene.start();
  }
  if (window.cockpitScene?.jumpToDecision) {
    window.cockpitScene.jumpToDecision();
  }
});

// 12. touchdown: touchdown card open, ground strip showing, floaters resting
registerJump('touchdown', (params) => {
  switchToCockpit();
  setPhase('cockpit');
  const siteId = params?.site || 'ridge';
  setMission({ landingSite: siteId });
  if (window.cockpitScene?.start) {
    window.cockpitScene.start();
  }
  const landKey = params?.landing && LANDING_PRESETS[params.landing] ? params.landing : DEFAULT_LANDING_PRESET;
  const landPreset = LANDING_PRESETS[landKey];
  if (window.cockpitScene?.jumpToTouchdown) {
    window.cockpitScene.jumpToTouchdown(landPreset);
  }
});

// 13. surface: standing on lunar surface next to lander with HUD
registerJump('surface', (params) => {
  if (typeof window !== 'undefined' && typeof window.pauseEarthScene === 'function') {
    window.pauseEarthScene();
  }
  const appCanvas = document.querySelector('#app canvas');
  if (appCanvas) {
    appCanvas.style.display = 'none';
  }
  if (window.cockpitScene?.stop) {
    window.cockpitScene.stop();
  }
  const cockpitCanvas = document.querySelector('.cockpit-canvas');
  if (cockpitCanvas) {
    cockpitCanvas.style.display = 'none';
  }

  const surfaceContainer = document.getElementById('surface-view');
  if (surfaceContainer) {
    surfaceContainer.classList.remove('hidden');
    surfaceContainer.style.display = 'block';
  }

  setPhase('surface');

  const mission = getMission();
  const site = getSite(mission.landingSite || params?.site || 'ridge');
  const loadout = typeof getLoadout === 'function' ? getLoadout() : null;
  const stats = getSurfaceStart(mission, loadout, site);

  mission.surface = {
    steppedOut: true,
    sawEarth: false,
    photoTaken: false,
    stats,
  };
  setMission(mission);

  if (window.surfaceScene) {
    window.surfaceScene.start({ site, stats, skipLadder: !params?.ladder });
  }
  if (window.surfaceHud) {
    window.surfaceHud.show(stats, site);
  }
});

// 14. base: start right at the first choice with hatch open
registerJump('base', (params) => {
  const jumpSurface = jumps.get('surface');
  if (jumpSurface) jumpSurface({ ...params, ladder: false });

  setTimeout(() => {
    const controller = window.baseController;
    const builder = window.surfaceScene?.getBaseBuilder?.();
    if (controller) {
      if (builder) controller.setBuilder(builder);
      controller.start({ skipIntro: true });
    }
  }, 100);
});

// 15. baseReady: base instantly built with chosen preset, unlocked at wide pose, ready card open
registerJump('baseReady', (params) => {
  const jumpSurface = jumps.get('surface');
  if (jumpSurface) jumpSurface({ ...params, ladder: false });

  setTimeout(() => {
    const mission = getMission();
    const site = getSite(mission.landingSite || params?.site || 'ridge');
    const baseKey = params?.base && BASE_PRESETS[params.base] ? params.base : DEFAULT_BASE_PRESET;
    const choices = { ...BASE_PRESETS[baseKey] };
    const stats = mission.surface?.stats || {};
    const finalBase = computeBase(choices, stats, site.id);

    mission.base = {
      started: true,
      built: true,
      choices,
      meters: finalBase,
      setupHours: finalBase.setupHours,
      fatiguePenalty: finalBase.fatiguePenalty,
    };
    if (finalBase.fatiguePenalty > 0) {
      mission.healthPenalty = (mission.healthPenalty || 0) + finalBase.fatiguePenalty;
    }
    setMission(mission);

    const builder = window.surfaceScene?.getBaseBuilder?.();
    if (builder) {
      builder.buildInstant(choices);
    }

    if (window.surfaceScene) {
      window.surfaceScene.setPose(CAMERA_POSES.wide);
      window.surfaceScene.lockControls(false);
    }

    if (window.surfaceHud) {
      window.surfaceHud.setBaseMode(true);
      window.surfaceHud.setMeters(finalBase, { animate: false });
      window.surfaceHud.showChip('Power', true);
      window.surfaceHud.showChip('Food', true);
    }

    const controller = window.baseController;
    if (controller && typeof controller.openReadyCard === 'function') {
      if (builder) controller.setBuilder(builder);
      controller.openReadyCard({
        meters: finalBase,
        setupHours: finalBase.setupHours,
        fatiguePenalty: finalBase.fatiguePenalty,
        choices,
        siteId: site.id,
      });
    }
  }, 100);
});

export function runJumpFromUrl() {
  if (!isDev || typeof window === 'undefined') return;

  const params = parseDevParams(window.location.search);
  if (!params.jump) return;

  try {
    // 1. Skip start overlay instantly
    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.classList.add('fade-out');
      overlay.style.display = 'none';
    }
    console.log('Going to the Moon');

    // 2. Set the loadout
    const gearKey = params.gear && GEAR_PRESETS[params.gear] ? params.gear : DEFAULT_GEAR_PRESET;
    const gearSel = GEAR_PRESETS[gearKey];
    const totals = computeTotals(gearSel);
    const loadout = {
      selection: { ...gearSel },
      totals,
      complete: true,
    };
    setLoadout(loadout);

    // 3. Set the mission state
    const mission = buildMission(params.jump, params);
    setMission(mission);

    // 4. Apply gear selection to popup/panel if it exists
    const earth = window.earthScene;
    if (earth?.characterPopup?.gearPanel?.setSelection) {
      earth.characterPopup.gearPanel.setSelection(gearSel);
    } else if (earth?.characterPopup?.setSelection) {
      earth.characterPopup.setSelection(gearSel);
    }

    // 5. Run the jump function
    const jumpFn = jumps.get(params.jump);
    if (typeof jumpFn === 'function') {
      jumpFn(params);
    } else {
      console.warn(`No handler registered for dev jump "${params.jump}"`);
    }
  } catch (error) {
    console.error(`Dev jump failed: ${params.jump}`, error);
    showToast('Dev jump failed. See the console.');
  }
}

export default {
  registerJump,
  getJumpNames,
  runJumpFromUrl,
};
