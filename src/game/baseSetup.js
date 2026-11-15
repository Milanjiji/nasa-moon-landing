// ---------------------------------------------------------------------------
// Moon Base Logic: Module Options, Meter Calculations & Previews (Pure Logic)
// ---------------------------------------------------------------------------

import { formatHours } from './surfaceStats.js';

export { formatHours };

export const SETUP_FATIGUE_HOURS = 15;

export const MODULE_ORDER = ['solar', 'habitat', 'air', 'shield'];

export const MODULE_INFO = {
  solar: {
    title: 'Power',
    prompt: 'How big should the solar array be?',
  },
  habitat: {
    title: 'Habitat',
    prompt: 'How roomy should the habitat be?',
  },
  air: {
    title: 'Air and water',
    prompt: 'How should the air and water unit run?',
  },
  shield: {
    title: 'Radiation shield',
    prompt: 'How much moon soil goes over the habitat?',
  },
};

export const BASE_FACTS = [
  'Moon soil, called regolith, can block some radiation. Real plans pile it over habitats.',
  'A night on the Moon lasts about two weeks, so solar power needs batteries or a second source.',
  'Water ice in shadowed craters can be split into hydrogen and oxygen, for air and fuel.',
];

export function getModuleOptions(moduleId, siteId = 'ridge') {
  if (moduleId === 'solar') {
    return [
      {
        id: 'large',
        name: 'Large array',
        description: 'Eight panels. Makes the most power, but takes 5 hours to set up.',
        hours: 5,
      },
      {
        id: 'small',
        name: 'Small array',
        description: 'Four panels. Quick to set up (2 hours), makes less power.',
        hours: 2,
      },
    ];
  }

  if (moduleId === 'habitat') {
    return [
      {
        id: 'roomy',
        name: 'Roomy habitat',
        description: 'More space for food and supplies. Takes 4 hours to inflate and fit out.',
        hours: 4,
      },
      {
        id: 'compact',
        name: 'Compact habitat',
        description: 'Quick to set up (2 hours), with less room for food.',
        hours: 2,
      },
    ];
  }

  if (moduleId === 'air') {
    if (siteId === 'crater') {
      return [
        {
          id: 'full',
          name: 'Ice drill',
          description: 'Melts nearby ice into water and air. Gives the most air, uses more power. 4 hours.',
          hours: 4,
        },
        {
          id: 'light',
          name: 'Small recycler',
          description: 'Reuses the air you have. Uses little power, gives less air. 2 hours.',
          hours: 2,
        },
      ];
    }
    return [
      {
        id: 'full',
        name: 'Full recycler',
        description: 'Cleans and reuses air and water. The best choice without ice. 4 hours.',
        hours: 4,
      },
      {
        id: 'light',
        name: 'Basic recycler',
        description: 'Quick to set up (2 hours), but supports less air.',
        hours: 2,
      },
    ];
  }

  if (moduleId === 'shield') {
    return [
      {
        id: 'thick',
        name: 'Thick soil pile',
        description: 'Pile moon soil bags high over the habitat. Best protection, takes 6 hours.',
        hours: 6,
      },
      {
        id: 'thin',
        name: 'Thin soil layer',
        description: 'One layer of bags. Some protection in 3 hours.',
        hours: 3,
      },
    ];
  }

  return [];
}

