// ---------------------------------------------------------------------------
// Landing Controller State Machine (Descent, Hazard Decision, Touchdown)
// ---------------------------------------------------------------------------

import {
  getLandingFrame,
  computeLandingOutcome,
  LANDING_MILESTONES,
} from '../game/landingSequence.js';
import { LUNAR_ORBIT_VIEW, LANDING_SKY_VIEW, ORBIT_VIEW } from '../game/outsideViews.js';
import { getSite } from '../data/sites.js';
import { setPhase, setMission, getMission } from '../game/state.js';
import { summarizeLoadout } from '../game/loadoutSummary.js';
import { createLandingPanel } from '../ui/landingPanel.js';
import { createLandingEffects } from './landingEffects.js';
import { createLandingFeed } from './landingFeed.js';
import { isDev } from '../dev/devFlag.js';

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpLog(a, b, t) {
  const safeA = Math.max(1e-5, a);
  const safeB = Math.max(1e-5, b);
  const p = Math.max(0, Math.min(1, t));
  return Math.exp(Math.log(safeA) + p * (Math.log(safeB) - Math.log(safeA)));
}

function interpolateFlipView(progress) {
  const p = Math.max(0, Math.min(1, progress));
  return {
    earthScale: lerpLog(LUNAR_ORBIT_VIEW.earthScale, LANDING_SKY_VIEW.earthScale, p),
    earthOffsetY: lerp(LUNAR_ORBIT_VIEW.earthOffsetY, LANDING_SKY_VIEW.earthOffsetY, p),
    earthYawDeg: lerp(LUNAR_ORBIT_VIEW.earthYawDeg, LANDING_SKY_VIEW.earthYawDeg, p),
    earthPitchDeg: lerp(LUNAR_ORBIT_VIEW.earthPitchDeg, LANDING_SKY_VIEW.earthPitchDeg, p),
    moonDistance: lerpLog(LUNAR_ORBIT_VIEW.moonDistance, LANDING_SKY_VIEW.moonDistance, p),
    moonScale: lerpLog(LUNAR_ORBIT_VIEW.moonScale, LANDING_SKY_VIEW.moonScale, p),
    moonYawDeg: lerp(LUNAR_ORBIT_VIEW.moonYawDeg, LANDING_SKY_VIEW.moonYawDeg, p),
    moonPitchDeg: lerp(LUNAR_ORBIT_VIEW.moonPitchDeg, LANDING_SKY_VIEW.moonPitchDeg, p),
  };
}

