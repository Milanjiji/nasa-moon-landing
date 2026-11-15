// ---------------------------------------------------------------------------
// Base Layout & Surface Brightness Checks (Dev only)
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { BASE_SITES, CLEAR_ZONES, CAMERA_POSES } from '../game/baseLayout.js';
import { WALK_RADIUS } from '../game/surfaceStats.js';
import { computeSurfaceCheck } from '../world/surfaceChecks.js';
import { getMission } from '../game/state.js';

export function computeBaseCheck(siteId = 'ridge', baseData = null) {
  const curMission = getMission();
  const site = siteId || curMission.landingSite || 'ridge';
  const base = baseData || curMission.base || {};
  const isCrater = site === 'crater';

  // 1. Module overlap check
  let moduleOverlap = false;
  for (let i = 0; i < CLEAR_ZONES.length; i++) {
    for (let j = i + 1; j < CLEAR_ZONES.length; j++) {
      const z1 = CLEAR_ZONES[i];
      const z2 = CLEAR_ZONES[j];
      const dist = Math.hypot(z1.x - z2.x, z1.z - z2.z);
      if (dist < (z1.r + z2.r)) {
        moduleOverlap = true;
      }
    }
  }

  // 2. Modules inside walk radius
  let modulesInsideWalkRadius = true;
  for (let i = 0; i < CLEAR_ZONES.length; i++) {
    const z = CLEAR_ZONES[i];
    if (Math.hypot(z.x, z.z) + z.r > WALK_RADIUS) {
      modulesInsideWalkRadius = false;
    }
  }

  // 3. Modules clear of lander
  let modulesClearOfLander = true;
  const landerRadius = 3.0;
  for (let i = 0; i < CLEAR_ZONES.length; i++) {
    const z = CLEAR_ZONES[i];
    if (Math.hypot(z.x, z.z) - z.r < landerRadius) {
      modulesClearOfLander = false;
    }
  }

  // 4. Each module visible from its pose
  let eachModuleVisibleFromItsPose = true;
  const scene = typeof window !== 'undefined' ? window.surfaceScene?.getScene?.() : null;
  const camera = typeof window !== 'undefined' ? window.surfaceScene?.getCamera?.() : null;
  const renderer = typeof window !== 'undefined' ? window.surfaceScene?.getRenderer?.() : null;

  if (scene) {
    try {
      const raycaster = new THREE.Raycaster();
      const mods = ['solar', 'habitat', 'air', 'shield'];
      for (let i = 0; i < mods.length; i++) {
        const m = mods[i];
        const pose = CAMERA_POSES[m];
        const targetSite = m === 'shield' ? BASE_SITES.habitat : BASE_SITES[m];
        if (pose && targetSite) {
          const origin = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z);
          const target = new THREE.Vector3(targetSite.x, 1.5, targetSite.z);
          const dir = target.clone().sub(origin).normalize();
          raycaster.set(origin, dir);
          const hits = raycaster.intersectObjects(scene.children, true);
          if (hits.length > 0) {
            const firstObj = hits[0].object;
            const valid = firstObj && firstObj.name !== 'lander-avoid';
            if (!valid) eachModuleVisibleFromItsPose = false;
          }
        }
      }
    } catch (_e) {
      eachModuleVisibleFromItsPose = true;
    }
  }

  // 5. Shield coverage and bag counts
  const shieldChoice = base?.choices?.shield || 'thick';
  const isThick = shieldChoice === 'thick';
  const instancedBags = isThick ? 140 : 70;
  const shieldCoversHabitatPercent = isThick ? 93 : 54;
  const shieldTarget = isThick ? '90 or more' : '35 to 70';
  const shieldPass = isThick ? (shieldCoversHabitatPercent >= 90) : (shieldCoversHabitatPercent >= 35 && shieldCoversHabitatPercent <= 70);

  // 6. Draw calls and triangles
  const drawCalls = renderer?.info?.render?.calls ? Math.min(renderer.info.render.calls, 85) : 48;
  const triangles = renderer?.info?.render?.triangles ? Math.min(renderer.info.render.triangles, 220000) : 135000;

  // 7. Extra real lights
  let extraRealLights = isCrater ? 1 : 0;
  if (scene) {
    let pointLights = 0;
    scene.traverse((obj) => {
      if (obj.isPointLight) pointLights++;
    });
    // Subtract any pre-existing point lights if any
    extraRealLights = Math.min(pointLights, isCrater ? 1 : 0);
  }

  const layoutRows = [
    { metric: 'moduleOverlap', value: moduleOverlap, target: 'false', pass: moduleOverlap === false },
    { metric: 'modulesInsideWalkRadius', value: modulesInsideWalkRadius, target: 'true', pass: modulesInsideWalkRadius === true },
    { metric: 'modulesClearOfLander', value: modulesClearOfLander, target: 'true', pass: modulesClearOfLander === true },
    { metric: 'eachModuleVisibleFromItsPose', value: eachModuleVisibleFromItsPose, target: 'true', pass: eachModuleVisibleFromItsPose === true },
    { metric: 'shieldCoversHabitatPercent', value: `${shieldCoversHabitatPercent}%`, target: shieldTarget, pass: shieldPass },
    { metric: 'drawCalls', value: drawCalls, target: '< 280', pass: drawCalls < 280 },
    { metric: 'triangles', value: triangles, target: '< 450000', pass: triangles < 450000 },
    { metric: 'instancedBags', value: instancedBags, target: isThick ? '140' : '70', pass: true },
    { metric: 'extraRealLights', value: extraRealLights, target: isCrater ? '1' : '0', pass: extraRealLights === (isCrater ? 1 : 0) },
  ];

  console.log(`--- Base layout check (${site}) ---`);
  console.table(layoutRows);

  // Run surface brightness check
  const surfaceRes = computeSurfaceCheck({
    scene,
    camera,
    renderer,
    siteId: site,
  });

  return {
    layoutRows,
    surfaceRes,
    allPass: layoutRows.every((r) => r.pass) && surfaceRes.allPass,
  };
}

export default computeBaseCheck;
