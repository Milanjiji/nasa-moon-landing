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

function addPart(scene, geo, mat, name, pos, rot) {
  checkFinite(geo, name);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  scene.add(mesh);
  return mesh;
}

export function buildShell(scene) {
  const shellGeo = new THREE.CylinderGeometry(1.9, 1.9, 4.2, 32, 1, true, -Math.PI / 2, Math.PI);
  shellGeo.rotateX(-Math.PI / 2); shellGeo.translate(0, 0, 0.3);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x1e2735, roughness: 0.85, metalness: 0.2, emissive: 0x0b1220, side: THREE.DoubleSide });
  addPart(scene, shellGeo, shellMat, 'cockpit-shell');

  const ribMat = new THREE.MeshStandardMaterial({ color: 0x2c3a52, metalness: 0.5, roughness: 0.5 });
  const ribGeo = new THREE.TorusGeometry(1.88, 0.02, 8, 32, Math.PI);
  checkFinite(ribGeo, 'cockpit-rib');
  for (const z of [-1.4, -0.7, 0.0, 0.7, 1.4, 2.1]) {
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.set(0, 0, z);
    scene.add(rib);
  }

  const stripMat = new THREE.MeshStandardMaterial({ color: 0x9fc4ff, emissive: 0x9fc4ff, emissiveIntensity: 1.4 });
  const stripGeo = new THREE.BoxGeometry(0.04, 0.015, 3.8);
  checkFinite(stripGeo, 'cockpit-strip');
  for (const x of [-0.5, 0.5]) {
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(x, 1.82, 0.3);
    scene.add(strip);
  }

  const floorCanvas = document.createElement('canvas'); floorCanvas.width = 128; floorCanvas.height = 128;
  const fctx = floorCanvas.getContext('2d'); fctx.fillStyle = '#141b27'; fctx.fillRect(0, 0, 128, 128);
  fctx.strokeStyle = '#1d2738'; fctx.lineWidth = 2; fctx.strokeRect(2, 2, 124, 124);
  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.wrapS = THREE.RepeatWrapping; floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 6);
  const floorGeo = new THREE.PlaneGeometry(3.8, 4.2); floorGeo.rotateX(-Math.PI / 2);
  addPart(scene, floorGeo, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0.1 }), 'floor', [0, 0, 0.3]);
  addPart(scene, new THREE.PlaneGeometry(3.8, 2.0), shellMat, 'backwall', [0, 1.0, 2.4], [0, Math.PI, 0]);
  addPart(scene, new THREE.TorusGeometry(0.45, 0.025, 8, 24), ribMat, 'hatch-rim', [0, 1.0, 2.38]);
  addPart(scene, new THREE.CircleGeometry(0.44, 24), new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.9 }), 'hatch', [0, 1.0, 2.375], [0, Math.PI, 0]);

  const outer = new THREE.Shape();
  outer.moveTo(-1.9, 0); outer.lineTo(1.9, 0); outer.lineTo(1.9, 2.0); outer.lineTo(-1.9, 2.0); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-1.5, 0.95); hole.lineTo(1.5, 0.95); hole.lineTo(1.2, 2.0); hole.lineTo(-1.2, 2.0); hole.closePath();
  outer.holes.push(hole);
  addPart(scene, new THREE.ShapeGeometry(outer), new THREE.MeshStandardMaterial({ color: 0x202a3a, roughness: 0.85, metalness: 0.2, side: THREE.DoubleSide }), 'bulkhead', [0, 0, -1.8]);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a4a66, emissive: 0x1a2c4a, emissiveIntensity: 0.4 });
  addPart(scene, new THREE.BoxGeometry(3.04, 0.04, 0.04), frameMat, 'f-b', [0, 0.95, -1.79]);
  addPart(scene, new THREE.BoxGeometry(2.44, 0.04, 0.04), frameMat, 'f-t', [0, 2.0, -1.79]);
  const sideAng = Math.atan2(0.3, 1.05), sideGeo = new THREE.BoxGeometry(0.04, Math.hypot(0.3, 1.05), 0.04);
  addPart(scene, sideGeo, frameMat, 'f-l', [-1.35, 1.475, -1.79], [0, 0, -sideAng]);
  addPart(scene, sideGeo, frameMat, 'f-r', [1.35, 1.475, -1.79], [0, 0, sideAng]);
}

