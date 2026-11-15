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

function createEarthTexture2048() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const w = 2048, h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    const lat = (0.5 - y / h) * Math.PI;
    const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
    const isPole = Math.abs(lat) > (72 * Math.PI / 180);

    for (let x = 0; x < w; x++) {
      const lon = (x / w) * Math.PI * 2;
      const nx = cosLat * Math.cos(lon);
      const ny = sinLat;
      const nz = cosLat * Math.sin(lon);

      const n = Math.sin(nx * 3.2 + nz * 2.1) * Math.cos(ny * 2.8) +
                Math.sin(nx * 6.5 - ny * 5.2 + 1.2) * 0.5 +
                Math.sin(ny * 13.0 + nz * 11.0 - 0.7) * 0.25 +
                Math.sin(nx * 24.0 + ny * 20.0) * 0.12;

      const idx = (y * w + x) * 4;

      if (isPole || (Math.abs(lat) > (64 * Math.PI / 180) && n > 0.15)) {
        data[idx] = 236; data[idx + 1] = 244; data[idx + 2] = 254; data[idx + 3] = 255;
      } else if (n > 0.26) {
        if (n > 0.7) {
          data[idx] = 118; data[idx + 1] = 102; data[idx + 2] = 68;
        } else if (n > 0.48) {
          data[idx] = 68; data[idx + 1] = 104; data[idx + 2] = 52;
        } else {
          data[idx] = 42; data[idx + 1] = 82; data[idx + 2] = 40;
        }
        data[idx + 3] = 255;
      } else if (n > 0.10) {
        data[idx] = 28; data[idx + 1] = 104; data[idx + 2] = 153; data[idx + 3] = 255;
      } else {
        data[idx] = 10; data[idx + 1] = 34; data[idx + 2] = 84; data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
}

function createCloudsTexture2048() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const w = 2048, h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    const lat = (0.5 - y / h) * Math.PI;
    const cosLat = Math.cos(lat), sinLat = Math.sin(lat);

    for (let x = 0; x < w; x++) {
      const lon = (x / w) * Math.PI * 2;
      const nx = cosLat * Math.cos(lon);
      const ny = sinLat;
      const nz = cosLat * Math.sin(lon);

      const band = Math.sin(lat * 8.0) * 0.3;
      const n = Math.sin(nx * 4.2 + nz * 3.1 + band) * Math.cos(ny * 3.5) +
                Math.sin(nx * 9.5 - ny * 7.5 + 2.1) * 0.5 +
                Math.sin(ny * 18.0 + nz * 15.0 - 1.2) * 0.28;

      const idx = (y * w + x) * 4;
      if (n > 0.35) {
        const alpha = Math.min(255, Math.floor((n - 0.35) * 420));
        data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = alpha;
      } else {
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
}

function createCityLightsTexture1024() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const w = 1024, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    const lat = (0.5 - y / h) * Math.PI;
    const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
    const isPole = Math.abs(lat) > (64 * Math.PI / 180);

    for (let x = 0; x < w; x++) {
      if (isPole) continue;
      const lon = (x / w) * Math.PI * 2;
      const nx = cosLat * Math.cos(lon);
      const ny = sinLat;
      const nz = cosLat * Math.sin(lon);

      const n = Math.sin(nx * 3.2 + nz * 2.1) * Math.cos(ny * 2.8) +
                Math.sin(nx * 6.5 - ny * 5.2 + 1.2) * 0.5 +
                Math.sin(ny * 13.0 + nz * 11.0 - 0.7) * 0.25;

      if (n > 0.32) {
        const dotN = Math.sin(x * 12.3 + y * 9.7);
        if (dotN > 0.82) {
          const idx = (y * w + x) * 4;
          data[idx] = 255;
          data[idx + 1] = 205;
          data[idx + 2] = 130;
          data[idx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
}

export function createEarthBody(options = {}) {
  const R = options.R || 2400;
  const sunDir = (options.sunDir || new THREE.Vector3(0.577, 0.577, 0.577)).clone().normalize();
  const layer = typeof options.layer === 'number' ? options.layer : 1;
  const includeLight = options.includeLight !== false;

  const group = new THREE.Group();
  group.name = 'earth-body';

  let earthMesh = null;
  let cloudsMesh = null;
  let cityLightsMesh = null;
  let atmoMesh = null;
  let dedicatedSunLight = null;

  try {
    const earthGeo = new THREE.SphereGeometry(R, 64, 64);
    checkFinite(earthGeo, 'earthbody-geo');
    const earthTex = createEarthTexture2048();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      bumpMap: earthTex,
      bumpScale: 1.5,
      roughness: 0.9,
      metalness: 0.0,
    });
    earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.name = 'earthbody-mesh';
    earthMesh.castShadow = false;
    earthMesh.receiveShadow = false;
    earthMesh.layers.set(layer);
    group.add(earthMesh);
  } catch (err) {
    console.error('EarthScene part failed: earthbody mesh', err);
  }

  try {
    const cloudsGeo = new THREE.SphereGeometry(R * 1.006, 64, 64);
    checkFinite(cloudsGeo, 'earthbody-clouds-geo');
    const cloudsTex = createCloudsTexture2048();
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      roughness: 1.0,
      metalness: 0.0,
    });
    cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    cloudsMesh.name = 'earthbody-clouds';
    cloudsMesh.castShadow = false;
    cloudsMesh.receiveShadow = false;
    cloudsMesh.layers.set(layer);
    group.add(cloudsMesh);
  } catch (err) {
    console.error('EarthScene part failed: earthbody clouds', err);
  }

  try {
    const cityGeo = new THREE.SphereGeometry(R * 1.001, 64, 64);
    checkFinite(cityGeo, 'earthbody-city-geo');
    const cityTex = createCityLightsTexture1024();

    const cityMat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: cityTex },
        sunDir: { value: sunDir.clone() },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform vec3 sunDir;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        void main() {
          vec4 tex = texture2D(map, vUv);
          float ndotl = dot(vWorldNormal, sunDir);
          float factor = 1.0 - smoothstep(-0.1, 0.25, ndotl);
          gl_FragColor = vec4(tex.rgb * factor, tex.a * factor);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    cityLightsMesh = new THREE.Mesh(cityGeo, cityMat);
    cityLightsMesh.name = 'earthbody-city-lights';
    cityLightsMesh.castShadow = false;
    cityLightsMesh.receiveShadow = false;
    cityLightsMesh.layers.set(layer);
    group.add(cityLightsMesh);
  } catch (err) {
    console.error('EarthScene part failed: earthbody city lights', err);
  }

  try {
    const atmoGeo = new THREE.SphereGeometry(R * 1.025, 64, 64);
    checkFinite(atmoGeo, 'earthbody-atmo-geo');

    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vViewNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vViewNormal;
        varying vec3 vViewDir;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vViewNormal, vViewDir)), 3.0);
          vec3 colBase = vec3(0.353, 0.659, 1.0);
          vec3 colEdge = vec3(0.749, 0.890, 1.0);
          vec3 col = mix(colBase, colEdge, fresnel);
          gl_FragColor = vec4(col * fresnel, fresnel * 0.9);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    atmoMesh.name = 'earthbody-atmo';
    atmoMesh.castShadow = false;
    atmoMesh.receiveShadow = false;
    atmoMesh.layers.set(layer);
    group.add(atmoMesh);
  } catch (err) {
    console.error('EarthScene part failed: earthbody atmosphere', err);
  }

  // Dedicated directional sun light so Earth is lit by its own sun vector
  if (includeLight) {
    try {
      dedicatedSunLight = new THREE.DirectionalLight(0xfff4e0, 2.4);
      dedicatedSunLight.name = 'earthbody-sun-light';
      dedicatedSunLight.position.copy(sunDir.clone().multiplyScalar(R * 8));
      dedicatedSunLight.target = group;
      dedicatedSunLight.layers.set(layer);
      dedicatedSunLight.castShadow = false;
      group.add(dedicatedSunLight);
      group.add(dedicatedSunLight.target);
    } catch (err) {
      console.error('EarthScene part failed: earthbody sun light', err);
    }
  }

  function update(delta, prefersReduced) {
    const rotSpeed = prefersReduced ? 0.0005 : 0.004;
    const cloudRotSpeed = prefersReduced ? 0.0006 : 0.006;
    if (earthMesh) earthMesh.rotation.y += delta * rotSpeed;
    if (cityLightsMesh) cityLightsMesh.rotation.y += delta * rotSpeed;
    if (cloudsMesh) cloudsMesh.rotation.y += delta * cloudRotSpeed;
  }

  function setSunDir(dir) {
    if (cityLightsMesh?.material?.uniforms?.sunDir) {
      cityLightsMesh.material.uniforms.sunDir.value.copy(dir);
    }
    if (dedicatedSunLight) {
      dedicatedSunLight.position.copy(dir.clone().normalize().multiplyScalar(R * 8));
    }
  }

  function dispose() {
    if (earthMesh) {
      earthMesh.geometry.dispose();
      earthMesh.material.map?.dispose();
      earthMesh.material.dispose();
    }
    if (cloudsMesh) {
      cloudsMesh.geometry.dispose();
      cloudsMesh.material.map?.dispose();
      cloudsMesh.material.dispose();
    }
    if (cityLightsMesh) {
      cityLightsMesh.geometry.dispose();
      cityLightsMesh.material.uniforms.map.value?.dispose();
      cityLightsMesh.material.dispose();
    }
    if (atmoMesh) {
      atmoMesh.geometry.dispose();
      atmoMesh.material.dispose();
    }
    if (dedicatedSunLight) {
      dedicatedSunLight.dispose?.();
    }
  }

  return {
    group,
    earthMesh,
    cloudsMesh,
    cityLightsMesh,
    atmoMesh,
    update,
    setSunDir,
    dispose,
  };
}

export default createEarthBody;
