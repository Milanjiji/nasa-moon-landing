// ---------------------------------------------------------------------------
// Pure Landing Logic for Descent, Hazard Decision, and Touchdown
// ---------------------------------------------------------------------------

export const LANDING_MILESTONES = [
  { t: 0, text: 'Turning the ship: engines down' },
  { t: 8, text: 'Engine burn: leaving orbit' },
  { t: 16, text: 'Engines steady. Powered descent' },
  { t: 24, text: 'Landing camera online' },
  { t: 32, text: 'Altitude below 5 km' },
  { t: 40, text: 'Hazard ahead: boulders near the target' },
  { t: 50, text: 'Altitude below 100 m. Slowing down' },
  { t: 58, text: 'Contact light soon' },
  { t: 62, text: 'Touchdown' },
  { t: 66, text: 'Engines off' },
];

export const LANDING_FACTS = [
  "The Moon's gravity is about one sixth of Earth's, so everything weighs much less.",
  'With almost no air, a lander cannot use parachutes. It must brake with its engines.',
  'Landing engines kick up fast-moving dust that can damage equipment.',
  "Near the Moon's poles the Sun stays very low, so shadows are long and hard to judge.",
];

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function canDivert(fuelMargin) {
  return Number.isFinite(fuelMargin) && fuelMargin >= 5;
}

export function getDivertOffset(ts) {
  if (typeof ts !== 'number' || !isFinite(ts) || ts <= 0) return 0;
  if (ts >= 4.0) return 0.22;
  return 0.22 * smoothstep(0, 4.0, ts);
}

export function formatAltitude(m) {
  if (typeof m !== 'number' || !isFinite(m) || m <= 0) return '0 m';
  if (m >= 10000) {
    return (m / 1000).toFixed(1) + ' km';
  }
  return Math.round(m).toLocaleString('en-US') + ' m';
}

export function computeLandingOutcome(choiceOrObj, optTerrain, optFuel, optMob) {
  let choice = choiceOrObj;
  let terrain = optTerrain;
  let fuelMargin = optFuel;
  let mobilityRatio = optMob;
  if (typeof choiceOrObj === 'object' && choiceOrObj !== null) {
    choice = choiceOrObj.choice;
    terrain = choiceOrObj.terrain;
    fuelMargin = choiceOrObj.fuelMargin;
    mobilityRatio = choiceOrObj.mobilityRatio ?? choiceOrObj.mobilityScore;
  }

  const tNum = (typeof terrain === 'number' && isFinite(terrain)) ? Math.max(1, Math.min(5, terrain)) : 3;
  let mob = (typeof mobilityRatio === 'number' && isFinite(mobilityRatio)) ? Math.max(0, Math.min(1, mobilityRatio)) : 0;
  const fuel = (typeof fuelMargin === 'number' && isFinite(fuelMargin)) ? Math.max(0, fuelMargin) : 0;

  let activeChoice = choice;
  if (activeChoice === 'divert' && !canDivert(fuel)) {
    activeChoice = 'continue';
  }

  const base = activeChoice === 'divert' ? tNum * 5 : tNum * 10;
  const fuelCredit = (activeChoice === 'divert' ? Math.max(0, fuel - 5) : fuel) * 0.8;
  const mobCredit = mob * 10;
  const risk = Math.round(Math.min(100, Math.max(0, base - fuelCredit - mobCredit)));

  let level = 'hard';
  let levelLabel = 'Hard landing';
  let healthPenalty = 15;
  let damage = 'major';

  if (risk < 10) {
    level = 'soft';
    levelLabel = 'Soft landing';
    healthPenalty = 0;
    damage = 'none';
  } else if (risk < 25) {
    level = 'rough';
    levelLabel = 'Rough landing';
    healthPenalty = 5;
    damage = 'minor';
  }

  const fuelCost = activeChoice === 'divert' ? 5 : 0;
  const fuelAfter = Math.max(0, fuel - fuelCost);

  return {
    choice: activeChoice,
    risk,
    level,
    levelLabel,
    fuelCost,
    fuelAfter,
    healthPenalty,
    damage,
  };
}

