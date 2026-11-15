// ---------------------------------------------------------------------------
// Storm Decision & Result Dialogs
// ---------------------------------------------------------------------------

import { estimateStormOutcome } from '../game/flightSequence.js';

export function createStormPanel({ uiRoot, onSelectChoice, onContinue }) {
  const root = uiRoot || (typeof document !== 'undefined' ? document.body : null);

  let decisionDialog = null;
  let resultDialog = null;
  let keyHandler = null;

  // 1. Decision Dialog
  try {
    if (root && typeof document !== 'undefined') {
      decisionDialog = document.createElement('div');
      decisionDialog.id = 'storm-decision-dialog';
      decisionDialog.setAttribute('role', 'dialog');
      decisionDialog.setAttribute('aria-label', 'Solar storm protocol decision');
      decisionDialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(92vw,520px);background:#07122a;border:2px solid #ef4444;border-radius:16px;padding:28px 24px;box-shadow:0 24px 70px rgba(0,0,0,0.85);z-index:60;display:none;opacity:0;transition:opacity 0.4s ease;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#e8f3ff;';

      const header = document.createElement('div');
      header.style.cssText = 'margin-bottom:16px;text-align:center;';

      const tag = document.createElement('div');
      tag.textContent = 'CRITICAL ALERT';
      tag.style.cssText = 'display:inline-block;padding:3px 10px;background:#ef4444;color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:1px;border-radius:12px;margin-bottom:8px;';
      header.appendChild(tag);

      const title = document.createElement('h2');
      title.textContent = 'Solar Storm Detected';
      title.style.cssText = 'font-size:1.6rem;font-weight:700;margin:0 0 6px 0;color:#fee2e2;';
      header.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.textContent = 'A coronal mass ejection is sweeping across your flight corridor. Choose your defense protocol:';
      subtitle.style.cssText = 'font-size:0.95rem;color:#94a3b8;margin:0;line-height:1.4;';
      header.appendChild(subtitle);
      decisionDialog.appendChild(header);

      const optionsContainer = document.createElement('div');
      optionsContainer.id = 'storm-options-container';
      optionsContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;margin-bottom:20px;';

      decisionDialog.appendChild(optionsContainer);
      root.appendChild(decisionDialog);
    }
  } catch (err) {
    console.error('EarthScene part failed: flight storm decision dom', err);
  }

  // 2. Result Dialog
  try {
    if (root && typeof document !== 'undefined') {
      resultDialog = document.createElement('div');
      resultDialog.id = 'storm-result-dialog';
      resultDialog.setAttribute('role', 'dialog');
      resultDialog.setAttribute('aria-label', 'Solar storm results');
      resultDialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(90vw,480px);background:#07122a;border:1px solid #3fd0ff;border-radius:16px;padding:30px 26px;box-shadow:0 24px 70px rgba(0,0,0,0.85);z-index:60;display:none;opacity:0;transition:opacity 0.4s ease;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#e8f3ff;';

      const resHeader = document.createElement('div');
      resHeader.style.cssText = 'margin-bottom:16px;text-align:center;';

      const resTag = document.createElement('div');
      resTag.textContent = 'CORONAL FRONT PASSED';
      resTag.style.cssText = 'display:inline-block;padding:3px 10px;background:#0284c7;color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:1px;border-radius:12px;margin-bottom:8px;';
      resHeader.appendChild(resTag);

      const resTitle = document.createElement('h2');
      resTitle.textContent = 'Storm Wave Cleared';
      resTitle.style.cssText = 'font-size:1.6rem;font-weight:700;margin:0 0 6px 0;color:#e8f3ff;';
      resHeader.appendChild(resTitle);

      resultDialog.appendChild(resHeader);

      const resBody = document.createElement('div');
      resBody.id = 'storm-result-body';
      resBody.style.cssText = 'margin-bottom:22px;';
      resultDialog.appendChild(resBody);

      const contBtn = document.createElement('button');
      contBtn.type = 'button';
      contBtn.id = 'storm-continue-btn';
      contBtn.textContent = 'Continue to the Moon';
      contBtn.style.cssText = 'display:inline-block;width:100%;padding:12px 20px;font-family:inherit;font-size:1.05rem;font-weight:600;color:#050d1a;background:#3fd0ff;border:none;border-radius:10px;cursor:pointer;transition:transform 0.15s, background-color 0.15s;';
      contBtn.addEventListener('mouseenter', () => { contBtn.style.background = '#6ee7b7'; });
      contBtn.addEventListener('mouseleave', () => { contBtn.style.background = '#3fd0ff'; });
      contBtn.addEventListener('click', () => {
        if (typeof onContinue === 'function') onContinue();
      });
      resultDialog.appendChild(contBtn);

      root.appendChild(resultDialog);
    }
  } catch (err) {
    console.error('EarthScene part failed: flight storm result dom', err);
  }

  function hideDecision() {
    if (!decisionDialog) return;
    decisionDialog.style.opacity = '0';
    decisionDialog.style.display = 'none';
    if (typeof window !== 'undefined' && keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
  }

  function showDecision(loadoutSummary, onSelect) {
    if (!decisionDialog) return;
    const container = decisionDialog.querySelector('#storm-options-container');
    if (container) {
      container.innerHTML = '';

      const opt1Est = estimateStormOutcome('orient', loadoutSummary);
      const opt2Est = estimateStormOutcome('cabin', loadoutSummary);

      const options = [
        {
          id: 'orient',
          key: '1',
          title: '1. Orient Heat Shield',
          desc: 'Pivot spacecraft so the heavy engine heat shield absorbs the incoming coronal wave.',
          est: opt1Est,
        },
        {
          id: 'cabin',
          key: '2',
          title: '2. Cabin Storm Shelter',
          desc: 'Keep current vector and rely on suit layers and inner cabin wall shielding.',
          est: opt2Est,
        },
      ];

      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const card = document.createElement('button');
        card.type = 'button';
        card.id = `storm-opt-${opt.id}`;
        card.style.cssText = 'display:block;width:100%;text-align:left;background:#0d1d3a;border:1px solid #1e3a6a;border-radius:10px;padding:12px 14px;cursor:pointer;transition:all 0.2s;color:#e8f3ff;';
        card.addEventListener('mouseenter', () => { card.style.borderColor = '#ef4444'; card.style.background = '#13284d'; });
        card.addEventListener('mouseleave', () => { card.style.borderColor = '#1e3a6a'; card.style.background = '#0d1d3a'; });

        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:700;font-size:1.05rem;color:#fca5a5;">${opt.title}</span>
            <span style="font-size:0.75rem;padding:2px 6px;border-radius:4px;background:#1e293b;color:#94a3b8;">Key [${opt.key}]</span>
          </div>
          <p style="margin:0 0 6px 0;font-size:0.85rem;color:#94a3b8;line-height:1.3;">${opt.desc}</p>
          <div style="font-size:0.8rem;font-weight:600;color:#3fd0ff;">${opt.est}</div>
        `;

        card.addEventListener('click', () => {
          hideDecision();
          if (typeof onSelect === 'function') onSelect(opt.id);
          if (typeof onSelectChoice === 'function') onSelectChoice(opt.id);
        });

        container.appendChild(card);
      }
    }

    decisionDialog.style.display = 'block';
    requestAnimationFrame(() => {
      decisionDialog.style.opacity = '1';
      const firstBtn = decisionDialog.querySelector('button');
      if (firstBtn) firstBtn.focus();
    });

    // Keyboard handler for 1 / 2
    if (typeof window !== 'undefined') {
      if (keyHandler) window.removeEventListener('keydown', keyHandler);
      keyHandler = (e) => {
        if (decisionDialog.style.display !== 'none') {
          if (e.key === '1') {
            hideDecision();
            if (typeof onSelect === 'function') onSelect('orient');
            if (typeof onSelectChoice === 'function') onSelectChoice('orient');
          } else if (e.key === '2') {
            hideDecision();
            if (typeof onSelect === 'function') onSelect('cabin');
            if (typeof onSelectChoice === 'function') onSelectChoice('cabin');
          }
        }
      };
      window.addEventListener('keydown', keyHandler);
    }
  }

  function showResult(outcome) {
    if (!resultDialog) return;
    const body = resultDialog.querySelector('#storm-result-body');
    if (body && outcome) {
      const doseColor = outcome.level === 'low' ? '#34d399' : (outcome.level === 'moderate' ? '#ffb020' : '#ef4444');
      const healthText = outcome.healthPenalty > 0 ? `-${outcome.healthPenalty}%` : 'None (100% vital)';

      body.innerHTML = `
        <div style="display:flex;justify-content:space-around;background:#0d1d3a;padding:12px;border-radius:10px;margin-bottom:14px;border:1px solid #1e3a6a;">
          <div style="text-align:center;">
            <div style="font-size:0.75rem;color:#7e9bb6;text-transform:uppercase;letter-spacing:0.5px;">Radiation Dose</div>
            <div style="font-size:1.4rem;font-weight:700;color:${doseColor};">${outcome.dose} mSv</div>
          </div>
          <div style="width:1px;background:#1e3a6a;"></div>
          <div style="text-align:center;">
            <div style="font-size:0.75rem;color:#7e9bb6;text-transform:uppercase;letter-spacing:0.5px;">Health Impact</div>
            <div style="font-size:1.4rem;font-weight:700;color:${outcome.healthPenalty > 0 ? '#ef4444' : '#34d399'};">${healthText}</div>
          </div>
        </div>
        <p style="font-size:0.9rem;line-height:1.4;color:#cbd5e1;margin:0 0 12px 0;">${outcome.message}</p>
        <div style="background:#09172e;border-left:3px solid #3fd0ff;padding:8px 12px;border-radius:4px;font-size:0.8rem;color:#94a3b8;line-height:1.35;">
          <span style="font-weight:700;color:#93c5fd;">Mission Archive:</span> ${outcome.fact}
        </div>
      `;
    }

    resultDialog.style.display = 'block';
    requestAnimationFrame(() => {
      resultDialog.style.opacity = '1';
      const btn = resultDialog.querySelector('#storm-continue-btn');
      if (btn) btn.focus();
    });
  }

  function hideResult() {
    if (!resultDialog) return;
    resultDialog.style.opacity = '0';
    resultDialog.style.display = 'none';
  }

  function hideAll() {
    hideDecision();
    hideResult();
  }

  function dispose() {
    hideAll();
    try {
      if (decisionDialog?.parentNode) decisionDialog.parentNode.removeChild(decisionDialog);
      if (resultDialog?.parentNode) resultDialog.parentNode.removeChild(resultDialog);
    } catch (err) {
      console.error('EarthScene part failed: flight storm panel dispose', err);
    }
  }

  return {
    showDecision,
    hideDecision,
    showResult,
    hideResult,
    hideAll,
    dispose,
  };
}

export default createStormPanel;
