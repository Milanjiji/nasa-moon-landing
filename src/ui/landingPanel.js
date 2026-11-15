// ---------------------------------------------------------------------------
// Landing Hazard Decision & Touchdown Card Panels
// ---------------------------------------------------------------------------

import { canDivert, LANDING_FACTS } from '../game/landingSequence.js';

export function createLandingPanel({ uiRoot }) {
  const root = uiRoot || (typeof document !== 'undefined' ? document.body : null);

  let decisionDialog = null;
  let touchdownDialog = null;
  let keyHandler = null;
  let isPanelOpen = false;

  // 1. Decision Dialog DOM
  try {
    if (root && typeof document !== 'undefined') {
      decisionDialog = document.createElement('div');
      decisionDialog.id = 'landing-decision-dialog';
      decisionDialog.setAttribute('role', 'dialog');
      decisionDialog.setAttribute('aria-modal', 'false');
      decisionDialog.setAttribute('aria-label', 'Landing hazard');
      decisionDialog.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);width:min(94vw,560px);background:#07122a;border:2px solid #ef4444;border-radius:16px;padding:24px 22px;box-shadow:0 24px 70px rgba(0,0,0,0.85);z-index:60;display:none;opacity:0;transition:opacity 0.4s ease;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#e8f3ff;';

      root.appendChild(decisionDialog);
    }
  } catch (err) {
    console.error('EarthScene part failed: landing decision dom', err);
  }

  // 2. Touchdown Dialog DOM
  try {
    if (root && typeof document !== 'undefined') {
      touchdownDialog = document.createElement('div');
      touchdownDialog.id = 'landing-touchdown-dialog';
      touchdownDialog.setAttribute('role', 'dialog');
      touchdownDialog.setAttribute('aria-label', 'Touchdown');
      touchdownDialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(92vw,500px);background:#07122a;border:2px solid #3fd0ff;border-radius:18px;padding:32px 28px;box-shadow:0 24px 75px rgba(0,0,0,0.85);z-index:60;display:none;opacity:0;transition:opacity 0.5s ease;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#e8f3ff;text-align:center;';

      root.appendChild(touchdownDialog);
    }
  } catch (err) {
    console.error('EarthScene part failed: landing touchdown dom', err);
  }

  function getLevelColor(level) {
    if (level === 'soft') return '#34d399';
    if (level === 'rough') return '#ffb020';
    return '#ef4444';
  }

  function closeDecision() {
    isPanelOpen = false;
    if (decisionDialog) {
      decisionDialog.style.opacity = '0';
      decisionDialog.style.display = 'none';
    }
    if (typeof window !== 'undefined' && keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
  }

  function openDecision({ estimates, fuelMargin, onChoose, terrain = 3 }) {
    if (!decisionDialog) return;
    isPanelOpen = true;

    const fuel = typeof fuelMargin === 'number' ? fuelMargin : 0;
    const divertAllowed = canDivert(fuel);

    const estCont = estimates?.continue || { risk: 32, level: 'hard', levelLabel: 'Hard landing' };
    const estDiv = estimates?.divert || { risk: 11, level: 'rough', levelLabel: 'Rough landing', fuelAfter: Math.max(0, fuel - 5) };

    decisionDialog.innerHTML = `
      <div style="margin-bottom:14px;text-align:center;">
        <h2 style="font-size:1.5rem;font-weight:700;margin:0 0 6px 0;color:#fee2e2;">Boulders near the target</h2>
        <p style="font-size:0.9rem;color:#94a3b8;margin:0;line-height:1.35;">The landing camera shows boulders around the planned spot. What do you do?</p>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
        <button type="button" id="hazard-choice-continue" style="display:block;width:100%;text-align:left;background:#0d1d3a;border:1px solid #1e3a6a;border-radius:10px;padding:12px 14px;cursor:pointer;transition:all 0.2s;color:#e8f3ff;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:700;font-size:1.05rem;color:#e8f3ff;">1. Continue to the target</span>
            <span style="font-size:0.75rem;padding:2px 8px;border-radius:10px;background:${getLevelColor(estCont.level)};color:#050d1a;font-weight:700;">Expected: ${estCont.levelLabel}</span>
          </div>
          <p style="margin:0 0 4px 0;font-size:0.85rem;color:#94a3b8;">Land at the planned spot. Boulders ahead make this risky.</p>
          <div style="font-size:0.8rem;color:#7e9bb6;">Risk ${estCont.risk}</div>
        </button>

        <button type="button" id="hazard-choice-divert" style="display:block;width:100%;text-align:left;background:${divertAllowed ? '#0d1d3a' : '#081224'};border:1px solid ${divertAllowed ? '#1e3a6a' : '#17253d'};border-radius:10px;padding:12px 14px;cursor:${divertAllowed ? 'pointer' : 'not-allowed'};opacity:${divertAllowed ? '1' : '0.6'};transition:all 0.2s;color:#e8f3ff;" ${divertAllowed ? '' : 'aria-disabled="true"'}>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:700;font-size:1.05rem;color:${divertAllowed ? '#e8f3ff' : '#64748b'};">2. Divert to flat ground</span>
            <span style="font-size:0.75rem;padding:2px 8px;border-radius:10px;background:${divertAllowed ? getLevelColor(estDiv.level) : '#1e293b'};color:${divertAllowed ? '#050d1a' : '#94a3b8'};font-weight:700;">Expected: ${estDiv.levelLabel}</span>
          </div>
          <p style="margin:0 0 4px 0;font-size:0.85rem;color:#94a3b8;">Fly sideways to a flat patch. Costs 5 points of fuel margin.</p>
          <div style="font-size:0.8rem;color:#7e9bb6;">${divertAllowed ? `Fuel margin ${fuel} to ${estDiv.fuelAfter}` : 'Not enough fuel margin to divert'}</div>
        </button>
      </div>

      <div style="font-size:0.8rem;color:#7e9bb6;text-align:center;">
        Terrain risk at this site: ${terrain} of 5. A bigger fuel margin and better mobility help.
      </div>
    `;

    const btnCont = decisionDialog.querySelector('#hazard-choice-continue');
    const btnDiv = decisionDialog.querySelector('#hazard-choice-divert');

    function makeChoice(c) {
      closeDecision();
      if (typeof onChoose === 'function') onChoose(c);
    }

    if (btnCont) {
      btnCont.addEventListener('click', () => makeChoice('continue'));
      btnCont.addEventListener('mouseenter', () => { btnCont.style.borderColor = '#3fd0ff'; });
      btnCont.addEventListener('mouseleave', () => { btnCont.style.borderColor = '#1e3a6a'; });
    }

    if (btnDiv && divertAllowed) {
      btnDiv.addEventListener('click', () => makeChoice('divert'));
      btnDiv.addEventListener('mouseenter', () => { btnDiv.style.borderColor = '#3fd0ff'; });
      btnDiv.addEventListener('mouseleave', () => { btnDiv.style.borderColor = '#1e3a6a'; });
    }

    decisionDialog.style.display = 'block';
    requestAnimationFrame(() => {
      decisionDialog.style.opacity = '1';
      if (btnDiv && divertAllowed) btnDiv.focus();
      else if (btnCont) btnCont.focus();
    });

    if (typeof window !== 'undefined') {
      if (keyHandler) window.removeEventListener('keydown', keyHandler);
      keyHandler = (e) => {
        if (!isPanelOpen) return;
        if (e.key === '1') makeChoice('continue');
        else if (e.key === '2' && divertAllowed) makeChoice('divert');
      };
      window.addEventListener('keydown', keyHandler);
    }
  }

  function openTouchdown({ outcome, mission = {}, site = {}, onContinue }) {
    if (!touchdownDialog) return;
    isPanelOpen = true;

    const level = outcome?.level || 'soft';
    const levelLabel = outcome?.levelLabel || 'Soft landing';
    const col = getLevelColor(level);

    let desc = 'A clean landing. The ship is in good shape.';
    let fact = LANDING_FACTS[0] || '';
    if (level === 'rough') {
      desc = 'A bumpy landing. One module may work at reduced power.';
      fact = LANDING_FACTS[1] || '';
    } else if (level === 'hard') {
      desc = 'A hard landing. Some systems are damaged and the crew has bruises.';
      fact = LANDING_FACTS[2] || '';
    }

    const health = Math.max(0, 100 - (mission.healthPenalty || 0));
    const fuel = outcome?.fuelAfter ?? (mission.fuelMargin ?? 20);

    touchdownDialog.innerHTML = `
      <div style="display:inline-block;padding:3px 12px;background:#059669;color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:1px;border-radius:12px;margin-bottom:12px;">
        MISSION ARRIVAL
      </div>
      <h2 style="font-size:1.9rem;font-weight:700;margin:0 0 4px 0;color:#e8f3ff;">Touchdown</h2>
      <div style="font-size:1.4rem;font-weight:700;color:${col};margin-bottom:16px;">${levelLabel}</div>

      <div style="background:#0d1d3a;border:1px solid #1e3a6a;border-radius:12px;padding:14px;margin-bottom:16px;text-align:left;display:flex;flex-direction:column;gap:6px;font-size:0.95rem;">
        <div><span style="color:#7e9bb6;">Landing site:</span> <span style="font-weight:600;color:#e8f3ff;">${site.name || 'Sunny ridge'}</span></div>
        <div><span style="color:#7e9bb6;">Fuel margin:</span> <span style="font-weight:600;color:#3fd0ff;">${fuel}%</span></div>
        <div><span style="color:#7e9bb6;">Crew health:</span> <span style="font-weight:600;color:${health > 80 ? '#34d399' : '#ffb020'};">${health}%</span></div>
      </div>

      <p style="font-size:0.92rem;color:#cbd5e1;line-height:1.4;margin:0 0 14px 0;">${desc}</p>

      <div style="background:#09172e;border-left:3px solid #3fd0ff;padding:8px 12px;border-radius:4px;font-size:0.8rem;color:#94a3b8;line-height:1.35;text-align:left;margin-bottom:20px;">
        <span style="font-weight:700;color:#93c5fd;">Lunar Fact:</span> ${fact}
      </div>

      <button type="button" id="touchdown-continue-btn" style="display:block;width:100%;padding:14px 20px;font-family:inherit;font-size:1.1rem;font-weight:700;color:#050d1a;background:#3fd0ff;border:none;border-radius:12px;cursor:pointer;transition:transform 0.15s, background-color 0.15s;">
        Step out onto the Moon
      </button>

      <div id="touchdown-next-note" style="display:none;margin-top:12px;font-size:0.85rem;color:#7e9bb6;">
        The Moon base is built in the next step.
      </div>
    `;

    const btn = touchdownDialog.querySelector('#touchdown-continue-btn');
    const note = touchdownDialog.querySelector('#touchdown-next-note');

    if (btn) {
      btn.addEventListener('mouseenter', () => { btn.style.background = '#6ee7b7'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = '#3fd0ff'; });
      btn.addEventListener('click', () => {
        if (typeof onContinue === 'function') {
          onContinue();
        } else if (note) {
          note.style.display = 'block';
        }
      });
    }

    touchdownDialog.style.display = 'block';
    requestAnimationFrame(() => {
      touchdownDialog.style.opacity = '1';
      if (btn) btn.focus();
    });
  }

  function closeTouchdown() {
    isPanelOpen = false;
    if (touchdownDialog) {
      touchdownDialog.style.opacity = '0';
      touchdownDialog.style.display = 'none';
    }
  }

  function close() {
    closeDecision();
    closeTouchdown();
  }

  function dispose() {
    close();
    try {
      if (decisionDialog?.parentNode) decisionDialog.parentNode.removeChild(decisionDialog);
      if (touchdownDialog?.parentNode) touchdownDialog.parentNode.removeChild(touchdownDialog);
    } catch (err) {
      console.error('EarthScene part failed: landing panel dispose', err);
    }
  }

  return {
    openDecision,
    openTouchdown,
    close,
    dispose,
    isOpen: () => isPanelOpen,
  };
}

export default createLandingPanel;
