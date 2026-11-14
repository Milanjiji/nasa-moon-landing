// ---------------------------------------------------------------------------
// Gear Data & Specifications
// ---------------------------------------------------------------------------

export const WEIGHT_LIMIT = 60;

export const CATEGORIES = ['suit', 'helmet', 'gloves', 'boots', 'backpack'];

export const CATEGORY_NAMES = {
  suit: 'Suit',
  helmet: 'Helmet',
  gloves: 'Gloves',
  boots: 'Boots',
  backpack: 'Life support pack',
};

export const ITEMS = {
  suit: [
    {
      id: 'suit-light',
      name: 'Light suit',
      weight: 12,
      radiation: 1,
      oxygen: 0,
      mobility: 3,
      description: 'Easy to move in, little protection.',
    },
    {
      id: 'suit-standard',
      name: 'Standard suit',
      weight: 18,
      radiation: 2,
      oxygen: 0,
      mobility: 2,
      description: 'A balanced choice for most missions.',
    },
    {
      id: 'suit-shield',
      name: 'Shield suit',
      weight: 26,
      radiation: 4,
      oxygen: 0,
      mobility: 1,
      description: 'Heavy, with strong radiation protection.',
    },
  ],
  helmet: [
    {
      id: 'helmet-basic',
      name: 'Clear visor',
      weight: 3,
      radiation: 1,
      oxygen: 0,
      mobility: 3,
      description: 'Light, with a wide view.',
    },
    {
      id: 'helmet-sun',
      name: 'Gold sun visor',
      weight: 5,
      radiation: 2,
      oxygen: 0,
      mobility: 2,
      description: 'Reflects harsh sunlight.',
    },
    {
      id: 'helmet-dome',
      name: 'Reinforced dome',
      weight: 8,
      radiation: 3,
      oxygen: 0,
      mobility: 1,
      description: 'Tough shell, narrow view.',
    },
  ],
  gloves: [
    {
      id: 'gloves-flex',
      name: 'Flex gloves',
      weight: 1,
      radiation: 0,
      oxygen: 0,
      mobility: 3,
      description: 'Good grip for small tools.',
    },
    {
      id: 'gloves-insulated',
      name: 'Insulated gloves',
      weight: 2,
      radiation: 1,
      oxygen: 0,
      mobility: 2,
      description: 'Keeps hands warm in the cold.',
    },
    {
      id: 'gloves-armor',
      name: 'Armored gloves',
      weight: 4,
      radiation: 2,
      oxygen: 0,
      mobility: 1,
      description: 'Tough, but stiff.',
    },
  ],
  boots: [
    {
      id: 'boots-light',
      name: 'Light boots',
      weight: 3,
      radiation: 0,
      oxygen: 0,
      mobility: 3,
      description: 'Quick steps on flat ground.',
    },
    {
      id: 'boots-grip',
      name: 'Grip boots',
      weight: 5,
      radiation: 0,
      oxygen: 0,
      mobility: 2,
      description: 'Better hold on slopes.',
    },
    {
      id: 'boots-heavy',
      name: 'Heavy lunar boots',
      weight: 8,
      radiation: 1,
      oxygen: 0,
      mobility: 1,
      description: 'Stable, but tiring.',
    },
  ],
  backpack: [
    {
      id: 'pack-small',
      name: 'Small pack',
      weight: 10,
      radiation: 0,
      oxygen: 2,
      mobility: 0,
      description: 'Short trips outside.',
    },
    {
      id: 'pack-standard',
      name: 'Standard pack',
      weight: 16,
      radiation: 0,
      oxygen: 4,
      mobility: 0,
      description: 'Enough air for a normal day.',
    },
    {
      id: 'pack-large',
      name: 'Large pack',
      weight: 24,
      radiation: 0,
      oxygen: 6,
      mobility: 0,
      description: 'Long outings, very heavy.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getItem(category, id) {
  if (!category || !id) return null;
  const list = ITEMS[category];
  if (!list) return null;
  return list.find((item) => item.id === id) || null;
}

export function computeTotals(selection) {
  let weight = 0;
  let radiation = 0;
  let oxygen = 0;
  let mobility = 0;
  let count = 0;

  if (selection) {
    for (const cat of CATEGORIES) {
      const id = selection[cat];
      if (id) {
        const item = getItem(cat, id);
        if (item) {
          weight += item.weight;
          radiation += item.radiation;
          oxygen += item.oxygen;
          mobility += item.mobility;
          count += 1;
        }
      }
    }
  }

  return {
    weight,
    radiation,
    oxygen,
    mobility,
    count,
  };
}

export function computeMaxes() {
  let radiation = 0;
  let oxygen = 0;
  let mobility = 0;

  for (const cat of CATEGORIES) {
    const list = ITEMS[cat] || [];
    let r = 0;
    let o = 0;
    let m = 0;
    for (const item of list) {
      if (item.radiation > r) r = item.radiation;
      if (item.oxygen > o) o = item.oxygen;
      if (item.mobility > m) m = item.mobility;
    }
    radiation += r;
    oxygen += o;
    mobility += m;
  }

  return {
    radiation,
    oxygen,
    mobility,
  };
}
