// ---------------------------------------------------------------------------
// Cockpit Landing Visual Effects (RCS Puffs, Dust, Engine Glow, Ground Strip)
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

export function createLandingEffects({ scene, camera, cockpitScene, uiRoot, siteVisual = null }) {
  const root = uiRoot || (typeof document !== 'undefined' ? document.body : null);

  let currentSiteVisual = siteVisual || {
    groundColor: '#b9bcc4',
    sunStrength: 1.0,
    skyTint: '#000000',
    featureHint: 'ridge',
  };

  // 1. RCS Puffs DOM elements
  let rcsContainer = null;
  const activePuffs = [];
  const firedRcsTimes = new Set();
  const RCS_TIMESTAMPS = [0.3, 1.0, 2.5, 5.5, 6.5, 7.5];

  try {
    if (root && typeof document !== 'undefined') {
      rcsContainer = document.createElement('div');
      rcsContainer.id = 'landing-rcs-container';
      rcsContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:35;overflow:hidden;';
      root.appendChild(rcsContainer);
    }
  } catch (err) {
    console.error('EarthScene part failed: landing rcs container', err);
  }

  function triggerPuff(isUpperLeft) {
    if (!rcsContainer || typeof document === 'undefined') return;
    try {
      const puff = document.createElement('div');
      const startX = isUpperLeft ? '15%' : '85%';
      const startY = isUpperLeft ? '20%' : '75%';
      puff.style.cssText = `position:absolute;left:${startX};top:${startY};width:40px;height:40px;transform:translate(-50%,-50%) scale(1);border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(220,235,255,0.4) 45%, rgba(255,255,255,0) 70%);opacity:0.9;transition:transform 0.45s ease-out, opacity 0.45s ease-out;pointer-events:none;`;
      rcsContainer.appendChild(puff);

      requestAnimationFrame(() => {
        puff.style.transform = 'translate(-50%,-50%) scale(1.6)';
        puff.style.opacity = '0';
      });

      setTimeout(() => {
        if (puff.parentNode) puff.parentNode.removeChild(puff);
      }, 480);
    } catch (err) {
      console.error('EarthScene part failed: landing rcs puff', err);
    }
  }

  // 2. Engine Glow Overlay and G Vignette
  let glowOverlay = null;
  let gVignette = null;
  try {
    if (root && typeof document !== 'undefined') {
      glowOverlay = document.createElement('div');
      glowOverlay.id = 'landing-engine-glow';
      glowOverlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;opacity:0;transition:opacity 0.1s linear;box-shadow:inset 0 -80px 140px rgba(255, 120, 30, 0.4), inset 0 0 80px rgba(255, 160, 60, 0.2);';
      root.appendChild(glowOverlay);

      gVignette = document.createElement('div');
      gVignette.id = 'landing-g-vignette';
      gVignette.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:32;opacity:0;box-shadow:inset 0 0 100px rgba(0, 0, 0, 0.7);';
      root.appendChild(gVignette);
    }
  } catch (err) {
    console.error('EarthScene part failed: landing overlays', err);
  }

  // 3. Lunar Dust Canvas
  let dustCanvas = null;
  let dustCtx = null;
  const DUST_PARTICLES = 120;
  const dustList = [];
  try {
    if (root && typeof document !== 'undefined') {
      dustCanvas = document.createElement('canvas');
      dustCanvas.id = 'landing-dust-canvas';
      dustCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:34;opacity:0;';
      dustCtx = dustCanvas.getContext('2d');
      root.appendChild(dustCanvas);

      for (let i = 0; i < DUST_PARTICLES; i++) {
        dustList.push({
          x: Math.random(),
          y: 0.7 + Math.random() * 0.3,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -0.15 - Math.random() * 0.35,
          size: 4 + Math.random() * 10,
          alpha: 0.2 + Math.random() * 0.6,
        });
      }
    }
  } catch (err) {
    console.error('EarthScene part failed: landing dust canvas', err);
  }

  // 4. Lunar Ground Strip at Touchdown
  let groundGroup = null;
  let groundDiscMat = null;
  let groundDisc = null;
  let craterSilhouette = null;
  let groundFade = 0;
  let isGroundActive = false;

  try {
    groundGroup = new THREE.Group();
    groundGroup.name = 'landing-ground-group';
    groundGroup.visible = false;

    const gCanvas = document.createElement('canvas');
    gCanvas.width = 256;
    gCanvas.height = 256;
    const gctx = gCanvas.getContext('2d');

    // Base tone from site visual
    gctx.fillStyle = currentSiteVisual.groundColor || '#b9bcc4';
    gctx.fillRect(0, 0, 256, 256);

    // Fine surface noise
    for (let i = 0; i < 200; i++) {
      gctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
      gctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }

    // Small craters with dark center and light rim
    for (let i = 0; i < 35; i++) {
      const cx = Math.random() * 256, cy = Math.random() * 256, cr = 3 + Math.random() * 8;
      gctx.fillStyle = 'rgba(0,0,0,0.25)';
      gctx.beginPath(); gctx.arc(cx, cy, cr, 0, Math.PI * 2); gctx.fill();
      gctx.strokeStyle = 'rgba(255,255,255,0.2)';
      gctx.lineWidth = 1;
      gctx.beginPath(); gctx.arc(cx, cy, cr, Math.PI * 0.5, Math.PI * 1.5); gctx.stroke();
    }

    const gTex = new THREE.CanvasTexture(gCanvas);
    gTex.wrapS = THREE.RepeatWrapping;
    gTex.wrapT = THREE.RepeatWrapping;
    gTex.repeat.set(12, 12);

    const discGeo = new THREE.CircleGeometry(600, 48);
    discGeo.rotateX(-Math.PI / 2);
    checkFinite(discGeo, 'landing-ground-disc');

    const sunStr = currentSiteVisual.sunStrength || 1.0;
    groundDiscMat = new THREE.MeshBasicMaterial({
      map: gTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      color: new THREE.Color(sunStr, sunStr, sunStr),
    });
    groundDisc = new THREE.Mesh(discGeo, groundDiscMat);
    groundDisc.position.set(0, -14, -100);
    groundGroup.add(groundDisc);

    // Crater wall silhouette for crater site
    const wallGeo = new THREE.PlaneGeometry(80, 20);
    checkFinite(wallGeo, 'landing-crater-wall');
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x050810,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    craterSilhouette = new THREE.Mesh(wallGeo, wallMat);
    craterSilhouette.position.set(-65, -8, -120);
    craterSilhouette.rotation.y = 0.25;
    groundGroup.add(craterSilhouette);

    scene.add(groundGroup);
  } catch (err) {
    console.error('EarthScene part failed: landing ground strip', err);
  }

  let rollOffset = 0;

  function setSite(visual) {
    if (!visual) return;
    currentSiteVisual = { ...visual };
    if (groundDiscMat) {
      const s = currentSiteVisual.sunStrength || 1.0;
      groundDiscMat.color.setRGB(s, s, s);
    }
  }

  function startGround() {
    isGroundActive = true;
    groundFade = 0;
    if (groundGroup) groundGroup.visible = true;
  }

  function setFrame(frame, delta) {
    if (!frame) return;

    const prefersReduced = (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );

    const tl = frame.tl || 0;

    // 1. RCS Puffs during flip
    if (!prefersReduced && tl < 8.0) {
      for (let i = 0; i < RCS_TIMESTAMPS.length; i++) {
        const ts = RCS_TIMESTAMPS[i];
        if (tl >= ts && !firedRcsTimes.has(i)) {
          firedRcsTimes.add(i);
          triggerPuff(i % 2 === 0);
        }
      }
    }

    // Camera roll during flip (4 degrees max)
    if (!prefersReduced && frame.flipProgress > 0 && frame.flipProgress < 1) {
      const wobble = 0.05 * Math.sin(frame.flipProgress * 20.0);
      rollOffset = (4 * Math.PI / 180) * Math.sin(Math.PI * frame.flipProgress) + wobble * (4 * Math.PI / 180);
    } else {
      rollOffset = 0;
    }

    // 2. Engine Glow Overlay (dimmed to 40% while window faces up)
    if (glowOverlay) {
      const flame = frame.flame || 0;
      const flicker = prefersReduced ? 1.0 : (0.85 + 0.15 * Math.sin(tl * 25));
      const targetOp = (flame * 0.40 * flicker).toFixed(2);
      glowOverlay.style.opacity = targetOp;
    }

    // G vignette
    if (gVignette) {
      const gEffect = Math.min(1.0, (frame.g || 0) * 4.0 * 0.2);
      gVignette.style.opacity = gEffect.toFixed(2);
    }

    // 3. Lunar Dust Canvas
    if (dustCanvas && dustCtx && !prefersReduced) {
      const dustAlpha = frame.dust || 0;
      if (dustAlpha > 0.01) {
        dustCanvas.style.opacity = '1';
        const w = dustCanvas.width = dustCanvas.clientWidth || 800;
        const h = dustCanvas.height = dustCanvas.clientHeight || 600;
        dustCtx.clearRect(0, 0, w, h);

        dustCtx.fillStyle = 'rgba(215, 220, 230, 0.45)';
        for (let i = 0; i < dustList.length; i++) {
          const p = dustList[i];
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.vy += 0.08 * delta; // gentle lunar gravity arc

          if (p.y > 1.05 || p.x < -0.1 || p.x > 1.1) {
            p.x = 0.3 + Math.random() * 0.4;
            p.y = 0.85 + Math.random() * 0.15;
            p.vx = (Math.random() - 0.5) * 0.35;
            p.vy = -0.15 - Math.random() * 0.35;
          }

          const px = p.x * w;
          const py = p.y * h;
          const rad = p.size;
          dustCtx.beginPath();
          dustCtx.arc(px, py, rad, 0, Math.PI * 2);
          dustCtx.fill();
        }
      } else {
        dustCanvas.style.opacity = '0';
      }
    }

    // 4. Ground Strip Fade
    if (isGroundActive && groundGroup) {
      groundFade = Math.min(1.0, groundFade + delta / 3.0);
      if (groundDiscMat) groundDiscMat.opacity = groundFade;
      if (craterSilhouette && currentSiteVisual.featureHint === 'crater') {
        craterSilhouette.material.opacity = groundFade * 0.95;
      }
    }
  }

  function reset() {
    isGroundActive = false;
    groundFade = 0;
    rollOffset = 0;
    firedRcsTimes.clear();

    if (groundGroup) groundGroup.visible = false;
    if (groundDiscMat) groundDiscMat.opacity = 0;
    if (craterSilhouette) craterSilhouette.material.opacity = 0;
    if (glowOverlay) glowOverlay.style.opacity = '0';
    if (gVignette) gVignette.style.opacity = '0';
    if (dustCanvas) dustCanvas.style.opacity = '0';
  }

  function dispose() {
    reset();
    try {
      if (rcsContainer?.parentNode) rcsContainer.parentNode.removeChild(rcsContainer);
      if (glowOverlay?.parentNode) glowOverlay.parentNode.removeChild(glowOverlay);
      if (gVignette?.parentNode) gVignette.parentNode.removeChild(gVignette);
      if (dustCanvas?.parentNode) dustCanvas.parentNode.removeChild(dustCanvas);
      if (groundGroup) scene.remove(groundGroup);
    } catch (err) {
      console.error('EarthScene part failed: landing effects dispose', err);
    }
  }

  return {
    setFrame,
    setSite,
    startGround,
    getRollOffset: () => rollOffset,
    reset,
    dispose,
  };
}

export default createLandingEffects;
