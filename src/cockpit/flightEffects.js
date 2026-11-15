// ---------------------------------------------------------------------------
// Cockpit Flight Visual Effects (Burns, Solar Storm Alert, Streaming Particles)
// ---------------------------------------------------------------------------

import * as THREE from 'three';

function checkFinite(geometry, name) {
  if (!geometry?.attributes?.position) return;
  const arr = geometry.attributes.position.array;
  for (let i = 0; i < arr.length; i += 3) {
    if (!isFinite(arr[i]) || !isFinite(arr[i + 1]) || !isFinite(arr[i + 2])) {
      console.warn(`NaN/Inf in geometry "${name}" at vertex ${i / 3}`);
      return;
    }
  }
}

export function createFlightEffects({ scene, camera, cabinLights = [], outsideRig, uiRoot }) {
  const root = uiRoot || (typeof document !== 'undefined' ? document.body : null);

  let stormRedLight = null;
  let flareSprite = null;
  let streamPoints = null;
  let streamGeo = null;
  let streamPositions = null;
  let streamVelocities = null;
  const STREAM_COUNT = 300;

  let vignetteElem = null;
  let alertBanner = null;

  // 1. Red Storm Cabin Light
  try {
    stormRedLight = new THREE.PointLight(0xff2222, 0, 5.0, 1.8);
    stormRedLight.position.set(0, 1.6, -0.6);
    stormRedLight.name = 'storm-red-light';
    scene.add(stormRedLight);
  } catch (err) {
    console.error('EarthScene part failed: flight storm light', err);
  }

  // 2. Solar Flare Outside Sprite
  try {
    if (typeof document !== 'undefined') {
      const flareCanvas = document.createElement('canvas');
      flareCanvas.width = 256;
      flareCanvas.height = 256;
      const fctx = flareCanvas.getContext('2d');
      const grad = fctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255, 230, 180, 0.85)');
      grad.addColorStop(0.3, 'rgba(255, 120, 50, 0.5)');
      grad.addColorStop(0.7, 'rgba(255, 40, 20, 0.15)');
      grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
      fctx.fillStyle = grad;
      fctx.fillRect(0, 0, 256, 256);

      const flareTexture = new THREE.CanvasTexture(flareCanvas);
      const flareMat = new THREE.SpriteMaterial({
        map: flareTexture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      flareSprite = new THREE.Sprite(flareMat);
      flareSprite.scale.set(1600, 1600, 1);
      flareSprite.position.set(1800, 1800, -2500);
      flareSprite.layers.set(1);
      if (outsideRig) outsideRig.add(flareSprite);
    }
  } catch (err) {
    console.error('EarthScene part failed: flight solar flare', err);
  }

  // 3. Streaming Particles (Velocity Streaks)
  try {
    streamGeo = new THREE.BufferGeometry();
    streamPositions = new Float32Array(STREAM_COUNT * 3);
    streamVelocities = new Float32Array(STREAM_COUNT);
    const streamColors = new Float32Array(STREAM_COUNT * 3);

    for (let i = 0; i < STREAM_COUNT; i++) {
      streamPositions[i * 3] = (Math.random() - 0.5) * 8.0;
      streamPositions[i * 3 + 1] = 0.5 + Math.random() * 3.5;
      streamPositions[i * 3 + 2] = -2.0 - Math.random() * 24.0;
      streamVelocities[i] = 12.0 + Math.random() * 28.0;

      streamColors[i * 3] = 0.85;
      streamColors[i * 3 + 1] = 0.92;
      streamColors[i * 3 + 2] = 1.0;
    }

    streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
    streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));
    checkFinite(streamGeo, 'flight-streaming-particles');

    const streamMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });
    streamPoints = new THREE.Points(streamGeo, streamMat);
    streamPoints.frustumCulled = false;
    scene.add(streamPoints);
  } catch (err) {
    console.error('EarthScene part failed: flight streaming particles', err);
  }

  // 4. Red Edge Vignette DOM Element
  try {
    if (root && typeof document !== 'undefined') {
      vignetteElem = document.createElement('div');
      vignetteElem.id = 'flight-storm-vignette';
      vignetteElem.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:45;opacity:0;transition:opacity 0.4s ease;box-shadow:inset 0 0 120px 40px rgba(220, 38, 38, 0.45);';
      root.appendChild(vignetteElem);

      alertBanner = document.createElement('div');
      alertBanner.id = 'flight-storm-banner';
      alertBanner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(185,28,28,0.85);border:1px solid #ef4444;color:#fee2e2;padding:6px 20px;border-radius:20px;font-family:\'Space Grotesk\',sans-serif;font-size:0.95rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;z-index:55;opacity:0;transition:opacity 0.3s;pointer-events:none;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
      alertBanner.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#fca5a5;"></span> SOLAR STORM ALERT';
      root.appendChild(alertBanner);
    }
  } catch (err) {
    console.error('EarthScene part failed: flight storm vignette', err);
  }

  let stormPulseTime = 0;
  let isStormAlertActive = false;

  function setStormAlert(active) {
    isStormAlertActive = Boolean(active);
    if (!isStormAlertActive) {
      if (stormRedLight) stormRedLight.intensity = 0;
      if (flareSprite) flareSprite.material.opacity = 0;
      if (vignetteElem) vignetteElem.style.opacity = '0';
      if (alertBanner) alertBanner.style.opacity = '0';
    }
  }

  function update(delta, frame, stormFrame) {
    // 1. Streaming particles during thrust or storm
    try {
      if (streamPoints && streamPositions) {
        const thrust = frame?.thrust || 0;
        const isStorm = Boolean(isStormAlertActive);
        const active = thrust > 0.1 || isStorm;

        const targetOpacity = isStorm ? 0.85 : (thrust > 0.1 ? 0.75 : 0);
        streamPoints.material.opacity += (targetOpacity - streamPoints.material.opacity) * Math.min(1, delta * 6);

        if (streamPoints.material.opacity > 0.02) {
          const speedFactor = isStorm ? 1.8 : (thrust > 0.1 ? 1.4 : 0.4);
          for (let i = 0; i < STREAM_COUNT; i++) {
            streamPositions[i * 3 + 2] += streamVelocities[i] * speedFactor * delta;
            if (streamPositions[i * 3 + 2] > 1.0) {
              streamPositions[i * 3 + 2] = -24.0;
              streamPositions[i * 3] = (Math.random() - 0.5) * 8.0;
              streamPositions[i * 3 + 1] = 0.5 + Math.random() * 3.5;
            }
          }
          streamGeo.attributes.position.needsUpdate = true;
        }
      }
    } catch (err) {
      console.error('EarthScene part failed: flight particle update', err);
    }

    // 2. Storm Pulsing Effects
    try {
      if (isStormAlertActive) {
        stormPulseTime += delta;
        const pulse = 0.5 + 0.5 * Math.sin(stormPulseTime * 5.0);
        const glitchMod = stormFrame ? stormFrame.glitch * 0.4 : 0;
        const intensity = Math.min(1.8, (0.8 + 0.8 * pulse + glitchMod));

        if (stormRedLight) {
          stormRedLight.intensity = intensity;
        }
        if (flareSprite) {
          flareSprite.material.opacity = 0.35 + 0.35 * pulse;
        }
        if (vignetteElem) {
          vignetteElem.style.opacity = (0.5 + 0.4 * pulse).toFixed(2);
        }
        if (alertBanner) {
          alertBanner.style.opacity = '1';
        }
      } else {
        if (stormRedLight && stormRedLight.intensity > 0) {
          stormRedLight.intensity = Math.max(0, stormRedLight.intensity - delta * 3);
        }
        if (flareSprite && flareSprite.material.opacity > 0) {
          flareSprite.material.opacity = Math.max(0, flareSprite.material.opacity - delta * 3);
        }
      }
    } catch (err) {
      console.error('EarthScene part failed: flight storm update', err);
    }
  }

  function reset() {
    setStormAlert(false);
    stormPulseTime = 0;
    if (streamPoints) streamPoints.material.opacity = 0;
  }

  function dispose() {
    reset();
    try {
      if (stormRedLight) scene.remove(stormRedLight);
      if (flareSprite && outsideRig) outsideRig.remove(flareSprite);
      if (streamPoints) scene.remove(streamPoints);
      if (vignetteElem?.parentNode) vignetteElem.parentNode.removeChild(vignetteElem);
      if (alertBanner?.parentNode) alertBanner.parentNode.removeChild(alertBanner);
    } catch (err) {
      console.error('EarthScene part failed: flight effects dispose', err);
    }
  }

  return {
    update,
    setStormAlert,
    reset,
    dispose,
  };
}

export default createFlightEffects;
