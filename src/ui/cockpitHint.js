// ---------------------------------------------------------------------------
// Cockpit Launch Hint UI Component
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { hintTextFor, indicatorSide } from '../game/hintLogic.js';

export function createCockpitHint({ uiRoot, getLaunchWorldPosition, camera, onStartLaunch, isTouch = false, launchButtonMesh = null }) {
  const root = uiRoot || (typeof document !== 'undefined' ? document.body : null);
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let isVisible = false;
  let isArmedState = false;
  let hasAnnounced = false;
  let shrinkTimer = null;

  let cardEl = null, cardTitleEl = null, cardLineEl = null, startBtnEl = null;
  let markerEl = null, ringEl = null, ringPillEl = null, edgePillEl = null, announcerEl = null;

  const tmpWorldPos = new THREE.Vector3();
  const tmpProjected = new THREE.Vector3();
  const tmpLocal = new THREE.Vector3();

  // 1. Announcer element (visually hidden, aria-live)
  try {
    announcerEl = document.createElement('div');
    announcerEl.id = 'cockpit-hint-announcer';
    announcerEl.className = 'visually-hidden';
    announcerEl.setAttribute('aria-live', 'polite');
    announcerEl.setAttribute('aria-atomic', 'true');
    if (root) root.appendChild(announcerEl);
  } catch (error) {
    console.error('EarthScene part failed: cockpitHint announcer', error);
  }

  // 2. Card element
  try {
    cardEl = document.createElement('div');
    cardEl.id = 'cockpit-hint';
    cardEl.setAttribute('role', 'region');
    cardEl.setAttribute('aria-label', 'Launch hint');
    cardEl.style.display = 'none';

    cardTitleEl = document.createElement('h2');
    cardTitleEl.className = 'cockpit-hint-title';
    cardLineEl = document.createElement('p');
    cardLineEl.className = 'cockpit-hint-desc';

    const text = hintTextFor(false);
    cardTitleEl.textContent = text.title;
    cardLineEl.textContent = text.line;

    startBtnEl = document.createElement('button');
    startBtnEl.id = 'cockpit-hint-btn';
    startBtnEl.type = 'button';
    startBtnEl.textContent = 'Start the launch';

    const keycap = document.createElement('kbd');
    keycap.className = 'keycap';
    keycap.textContent = 'Enter';
    if (isTouch) keycap.style.display = 'none';
    startBtnEl.appendChild(keycap);

    startBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onStartLaunch === 'function') onStartLaunch();
    });

    cardEl.appendChild(cardTitleEl);
    cardEl.appendChild(cardLineEl);
    cardEl.appendChild(startBtnEl);
    if (root) root.appendChild(cardEl);
  } catch (error) {
    console.error('EarthScene part failed: cockpitHint card', error);
  }

  // 3. Marker elements
  try {
    markerEl = document.createElement('div');
    markerEl.id = 'cockpit-launch-marker';
    markerEl.setAttribute('aria-hidden', 'true');
    markerEl.style.display = 'none';

    ringEl = document.createElement('div');
    ringEl.className = 'cockpit-launch-ring';
    ringPillEl = document.createElement('div');
    ringPillEl.className = 'cockpit-launch-pill';
    ringPillEl.textContent = 'Launch';
    edgePillEl = document.createElement('div');
    edgePillEl.className = 'cockpit-launch-edge-pill';

    markerEl.appendChild(ringEl);
    markerEl.appendChild(ringPillEl);
    markerEl.appendChild(edgePillEl);
    if (root) root.appendChild(markerEl);
  } catch (error) {
    console.error('EarthScene part failed: cockpitHint marker', error);
  }

  function resetShrinkTimer() {
    if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }
    if (!isVisible || isArmedState) return;
    shrinkTimer = setTimeout(() => {
      if (cardEl && isVisible && !isArmedState) cardEl.classList.add('shrunk');
    }, 20000);
  }

  const onUserInteraction = () => {
    if (cardEl && cardEl.classList.contains('shrunk')) cardEl.classList.remove('shrunk');
    resetShrinkTimer();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onUserInteraction);
    window.addEventListener('pointerdown', onUserInteraction);
    window.addEventListener('pointermove', onUserInteraction);
  }

  function show() {
    if (isVisible) return;
    isVisible = true;

    if (launchButtonMesh?.userData) launchButtonMesh.userData.pulseMultiplier = 1.3;

    if (cardEl) {
      cardEl.style.display = 'block';
      cardEl.classList.remove('fade-out', 'shrunk');
      requestAnimationFrame(() => { if (cardEl && isVisible) cardEl.style.opacity = '1'; });
      resetShrinkTimer();
    }
    if (markerEl) markerEl.style.display = 'block';

    if (!hasAnnounced && announcerEl) {
      hasAnnounced = true;
      announcerEl.textContent = 'Press the green button on the console, or the Start the launch button, to launch.';
    }
  }

  function hide() {
    if (!isVisible) return;
    isVisible = false;

    if (launchButtonMesh?.userData) launchButtonMesh.userData.pulseMultiplier = 1.0;
    if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }

    if (cardEl) {
      cardEl.classList.add('fade-out');
      if (prefersReduced) {
        cardEl.style.display = 'none';
        cardEl.style.opacity = '0';
      } else {
        setTimeout(() => {
          if (cardEl && !isVisible) {
            cardEl.style.display = 'none';
            cardEl.style.opacity = '0';
          }
        }, 500);
      }
    }
    if (markerEl) markerEl.style.display = 'none';
  }

  function setArmed(armed) {
    isArmedState = Boolean(armed);
    const text = hintTextFor(isArmedState);
    if (cardTitleEl) cardTitleEl.textContent = text.title;
    if (cardLineEl) cardLineEl.textContent = text.line;
    if (isArmedState && cardEl) cardEl.classList.remove('shrunk');
    resetShrinkTimer();
  }

  function update() {
    if (!isVisible || !markerEl || !camera) return;

    let worldPos = null;
    if (typeof getLaunchWorldPosition === 'function') {
      worldPos = getLaunchWorldPosition();
    } else if (launchButtonMesh && typeof launchButtonMesh.getWorldPosition === 'function') {
      launchButtonMesh.getWorldPosition(tmpWorldPos);
      worldPos = tmpWorldPos;
    }
    if (!worldPos) return;

    tmpProjected.set(worldPos.x, worldPos.y + 0.08, worldPos.z);
    tmpProjected.project(camera);

    const inView = tmpProjected.z >= -1 && tmpProjected.z <= 1 && Math.abs(tmpProjected.x) < 0.92 && Math.abs(tmpProjected.y) < 0.92;

    if (inView) {
      const screenX = (tmpProjected.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-tmpProjected.y * 0.5 + 0.5) * window.innerHeight;

      if (ringEl) {
        ringEl.style.display = 'block';
        ringEl.style.left = `${screenX}px`;
        ringEl.style.top = `${screenY}px`;
      }
      if (ringPillEl) {
        ringPillEl.style.display = 'block';
        ringPillEl.style.left = `${screenX}px`;
        ringPillEl.style.top = `${screenY}px`;
      }
      if (edgePillEl) edgePillEl.style.display = 'none';
    } else {
      if (ringEl) ringEl.style.display = 'none';
      if (ringPillEl) ringPillEl.style.display = 'none';

      if (edgePillEl) {
        edgePillEl.style.display = 'flex';
        tmpLocal.set(worldPos.x, worldPos.y + 0.08, worldPos.z);
        camera.worldToLocal(tmpLocal);

        const side = indicatorSide(tmpLocal.x, tmpLocal.z, tmpProjected.x, tmpProjected.y);
        if (side === 'right') {
          edgePillEl.className = 'cockpit-launch-edge-pill side-right';
          edgePillEl.innerHTML = '<span class="edge-text">Launch button</span> <span class="edge-arrow">&rarr;</span>';
        } else {
          edgePillEl.className = 'cockpit-launch-edge-pill side-left';
          edgePillEl.innerHTML = '<span class="edge-arrow">&larr;</span> <span class="edge-text">Launch button</span>';
        }
      }
    }
  }

  function resetSessionAnnouncement() {
    hasAnnounced = false;
  }

  function dispose() {
    hide();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', onUserInteraction);
      window.removeEventListener('pointerdown', onUserInteraction);
      window.removeEventListener('pointermove', onUserInteraction);
    }
    if (cardEl?.parentNode) cardEl.parentNode.removeChild(cardEl);
    if (markerEl?.parentNode) markerEl.parentNode.removeChild(markerEl);
    if (announcerEl?.parentNode) announcerEl.parentNode.removeChild(announcerEl);
  }

  return { show, hide, update, setArmed, resetSessionAnnouncement, dispose };
}
