// ---------------------------------------------------------------------------
// Cockpit Screen Renderers for Landing Mode
// ---------------------------------------------------------------------------

import { formatAltitude } from '../game/landingSequence.js';

const FONT = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function initScreenBorder(ctx, cw, ch) {
  ctx.fillStyle = '#07122a';
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = '#3fd0ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, cw - 3, ch - 3);
}

export function drawLandingTopScreen(ctx, cw, ch, data) {
  initScreenBorder(ctx, cw, ch);
  const frame = data.frame || {};
  const mx = Math.round(cw * 0.05);

  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.textBaseline = 'top';
  ctx.fillText('Mission clock', mx, 14);

  const alt = frame.altitudeM || 0;
  const altText = `Altitude ${formatAltitude(alt)}`;

  ctx.textAlign = 'center';
  ctx.font = `700 44px ${FONT}`;
  ctx.fillStyle = '#e8f3ff';
  ctx.fillText(altText, cw * 0.5, 16);

  ctx.font = `500 22px ${FONT}`;
  ctx.fillStyle = '#3fd0ff';
  ctx.fillText(frame.stageLabel || 'Powered descent', cw * 0.5, 74);
  ctx.textAlign = 'left';
}

export function drawLandingMainScreen(ctx, cw, ch, data, landingFeed) {
  if (landingFeed && typeof landingFeed.draw === 'function') {
    const frame = data.frame || {};
    const feedData = {
      zoom: frame.zoom || 0.12,
      targetOffsetX: data.diverted ? 0.22 : 0,
      dust: frame.dust || 0,
      altitudeM: frame.altitudeM || 0,
      vSpeedMs: frame.vSpeedMs || 0,
      thrustPct: frame.thrustPct || 0,
      stage: data.stage || frame.stage,
      hazard: (frame.altitudeM || 0) < 800,
      diverted: Boolean(data.diverted),
      time: data.time || 0,
    };
    landingFeed.draw(ctx, cw, ch, feedData);
  } else {
    initScreenBorder(ctx, cw, ch);
  }
}

export function drawLandingLeftScreen(ctx, cw, ch, data) {
  initScreenBorder(ctx, cw, ch);
  const frame = data.frame || {};
  const mx = Math.round(cw * 0.06);

  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.textBaseline = 'top';
  ctx.fillText('Descent', mx, Math.round(ch * 0.08));

  // Speed Gauge (0 to 120 m/s)
  const vSpeed = frame.vSpeedMs || 0;
  const alt = frame.altitudeM || 0;
  let spdCol = '#34d399';
  if (alt < 100) {
    if (vSpeed >= 4.0) spdCol = '#ef4444';
    else if (vSpeed >= 2.5) spdCol = '#ffb020';
  }

  const cx = cw * 0.5;
  const cy = ch * 0.44;
  const r = 58;

  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
  ctx.strokeStyle = '#12305a';
  ctx.lineWidth = 10;
  ctx.stroke();

  const frac = Math.max(0, Math.min(1, vSpeed / 120));
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + frac * Math.PI * 1.5);
  ctx.strokeStyle = spdCol;
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = `700 28px monospace`;
  ctx.fillStyle = '#e8f3ff';
  ctx.fillText(`${vSpeed.toFixed(1)} m/s`, cx, cy - 8);

  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText('Vertical speed', cx, cy + 22);

  // Thrust bar
  const barY = ch * 0.68;
  const thrust = Math.round(frame.thrustPct || 0);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(`Thrust ${thrust}%`, cx, barY);

  const barW = cw * 0.80;
  const barH = 12;
  const barX = (cw - barW) * 0.5;
  ctx.fillStyle = '#12305a';
  ctx.fillRect(barX, barY + 28, barW, barH);
  ctx.fillStyle = thrust > 0 ? '#38bdf8' : '#64748b';
  ctx.fillRect(barX, barY + 28, Math.round(barW * (thrust / 100)), barH);

  // Gravity line
  const gVal = (frame.g || 0).toFixed(2);
  ctx.fillStyle = '#e8f3ff';
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText(`Gravity ${gVal} g`, cx, ch * 0.88);
  ctx.textAlign = 'left';
}

