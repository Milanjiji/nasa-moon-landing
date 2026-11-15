// ---------------------------------------------------------------------------
// Base Builder: 3D Modules, Unfolding, Inflation, Soil Bags & Animations
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { BASE_SITES } from '../../game/baseLayout.js';

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

function createSolarTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f2752'; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createBaseBuilder({ scene, getHeight, lander, puffAt, site }) {
  const root = new THREE.Group();
  root.name = 'base-builder-root';
  scene.add(root);

  const getH = typeof getHeight === 'function' ? getHeight : () => 0;
  const currentSite = site;
  const geometries = [];
  const materials = [];
  const textures = [];

  function regGeo(geo, name) { checkFinite(geo, name); geometries.push(geo); return geo; }
  function regMat(mat) { materials.push(mat); return mat; }
  function regTex(tex) { textures.push(tex); return tex; }

  // Shared textures & materials
  const solarTex = regTex(createSolarTexture());
  const solarPanelMat = regMat(new THREE.MeshStandardMaterial({
    map: solarTex, color: 0x2563eb, roughness: 0.25, metalness: 0.8,
    emissive: 0x071b38, emissiveIntensity: 0.2, flatShading: true,
  }));
  const metalMat = regMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.7, flatShading: true }));
  const darkMetalMat = regMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.5, flatShading: true }));
  const habMat = regMat(new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: 0.85, metalness: 0.1, flatShading: true }));
  const winGlowMat = regMat(new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: 0xffb020, emissiveIntensity: 1.2, flatShading: true }));
  const bagMat = regMat(new THREE.MeshStandardMaterial({ color: 0x788292, roughness: 0.95, metalness: 0.05, flatShading: true }));

  // Crates
  const cratesGroup = new THREE.Group();
  cratesGroup.name = 'base-crates';
  root.add(cratesGroup);
  const crateMeshes = new Map();
  const crateColors = { solar: 0x2563eb, habitat: 0xf8fafc, air: 0xea580c, shield: 0x64748b };

  for (const [modId, col] of Object.entries(crateColors)) {
    const cg = new THREE.Group();
    const boxGeo = regGeo(new THREE.BoxGeometry(0.5, 0.4, 0.5), `crate-${modId}`);
    const bMat = regMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3, flatShading: true }));
    const box = new THREE.Mesh(boxGeo, bMat);
    box.castShadow = true; box.position.y = 0.2; cg.add(box);
    const stripeGeo = regGeo(new THREE.BoxGeometry(0.52, 0.1, 0.52), `crate-stripe-${modId}`);
    const sMat = regMat(new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, flatShading: true }));
    const stripe = new THREE.Mesh(stripeGeo, sMat);
    stripe.position.y = 0.2; cg.add(stripe);
    cg.visible = false; cratesGroup.add(cg);
    crateMeshes.set(modId, cg);
  }

  // Modules Groups
  const solarGroup = new THREE.Group();
  const habGroup = new THREE.Group();
  const airGroup = new THREE.Group();
  const shieldGroup = new THREE.Group();
  root.add(solarGroup); root.add(habGroup); root.add(airGroup); root.add(shieldGroup);

  let craterLight = null;
  let currentAnim = null;

  function resetCratesToPallet() {
    const cargo = lander?.getCargoHatch ? lander.getCargoHatch() : null;
    const palletPos = cargo?.getPalletAnchor ? cargo.getPalletAnchor() : new THREE.Vector3(2.4, 0.5, 0);
    const offsets = {
      solar: new THREE.Vector3(-0.3, 0, -0.3), habitat: new THREE.Vector3(0.3, 0, -0.3),
      air: new THREE.Vector3(-0.3, 0, 0.3), shield: new THREE.Vector3(0.3, 0, 0.3),
    };
    for (const [modId, mesh] of crateMeshes.entries()) {
      mesh.visible = false;
      const off = offsets[modId] || new THREE.Vector3();
      mesh.position.copy(palletPos).add(off);
      mesh.scale.set(1, 1, 1);
    }
  }

  // --- Solar Array Construction ---
  let solarRack = null;
  let solarPanelsInst = null;
  let solarPanelCount = 0;

  function setupSolar(optionId) {
    while (solarGroup.children.length > 0) solarGroup.remove(solarGroup.children[0]);
    solarPanelCount = optionId === 'large' ? 8 : 4;
    const sx = BASE_SITES.solar.x; const sz = BASE_SITES.solar.z; const sy = getH(sx, sz);
    solarGroup.position.set(sx, sy, sz);

    solarRack = new THREE.Group();
    const pole = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), 'solar-pole'), metalMat);
    pole.position.y = 1.1; pole.castShadow = true; solarRack.add(pole);

    const cross = new THREE.Mesh(regGeo(new THREE.BoxGeometry(solarPanelCount === 8 ? 5.2 : 2.8, 0.08, 0.12), 'solar-cross'), metalMat);
    cross.position.y = 2.1; cross.castShadow = true; solarRack.add(cross);

    const pGeo = regGeo(new THREE.BoxGeometry(0.58, 0.04, 1.1), 'solar-panel-geo');
    solarPanelsInst = new THREE.InstancedMesh(pGeo, solarPanelMat, solarPanelCount);
    solarPanelsInst.castShadow = true; solarPanelsInst.receiveShadow = true; solarRack.add(solarPanelsInst);

    const dummy = new THREE.Object3D();
    const half = solarPanelCount / 2;
    for (let i = 0; i < solarPanelCount; i++) {
      const col = (i - half + 0.5) * 0.62;
      dummy.position.set(col, 2.1, 0); dummy.rotation.set(-Math.PI * 0.15, 0, 0);
      dummy.updateMatrix(); solarPanelsInst.setMatrixAt(i, dummy.matrix);
    }
    solarPanelsInst.instanceMatrix.needsUpdate = true;
    solarGroup.add(solarRack);

    // Cable to habitat & lander
    const cMesh1 = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.02, 0.02, 22, 4), 'solar-cable-1'), darkMetalMat);
    cMesh1.position.set(11, 0.02, 1); cMesh1.rotation.z = Math.PI / 2;
    solarGroup.add(cMesh1);
    solarGroup.visible = true;
  }

  // --- Habitat Construction ---
  let habMesh = null;
  let habAnnex = null;
  let habRadius = 3.0;

  function setupHabitat(optionId) {
    while (habGroup.children.length > 0) habGroup.remove(habGroup.children[0]);
    const hx = BASE_SITES.habitat.x; const hz = BASE_SITES.habitat.z; const hy = getH(hx, hz);
    habGroup.position.set(hx, hy, hz);

    const isRoomy = optionId === 'roomy';
    habRadius = isRoomy ? 3.75 : 3.0;
    const habHeight = 2.2;

    const baseMesh = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(habRadius, habRadius, habHeight, 24), 'hab-base'), habMat);
    baseMesh.position.y = habHeight * 0.5; baseMesh.castShadow = true; baseMesh.receiveShadow = true;
    habGroup.add(baseMesh);

    const domeMesh = new THREE.Mesh(regGeo(new THREE.SphereGeometry(habRadius, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), 'hab-dome'), habMat);
    domeMesh.position.y = habHeight; domeMesh.castShadow = true; domeMesh.receiveShadow = true;
    habGroup.add(domeMesh);

    const doorMesh = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.0, 1.6, 0.9), 'hab-airlock'), metalMat);
    doorMesh.position.set(0, 0.8, habRadius + 0.35); doorMesh.castShadow = true;
    habGroup.add(doorMesh);

    const winGeo = regGeo(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 12), 'hab-window').rotateX(Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const ang = (i + 0.5) * (Math.PI * 0.5);
      const wm = new THREE.Mesh(winGeo, winGlowMat);
      wm.position.set(Math.sin(ang) * (habRadius + 0.02), 1.3, -Math.cos(ang) * (habRadius + 0.02));
      wm.lookAt(habGroup.position.x + wm.position.x * 2, hy + 1.3, habGroup.position.z + wm.position.z * 2);
      habGroup.add(wm);
    }

    if (isRoomy) {
      habAnnex = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(1.4, 1.4, 1.8, 16), 'hab-annex'), habMat);
      habAnnex.position.set(-habRadius - 0.7, 0.9, 0); habAnnex.castShadow = true;
      habGroup.add(habAnnex);
    }

    const bMesh = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), 'hab-beacon'), metalMat);
    bMesh.position.y = habHeight + habRadius + 0.2;
    habGroup.add(bMesh);
    habMesh = baseMesh;
    habGroup.visible = true;

    // Crater real light
    if (currentSite?.id === 'crater' && !craterLight) {
      craterLight = new THREE.PointLight(0xffd9a8, 120, 30, 2);
      craterLight.position.set(hx, hy + 2.5, hz + habRadius + 0.6);
      scene.add(craterLight);
    }
  }

  // --- Air & Water Unit Construction ---
  let airFan = null;
  let airDrillRod = null;

  function setupAir(optionId) {
    while (airGroup.children.length > 0) airGroup.remove(airGroup.children[0]);
    const ax = BASE_SITES.air.x; const az = BASE_SITES.air.z; const ay = getH(ax, az);
    airGroup.position.set(ax, ay, az);
    const isCrater = currentSite?.id === 'crater';
    const isFull = optionId === 'full';

    if (isCrater) {
      if (isFull) {
        const patch = new THREE.Mesh(regGeo(new THREE.CircleGeometry(1.6, 12), 'ice-patch').rotateX(-Math.PI / 2), regMat(new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.2, metalness: 0.3 })));
        patch.position.y = 0.02; airGroup.add(patch);
        const legGeo = regGeo(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), 'drill-leg');
        for (let i = 0; i < 3; i++) {
          const ang = (i * Math.PI * 2) / 3;
          const leg = new THREE.Mesh(legGeo, metalMat);
          leg.position.set(Math.sin(ang) * 0.7, 1.1, Math.cos(ang) * 0.7);
          leg.lookAt(0, 2.2, 0); leg.rotateX(Math.PI / 2); airGroup.add(leg);
        }
        airDrillRod = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8), 'drill-rod'), metalMat);
        airDrillRod.position.y = 1.1; airGroup.add(airDrillRod);
        const tank = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12), 'drill-tank'), habMat);
        tank.position.set(1.4, 0.6, 0); airGroup.add(tank);
      } else {
        const box = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.9, 0.8, 0.9), 'air-small-box'), darkMetalMat);
        box.position.y = 0.4; airGroup.add(box);
      }
    } else {
      if (isFull) {
        const box = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.4, 1.0, 1.1), 'air-full-box'), darkMetalMat);
        box.position.y = 0.5; airGroup.add(box);
        const tankGeo = regGeo(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 12), 'air-tank-1');
        const t1 = new THREE.Mesh(tankGeo, habMat); t1.position.set(-0.4, 0.55, 0.6);
        const t2 = new THREE.Mesh(tankGeo, habMat); t2.position.set(0.4, 0.55, 0.6);
        airGroup.add(t1); airGroup.add(t2);
        airFan = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.45, 0.04, 0.08), 'air-fan'), metalMat);
        airFan.position.set(0, 0.6, -0.56); airGroup.add(airFan);
      } else {
        const box = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.0, 0.8, 0.9), 'air-basic-box'), darkMetalMat);
        box.position.y = 0.4; airGroup.add(box);
        const t = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.9, 12), 'air-basic-tank'), habMat);
        t.position.set(0, 0.45, 0.5); airGroup.add(t);
      }
    }
    airGroup.visible = true;
  }

  // --- Radiation Shield Construction ---
  let shieldBagsInst = null;
  let bagCount = 0;

  function setupShield(optionId) {
    while (shieldGroup.children.length > 0) shieldGroup.remove(shieldGroup.children[0]);
    const hx = BASE_SITES.shield.x; const hz = BASE_SITES.shield.z; const hy = getH(hx, hz);
    shieldGroup.position.set(hx, hy, hz);

    const isThick = optionId === 'thick';
    bagCount = isThick ? 140 : 70;

    const bGeo = regGeo(new THREE.BoxGeometry(0.5, 0.25, 0.35), 'shield-bag-geo');
    shieldBagsInst = new THREE.InstancedMesh(bGeo, bagMat, bagCount);
    shieldBagsInst.castShadow = true; shieldBagsInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const rad = habRadius + 0.15;
    const layerCounts = isThick ? [10, 22, 22, 22, 22, 22, 20] : [32, 14, 14, 10];
    const maxLayers = layerCounts.length;
    let placed = 0;

    for (let layer = 0; layer < maxLayers; layer++) {
      const ringRadius = Math.max(0.8, rad - layer * 0.35);
      const ringY = layer * 0.38 + 0.15;
      const countInRing = layerCounts[layer] || 10;
      for (let j = 0; j < countInRing && placed < bagCount; j++) {
        const ang = (j / countInRing) * Math.PI * 2 + (layer % 2) * 0.2;
        const bx = Math.sin(ang) * ringRadius;
        const bz = Math.cos(ang) * ringRadius;
        dummy.position.set(bx, ringY, bz); dummy.rotation.set(0, ang + Math.PI / 2, 0);
        dummy.updateMatrix(); shieldBagsInst.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }
    while (placed < bagCount) {
      dummy.position.set(0, 2.6, 0); dummy.updateMatrix();
      shieldBagsInst.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    shieldBagsInst.instanceMatrix.needsUpdate = true;
    shieldGroup.add(shieldBagsInst);
    shieldGroup.visible = true;
  }

  function prepare() {
    resetCratesToPallet();
    solarGroup.visible = false;
    habGroup.visible = false;
    airGroup.visible = false;
    shieldGroup.visible = false;
  }

  function playHatch(onDone) {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const speed = prefersReduced ? 3.0 : 1.0;
    const dur = 2.5 / speed;
    let elapsed = 0;

    resetCratesToPallet();
    for (const m of crateMeshes.values()) m.visible = true;
    if (puffAt && !prefersReduced) puffAt(new THREE.Vector3(2.4, 0.4, 0), 1.0);

    currentAnim = {
      update: (dt) => {
        elapsed += dt;
        const p = Math.min(1.0, elapsed / dur);
        const ease = p * p * (3.0 - 2.0 * p);
        if (lander?.getCargoHatch) lander.getCargoHatch().open(ease);
        if (p >= 1.0) {
          currentAnim = null;
          if (typeof onDone === 'function') onDone();
        }
      },
    };
  }

  function playCrate(moduleId, onDone) {
    const crate = crateMeshes.get(moduleId);
    if (!crate) { if (onDone) onDone(); return; }
    crate.visible = true;

    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const targetSite = BASE_SITES[moduleId] || BASE_SITES.habitat;
    const endPos = new THREE.Vector3(targetSite.x, getH(targetSite.x, targetSite.z) + 0.1, targetSite.z);
    const startPos = crate.position.clone();
    const dist = startPos.distanceTo(endPos);
    const dur = prefersReduced ? 0.2 : Math.max(0.5, dist / 6.0);
    let elapsed = 0;
    let lastPuff = 0;

    currentAnim = {
      update: (dt) => {
        elapsed += dt;
        const p = Math.min(1.0, elapsed / dur);
        crate.position.lerpVectors(startPos, endPos, p);
        if (!prefersReduced && elapsed - lastPuff >= 0.5 && puffAt) {
          lastPuff = elapsed;
          puffAt(crate.position, 0.5);
        }
        if (p >= 1.0) {
          crate.visible = false;
          currentAnim = null;
          if (typeof onDone === 'function') onDone();
        }
      },
    };
  }

  function animScale(group, dur, onDone, bounce = false) {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    let elapsed = 0;
    currentAnim = {
      update: (dt) => {
        elapsed += dt;
        const p = Math.min(1.0, elapsed / dur);
        const b = (bounce && p < 1.0 && !prefersReduced) ? 0.8 + 0.25 * Math.sin(p * Math.PI * 2) : 1.0;
        group.scale.set(p, p * b, p);
        if (p >= 1.0) {
          group.scale.set(1, 1, 1);
          currentAnim = null;
          if (onDone) onDone();
        }
      },
    };
  }

  function playModule(moduleId, optionId, onDone) {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const speed = prefersReduced ? 3.0 : 1.0;
    if (moduleId === 'solar') {
      setupSolar(optionId);
      animScale(solarGroup, (optionId === 'large' ? 5.0 : 3.0) / speed, onDone);
    } else if (moduleId === 'habitat') {
      setupHabitat(optionId);
      animScale(habGroup, 4.0 / speed, onDone, true);
    } else if (moduleId === 'air') {
      setupAir(optionId);
      animScale(airGroup, 4.0 / speed, onDone);
    } else if (moduleId === 'shield') {
      setupShield(optionId);
      animScale(shieldGroup, (optionId === 'thick' ? 6.0 : 3.0) / speed, onDone);
    } else if (onDone) {
      onDone();
    }
  }

  function buildInstant(choices = {}) {
    if (choices.solar) setupSolar(choices.solar);
    if (choices.habitat) setupHabitat(choices.habitat);
    if (choices.air) setupAir(choices.air);
    if (choices.shield) setupShield(choices.shield);
    for (const m of crateMeshes.values()) m.visible = false;
    if (lander?.getCargoHatch) lander.getCargoHatch().open(1.0);
  }

  function reset() {
    currentAnim = null;
    solarGroup.visible = false;
    habGroup.visible = false;
    airGroup.visible = false;
    shieldGroup.visible = false;
    resetCratesToPallet();
    if (lander?.getCargoHatch) lander.getCargoHatch().open(0.0);
    if (craterLight) {
      scene.remove(craterLight);
      craterLight.dispose();
      craterLight = null;
    }
  }

  function update(delta) {
    if (currentAnim) currentAnim.update(delta);
    if (airFan) airFan.rotation.y += delta * 6.0;
    if (airDrillRod) airDrillRod.position.y = 1.1 + Math.sin(Date.now() * 0.005) * 0.15;
  }

  function dispose() {
    reset();
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) t.dispose();
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return {
    prepare, playHatch, playCrate, playModule, buildInstant, reset, update, dispose,
    getSolarGroup: () => solarGroup, getHabGroup: () => habGroup,
    getAirGroup: () => airGroup, getShieldGroup: () => shieldGroup, getRoot: () => root,
  };
}

export default createBaseBuilder;
