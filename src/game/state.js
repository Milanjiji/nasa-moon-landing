// ---------------------------------------------------------------------------
// Shared Game State
// ---------------------------------------------------------------------------

export const PHASES = [
  'earth',
  'launchSite',
  'cockpit',
  'launch',
  'storm',
  'landing',
  'base',
  'ending',
];

const state = {
  phase: 'earth',
  loadout: null,
};

const phaseListeners = new Set();

export function getState() {
  return {
    phase: state.phase,
    loadout: state.loadout ? { ...state.loadout } : null,
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

export function resetGame() {
  state.loadout = null;
  setPhase('earth');
}
