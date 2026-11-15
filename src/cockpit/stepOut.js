import { setPhase, getMission, setMission, getLoadout } from '../game/state.js';
import { getSite } from '../data/sites.js';
import { getSurfaceStart } from '../game/surfaceStats.js';

export function playStepOut({ onMidpoint, onDone } = {}) {
  try {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    // Create full-screen black overlay
    const overlay = document.createElement('div');
    overlay.id = 'step-out-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:#02040a;z-index:105;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity ' + (prefersReduced ? '0.2s' : '1.0s') + ' ease;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#e8f3ff;';

    const lineContainer = document.createElement('div');
    lineContainer.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:18px;min-height:120px;';
    overlay.appendChild(lineContainer);

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    const fadeInTime = prefersReduced ? 200 : 1000;

    function fallbackError() {
      const touchdownDialog = document.getElementById('landing-touchdown-dialog');
      if (touchdownDialog) {
        touchdownDialog.style.display = 'block';
        touchdownDialog.style.opacity = '1';
        const note = document.getElementById('touchdown-next-note');
        if (note) {
          note.textContent = 'Stepping out is unavailable.';
          note.style.display = 'block';
        }
      }
    }

    function executeMidpoint() {
      try {
        setPhase('surface');
        const mission = getMission();
        const loadout = typeof getLoadout === 'function' ? getLoadout() : null;
        const site = getSite(mission.landingSite || 'ridge');
        const stats = getSurfaceStart(mission, loadout, site);

        mission.surface = {
          steppedOut: true,
          sawEarth: false,
          photoTaken: false,
          stats,
        };
        setMission(mission);

        // Hide cockpit view canvas without disposing or resetting
        const cockpitCanvas = document.querySelector('.cockpit-canvas');
        if (cockpitCanvas) {
          cockpitCanvas.style.display = 'none';
        }
        if (typeof window !== 'undefined' && window.cockpitScene?.stop) {
          window.cockpitScene.stop();
        }

        // Hide landing dialogs & panels
        const touchdownDialog = document.getElementById('landing-touchdown-dialog');
        if (touchdownDialog) {
          touchdownDialog.style.display = 'none';
          touchdownDialog.style.opacity = '0';
        }
        const hazardDialog = document.getElementById('landing-decision-dialog');
        if (hazardDialog) {
          hazardDialog.style.display = 'none';
        }

        // Hide landing overlays (RCS, glow, dust, ground strip)
        const dustCanvas = document.getElementById('landing-dust-canvas');
        if (dustCanvas) dustCanvas.style.display = 'none';
        const glowOverlay = document.getElementById('landing-glow-overlay');
        if (glowOverlay) glowOverlay.style.display = 'none';

        // Start surface scene & show HUD
        const surfaceContainer = document.getElementById('surface-view');
        if (surfaceContainer) {
          surfaceContainer.classList.remove('hidden');
          surfaceContainer.style.display = 'block';
        }

        if (typeof window !== 'undefined' && window.surfaceScene) {
          window.surfaceScene.start({ site, stats, skipLadder: false });
        }
        if (typeof window !== 'undefined' && window.surfaceHud) {
          window.surfaceHud.show(stats, site);
        }

        if (typeof onMidpoint === 'function') {
          onMidpoint();
        }
      } catch (err) {
        console.error('EarthScene part failed: stepOut midpoint', err);
        fallbackError();
      }
    }

    if (prefersReduced) {
      setTimeout(() => {
        executeMidpoint();
        setTimeout(() => {
          overlay.style.opacity = '0';
          setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (typeof onDone === 'function') onDone();
          }, 200);
        }, 300);
      }, fadeInTime);
      return;
    }

    const lines = [
      'Suit sealed',
      'Cabin depressurizing',
      'Hatch opening',
    ];

    setTimeout(() => {
      let currentLineIdx = 0;

      function showNextLine() {
        if (currentLineIdx < lines.length) {
          const text = lines[currentLineIdx];
          const lineEl = document.createElement('div');
          lineEl.textContent = text;
          lineEl.style.cssText = 'font-size:1.3rem;font-weight:600;color:#9fd8ff;opacity:0;transition:opacity 0.4s ease;letter-spacing:0.5px;';
          lineContainer.appendChild(lineEl);

          requestAnimationFrame(() => {
            lineEl.style.opacity = '1';
          });

          currentLineIdx++;
          setTimeout(() => {
            showNextLine();
          }, 1200);
        } else {
          // Midpoint reached: all lines shown
          setTimeout(() => {
            executeMidpoint();

            setTimeout(() => {
              overlay.style.opacity = '0';
              setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (typeof onDone === 'function') onDone();
              }, 1000);
            }, 600);
          }, 400);
        }
      }

      showNextLine();
    }, fadeInTime);

  } catch (error) {
    console.error('EarthScene part failed: stepOut', error);
    const touchdownDialog = document.getElementById('landing-touchdown-dialog');
    if (touchdownDialog) {
      touchdownDialog.style.display = 'block';
      touchdownDialog.style.opacity = '1';
      const note = document.getElementById('touchdown-next-note');
      if (note) {
        note.textContent = 'Stepping out is unavailable.';
        note.style.display = 'block';
      }
    }
  }
}

export default playStepOut;
