// ---------------------------------------------------------------------------
// Board Transition Overlay Animation
// ---------------------------------------------------------------------------

let onBackCallback = null;

export function setOnBackToLaunchSite(cb) {
  onBackCallback = cb;
}

export function playBoardTransition({ onMidpoint, onDone } = {}) {
  try {
    const overlay = document.getElementById('board-transition-overlay');
    const textEl = document.getElementById('board-transition-text');

    if (!overlay || !textEl) {
      if (typeof onMidpoint === 'function') onMidpoint();
      if (typeof onDone === 'function') onDone();
      return;
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fadeToBlackMs = prefersReduced ? 200 : 1200;
    const textInMs = prefersReduced ? 100 : 600;
    const holdMs = prefersReduced ? 0 : 1600;
    const textOutMs = prefersReduced ? 100 : 400;
    const fadeOutMs = prefersReduced ? 200 : 1000;

    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.style.transition = `opacity ${fadeToBlackMs}ms ease`;
    overlay.style.opacity = '1';

    setTimeout(() => {
      // Screen is black. Fade in "Mission begins"
      textEl.style.transition = `opacity ${textInMs}ms ease`;
      textEl.style.opacity = '1';

      setTimeout(() => {
        // While still black, call onMidpoint
        if (typeof onMidpoint === 'function') {
          try {
            onMidpoint();
          } catch (midErr) {
            console.error('onMidpoint execution failed:', midErr);
          }
        }

        // Fade text out
        textEl.style.transition = `opacity ${textOutMs}ms ease`;
        textEl.style.opacity = '0';

        setTimeout(() => {
          // Fade black overlay out onto cockpit
          overlay.style.transition = `opacity ${fadeOutMs}ms ease`;
          overlay.style.opacity = '0';

          setTimeout(() => {
            overlay.classList.add('hidden');
            if (typeof onDone === 'function') {
              try {
                onDone();
              } catch (doneErr) {
                console.error('onDone execution failed:', doneErr);
              }
            }
          }, fadeOutMs);
        }, textOutMs);
      }, textInMs + holdMs);
    }, fadeToBlackMs);
  } catch (error) {
    console.error('EarthScene part failed: boardTransition', error);
    if (typeof onMidpoint === 'function') {
      try {
        onMidpoint();
      } catch { /* ignore */ }
    }
    if (typeof onDone === 'function') {
      try {
        onDone();
      } catch { /* ignore */ }
    }
  }
}

// Dev button back to launch site listener
function initDevBackEvent() {
  const devBackBtn = document.getElementById('cockpit-dev-back-btn');
  if (devBackBtn) {
    devBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      /* TEMPORARY: dev button to return to launch site */
      if (typeof onBackCallback === 'function') {
        onBackCallback();
      }
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDevBackEvent);
  } else {
    initDevBackEvent();
  }
}

export default {
  playBoardTransition,
  setOnBackToLaunchSite,
};
