import * as THREE from 'three';
import { createStandbyScreen } from './dashboardCanvases.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function checkFinite(geometry, name) {
  if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
  const array = geometry.attributes.position.array;
  for (let i = 0; i < array.length; i += 3) {
    if (!isFinite(array[i]) || !isFinite(array[i + 1]) || !isFinite(array[i + 2])) {
      console.warn(`NaN/Inf in geometry "${name}" at vertex ${i / 3}: (${array[i]}, ${array[i + 1]}, ${array[i + 2]})`);
      return;
    }
  }
}

function addPart(scene, geo, mat, name, pos, rot) {
  checkFinite(geo, name);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  scene.add(mesh);
  return mesh;
}

export function surfaceY(z) {
  return 0.50 - ((z + 0.70) / 1.10) * 0.30;
}

// ---------------------------------------------------------------------------
// Dashboard Builder (Wedge Console, Screens, Controls)
// ---------------------------------------------------------------------------
export function buildDashboard(scene, camera, updateFns) {
  const anchors = {};
  const sampleButtons = [];
  const interactiveTargets = [];
  const SLOPE_X = Math.atan2(0.30, 1.10);

  // 1) Console Wedge
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(-0.70, 0);
  wedgeShape.lineTo(-0.70, 0.50);
  wedgeShape.lineTo(-1.80, 0.80);
  wedgeShape.lineTo(-1.80, 0);
  wedgeShape.closePath();
  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 3.4, bevelEnabled: false });
  wedgeGeo.rotateY(-Math.PI / 2);
  wedgeGeo.translate(1.7, 0, 0);
  const consoleMat = new THREE.MeshStandardMaterial({
    color: 0x2b3a58,
    roughness: 0.55,
    metalness: 0.35,
    emissive: 0x10203a,
    emissiveIntensity: 0.7,
  });
  addPart(scene, wedgeGeo, consoleMat, 'console');

  // Trim lines
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5b86d6, emissive: 0x5b86d6, emissiveIntensity: 0.9 });
  addPart(scene, new THREE.BoxGeometry(3.4, 0.015, 0.02), trimMat, 'trim-front', [0, 0.50, -0.70], [SLOPE_X, 0, 0]);
  addPart(scene, new THREE.BoxGeometry(3.4, 0.015, 0.02), trimMat, 'trim-back', [0, 0.80, -1.80]);

  // 2) Screens
  const screenConfigs = [
    { id: 'main', title: 'Mission overview', pos: [-0.58, 0.82, -1.05], size: [0.88, 0.50] },
    { id: 'left', title: 'Life support', pos: [-1.30, 0.92, -1.25], size: [0.55, 0.38] },
    { id: 'right', title: 'Route', pos: [0.32, 0.92, -1.25], size: [0.55, 0.38] },
    { id: 'co', title: 'Mission log', pos: [1.05, 0.92, -1.15], size: [0.72, 0.44] },
    { id: 'top', title: 'Mission clock', pos: [0.00, 1.20, -1.74], size: [1.08, 0.16] },
  ];

  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x3a4a66, emissive: 0x1a2c4a, emissiveIntensity: 0.5 });
  const baseBlockMat = new THREE.MeshStandardMaterial({ color: 0x222e44, metalness: 0.4, roughness: 0.7 });

  for (const sc of screenConfigs) {
    const group = new THREE.Group();
    group.name = `screen-group-${sc.id}`;
    group.position.set(sc.pos[0], sc.pos[1], sc.pos[2]);
    group.lookAt(camera.position);

    const { canvas, ctx, texture } = createStandbyScreen(sc.id, sc.title, sc.size[0], sc.size[1]);
    const screenMat = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const sGeo = new THREE.PlaneGeometry(sc.size[0], sc.size[1]);
    checkFinite(sGeo, `screen-${sc.id}`);
    const mesh = new THREE.Mesh(sGeo, screenMat);
    mesh.name = `screen-${sc.id}`;
    mesh.position.set(0, 0, 0.015);
    group.add(mesh);

    const bGeo = new THREE.BoxGeometry(sc.size[0] + 0.03, sc.size[1] + 0.03, 0.02);
    checkFinite(bGeo, `bezel-${sc.id}`);
    const bezel = new THREE.Mesh(bGeo, bezelMat);
    bezel.name = `bezel-${sc.id}`;
    bezel.position.set(0, 0, -0.01);
    group.add(bezel);

    const surfY = surfaceY(sc.pos[2]);
    const bottomY = sc.pos[1] - sc.size[1] / 2;
    const baseH = Math.max(0.015, bottomY - surfY);
    const baseGeo = new THREE.BoxGeometry(0.18, baseH, 0.06);
    checkFinite(baseGeo, `base-${sc.id}`);
    const baseMesh = new THREE.Mesh(baseGeo, baseBlockMat);
    baseMesh.name = `base-${sc.id}`;
    baseMesh.position.set(0, -(sc.size[1] / 2 + baseH / 2), 0);
    group.add(baseMesh);

    scene.add(group);
    anchors[sc.id] = { mesh, width: sc.size[0], height: sc.size[1], canvas, ctx, texture, group };
  }

  // 3) Buttons (individual meshes for separate raycasting and interaction)
  const btnGeo = new THREE.BoxGeometry(0.05, 0.025, 0.05);
  checkFinite(btnGeo, 'btn-geo');

  const aColors = [0x3f8cff, 0xffb020, 0x34d399];
  for (let i = 0; i < 10; i++) {
    const bx = -1.5 + (i / 9) * 1.3;
    const bz = -0.85;
    const btnMat = new THREE.MeshStandardMaterial({
      color: aColors[i % aColors.length],
      roughness: 0.4,
      metalness: 0.2,
    });
    const btn = addPart(
      scene,
      btnGeo,
      btnMat,
      `btnA-${i}`,
      [bx, surfaceY(bz) + 0.0125 * Math.cos(SLOPE_X), bz + 0.0125 * Math.sin(SLOPE_X)],
      [SLOPE_X, 0, 0]
    );
    btn.userData = { kind: 'button', name: btn.name, defaultEmissiveIntensity: 0 };
    interactiveTargets.push(btn);
    if (i === 4 || i === 7 || i === 9) sampleButtons.push(btn);
  }

  const bColors = [0xff5b5b, 0xffb020, 0x3f8cff, 0x34d399];
  for (let i = 0; i < 8; i++) {
    const bx = 0.2 + (i / 7) * 1.2;
    const bz = -0.85;
    const btnMat = new THREE.MeshStandardMaterial({
      color: bColors[i % bColors.length],
      roughness: 0.4,
      metalness: 0.2,
    });
    const btn = addPart(
      scene,
      btnGeo,
      btnMat,
      `btnB-${i}`,
      [bx, surfaceY(bz) + 0.0125 * Math.cos(SLOPE_X), bz + 0.0125 * Math.sin(SLOPE_X)],
      [SLOPE_X, 0, 0]
    );
    btn.userData = { kind: 'button', name: btn.name, defaultEmissiveIntensity: 0 };
    interactiveTargets.push(btn);
    if (i === 0 || i === 3 || i === 6) sampleButtons.push(btn);
  }

  // 8 toggle switches
  const swGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12);
  checkFinite(swGeo, 'switch-cyl');
  const swMat = new THREE.MeshStandardMaterial({ color: 0xc8d6e5, metalness: 0.8, roughness: 0.3 });
  const swXList = [-1.60, -1.52, -1.45, -1.38, 1.35, 1.42, 1.50, 1.58];
  for (let i = 0; i < swXList.length; i++) {
    const sx = swXList[i];
    const sz = -0.92;
    const sw = addPart(
      scene,
      swGeo,
      swMat,
      `switch-${i}`,
      [sx, surfaceY(sz) + 0.025 * Math.cos(SLOPE_X), sz + 0.025 * Math.sin(SLOPE_X)],
      [SLOPE_X, 0, 0]
    );
    sw.userData = { kind: 'toggle', name: sw.name, defaultEmissiveIntensity: 0, toggled: false };
    interactiveTargets.push(sw);
  }

  // 4 dials
  const dialGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20);
  checkFinite(dialGeo, 'dial-cyl');
  const dialMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.5, roughness: 0.5 });
  const dialXList = [-0.09, -0.01, 0.07, 0.15];
  for (let i = 0; i < dialXList.length; i++) {
    const dx = dialXList[i];
    const dz = -0.78;
    const dial = addPart(
      scene,
      dialGeo,
      dialMat,
      `dial-${i}`,
      [dx, surfaceY(dz) + 0.01 * Math.cos(SLOPE_X), dz + 0.01 * Math.sin(SLOPE_X)],
      [SLOPE_X, 0, 0]
    );
    dial.userData = { kind: 'dial', name: dial.name, defaultEmissiveIntensity: 0 };
    interactiveTargets.push(dial);
  }

  // Launch button
  const lBtnGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24);
  checkFinite(lBtnGeo, 'launch-btn-geo');
  const lBtnMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x22c55e, emissiveIntensity: 1.5 });
  const lz = -0.88;
  const launchButton = addPart(
    scene,
    lBtnGeo,
    lBtnMat,
    'launchButton',
    [0.05, surfaceY(lz) + 0.015 * Math.cos(SLOPE_X), lz + 0.015 * Math.sin(SLOPE_X)],
    [SLOPE_X, 0, 0]
  );
  launchButton.userData = { kind: 'launch', name: 'launchButton', defaultEmissiveIntensity: 1.5 };
  interactiveTargets.push(launchButton);

  const lRingGeo = new THREE.TorusGeometry(0.07, 0.008, 8, 24);
  checkFinite(lRingGeo, 'launch-ring-geo');
  addPart(scene, lRingGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 }), 'launch-ring', [0.05, surfaceY(lz) + 0.025 * Math.cos(SLOPE_X), lz + 0.025 * Math.sin(SLOPE_X)], [SLOPE_X, 0, 0]);

  // Overhead panel strip
  addPart(scene, new THREE.BoxGeometry(0.7, 0.03, 1.2), new THREE.MeshStandardMaterial({ color: 0x1c2433, metalness: 0.4 }), 'overhead', [0, 1.85, 0.1]);

  let pulseTime = 0;
  updateFns.push((delta) => {
    pulseTime += delta * 2.8;
    lBtnMat.emissiveIntensity = 1.0 + Math.sin(pulseTime) * 0.8;
  });

  return { anchors, launchButton, sampleButtons, interactiveTargets, screenConfigs };
}

