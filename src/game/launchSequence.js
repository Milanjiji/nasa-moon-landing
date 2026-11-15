// ---------------------------------------------------------------------------
// Pure Launch Sequence Logic (No THREE or DOM dependencies)
// ---------------------------------------------------------------------------

export const TIMELINE = {
  countdownStart: -10,
  enginesStart: -6,
  ignition: -3,
  liftoff: 0,
  maxQ: 5,
  separation: 12,
  stage2Burn: 13,
  cutoff: 28,
  orbit: 30,
};

export const MILESTONES = [
  { t: -10, text: 'Countdown started' },
  { t: -6, text: 'Engines start' },
  { t: -3, text: 'Ignition' },
  { t: 0, text: 'Liftoff' },
  { t: 5, text: 'Max Q: peak stress on the rocket' },
  { t: 12, text: 'Stage separation' },
  { t: 28, text: 'Engine cutoff' },
  { t: 30, text: 'Orbit reached' },
];

export function computeFuelMargin(totalWeight, weightLimit) {
  const w = typeof totalWeight === 'number' ? totalWeight : 0;
  const margin = 40 - Math.round(w * 0.5);
  return Math.max(5, Math.min(40, margin));
}

function pad2(n) {
  return Math.floor(Math.abs(n)).toString().padStart(2, '0');
}

export function formatTMinus(seconds) {
  const s = Math.max(0, Math.ceil(Math.abs(seconds)));
  const hrs = pad2(Math.floor(s / 3600));
  const mins = pad2(Math.floor((s % 3600) / 60));
  const secs = pad2(s % 60);
  return `T-minus ${hrs}:${mins}:${secs}`;
}

export function formatMissionTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = pad2(Math.floor(s / 3600));
  const mins = pad2(Math.floor((s % 3600) / 60));
  const secs = pad2(s % 60);
  return `T+ ${hrs}:${mins}:${secs}`;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function smoothstep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

// ---------------------------------------------------------------------------
// Altitude & Speed calculations (smooth and strictly non-decreasing)
// ---------------------------------------------------------------------------
function computeAltitude(t) {
  if (t <= 0) return 0;
  if (t >= 30) return 400;

  if (t <= 12) {
    // Stage 1: 0 to 60 km
    const p = t / 12;
    return 60 * Math.pow(p, 1.75);
  }
  if (t <= 13) {
    // Separation coast: 60 to 67 km
    const p = (t - 12);
    return 60 + 7 * (p * (2 - p));
  }
  if (t <= 28) {
    // Stage 2: 67 to 392 km
    const p = (t - 13) / 15;
    const ease = p * p * (3 - 2 * p);
    return 67 + 325 * (0.3 * p + 0.7 * ease);
  }
  // Coast to orbit: 392 to 400 km
  const p = (t - 28) / 2;
  const ease = 1 - Math.pow(1 - p, 2);
  return 392 + 8 * ease;
}

function computeSpeed(t) {
  if (t <= 0) return 0;
  if (t >= 30) return 28000;

  if (t <= 12) {
    // Stage 1: 0 to 6000 km/h
    const p = t / 12;
    return 6000 * Math.pow(p, 1.6);
  }
  if (t <= 13) {
    // Separation: small speed gain from coast (6000 to 6200 km/h)
    const p = (t - 12);
    return 6000 + 200 * p;
  }
  if (t <= 28) {
    // Stage 2: 6200 to 27600 km/h
    const p = (t - 13) / 15;
    const ease = p * p * (3 - 2 * p);
    return 6200 + 21400 * (0.4 * p + 0.6 * ease);
  }
  // Coast into orbit: 27600 to 28000 km/h
  const p = (t - 28) / 2;
  return 27600 + 400 * (1 - Math.pow(1 - p, 2));
}

// ---------------------------------------------------------------------------
// G-Force calculation (1.0 -> 3.5 -> 0.3 -> 3.0 -> 0.0)
// ---------------------------------------------------------------------------
function computeG(t) {
  if (t < -3) return 1.0;
  if (t <= 0) {
    // Ignition rumble: 1.0 to 1.15
    const p = (t + 3) / 3;
    return 1.0 + 0.15 * p;
  }
  if (t <= 11) {
    // Stage 1 burn: 1.15 to 3.5
    const p = t / 11;
    return 1.15 + 2.35 * Math.pow(p, 1.4);
  }
  if (t <= 12) {
    // Throttling down before stage separation: 3.5 to 1.2
    const p = t - 11;
    return 3.5 - 2.3 * p;
  }
  if (t <= 13) {
    // Stage separation coast: 0.3
    const p = t - 12;
    if (p < 0.2) return 1.2 - 4.5 * p;
    return 0.3;
  }
  if (t <= 27) {
    // Stage 2 burn: 0.3 to 3.0
    const p = (t - 13) / 14;
    return 0.3 + 2.7 * Math.pow(p, 1.2);
  }
  if (t <= 28) {
    // Engine cutoff: 3.0 down to 0.0
    const p = t - 27;
    return Math.max(0, 3.0 * (1 - p));
  }
  // Weightless in orbit
  return 0.0;
}

