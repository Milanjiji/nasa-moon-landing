// ---------------------------------------------------------------------------
// Cockpit Launch Hint Pure Logic (no DOM, no THREE)
// ---------------------------------------------------------------------------

import { indicatorSide } from './earthNav.js';

export function shouldShowLaunchHint(state) {
  if (!state || typeof state !== 'object') {
    return false;
  }

  const { phase, launchRunning, orbitReached, cockpitRunning, anyPanelOpen } = state;

  if (phase !== 'cockpit') {
    return false;
  }
  if (cockpitRunning !== true) {
    return false;
  }
  if (launchRunning !== false) {
    return false;
  }
  if (orbitReached !== false) {
    return false;
  }
  if (anyPanelOpen !== false) {
    return false;
  }

  return true;
}

export function hintTextFor(armed) {
  if (armed) {
    return {
      title: 'Warning on the screen',
      line: 'Press the green button again within 8 seconds to launch anyway.',
    };
  }

  return {
    title: 'Press the green button to launch',
    line: 'It glows on the console in front of you. Click or tap it.',
  };
}

export { indicatorSide };
