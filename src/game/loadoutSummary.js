import { computeMaxes, WEIGHT_LIMIT } from '../data/gear.js';

// ---------------------------------------------------------------------------
// Colors for ratings
// ---------------------------------------------------------------------------
export function levelColor(level) {
  if (level === 'good') return '#34d399';
  if (level === 'warn') return '#ffb020';
  if (level === 'bad') return '#ff5b5b';
  return '#9fd8ff';
}

// ---------------------------------------------------------------------------
// Loadout Summary Builder
// ---------------------------------------------------------------------------
export function summarizeLoadout(totals) {
  const maxes = computeMaxes();

  // Radiation
  const radVal = (totals && typeof totals.radiation === 'number') ? totals.radiation : 0;
  const radMax = (maxes && typeof maxes.radiation === 'number') ? maxes.radiation : 0;
  const radRatio = radMax > 0 ? radVal / radMax : 0;
  let radLevel = 'bad';
  let radLabel = 'Radiation shield: minimal';
  if (radRatio >= 0.6) {
    radLevel = 'good';
    radLabel = 'Radiation shield ready';
  } else if (radRatio >= 0.35) {
    radLevel = 'warn';
    radLabel = 'Radiation shield: light';
  }

  // Air
  const rawAir = totals ? (typeof totals.oxygen === 'number' ? totals.oxygen : totals.air) : 0;
  const airVal = typeof rawAir === 'number' ? rawAir : 0;
  const rawAirMax = maxes ? (typeof maxes.oxygen === 'number' ? maxes.oxygen : maxes.air) : 0;
  const airMax = typeof rawAirMax === 'number' ? rawAirMax : 0;
  const airRatio = airMax > 0 ? airVal / airMax : 0;
  let airLevel = 'bad';
  let airLabel = 'Air supply: very low';
  if (airRatio >= 0.65) {
    airLevel = 'good';
    airLabel = 'Air supply: plenty';
  } else if (airRatio >= 0.3) {
    airLevel = 'warn';
    airLabel = 'Air supply: short';
  }

  // Mobility
  const mobVal = (totals && typeof totals.mobility === 'number') ? totals.mobility : 0;
  const mobMax = (maxes && typeof maxes.mobility === 'number') ? maxes.mobility : 0;
  const mobRatio = mobMax > 0 ? mobVal / mobMax : 0;
  let mobLevel = 'bad';
  let mobLabel = 'Mobility: poor';
  if (mobRatio >= 0.5) {
    mobLevel = 'good';
    mobLabel = 'Mobility: good';
  } else if (mobRatio >= 0.3) {
    mobLevel = 'warn';
    mobLabel = 'Mobility: limited';
  }

  // Weight
  const weightVal = (totals && typeof totals.weight === 'number') ? totals.weight : 0;
  const weightLimit = typeof WEIGHT_LIMIT === 'number' ? WEIGHT_LIMIT : 60;
  const weightRatio = weightLimit > 0 ? weightVal / weightLimit : 0;
  const weightLabel = `Weight ${weightVal} / ${weightLimit} kg`;

  return {
    radiation: {
      value: radVal,
      max: radMax,
      ratio: radRatio,
      level: radLevel,
      label: radLabel,
    },
    air: {
      value: airVal,
      max: airMax,
      ratio: airRatio,
      level: airLevel,
      label: airLabel,
    },
    mobility: {
      value: mobVal,
      max: mobMax,
      ratio: mobRatio,
      level: mobLevel,
      label: mobLabel,
    },
    weight: {
      value: weightVal,
      limit: weightLimit,
      ratio: weightRatio,
      label: weightLabel,
    },
  };
}

export default summarizeLoadout;
