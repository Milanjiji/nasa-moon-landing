import {
  WEIGHT_LIMIT,
  CATEGORIES,
  CATEGORY_NAMES,
  ITEMS,
  getItem,
  computeTotals,
  computeMaxes,
} from '../data/gear.js';

// ---------------------------------------------------------------------------
// Gear Panel UI Component
// ---------------------------------------------------------------------------

function formatMissing(list) {
  const map = {
    suit: 'a suit',
    helmet: 'a helmet',
    gloves: 'gloves',
    boots: 'boots',
    backpack: 'a life support pack',
  };
  const names = list.map((c) => map[c] || c);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function createGearPanel(containerElement, { onChange, onBoard } = {}) {
  if (!containerElement) throw new Error('Gear panel container element is required');

  const maxes = computeMaxes();
  const selection = { suit: null, helmet: null, gloves: null, boots: null, backpack: null };
  let warningTimeout = null;
  let wasComplete = false;

  containerElement.innerHTML = `
    <div class="gear-panel-inner">
      <div class="gear-summary-sticky">
        <div class="gear-weight-row">
          <span class="gear-weight-label" id="gear-weight-label">Weight 0 / ${WEIGHT_LIMIT}</span>
          <span class="gear-progress-text" id="gear-progress-text">0 of 5 chosen</span>
        </div>
        <div class="gear-bar-track"><div class="gear-bar-fill" id="gear-weight-bar" style="width: 0%;"></div></div>
        <div class="gear-weight-warning hidden" id="gear-weight-warning">Too heavy. Remove something first.</div>

        <div class="gear-stats-row">
          <div class="gear-stat-item">
            <div class="gear-stat-header"><span class="gear-stat-name">Radiation</span><span class="gear-stat-val" id="stat-val-rad">0 / ${maxes.radiation}</span></div>
            <div class="gear-mini-track"><div class="gear-mini-fill stat-rad" id="stat-bar-rad" style="width: 0%;"></div></div>
          </div>
          <div class="gear-stat-item">
            <div class="gear-stat-header"><span class="gear-stat-name">Air supply</span><span class="gear-stat-val" id="stat-val-oxy">0 / ${maxes.oxygen}</span></div>
            <div class="gear-mini-track"><div class="gear-mini-fill stat-oxy" id="stat-bar-oxy" style="width: 0%;"></div></div>
          </div>
          <div class="gear-stat-item">
            <div class="gear-stat-header"><span class="gear-stat-name">Mobility</span><span class="gear-stat-val" id="stat-val-mob">0 / ${maxes.mobility}</span></div>
            <div class="gear-mini-track"><div class="gear-mini-fill stat-mob" id="stat-bar-mob" style="width: 0%;"></div></div>
          </div>
        </div>
      </div>

      <div class="gear-categories-list" id="gear-categories-list"></div>

      <div class="gear-footer"><button class="gear-clear-btn" id="gear-clear-btn" type="button">Clear all</button></div>

      <div class="gear-board-sticky">
        <div class="gear-board-helper" id="gear-board-helper">Choose a suit, a helmet, gloves, boots and a life support pack to continue</div>
        <button class="board-button" id="board-button" type="button" aria-disabled="true">Board the rocket</button>
      </div>
    </div>
  `;

  const weightLabel = containerElement.querySelector('#gear-weight-label');
  const weightBar = containerElement.querySelector('#gear-weight-bar');
  const weightWarning = containerElement.querySelector('#gear-weight-warning');
  const progressText = containerElement.querySelector('#gear-progress-text');
  const valRad = containerElement.querySelector('#stat-val-rad');
  const barRad = containerElement.querySelector('#stat-bar-rad');
  const valOxy = containerElement.querySelector('#stat-val-oxy');
  const barOxy = containerElement.querySelector('#stat-bar-oxy');
  const valMob = containerElement.querySelector('#stat-val-mob');
  const barMob = containerElement.querySelector('#stat-bar-mob');
  const categoriesList = containerElement.querySelector('#gear-categories-list');
  const clearBtn = containerElement.querySelector('#gear-clear-btn');
  const boardHelper = containerElement.querySelector('#gear-board-helper');
  const boardBtn = containerElement.querySelector('#board-button');

  const cardButtons = new Map();

  function getSelection() { return { ...selection }; }
  function getTotals() { return computeTotals(selection); }
  function isComplete() {
    const t = computeTotals(selection);
    return t.count === 5 && t.weight <= WEIGHT_LIMIT;
  }

  function refresh() {
    const totals = computeTotals(selection);

    if (weightLabel) weightLabel.textContent = `Weight ${totals.weight} / ${WEIGHT_LIMIT}`;
    if (weightBar) {
      const pct = Math.min(100, Math.round((totals.weight / WEIGHT_LIMIT) * 100));
      weightBar.style.width = `${pct}%`;
      weightBar.classList.remove('amber', 'red');
      if (totals.weight >= WEIGHT_LIMIT) weightBar.classList.add('red');
      else if (pct >= 85) weightBar.classList.add('amber');
    }

    if (progressText) {
      if (totals.count === 5 && totals.weight <= WEIGHT_LIMIT) {
        progressText.textContent = 'All gear chosen';
        progressText.classList.add('complete');
      } else {
        progressText.textContent = `${totals.count} of 5 chosen`;
        progressText.classList.remove('complete');
      }
    }

    if (valRad && barRad) {
      valRad.textContent = `${totals.radiation} / ${maxes.radiation}`;
      barRad.style.width = `${maxes.radiation > 0 ? Math.min(100, Math.round((totals.radiation / maxes.radiation) * 100)) : 0}%`;
    }
    if (valOxy && barOxy) {
      valOxy.textContent = `${totals.oxygen} / ${maxes.oxygen}`;
      barOxy.style.width = `${maxes.oxygen > 0 ? Math.min(100, Math.round((totals.oxygen / maxes.oxygen) * 100)) : 0}%`;
    }
    if (valMob && barMob) {
      valMob.textContent = `${totals.mobility} / ${maxes.mobility}`;
      barMob.style.width = `${maxes.mobility > 0 ? Math.min(100, Math.round((totals.mobility / maxes.mobility) * 100)) : 0}%`;
    }

    for (const cat of CATEGORIES) {
      const currentSelectedId = selection[cat];
      const prevItem = currentSelectedId ? getItem(cat, currentSelectedId) : null;
      const prevWeight = prevItem ? prevItem.weight : 0;
      const items = ITEMS[cat] || [];

      for (const item of items) {
        const btn = cardButtons.get(item.id);
        if (!btn) continue;

        const isSelected = currentSelectedId === item.id;
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        if (isSelected) btn.classList.add('selected');
        else btn.classList.remove('selected');

        const projectedWeight = totals.weight - prevWeight + item.weight;
        const isDisabled = !isSelected && projectedWeight > WEIGHT_LIMIT;
        btn.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
        if (isDisabled) btn.classList.add('disabled');
        else btn.classList.remove('disabled');
      }
    }

    const complete = isComplete();
    if (boardHelper) {
      const missing = CATEGORIES.filter((c) => !selection[c]);
      if (missing.length === 0) {
        if (totals.weight > WEIGHT_LIMIT) {
          boardHelper.textContent = 'Too heavy. Remove something first.';
          boardHelper.classList.remove('ready');
        } else {
          boardHelper.textContent = 'Ready to board';
          boardHelper.classList.add('ready');
        }
      } else {
        boardHelper.textContent = `Choose ${formatMissing(missing)} to continue`;
        boardHelper.classList.remove('ready');
      }
    }

    if (boardBtn) {
      boardBtn.setAttribute('aria-disabled', complete ? 'false' : 'true');
      if (complete && !wasComplete) {
        boardBtn.classList.add('pulse-attention');
        setTimeout(() => boardBtn.classList.remove('pulse-attention'), 1200);
      }
    }
    wasComplete = complete;
  }

  function notifyChange() {
    refresh();
    if (typeof onChange === 'function') onChange(getSelection(), getTotals());
  }

  function showWarning() {
    if (!weightWarning) return;
    weightWarning.classList.remove('hidden');
    if (warningTimeout) clearTimeout(warningTimeout);
    warningTimeout = setTimeout(() => weightWarning.classList.add('hidden'), 3000);
  }

  function handleCardClick(category, id) {
    const currentId = selection[category];
    if (currentId === id) {
      selection[category] = null;
      notifyChange();
      return;
    }

    const currentTotals = computeTotals(selection);
    const prevItem = currentId ? getItem(category, currentId) : null;
    const prevWeight = prevItem ? prevItem.weight : 0;
    const newItem = getItem(category, id);
    const newWeight = newItem ? newItem.weight : 0;
    const projectedWeight = currentTotals.weight - prevWeight + newWeight;

    if (projectedWeight > WEIGHT_LIMIT) {
      showWarning();
      return;
    }

    selection[category] = id;
    notifyChange();
  }

  function reset() {
    for (const cat of CATEGORIES) selection[cat] = null;
    if (weightWarning) weightWarning.classList.add('hidden');
    notifyChange();
  }

  for (const cat of CATEGORIES) {
    const section = document.createElement('div');
    section.className = 'gear-category-section';

    const heading = document.createElement('h3');
    heading.className = 'gear-category-heading';
    heading.textContent = CATEGORY_NAMES[cat] || cat;
    section.appendChild(heading);

    const cardRow = document.createElement('div');
    cardRow.className = 'gear-card-row';

    const items = ITEMS[cat] || [];
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gear-card';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('data-category', cat);
      btn.setAttribute('data-id', item.id);
      btn.title = item.description;

      const chips = [];
      chips.push(`<span class="gear-chip chip-weight">${item.weight} kg</span>`);
      if (item.radiation > 0) chips.push(`<span class="gear-chip chip-rad">Rad ${item.radiation}</span>`);
      if (item.oxygen > 0) chips.push(`<span class="gear-chip chip-oxy">Air ${item.oxygen}</span>`);
      if (item.mobility > 0) chips.push(`<span class="gear-chip chip-mob">Move ${item.mobility}</span>`);

      btn.innerHTML = `
        <div class="gear-card-top"><span class="gear-card-name">${item.name}</span><span class="gear-check-badge" aria-hidden="true">&#10003;</span></div>
        <div class="gear-card-desc">${item.description}</div>
        <div class="gear-card-chips">${chips.join('')}</div>
      `;

      btn.addEventListener('click', () => handleCardClick(cat, item.id));
      cardButtons.set(item.id, btn);
      cardRow.appendChild(btn);
    }

    section.appendChild(cardRow);
    categoriesList.appendChild(section);
  }

  if (clearBtn) clearBtn.addEventListener('click', () => reset());

  if (boardBtn) {
    boardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isComplete()) return;
      if (typeof onBoard === 'function') onBoard();
    });
  }

  refresh();

  return {
    getSelection,
    getTotals,
    isComplete,
    reset,
    refresh,
  };
}

export default createGearPanel;
