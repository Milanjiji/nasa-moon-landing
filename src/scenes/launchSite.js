import * as THREE from 'three';

function checkFiniteLocal(geometry, name) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
  const array = geometry.attributes.position.array;
  for (let i = 0; i < array.length; i += 3) {
    if (
      !isFinite(array[i]) ||
      !isFinite(array[i + 1]) ||
      !isFinite(array[i + 2])
    ) {
      console.warn(
        'NaN/Inf in geometry "' + name + '" at vertex ' + (i / 3) + ': ' +
          '(' + array[i] + ', ' + array[i + 1] + ', ' + array[i + 2] + ')'
      );
      return;
    }
  }
}

function createLaunchSite(options) {
  const scene = options.scene;
  const groundHeight = options.groundHeight;
  const startYaw = options.startYaw || 0;
  const pixelRatio = options.pixelRatio || 1;

  const group = new THREE.Group();
  scene.add(group);

  // Compute pad center: 90 units from player, 120 deg to the right of start dir
  const padDistance = 90;
  const padAngleRad = startYaw + (120 * Math.PI) / 180;
  const padDirX = Math.sin(padAngleRad);
  const padDirZ = -Math.cos(padAngleRad);

  const padCenter = new THREE.Vector3(
    padDirX * padDistance,
    0,
    padDirZ * padDistance
  );
  const padBaseHeight = groundHeight(padCenter.x, padCenter.z);
  padCenter.y = padBaseHeight;

  // Materials
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x8a8f98,
    emissive: 0x8a8f98,
    emissiveIntensity: 0.15,
    flatShading: true,
  });
  const rocketBodyMat = new THREE.MeshStandardMaterial({
    color: 0xf2f4f8,
    emissive: 0xf2f4f8,
    emissiveIntensity: 0.18,
    flatShading: true,
  });
  const rocketOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xe8552b,
    flatShading: true,
  });
  const rocketDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2f3a4a,
    flatShading: true,
  });
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x6b7280,
    emissive: 0x6b7280,
    emissiveIntensity: 0.1,
    flatShading: true,
  });
  const gravelMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a,
    emissive: 0x4a4a4a,
    emissiveIntensity: 0.1,
    flatShading: true,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a2a,
    emissive: 0x003366,
    emissiveIntensity: 0.3,
    flatShading: true,
  });
  const engineMat = new THREE.MeshStandardMaterial({
    color: 0x3a3f4a,
    flatShading: true,
  });
  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    flatShading: true,
  });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffffcc,
    emissive: 0xffffcc,
    emissiveIntensity: 0.6,
    flatShading: true,
  });
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x3a3f4a,
    flatShading: true,
  });

  // Pad texture canvas
  function createPadTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#8a8f98';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(180, 185, 190, 0.4)';
    for (let i = 0; i < 2500; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * size,
        Math.random() * size,
        1 + Math.random() * 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(90, 95, 100, 0.5)';
    for (let i = 0; i < 2500; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * size,
        Math.random() * size,
        1 + Math.random() * 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    const center = size / 2;
    const outerR = size / 2 - 8;
    const innerR = size / 2 - 32;
    const stripeCount = 28;
    for (let i = 0; i < stripeCount; i++) {
      const angle = (i / stripeCount) * Math.PI * 2;
      const isYellow = i % 2 === 0;
      ctx.fillStyle = isYellow ? '#ffd700' : '#000000';
      ctx.beginPath();
      ctx.moveTo(
        center + Math.cos(angle) * innerR,
        center + Math.sin(angle) * innerR
      );
      ctx.lineTo(
        center + Math.cos(angle + Math.PI / stripeCount) * innerR,
        center + Math.sin(angle + Math.PI / stripeCount) * innerR
      );
      ctx.lineTo(
        center + Math.cos(angle + Math.PI / stripeCount) * outerR,
        center + Math.sin(angle + Math.PI / stripeCount) * outerR
      );
      ctx.lineTo(
        center + Math.cos(angle) * outerR,
        center + Math.sin(angle) * outerR
      );
      ctx.fill();
    }

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(center - 50, center - 120, 100, 240);

    return new THREE.CanvasTexture(canvas);
  }

  const padTex = createPadTexture();
  padTex.wrapS = THREE.ClampToEdgeWrapping;
  padTex.wrapT = THREE.ClampToEdgeWrapping;
  padTex.colorSpace = THREE.SRGBColorSpace;

  // Build pad
  function buildPad() {
    const padGeo = new THREE.CylinderGeometry(18, 18, 0.5, 32);
    checkFiniteLocal(padGeo, 'pad-platform');
    const padMesh = new THREE.Mesh(padGeo, concreteMat);
    padMesh.position.set(padCenter.x, padBaseHeight + 0.25, padCenter.z);
    padMesh.material = new THREE.MeshStandardMaterial({
      map: padTex,
      color: 0xffffff,
      emissive: 0x8a8f98,
      emissiveIntensity: 0.15,
      flatShading: true,
    });
    group.add(padMesh);

    const gravelGeo = new THREE.CylinderGeometry(26, 26, 0.6, 32);
    checkFiniteLocal(gravelGeo, 'gravel-ring');
    const gravelMesh = new THREE.Mesh(gravelGeo, gravelMat);
    gravelMesh.position.set(padCenter.x, padBaseHeight + 0.3, padCenter.z);
    group.add(gravelMesh);
  }

  // Build rocket
  function buildRocket() {
    const rocket = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(2.2, 2.2, 25, 16);
    checkFiniteLocal(bodyGeo, 'rocket-body');
    const body = new THREE.Mesh(bodyGeo, rocketBodyMat);
    body.position.y = 12.5;
    rocket.add(body);

    const orangeBandGeo = new THREE.CylinderGeometry(2.24, 2.24, 1, 16);
    const orangeBand = new THREE.Mesh(orangeBandGeo, rocketOrangeMat);
    orangeBand.position.y = 23;
    rocket.add(orangeBand);

    const darkBandGeo = new THREE.CylinderGeometry(2.24, 2.24, 0.8, 16);
    const darkBand = new THREE.Mesh(darkBandGeo, rocketDarkMat);
    darkBand.position.y = 6;
    rocket.add(darkBand);

    const noseGeo = new THREE.ConeGeometry(2.2, 7, 16);
    checkFiniteLocal(noseGeo, 'rocket-nose');
    const nose = new THREE.Mesh(noseGeo, rocketOrangeMat);
    nose.position.y = 28.5;
    rocket.add(nose);

    for (let i = 0; i < 4; i++) {
      const finGeo = new THREE.BoxGeometry(0.3, 5, 3);
      checkFiniteLocal(finGeo, 'rocket-fin-' + i);
      const fin = new THREE.Mesh(finGeo, rocketDarkMat);
      const angle = (i / 4) * Math.PI * 2;
      fin.position.set(
        Math.cos(angle) * 2.5,
        1.5,
        Math.sin(angle) * 2.5
      );
      fin.rotation.y = angle;
      rocket.add(fin);
    }

    const windowGeo = new THREE.RingGeometry(0.25, 0.35, 16);
    const windowMesh = new THREE.Mesh(windowGeo, windowMat);
    windowMesh.position.set(2.21, 20, 0);
    windowMesh.rotation.y = Math.PI / 2;
    rocket.add(windowMesh);

    const engineGeo = new THREE.CylinderGeometry(2.6, 2.6, 3, 16);
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.y = 1.5;
    rocket.add(engine);

    for (let i = 0; i < 3; i++) {
      const nozzleGeo = new THREE.ConeGeometry(0.6, 1.5, 8);
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      const angle = (i / 3) * Math.PI * 2;
      nozzle.position.set(
        Math.cos(angle) * 1.0,
        0,
        Math.sin(angle) * 1.0
      );
      nozzle.rotation.x = Math.PI;
      engine.add(nozzle);
    }

    rocket.position.set(padCenter.x, padBaseHeight, padCenter.z);
    group.add(rocket);
    return rocket;
  }

  // Build tower
  function buildTower() {
    const tower = new THREE.Group();
    const towerHeight = 30;
    const towerX = padCenter.x + 5;
    const towerZ = padCenter.z;
    const colSize = 0.6;

    for (let i = 0; i < 4; i++) {
      const colGeo = new THREE.BoxGeometry(colSize, towerHeight, colSize);
      checkFiniteLocal(colGeo, 'tower-col-' + i);
      const col = new THREE.Mesh(colGeo, towerMat);
      const angle = (i / 4) * Math.PI * 2;
      col.position.set(
        towerX + Math.cos(angle) * colSize * 0.8,
        padBaseHeight + towerHeight / 2,
        towerZ + Math.sin(angle) * colSize * 0.8
      );
      tower.add(col);
    }

    const beamGeo = new THREE.BoxGeometry(colSize * 2.5, 0.3, colSize * 2.5);
    const beamCount = Math.floor(towerHeight / 4);
    for (let i = 1; i <= beamCount; i++) {
      const y = padBaseHeight + i * 4;
      for (let j = 0; j < 4; j++) {
        const beam = new THREE.Mesh(beamGeo, towerMat);
        const angle = (j / 4) * Math.PI * 2;
        beam.position.set(
          towerX + Math.cos(angle) * colSize * 1.2,
          y,
          towerZ + Math.sin(angle) * colSize * 1.2
        );
        beam.rotation.y = angle;
        tower.add(beam);
      }
    }

    const armHeight = padBaseHeight + towerHeight * 0.7;
    const armGeo = new THREE.BoxGeometry(7, 0.3, 0.3);
    const arm = new THREE.Mesh(armGeo, towerMat);
    arm.position.set(towerX + 3.5, armHeight, towerZ);
    tower.add(arm);

    const beaconGeo = new THREE.SphereGeometry(0.5, 12, 12);
    checkFiniteLocal(beaconGeo, 'beacon');
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(
      towerX,
      padBaseHeight + towerHeight + 0.5,
      towerZ
    );
    tower.add(beacon);

    group.add(tower);
    return { tower, beacon };
  }

  // Build floodlights
  function buildFloodlights() {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const glowCtx = glowCanvas.getContext('2d');
    const grad = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 220, 1)');
    grad.addColorStop(0.5, 'rgba(255, 255, 220, 0.3)');
    grad.addColorStop(1, 'rgba(255, 255, 220, 0)');
    glowCtx.fillStyle = grad;
    glowCtx.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(glowCanvas);

    const spriteMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      fog: false,
    });

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const lightPole = new THREE.Group();

      const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 9, 8);
      checkFiniteLocal(poleGeo, 'floodlight-pole-' + i);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4.5;
      lightPole.add(pole);

      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.8, 8),
        lampMat
      );
      lamp.position.y = 8.8;
      lightPole.add(lamp);

      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, 8.8, 0);
      sprite.scale.set(6 * pixelRatio, 6 * pixelRatio, 1);
      lightPole.add(sprite);

      lightPole.position.set(
        padCenter.x + Math.cos(angle) * 20,
        padBaseHeight,
        padCenter.z + Math.sin(angle) * 20
      );
      group.add(lightPole);
    }
  }

  // Real lights (max 3)
  const light1 = new THREE.PointLight(0xfff1d6, 400, 70, 2);
  light1.position.set(padCenter.x + 12, padBaseHeight + 10, padCenter.z);
  scene.add(light1);

  const light2 = new THREE.PointLight(0xfff1d6, 400, 70, 2);
  light2.position.set(padCenter.x - 12, padBaseHeight + 10, padCenter.z);
  scene.add(light2);

  const light3 = new THREE.PointLight(0xffd9a8, 250, 45, 2);
  light3.position.set(padCenter.x, padBaseHeight + 2, padCenter.z);
  scene.add(light3);

  // Build everything
  buildPad();
  const towerObj = buildTower();
  buildFloodlights();

  // Viewpoint
  const viewDirX = -padDirX;
  const viewDirZ = -padDirZ;
  const viewPoint = {
    position: new THREE.Vector3(
      padCenter.x + viewDirX * 26,
      padBaseHeight + 1.7,
      padCenter.z + viewDirZ * 26
    ),
    lookAt: new THREE.Vector3(
      padCenter.x,
      padBaseHeight + 12,
      padCenter.z
    ),
  };

  // Update loop (blinking beacon)
  let blinkTime = 0;
  function update(delta) {
    blinkTime += delta;
    const beaconIntensity = Math.abs(Math.sin(blinkTime * Math.PI * 2));
    towerObj.beacon.material.emissiveIntensity = 1 + beaconIntensity * 3;
  }

  return {
    group,
    padCenter,
    viewPoint,
    update,
  };
}

export default createLaunchSite;