export function computeBase(choices = {}, stats = {}, siteId = 'ridge') {
  const safeChoices = choices || {};
  const safeStats = stats || {};

  const rawPower = Number.isFinite(safeStats.powerPct) ? safeStats.powerPct : 0;
  const rawOxy = Number.isFinite(safeStats.oxygenRatio) ? safeStats.oxygenRatio : 0;
  const rawRad = Number.isFinite(safeStats.radiationRatio) ? safeStats.radiationRatio : 0;
  const rawHealth = Number.isFinite(safeStats.health) ? safeStats.health : 0;

  const powerPct = Math.max(0, Math.min(100, rawPower));
  const oxygenRatio = Math.max(0, Math.min(1, rawOxy));
  const radiationRatio = Math.max(0, Math.min(1, rawRad));
  const healthIn = Math.max(0, Math.min(100, rawHealth));

  const airBase = Math.round(oxygenRatio * 40);
  const radBase = Math.round(radiationRatio * 50);

  let setupHours = 0;

  // 1. Solar
  const solarOpt = safeChoices.solar;
  let solarMult = 0;
  if (solarOpt === 'large') {
    solarMult = 1.0;
    setupHours += 5;
  } else if (solarOpt === 'small') {
    solarMult = 0.6;
    setupHours += 2;
  }

  // 2. Habitat
  const habOpt = safeChoices.habitat;
  let food = 0;
  if (habOpt === 'roomy') {
    food = 70;
    setupHours += 4;
  } else if (habOpt === 'compact') {
    food = 45;
    setupHours += 2;
  }

  // 3. Air
  const airOpt = safeChoices.air;
  let airGain = 0;
  let airDraw = 0;
  const isCrater = siteId === 'crater';
  if (airOpt === 'full') {
    airGain = isCrater ? 45 : 35;
    airDraw = isCrater ? 8 : 6;
    setupHours += 4;
  } else if (airOpt === 'light') {
    airGain = isCrater ? 25 : 20;
    airDraw = isCrater ? 3 : 2;
    setupHours += 2;
  }

  // 4. Shield
  const shieldOpt = safeChoices.shield;
  let shieldGain = 0;
  if (shieldOpt === 'thick') {
    shieldGain = 45;
    setupHours += 6;
  } else if (shieldOpt === 'thin') {
    shieldGain = 20;
    setupHours += 3;
  }

  // Calculations
  const power = !solarOpt
    ? 0
    : Math.max(5, Math.min(100, Math.round(powerPct * solarMult) - airDraw));

  const air = Math.max(0, Math.min(100, airBase + airGain));
  const radiation = Math.max(0, Math.min(100, radBase + shieldGain));

  const fatiguePenalty = setupHours > SETUP_FATIGUE_HOURS ? 5 : 0;
  const health = Math.max(0, Math.min(100, Math.round(healthIn) - fatiguePenalty));

  return {
    power,
    air,
    food,
    radiation,
    health,
    setupHours,
    fatiguePenalty,
  };
}

export function previewOption(moduleId, optionId, choicesSoFar = {}, stats = {}, siteId = 'ridge') {
  const options = getModuleOptions(moduleId, siteId);
  const chosenOpt = options.find((o) => o.id === optionId);
  if (!chosenOpt) {
    const unchanged = computeBase(choicesSoFar, stats, siteId);
    return {
      meters: unchanged,
      delta: { power: 0, air: 0, food: 0, radiation: 0, health: 0 },
      hours: 0,
    };
  }

  const withOption = computeBase({ ...choicesSoFar, [moduleId]: optionId }, stats, siteId);
  const withoutOption = computeBase({ ...choicesSoFar, [moduleId]: null }, stats, siteId);

  const delta = {
    power: withOption.power - withoutOption.power,
    air: withOption.air - withoutOption.air,
    food: withOption.food - withoutOption.food,
    radiation: withOption.radiation - withoutOption.radiation,
    health: withOption.health - withoutOption.health,
  };

  return {
    meters: withOption,
    delta,
    hours: chosenOpt.hours,
  };
}

export function meterLevel(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'bad';
  if (value >= 60) return 'good';
  if (value >= 35) return 'warn';
  return 'bad';
}

export function meterColor(level) {
  if (level === 'good') return '#34d399';
  if (level === 'warn') return '#ffb020';
  return '#ef4444';
}

export default {
  SETUP_FATIGUE_HOURS,
  MODULE_ORDER,
  MODULE_INFO,
  BASE_FACTS,
  getModuleOptions,
  computeBase,
  previewOption,
  meterLevel,
  meterColor,
  formatHours,
};
