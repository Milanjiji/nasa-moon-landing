// ---------------------------------------------------------------------------
// Cockpit Landing Camera Feed Renderer
// ---------------------------------------------------------------------------

import { formatAltitude } from '../game/landingSequence.js';

const BOULDER_DATA = [
  { dx: -24, dy: -18, rx: 7, ry: 5, sl: 18 },
  { dx: 32, dy: -28, rx: 9, ry: 6, sl: 22 },
  { dx: -38, dy: 14, rx: 8, ry: 5, sl: 20 },
  { dx: 18, dy: 22, rx: 6, ry: 4, sl: 15 },
  { dx: -12, dy: 35, rx: 11, ry: 7, sl: 26 },
  { dx: 42, dy: 12, rx: 7, ry: 5, sl: 17 },
  { dx: -45, dy: -32, rx: 10, ry: 6, sl: 24 },
  { dx: 8, dy: -42, rx: 6, ry: 4, sl: 14 },
  { dx: 26, dy: 38, rx: 9, ry: 6, sl: 21 },
  { dx: -28, dy: 45, rx: 8, ry: 5, sl: 19 },
  { dx: 50, dy: -14, rx: 7, ry: 4, sl: 16 },
  { dx: -15, dy: -48, rx: 9, ry: 6, sl: 22 },
];

