import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Standby Screen Canvas Generator
// ---------------------------------------------------------------------------
export function createStandbyScreen(id, title, width, height) {
  const cw = id === 'top' ? 1024 : 768;
  const ch = Math.max(64, Math.round(cw * (height / width)));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#07122a';
  ctx.fillRect(0, 0, cw, ch);

  // Faint grid lines (#12305a)
  ctx.strokeStyle = '#12305a';
  ctx.lineWidth = 1;
  const step = 48;
  for (let x = step; x < cw; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ch);
    ctx.stroke();
  }
  for (let y = step; y < ch; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cw, y);
    ctx.stroke();
  }

  // Thin cyan border (#3fd0ff, 3 px)
  ctx.strokeStyle = '#3fd0ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, cw - 3, ch - 3);

  // Margins (at least 5%)
  const marginX = Math.round(cw * 0.06);
  const marginY = Math.max(16, Math.round(ch * 0.08));

  // Label in top-left in light blue (#9fd8ff)
  const fontSize = Math.min(32, Math.max(22, Math.round(ch * 0.12)));
  ctx.fillStyle = '#9fd8ff';
  ctx.font = `600 ${fontSize}px 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(title, marginX, marginY);

  // Static blinking-dot area
  const dotR = Math.max(4, Math.min(8, Math.round(fontSize * 0.3)));
  ctx.fillStyle = '#3fd0ff';
  ctx.beginPath();
  ctx.arc(cw - marginX, marginY + fontSize / 2, dotR, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.toneMapped = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return { canvas, ctx, texture };
}

export default createStandbyScreen;
