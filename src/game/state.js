// ---------------------------------------------------------------------------
// Shared Game State
// ---------------------------------------------------------------------------

export const PHASES = [
  'earth',
  'launchSite',
  'cockpit',
  'launch',
  'flight',
  'storm',
  'lunarOrbit',
  'landing',
  'base',
  'ending',
];

const state = {
  phase: 'earth',
  loadout: null,
  mission: {
    fuelMargin: null,
    launchedAt: null,
    orbitReached: false,
    stormChoice: null,
    stormDose: null,
    stormLevel: null,
    healthPenalty: 0,
    landingSite: null,
    lunarOrbitReached: false,
    landingChoice: null,
    landingRisk: null,
    landingLevel: null,
    damage: 'none',
    landed: false,
  },
};

const phaseListeners = new Set();

export function getState() {
  return {
    phase: state.phase,
    loadout: state.loadout ? { ...state.loadout } : null,
    mission: { ...state.mission },
  };
}

export function getPhase() {
  return state.phase;
}

export function setPhase(name) {
  if (!PHASES.includes(name)) {
    console.warn(`Unknown game phase: "${name}". Valid phases:`, PHASES);
    return false;
  }
  if (state.phase === name) return true;
  const oldPhase = state.phase;
  state.phase = name;
  for (const listener of phaseListeners) {
    try {
      listener(state.phase, oldPhase);
    } catch (err) {
      console.error('Phase listener error:', err);
    }
  }
  return true;
}

export function setLoadout(loadout) {
  state.loadout = loadout ? { ...loadout } : null;
}

export function getLoadout() {
  return state.loadout ? { ...state.loadout } : null;
}

export function onPhaseChange(callback) {
  if (typeof callback === 'function') {
    phaseListeners.add(callback);
    return () => {
      phaseListeners.delete(callback);
    };
  }
  return () => {};
}

export function setMission(partial) {
  if (partial && typeof partial === 'object') {
    state.mission = {
      ...state.mission,
      ...partial,
    };
  }
}

export function getMission() {
  return { ...state.mission };
}

export function resetMission() {
  state.mission = {
    fuelMargin: null,
    launchedAt: null,
    orbitReached: false,
    stormChoice: null,
    stormDose: null,
    stormLevel: null,
    healthPenalty: 0,
    landingSite: null,
    lunarOrbitReached: false,
    landingChoice: null,
    landingRisk: null,
    landingLevel: null,
    damage: 'none',
    landed: false,
  };
}

export function resetGame() {
  state.loadout = null;
  resetMission();
  setPhase('earth');
}

export default {
  PHASES,
  getState,
  getPhase,
  setPhase,
  setLoadout,
  getLoadout,
  onPhaseChange,
  setMission,
  getMission,
  resetMission,
  resetGame,
};