export function createLandingController({
  scene,
  camera,
  cockpitScene,
  screens,
  getLoadout,
  setOutsideView,
  uiRoot,
  floaters,
}) {
  const root = uiRoot || (typeof document !== 'undefined' ? document.body : null);

  let running = false;
  let stage = 'idle'; // 'idle' | 'flip' | 'deorbit' | 'descent' | 'decision' | 'final' | 'touchdown' | 'landed'
  let tl = 0;
  let isClockFrozen = false;
  let divertChosen = false;
  let landingOutcome = null;
  let hasLandedFired = false;
  let hasTouchdownCardFired = false;
  let checkSkyFired = false;

  const firedMilestones = new Set();
  const landedContinueCallbacks = [];

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

  // Visual effects, feed and panel
  let effects = null;
  let feed = null;
  let panel = null;

  try {
    effects = createLandingEffects({
      scene,
      camera,
      cockpitScene,
      uiRoot: root,
      siteVisual: null,
    });
  } catch (err) {
    console.error('EarthScene part failed: landing effects', err);
  }

  try {
    panel = createLandingPanel({ uiRoot: root });
  } catch (err) {
    console.error('EarthScene part failed: landing panel', err);
  }

  function handleDecisionChoice(choice) {
    isClockFrozen = false;
    divertChosen = choice === 'divert';

    const mission = getMission();
    const site = getSite(mission.landingSite || 'ridge');
    const terrain = site?.terrain || 3;
    const fuelMargin = mission.fuelMargin ?? 20;

    const loadout = typeof getLoadout === 'function' ? getLoadout() : null;
    const summary = summarizeLoadout(loadout ? loadout.totals : null);
    const mobilityRatio = summary.mobility?.ratio ?? 0.5;

    landingOutcome = computeLandingOutcome(choice, terrain, fuelMargin, mobilityRatio);

    setMission({
      landingChoice: landingOutcome.choice,
      landingRisk: landingOutcome.risk,
      landingLevel: landingOutcome.level,
      damage: landingOutcome.damage,
      healthPenalty: (mission.healthPenalty || 0) + landingOutcome.healthPenalty,
      fuelMargin: landingOutcome.fuelAfter,
    });

    const choiceLabel = divertChosen ? 'Divert to flat ground' : 'Continue to the target';
    if (screens) screens.setLogLine(`You chose: ${choiceLabel}`);

    stage = 'final';
  }

  function start() {
    if (running) return;
    running = true;
    tl = 0;
    stage = 'flip';
    isClockFrozen = false;
    divertChosen = false;
    landingOutcome = null;
    hasLandedFired = false;
    hasTouchdownCardFired = false;
    checkSkyFired = false;
    firedMilestones.clear();

    const mission = getMission();
    const site = getSite(mission.landingSite || 'ridge');
    if (effects && site?.visual) {
      effects.setSite(site.visual);
    }

    try {
      feed = createLandingFeed({ siteId: site?.id || 'ridge' });
      if (screens) screens.setLandingFeed(feed);
    } catch (err) {
      console.error('EarthScene part failed: landing feed', err);
    }

    setPhase('landing');
    if (screens) {
      screens.setLogLine('Land here pressed. Starting the landing');
    }
  }

  function reset() {
    running = false;
    stage = 'idle';
    tl = 0;
    isClockFrozen = false;
    divertChosen = false;
    landingOutcome = null;
    hasLandedFired = false;
    hasTouchdownCardFired = false;
    checkSkyFired = false;
    firedMilestones.clear();

    if (panel) panel.close();
    if (effects) effects.reset();
    if (feed) feed.dispose();
    feed = null;

    if (screens) {
      screens.clearLandingMode();
    }
    if (setOutsideView) {
      setOutsideView(ORBIT_VIEW);
    }
  }

  function abort() {
    reset();
  }

  function update(rawDelta) {
    if (isPaused || !running) return;
    const delta = Math.min(0.1, rawDelta);

    if (!isClockFrozen) {
      tl += delta * speedMultiplier;
    }

    const mission = getMission();
    const site = getSite(mission.landingSite || 'ridge');
    const frame = getLandingFrame(tl, mission);
    frame.tl = tl;

    // Milestones check
    for (let i = 0; i < LANDING_MILESTONES.length; i++) {
      const m = LANDING_MILESTONES[i];
      if (tl >= m.t && !firedMilestones.has(i)) {
        firedMilestones.add(i);
        if (screens) screens.setLogLine(m.text);
      }
    }

    // Outside view interpolation during flip
    if (tl <= 8.0) {
      const view = interpolateFlipView(frame.flipProgress);
      if (setOutsideView) setOutsideView(view);
    } else {
      if (setOutsideView) setOutsideView(LANDING_SKY_VIEW);

      // Automated Landing sky view check 1 second after flip ends (tl >= 9)
      if (tl >= 9.0 && !checkSkyFired) {
        checkSkyFired = true;
        if (isDev && typeof window !== 'undefined' && typeof window.__landingSkyPreview === 'function') {
          try {
            console.log('--- AUTO LANDING SKY VIEW CHECK (tl=9) ---');
            window.__landingSkyPreview();
          } catch (e) {
            console.error('Sky check failed:', e);
          }
        }
      }
    }

    if (stage === 'flip' && tl >= 8.0) stage = 'deorbit';
    if (stage === 'deorbit' && tl >= 24.0) stage = 'descent';

    // Pass shake, flame, g to landing effects
    if (effects) {
      effects.setFrame(frame, delta);
    }

    // At tl = 40: Hazard decision trigger
    if (tl >= 40.0 && stage === 'descent') {
      stage = 'decision';
      isClockFrozen = true;
      tl = 40.0;

      const terrain = site?.terrain || 3;
      const fuelMargin = mission.fuelMargin ?? 20;
      const loadout = typeof getLoadout === 'function' ? getLoadout() : null;
      const summary = summarizeLoadout(loadout ? loadout.totals : null);
      const mobilityRatio = summary.mobility?.ratio ?? 0.5;

      const estCont = computeLandingOutcome('continue', terrain, fuelMargin, mobilityRatio);
      const estDiv = computeLandingOutcome('divert', terrain, fuelMargin, mobilityRatio);

      if (panel) {
        panel.openDecision({
          estimates: { continue: estCont, divert: estDiv },
          fuelMargin,
          terrain,
          onChoose: handleDecisionChoice,
        });
      }
    }

    // At tl = 62: Touchdown trigger
    if (tl >= 62.0 && !hasLandedFired) {
      hasLandedFired = true;
      stage = 'touchdown';
      setMission({ landed: true });

      if (floaters?.settle) {
        floaters.settle(4.0);
      }
      if (effects) {
        effects.startGround();
      }
    }

    // At tl = 66: Touchdown card open
    if (tl >= 66.0 && !hasTouchdownCardFired) {
      hasTouchdownCardFired = true;
      stage = 'landed';

      if (panel) {
        panel.openTouchdown({
          outcome: landingOutcome,
          mission,
          site: site || { name: 'Sunny ridge' },
          onContinue: () => {
            if (landedContinueCallbacks.length > 0) {
              for (let i = 0; i < landedContinueCallbacks.length; i++) {
                try { landedContinueCallbacks[i](); } catch (e) { console.error(e); }
              }
            } else {
              const note = document.getElementById('touchdown-next-note');
              if (note) note.style.display = 'block';
            }
          },
        });
      }
    }

    // Update screens
    if (screens) {
      screens.setLandingFrame({
        frame,
        mission,
        stage,
        site,
        siteId: site?.id || 'ridge',
        decisionOpen: isClockFrozen,
        diverted: divertChosen,
        time: tl,
      });
    }

    // Floaters update
    if (floaters?.update) {
      floaters.update(delta, frame, prefersReduced);
    }
  }

  function skipTo(seconds) {
    tl = Math.max(0, Math.min(70, seconds));
    if (tl >= 40.0 && !landingOutcome) {
      const mission = getMission();
      const site = getSite(mission.landingSite || 'ridge');
      landingOutcome = computeLandingOutcome('continue', site?.terrain || 3, mission.fuelMargin ?? 20, 0.5);
    }
    if (tl >= 62.0 && !hasLandedFired) {
      hasLandedFired = true;
      if (floaters?.settle) floaters.settle(1.0);
      if (effects) effects.startGround();
      setMission({ landed: true });
    }
  }

  function jumpToDecision() {
    running = true;
    tl = 40.0;
    stage = 'decision';
    isClockFrozen = true;
    const mission = getMission();
    const site = getSite(mission.landingSite || 'ridge');
    if (setOutsideView) setOutsideView(LANDING_SKY_VIEW);
    const terrain = site?.terrain || 3;
    const fuelMargin = mission.fuelMargin ?? 20;
    const loadout = typeof getLoadout === 'function' ? getLoadout() : null;
    const summary = summarizeLoadout(loadout ? loadout.totals : null);
    const mobilityRatio = summary.mobility?.ratio ?? 0.5;
    const estCont = computeLandingOutcome('continue', terrain, fuelMargin, mobilityRatio);
    const estDiv = computeLandingOutcome('divert', terrain, fuelMargin, mobilityRatio);
    const frame = getLandingFrame(tl, mission);
    frame.tl = tl;
    if (effects) effects.setFrame(frame, 0.016);
    if (screens) {
      screens.setLandingFrame({ frame, mission, stage, site, siteId: site?.id || 'ridge', decisionOpen: true, diverted: false, time: tl });
      screens.setLogLine('Hazard detected! Select landing corridor adjustment.');
    }
    if (panel) {
      panel.openDecision({
        estimates: { continue: estCont, divert: estDiv },
        fuelMargin,
        terrain,
        onChoose: handleDecisionChoice,
      });
    }
  }

  function jumpToTouchdown(landingPreset) {
    running = false;
    tl = 66.0;
    stage = 'landed';
    hasLandedFired = true;
    hasTouchdownCardFired = true;
    if (setOutsideView) setOutsideView(LANDING_SKY_VIEW);
    if (floaters?.settle) floaters.settle(0.1);
    if (effects) effects.startGround();
    const mission = getMission();
    const site = getSite(mission.landingSite || 'ridge');
    const p = landingPreset || { choice: 'continue', risk: 5, level: 'soft', damage: 'none', healthPenalty: 0, fuelCost: 0 };
    landingOutcome = {
      choice: p.choice,
      risk: p.risk,
      level: p.level,
      damage: p.damage,
      healthPenalty: p.healthPenalty,
      fuelCost: p.fuelCost,
      fuelAfter: Math.max(0, (mission.fuelMargin ?? 20) - p.fuelCost),
    };
    mission.landed = true;
    mission.landingChoice = p.choice;
    mission.landingRisk = p.risk;
    mission.landingLevel = p.level;
    mission.damage = p.damage;
    mission.healthPenalty = (mission.healthPenalty || 0) + p.healthPenalty;
    mission.fuelMargin = landingOutcome.fuelAfter;
    setMission(mission);
    const frame = getLandingFrame(tl, mission);
    frame.tl = tl;
    if (screens) {
      screens.setLandingFrame({ frame, mission, stage, site, siteId: site?.id || 'ridge', decisionOpen: false, diverted: p.choice === 'divert', time: tl });
      screens.setLogLine('Touchdown confirmed. Engines shutdown.');
    }
    if (panel) {
      panel.openTouchdown({
        outcome: landingOutcome,
        mission: getMission(),
        site: site || { name: 'Sunny ridge' },
        onContinue: () => {
          if (landedContinueCallbacks.length > 0) {
            for (let i = 0; i < landedContinueCallbacks.length; i++) {
              try { landedContinueCallbacks[i](); } catch (e) { console.error(e); }
            }
          } else {
            const note = document.getElementById('touchdown-next-note');
            if (note) note.style.display = 'block';
          }
        },
      });
    }
  }

  function dispose() {
    reset();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (panel) panel.dispose();
    if (effects) effects.dispose();
    if (feed) feed.dispose();
  }

  return {
    start,
    abort,
    reset,
    update,
    skipTo,
    jumpToDecision,
    jumpToTouchdown,
    isRunning: () => running,
    getStage: () => stage,
    onLandedContinue: (cb) => {
      if (typeof cb === 'function') landedContinueCallbacks.push(cb);
    },
    getRollOffset: () => (effects?.getRollOffset ? effects.getRollOffset() : 0),
    dispose,
  };
}

export default createLandingController;