export function createLandingFeed({ siteId = 'ridge' }) {
  let surfaceCanvas = null;
  let isBuilt = false;

  function buildSurface() {
    if (typeof document === 'undefined') return;
    try {
      surfaceCanvas = document.createElement('canvas');
      surfaceCanvas.width = 1024;
      surfaceCanvas.height = 1024;
      const sctx = surfaceCanvas.getContext('2d');

      const isCrater = siteId === 'crater';
      sctx.fillStyle = isCrater ? '#6b7280' : '#9ca3af';
      sctx.fillRect(0, 0, 1024, 1024);

      // Noise passes
      const nCanvas = document.createElement('canvas');
      nCanvas.width = 128;
      nCanvas.height = 128;
      const nctx = nCanvas.getContext('2d');
      for (let x = 0; x < 128; x += 2) {
        for (let y = 0; y < 128; y += 2) {
          const val = Math.random();
          nctx.fillStyle = val > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
          nctx.fillRect(x, y, 2, 2);
        }
      }
      sctx.drawImage(nCanvas, 0, 0, 1024, 1024);

      // Craters (about 450)
      for (let i = 0; i < 450; i++) {
        const cx = Math.random() * 1024;
        const cy = Math.random() * 1024;
        const r = 2 + Math.pow(Math.random(), 3) * 36;

        sctx.fillStyle = 'rgba(20, 24, 35, 0.4)';
        sctx.beginPath();
        sctx.arc(cx, cy, r, 0, Math.PI * 2);
        sctx.fill();

        sctx.strokeStyle = isCrater ? 'rgba(200, 210, 230, 0.35)' : 'rgba(255, 255, 255, 0.4)';
        sctx.lineWidth = Math.max(1, r * 0.15);
        sctx.beginPath();
        sctx.arc(cx, cy, r, 0.6 * Math.PI, 1.4 * Math.PI);
        sctx.stroke();
      }

      if (isCrater) {
        // Big central crater
        const ccx = 512, ccy = 512, cr = 240;
        const grad = sctx.createRadialGradient(ccx - 40, ccy - 30, 20, ccx, ccy, cr);
        grad.addColorStop(0, '#1f2937');
        grad.addColorStop(0.7, '#374151');
        grad.addColorStop(1, '#4b5563');
        sctx.fillStyle = grad;
        sctx.beginPath();
        sctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
        sctx.fill();

        sctx.strokeStyle = 'rgba(229, 231, 235, 0.6)';
        sctx.lineWidth = 14;
        sctx.beginPath();
        sctx.arc(ccx, ccy, cr, 0.7 * Math.PI, 1.5 * Math.PI);
        sctx.stroke();
      } else {
        // Ridge band
        const rGrad = sctx.createLinearGradient(0, 380, 1024, 644);
        rGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        rGrad.addColorStop(0.48, 'rgba(255, 255, 255, 0.35)');
        rGrad.addColorStop(0.52, 'rgba(30, 35, 45, 0.45)');
        rGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sctx.fillStyle = rGrad;
        sctx.fillRect(0, 350, 1024, 324);
      }

      isBuilt = true;
    } catch (err) {
      console.error('EarthScene part failed: landing surface canvas', err);
    }
  }

  function draw(ctx, w, h, data) {
    if (!ctx) return;
    if (!isBuilt) buildSurface();

    const prefersReduced = (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );

    const mx = Math.round(w * 0.05);
    const my = Math.round(h * 0.05);
    const feedW = w - mx * 2;
    const feedH = h - my * 2;
    const cx = w * 0.5;
    const cy = h * 0.5;

    ctx.save();

    // Clip to rounded screen feed inside 5% margin
    ctx.beginPath();
    ctx.roundRect(mx, my, feedW, feedH, 10);
    ctx.clip();

    // Background fill
    ctx.fillStyle = '#111827';
    ctx.fillRect(mx, my, feedW, feedH);

    // Draw terrain with zoom and drift
    if (surfaceCanvas) {
      ctx.save();
      const zoom = data.zoom || 0.12;
      const driftX = prefersReduced ? 0 : Math.sin((data.time || 0) * 0.4) * 12;
      const driftY = prefersReduced ? 0 : Math.cos((data.time || 0) * 0.3) * 10;

      ctx.translate(cx + driftX, cy + driftY);
      ctx.scale(zoom, zoom);
      ctx.drawImage(surfaceCanvas, -512, -512);
      ctx.restore();
    }

    // Shadow of lander below 150m
    const alt = data.altitudeM || 0;
    if (alt < 150) {
      const shadowFrac = Math.max(0, Math.min(1, alt / 150));
      const sRadius = 14 + 18 * shadowFrac;
      const sAlpha = 0.85 - 0.5 * shadowFrac;
      ctx.fillStyle = `rgba(10, 12, 18, ${sAlpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20, sRadius * 1.6, sRadius, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boulders hazard (when hazard is true, fading in below 800m)
    if (data.hazard && alt < 800) {
      const bFrac = Math.min(1, (800 - alt) / 200);
      ctx.save();
      ctx.translate(cx, cy);

      for (let i = 0; i < BOULDER_DATA.length; i++) {
        const b = BOULDER_DATA[i];
        // Shadow
        ctx.fillStyle = `rgba(15, 20, 30, ${(0.65 * bFrac).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(b.dx + b.sl * 0.6, b.dy + b.sl * 0.3, b.rx * 1.5, b.ry * 0.8, 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Boulder body
        ctx.fillStyle = `rgba(55, 65, 81, ${(0.9 * bFrac).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(b.dx, b.dy, b.rx, b.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Flat patch indicator on divert side
      const flatX = cx + (w * 0.22);
      const flatY = cy - 20;
      ctx.restore();

      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(flatX, flatY, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#34d399';
      ctx.font = '500 13px "Space Grotesk", sans-serif';
      ctx.fillText('Flat ground', flatX + 32, flatY - 6);
    }

    // Dust haze below 60m
    if (alt < 60 && data.dust > 0.01) {
      const dustGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, feedW * 0.45);
      dustGrad.addColorStop(0, `rgba(220, 225, 235, ${(data.dust * 0.35).toFixed(2)})`);
      dustGrad.addColorStop(1, 'rgba(220, 225, 235, 0)');
      ctx.fillStyle = dustGrad;
      ctx.fillRect(mx, my, feedW, feedH);
    }

    // Camera look: scanlines & cool tint
    if (!prefersReduced) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let y = my; y < my + feedH; y += 4) {
        ctx.fillRect(mx, y, feedW, 1.5);
      }
    }
    ctx.fillStyle = 'rgba(15, 28, 55, 0.15)';
    ctx.fillRect(mx, my, feedW, feedH);

    // HUD: Corner brackets
    const bLen = 22;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;

    // Top-left
    ctx.beginPath(); ctx.moveTo(mx + 14, my + 14 + bLen); ctx.lineTo(mx + 14, my + 14); ctx.lineTo(mx + 14 + bLen, my + 14); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(w - mx - 14 - bLen, my + 14); ctx.lineTo(w - mx - 14, my + 14); ctx.lineTo(w - mx - 14, my + 14 + bLen); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(mx + 14, h - my - 14 - bLen); ctx.lineTo(mx + 14, h - my - 14); ctx.lineTo(mx + 14 + bLen, h - my - 14); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(w - mx - 14 - bLen, h - my - 14); ctx.lineTo(w - mx - 14, h - my - 14); ctx.lineTo(w - mx - 14, h - my - 14 - bLen); ctx.stroke();

    // Crosshair
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // Target ring
    const tShift = (data.targetOffsetX || 0) * feedW;
    const targetX = cx + tShift;
    const tPulse = prefersReduced ? 0 : 2 * Math.sin((data.time || 0) * 4);
    ctx.strokeStyle = '#3fd0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, cy, 22 + tPulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e8f3ff';
    ctx.font = '600 13px "Space Grotesk", sans-serif';
    ctx.fillText('Target', targetX + 28, cy - 6);

    // Title top-left
    ctx.font = '700 22px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#3fd0ff';
    ctx.textBaseline = 'top';
    ctx.fillText('Landing camera', mx + 24, my + 20);

    // Readouts bottom in sentence case
    const botY = h - my - 34;
    const altStr = formatAltitude(alt);
    ctx.font = '600 22px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Altitude ${altStr}`, mx + 24, botY);

    const vSpeed = (data.vSpeedMs || 0).toFixed(1);
    let spdColor = '#34d399';
    if (alt < 100) {
      if (data.vSpeedMs >= 4.0) spdColor = '#ef4444';
      else if (data.vSpeedMs >= 2.5) spdColor = '#ffb020';
    }
    ctx.fillStyle = spdColor;
    ctx.fillText(`Down speed ${vSpeed} m/s`, mx + 260, botY);

    const thrust = Math.round(data.thrustPct || 0);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Thrust ${thrust}%`, mx + 540, botY);

    ctx.restore();
  }

  function dispose() {
    surfaceCanvas = null;
    isBuilt = false;
  }

  return {
    draw,
    dispose,
  };
}

export default createLandingFeed;
