import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural Moon Texture Generator (2048x1024)
// Generates lunar mare, craters, and ray structures.
// ---------------------------------------------------------------------------
export function createMoonTextures() {
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#8a8a90';
  ctx.fillRect(0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const g = 138 + Math.random() * 24 - 12;
    data[i] = g;
    data[i + 1] = g;
    data[i + 2] = g + Math.random() * 6 - 3;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // Large maria
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 90 + Math.random() * 330;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(60, 60, 68, 0.9)');
    grad.addColorStop(0.45, 'rgba(76, 76, 82, 0.55)');
    grad.addColorStop(1, 'rgba(76, 76, 82, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small craters
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 1 + Math.random() * 22;

    const gradIn = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
    gradIn.addColorStop(0, 'rgba(40, 40, 46, 0.85)');
    gradIn.addColorStop(1, 'rgba(120, 120, 128, 0)');
    ctx.fillStyle = gradIn;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(160, 160, 170, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Ray craters
  ctx.strokeStyle = 'rgba(200, 200, 210, 0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    const numRays = 4 + Math.floor(Math.random() * 5);
    const cr = 12 + Math.random() * 20;
    for (let j = 0; j < numRays; j++) {
      const ang = (Math.PI * 2 * j) / numRays + Math.random() * 0.4;
      const len = 60 + Math.random() * 160;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * cr, cy + Math.sin(ang) * cr);
      ctx.lineTo(
        cx + Math.cos(ang) * (cr + len),
        cy + Math.sin(ang) * (cr + len)
      );
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  return { map: texture, bumpMap: texture };
}

export default createMoonTextures;
