import * as THREE from 'three';
import { createEarthBody } from '../../world/earthBody.js';

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

export function dirFromAngles(azimuthDeg, elevationDeg) {
  const azRad = (azimuthDeg || 0) * (Math.PI / 180);
  const elRad = (elevationDeg || 0) * (Math.PI / 180);
  const x = Math.sin(azRad) * Math.cos(elRad);
  const y = Math.sin(elRad);
  const z = -Math.cos(azRad) * Math.cos(elRad);
  return new THREE.Vector3(x, y, z).normalize();
}

function createGlareTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 250, 1.0)');
  grad.addColorStop(0.15, 'rgba(255, 245, 210, 0.85)');
  grad.addColorStop(0.4, 'rgba(255, 230, 160, 0.35)');
  grad.addColorStop(0.7, 'rgba(255, 220, 140, 0.08)');
  grad.addColorStop(1.0, 'rgba(255, 210, 120, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSurfaceSky({ scene, site }) {
  const sData = site?.surface || {
    sunElevationDeg: 9,
    sunAzimuthDeg: -70,
    sunIntensity: 2.6,
    earthElevationDeg: 24,
    earthAzimuthDeg: 20,
    earthDiameterDeg: 7,
    earthshine: 0.25,
    floodlights: false,
    wallHeightDeg: 0,
  };

  const group = new THREE.Group();
  group.name = 'surface-sky-group';
  scene.add(group);

  scene.background = new THREE.Color(0x000000);

  let stars = null;
  let sunLight = null;
  let sunGlare = null;
  let earthBody = null;
  let earthshineLight = null;
  const floodlights = [];

  // 1. Stars (3500 points, radius 5200)
  try {
    const starCount = 3500;
    const starGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      let vx, vy, vz, len;
      do {
        vx = Math.random() * 2 - 1;
        vy = Math.random() * 2 - 1;
        vz = Math.random() * 2 - 1;
        len = Math.hypot(vx, vy, vz);
      } while (len < 1e-6);

      const inv = 5200 / len;
      pos[i * 3] = vx * inv;
      pos[i * 3 + 1] = vy * inv;
      pos[i * 3 + 2] = vz * inv;

      const pick = Math.random();
      const c = pick < 0.75 ? [0.95, 0.98, 1.0] : (pick < 0.9 ? [0.82, 0.9, 1.0] : [1.0, 0.92, 0.82]);
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    checkFinite(starGeo, 'surface-stars');

    const starMat = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      sizeAttenuation: false,
      fog: false,
    });
    stars = new THREE.Points(starGeo, starMat);
    stars.name = 'surface-stars';
    stars.frustumCulled = false;
    stars.renderOrder = -30;
    stars.layers.enable(1);
    group.add(stars);
  } catch (err) {
    console.error('EarthScene part failed: surface stars', err);
  }

  // 2. Sun Directional Light & Shadow Camera
  const sunDir = dirFromAngles(sData.sunAzimuthDeg, sData.sunElevationDeg);
  try {
    sunLight = new THREE.DirectionalLight(0xfff4e0, sData.sunIntensity);
    sunLight.name = 'surface-sun';
    sunLight.position.copy(sunDir.clone().multiplyScalar(3000));
    sunLight.target.position.set(0, 0, 0);

    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -70;
    sunLight.shadow.camera.right = 70;
    sunLight.shadow.camera.top = 70;
    sunLight.shadow.camera.bottom = -70;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 5000;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.03;

    group.add(sunLight);
    group.add(sunLight.target);
  } catch (err) {
    console.error('EarthScene part failed: surface sun light', err);
  }

  // Sun glare sprite for ridge site
  if (sData.wallHeightDeg === 0 && sData.sunElevationDeg > 0) {
    try {
      const glareTex = createGlareTexture();
      const glareMat = new THREE.SpriteMaterial({
        map: glareTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      sunGlare = new THREE.Sprite(glareMat);
      sunGlare.name = 'surface-sun-glare';
      sunGlare.position.copy(sunDir.clone().multiplyScalar(4000));
      const glareDiameter = 4000 * Math.tan((9 * Math.PI) / 180);
      sunGlare.scale.set(glareDiameter, glareDiameter, 1);
      group.add(sunGlare);
    } catch (err) {
      console.error('EarthScene part failed: surface sun glare', err);
    }
  }

  // 3. Earth Body
  const earthDir = dirFromAngles(sData.earthAzimuthDeg, sData.earthElevationDeg);
  try {
    const earthDist = 4000;
    const earthRad = earthDist * Math.tan(((sData.earthDiameterDeg || 7) * 0.5 * Math.PI) / 180);

    earthBody = createEarthBody({
      R: earthRad,
      sunDir: new THREE.Vector3(0.577, 0.577, 0.577).normalize(),
      layer: 1,
      includeLight: true,
    });

    earthBody.group.position.copy(earthDir.clone().multiplyScalar(earthDist));
    group.add(earthBody.group);
  } catch (err) {
    console.error('EarthScene part failed: surface earth body', err);
  }

  // 4. Fill Lights: Hemisphere fill and Earthshine
  try {
    const hemiFill = new THREE.HemisphereLight(0x0a1226, 0x000000, 0.12);
    hemiFill.name = 'surface-hemi';
    group.add(hemiFill);

    earthshineLight = new THREE.DirectionalLight(0x9fc4ff, sData.earthshine || 0.25);
    earthshineLight.name = 'surface-earthshine';
    earthshineLight.position.copy(earthDir.clone().multiplyScalar(1000));
    earthshineLight.target.position.set(0, 0, 0);
    earthshineLight.castShadow = false;
    group.add(earthshineLight);
    group.add(earthshineLight.target);
  } catch (err) {
    console.error('EarthScene part failed: surface fill lights', err);
  }

  // 5. Floodlights (crater site)
  if (sData.floodlights) {
    try {
      const lampPositions = [
        new THREE.Vector3(-1.4, 2.0, -1.8),
        new THREE.Vector3(1.4, 2.0, -1.8),
      ];
      const lampTargets = [
        new THREE.Vector3(-3.0, 0, -8.0),
        new THREE.Vector3(3.0, 0, -8.0),
      ];

      for (let i = 0; i < lampPositions.length; i++) {
        const spot = new THREE.SpotLight(0xffd9a8, 260, 60, 0.9, 0.6, 2.0);
        spot.position.copy(lampPositions[i]);
        spot.target.position.copy(lampTargets[i]);
        spot.castShadow = false;
        group.add(spot);
        group.add(spot.target);
        floodlights.push(spot);

        // Emissive lamp bulb
        const bulbGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2b8 });
        const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        bulbMesh.position.copy(lampPositions[i]);
        group.add(bulbMesh);
      }
    } catch (err) {
      console.error('EarthScene part failed: surface floodlights', err);
    }
  }

  function update(delta, prefersReduced) {
    if (earthBody?.update) {
      earthBody.update(delta, prefersReduced);
    }
  }

  function dispose() {
    if (stars) {
      stars.geometry.dispose();
      stars.material.dispose();
    }
    if (sunGlare) {
      sunGlare.material.map?.dispose();
      sunGlare.material.dispose();
    }
    if (earthBody?.dispose) {
      earthBody.dispose();
    }
    for (let i = 0; i < floodlights.length; i++) {
      floodlights[i].dispose?.();
    }
    scene.remove(group);
  }

  return {
    group,
    earthBody,
    sunLight,
    update,
    dispose,
  };
}

export default createSurfaceSky;