// ---------------------------------------------------------------------------
// Step 3 - Self-Check & Overlap Check
// ---------------------------------------------------------------------------
export function checkCockpitVisibility(scene, camera, screenAnchors, launchButton, sampleButtons) {
  camera.updateMatrixWorld(true);
  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

  const raycaster = new THREE.Raycaster();
  const rows = [];
  const screenBoxes = [];

  const screenIds = ['main', 'left', 'right', 'co', 'top'];
  for (const id of screenIds) {
    const sc = screenAnchors[id];
    if (!sc || !sc.mesh) continue;
    const worldPos = new THREE.Vector3();
    sc.mesh.getWorldPosition(worldPos);
    const inFrustum = frustum.containsPoint(worldPos);

    const worldQuat = new THREE.Quaternion();
    sc.mesh.getWorldQuaternion(worldQuat);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat);
    const toCam = new THREE.Vector3().subVectors(camera.position, worldPos).normalize();
    const facing = normal.dot(toCam);

    raycaster.ray.origin.copy(camera.position);
    raycaster.ray.direction.copy(new THREE.Vector3().subVectors(worldPos, camera.position).normalize());
    const hits = raycaster.intersectObjects(scene.children, true);
    const firstHit = hits[0] ? hits[0].object.name : 'none';
    const isOk = inFrustum && facing >= 0.6 && firstHit.includes(id);

    rows.push({ name: id, inView: inFrustum, facing: parseFloat(facing.toFixed(3)), firstHit, ok: isOk });

    // Project 4 corners to NDC for overlap check
    const hw = sc.width / 2;
    const hh = sc.height / 2;
    const corners = [
      new THREE.Vector3(-hw, -hh, 0).applyMatrix4(sc.mesh.matrixWorld).project(camera),
      new THREE.Vector3(hw, -hh, 0).applyMatrix4(sc.mesh.matrixWorld).project(camera),
      new THREE.Vector3(hw, hh, 0).applyMatrix4(sc.mesh.matrixWorld).project(camera),
      new THREE.Vector3(-hw, hh, 0).applyMatrix4(sc.mesh.matrixWorld).project(camera),
    ];
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));
    screenBoxes.push({ id, minX, maxX, minY, maxY, area: (maxX - minX) * (maxY - minY) });
  }

  if (launchButton) {
    const lbPos = new THREE.Vector3();
    launchButton.getWorldPosition(lbPos);
    const inFrustum = frustum.containsPoint(lbPos);
    raycaster.ray.origin.copy(camera.position);
    raycaster.ray.direction.copy(new THREE.Vector3().subVectors(lbPos, camera.position).normalize());
    const hits = raycaster.intersectObjects(scene.children, true);
    const firstHit = hits[0] ? hits[0].object.name : 'none';
    rows.push({ name: 'launchButton', inView: inFrustum, facing: 1.0, firstHit, ok: inFrustum && firstHit === 'launchButton' });
  }

  for (const sb of sampleButtons) {
    const pos = new THREE.Vector3();
    sb.getWorldPosition(pos);
    const inFrustum = frustum.containsPoint(pos);
    raycaster.ray.origin.copy(camera.position);
    raycaster.ray.direction.copy(new THREE.Vector3().subVectors(pos, camera.position).normalize());
    const hits = raycaster.intersectObjects(scene.children, true);
    const firstHit = hits[0] ? hits[0].object.name : 'none';
    const isOk = inFrustum && firstHit === sb.name;
    rows.push({ name: sb.name, inView: inFrustum, facing: 1.0, firstHit, ok: isOk });
  }

  console.log('Cockpit visibility check');
  console.table(rows);

  // Overlap calculation
  const overlapRows = [];
  for (let i = 0; i < screenBoxes.length; i++) {
    for (let j = i + 1; j < screenBoxes.length; j++) {
      const b1 = screenBoxes[i];
      const b2 = screenBoxes[j];
      const ox = Math.max(0, Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX));
      const oy = Math.max(0, Math.min(b1.maxY, b2.maxY) - Math.max(b1.minY, b2.minY));
      const oArea = ox * oy;
      const minArea = Math.min(b1.area, b2.area);
      const pct = minArea > 0 ? (oArea / minArea) * 100 : 0;
      overlapRows.push({
        pair: `${b1.id} - ${b2.id}`,
        overlapPercent: `${pct.toFixed(1)}%`,
      });
    }
  }
  console.log('Cockpit screen overlap');
  console.table(overlapRows);

  // Moon coverage calculation
  const moonCenter = new THREE.Vector3(35, 28, -220).project(camera);
  const moonEdge = new THREE.Vector3(35 + 40, 28, -220).project(camera);
  const r = Math.abs(moonEdge.x - moonCenter.x);
  const aspect = camera.aspect || (16 / 9);
  const moonMinX = moonCenter.x - r;
  const moonMaxX = moonCenter.x + r;
  const moonMinY = moonCenter.y - r * aspect;
  const moonMaxY = moonCenter.y + r * aspect;
  const moonArea = Math.PI * r * (r * aspect);

  let moonCoveredArea = 0;
  for (let i = 0; i < screenBoxes.length; i++) {
    const b = screenBoxes[i];
    const ox = Math.max(0, Math.min(b.maxX, moonMaxX) - Math.max(b.minX, moonMinX));
    const oy = Math.max(0, Math.min(b.maxY, moonMaxY) - Math.max(b.minY, moonMinY));
    moonCoveredArea += ox * oy;
  }
  const moonCoveredPct = (moonCoveredArea / moonArea) * 100;
  console.log(`Moon covered by screens: ${moonCoveredPct.toFixed(1)}% (at least 60% visible: ${moonCoveredPct <= 40 ? 'ok' : 'FAILED'})`);
}
