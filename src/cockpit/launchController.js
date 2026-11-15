import { getFrame, computeFuelMargin, MILESTONES } from '../game/launchSequence.js';
import { WEIGHT_LIMIT } from '../data/gear.js';
import { summarizeLoadout } from '../game/loadoutSummary.js';
import { setPhase, setMission, resetMission } from '../game/state.js';

function createOrbitCard(uiRoot, onContinueClick) {
  const card = document.createElement('div');
  card.id = 'orbit-reached-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Orbit reached');
  card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(90vw,440px);background:#07122a;border:1px solid #3fd0ff;border-radius:16px;padding:32px 28px;box-shadow:0 24px 60px rgba(0,0,0,0.8);z-index:60;display:none;opacity:0;transition:opacity 0.6s ease;text-align:center;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#e8f3ff;';

  const title = document.createElement('h2');
  title.textContent = 'Orbit reached';
  title.style.cssText = 'font-size:1.8rem;font-weight:700;margin:0 0 20px 0;color:#e8f3ff;';
  card.appendChild(title);

  const stats = document.createElement('div');
  stats.style.cssText = 'display:flex;flex-direction:column;gap:8px;font-size:1.15rem;font-weight:600;margin-bottom:18px;text-align:left;padding:0 12px;';

  const altLine = document.createElement('div');
  altLine.textContent = 'Altitude 400 km';
  altLine.style.color = '#9fd8ff';
  stats.appendChild(altLine);

  const spdLine = document.createElement('div');
  spdLine.textContent = 'Speed 28,000 km/h';
  spdLine.style.color = '#9fd8ff';
  stats.appendChild(spdLine);

  const fuelLine = document.createElement('div');
  stats.appendChild(fuelLine);
  card.appendChild(stats);

  const mutedText = document.createElement('p');
  mutedText.textContent = 'A heavier loadout leaves less fuel for the rest of the trip.';
  mutedText.style.cssText = 'font-size:0.95rem;color:#7e9bb6;margin:0 0 24px 0;line-height:1.4;';
  card.appendChild(mutedText);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'orbit-continue-btn';
  btn.textContent = 'Continue to the Moon';
  btn.style.cssText = 'display:inline-block;width:100%;padding:12px 20px;font-family:inherit;font-size:1.05rem;font-weight:600;color:#050d1a;background:#3fd0ff;border:none;border-radius:10px;cursor:pointer;transition:transform 0.15s, background-color 0.15s;';
  btn.addEventListener('mouseenter', () => { btn.style.background = '#6ee7b7'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#3fd0ff'; });
  btn.addEventListener('click', onContinueClick);
  card.appendChild(btn);

  const note = document.createElement('div');
  note.id = 'orbit-next-note';
  note.textContent = 'The next part is built in the next step.';
  note.style.cssText = 'display:none;margin-top:14px;font-size:0.9rem;color:#7e9bb6;';
  card.appendChild(note);

  uiRoot.appendChild(card);

  return {
    show(fuelMargin) {
      const fuelCol = fuelMargin >= 25 ? '#34d399' : (fuelMargin >= 15 ? '#ffb020' : '#ff5b5b');
      fuelLine.innerHTML = `<span style="color:${fuelCol}">Fuel margin ${fuelMargin}%</span>`;
      note.style.display = 'none';
      card.style.display = 'block';
      requestAnimationFrame(() => {
        card.style.opacity = '1';
        btn.focus();
      });
    },
    showNote() {
      note.style.display = 'block';
    },
    hide() {
      card.style.opacity = '0';
      card.style.display = 'none';
      note.style.display = 'none';
    },
    dispose() {
      if (card.parentNode) card.parentNode.removeChild(card);
    },
  };
}

export function createLaunchController({ screens, effects, getLoadout, launchButtonMesh, uiRoot }) {
  const root = uiRoot || document.body;

  let running = false;
  let orbitReached = false;
  let phase = 'idle';
  let ffTime = 0;
  let timelineT = -10;
  let lastWarnTime = 0;
  let isAmberPulsing = false;
  let amberTimer = 0;
  let ffChecksLogged = false;
  let ffHandoverLogged = false;

  let origBtnEmissive = null;
  let origBtnColor = null;
  let origBtnIntensity = 1.5;

  const firedMilestones = new Set();
  const launchCompleteCallbacks = [];
  const continueCallbacks = [];
  let mission = { fuelMargin: 25 };

  const prefersReduced = (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  );
  const speedMultiplier = prefersReduced ? 2.5 : 1.0;
  const ffDuration = 2.5 / speedMultiplier;

  let isPaused = (typeof document !== 'undefined' && document.hidden) || false;
  function onVisibilityChange() {
    isPaused = (typeof document !== 'undefined') ? document.hidden : false;
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  const orbitCardDom = createOrbitCard(root, () => {
    if (continueCallbacks.length > 0) {
      for (let i = 0; i < continueCallbacks.length; i++) {
        try { continueCallbacks[i](); } catch (e) { console.error(e); }
      }
    } else {
      orbitCardDom.showNote();
    }
  });

  function startAmberPulse() {
    isAmberPulsing = true;
    amberTimer = 0;
    if (launchButtonMesh?.material) {
      if (origBtnEmissive === null && launchButtonMesh.material.emissive) {
        origBtnEmissive = launchButtonMesh.material.emissive.getHex();
        origBtnColor = launchButtonMesh.material.color.getHex();
        origBtnIntensity = launchButtonMesh.material.emissiveIntensity;
      }
    }
  }

  function stopAmberPulse() {
    isAmberPulsing = false;
    amberTimer = 0;
    if (launchButtonMesh?.material && origBtnEmissive !== null) {
      launchButtonMesh.material.emissive.setHex(origBtnEmissive);
      launchButtonMesh.material.color.setHex(origBtnColor);
      launchButtonMesh.material.emissiveIntensity = origBtnIntensity;
    }
  }

  function checkArming() {
    const loadout = typeof getLoadout === 'function' ? getLoadout() : null;
    const totals = loadout ? loadout.totals : null;
    const summary = summarizeLoadout(totals);
    const badLabels = [];
    if (!loadout || !loadout.selection) {
      badLabels.push('No gear loaded');
    } else {
      if (summary.radiation.level === 'bad') badLabels.push(summary.radiation.label);
      if (summary.air.level === 'bad') badLabels.push(summary.air.label);
      if (summary.mobility.level === 'bad') badLabels.push(summary.mobility.label);
    }
    return { isBad: badLabels.length > 0, badLabels, totals };
  }

  function launch(totals) {
    running = true;
    orbitReached = false;
    phase = 'ff';
    ffTime = 0;
    ffChecksLogged = false;
    ffHandoverLogged = false;
    timelineT = -10;
    firedMilestones.clear();

    const totalWeight = (totals && typeof totals.weight === 'number') ? totals.weight : 0;
    const fuelMargin = computeFuelMargin(totalWeight, WEIGHT_LIMIT);
    mission = { fuelMargin };

    setPhase('launch');
    setMission({ fuelMargin, launchedAt: Date.now(), orbitReached: false });
  }

  function start() {
    if (running || orbitReached) return;

    const { isBad, badLabels, totals } = checkArming();
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    if (isBad) {
      if (now - lastWarnTime > 8000) {
        lastWarnTime = now;
        const warnMsg = `Warning: ${badLabels.join(', ')}. Press again within 8 seconds to launch anyway.`;
        if (screens) screens.setLogLine(warnMsg);
        startAmberPulse();
        return;
      }
    }

    stopAmberPulse();
    launch(totals);
  }

  function reset() {
    running = false;
    orbitReached = false;
    phase = 'idle';
    ffTime = 0;
    timelineT = -10;
    lastWarnTime = 0;
    stopAmberPulse();
    firedMilestones.clear();
    orbitCardDom.hide();

    if (effects) {
      effects.reset();
      if (typeof effects.setCaption === 'function') effects.setCaption('');
    }
    if (screens) {
      screens.reset();
    }
    resetMission();
  }

  function abort() {
    reset();
  }

  function isRunning() {
    return running;
  }

  function update(rawDelta) {
    if (isAmberPulsing) {
      amberTimer += rawDelta;
      if (amberTimer >= 8.0) {
        stopAmberPulse();
      } else if (launchButtonMesh?.material) {
        const p = 0.5 + 0.5 * Math.sin(amberTimer * Math.PI * 3);
        launchButtonMesh.material.emissive.setHex(0xffb020);
        launchButtonMesh.material.color.setHex(0xd97706);
        launchButtonMesh.material.emissiveIntensity = 1.0 + 1.5 * p;
      }
    }

    if (isPaused || !running) return;
    const delta = Math.min(0.1, rawDelta);

    if (phase === 'ff') {
      ffTime += delta;
      const progress = Math.min(1, ffTime / ffDuration);
      const tEase = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      const simulatedSec = -600 + 590 * tEase;

      if (progress >= 0.25 && !ffChecksLogged) {
        ffChecksLogged = true;
        if (screens) screens.setLogLine('Final checks complete');
      }
      if (progress >= 0.75 && !ffHandoverLogged) {
        ffHandoverLogged = true;
        if (screens) screens.setLogLine('Handing over to the countdown');
      }

      const ffFrame = {
        stage: 'prelaunch',
        stageLabel: 'Countdown',
        altitudeKm: 0,
        speedKmh: 0,
        g: 1.0,
        missionTimeSec: simulatedSec,
        shake: 0,
        flame: 0,
        thrust: 0,
        skyFade: 1,
        earthRise: 0,
        maxQ: false,
        orbit: false,
        fuelMargin: mission.fuelMargin,
      };
      if (screens) screens.setLaunchFrame(ffFrame, mission);

      if (ffTime >= ffDuration) {
        phase = 'timeline';
        timelineT = -10;
      }
    } else if (phase === 'timeline') {
      timelineT += delta * speedMultiplier;

      for (let i = 0; i < MILESTONES.length; i++) {
        const m = MILESTONES[i];
        if (timelineT >= m.t && !firedMilestones.has(i)) {
          firedMilestones.add(i);
          if (screens) screens.setLogLine(m.text);
          if (effects?.setCaption) effects.setCaption(m.text);
          if (m.t === 28) {
            setTimeout(() => {
              if (screens) screens.setLogLine('Weightless: loose objects are floating');
              if (effects?.setCaption) effects.setCaption('Weightless: loose objects are floating');
            }, 600);
          }
        }
      }

      if (timelineT >= 30) {
        timelineT = 30;
        const finalFrame = getFrame(30, mission);
        if (screens) screens.setLaunchFrame(finalFrame, mission);
        if (effects) effects.setFrame(finalFrame, delta);

        running = false;
        orbitReached = true;
        phase = 'orbit';

        setMission({ orbitReached: true });
        orbitCardDom.show(mission.fuelMargin);

        setTimeout(() => {
          if (typeof window !== 'undefined' && typeof window.__orbitCheck === 'function') {
            window.__orbitCheck();
          }
        }, 1000);

        for (let i = 0; i < launchCompleteCallbacks.length; i++) {
          try { launchCompleteCallbacks[i](); } catch (err) { console.error(err); }
        }
        return;
      }

      const frame = getFrame(timelineT, mission);
      if (screens) screens.setLaunchFrame(frame, mission);
      if (effects) effects.setFrame(frame, delta);
    }
  }

  function dispose() {
    reset();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    orbitCardDom.dispose();
  }

  return {
    start,
    abort,
    reset,
    isRunning,
    update,
    onLaunchComplete: (cb) => { if (typeof cb === 'function') launchCompleteCallbacks.push(cb); },
    onContinue: (cb) => { if (typeof cb === 'function') continueCallbacks.push(cb); },
    dispose,
  };
}

export default createLaunchController;
