// ---------------------------------------------------------------------------
// Cockpit Screen Drawings for Translunar Flight, Storm & Lunar Orbit
// ---------------------------------------------------------------------------

import { formatFlightElapsed, formatKm } from '../game/flightSequence.js';

export function drawFlightTopScreen(ctx, w, h, frame, mission) {
  try {
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, w, h);

    const isStorm = frame?.stage === 'storm';
    ctx.fillStyle = isStorm ? '#ef4444' : '#3fd0ff';
    ctx.font = 'bold 20px "Space Grotesk", sans-serif';
    ctx.fillText('MISSION ELAPSED TIME', 20, 28);

    const timeStr = formatFlightElapsed(frame?.t || 0);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(timeStr, 20, 68);

    ctx.fillStyle = isStorm ? '#fca5a5' : '#7e9bb6';
    ctx.font = 'bold 16px "Space Grotesk", sans-serif';
    ctx.fillText(`STAGE: ${(frame?.stageLabel || 'FLIGHT').toUpperCase()}`, 260, 36);

    const gVal = (frame?.g || 0).toFixed(2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText(`G-LOAD: ${gVal} G`, 260, 64);
  } catch (err) {
    console.error('EarthScene part failed: flight top screen', err);
  }
}

export function drawFlightMainScreen(ctx, w, h, frame, mission, isStorm, stormFrame) {
  try {
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#0e2240';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Trajectory curve
    ctx.strokeStyle = isStorm ? '#ef4444' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, h - 60);
    ctx.bezierCurveTo(w * 0.35, 60, w * 0.65, 60, w - 40, h - 80);
    ctx.stroke();

    // Earth and Moon markers
    ctx.fillStyle = '#2563eb';
    ctx.beginPath(); ctx.arc(40, h - 60, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('EARTH', 22, h - 35);

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath(); ctx.arc(w - 40, h - 80, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillText('MOON', w - 58, h - 50);

    // Ship position along arc
    const p = Math.max(0, Math.min(1, frame?.progress || 0));
    const sx = (1 - p) * (1 - p) * (1 - p) * 40 + 3 * (1 - p) * (1 - p) * p * (w * 0.35) + 3 * (1 - p) * p * p * (w * 0.65) + p * p * p * (w - 40);
    const sy = (1 - p) * (1 - p) * (1 - p) * (h - 60) + 3 * (1 - p) * (1 - p) * p * 60 + 3 * (1 - p) * p * p * 60 + p * p * p * (h - 80);

    ctx.fillStyle = isStorm ? '#ff2222' : '#f59e0b';
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

    // Flight metrics readouts
    ctx.fillStyle = '#e8f3ff';
    ctx.font = 'bold 22px "Space Grotesk", sans-serif';
    ctx.fillText('TRANSFER TRAJECTORY', 30, 40);

    const distStr = formatKm(frame?.distanceKm || 384400);
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = isStorm ? '#f87171' : '#3fd0ff';
    ctx.fillText(`DIST: ${distStr}`, 30, 90);

    const spdStr = (frame?.speedKmh || 0).toLocaleString('en-US') + ' km/h';
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`VELOCITY: ${spdStr}`, 30, 126);

    // Storm glitch overlay
    if (isStorm && stormFrame) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('!! WARNING: CORONAL PARTICLE FLUX SPIKE !!', 40, h - 20);

      // Noise scanlines
      const lines = Math.floor(stormFrame.glitch * 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let i = 0; i < lines; i++) {
        const ly = Math.random() * h;
        ctx.fillRect(0, ly, w, 2 + Math.random() * 3);
      }
    }
  } catch (err) {
    console.error('EarthScene part failed: flight main screen', err);
  }
}

