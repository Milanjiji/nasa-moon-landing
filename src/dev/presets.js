import { computeTotals, WEIGHT_LIMIT } from '../data/gear.js';
import { computeFuelMargin } from '../game/launchSequence.js';

export const GEAR_PRESETS = {
  light: {
    suit: 'suit-light',
    helmet: 'helmet-basic',
    gloves: 'gloves-flex',
    boots: 'boots-light',
    backpack: 'pack-small',
  },
  balanced: {
    suit: 'suit-standard',
    helmet: 'helmet-sun',
    gloves: 'gloves-insulated',
    boots: 'boots-grip',
    backpack: 'pack-standard',
  },
  shield: {
    suit: 'suit-shield',
    helmet: 'helmet-dome',
    gloves: 'gloves-insulated',
    boots: 'boots-grip',
    backpack: 'pack-standard',
  },
};

export const DEFAULT_GEAR_PRESET = 'balanced';

export const STORM_PRESETS = {
  none: { choice: 'shelter', dose: 10, level: 'none', healthPenalty: 0, fuelCost: 4 },
  minor: { choice: 'push', dose: 40, level: 'minor', healthPenalty: 15, fuelCost: 0 },
  serious: { choice: 'push', dose: 80, level: 'serious', healthPenalty: 35, fuelCost: 0 },
};

export const DEFAULT_STORM_PRESET = 'none';

export const LANDING_PRESETS = {
  soft: { choice: 'continue', risk: 5, level: 'soft', damage: 'none', healthPenalty: 0, fuelCost: 0 },
  rough: { choice: 'continue', risk: 18, level: 'rough', damage: 'minor', healthPenalty: 5, fuelCost: 0 },
  hard: { choice: 'divert', risk: 40, level: 'hard', damage: 'major', healthPenalty: 15, fuelCost: 5 },
};

export const DEFAULT_LANDING_PRESET = 'soft';

export const BASE_PRESETS = {
  fast: { solar: 'small', habitat: 'compact', air: 'light', shield: 'thin' },
  balanced: { solar: 'large', habitat: 'compact', air: 'full', shield: 'thin' },
  safe: { solar: 'large', habitat: 'roomy', air: 'full', shield: 'thick' },
};

export const DEFAULT_BASE_PRESET = 'balanced';

export const JUMP_ORDER = [
  'earth',
  'launchSite',
  'gear',
  'cockpit',
  'orbit',
  'flight',
  'storm',
  'stormResult',
  'lunarOrbit',
  'landing',
  'decision',
  'touchdown',
  'surface',
  'base',
  'baseReady',
];

export function buildMission(jumpName, params = {}) {
  const p = params || {};
  const jumpIndex = JUMP_ORDER.indexOf(jumpName);
  const idx = jumpIndex >= 0 ? jumpIndex : 0;

  const gearKey = p.gear && GEAR_PRESETS[p.gear] ? p.gear : DEFAULT_GEAR_PRESET;
  const gearSel = GEAR_PRESETS[gearKey];
  const totals = computeTotals(gearSel);
  const totalWeight = totals.weight || 0;
  const baseMargin = computeFuelMargin(totalWeight, WEIGHT_LIMIT);

  const stormKey = p.storm && STORM_PRESETS[p.storm] ? p.storm : DEFAULT_STORM_PRESET;
  const stormP = STORM_PRESETS[stormKey];

  const landKey = p.landing && LANDING_PRESETS[p.landing] ? p.landing : DEFAULT_LANDING_PRESET;
  const landP = LANDING_PRESETS[landKey];

  const site = p.site === 'crater' ? 'crater' : 'ridge';

  const mission = {
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
    surface: {
      steppedOut: false,
      sawEarth: false,
      photoTaken: false,
      stats: null,
    },
  };

  // From "orbit" on (idx >= 4)
  if (idx >= 4) {
    mission.orbitReached = true;
    let margin = baseMargin;
    if (idx >= 7) {
      margin -= stormP.fuelCost;
    }
    if (idx >= 11) {
      margin -= landP.fuelCost;
    }
    mission.fuelMargin = Math.max(0, margin);
  }

  // From "stormResult" on (idx >= 7)
  if (idx >= 7) {
    mission.stormChoice = stormP.choice;
    mission.stormDose = stormP.dose;
    mission.stormLevel = stormP.level;
    mission.healthPenalty += stormP.healthPenalty;
  }

  // From "lunarOrbit" on (idx >= 8)
  if (idx >= 8) {
    mission.landingSite = site;
    mission.lunarOrbitReached = true;
  }

  // From "touchdown" on (idx >= 11)
  if (idx >= 11) {
    mission.landingChoice = landP.choice;
    mission.landingRisk = landP.risk;
    mission.landingLevel = landP.level;
    mission.damage = landP.damage;
    mission.healthPenalty += landP.healthPenalty;
    mission.landed = true;
  }

  // From "surface" on (idx >= 12)
  if (idx >= 12) {
    mission.surface.steppedOut = true;
  }

  // From "base" on (idx >= 13)
  if (idx >= 13) {
    mission.base = mission.base || {};
    mission.base.started = true;
  }

  // From "baseReady" on (idx >= 14)
  if (idx >= 14) {
    const baseKey = p.base && BASE_PRESETS[p.base] ? p.base : DEFAULT_BASE_PRESET;
    const baseChoices = { ...BASE_PRESETS[baseKey] };
    mission.base.built = true;
    mission.base.choices = baseChoices;
  }

  return mission;
}