// ---------------------------------------------------------------------------
// Shake calculation (0 -> 0.12 -> 0.4 -> 1.0 -> 0.5 -> spike 0.8 -> 0.45 -> 0)
// ---------------------------------------------------------------------------
function computeShake(t) {
  if (t < -6) return 0;
  if (t < -3) {
    // -6 to -3: ramp 0.12 to 0.4
    const p = (t + 6) / 3;
    return 0.12 + 0.28 * p;
  }
  if (t <= 0) {
    // -3 to 0: 0.4 to 0.65 at liftoff
    const p = (t + 3) / 3;
    return 0.4 + 0.25 * p;
  }
  if (t <= 5) {
    // Liftoff to max Q peak (1.0)
    const p = t / 5;
    return 0.65 + 0.35 * p;
  }
  if (t <= 11) {
    // Max Q down to 0.5
    const p = (t - 5) / 6;
    return 1.0 - 0.5 * p;
  }
  if (t <= 12) {
    // Throttling down
    const p = t - 11;
    return 0.5 - 0.2 * p;
  }
  if (t <= 13) {
    // Separation shock spike at t = 12.2
    const p = t - 12;
    if (p < 0.2) return 0.3 + 2.5 * p; // rises to 0.8
    if (p < 0.6) return 0.8 - 0.875 * (p - 0.2); // falls to 0.45
    return 0.45;
  }
  if (t <= 28) {
    // Stage 2 burn
    return 0.45;
  }
  // Cutoff
  return 0.0;
}

// ---------------------------------------------------------------------------
// Engine Flame calculation
// ---------------------------------------------------------------------------
function computeFlame(t) {
  if (t < -3) return 0.0;
  if (t < 0) {
    // Ignition: 0.4
    return 0.4;
  }
  if (t <= 12) {
    // Stage 1 burn: 1.0
    return 1.0;
  }
  if (t <= 13) {
    // Separation: drops to 0.5
    const p = t - 12;
    return 1.0 - 0.5 * p;
  }
  if (t <= 28) {
    // Stage 2 burn: 0.7
    return 0.7;
  }
  // Cutoff
  return 0.0;
}

// ---------------------------------------------------------------------------
// getFrame Factory
// ---------------------------------------------------------------------------
export function getFrame(t, mission) {
  let stage = 'prelaunch';
  let stageLabel = 'Countdown';

  if (t >= 30) {
    stage = 'orbit';
    stageLabel = 'Orbit reached';
  } else if (t >= 28) {
    stage = 'coast';
    stageLabel = 'Coasting';
  } else if (t >= 13) {
    stage = 'stage2';
    stageLabel = 'Second stage burn';
  } else if (t >= 12) {
    stage = 'separation';
    stageLabel = 'Stage separation';
  } else if (t >= 0) {
    stage = 'stage1';
    stageLabel = 'First stage burn';
  } else if (t >= -3) {
    stage = 'ignition';
    stageLabel = 'Engine start';
  }

  const altitudeKm = computeAltitude(t);
  const speedKmh = computeSpeed(t);
  const g = computeG(t);
  const shake = clamp(computeShake(t), 0, 1);
  const flame = clamp(computeFlame(t), 0, 1);

  // Scaled mission clock: 0 at liftoff, 510 at t = 30
  let missionTimeSec = 0;
  if (t < 0) {
    missionTimeSec = t;
  } else {
    missionTimeSec = t * 17;
  }

  let thrust = 0;
  if (t >= 13 && t <= 28) thrust = 0.8;
  else if (t >= 0 && t < 12) thrust = 1.0;
  else if (t >= -3 && t < 0) thrust = 0.5;

  const skyFade = clamp(1.0 - altitudeKm / 100, 0, 1);
  const earthRise = smoothstep(0, 1, clamp(altitudeKm / 400, 0, 1));
  const maxQ = t >= 4 && t <= 6;
  const orbit = t >= 30;

  const fuelMargin = (mission && typeof mission.fuelMargin === 'number')
    ? mission.fuelMargin
    : 25;

  return {
    stage,
    stageLabel,
    altitudeKm,
    speedKmh,
    g,
    missionTimeSec,
    shake,
    flame,
    thrust,
    skyFade,
    earthRise,
    maxQ,
    orbit,
    fuelMargin,
  };
}

export default getFrame;
