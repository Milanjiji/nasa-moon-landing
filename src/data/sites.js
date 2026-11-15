// ---------------------------------------------------------------------------
// Lunar Landing Sites Data
// ---------------------------------------------------------------------------

export const SITES = [
  {
    id: 'ridge',
    name: 'Sunny ridge',
    type: 'Equatorial Highland Ridge',
    coords: '0.7° N, 23.4° E',
    terrain: 2,
    visual: {
      groundColor: '#b9bcc4',
      sunStrength: 1.0,
      skyTint: '#000000',
      featureHint: 'ridge',
    },
    sunPercent: 85,
    sunLabel: '85% (Continuous solar illumination)',
    slopePercent: 90,
    slopeLabel: 'Gentle (3° slope - very safe)',
    commsPercent: 95,
    commsLabel: 'Direct line-of-sight to Earth',
    sciencePercent: 60,
    scienceLabel: 'Geological baseline, regolith analysis',
    description: 'A level highland ridge with near-continuous sunlight and clear radio contact with mission control. Excellent safety margins for an initial base camp.',
    recommendation: 'Recommended for reliable power and straightforward descent.',
  },
  {
    id: 'crater',
    name: 'Dark crater',
    type: 'South Pole Permanently Shadowed Region',
    coords: '84.2° S, 12.1° W',
    terrain: 4,
    visual: {
      groundColor: '#6d7482',
      sunStrength: 0.35,
      skyTint: '#04070f',
      featureHint: 'crater',
    },
    sunPercent: 20,
    sunLabel: '20% (Shadowed rim, dark floor)',
    slopePercent: 35,
    slopeLabel: 'Challenging (14° crater rim)',
    commsPercent: 40,
    commsLabel: 'Periodic relay through orbital probe',
    sciencePercent: 95,
    scienceLabel: 'Volatiles, trapped water ice deposits',
    description: 'An ancient crater floor shielded from solar radiation for billions of years. Contains proven concentrations of water ice vital for sustained exploration.',
    recommendation: 'High scientific value with demanding landing conditions.',
  },
];

export function getSite(id) {
  return SITES.find((s) => s.id === id) || null;
}

export default SITES;
