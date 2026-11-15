// ---------------------------------------------------------------------------
// Pure Flight Logic for Translunar Flight, Storm & Lunar Orbit
// ---------------------------------------------------------------------------

import { ORBIT_VIEW, ARRIVAL_VIEW, LUNAR_ORBIT_VIEW } from './outsideViews.js';

export const FLIGHT = {
  duration: 60.0,
  tliBurnEnd: 6.0,
  midcourseStart: 20.0,
  midcourseEnd: 23.0,
  stormAlert: 28.0,
  stormDuration: 5.0,
  loiBurnStart: 48.0,
  loiBurnEnd: 54.0,
  settleEnd: 58.0,
};

export const STORM_BASE_DOSE = 240;

export const STORM_FACTS = [
  'In August 1972, between Apollo 16 and 17, a massive solar flare erupted that would have delivered a lethal radiation dose to astronauts outside Earth\'s magnetosphere.',
  'Coronal mass ejections (CMEs) travel at millions of kilometers per hour, hurling billions of tons of magnetized solar plasma across deep space.',
  'Deep-space crew capsules use heavy equipment, water tanks, and propellant reserves as improvised radiation shelters during solar particle events.',
];

export const ARRIVAL_FACTS = [
  'Because the Moon has no atmosphere for aerobraking, spacecraft must burn rockets retrograde to slow down and enter lunar orbit.',
  'A low lunar orbit at 100 km altitude completes one circuit around the Moon every 118 minutes.',
  'The far side of the Moon experiences total radio blackout from Earth, requiring relay satellites or automated landing protocols.',
];

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function getViewAt(tf) {
  const t = Math.max(0, Math.min(FLIGHT.duration, tf));

  if (t <= 14.0) {
    return { ...ORBIT_VIEW };
  }

  if (t < 44.0) {
    const p = smoothstep(14.0, 44.0, t);
    return {
      earthScale: lerp(ORBIT_VIEW.earthScale, ARRIVAL_VIEW.earthScale, p),
      earthOffsetY: lerp(ORBIT_VIEW.earthOffsetY, ARRIVAL_VIEW.earthOffsetY, p),
      earthYawDeg: lerp(ORBIT_VIEW.earthYawDeg, ARRIVAL_VIEW.earthYawDeg, p),
      earthPitchDeg: lerp(ORBIT_VIEW.earthPitchDeg, ARRIVAL_VIEW.earthPitchDeg, p),
      moonDistance: lerp(ORBIT_VIEW.moonDistance, ARRIVAL_VIEW.moonDistance, p),
      moonScale: lerp(ORBIT_VIEW.moonScale, ARRIVAL_VIEW.moonScale, p),
      moonYawDeg: lerp(ORBIT_VIEW.moonYawDeg, ARRIVAL_VIEW.moonYawDeg, p),
      moonPitchDeg: lerp(ORBIT_VIEW.moonPitchDeg, ARRIVAL_VIEW.moonPitchDeg, p),
    };
  }

  if (t < 48.0) {
    return { ...ARRIVAL_VIEW };
  }

  if (t < 56.0) {
    const p = smoothstep(48.0, 56.0, t);
    return {
      earthScale: lerp(ARRIVAL_VIEW.earthScale, LUNAR_ORBIT_VIEW.earthScale, p),
      earthOffsetY: lerp(ARRIVAL_VIEW.earthOffsetY, LUNAR_ORBIT_VIEW.earthOffsetY, p),
      earthYawDeg: lerp(ARRIVAL_VIEW.earthYawDeg, LUNAR_ORBIT_VIEW.earthYawDeg, p),
      earthPitchDeg: lerp(ARRIVAL_VIEW.earthPitchDeg, LUNAR_ORBIT_VIEW.earthPitchDeg, p),
      moonDistance: lerp(ARRIVAL_VIEW.moonDistance, LUNAR_ORBIT_VIEW.moonDistance, p),
      moonScale: lerp(ARRIVAL_VIEW.moonScale, LUNAR_ORBIT_VIEW.moonScale, p),
      moonYawDeg: lerp(ARRIVAL_VIEW.moonYawDeg, LUNAR_ORBIT_VIEW.moonYawDeg, p),
      moonPitchDeg: lerp(ARRIVAL_VIEW.moonPitchDeg, LUNAR_ORBIT_VIEW.moonPitchDeg, p),
    };
  }

  return { ...LUNAR_ORBIT_VIEW };
}