const warnedParams = new Set();
function warnOnce(key, msg) {
  if (!warnedParams.has(key)) {
    warnedParams.add(key);
    console.warn(msg);
  }
}

export function parseDevParams(search = '') {
  let q = '';
  if (typeof search === 'string') {
    q = search.startsWith('?') ? search.slice(1) : search;
  } else if (typeof window !== 'undefined' && window.location?.search) {
    q = window.location.search.slice(1);
  }

  const urlParams = new URLSearchParams(q);

  let jump = urlParams.get('jump');
  if (jump && !JUMP_ORDER.includes(jump)) {
    warnOnce(`jump:${jump}`, `Unknown jump "${jump}", falling back to default.`);
    jump = null;
  }

  let site = urlParams.get('site');
  if (site && site !== 'ridge' && site !== 'crater') {
    warnOnce(`site:${site}`, `Unknown site "${site}", falling back to "ridge".`);
    site = 'ridge';
  } else if (!site) {
    site = 'ridge';
  }

  let gear = urlParams.get('gear');
  if (gear && !GEAR_PRESETS[gear]) {
    warnOnce(`gear:${gear}`, `Unknown gear "${gear}", falling back to "${DEFAULT_GEAR_PRESET}".`);
    gear = DEFAULT_GEAR_PRESET;
  } else if (!gear) {
    gear = DEFAULT_GEAR_PRESET;
  }

  let storm = urlParams.get('storm');
  if (storm && !STORM_PRESETS[storm]) {
    warnOnce(`storm:${storm}`, `Unknown storm "${storm}", falling back to "${DEFAULT_STORM_PRESET}".`);
    storm = DEFAULT_STORM_PRESET;
  } else if (!storm) {
    storm = DEFAULT_STORM_PRESET;
  }

  let landing = urlParams.get('landing');
  if (landing && !LANDING_PRESETS[landing]) {
    warnOnce(`landing:${landing}`, `Unknown landing "${landing}", falling back to "${DEFAULT_LANDING_PRESET}".`);
    landing = DEFAULT_LANDING_PRESET;
  } else if (!landing) {
    landing = DEFAULT_LANDING_PRESET;
  }

  const ladderVal = urlParams.get('ladder');
  const ladder = ladderVal === '1' || ladderVal === 'true';

  let base = urlParams.get('base');
  if (base && !BASE_PRESETS[base]) {
    warnOnce(`base:${base}`, `Unknown base "${base}", falling back to "${DEFAULT_BASE_PRESET}".`);
    base = DEFAULT_BASE_PRESET;
  } else if (!base) {
    base = DEFAULT_BASE_PRESET;
  }

  return {
    jump,
    site,
    gear,
    storm,
    landing,
    ladder,
    base,
  };
}

export default {
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
};
