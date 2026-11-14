import * as THREE from 'three';

// ---------------------------------------------------------------------------
// NaN/Inf vertex checker helper
// ---------------------------------------------------------------------------
function checkFinite(geometry, name) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
  const array = geometry.attributes.position.array;
  for (let i = 0; i < array.length; i += 3) {
    if (
      !isFinite(array[i]) ||
      !isFinite(array[i + 1]) ||
      !isFinite(array[i + 2])
    ) {
      console.warn(
        `NaN/Inf in geometry "${name}" at vertex ${i / 3}: ` +
          `(${array[i]}, ${array[i + 1]}, ${array[i + 2]})`
      );
      return;
    }
  }
}

function makeBox(w, h, d, mat, name, pos) {
  const geo = new THREE.BoxGeometry(w, h, d);
  checkFinite(geo, name);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  return mesh;
}

function makeCyl(rt, rb, h, s, mat, name, pos, rot) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, s);
  checkFinite(geo, name);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  return mesh;
}

function makeSph(r, ws, hs, mat, name, pos, thetaStart, thetaLength) {
  const geo = new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, thetaStart || 0, thetaLength || Math.PI);
  checkFinite(geo, name);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  return mesh;
}

// ---------------------------------------------------------------------------
// Build Character & Gear Variants
// ---------------------------------------------------------------------------
export function buildCharacter() {
  const group = new THREE.Group();
  group.name = 'astronaut_character';

  // Base materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0ac8a, roughness: 0.8, flatShading: true });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.9, flatShading: true });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, flatShading: true });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x3d7ea6, roughness: 0.75, flatShading: true });
  const jeansMat = new THREE.MeshStandardMaterial({ color: 0x2f3b52, roughness: 0.85, flatShading: true });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.6, flatShading: true });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.85, flatShading: true });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x3f7fd1, roughness: 0.6, flatShading: true });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xe8782b, roughness: 0.6, flatShading: true });
  const greyMat = new THREE.MeshStandardMaterial({ color: 0xc9ced8, roughness: 0.65, flatShading: true });
  const darkGreyMat = new THREE.MeshStandardMaterial({ color: 0x888f9e, roughness: 0.7, flatShading: true });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8a93a, roughness: 0.35, metalness: 0.6, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xddf0ff, transparent: true, opacity: 0.25, roughness: 0.1, metalness: 0.1 });
  const lightBlueMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.7 });

  // Base Shoes
  const shoeL = makeBox(0.13, 0.07, 0.22, whiteMat, 'shoeL', [-0.13, 0.065, 0.03]);
  const soleL = makeBox(0.135, 0.03, 0.23, soleMat, 'soleL', [0, -0.035, 0]);
  shoeL.add(soleL);
  group.add(shoeL);

  const shoeR = makeBox(0.13, 0.07, 0.22, whiteMat, 'shoeR', [0.13, 0.065, 0.03]);
  const soleR = makeBox(0.135, 0.03, 0.23, soleMat, 'soleR', [0, -0.035, 0]);
  shoeR.add(soleR);
  group.add(shoeR);

  // Base Legs & Pelvis
  const legL = makeCyl(0.075, 0.07, 0.72, 8, jeansMat, 'legL', [-0.13, 0.46, 0]);
  const legR = makeCyl(0.075, 0.07, 0.72, 8, jeansMat, 'legR', [0.13, 0.46, 0]);
  const pelvis = makeBox(0.36, 0.14, 0.2, jeansMat, 'pelvis', [0, 0.85, 0]);
  group.add(legL);
  group.add(legR);
  group.add(pelvis);

  // Base Torso
  const torso = makeBox(0.4, 0.48, 0.22, shirtMat, 'torso', [0, 1.14, 0]);
  group.add(torso);

  // Base Arms
  const armLGroup = new THREE.Group();
  armLGroup.position.set(-0.25, 1.32, 0);
  armLGroup.rotation.z = -0.15;
  const sleeveL = makeCyl(0.065, 0.06, 0.18, 8, shirtMat, 'sleeveL', [0, -0.09, 0]);
  const armL = makeCyl(0.055, 0.05, 0.32, 8, skinMat, 'armL', [0, -0.32, 0]);
  const handL = makeSph(0.055, 8, 8, skinMat, 'handL', [0, -0.18, 0]);
  armL.add(handL);
  armLGroup.add(sleeveL);
  armLGroup.add(armL);
  group.add(armLGroup);

  const armRGroup = new THREE.Group();
  armRGroup.position.set(0.25, 1.32, 0);
  armRGroup.rotation.z = 0.15;
  const sleeveR = makeCyl(0.065, 0.06, 0.18, 8, shirtMat, 'sleeveR', [0, -0.09, 0]);
  const armR = makeCyl(0.055, 0.05, 0.32, 8, skinMat, 'armR', [0, -0.32, 0]);
  const handR = makeSph(0.055, 8, 8, skinMat, 'handR', [0, -0.18, 0]);
  armR.add(handR);
  armRGroup.add(sleeveR);
  armRGroup.add(armR);
  group.add(armRGroup);

  // Base Neck & Head
  const neck = makeCyl(0.06, 0.06, 0.08, 8, skinMat, 'neck', [0, 1.40, 0]);
  const head = makeSph(0.14, 12, 10, skinMat, 'head', [0, 1.54, 0]);
  const eyeL = makeSph(0.018, 6, 6, eyeMat, 'eyeL', [-0.045, 0.015, 0.13]);
  const eyeR = makeSph(0.018, 6, 6, eyeMat, 'eyeR', [0.045, 0.015, 0.13]);
  head.add(eyeL);
  head.add(eyeR);
  group.add(neck);
  group.add(head);

  // Base Hair
  const hair = makeBox(0.29, 0.14, 0.28, hairMat, 'hair', [0, 1.63, -0.02]);
  group.add(hair);

  // -------------------------------------------------------------------------
  // SLOTS & GEAR VARIANTS (built once, toggled via visible)
  // -------------------------------------------------------------------------
  const slotSuit = new THREE.Group();
  slotSuit.name = 'slot_suit';
  group.add(slotSuit);

  const slotHelmet = new THREE.Group();
  slotHelmet.name = 'slot_helmet';
  slotHelmet.position.set(0, 1.54, 0);
  group.add(slotHelmet);

  const slotGloves = new THREE.Group();
  slotGloves.name = 'slot_gloves';
  group.add(slotGloves);

  const slotBoots = new THREE.Group();
  slotBoots.name = 'slot_boots';
  group.add(slotBoots);

  const slotBackpack = new THREE.Group();
  slotBackpack.name = 'slot_backpack';
  slotBackpack.position.set(0, 1.15, -0.13);
  group.add(slotBackpack);

  // --- 1. SUITS ---
  function buildSuit(id, baseMat, trimMat, isShield) {
    const s = new THREE.Group();
    s.name = id;
    s.visible = false;
    const w = isShield ? 0.46 : 0.42;
    const d = isShield ? 0.26 : 0.24;
    s.add(makeBox(w, 0.50, d, baseMat, id + '_torso', [0, 1.14, 0]));
    s.add(makeBox(w + 0.02, 0.07, d + 0.02, trimMat, id + '_belt', [0, 0.88, 0]));
    s.add(makeBox(0.18, 0.14, 0.04, trimMat, id + '_chest', [0, 1.20, d / 2 + 0.02]));
    s.add(makeBox(0.38, 0.14, 0.22, baseMat, id + '_pelvis', [0, 0.85, 0]));
    const legR = isShield ? 0.085 : 0.078;
    s.add(makeCyl(legR, legR - 0.005, 0.72, 8, baseMat, id + '_legL', [-0.13, 0.46, 0]));
    s.add(makeCyl(legR, legR - 0.005, 0.72, 8, baseMat, id + '_legR', [0.13, 0.46, 0]));
    s.add(makeCyl(legR + 0.008, legR + 0.008, 0.06, 8, trimMat, id + '_kneeL', [-0.13, 0.46, 0]));
    s.add(makeCyl(legR + 0.008, legR + 0.008, 0.06, 8, trimMat, id + '_kneeR', [0.13, 0.46, 0]));

    const armLG = new THREE.Group();
    armLG.position.set(-0.25, 1.32, 0);
    armLG.rotation.z = -0.15;
    armLG.add(makeCyl(0.07, 0.058, 0.46, 8, baseMat, id + '_armL', [0, -0.22, 0]));
    if (isShield) armLG.add(makeBox(0.12, 0.10, 0.14, trimMat, id + '_shL', [0, 0, 0]));
    s.add(armLG);

    const armRG = new THREE.Group();
    armRG.position.set(0.25, 1.32, 0);
    armRG.rotation.z = 0.15;
    armRG.add(makeCyl(0.07, 0.058, 0.46, 8, baseMat, id + '_armR', [0, -0.22, 0]));
    if (isShield) armRG.add(makeBox(0.12, 0.10, 0.14, trimMat, id + '_shR', [0, 0, 0]));
    s.add(armRG);
    return s;
  }
  slotSuit.add(buildSuit('suit-light', whiteMat, blueMat, false));
  slotSuit.add(buildSuit('suit-standard', whiteMat, orangeMat, false));
  slotSuit.add(buildSuit('suit-shield', greyMat, goldMat, true));

  // --- 2. HELMETS ---
  const hBasic = new THREE.Group();
  hBasic.name = 'helmet-basic';
  hBasic.visible = false;
  hBasic.add(makeSph(0.22, 16, 14, glassMat, 'h_basic_dome', [0, 0, 0]));
  hBasic.add(makeCyl(0.16, 0.16, 0.04, 16, whiteMat, 'h_basic_ring', [0, -0.14, 0]));
  slotHelmet.add(hBasic);

  const hSun = new THREE.Group();
  hSun.name = 'helmet-sun';
  hSun.visible = false;
  hSun.add(makeSph(0.22, 16, 14, glassMat, 'h_sun_dome', [0, 0, 0]));
  hSun.add(makeCyl(0.16, 0.16, 0.04, 16, whiteMat, 'h_sun_ring', [0, -0.14, 0]));
  hSun.add(makeSph(0.20, 14, 12, goldMat, 'h_sun_visor', [0, 0.02, 0.02], 0, Math.PI * 0.55));
  slotHelmet.add(hSun);

  const hDome = new THREE.Group();
  hDome.name = 'helmet-dome';
  hDome.visible = false;
  hDome.add(makeSph(0.23, 16, 14, whiteMat, 'h_dome_shell', [0, 0, 0]));
  hDome.add(makeBox(0.22, 0.13, 0.08, eyeMat, 'h_dome_window', [0, 0.02, 0.18]));
  hDome.add(makeCyl(0.025, 0.025, 0.04, 8, lightBlueMat, 'h_dome_light', [0, 0.24, 0]));
  slotHelmet.add(hDome);

  // --- 3. GLOVES ---
  function buildGloves(id, baseMat, trimMat, isArmor) {
    const g = new THREE.Group();
    g.name = id;
    g.visible = false;
    for (const side of [-1, 1]) {
      const armG = new THREE.Group();
      armG.position.set(side * 0.25, 1.32, 0);
      armG.rotation.z = side * 0.15;
      const r = isArmor ? 0.065 : 0.058;
      armG.add(makeSph(r, 8, 8, baseMat, id + '_hand' + side, [0, -0.50, 0]));
      if (trimMat) armG.add(makeCyl(r + 0.008, r + 0.008, 0.05, 8, trimMat, id + '_cuff' + side, [0, -0.44, 0]));
      if (isArmor) armG.add(makeBox(0.06, 0.03, 0.06, goldMat, id + '_plate' + side, [0, -0.50, 0.04]));
      g.add(armG);
    }
    return g;
  }
  slotGloves.add(buildGloves('gloves-flex', whiteMat, null, false));
  slotGloves.add(buildGloves('gloves-insulated', whiteMat, orangeMat, false));
  slotGloves.add(buildGloves('gloves-armor', darkGreyMat, greyMat, true));

  // --- 4. BOOTS ---
  function buildBoots(id, baseMat, soleMatVal, toeMat, isHeavy) {
    const b = new THREE.Group();
    b.name = id;
    b.visible = false;
    const h = isHeavy ? 0.20 : 0.14;
    const w = isHeavy ? 0.15 : 0.135;
    for (const x of [-0.13, 0.13]) {
      b.add(makeBox(w, h, 0.24, baseMat, id + '_b' + x, [x, h / 2, 0.03]));
      b.add(makeBox(w + 0.01, 0.04, 0.25, soleMatVal, id + '_s' + x, [x, 0.02, 0.03]));
      if (toeMat) b.add(makeBox(w * 0.9, 0.05, 0.07, toeMat, id + '_toe' + x, [x, 0.05, 0.12]));
    }
    return b;
  }
  slotBoots.add(buildBoots('boots-light', whiteMat, whiteMat, null, false));
  slotBoots.add(buildBoots('boots-grip', whiteMat, soleMat, null, false));
  slotBoots.add(buildBoots('boots-heavy', darkGreyMat, soleMat, goldMat, true));

  // --- 5. BACKPACKS ---
  function buildPack(id, w, h, d, tankR, tankH, hasAntenna) {
    const p = new THREE.Group();
    p.name = id;
    p.visible = false;
    p.add(makeBox(w, h, d, whiteMat, id + '_box', [0, 0, -d / 2]));
    p.add(makeBox(0.04, 0.04, 0.03, lightBlueMat, id + '_light', [w / 2 - 0.03, h / 2 - 0.04, 0.02]));
    if (tankR) {
      p.add(makeCyl(tankR, tankR, tankH, 8, greyMat, id + '_tankL', [-w / 2 - tankR + 0.01, 0, -d / 2]));
      p.add(makeCyl(tankR, tankR, tankH, 8, greyMat, id + '_tankR', [w / 2 + tankR - 0.01, 0, -d / 2]));
    }
    if (hasAntenna) {
      p.add(makeCyl(0.007, 0.007, 0.20, 6, greyMat, id + '_ant', [w / 3, h / 2 + 0.10, -d / 2]));
      p.add(makeSph(0.016, 6, 6, lightBlueMat, id + '_antTip', [w / 3, h / 2 + 0.20, -d / 2]));
    }
    return p;
  }
  slotBackpack.add(buildPack('pack-small', 0.28, 0.36, 0.14, 0, 0, false));
  slotBackpack.add(buildPack('pack-standard', 0.32, 0.40, 0.15, 0.045, 0.32, false));
  slotBackpack.add(buildPack('pack-large', 0.36, 0.48, 0.16, 0.06, 0.44, true));

  // -------------------------------------------------------------------------
  // setOutfit(config)
  // -------------------------------------------------------------------------
  function setOutfit(config) {
    const cfg = config || { suit: null, helmet: null, gloves: null, boots: null, backpack: null };

    // Toggle suit
    const hasSuit = Boolean(cfg.suit);
    torso.visible = !hasSuit;
    pelvis.visible = !hasSuit;
    legL.visible = !hasSuit;
    legR.visible = !hasSuit;
    sleeveL.visible = !hasSuit;
    sleeveR.visible = !hasSuit;
    armL.visible = !hasSuit;
    armR.visible = !hasSuit;
    for (const child of slotSuit.children) {
      child.visible = child.name === cfg.suit;
    }

    // Toggle helmet
    hair.visible = !cfg.helmet;
    for (const child of slotHelmet.children) {
      child.visible = child.name === cfg.helmet;
    }

    // Toggle gloves
    handL.visible = !cfg.gloves;
    handR.visible = !cfg.gloves;
    for (const child of slotGloves.children) {
      child.visible = child.name === cfg.gloves;
    }

    // Toggle boots
    shoeL.visible = !cfg.boots;
    shoeR.visible = !cfg.boots;
    for (const child of slotBoots.children) {
      child.visible = child.name === cfg.boots;
    }

    // Toggle backpack
    for (const child of slotBackpack.children) {
      child.visible = child.name === cfg.backpack;
    }
  }

  const parts = { head, hair, torso, armL, armR, legL, legR, shoeL, shoeR };
  const slots = { helmet: slotHelmet, backpack: slotBackpack, suit: slotSuit, gloves: slotGloves, boots: slotBoots };

  return {
    group,
    parts,
    slots,
    setOutfit,
  };
}

export default buildCharacter;