export function getFlightFrame(tf, mission = {}) {
  const t = Math.max(0, Math.min(FLIGHT.duration, tf));
  const progress = t / FLIGHT.duration;

  let stage = 'coast';
  let stageLabel = 'Translunar Coast';
  let distanceKm = 384400;
  let speedKmh = 28000;
  let g = 0;
  let shake = 0;
  let thrust = 0;

  if (t < FLIGHT.tliBurnEnd) {
    stage = 'tli';
    stageLabel = 'Trans-Lunar Injection';
    const p = t / FLIGHT.tliBurnEnd;
    g = 1.0 + 0.5 * Math.sin(p * Math.PI);
    thrust = 1.0;
    shake = 0.75 + 0.2 * Math.sin(t * 18);
    speedKmh = lerp(28000, 39400, p);
    distanceKm = lerp(384400, 362000, p * p);
  } else if (t <= FLIGHT.midcourseStart) {
    stage = 'coast1';
    stageLabel = 'Translunar Coast';
    const p = (t - FLIGHT.tliBurnEnd) / (FLIGHT.midcourseStart - FLIGHT.tliBurnEnd);
    g = 0;
    thrust = 0;
    shake = 0;
    speedKmh = lerp(39400, 11800, Math.pow(p, 0.6));
    distanceKm = lerp(362000, 205000, p);
  } else if (t < FLIGHT.midcourseEnd) {
    stage = 'midcourse';
    stageLabel = 'Midcourse Correction';
    const p = (t - FLIGHT.midcourseStart) / (FLIGHT.midcourseEnd - FLIGHT.midcourseStart);
    g = 0.35;
    thrust = 0.4;
    shake = 0.2 + 0.1 * Math.sin(t * 12);
    speedKmh = lerp(11800, 11400, p);
    distanceKm = lerp(205000, 188000, p);
  } else if (t < FLIGHT.stormAlert) {
    stage = 'coast2';
    stageLabel = 'Translunar Coast';
    const p = (t - FLIGHT.midcourseEnd) / (FLIGHT.stormAlert - FLIGHT.midcourseEnd);
    g = 0;
    thrust = 0;
    shake = 0;
    speedKmh = lerp(11400, 8900, p);
    distanceKm = lerp(188000, 155000, p);
  } else if (t < FLIGHT.stormAlert + FLIGHT.stormDuration) {
    stage = 'storm';
    stageLabel = 'Solar Storm Warning';
    const p = (t - FLIGHT.stormAlert) / FLIGHT.stormDuration;
    g = 0;
    thrust = 0;
    shake = 0.15 * Math.sin(t * 15);
    speedKmh = lerp(8900, 7200, p);
    distanceKm = lerp(155000, 122000, p);
  } else if (t <= FLIGHT.loiBurnStart) {
    stage = 'coast3';
    stageLabel = 'Lunar Approach';
    const p = (t - (FLIGHT.stormAlert + FLIGHT.stormDuration)) / (FLIGHT.loiBurnStart - (FLIGHT.stormAlert + FLIGHT.stormDuration));
    g = 0;
    thrust = 0;
    shake = 0;
    speedKmh = lerp(7200, 9300, p * p);
    distanceKm = lerp(122000, 1200, p);
  } else if (t < FLIGHT.loiBurnEnd) {
    stage = 'coast3';
    stageLabel = 'Lunar Approach';
    const p = (t - (FLIGHT.stormAlert + FLIGHT.stormDuration)) / (FLIGHT.loiBurnStart - (FLIGHT.stormAlert + FLIGHT.stormDuration));
    g = 0;
    thrust = 0;
    shake = 0;
    speedKmh = lerp(7200, 9300, p * p);
    distanceKm = lerp(122000, 1200, p);
  } else if (t < FLIGHT.loiBurnEnd) {
    stage = 'loi';
    stageLabel = 'Lunar Orbit Insertion';
    const p = (t - FLIGHT.loiBurnStart) / (FLIGHT.loiBurnEnd - FLIGHT.loiBurnStart);
    g = 1.35;
    thrust = 1.0;
    shake = 0.65 + 0.15 * Math.sin(t * 16);
    speedKmh = lerp(9300, 5850, p);
    distanceKm = lerp(1200, 100, p);
  } else {
    stage = 'lunarOrbit';
    stageLabel = 'Low Lunar Orbit';
    g = 0;
    thrust = 0;
    shake = 0;
    speedKmh = 5850;
    distanceKm = 100;
  }

  const view = getViewAt(t);

  return {
    t,
    stage,
    stageLabel,
    distanceKm: Math.round(distanceKm),
    speedKmh: Math.round(speedKmh),
    g,
    shake,
    thrust,
    progress,
    view,
    fuelMargin: typeof mission.fuelMargin === 'number' ? mission.fuelMargin : 25,
  };
}

