// ---------------------------------------------------------------------------
// Earth Scene HUD: Launch Hint, Direction Pointer, Announcements, Captions
// ---------------------------------------------------------------------------

import { indicatorSide } from '../game/earthNav.js';

export function createEarthHud({ onTravel, getCamera, getPadCenter, isLocationStart, isPhaseEarth }) {
  let hintCard = null;
  let hintBtn = null;
  let pointerEl = null;
  let announcerEl = null;
  let captionEl = null;
  let captionTimer = null;
  let shrinkTimer = null;
  let hasAnnounced = false;
  let isHintDismissed = false;

  const isTouch = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  // 1. Announcer element (visually hidden, aria-live)
  try {
    announcerEl = document.createElement('div');
    announcerEl.id = 'earth-announcer';
    announcerEl.className = 'visually-hidden';
    announcerEl.setAttribute('aria-live', 'polite');
    announcerEl.setAttribute('aria-atomic', 'true');
    document.body.appendChild(announcerEl);
  } catch (error) {
    console.error('EarthScene part failed: earthNav announcer', error);
  }

  // 2. Start hint card
  try {
    hintCard = document.createElement('div');
    hintCard.id = 'launch-hint';
    hintCard.style.display = 'none';

    const title = document.createElement('h2');
    title.className = 'hint-title';
    title.textContent = 'Your rocket is waiting at the launch site';

    const desc = document.createElement('p');
    desc.className = 'hint-desc';
    desc.textContent = isTouch ? 'Drag to look around.' : 'Drag to look around. Walk with W, A, S and D.';

    hintBtn = document.createElement('button');
    hintBtn.id = 'launch-hint-btn';
    hintBtn.type = 'button';
    hintBtn.textContent = 'Go to the launch site';

    const keycap = document.createElement('kbd');
    keycap.className = 'keycap';
    keycap.textContent = 'R';
    if (isTouch) {
      keycap.style.display = 'none';
    }
    hintBtn.appendChild(keycap);

    hintBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onTravel === 'function') {
        onTravel();
      }
    });

    hintCard.appendChild(title);
    hintCard.appendChild(desc);
    hintCard.appendChild(hintBtn);
    document.body.appendChild(hintCard);
  } catch (error) {
    console.error('EarthScene part failed: earthNav hintCard', error);
  }

  // 3. Launch site pointer
  try {
    pointerEl = document.createElement('button');
    pointerEl.id = 'launch-pointer';
    pointerEl.type = 'button';
    pointerEl.setAttribute('aria-hidden', 'true');
    pointerEl.tabIndex = -1;
    pointerEl.style.display = 'none';

    pointerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onTravel === 'function') {
        onTravel();
      }
    });

    document.body.appendChild(pointerEl);
  } catch (error) {
    console.error('EarthScene part failed: earthNav pointer', error);
  }

  // 4. Caption element
  try {
    captionEl = document.createElement('div');
    captionEl.id = 'earth-caption';
    captionEl.setAttribute('aria-live', 'polite');
    captionEl.style.display = 'none';
    document.body.appendChild(captionEl);
  } catch (error) {
    console.error('EarthScene part failed: earthNav caption', error);
  }

  function resetShrinkTimer() {
    if (shrinkTimer) {
      clearTimeout(shrinkTimer);
      shrinkTimer = null;
    }
    if (isHintDismissed || !hintCard || hintCard.style.display === 'none') {
      return;
    }
    shrinkTimer = setTimeout(() => {
      if (hintCard && !isHintDismissed) {
        hintCard.classList.add('shrunk');
      }
    }, 15000);
  }

  const userInteractionHandler = () => {
    if (hintCard && hintCard.classList.contains('shrunk')) {
      hintCard.classList.remove('shrunk');
    }
    resetShrinkTimer();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', userInteractionHandler);
    window.addEventListener('pointerdown', userInteractionHandler);
  }

  function showHintCard() {
    if (isHintDismissed || !hintCard) {
      return;
    }
    if (hintCard.style.display === 'none') {
      hintCard.style.display = 'block';
      hintCard.classList.remove('fade-out');
      hintCard.classList.remove('shrunk');
      resetShrinkTimer();

      if (!hasAnnounced && announcerEl) {
        hasAnnounced = true;
        announcerEl.textContent = 'Use the Go to the launch site button, or press R, to reach your rocket.';
      }
    }
  }

  function hideHintCard() {
    isHintDismissed = true;
    if (shrinkTimer) {
      clearTimeout(shrinkTimer);
      shrinkTimer = null;
    }
    if (hintCard) {
      hintCard.classList.add('fade-out');
      setTimeout(() => {
        if (hintCard) {
          hintCard.style.display = 'none';
        }
      }, 400);
    }
    if (pointerEl) {
      pointerEl.style.display = 'none';
    }
  }

  function onTravelStart() {
    hideHintCard();
  }

  function showCaption(text) {
    if (!captionEl) {
      return;
    }
    if (captionTimer) {
      clearTimeout(captionTimer);
    }
    captionEl.textContent = text;
    captionEl.style.display = 'block';
    requestAnimationFrame(() => {
      if (captionEl) {
        captionEl.style.opacity = '1';
      }
    });
    captionTimer = setTimeout(() => {
      if (captionEl) {
        captionEl.style.opacity = '0';
        setTimeout(() => {
          if (captionEl) {
            captionEl.style.display = 'none';
          }
        }, 400);
      }
    }, 5000);
  }

  function update(cam, padCenter) {
    if (isHintDismissed) {
      if (pointerEl) {
        pointerEl.style.display = 'none';
      }
      return;
    }

    const startLoc = typeof isLocationStart === 'function' ? isLocationStart() : true;
    const earthPhase = typeof isPhaseEarth === 'function' ? isPhaseEarth() : true;

    if (!startLoc || !earthPhase) {
      if (hintCard && hintCard.style.display !== 'none') {
        hideHintCard();
      }
      if (pointerEl) {
        pointerEl.style.display = 'none';
      }
      return;
    }

    // Check pointer indicator
    if (!pointerEl || !cam || !padCenter) {
      return;
    }

    const targetPos = padCenter.clone ? padCenter.clone() : { x: padCenter.x, y: padCenter.y, z: padCenter.z };
    targetPos.y += 12;

    const local = cam.worldToLocal(targetPos.clone ? targetPos.clone() : targetPos);
    const ndc = targetPos.clone ? targetPos.clone().project(cam) : targetPos;

    const side = indicatorSide(local.x, local.z, ndc.x, ndc.y);

    if (side === 'none') {
      pointerEl.style.display = 'none';
    } else if (side === 'left') {
      pointerEl.style.display = 'flex';
      pointerEl.className = 'side-left';
      pointerEl.innerHTML = '<span class="pointer-arrow">&larr;</span><span class="pointer-text">Launch site</span>';
    } else {
      pointerEl.style.display = 'flex';
      pointerEl.className = 'side-right';
      pointerEl.innerHTML = '<span class="pointer-text">Launch site</span><span class="pointer-arrow">&rarr;</span>';
    }
  }

  function destroy() {
    if (shrinkTimer) {
      clearTimeout(shrinkTimer);
    }
    if (captionTimer) {
      clearTimeout(captionTimer);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', userInteractionHandler);
      window.removeEventListener('pointerdown', userInteractionHandler);
    }
    if (hintCard && hintCard.parentNode) {
      hintCard.parentNode.removeChild(hintCard);
    }
    if (pointerEl && pointerEl.parentNode) {
      pointerEl.parentNode.removeChild(pointerEl);
    }
    if (announcerEl && announcerEl.parentNode) {
      announcerEl.parentNode.removeChild(announcerEl);
    }
    if (captionEl && captionEl.parentNode) {
      captionEl.parentNode.removeChild(captionEl);
    }
  }

  return {
    showHintCard,
    hideHintCard,
    onTravelStart,
    showCaption,
    update,
    destroy,
  };
}
