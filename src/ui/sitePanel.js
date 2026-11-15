// ---------------------------------------------------------------------------
// Lunar Landing Site Selection Panel
// ---------------------------------------------------------------------------

import { SITES } from '../data/sites.js';
import { ARRIVAL_FACTS } from '../game/flightSequence.js';

export function createSitePanel({ uiRoot, onSelectSite }) {
  const root = uiRoot || (typeof document !== 'undefined' ? document.body : null);

  let dialog = null;
  let selectedSiteId = SITES[0]?.id || 'ridge';

  try {
    if (root && typeof document !== 'undefined') {
      dialog = document.createElement('div');
      dialog.id = 'site-choice-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-label', 'Select lunar landing site');
      dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(94vw,620px);max-height:90vh;overflow-y:auto;background:#07122a;border:1px solid #3fd0ff;border-radius:18px;padding:26px 24px;box-shadow:0 24px 75px rgba(0,0,0,0.85);z-index:60;display:none;opacity:0;transition:opacity 0.4s ease;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#e8f3ff;';

      root.appendChild(dialog);
    }
  } catch (err) {
    console.error('EarthScene part failed: flight site panel dom', err);
  }

  function renderBar(label, pct, color) {
    return `
      <div style="margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:2px;color:#94a3b8;">
          <span>${label}</span>
          <span style="font-weight:600;color:#e2e8f0;">${pct}%</span>
        </div>
        <div style="width:100%;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
        </div>
      </div>
    `;
  }

  function renderContent(onLandClick) {
    if (!dialog) return;

    const fact = ARRIVAL_FACTS[0] || 'Lunar orbit provides an optimal staging vantage for site survey.';

    let cardsHtml = '';
    for (let i = 0; i < SITES.length; i++) {
      const s = SITES[i];
      const isSel = s.id === selectedSiteId;
      const border = isSel ? '2px solid #3fd0ff' : '1px solid #1e3a6a';
      const bg = isSel ? '#0f244a' : '#0a1730';

      cardsHtml += `
        <div class="site-card" data-site-id="${s.id}" style="border:${border};background:${bg};border-radius:12px;padding:14px;cursor:pointer;transition:all 0.2s;position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div>
              <div style="font-size:1.15rem;font-weight:700;color:${isSel ? '#3fd0ff' : '#e8f3ff'};">${s.name}</div>
              <div style="font-size:0.78rem;color:#7e9bb6;">${s.coords} &bull; ${s.type}</div>
            </div>
            <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:700;background:${isSel ? '#3fd0ff' : '#1e293b'};color:${isSel ? '#050d1a' : '#94a3b8'};">
              ${isSel ? 'SELECTED' : 'SELECT'}
            </span>
          </div>
          <p style="font-size:0.85rem;color:#cbd5e1;margin:0 0 10px 0;line-height:1.35;">${s.description}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin-bottom:8px;">
            ${renderBar('Sun / Power', s.sunPercent, '#ffb020')}
            ${renderBar('Slope Safety', s.slopePercent, '#34d399')}
            ${renderBar('Comms Link', s.commsPercent, '#38bdf8')}
            ${renderBar('Science Value', s.sciencePercent, '#c084fc')}
          </div>
          <div style="font-size:0.78rem;font-style:italic;color:#93c5fd;">${s.recommendation}</div>
        </div>
      `;
    }

    dialog.innerHTML = `
      <div style="text-align:center;margin-bottom:18px;">
        <div style="display:inline-block;padding:3px 12px;background:#059669;color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:1px;border-radius:12px;margin-bottom:8px;">
          LUNAR ORBIT ACHIEVED &bull; 100 KM
        </div>
        <h2 style="font-size:1.6rem;font-weight:700;margin:0 0 4px 0;color:#e8f3ff;">Choose Landing Site</h2>
        <p style="font-size:0.9rem;color:#94a3b8;margin:0;">Select target touchdown coordinates for the lunar descent module.</p>
      </div>

      <div id="site-cards-list" style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
        ${cardsHtml}
      </div>

      <button type="button" id="site-land-btn" style="display:block;width:100%;padding:14px 20px;font-family:inherit;font-size:1.1rem;font-weight:700;color:#050d1a;background:#3fd0ff;border:none;border-radius:12px;cursor:pointer;transition:transform 0.15s, background-color 0.15s;margin-bottom:14px;box-shadow:0 6px 20px rgba(63,208,255,0.35);">
        Land here
      </button>

      <div id="site-confirmed-notice" style="display:none;text-align:center;padding:10px;background:#064e3b;border:1px solid #059669;border-radius:8px;color:#a7f3d0;font-size:0.9rem;font-weight:600;margin-bottom:12px;">
        Landing site target confirmed. Descent stage is built in the next step.
      </div>

      <div style="background:#09172e;border-left:3px solid #3fd0ff;padding:8px 12px;border-radius:4px;font-size:0.8rem;color:#94a3b8;line-height:1.35;">
        <span style="font-weight:700;color:#93c5fd;">Lunar Fact:</span> ${fact}
      </div>
    `;

    // Wire card clicks
    const cards = dialog.querySelectorAll('.site-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-site-id');
        if (id && id !== selectedSiteId) {
          selectedSiteId = id;
          renderContent(onLandClick);
        }
      });
    });

    // Wire Land Button
    const landBtn = dialog.querySelector('#site-land-btn');
    if (landBtn) {
      landBtn.addEventListener('mouseenter', () => { landBtn.style.background = '#6ee7b7'; });
      landBtn.addEventListener('mouseleave', () => { landBtn.style.background = '#3fd0ff'; });
      landBtn.addEventListener('click', () => {
        const confirmedNotice = dialog.querySelector('#site-confirmed-notice');
        if (confirmedNotice) confirmedNotice.style.display = 'block';
        landBtn.style.display = 'none';

        const chosenSite = SITES.find((s) => s.id === selectedSiteId) || SITES[0];
        console.log(`Landing site selected: ${chosenSite.name} (${chosenSite.coords})`);

        if (typeof onLandClick === 'function') onLandClick(chosenSite);
        if (typeof onSelectSite === 'function') onSelectSite(chosenSite);
      });
    }
  }

  function show(onLandClick) {
    if (!dialog) return;
    renderContent(onLandClick);
    dialog.style.display = 'block';
    requestAnimationFrame(() => {
      dialog.style.opacity = '1';
      const landBtn = dialog.querySelector('#site-land-btn');
      if (landBtn) landBtn.focus();
    });
  }

  function hide() {
    if (!dialog) return;
    dialog.style.opacity = '0';
    dialog.style.display = 'none';
  }

  function dispose() {
    hide();
    try {
      if (dialog?.parentNode) dialog.parentNode.removeChild(dialog);
    } catch (err) {
      console.error('EarthScene part failed: flight site panel dispose', err);
    }
  }

  return {
    show,
    hide,
    dispose,
    getSelectedSite: () => SITES.find((s) => s.id === selectedSiteId) || SITES[0],
  };
}

export default createSitePanel;