export function computeStormOutcome({ choice, loadoutSummary = null }) {
  const radLevel = loadoutSummary?.radiation?.level || 'average';
  let suitFactor = 0.45;
  if (radLevel === 'good') suitFactor = 0.75;
  if (radLevel === 'bad') suitFactor = 0.15;

  let calculatedDose = 0;
  let message = '';
  let healthPenalty = 0;
  let level = 'moderate';

  if (choice === 'orient') {
    // Ship heat shield maneuver absorbs 70% of proton flux
    const shieldDose = STORM_BASE_DOSE * (1 - 0.70);
    calculatedDose = Math.round(shieldDose * (1 - suitFactor * 0.4));
    message = 'Heat shield oriented toward the coronal front. Heavy tungsten-composite bulkhead absorbed the primary proton wave.';
  } else {
    // Cabin interior & suit shielding absorb 30% baseline
    const cabinDose = STORM_BASE_DOSE * (1 - 0.30);
    calculatedDose = Math.round(cabinDose * (1 - suitFactor * 0.8));
    message = 'Crew sequestered inside storm shelter. Suit attenuation mitigated secondary bremsstrahlung particles.';
  }

  if (calculatedDose < 50) {
    level = 'low';
    healthPenalty = 0;
  } else if (calculatedDose < 110) {
    level = 'moderate';
    healthPenalty = 5;
  } else {
    level = 'high';
    healthPenalty = 15;
  }

  const factIndex = Math.floor(Math.random() * STORM_FACTS.length);
  const fact = STORM_FACTS[factIndex] || STORM_FACTS[0];

  return {
    choice,
    dose: calculatedDose,
    level,
    healthPenalty,
    message,
    fact,
  };
}

export function estimateStormOutcome(choice, loadoutSummary = null) {
  const radLevel = loadoutSummary?.radiation?.level || 'average';
  if (choice === 'orient') {
    if (radLevel === 'good') return 'Est. dose: ~25 mSv (Minimal risk, thruster fuel use)';
    if (radLevel === 'bad') return 'Est. dose: ~55 mSv (Moderate risk, high shielding reliance)';
    return 'Est. dose: ~38 mSv (Low risk, heat shield primary)';
  } else {
    if (radLevel === 'good') return 'Est. dose: ~45 mSv (Low risk, suit protection effective)';
    if (radLevel === 'bad') return 'Est. dose: ~135 mSv (High risk: poor gear shielding!)';
    return 'Est. dose: ~85 mSv (Moderate risk inside cabin)';
  }
}

export function getStormFrame(ts, outcome) {
  const t = Math.max(0, Math.min(5.0, ts));
  const intensity = Math.sin((t / 5.0) * Math.PI);
  const glitch = intensity * (0.3 + 0.7 * Math.random());
  return {
    t,
    intensity,
    glitch,
    doseRate: Math.round(intensity * (outcome?.dose || 60) * 12),
    alert: intensity > 0.1,
  };
}

export function formatFlightElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const padM = m < 10 ? '0' + m : '' + m;
  const padS = rem < 10 ? '0' + rem : '' + rem;
  return `T+${padM}:${padS}`;
}

export function formatKm(val) {
  const num = Math.round(val);
  return num.toLocaleString('en-US') + ' km';
}

export default {
  FLIGHT,
  STORM_BASE_DOSE,
  STORM_FACTS,
  ARRIVAL_FACTS,
  getViewAt,
  getFlightFrame,
  computeStormOutcome,
  estimateStormOutcome,
  getStormFrame,
  formatFlightElapsed,
  formatKm,
};
