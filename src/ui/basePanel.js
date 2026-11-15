// ---------------------------------------------------------------------------
// Base Choice Panel & Ready Card
// ---------------------------------------------------------------------------

import {
  SETUP_FATIGUE_HOURS,
  MODULE_INFO,
  BASE_FACTS,
  getModuleOptions,
  meterLevel,
  meterColor
} from '../game/baseSetup.js';

export function createBasePanel({ uiRoot }) {
  const root = uiRoot || (typeof document !== 'undefined' ? document.body : null);

  let choiceElem = null;
  let readyElem = null;
  let choiceKeyHandler = null;
  let animTimer = null;

  function prefersReducedMotion() {
    try {
      return typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_e) {
      return false;
    }
  }

  function close() {
    if (choiceKeyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', choiceKeyHandler);
      choiceKeyHandler = null;
    }
    if (animTimer) {
      clearInterval(animTimer);
      animTimer = null;
    }
    if (choiceElem && choiceElem.parentNode) {
      choiceElem.parentNode.removeChild(choiceElem);
      choiceElem = null;
    }
    if (readyElem && readyElem.parentNode) {
      readyElem.parentNode.removeChild(readyElem);
      readyElem = null;
    }
  }

  function isOpen() {
    return (choiceElem !== null && choiceElem.parentNode !== null) ||
           (readyElem !== null && readyElem.parentNode !== null);
  }

  function openChoice({ moduleId, index, total, options, previews, meters, choicesSoFar, siteId, onChoose }) {
    try {
      close();
      if (!root || typeof document === 'undefined') return;

      const modInfo = MODULE_INFO[moduleId] || { title: moduleId, prompt: 'Configure module' };
      const currentHours = choicesSoFar ?
        Object.entries(choicesSoFar).reduce((sum, [mId, optId]) => {
          if (!optId) return sum;
          const opts = getModuleOptions(mId, siteId);
          const found = opts.find((o) => o.id === optId);
          return sum + (found ? found.hours : 0);
        }, 0) : 0;

      choiceElem = document.createElement('div');
      choiceElem.id = 'base-choice-panel';
      choiceElem.setAttribute('role', 'dialog');
      choiceElem.setAttribute('aria-modal', 'false');
      choiceElem.setAttribute('aria-label', `${modInfo.title} choice`);

      choiceElem.style.cssText = [
        'position:fixed',
        'bottom:24px',
        'left:50%',
        'transform:translateX(-50%)',
        'width:min(92vw, 760px)',
        'background:rgba(7, 18, 42, 0.94)',
        'backdrop-filter:blur(12px)',
        'border:1px solid rgba(63, 208, 255, 0.35)',
        'border-radius:16px',
        'padding:20px 24px',
        'box-shadow:0 20px 60px rgba(0, 0, 0, 0.85)',
        'z-index:70',
        'font-family:\'Space Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif',
        'color:#e8f3ff',
        'box-sizing:border-box'
      ].join(';');

      const stepText = `Step ${Number(index || 0) + 1} of ${Number(total || 4)}: ${modInfo.title}`;

      let cardsHtml = '';
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const preview = previews && previews[opt.id] ? previews[opt.id] : { delta: {}, meters: meters || {} };
        const delta = preview.delta || {};
        const wouldPassLimit = (currentHours + (opt.hours || 0)) > SETUP_FATIGUE_HOURS;

        let deltasHtml = '';
        const keys = ['power', 'air', 'food', 'radiation', 'health'];
        for (let k = 0; k < keys.length; k++) {
          const key = keys[k];
          const dVal = delta[key] || 0;
          if (dVal !== 0) {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            const sign = dVal > 0 ? `+${dVal}` : `${dVal}`;
            const resVal = preview.meters ? preview.meters[key] : 0;
            const col = meterColor(meterLevel(resVal));
            deltasHtml += `<span title="${label} resulting: ${resVal}" style="background:rgba(255,255,255,0.08);border:1px solid ${col};color:${col};padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:600;">${label} ${sign}</span>`;
          }
        }

        const tireWarningHtml = wouldPassLimit ?
          '<div style="color:#ffb020;font-size:0.75rem;margin-top:6px;font-weight:600;">This will tire the crew: health -5</div>' : '';

        cardsHtml += `
          <button type="button" class="base-option-card" data-option-id="${opt.id}" data-index="${i}" style="flex:1 1 260px;min-width:240px;background:#0d1d3a;border:1px solid #1e3a6a;border-radius:12px;padding:16px;text-align:left;color:#e8f3ff;cursor:pointer;transition:border-color 0.2s, background 0.2s;display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:1.05rem;font-weight:700;color:#3fd0ff;">${opt.name}</span>
                <span style="background:rgba(63,208,255,0.15);color:#3fd0ff;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:600;">${opt.hours} h</span>
              </div>
              <div style="font-size:0.82rem;color:#94a3b8;line-height:1.4;">${opt.description}</div>
            </div>
            <div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                ${deltasHtml}
              </div>
              ${tireWarningHtml}
            </div>
          </button>
        `;
      }

      choiceElem.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:0.75rem;color:#7e9bb6;font-weight:600;letter-spacing:0.04em;">${stepText}</span>
        </div>
        <div style="font-size:1.15rem;font-weight:700;color:#ffffff;margin-bottom:14px;">${modInfo.prompt}</div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px;">
          ${cardsHtml}
        </div>
        <div style="font-size:0.8rem;color:#94a3b8;display:flex;justify-content:space-between;align-items:center;">
          <span>Setup time so far ${currentHours} of ${SETUP_FATIGUE_HOURS} hours before the crew gets tired</span>
          <span style="color:#64748b;font-size:0.75rem;">Press 1 or 2</span>
        </div>
      `;

      root.appendChild(choiceElem);

      const buttons = choiceElem.querySelectorAll('.base-option-card');
      buttons.forEach((btn) => {
        btn.addEventListener('mouseenter', () => {
          btn.style.borderColor = '#3fd0ff';
          btn.style.background = '#13284f';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.borderColor = '#1e3a6a';
          btn.style.background = '#0d1d3a';
        });
        btn.addEventListener('focus', () => {
          btn.style.outline = '2px solid #3fd0ff';
          btn.style.outlineOffset = '2px';
        });
        btn.addEventListener('blur', () => {
          btn.style.outline = 'none';
        });
        btn.addEventListener('click', () => {
          const optId = btn.getAttribute('data-option-id');
          close();
          if (typeof onChoose === 'function') onChoose(optId);
        });
      });

      if (buttons[0]) {
        buttons[0].focus();
      }

      choiceKeyHandler = (e) => {
        if (e.key === '1' && options[0]) {
          e.preventDefault();
          close();
          if (typeof onChoose === 'function') onChoose(options[0].id);
        } else if (e.key === '2' && options[1]) {
          e.preventDefault();
          close();
          if (typeof onChoose === 'function') onChoose(options[1].id);
        }
      };
      window.addEventListener('keydown', choiceKeyHandler);
    } catch (err) {
      console.error('EarthScene part failed: base choice panel', err);
    }
  }

  function openReady({ meters, setupHours, fatiguePenalty, choices, siteId, onContinue }) {
    try {
      close();
      if (!root || typeof document === 'undefined') return;

      const reduced = prefersReducedMotion();

      readyElem = document.createElement('div');
      readyElem.id = 'base-ready-dialog';
      readyElem.setAttribute('role', 'dialog');
      readyElem.setAttribute('aria-label', 'Base is online');

      readyElem.style.cssText = [
        'position:fixed',
        'top:50%',
        'left:50%',
        'transform:translate(-50%, -50%)',
        'width:min(92vw, 560px)',
        'background:rgba(7, 18, 42, 0.96)',
        'backdrop-filter:blur(14px)',
        'border:1px solid rgba(63, 208, 255, 0.4)',
        'border-radius:18px',
        'padding:28px 24px',
        'box-shadow:0 24px 80px rgba(0, 0, 0, 0.9)',
        'z-index:75',
        'font-family:\'Space Grotesk\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif',
        'color:#e8f3ff',
        'box-sizing:border-box',
        'opacity:0',
        reduced ? 'opacity:1' : 'transition:opacity 0.5s ease'
      ].join(';');

      let fact = BASE_FACTS[1];
      if (choices && choices.air === 'full' && siteId === 'crater') {
        fact = BASE_FACTS[2];
      } else if (choices && choices.shield === 'thick') {
        fact = BASE_FACTS[0];
      } else {
        fact = BASE_FACTS[1];
      }

      // Module names list
      const moduleList = [];
      const order = ['solar', 'habitat', 'air', 'shield'];
      for (let i = 0; i < order.length; i++) {
        const mId = order[i];
        const optId = choices ? choices[mId] : null;
        if (optId) {
          const opts = getModuleOptions(mId, siteId);
          const found = opts.find((o) => o.id === optId);
          if (found) {
            moduleList.push(found.name);
          }
        }
      }

      const modulesHtml = moduleList.length > 0 ?
        `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;">${moduleList.map((name) => `<span style="background:rgba(63,208,255,0.12);border:1px solid #1e3a6a;color:#bae6fd;padding:3px 10px;border-radius:12px;font-size:0.78rem;font-weight:600;">${name}</span>`).join('')}</div>` : '';

      const fatigueHtml = fatiguePenalty > 0 ?
        '<div style="color:#ffb020;font-size:0.84rem;font-weight:600;margin-top:2px;">The crew is tired: health -5</div>' : '';

      const meterDefs = [
        { key: 'power', label: 'Power', val: meters ? meters.power : 0 },
        { key: 'air', label: 'Air', val: meters ? meters.air : 0 },
        { key: 'food', label: 'Food', val: meters ? meters.food : 0 },
        { key: 'radiation', label: 'Radiation', val: meters ? meters.radiation : 0 },
        { key: 'health', label: 'Health', val: meters ? meters.health : 0 }
      ];

      let metersHtml = '';
      for (let i = 0; i < meterDefs.length; i++) {
        const m = meterDefs[i];
        const col = meterColor(meterLevel(m.val));
        metersHtml += `
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px;color:#94a3b8;">
              <span>${m.label}</span>
              <span id="ready-meter-val-${m.key}" style="font-weight:700;color:${col};">${reduced ? m.val : 0}</span>
            </div>
            <div style="width:100%;height:8px;background:#132342;border-radius:4px;overflow:hidden;">
              <div id="ready-meter-bar-${m.key}" style="width:${reduced ? m.val : 0}%;height:100%;background:${col};border-radius:4px;transition:width 0.8s ease;"></div>
            </div>
          </div>
        `;
      }

      readyElem.innerHTML = `
        <div style="font-size:1.45rem;font-weight:700;color:#3fd0ff;margin-bottom:8px;text-align:center;">Base is online</div>
        <div style="margin-bottom:16px;">
          ${metersHtml}
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:16px;">
          <div style="font-size:0.84rem;color:#e2e8f0;font-weight:600;">Setup time ${setupHours || 0} hours</div>
          ${fatigueHtml}
        </div>
        ${modulesHtml}
        <div style="font-size:0.8rem;color:#7e9bb6;font-style:italic;line-height:1.4;margin-bottom:20px;border-left:3px solid #3fd0ff;padding-left:10px;">
          ${fact}
        </div>
        <div style="text-align:center;">
          <button type="button" id="base-ready-continue-btn" style="background:#3fd0ff;color:#030b18;border:none;border-radius:10px;padding:12px 32px;font-size:1rem;font-weight:700;cursor:pointer;transition:background 0.2s, transform 0.1s;font-family:inherit;">
            Start the first day
          </button>
        </div>
      `;

      root.appendChild(readyElem);

      if (!reduced) {
        requestAnimationFrame(() => {
          if (readyElem) readyElem.style.opacity = '1';
        });

        // Animate meters from 0 to value over 0.8s
        const startTime = Date.now();
        const duration = 800;
        animTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / duration);
          for (let i = 0; i < meterDefs.length; i++) {
            const m = meterDefs[i];
            const currentVal = Math.round(m.val * progress);
            const valEl = document.getElementById(`ready-meter-val-${m.key}`);
            const barEl = document.getElementById(`ready-meter-bar-${m.key}`);
            if (valEl) valEl.textContent = `${currentVal}`;
            if (barEl) barEl.style.width = `${progress * m.val}%`;
          }
          if (progress >= 1) {
            clearInterval(animTimer);
            animTimer = null;
          }
        }, 30);
      }

      const contBtn = document.getElementById('base-ready-continue-btn');
      if (contBtn) {
        contBtn.focus();
        contBtn.addEventListener('click', () => {
          close();
          if (typeof onContinue === 'function') onContinue();
        });
      }
    } catch (err) {
      console.error('EarthScene part failed: base ready card', err);
    }
  }

  return {
    openChoice,
    openReady,
    close,
    isOpen
  };
}
