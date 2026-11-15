// ---------------------------------------------------------------------------
// Flight Controller: Translunar Flight, Storm Resolution & Lunar Orbit
// ---------------------------------------------------------------------------

import {
  FLIGHT,
  getFlightFrame,
  computeStormOutcome,
  getStormFrame,
} from '../game/flightSequence.js';
import { summarizeLoadout } from '../game/loadoutSummary.js';
import { setPhase, setMission, getMission } from '../game/state.js';
import { createStormPanel } from '../ui/stormPanel.js';
import { createSitePanel } from '../ui/sitePanel.js';

export function createFlightController({
  screens,
  effects,
  getLoadout,
  setOutsideView,
  uiRoot,
  floaters,
}) {
  const root = uiRoot || (typeof document !== 'undefined' ? document.body : null);

  let running = false;
  let phase = 'idle'; // 'idle' | 'flight' | 'stormWait' | 'stormResolve' | 'stormResult' | 'siteSelect' | 'done'
  let tf = 0;
  let stormTimer = 0;
  let stormOutcome = null;
  let stormLogged = false;
  let orbitLogged = false;
  let currentSite = null;

  const milestoneLogs = new Set();
  const landPressedCallbacks = [];

  const prefersReduced = (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  );
  const speedMultiplier = prefersReduced ? 2.5 : 1.0;

  let isPaused = (typeof document !== 'undefined' && document.hidden) || false;
  function onVisibilityChange() {
    isPaused = (typeof document !== 'undefined') ? document.hidden : false;
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  // UI Panels
  let stormPanel = null;
  let sitePanel = null;

  function handleStormChoice(choice) {
    phase = 'stormResolve';
    stormTimer = 0;

    const loadout = typeof getLoadout === 'function' ? getLoadout() : null;
    const summary = summarizeLoadout(loadout ? loadout.totals : null);
    stormOutcome = computeStormOutcome({ choice, loadoutSummary: summary });

    setMission({
      stormChoice: choice,
      stormDose: stormOutcome.dose,
      stormLevel: stormOutcome.level,
      healthPenalty: stormOutcome.healthPenalty,
    });

    if (screens) {
      screens.setLogLine(`Protocol engaged: ${choice === 'orient' ? 'Orienting heat shield' : 'Cabin shelter'}`);
      screens.setLogLine(`Radiation dose absorbed: ${stormOutcome.dose} mSv`);
    }
  }

  function resumeFlightAfterStorm() {
    phase = 'flight';
    if (stormPanel) stormPanel.hideAll();
    if (effects) effects.setStormAlert(false);
    if (screens) screens.setLogLine('Course maintained. Approaching lunar gravitational sphere.');
  }

  function handleSiteSelection(site) {
    currentSite = site;
    setMission({ landingSite: site.id });
    phase = 'done';
    if (sitePanel) sitePanel.hide();

    if (screens) {
      screens.setLogLine(`Landing target confirmed: ${site.name}`);
      screens.setLogLine('Descent module prepped for landing.');
    }

    for (let i = 0; i < landPressedCallbacks.length; i++) {
      try { landPressedCallbacks[i](site); } catch (e) { console.error(e); }
    }
  }

  try {
    stormPanel = createStormPanel({
      uiRoot: root,
      onSelectChoice: (choice) => {
        handleStormChoice(choice);
      },
      onContinue: () => {
        resumeFlightAfterStorm();
      },
    });
  } catch (err) {
    console.error('EarthScene part failed: flight storm panel init', err);
  }

  try {
    sitePanel = createSitePanel({
      uiRoot: root,
      onSelectSite: (site) => {
        handleSiteSelection(site);
      },
    });
  } catch (err) {
    console.error('EarthScene part failed: flight site panel init', err);
  }

  function start() {
    if (running && phase !== 'idle') return;
    running = true;
    phase = 'flight';
    tf = 0;
    stormTimer = 0;
    stormLogged = false;
    orbitLogged = false;
    milestoneLogs.clear();

    setPhase('flight');
    if (screens) {
      screens.setLogLine('Trans-Lunar Injection burn initiated.');
      screens.setLogLine('Translunar trajectory established.');
    }
  }

  function reset() {
    running = false;
    phase = 'idle';
    tf = 0;
    stormTimer = 0;
    stormOutcome = null;
    stormLogged = false;
    orbitLogged = false;
    milestoneLogs.clear();

    if (stormPanel) stormPanel.hideAll();
    if (sitePanel) sitePanel.hide();
    if (effects) {
      effects.reset();
      effects.setStormAlert(false);
    }
    if (screens) {
      screens.clearFlightMode();
    }
  }

  function abort() {
    reset();
  }

  function update(rawDelta) {
    if (isPaused || !running) return;
    const delta = Math.min(0.1, rawDelta);

    const mission = getMission();
    const loadout = typeof getLoadout === 'function' ? getLoadout() : null;
    const summary = summarizeLoadout(loadout ? loadout.totals : null);

    if (phase === 'flight') {
      tf += delta * speedMultiplier;

      // Milestone logs
      if (tf >= 6.0 && !milestoneLogs.has(6)) {
        milestoneLogs.add(6);
        if (screens) screens.setLogLine('TLI engine cutoff. Translunar coast established.');
      }
      if (tf >= 20.0 && !milestoneLogs.has(20)) {
        milestoneLogs.add(20);
        if (screens) screens.setLogLine('Midcourse correction thrusters fired.');
      }
      if (tf >= 23.0 && !milestoneLogs.has(23)) {
        milestoneLogs.add(23);
        if (screens) screens.setLogLine('Trajectory calibrated. Continuing coast.');
      }

      // Check storm alert trigger at 28s
      if (tf >= FLIGHT.stormAlert && !stormLogged) {
        stormLogged = true;
        tf = FLIGHT.stormAlert;
        phase = 'stormWait';

        if (effects) effects.setStormAlert(true);
        if (screens) {
          screens.setLogLine('EMERGENCY: Coronal mass ejection detected!');
          screens.setLogLine('Awaiting defense protocol selection...');
        }
        if (stormPanel) stormPanel.showDecision(summary, handleStormChoice);
      }

      // Check LOI burn milestone at 48s
      if (tf >= FLIGHT.loiBurnStart && !milestoneLogs.has(48)) {
        milestoneLogs.add(48);
        if (screens) screens.setLogLine('Lunar Orbit Insertion burn started. Decelerating.');
      }

      // Check lunar orbit reached at 60s
      if (tf >= FLIGHT.duration) {
        tf = FLIGHT.duration;
        running = false;
        phase = 'siteSelect';

        setPhase('lunarOrbit');
        setMission({ lunarOrbitReached: true });

        if (!orbitLogged) {
          orbitLogged = true;
          if (screens) {
            screens.setLogLine('Low lunar orbit achieved (100 km altitude).');
            screens.setLogLine('Select landing coordinates to proceed.');
          }
        }

        if (sitePanel) sitePanel.show(handleSiteSelection);
      }

      const frame = getFlightFrame(tf, mission);
      if (setOutsideView && frame.view) {
        setOutsideView(frame.view);
      }

      if (screens) {
        screens.setFlightFrame({
          frame,
          mission,
          isStorm: false,
          stormFrame: null,
          isLunarOrbit: tf >= 56.0,
          selectedSite: currentSite || sitePanel?.getSelectedSite(),
        });
      }

      if (effects) {
        effects.update(delta, frame, null);
      }

      if (floaters?.update) {
        floaters.update(delta, frame, prefersReduced);
      }
    } else if (phase === 'stormWait') {
      // Waiting for player input
      const frame = getFlightFrame(tf, mission);
      const stormFrame = getStormFrame(1.0, null);

      if (screens) {
        screens.setFlightFrame({
          frame,
          mission,
          isStorm: true,
          stormFrame,
          isLunarOrbit: false,
          selectedSite: null,
        });
      }

      if (effects) {
        effects.update(delta, frame, stormFrame);
      }

      if (floaters?.update) {
        floaters.update(delta, frame, prefersReduced);
      }
    } else if (phase === 'stormResolve') {
      stormTimer += delta * speedMultiplier;
      const stormFrame = getStormFrame(stormTimer, stormOutcome);
      const frame = getFlightFrame(tf, mission);

      if (screens) {
        screens.setFlightFrame({
          frame,
          mission,
          isStorm: true,
          stormFrame,
          isLunarOrbit: false,
          selectedSite: null,
        });
      }

      if (effects) {
        effects.update(delta, frame, stormFrame);
      }

      if (floaters?.update) {
        floaters.update(delta, frame, prefersReduced);
      }

      if (stormTimer >= FLIGHT.stormDuration) {
        phase = 'stormResult';
        tf = FLIGHT.stormAlert + FLIGHT.stormDuration;
        if (effects) effects.setStormAlert(false);
        if (stormPanel) stormPanel.showResult(stormOutcome);
      }
    } else if (phase === 'stormResult' || phase === 'siteSelect' || phase === 'done') {
      // Settle frames
      const frame = getFlightFrame(tf, mission);

      if (screens) {
        screens.setFlightFrame({
          frame,
          mission,
          isStorm: false,
          stormFrame: null,
          isLunarOrbit: true,
          selectedSite: currentSite || sitePanel?.getSelectedSite(),
        });
      }

      if (effects) {
        effects.update(delta, frame, null);
      }

      if (floaters?.update) {
        floaters.update(delta, frame, prefersReduced);
      }
    }
  }

  function skipTo(seconds) {
    tf = Math.max(0, Math.min(FLIGHT.duration, seconds));
    if (tf >= FLIGHT.stormAlert + FLIGHT.stormDuration) {
      stormLogged = true;
    }
    const mission = getMission();
    const frame = getFlightFrame(tf, mission);
    if (setOutsideView && frame.view) {
      setOutsideView(frame.view);
    }
    if (screens) {
      screens.setFlightFrame({
        frame,
        mission,
        isStorm: false,
        stormFrame: null,
        isLunarOrbit: tf >= 56.0,
        selectedSite: currentSite || sitePanel?.getSelectedSite(),
      });
    }
  }

  function dispose() {
    reset();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (stormPanel) stormPanel.dispose();
    if (sitePanel) sitePanel.dispose();
  }

  return {
    start,
    reset,
    abort,
    update,
    skipTo,
    isRunning: () => running,
    getPhase: () => phase,
    onLandPressed: (cb) => {
      if (typeof cb === 'function') landPressedCallbacks.push(cb);
    },
    dispose,
  };
}

export default createFlightController;
