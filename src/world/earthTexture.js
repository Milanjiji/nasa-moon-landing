import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural Earth Canvas Texture Generator
// Creates blue oceans, green/brown continents, and white cloud swirls.
// ---------------------------------------------------------------------------
export function createEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Oceans
  ctx.fillStyle = '#0d2757';
  ctx.fillRect(0, 0, 1024, 512);

  // Continents
  ctx.fillStyle = '#225533';
  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * 1024, Math.random() * 512, 35 + Math.random() * 95, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cloud swirls
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  for (let i = 0; i < 35; i++) {
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 1024,
      Math.random() * 512,
      60 + Math.random() * 140,
      12 + Math.random() * 25,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default createEarthTexture;
