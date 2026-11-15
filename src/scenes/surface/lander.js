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

export function createSurfaceLander({ scene, site, damage = 'none' }) {
  const group = new THREE.Group();
  group.name = 'surface-lander-group';
  scene.add(group);

  const landerBody = new THREE.Group();
  landerBody.name = 'lander-body';
  group.add(landerBody);

  const materials = [];
  const geometries = [];

  function regMat(mat) {
    materials.push(mat);
    return mat;
  }
  function regGeo(geo, name) {
    checkFinite(geo, name);
    geometries.push(geo);
    return geo;
  }

  try {
    // 1. Descent Stage (Octagonal cylinder, gold foil #c9a24a)
    const goldMat = regMat(new THREE.MeshStandardMaterial({
      color: 0xc9a24a,
      metalness: 0.55,
      roughness: 0.35,
      flatShading: true,
    }));
    const descentGeo = regGeo(new THREE.CylinderGeometry(1.6, 1.7, 1.5, 8), 'lander-descent-stage');
    const descentMesh = new THREE.Mesh(descentGeo, goldMat);
    descentMesh.position.y = 1.25;
    descentMesh.rotation.y = Math.PI / 8;
    descentMesh.castShadow = true;
    descentMesh.receiveShadow = true;
    landerBody.add(descentMesh);

    // Engine nozzle cone
    const nozzleMat = regMat(new THREE.MeshStandardMaterial({
      color: 0x333740,
      metalness: 0.7,
      roughness: 0.3,
      flatShading: true,
    }));
    const nozzleGeo = regGeo(new THREE.ConeGeometry(0.55, 0.75, 12, 1, true), 'lander-engine-nozzle');
    const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzleMesh.position.y = 0.4;
    nozzleMesh.rotation.x = Math.PI;
    nozzleMesh.castShadow = true;
    nozzleMesh.receiveShadow = true;
    landerBody.add(nozzleMesh);

    // 2. Cabin Stage (Upper box, white/grey #dbe0ea)
    const cabinMat = regMat(new THREE.MeshStandardMaterial({
      color: 0xdbe0ea,
      metalness: 0.15,
      roughness: 0.65,
      flatShading: true,
    }));
    const cabinGeo = regGeo(new THREE.BoxGeometry(1.8, 1.6, 1.8), 'lander-cabin');
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.y = 2.8;
    cabinMesh.castShadow = true;
    cabinMesh.receiveShadow = true;
    landerBody.add(cabinMesh);

    // Triangular window on front (-Z face)
    const winMat = regMat(new THREE.MeshStandardMaterial({
      color: 0x081b38,
      metalness: 0.8,
      roughness: 0.1,
      flatShading: true,
    }));
    const winGeo = regGeo(new THREE.ConeGeometry(0.28, 0.45, 3), 'lander-window');
    const winMesh = new THREE.Mesh(winGeo, winMat);
    winMesh.position.set(0, 3.0, -0.92);
    winMesh.rotation.x = Math.PI / 2;
    winMesh.rotation.z = Math.PI;
    winMesh.castShadow = true;
    landerBody.add(winMesh);

    // Antenna dish on top
    const dishGeo = regGeo(new THREE.SphereGeometry(0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), 'lander-antenna-dish');
    const dishMesh = new THREE.Mesh(dishGeo, goldMat);
    dishMesh.position.set(0.4, 3.8, 0.2);
    dishMesh.rotation.x = -Math.PI * 0.6;
    dishMesh.rotation.y = 0.4;
    dishMesh.castShadow = true;
    landerBody.add(dishMesh);

    // 3. Legs and Footpads (Silver #c8ccd4)
    const silverMat = regMat(new THREE.MeshStandardMaterial({
      color: 0xc8ccd4,
      metalness: 0.7,
      roughness: 0.35,
      flatShading: true,
    }));

    const legAngles = [
      Math.PI * 0.25,
      Math.PI * 0.75,
      Math.PI * 1.25,
      Math.PI * 1.75,
    ];

    for (let i = 0; i < legAngles.length; i++) {
      const ang = legAngles[i];
      const legX = Math.sin(ang) * 2.3;
      const legZ = -Math.cos(ang) * 2.3;

      // Footpad
      const padGeo = regGeo(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 16), `lander-footpad-${i}`);
      const padMesh = new THREE.Mesh(padGeo, silverMat);
      padMesh.position.set(legX, 0.04, legZ);
      padMesh.castShadow = true;
      padMesh.receiveShadow = true;
      group.add(padMesh);

      // Primary strut from descent stage to footpad
      const strutLen = Math.hypot(legX - Math.sin(ang) * 1.3, 1.25, legZ - (-Math.cos(ang) * 1.3));
      const strutGeo = regGeo(new THREE.CylinderGeometry(0.06, 0.06, strutLen, 6), `lander-strut-${i}`);
      const strutMesh = new THREE.Mesh(strutGeo, silverMat);

      strutMesh.position.set((Math.sin(ang) * 1.3 + legX) * 0.5, 0.65, (-Math.cos(ang) * 1.3 + legZ) * 0.5);
      strutMesh.lookAt(legX, 0.04, legZ);
      strutMesh.rotateX(Math.PI / 2);
      strutMesh.castShadow = true;
      group.add(strutMesh);
    }

    // 4. Solar Panels on sides (+X and -X)
    const panelMat = regMat(new THREE.MeshStandardMaterial({
      color: 0x162238,
      metalness: 0.6,
      roughness: 0.3,
      flatShading: true,
    }));
    const panelGeo = regGeo(new THREE.BoxGeometry(0.06, 1.1, 0.8), 'lander-panel-left');

    const panelL = new THREE.Mesh(panelGeo, panelMat);
    panelL.position.set(-1.45, 2.7, 0);
    panelL.castShadow = true;
    landerBody.add(panelL);

    if (damage === 'major') {
      // Dropped side panel on the ground
      const droppedGeo = regGeo(new THREE.BoxGeometry(0.06, 1.1, 0.8), 'lander-panel-dropped');
      const droppedPanel = new THREE.Mesh(droppedGeo, panelMat);
      droppedPanel.position.set(1.9, 0.04, 0.4);
      droppedPanel.rotation.set(Math.PI / 2, 0.2, 0.4);
      droppedPanel.castShadow = true;
      droppedPanel.receiveShadow = true;
      group.add(droppedPanel);
    } else {
      const panelR = new THREE.Mesh(panelGeo, panelMat);
      panelR.position.set(1.45, 2.7, 0);
      panelR.castShadow = true;
      landerBody.add(panelR);
    }

    // 5. Hatch Platform (front -Z face, height 2.7)
    const platMat = regMat(new THREE.MeshStandardMaterial({
      color: 0x8892a0,
      metalness: 0.4,
      roughness: 0.6,
      flatShading: true,
    }));
    const platGeo = regGeo(new THREE.BoxGeometry(0.8, 0.08, 0.5), 'lander-hatch-platform');
    const platMesh = new THREE.Mesh(platGeo, platMat);
    platMesh.position.set(0, 2.7, -1.15);
    platMesh.castShadow = true;
    platMesh.receiveShadow = true;
    landerBody.add(platMesh);

    // Platform rails
    const railMat = regMat(new THREE.MeshStandardMaterial({ color: 0xb5bcc8, metalness: 0.5, roughness: 0.4 }));
    const railGeo = regGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), 'lander-platform-rail');
    const rail1 = new THREE.Mesh(railGeo, railMat);
    rail1.position.set(-0.38, 3.0, -1.35);
    rail1.castShadow = true;
    landerBody.add(rail1);
    const rail2 = new THREE.Mesh(railGeo, railMat);
    rail2.position.set(0.38, 3.0, -1.35);
    rail2.castShadow = true;
    landerBody.add(rail2);

    // 6. Ladder on the -Z leg down to the ground
    const ladderGroup = new THREE.Group();
    ladderGroup.name = 'lander-ladder';

    const ladderLen = 3.65;
    const lRailGeo = regGeo(new THREE.CylinderGeometry(0.025, 0.025, ladderLen, 6), 'ladder-rail');
    const railL = new THREE.Mesh(lRailGeo, railMat);
    railL.position.set(-0.22, 1.4, -2.1);
    railL.rotation.x = 0.55;
    railL.castShadow = true;
    ladderGroup.add(railL);

    const railR = new THREE.Mesh(lRailGeo, railMat);
    railR.position.set(0.22, 1.4, -2.1);
    railR.rotation.x = 0.55;
    railR.castShadow = true;
    ladderGroup.add(railR);

    // 8 rungs
    const rungGeo = regGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), 'ladder-rung');
    for (let r = 0; r < 8; r++) {
      const p = r / 7;
      const rung = new THREE.Mesh(rungGeo, railMat);
      const ry = 2.5 - p * 2.3;
      const rz = -1.3 - p * 1.55;
      rung.position.set(0, ry, rz);
      rung.rotation.z = Math.PI / 2;
      rung.castShadow = true;
      ladderGroup.add(rung);
    }
    group.add(ladderGroup);

    // 7. Damage tilt
    if (damage === 'major') {
      landerBody.rotation.z = 0.07; // ~4 degrees
      landerBody.rotation.x = -0.035;
    } else if (damage === 'minor') {
      landerBody.rotation.z = 0.026; // ~1.5 degrees
    }

  } catch (err) {
    console.error('EarthScene part failed: surface lander construction', err);
  }

  function dispose() {
    for (let i = 0; i < geometries.length; i++) {
      geometries[i].dispose();
    }
    for (let i = 0; i < materials.length; i++) {
      materials[i].dispose();
    }
    scene.remove(group);
  }

  return {
    group,
    dispose,
  };
}

export default createSurfaceLander;