export function getLandingFrame(rawTl, mission = {}) {
  const tl = typeof rawTl === 'number' && isFinite(rawTl) ? rawTl : 0;

  let stage = 'flip';
  let stageLabel = 'Turning the ship: engines down';

  if (tl < 8) {
    stage = 'flip';
    stageLabel = 'Turning the ship: engines down';
  } else if (tl < 16) {
    stage = 'deorbit';
    stageLabel = 'Engine burn: leaving orbit';
  } else if (tl < 40) {
    stage = 'descent';
    stageLabel = 'Powered descent';
  } else if (tl < 62) {
    stage = 'final';
    stageLabel = 'Final approach';
  } else if (tl < 66) {
    stage = 'touchdown';
    stageLabel = 'Touchdown';
  } else {
    stage = 'landed';
    stageLabel = 'Landed';
  }

  // 1. Altitude calculation (never increasing)
  let altitudeM = 100000;
  if (tl <= 8) {
    altitudeM = 100000;
  } else if (tl < 16) {
    const p = (tl - 8) / 8;
    const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
    altitudeM = 100000 - 85000 * ease;
  } else if (tl < 40) {
    const p = (tl - 16) / 24;
    const ease = 2 * p - p * p;
    altitudeM = 15000 - 14600 * ease;
  } else if (tl < 62) {
    const p = (tl - 40) / 22;
    altitudeM = 400 * Math.pow(1 - p, 2);
  } else {
    altitudeM = 0;
  }

  // 2. Vertical Speed (downward, never negative)
  let vSpeedMs = 0;
  if (tl <= 8) {
    vSpeedMs = 0;
  } else if (tl < 16) {
    const p = (tl - 8) / 8;
    vSpeedMs = 90 * (p * p * (3 - 2 * p));
  } else if (tl < 40) {
    const p = (tl - 16) / 24;
    vSpeedMs = 90 - 45 * (p * p * (3 - 2 * p));
  } else if (tl < 62) {
    const p = (tl - 40) / 22;
    vSpeedMs = 45 - 43.5 * (p * p * (3 - 2 * p));
  } else if (tl < 63) {
    const p = tl - 62;
    vSpeedMs = 1.5 * (1 - p * p * (3 - 2 * p));
  } else {
    vSpeedMs = 0;
  }

  // 3. G-Force (never negative)
  let g = 0;
  if (tl <= 8) {
    g = 0;
  } else if (tl < 16) {
    const p = (tl - 8) / 8;
    g = 0.1 * p + 0.30 * Math.sin(Math.PI * p);
  } else if (tl < 58) {
    const p = (tl - 16) / 42;
    g = 0.10 + 0.18 * p;
  } else if (tl < 62) {
    g = 0.28;
  } else if (tl < 64) {
    const p = (tl - 62) / 2;
    g = 0.28 - 0.11 * (p * p * (3 - 2 * p));
  } else {
    g = 0.17;
  }

  // 4. Shake (0 to 1)
  let shake = 0;
  if (tl <= 8) {
    shake = 0;
  } else if (tl < 16) {
    const p = (tl - 8) / 8;
    shake = 0.25 * p + 0.225 * Math.sin(Math.PI * p);
  } else if (tl < 58) {
    const p = (tl - 16) / 42;
    shake = 0.25 + 0.20 * p;
  } else if (tl < 62) {
    const p = (tl - 58) / 4;
    shake = 0.45 + 0.25 * p;
  } else if (tl < 65) {
    const p = (tl - 62) / 3;
    shake = 0.7 * (1 - p * p * (3 - 2 * p));
  } else {
    shake = 0;
  }

  // 5. Flame (0 to 1)
  let flame = 0;
  if (tl <= 8) {
    flame = 0;
  } else if (tl < 16) {
    const p = (tl - 8) / 8;
    flame = 0.5 * p + 0.35 * Math.sin(Math.PI * p);
  } else if (tl < 58) {
    const p = (tl - 16) / 42;
    flame = 0.5 + 0.3 * p;
  } else if (tl < 62) {
    flame = 0.8;
  } else if (tl < 63) {
    const p = tl - 62;
    flame = 0.8 * (1 - p);
  } else {
    flame = 0;
  }

  // 6. Thrust percentage (0 to 100)
  let thrustPct = 0;
  if (tl <= 8) {
    thrustPct = 0;
  } else if (tl < 16) {
    const p = (tl - 8) / 8;
    thrustPct = Math.round(40 * p + 50 * Math.sin(Math.PI * p));
  } else if (tl < 58) {
    const p = (tl - 16) / 42;
    thrustPct = Math.round(40 + 45 * p);
  } else if (tl <= 62) {
    thrustPct = 85;
  } else {
    thrustPct = 0;
  }

  // 7. Dust (0 to 1)
  let dust = 0;
  if (tl <= 50) {
    dust = 0;
  } else if (tl <= 62) {
    const p = (tl - 50) / 12;
    dust = p * p * (3 - 2 * p);
  } else if (tl < 72) {
    const p = (tl - 62) / 10;
    dust = 1 - p * p * (3 - 2 * p);
  } else {
    dust = 0;
  }

  // 8. Zoom (0.12 before 16 to 4.0 at 62)
  let zoom = 0.12;
  if (tl <= 16) {
    zoom = 0.12;
  } else if (tl < 62) {
    const p = (tl - 16) / 46;
    zoom = Math.exp(Math.log(0.12) + p * (Math.log(4.0) - Math.log(0.12)));
  } else {
    zoom = 4.0;
  }

  // 9. Flip progress (0 at tl=0 to 1 at tl=8)
  let flipProgress = 0;
  if (tl <= 0) {
    flipProgress = 0;
  } else if (tl < 8) {
    flipProgress = smoothstep(0, 8, tl);
  } else {
    flipProgress = 1;
  }

  const targetOffsetX = 0;

  return {
    stage,
    stageLabel,
    altitudeM: Math.max(0, altitudeM),
    vSpeedMs: Math.max(0, vSpeedMs),
    g: Math.max(0, g),
    shake: Math.max(0, Math.min(1, shake)),
    flame: Math.max(0, Math.min(1, flame)),
    thrustPct: Math.max(0, Math.min(100, thrustPct)),
    dust: Math.max(0, Math.min(1, dust)),
    zoom,
    flipProgress,
    targetOffsetX,
  };
}

export default {
  LANDING_MILESTONES,
  LANDING_FACTS,
  canDivert,
  getDivertOffset,
  formatAltitude,
  computeLandingOutcome,
  getLandingFrame,
};