export function drawFlightLeftScreen(ctx, w, h, frame, mission, isStorm, stormFrame, loadoutSummary) {
  try {
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = isStorm ? '#ef4444' : '#3fd0ff';
    ctx.font = 'bold 18px "Space Grotesk", sans-serif';
    ctx.fillText('SYSTEMS & LIFE SUPPORT', 16, 26);

    // Cabin Pressure
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('CABIN PRESSURE', 16, 56);
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('101.3 kPa (NOMINAL)', 16, 76);

    // Radiation Flux
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('RADIATION SENSOR FLUX', 16, 108);

    let radVal = '0.18 mSv/h';
    let radCol = '#34d399';
    if (isStorm) {
      const rate = stormFrame ? stormFrame.doseRate : 45;
      radVal = `${rate} mSv/h (CRITICAL)`;
      radCol = '#ef4444';
    }
    ctx.fillStyle = radCol;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(radVal, 16, 128);

    // Oxygen & Consumables
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('OXYGEN RESERVES', 16, 160);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('99.4% (CIRCULATING)', 16, 180);

    // Suit Rating Status
    const radLevel = loadoutSummary?.radiation?.level || 'average';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('SUIT SHIELDING RATING', 16, 212);
    ctx.fillStyle = radLevel === 'good' ? '#34d399' : (radLevel === 'bad' ? '#ef4444' : '#ffb020');
    ctx.font = 'bold 16px monospace';
    ctx.fillText(radLevel.toUpperCase(), 16, 232);
  } catch (err) {
    console.error('EarthScene part failed: flight left screen', err);
  }
}

export function drawFlightRightScreen(ctx, w, h, frame, mission, isStorm, isLunarOrbit, selectedSite) {
  try {
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, w, h);

    if (isLunarOrbit) {
      // Lunar Orbit Radar Scan Mode
      ctx.fillStyle = '#3fd0ff';
      ctx.font = 'bold 18px "Space Grotesk", sans-serif';
      ctx.fillText('LUNAR RADAR & SITES', 16, 26);

      // Radar circle
      const cx = w * 0.5, cy = h * 0.55, r = 70;
      ctx.strokeStyle = '#1e3a6a';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.stroke();

      // Site markers
      // Ridge
      ctx.fillStyle = selectedSite?.id === 'ridge' ? '#3fd0ff' : '#64748b';
      ctx.beginPath(); ctx.arc(cx + 25, cy - 15, 6, 0, Math.PI * 2); ctx.fill();
      ctx.font = '11px sans-serif';
      ctx.fillText('Sunny ridge', cx + 34, cy - 12);

      // Crater
      ctx.fillStyle = selectedSite?.id === 'crater' ? '#3fd0ff' : '#64748b';
      ctx.beginPath(); ctx.arc(cx - 20, cy + 35, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('Dark crater', cx - 12, cy + 48);

      ctx.fillStyle = '#e8f3ff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`TARGET: ${(selectedSite?.name || 'RIDGE').toUpperCase()}`, 16, h - 16);
    } else {
      // Nav Flight Vector Mode
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px "Space Grotesk", sans-serif';
      ctx.fillText('NAVIGATION GUIDANCE', 16, 26);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText('INJECTION ATTITUDE', 16, 56);
      ctx.fillStyle = '#e8f3ff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('PITCH: +12.4°  YAW: -0.8°', 16, 76);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText('THRUST VECTOR', 16, 110);
      const thrustPct = Math.round((frame?.thrust || 0) * 100);
      ctx.fillStyle = thrustPct > 0 ? '#ffb020' : '#64748b';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`MAIN ENGINE: ${thrustPct}%`, 16, 130);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText('COMMUNICATION LINK', 16, 164);
      ctx.fillStyle = isStorm ? '#ef4444' : '#34d399';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(isStorm ? 'DSN SIGNAL DEGRADED' : 'DEEP SPACE NETWORK 100%', 16, 184);
    }
  } catch (err) {
    console.error('EarthScene part failed: flight right screen', err);
  }
}

export function drawFlightCoScreen(ctx, w, h, frame, mission, logs = []) {
  try {
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#3fd0ff';
    ctx.font = 'bold 18px "Space Grotesk", sans-serif';
    ctx.fillText('CO-PILOT FLIGHT LOG', 16, 26);

    ctx.font = '13px monospace';
    const recentLogs = logs.slice(-7);
    let y = 56;
    for (let i = 0; i < recentLogs.length; i++) {
      ctx.fillStyle = i === recentLogs.length - 1 ? '#e8f3ff' : '#7e9bb6';
      ctx.fillText(`> ${recentLogs[i]}`, 16, y);
      y += 24;
    }
  } catch (err) {
    console.error('EarthScene part failed: flight co screen', err);
  }
}

export default {
  drawFlightTopScreen,
  drawFlightMainScreen,
  drawFlightLeftScreen,
  drawFlightRightScreen,
  drawFlightCoScreen,
};
