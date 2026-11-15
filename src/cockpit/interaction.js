import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Cockpit Controls & Buttons Interaction
// ---------------------------------------------------------------------------
export function createInteraction({ domElement, camera, getTargets, onLaunchPressed, onLog }) {
  if (!domElement || !camera) {
    throw new Error('domElement and camera required for createInteraction');
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let hoveredObj = null;
  let defaultEmissiveIntensity = 0;
  let defaultCursor = domElement.style.cursor || 'default';

  let downX = 0;
  let downY = 0;
  let moved = false;
  let rafId = null;

  // Screen reader polite announcement container
  let srAnnounceEl = document.getElementById('cockpit-sr-announcement');
  if (!srAnnounceEl) {
    srAnnounceEl = document.createElement('div');
    srAnnounceEl.id = 'cockpit-sr-announcement';
    srAnnounceEl.className = 'visually-hidden';
    srAnnounceEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(srAnnounceEl);
  }

  function setAriaSummary(gearSummaryText) {
    if (srAnnounceEl && gearSummaryText) {
      srAnnounceEl.textContent = gearSummaryText;
    }
  }

  function getRaycastHits(clientX, clientY) {
    const rect = domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const targets = typeof getTargets === 'function' ? getTargets() : [];
    return raycaster.intersectObjects(targets, false);
  }

  function resetHover() {
    if (hoveredObj) {
      if (hoveredObj.material && typeof hoveredObj.material.emissiveIntensity === 'number') {
        hoveredObj.material.emissiveIntensity = defaultEmissiveIntensity;
      }
      hoveredObj = null;
      domElement.style.cursor = defaultCursor;
    }
  }

  function onPointerMove(e) {
    if (e.target && e.target.closest && e.target.closest('#settings-btn, #settings-panel, #cockpit-dev-back-btn')) {
      resetHover();
      return;
    }

    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const hits = getRaycastHits(e.clientX, e.clientY);
      if (hits.length > 0) {
        const topHit = hits[0].object;
        if (topHit !== hoveredObj) {
          resetHover();
          hoveredObj = topHit;
          if (hoveredObj.material && typeof hoveredObj.material.emissiveIntensity === 'number') {
            defaultEmissiveIntensity = hoveredObj.userData.defaultEmissiveIntensity ?? hoveredObj.material.emissiveIntensity;
            hoveredObj.material.emissiveIntensity = defaultEmissiveIntensity * 1.6;
          }
          domElement.style.cursor = 'pointer';
        }
      } else {
        resetHover();
      }
    });
  }

  function onPointerDown(e) {
    if (e.target && e.target.closest && e.target.closest('#settings-btn, #settings-panel, #cockpit-dev-back-btn')) {
      return;
    }
    downX = e.clientX;
    downY = e.clientY;
    moved = false;
  }

  function triggerLaunch() {
    if (typeof onLaunchPressed === 'function') {
      onLaunchPressed();
    } else {
      console.log('Launch button pressed');
      if (typeof onLog === 'function') {
        onLog('Launch sequence is not ready yet');
      }
    }
  }

  function handleHitInteraction(hitObj) {
    const kind = hitObj.userData ? hitObj.userData.kind : null;

    if (kind === 'button') {
      // 120 ms press (scale y to 0.5) and flash
      const origScaleY = hitObj.scale.y;
      hitObj.scale.y = origScaleY * 0.5;
      const origIntensity = hitObj.material ? hitObj.material.emissiveIntensity : 0;
      if (hitObj.material) hitObj.material.emissiveIntensity = 2.5;

      setTimeout(() => {
        hitObj.scale.y = origScaleY;
        if (hitObj.material) {
          hitObj.material.emissiveIntensity = (hitObj === hoveredObj) ? origIntensity * 1.6 : origIntensity;
        }
      }, 120);
    } else if (kind === 'toggle') {
      // Flip lever angle by 40 degrees
      const toggled = !hitObj.userData.toggled;
      hitObj.userData.toggled = toggled;
      const angleDelta = (40 * Math.PI) / 180;
      hitObj.rotation.z += (toggled ? 1 : -1) * angleDelta;
    } else if (kind === 'dial') {
      // Rotate indicator by 45 degrees
      hitObj.rotation.y += Math.PI / 4;
    } else if (kind === 'launch') {
      // Stronger press with pulse
      const origScaleY = hitObj.scale.y;
      hitObj.scale.y = origScaleY * 0.3;
      setTimeout(() => {
        hitObj.scale.y = origScaleY;
      }, 200);
      triggerLaunch();
    }
  }

  function onPointerUp(e) {
    if (e.target && e.target.closest && e.target.closest('#settings-btn, #settings-panel, #cockpit-dev-back-btn')) {
      return;
    }
    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (dist >= 6) {
      moved = true;
      return;
    }

    const hits = getRaycastHits(e.clientX, e.clientY);
    if (hits.length > 0) {
      handleHitInteraction(hits[0].object);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      const panel = document.getElementById('settings-panel');
      if (panel && panel.classList.contains('open')) return;
      const cockpitView = document.getElementById('cockpit-view');
      if (cockpitView && cockpitView.classList.contains('hidden')) return;
      if (document.activeElement?.id === 'cockpit-hint-btn' || e.target?.id === 'cockpit-hint-btn') return;

      triggerLaunch();
    }
  }

  domElement.addEventListener('pointermove', onPointerMove, { passive: true });
  domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
  domElement.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('keydown', onKeyDown);

  function dispose() {
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    resetHover();
    if (srAnnounceEl && srAnnounceEl.parentNode) {
      srAnnounceEl.parentNode.removeChild(srAnnounceEl);
    }
  }

  return {
    dispose,
    setAriaSummary,
    triggerLaunch,
  };
}

export default createInteraction;