export function drawLandingRightScreen(ctx, cw, ch, data) {
  initScreenBorder(ctx, cw, ch);
  const frame = data.frame || {};
  const site = data.site || {};
  const mx = Math.round(cw * 0.06);

  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.textBaseline = 'top';
  ctx.fillText('Landing site', mx, Math.round(ch * 0.08));

  const siteName = site.name || (data.siteId === 'crater' ? 'Dark crater' : 'Sunny ridge');
  ctx.font = `700 24px ${FONT}`;
  ctx.fillStyle = '#e8f3ff';
  ctx.fillText(siteName, mx, ch * 0.20);

  // Small feature drawing
  const fx = cw * 0.5;
  const fy = ch * 0.42;
  if (data.siteId === 'crater') {
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx, fy, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(fx, fy, 32, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath(); ctx.arc(fx, fy, 32, 0.7 * Math.PI, 1.4 * Math.PI); ctx.stroke();
  } else {
    // Ridge
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(fx - 60, fy + 20);
    ctx.lineTo(fx - 10, fy - 15);
    ctx.lineTo(fx + 60, fy + 15);
    ctx.stroke();
  }

  // Distance to target
  const alt = frame.altitudeM || 0;
  const dist = Math.max(0, Math.round(alt * 0.9));
  ctx.font = `500 22px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText(`Distance to target ${dist.toLocaleString('en-US')} m`, mx, ch * 0.68);

  // Status line
  let statusText = 'On course';
  let statusCol = '#34d399';
  if (data.decisionOpen) {
    statusText = 'Hazard ahead';
    statusCol = '#ef4444';
  } else if (data.diverted) {
    statusText = 'Diverting to flat ground';
    statusCol = '#3fd0ff';
  } else if (alt < 400 && !data.decisionOpen) {
    statusText = 'Target locked';
    statusCol = '#38bdf8';
  }

  ctx.font = `700 22px ${FONT}`;
  ctx.fillStyle = statusCol;
  ctx.fillText(statusText, mx, ch * 0.82);
}

export function drawLandingCoScreen(ctx, cw, ch, data) {
  initScreenBorder(ctx, cw, ch);
  const mx = Math.round(cw * 0.06);
  const my = Math.round(ch * 0.08);

  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.textBaseline = 'top';
  ctx.fillText('Mission log', mx, my);

  const logs = data.extraLogs || [];
  const displayLogs = logs.slice(-6);

  ctx.font = `500 22px ${FONT}`;
  ctx.fillStyle = '#e8f3ff';
  let lineY = my + 44;
  for (let i = 0; i < displayLogs.length; i++) {
    ctx.fillText(displayLogs[i], mx, lineY);
    lineY += 32;
  }

  // Radar graphic in bottom right
  const rcx = cw * 0.78;
  const rcy = ch * 0.72;
  const rr = 46;

  ctx.strokeStyle = '#12305a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(rcx, rcy, rr * 0.5, 0, Math.PI * 2); ctx.stroke();

  const sweep = (data.time || 0) * 1.5;
  ctx.strokeStyle = '#3fd0ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rcx, rcy);
  ctx.lineTo(rcx + Math.cos(sweep) * rr, rcy + Math.sin(sweep) * rr);
  ctx.stroke();

  ctx.fillStyle = 'rgba(52, 211, 153, 0.65)';
  ctx.beginPath(); ctx.arc(rcx - 14, rcy + 12, 3, 0, Math.PI * 2); ctx.fill();
}

export default {
  drawLandingTopScreen,
  drawLandingMainScreen,
  drawLandingLeftScreen,
  drawLandingRightScreen,
  drawLandingCoScreen,
};
