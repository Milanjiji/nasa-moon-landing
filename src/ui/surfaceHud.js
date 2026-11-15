import { formatHours, lookAtEarthAmount } from '../game/surfaceStats.js';
import { levelColor } from '../game/loadoutSummary.js';
import { getMission, setMission } from '../game/state.js';
import { meterLevel, meterColor } from '../game/baseSetup.js';

export function createSurfaceHud({ uiRoot }) {
  const root = uiRoot || document.body;

  let hudContainer = null;
  let visorOverlay = null;
  let chipsContainer = null;
  let captionElem = null;
  let hintElem = null;
  let touchControls = null;
  let photoBtn = null;
  let baseBtnContainer = null;
  let baseBtn = null;
  let baseNote = null;
  let flashOverlay = null;
  let toastElem = null;
  let announceElem = null;

  let isBaseMode = false;
  let baseMeters = { power: 0, air: 0, food: 0, radiation: 0, health: 100 };
  const chipElements = new Map();
  let currentHudStats = null;

  let photoHandler = null;
  let walkHandler = null;
  let baseContinueHandler = null;

  let standingTime = 0;
  let sawEarthTime = 0;
  let hasShownEarthPrompt = false;
  let hasSawEarthFired = false;
  let hasBaseBtnShown = false;
  let trackingInterval = null;
  let currentSite = null;

  try {
    hudContainer = document.createElement('div');
    hudContainer.id = 'surface-hud';
    hudContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:45;display:none;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#e8f3ff;';

    // 1. Visor Overlay
    visorOverlay = document.createElement('div');
    visorOverlay.id = 'surface-visor';
    visorOverlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;box-shadow:inset 0 0 100px 30px rgba(5,10,20,0.75);background:radial-gradient(circle at 50% 50%, rgba(255,255,255,0.01) 0%, rgba(0,0,0,0.15) 75%, rgba(0,0,0,0.65) 100%);';
    hudContainer.appendChild(visorOverlay);

    // 2. Chips (Bottom-Left)
    chipsContainer = document.createElement('div');
    chipsContainer.id = 'surface-chips';
    chipsContainer.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:50;display:flex;flex-direction:column;gap:8px;pointer-events:auto;';
    hudContainer.appendChild(chipsContainer);

    // 3. Caption Area (Bottom-Center)
    captionElem = document.createElement('div');
    captionElem.id = 'surface-caption';
    captionElem.setAttribute('aria-live', 'polite');
    captionElem.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:50;background:rgba(7,18,42,0.85);backdrop-filter:blur(8px);border:1px solid rgba(63,208,255,0.35);padding:10px 24px;border-radius:24px;font-size:0.95rem;font-weight:500;color:#e8f3ff;box-shadow:0 12px 30px rgba(0,0,0,0.6);text-align:center;pointer-events:none;opacity:0;transition:opacity 0.4s ease;max-width:min(90vw,540px);';
    hudContainer.appendChild(captionElem);

    // 4. Movement Hint (Centered, bottom 160px)
    hintElem = document.createElement('div');
    hintElem.id = 'surface-hint';
    hintElem.style.cssText = 'position:fixed;bottom:160px;left:50%;transform:translateX(-50%);z-index:50;background:rgba(5,10,20,0.75);border:1px solid rgba(255,255,255,0.12);padding:8px 18px;border-radius:20px;font-size:0.85rem;color:#94a3b8;pointer-events:none;opacity:0;transition:opacity 0.6s ease;text-align:center;';
    hudContainer.appendChild(hintElem);

    // 5. Touch Controls (if coarse pointer)
    const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches;
    if (isTouch) {
      touchControls = document.createElement('div');
      touchControls.id = 'surface-touch-controls';
      touchControls.style.cssText = 'position:fixed;bottom:90px;right:24px;z-index:50;display:flex;flex-direction:column;gap:10px;pointer-events:auto;';

      const btnFwd = document.createElement('button');
      btnFwd.type = 'button';
      btnFwd.className = 'surface-hud-btn';
      btnFwd.textContent = 'Walk forward';
      btnFwd.style.cssText = 'height:56px;padding:0 20px;background:#0d1e3d;border:1px solid #3fd0ff;color:#e8f3ff;border-radius:12px;font-size:0.95rem;font-weight:600;cursor:pointer;';

      const btnBack = document.createElement('button');
      btnBack.type = 'button';
      btnBack.className = 'surface-hud-btn';
      btnBack.textContent = 'Walk back';
      btnBack.style.cssText = 'height:56px;padding:0 20px;background:#0d1e3d;border:1px solid #3fd0ff;color:#e8f3ff;border-radius:12px;font-size:0.95rem;font-weight:600;cursor:pointer;';

      const bindHold = (elem, dir) => {
        const start = (e) => { e.preventDefault(); if (walkHandler) walkHandler(dir); };
        const stop = (e) => { e.preventDefault(); if (walkHandler) walkHandler(0); };
        elem.addEventListener('pointerdown', start);
        elem.addEventListener('pointerup', stop);
        elem.addEventListener('pointercancel', stop);
        elem.addEventListener('pointerleave', stop);
      };
      bindHold(btnFwd, 1);
      bindHold(btnBack, -1);

      touchControls.appendChild(btnFwd);
      touchControls.appendChild(btnBack);
      hudContainer.appendChild(touchControls);
    }

    // 6. Photo Button (Bottom-Right)
    photoBtn = document.createElement('button');
    photoBtn.type = 'button';
    photoBtn.id = 'surface-photo-btn';
    photoBtn.className = 'surface-hud-btn';
    photoBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;vertical-align:middle;">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>
      <span>Take a photo</span>
    `;
    photoBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:50;height:48px;padding:0 20px;background:#07122a;border:1px solid #3fd0ff;border-radius:24px;color:#e8f3ff;font-weight:600;font-size:0.9rem;cursor:pointer;pointer-events:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5);display:flex;align-items:center;transition:background 0.2s,border-color 0.2s;';
    photoBtn.addEventListener('mouseenter', () => { photoBtn.style.background = '#0e244d'; });
    photoBtn.addEventListener('mouseleave', () => { photoBtn.style.background = '#07122a'; });
    photoBtn.addEventListener('click', () => {
      if (photoHandler) photoHandler();
    });
    hudContainer.appendChild(photoBtn);

    // 7. "Set up the base" Button (Bottom-Center)
    baseBtnContainer = document.createElement('div');
    baseBtnContainer.id = 'surface-base-container';
    baseBtnContainer.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:55;display:none;flex-direction:column;align-items:center;pointer-events:auto;';

    baseBtn = document.createElement('button');
    baseBtn.type = 'button';
    baseBtn.id = 'surface-base-btn';
    baseBtn.className = 'surface-hud-btn';
    baseBtn.textContent = 'Set up the base';
    baseBtn.style.cssText = 'height:56px;padding:0 36px;background:linear-gradient(135deg,#3fd0ff 0%,#0088cc 100%);border:none;border-radius:28px;color:#030d22;font-size:1.05rem;font-weight:700;letter-spacing:0.5px;cursor:pointer;box-shadow:0 12px 36px rgba(0,180,255,0.4);transition:transform 0.15s,box-shadow 0.15s;';
    baseBtn.addEventListener('mouseenter', () => { baseBtn.style.transform = 'scale(1.03)'; });
    baseBtn.addEventListener('mouseleave', () => { baseBtn.style.transform = 'scale(1.0)'; });
    baseBtn.addEventListener('click', () => {
      console.log('Set up the base pressed');
      if (typeof baseContinueHandler === 'function') {
        baseContinueHandler();
      } else if (baseNote) {
        baseNote.style.display = 'block';
      }
    });
    baseBtnContainer.appendChild(baseBtn);

    baseNote = document.createElement('div');
    baseNote.id = 'surface-base-note';
    baseNote.textContent = 'The Moon base and the ending are built in the next step.';
    baseNote.style.cssText = 'margin-top:8px;font-size:0.8rem;color:#94a3b8;display:none;text-align:center;';
    baseBtnContainer.appendChild(baseNote);

    hudContainer.appendChild(baseBtnContainer);

    // 8. Flash Overlay (for photo)
    flashOverlay = document.createElement('div');
    flashOverlay.id = 'surface-flash';
    flashOverlay.style.cssText = 'position:fixed;inset:0;background:#ffffff;z-index:90;pointer-events:none;opacity:0;transition:opacity 0.2s ease;';
    hudContainer.appendChild(flashOverlay);

    // 9. Toast Notification
    toastElem = document.createElement('div');
    toastElem.id = 'surface-toast';
    toastElem.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:95;background:#0d1e3d;border:1px solid #3fd0ff;color:#e8f3ff;padding:8px 22px;border-radius:20px;font-size:0.9rem;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,0.6);opacity:0;transition:opacity 0.3s ease;pointer-events:none;';
    hudContainer.appendChild(toastElem);

    // 10. Visually hidden aria-live announcement
    announceElem = document.createElement('div');
    announceElem.id = 'surface-hud-announce';
    announceElem.setAttribute('aria-live', 'polite');
    announceElem.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    hudContainer.appendChild(announceElem);

    root.appendChild(hudContainer);
  } catch (err) {
    console.error('EarthScene part failed: surface hud creation', err);
  }

  function toast(text) {
    if (!toastElem) return;
    toastElem.textContent = text;
    toastElem.style.opacity = '1';
    setTimeout(() => {
      if (toastElem) toastElem.style.opacity = '0';
    }, 2400);
  }

  let captionTimer = null;
  function showCaption(text, ms = 5000) {
    if (!captionElem) return;
    if (captionTimer) clearTimeout(captionTimer);
    captionElem.textContent = text;
    captionElem.style.opacity = '1';
    captionTimer = setTimeout(() => {
      if (captionElem) captionElem.style.opacity = '0';
    }, ms);
  }

  function setHeavyFrame(heavy) {
    if (!visorOverlay) return;
    if (heavy) {
      visorOverlay.style.boxShadow = 'inset 0 0 160px 70px rgba(5,10,20,0.92)';
    } else {
      visorOverlay.style.boxShadow = 'inset 0 0 100px 30px rgba(5,10,20,0.75)';
    }
  }

  function renderChips() {
    if (!chipsContainer) return;
    chipsContainer.innerHTML = '';
    chipElements.clear();

    if (isBaseMode) {
      const keys = [
        { key: 'power', label: 'Power', val: baseMeters.power, hidden: true },
        { key: 'air', label: 'Air', val: baseMeters.air, hidden: false },
        { key: 'food', label: 'Food', val: baseMeters.food, hidden: true },
        { key: 'radiation', label: 'Radiation', val: baseMeters.radiation, hidden: false },
        { key: 'health', label: 'Health', val: baseMeters.health, hidden: false },
      ];
      for (let i = 0; i < keys.length; i++) {
        const item = keys[i];
        const chip = document.createElement('div');
        const col = item.key === 'health'
          ? (item.val >= 70 ? '#34d399' : (item.val >= 40 ? '#ffb020' : '#ef4444'))
          : meterColor(meterLevel(item.val));
        chip.style.cssText = `background:rgba(7,18,42,0.85);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);padding:6px 14px;border-radius:18px;font-size:0.82rem;font-weight:600;display:${item.hidden ? 'none' : 'flex'};opacity:${item.hidden ? '0' : '1'};align-items:center;gap:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);width:fit-content;transition:opacity 0.4s ease, border-color 0.3s;`;
        chip.innerHTML = `
          <span class="chip-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};"></span>
          <span style="color:#94a3b8;">${item.label}</span>
          <span class="chip-val" style="color:#f8fafc;">${item.val}</span>
        `;
        chipsContainer.appendChild(chip);
        chipElements.set(item.label, {
          chip,
          dot: chip.querySelector('.chip-dot'),
          valEl: chip.querySelector('.chip-val'),
          currentVal: item.val,
        });
      }
    } else if (currentHudStats) {
      const s = currentHudStats;
      const healthCol = s.health >= 70 ? '#34d399' : (s.health >= 40 ? '#ffb020' : '#ef4444');
      const airCol = s.oxygenRatio >= 0.5 ? '#34d399' : (s.oxygenRatio >= 0.25 ? '#ffb020' : '#ef4444');
      const powerCol = s.powerPct >= 60 ? '#34d399' : (s.powerPct >= 30 ? '#ffb020' : '#ef4444');
      const radCol = levelColor(s.radiationRatio >= 0.6 ? 'good' : (s.radiationRatio >= 0.35 ? 'warn' : 'bad'));

      const chipData = [
        { label: 'Health', val: `${s.health}`, col: healthCol, tip: 'Vital life signs' },
        { label: 'Air', val: formatHours(s.oxygenHours), col: airCol, tip: 'Remaining oxygen' },
        { label: 'Power', val: `${s.powerPct}%`, col: powerCol, tip: 'Lander solar storage' },
        { label: 'Radiation shield', val: `${s.radiationValue} of ${s.radiationMax}`, col: radCol, tip: 'Radiation shielding' },
      ];

      for (let i = 0; i < chipData.length; i++) {
        const item = chipData[i];
        const chip = document.createElement('div');
        chip.title = item.tip;
        chip.style.cssText = 'background:rgba(7,18,42,0.85);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.12);padding:6px 14px;border-radius:18px;font-size:0.82rem;font-weight:600;display:flex;align-items:center;gap:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);width:fit-content;';
        chip.innerHTML = `
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.col};"></span>
          <span style="color:#94a3b8;">${item.label}</span>
          <span style="color:#f8fafc;">${item.val}</span>
        `;
        chipsContainer.appendChild(chip);
      }
    }
  }

  function show(stats, site) {
    if (!hudContainer) return;
    currentSite = site;
    currentHudStats = stats;
    standingTime = 0;
    sawEarthTime = 0;
    hasShownEarthPrompt = false;
    hasSawEarthFired = false;
    hasBaseBtnShown = false;

    // Apply visor tint
    if (visorOverlay) {
      if (stats?.visorTint) {
        visorOverlay.style.backgroundColor = stats.visorTint;
      } else {
        visorOverlay.style.backgroundColor = 'transparent';
      }
      setHeavyFrame(Boolean(stats?.heavyFrame));
    }

    renderChips();

    if (baseBtnContainer) baseBtnContainer.style.display = 'none';
    if (baseNote) baseNote.style.display = 'none';

    hudContainer.style.display = 'block';

    // Ladder done / hints
    setTimeout(() => {
      showCaption('One small step.', 4000);
      if (hintElem) {
        hintElem.textContent = 'Drag to look. Walk with W and S or the arrow keys.';
        hintElem.style.opacity = '1';
        setTimeout(() => {
          if (hintElem) hintElem.style.opacity = '0';
        }, 8000);
      }
    }, 4500);

    // Start Earth angle tracking loop
    if (trackingInterval) clearInterval(trackingInterval);
    trackingInterval = setInterval(() => {
      standingTime += 0.25;

      // 45s fallback for base button
      if (standingTime >= 45 && !hasBaseBtnShown) {
        hasBaseBtnShown = true;
        if (baseBtnContainer) baseBtnContainer.style.display = 'flex';
      }

      if (typeof window !== 'undefined' && window.surfaceScene?.getView) {
        const v = window.surfaceScene.getView();
        const yawDeg = (v.yaw * 180) / Math.PI;
        const pitchDeg = (v.pitch * 180) / Math.PI;
        const eYaw = site?.surface?.earthAzimuthDeg || 20;
        const ePitch = site?.surface?.earthElevationDeg || 24;

        const ang = lookAtEarthAmount(yawDeg, pitchDeg, eYaw, ePitch);

        // Prompt if not looking at Earth after 6s
        if (standingTime >= 6.0 && !hasShownEarthPrompt && !hasSawEarthFired) {
          if (ang > 35) {
            hasShownEarthPrompt = true;
            const promptText = site?.id === 'crater'
              ? 'Look toward the crater rim: Earth is rising behind it.'
              : 'Earth is up and to your right.';
            showCaption(promptText, 5000);
          }
        }

        // Looked at Earth check: < 12 deg for 1.5s
        if (ang < 12.0) {
          sawEarthTime += 0.25;
          if (sawEarthTime >= 1.5 && !hasSawEarthFired) {
            hasSawEarthFired = true;
            const mission = getMission();
            if (mission.surface) mission.surface.sawEarth = true;
            setMission(mission);
            showCaption('That is home. About 384,400 km away.', 6000);

            // Show base button 3s later
            setTimeout(() => {
              hasBaseBtnShown = true;
              if (baseBtnContainer) baseBtnContainer.style.display = 'flex';
            }, 3000);
          }
        } else {
          sawEarthTime = 0;
        }
      }
    }, 250);
  }

  function hide() {
    if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; }
    if (captionTimer) { clearTimeout(captionTimer); captionTimer = null; }
    if (hudContainer) hudContainer.style.display = 'none';
  }

  function setBaseButton({ visible, onClick }) {
    if (baseBtnContainer) {
      baseBtnContainer.style.display = visible ? 'flex' : 'none';
    }
    if (typeof onClick === 'function') {
      baseContinueHandler = onClick;
    }
  }

  function onPhoto(cb) {
    photoHandler = async () => {
      const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (!prefersReduced && flashOverlay) {
        flashOverlay.style.opacity = '1';
        setTimeout(() => { if (flashOverlay) flashOverlay.style.opacity = '0'; }, 200);
      }
      if (typeof cb === 'function') {
        const ok = await cb();
        if (ok) {
          toast('Photo saved');
          const mission = getMission();
          if (mission.surface) mission.surface.photoTaken = true;
          setMission(mission);
        } else {
          toast('Could not save the photo');
        }
      }
    };
  }

  function onBaseContinue(cb) {
    if (typeof cb === 'function') {
      baseContinueHandler = cb;
    }
  }

  function setBaseMode(on) {
    isBaseMode = Boolean(on);
    if (baseBtnContainer) baseBtnContainer.style.display = 'none';
    if (baseNote) baseNote.style.display = 'none';
    renderChips();
  }

  function showChip(name, bool) {
    const entry = chipElements.get(name);
    if (!entry) return;
    if (bool) {
      entry.chip.style.display = 'flex';
      requestAnimationFrame(() => {
        if (entry.chip) entry.chip.style.opacity = '1';
      });
    } else {
      entry.chip.style.opacity = '0';
      entry.chip.style.display = 'none';
    }
  }

  function setMeters(newMeters, { animate = true } = {}) {
    if (!newMeters) return;
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const shouldAnimate = animate && !prefersReduced;

    const names = [
      { key: 'power', label: 'Power' },
      { key: 'air', label: 'Air' },
      { key: 'food', label: 'Food' },
      { key: 'radiation', label: 'Radiation' },
      { key: 'health', label: 'Health' },
    ];

    for (let i = 0; i < names.length; i++) {
      const item = names[i];
      const val = newMeters[item.key];
      if (typeof val !== 'number') continue;
      baseMeters[item.key] = val;
      const entry = chipElements.get(item.label);
      if (!entry) continue;

      const fromVal = entry.currentVal;
      entry.currentVal = val;

      const targetCol = item.key === 'health'
        ? (val >= 70 ? '#34d399' : (val >= 40 ? '#ffb020' : '#ef4444'))
        : meterColor(meterLevel(val));

      if (entry.dot) entry.dot.style.background = targetCol;

      if (fromVal !== val) {
        if (announceElem) {
          announceElem.textContent = `${item.label} ${val}`;
        }
        entry.chip.style.borderColor = '#3fd0ff';
        setTimeout(() => {
          if (entry.chip) entry.chip.style.borderColor = 'rgba(255,255,255,0.12)';
        }, 400);

        if (shouldAnimate) {
          const startTime = performance.now();
          const dur = 800;
          const step = (now) => {
            const p = Math.min(1.0, (now - startTime) / dur);
            const cur = Math.round(fromVal + (val - fromVal) * p);
            if (entry.valEl) entry.valEl.textContent = `${cur}`;
            if (p < 1.0) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        } else {
          if (entry.valEl) entry.valEl.textContent = `${val}`;
        }
      }
    }
  }

  function setWalkHandler(fn) {
    walkHandler = fn;
  }

  return {
    show,
    hide,
    setHeavyFrame,
    showCaption,
    setBaseButton,
    setBaseMode,
    showChip,
    setMeters,
    onBaseContinue,
    onPhoto,
    setWalkHandler,
    toast,
  };
}

export default createSurfaceHud;