export function buildWindow(scene) {
  const winShape = new THREE.Shape();
  winShape.moveTo(-1.5, 0.95); winShape.lineTo(1.5, 0.95); winShape.lineTo(1.2, 2.0); winShape.lineTo(-1.2, 2.0); winShape.closePath();
  const winGeo = new THREE.ShapeGeometry(winShape);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  addPart(scene, winGeo, glassMat, 'glass', [0, 0, -1.808], [0.21, 0, 0]);

  const sCanvas = document.createElement('canvas'); sCanvas.width = 256; sCanvas.height = 256;
  const sctx = sCanvas.getContext('2d');
  sctx.clearRect(0, 0, 256, 256); sctx.strokeStyle = 'rgba(230, 240, 255, 0.06)'; sctx.lineWidth = 14;
  sctx.beginPath(); sctx.moveTo(30, 240); sctx.lineTo(220, 20); sctx.stroke();
  addPart(scene, winGeo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sCanvas), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }), 'scratch', [0, 0, -1.804], [0.21, 0, 0]);
}

export function buildSeats(scene) {
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a3345, roughness: 0.8, flatShading: true });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3a4a66, roughness: 0.6 });
  function addSeat(x, hasBelt) {
    addPart(scene, new THREE.BoxGeometry(0.55, 0.16, 0.55), seatMat, `cushion-${x}`, [x, 0.42, 0.45]);
    addPart(scene, new THREE.BoxGeometry(0.52, 0.85, 0.12), seatMat, `back-${x}`, [x, 0.95, 0.75], [-0.1, 0, 0]);
    addPart(scene, new THREE.BoxGeometry(0.32, 0.22, 0.1), seatMat, `head-${x}`, [x, 1.45, 0.81]);
    addPart(scene, new THREE.BoxGeometry(0.06, 0.06, 0.45), pipeMat, `arm-l-${x}`, [x - 0.28, 0.60, 0.45]);
    addPart(scene, new THREE.BoxGeometry(0.06, 0.06, 0.45), pipeMat, `arm-r-${x}`, [x + 0.28, 0.60, 0.45]);
    if (hasBelt) {
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x182030, roughness: 0.9 });
      addPart(scene, new THREE.BoxGeometry(0.06, 0.7, 0.02), beltMat, 'belt1', [x - 0.12, 0.92, 0.70], [-0.1, 0, 0.12]);
      addPart(scene, new THREE.BoxGeometry(0.06, 0.7, 0.02), beltMat, 'belt2', [x + 0.12, 0.92, 0.70], [-0.1, 0, -0.12]);
      addPart(scene, new THREE.BoxGeometry(0.08, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 }), 'buckle', [x, 0.72, 0.68]);
    }
  }
  addSeat(-0.55, false);
  addSeat(0.65, true);
}

export function buildLighting(scene) {
  scene.add(new THREE.HemisphereLight(0x6f8fc4, 0x141b27, 0.55));
  const pDash = new THREE.PointLight(0x6fa8ff, 5.0, 4.0, 2.0); pDash.position.set(0, 1.4, -1.2); scene.add(pDash);
  const pCeil = new THREE.PointLight(0xcfe0ff, 3.0, 5.0, 2.0); pCeil.position.set(0, 1.7, 0.2); scene.add(pCeil);
  const pAmber = new THREE.PointLight(0xffb36b, 1.5, 3.0, 2.0); pAmber.position.set(0.7, 1.0, 0.3); scene.add(pAmber);
  const dirMoon = new THREE.DirectionalLight(0xdbe8ff, 1.3);
  dirMoon.position.set(3.5, 2.8, -15.0); dirMoon.target.position.set(0, 0.8, -1.4);
  scene.add(dirMoon); scene.add(dirMoon.target);
}
