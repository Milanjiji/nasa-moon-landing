// ---------------------------------------------------------------------------
// Outside Camera Views for Cockpit Orbit & Lunar Flight
// ---------------------------------------------------------------------------

export const ORBIT_VIEW = {
  earthScale: 1.0,
  earthOffsetY: 0,
  earthYawDeg: 0,
  earthPitchDeg: 0,
  moonDistance: 3600,
  moonScale: 1.0,
  moonYawDeg: 0,
  moonPitchDeg: 0,
};

export const ARRIVAL_VIEW = {
  earthScale: 0.11,
  earthOffsetY: 0,
  earthYawDeg: -14,
  earthPitchDeg: 71,
  moonDistance: 445,
  moonScale: 1.0,
  moonYawDeg: 15,
  moonPitchDeg: -6,
};

export const LUNAR_ORBIT_VIEW = {
  earthScale: 0.048,
  earthOffsetY: 0,
  earthYawDeg: -14,
  earthPitchDeg: 82,
  moonDistance: 2550,
  moonScale: 12.72,
  moonYawDeg: -16,
  moonPitchDeg: -69,
};

export const LANDING_SKY_VIEW = {
  earthScale: 0.052,
  earthOffsetY: 0,
  earthYawDeg: 12,
  earthPitchDeg: 80,
  moonDistance: 3600,
  moonScale: 0.001,
  moonYawDeg: 0,
  moonPitchDeg: -80,
};

export function copyView(v) {
  return { ...v };
}

export default {
  ORBIT_VIEW,
  ARRIVAL_VIEW,
  LUNAR_ORBIT_VIEW,
  LANDING_SKY_VIEW,
  copyView,
};
