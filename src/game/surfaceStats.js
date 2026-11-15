import { summarizeLoadout } from './loadoutSummary.js';
import { getItem } from '../data/gear.js';

export const WALK_RADIUS = 40;
export const FOOTPRINT_SPACING = 0.9;
export const OXYGEN_BAR_MAX = 59;

export function formatHours(h) {
  if (typeof h !== 'number' || !isFinite(h) || h < 0) return '0 h';
  return Math.round(h) + ' h';
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function getSurfaceStart(mission = {}, loadout = {}, site = {}) {
  const m = mission || {};
  const s = site || {};
  const l = loadout || {};

  // Extract totals safely
  const totals = l.totals ? l.totals : (typeof l.oxygen === 'number' ? l : {});

  // Extract helmet
  let helmetId = l.selection?.helmet || l.helmet || null;
  if (!helmetId && totals.helmet) {
    helmetId = totals.helmet;
  }

  // Health: 100 - healthPenalty, clamped 0 to 100
  const penalty = typeof m.healthPenalty === 'number' && isFinite(m.healthPenalty) ? m.healthPenalty : 0;
  const health = clamp(Math.round(100 - penalty), 0, 100);

  // Oxygen hours: 8 + totals.oxygen * 6 + site.ice * 3
  const oCount = typeof totals.oxygen === 'number' && isFinite(totals.oxygen) ? totals.oxygen : 0;
  const sIce = typeof s.ice === 'number' && isFinite(s.ice) ? s.ice : 0;
  const oxygenHours = Math.round(8 + oCount * 6 + sIce * 3);
  const oxygenRatio = clamp(oxygenHours / OXYGEN_BAR_MAX, 0, 1);

  // Power percentage: sunlight * 20 - damagePenalty, clamped 5 to 100
  const sSun = typeof s.sunlight === 'number' && isFinite(s.sunlight) ? s.sunlight : 0;
  const damagePenalty = m.damage === 'major' ? 25 : (m.damage === 'minor' ? 10 : 0);
  const powerPct = clamp(Math.round(sSun * 20 - damagePenalty), 5, 100);

  // Summary ratings for radiation and mobility
  const summary = summarizeLoadout(totals);
  const radiationRatio = summary.radiation.ratio || 0;
  const radiationValue = summary.radiation.value || 0;
  const radiationMax = summary.radiation.max || 100;
  const mobilityRatio = clamp(summary.mobility.ratio || 0, 0, 1);

  // Walk speed: 0.9 + 1.1 * mobilityRatio (0.9 to 2.0)
  const walkSpeed = Number((0.9 + 1.1 * mobilityRatio).toFixed(2));

  // FOV and visor attributes by helmet
  let fov = 72;
  let visorTint = null;
  let heavyFrame = false;

  if (helmetId === 'helmet-sun') {
    fov = 66;
    visorTint = 'rgba(216,169,58,0.28)';
  } else if (helmetId === 'helmet-dome') {
    fov = 58;
    heavyFrame = true;
  } else if (helmetId === 'helmet-basic') {
    fov = 72;
  } else {
    fov = 72;
  }

  return {
    health,
    oxygenHours,
    oxygenRatio,
    powerPct,
    radiationRatio,
    radiationValue,
    radiationMax,
    mobilityRatio,
    walkSpeed,
    helmetId,
    fov,
    visorTint,
    heavyFrame,
  };
}

export function lookAtEarthAmount(yawDeg, pitchDeg, earthYawDeg, earthPitchDeg) {
  const y1 = typeof yawDeg === 'number' && isFinite(yawDeg) ? yawDeg : 0;
  const p1 = typeof pitchDeg === 'number' && isFinite(pitchDeg) ? pitchDeg : 0;
  const y2 = typeof earthYawDeg === 'number' && isFinite(earthYawDeg) ? earthYawDeg : 0;
  const p2 = typeof earthPitchDeg === 'number' && isFinite(earthPitchDeg) ? earthPitchDeg : 0;

  const toRad = Math.PI / 180;
  const rY1 = y1 * toRad;
  const rP1 = p1 * toRad;
  const rY2 = y2 * toRad;
  const rP2 = p2 * toRad;

  // View vector in camera space (-Z forward, +X right, +Y up)
  const vx = Math.sin(rY1) * Math.cos(rP1);
  const vy = Math.sin(rP1);
  const vz = -Math.cos(rY1) * Math.cos(rP1);

  // Earth vector in same coordinate frame
  const ex = Math.sin(rY2) * Math.cos(rP2);
  const ey = Math.sin(rP2);
  const ez = -Math.cos(rY2) * Math.cos(rP2);

  const dot = clamp(vx * ex + vy * ey + vz * ez, -1, 1);
  const angleRad = Math.acos(dot);
  return Number((angleRad * (180 / Math.PI)).toFixed(2));
}

export default {
  WALK_RADIUS,
  FOOTPRINT_SPACING,
  OXYGEN_BAR_MAX,
  formatHours,
  getSurfaceStart,
  lookAtEarthAmount,
};
