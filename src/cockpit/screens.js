import * as THREE from 'three';
import { summarizeLoadout, levelColor } from '../game/loadoutSummary.js';
import { getItem } from '../data/gear.js';
import { formatTMinus, formatMissionTime } from '../game/launchSequence.js';

const FONT = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const TICKER_MSGS = [
  'All systems nominal', 'Crew strapped in',
  'Weather clear at the launch site', 'Waiting for launch command',
];

const screenMetrics = {
  main: { bottomY: 0, height: 436 },
  left: { bottomY: 0, height: 531 },
  right: { bottomY: 0, height: 531 },
  top: { bottomY: 0, height: 152 },
  co: { bottomY: 0, height: 469 },
};

function initBorder(ctx, cw, ch) {
  ctx.fillStyle = '#07122a'; ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = '#3fd0ff'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, cw - 3, ch - 3);
}

function drawMain(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  const mx = Math.round(cw * 0.06);
  const topMargin = Math.round(ch * 0.05), bottomMargin = Math.round(ch * 0.95);
  const usableH = bottomMargin - topMargin;
  let curY = topMargin, lastY = curY;

  if (state.launchFrame) {
    const f = state.launchFrame;
    const totalLines = f.orbit ? 11 : 9;
    const step = Math.min(30, Math.max(25, Math.floor(usableH / (totalLines + 1))));
    const fontSz = Math.min(26, Math.max(22, step - 3));

    ctx.font = `600 ${fontSz}px ${FONT}`; ctx.fillStyle = '#9fd8ff'; ctx.textBaseline = 'top';
    ctx.fillText(f.orbit ? 'Orbit reached' : 'Launch status', mx, curY); curY += step;
    ctx.font = `700 ${fontSz + 2}px ${FONT}`; ctx.fillStyle = '#e8f3ff';
    ctx.fillText(f.stageLabel, mx, curY); curY += step;
    ctx.font = `500 ${fontSz}px ${FONT}`;
    ctx.fillText(`Altitude ${Math.round(f.altitudeKm).toLocaleString()} km`, mx, curY); curY += step;
    ctx.fillText(`Speed ${Math.round(f.speedKmh).toLocaleString()} km/h`, mx, curY); curY += step;
    ctx.fillText(`Force ${f.g.toFixed(1)} g`, mx, curY); curY += step;

    const ms = [
      { name: 'Max Q', p: f.altitudeKm >= 13 }, { name: 'Stage separation', p: f.altitudeKm >= 60 },
      { name: 'Engine cutoff', p: f.altitudeKm >= 390 }, { name: 'Orbit reached', p: f.orbit },
    ];
    for (let i = 0; i < ms.length; i++) {
      ctx.fillStyle = ms[i].p ? '#34d399' : '#9fd8ff';
      ctx.fillText((ms[i].p ? '✓ ' : '... ') + ms[i].name, mx, curY); curY += step;
    }
    if (f.orbit) {
      const col = f.fuelMargin >= 25 ? '#34d399' : (f.fuelMargin >= 15 ? '#ffb020' : '#ff5b5b');
      ctx.fillStyle = col; ctx.fillText(`Fuel margin ${f.fuelMargin}%`, mx, curY); curY += step;
      ctx.fillStyle = '#9fd8ff'; ctx.fillText('Next: head for the Moon', mx, curY);
      lastY = curY + fontSz * 1.15;
    } else {
      lastY = curY;
    }
    screenMetrics.main = { bottomY: Math.round(lastY), height: ch };
    return;
  }

  // Pre-launch Overview: Dynamic layout
  const barH = 10, numRows = 14;
  const step = Math.min(27, Math.max(23, Math.floor((usableH - barH - 12) / numRows)));
  const fontSz = Math.min(24, Math.max(22, step - 2));

  ctx.font = `600 ${fontSz}px ${FONT}`; ctx.fillStyle = '#9fd8ff'; ctx.textBaseline = 'top';
  ctx.fillText('Mission overview', mx, curY); curY += step + 2;

  if (!state.loadout || !state.loadout.selection) {
    ctx.font = `500 ${fontSz}px ${FONT}`; ctx.fillText('No gear loaded', mx, curY + 20);
    screenMetrics.main = { bottomY: Math.round(curY + 20 + fontSz), height: ch };
    return;
  }

  const cats = [['suit', 'Suit'], ['helmet', 'Helmet'], ['gloves', 'Gloves'], ['boots', 'Boots'], ['backpack', 'Life support pack']];
  ctx.font = `500 ${fontSz}px ${FONT}`;
  for (let i = 0; i < cats.length; i++) {
    const itemId = state.loadout.selection[cats[i][0]];
    const item = itemId ? getItem(cats[i][0], itemId) : null;
    ctx.fillStyle = '#9fd8ff'; ctx.textAlign = 'left'; ctx.fillText(cats[i][1], mx, curY);
    ctx.fillStyle = item ? '#e8f3ff' : '#9fd8ff'; ctx.textAlign = 'right';
    ctx.fillText(item ? item.name : 'Not chosen', cw - mx, curY);
    curY += step;
  }
  ctx.textAlign = 'left';

  const summary = state.summary;
  ctx.fillStyle = '#e8f3ff'; ctx.font = `500 ${fontSz}px ${FONT}`;
  ctx.fillText(summary.weight.label, mx, curY); curY += step;

  const barW = cw - mx * 2;
  ctx.fillStyle = '#12305a'; ctx.fillRect(mx, curY, barW, barH);
  const barColor = summary.weight.ratio >= 1.0 ? '#ff5b5b' : (summary.weight.ratio >= 0.85 ? '#ffb020' : '#4f86c6');
  ctx.fillStyle = barColor;
  ctx.fillRect(mx, curY, Math.max(0, Math.min(barW, Math.round(barW * summary.weight.ratio))), barH);
  curY += barH + 4;

  const checkItems = [
    { label: 'Suit sealed', level: 'good' }, { label: summary.radiation.label, level: summary.radiation.level },
    { label: summary.air.label, level: summary.air.level }, { label: summary.mobility.label, level: summary.mobility.level },
    { label: 'Comms link online', level: 'good' },
  ];

  ctx.font = `500 ${fontSz}px ${FONT}`;
  let allDone = prefersReduced, anyBad = false;
  for (let i = 0; i < checkItems.length; i++) {
    const ci = checkItems[i];
    if (ci.level === 'bad') anyBad = true;
    const startT = 0.8 + i * 0.9;
    const resolved = prefersReduced || time >= (startT + 0.4);
    if (prefersReduced || time >= startT) {
      if (resolved) {
        ctx.fillStyle = levelColor(ci.level);
        ctx.fillText((ci.level === 'bad' ? '! ' : '✓ ') + ci.label, mx, curY);
      } else {
        ctx.fillStyle = '#9fd8ff'; ctx.fillText('... ' + ci.label, mx, curY);
      }
      curY += step;
    }
  }

  if (prefersReduced || time >= (0.8 + 4 * 0.9 + 0.4)) allDone = true;
  if (allDone) {
    const statusY = Math.min(curY + 2, bottomMargin - fontSz * 1.15);
    ctx.font = `600 ${fontSz}px ${FONT}`; ctx.fillStyle = anyBad ? '#ffb020' : '#34d399';
    ctx.fillText(anyBad ? 'Check warnings before launch' : 'All systems nominal', mx, statusY);
    lastY = statusY + fontSz * 1.15;
  } else {
    lastY = curY;
  }
  screenMetrics.main = { bottomY: Math.round(lastY), height: ch };
}

function drawLeft(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  ctx.font = `600 28px ${FONT}`; ctx.fillStyle = '#9fd8ff'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  ctx.fillText('Life support', cw * 0.5, Math.round(ch * 0.08));

  const summary = state.summary;
  const cx1 = cw * 0.30, cx2 = cw * 0.70, cy = ch * 0.40, radius = cw * 0.16;
  const startAng = 0.75 * Math.PI, sweepAng = 1.5 * Math.PI;

  if (state.launchFrame) {
    const f = state.launchFrame;
    ctx.lineWidth = 14; ctx.strokeStyle = '#12305a';
    ctx.beginPath(); ctx.arc(cx1, cy, radius, startAng, startAng + sweepAng); ctx.stroke();
    const gRatio = Math.min(1, Math.max(0, f.g / 4.0));
    const gCol = f.g > 3.3 ? '#ff5b5b' : (f.g >= 2.5 ? '#ffb020' : '#34d399');
    ctx.strokeStyle = gCol; ctx.beginPath(); ctx.arc(cx1, cy, radius, startAng, startAng + sweepAng * gRatio); ctx.stroke();
    ctx.fillStyle = '#e8f3ff'; ctx.textAlign = 'center'; ctx.font = `600 28px ${FONT}`;
    ctx.fillText(`${f.g.toFixed(1)} g`, cx1, cy - 14);
    ctx.fillStyle = '#9fd8ff'; ctx.font = `500 24px ${FONT}`; ctx.fillText('G-force', cx1, cy + radius + 18);

    ctx.lineWidth = 14; ctx.strokeStyle = '#12305a';
    ctx.beginPath(); ctx.arc(cx2, cy, radius, startAng, startAng + sweepAng); ctx.stroke();
    ctx.strokeStyle = levelColor(summary.air.level);
    ctx.beginPath(); ctx.arc(cx2, cy, radius, startAng, startAng + sweepAng * summary.air.ratio); ctx.stroke();
    ctx.fillStyle = '#e8f3ff'; ctx.fillText(`${summary.air.value} / ${summary.air.max}`, cx2, cy - 14);
    ctx.fillStyle = '#9fd8ff'; ctx.fillText('Air supply', cx2, cy + radius + 18);

    if (f.g === 0) {
      ctx.fillStyle = '#34d399'; ctx.font = `600 26px ${FONT}`;
      ctx.fillText('Weightless', cw * 0.5, ch * 0.82);
    }
    screenMetrics.left = { bottomY: Math.round(ch * 0.82 + 30), height: ch };
    ctx.textAlign = 'left';
    return;
  }

  const easeProgress = prefersReduced ? 1 : Math.min(1, time / 1.5);
  const easeVal = 1 - (1 - easeProgress) * (1 - easeProgress);
  const gauges = [{ title: 'Air supply', data: summary.air, cx: cx1, cy }, { title: 'Radiation', data: summary.radiation, cx: cx2, cy }];

  for (let g = 0; g < gauges.length; g++) {
    const { title, data, cx } = gauges[g];
    ctx.lineWidth = 14; ctx.strokeStyle = '#12305a';
    ctx.beginPath(); ctx.arc(cx, cy, radius, startAng, startAng + sweepAng); ctx.stroke();
    const dispRatio = data.ratio * easeVal;
    ctx.strokeStyle = levelColor(data.level);
    ctx.beginPath(); ctx.arc(cx, cy, radius, startAng, startAng + sweepAng * dispRatio); ctx.stroke();
    const needleAng = startAng + sweepAng * dispRatio;
    ctx.strokeStyle = '#e8f3ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(needleAng) * (radius - 4), cy + Math.sin(needleAng) * (radius - 4)); ctx.stroke();
    ctx.fillStyle = '#e8f3ff'; ctx.textAlign = 'center'; ctx.font = `600 28px ${FONT}`;
    ctx.fillText(`${data.value} / ${data.max}`, cx, cy - 14);
    ctx.fillStyle = '#9fd8ff'; ctx.font = `500 24px ${FONT}`; ctx.fillText(title, cx, cy + radius + 18);
  }

  const barY = ch * 0.78;
  ctx.fillStyle = '#e8f3ff'; ctx.font = `500 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(summary.mobility.label, cw * 0.5, barY);
  const barW = cw * 0.80, barH = 14, barX = (cw - barW) * 0.5;
  ctx.fillStyle = '#12305a'; ctx.fillRect(barX, barY + 28, barW, barH);
  ctx.fillStyle = levelColor(summary.mobility.level);
  ctx.fillRect(barX, barY + 28, Math.round(barW * summary.mobility.ratio * easeVal), barH);
  ctx.textAlign = 'left';
  screenMetrics.left = { bottomY: Math.round(barY + 28 + barH), height: ch };
}

function drawRight(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  const mx = Math.round(cw * 0.06);
  ctx.font = `600 28px ${FONT}`; ctx.fillStyle = '#9fd8ff'; ctx.textBaseline = 'top';
  ctx.fillText('Route', mx, Math.round(ch * 0.08));

  if (state.launchFrame) {
    const f = state.launchFrame;
    const barX = cw * 0.5 - 12, barY = ch * 0.22, barW = 24, barH = ch * 0.56;
    ctx.fillStyle = '#12305a'; ctx.fillRect(barX, barY, barW, barH);
    const altRatio = Math.max(0, Math.min(1, f.altitudeKm / 400)), fillH = Math.round(barH * altRatio);
    ctx.fillStyle = '#3fd0ff'; ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
    const dotY = barY + barH - fillH;
    ctx.fillStyle = '#e8f3ff'; ctx.beginPath(); ctx.arc(barX + barW / 2, dotY, 7, 0, Math.PI * 2); ctx.fill();
    ctx.font = `500 24px ${FONT}`; ctx.fillStyle = '#9fd8ff';
    ctx.fillText(f.orbit ? 'Orbit reached' : `Altitude ${Math.round(f.altitudeKm).toLocaleString()} km`, mx, ch * 0.86);
    screenMetrics.right = { bottomY: Math.round(ch * 0.86 + 28), height: ch };
    return;
  }

  // Earth and Moon graphic
  const ex = cw * 0.20, ey = ch * 0.65, mxPos = cw * 0.80, myPos = ch * 0.32;
  ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(ex, ey, 46, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey, 44.5, 0.5 * Math.PI, 1.1 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(mxPos, myPos, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#64748b';
  const craters = [[mxPos - 8, myPos - 6, 6], [mxPos + 10, myPos + 4, 8], [mxPos - 2, myPos + 12, 5]];
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(craters[i][0], craters[i][1], craters[i][2], 0, Math.PI * 2); ctx.fill();
  }

  // Path
  ctx.setLineDash([8, 8]); ctx.strokeStyle = '#3fd0ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ex + 18, ey - 20); ctx.quadraticCurveTo(cw * 0.44, ch * 0.34, mxPos - 20, myPos + 12); ctx.stroke();
  ctx.setLineDash([]);

  // Ship dot & ring
  const shipX = ex + 20, shipY = ey - 22;
  ctx.fillStyle = '#3fd0ff'; ctx.beginPath(); ctx.arc(shipX, shipY, 5, 0, Math.PI * 2); ctx.fill();
  const pulse = prefersReduced ? 0.3 : (time % 1.5) / 1.5;
  ctx.strokeStyle = `rgba(63, 208, 255, ${prefersReduced ? 0.7 : Math.max(0, 1 - pulse)})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(shipX, shipY, 6 + pulse * 14, 0, Math.PI * 2); ctx.stroke();

  ctx.font = `500 24px ${FONT}`; ctx.fillStyle = '#9fd8ff';
  ctx.fillText('Distance about 384,400 km', mx, ch * 0.82);
  ctx.fillText('Waiting for launch', mx, ch * 0.82 + 28);
  screenMetrics.right = { bottomY: Math.round(ch * 0.82 + 56), height: ch };
}

function drawTop(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  ctx.font = `600 22px ${FONT}`; ctx.fillStyle = '#9fd8ff'; ctx.textBaseline = 'top';
  ctx.fillText('Mission clock', Math.round(cw * 0.05), 14);
  ctx.textAlign = 'center'; ctx.font = `700 46px ${FONT}`; ctx.fillStyle = '#e8f3ff';

  if (state.launchFrame) {
    const f = state.launchFrame;
    let clockText = '';
    if (f.missionTimeSec < 0) {
      const colon = (Math.floor(time) % 2 === 0) ? ':' : ' ';
      clockText = formatTMinus(f.missionTimeSec).replace(/:/g, colon);
    } else {
      clockText = formatMissionTime(f.missionTimeSec);
    }
    ctx.fillText(clockText, cw * 0.5, 16);
    ctx.font = `500 24px ${FONT}`; ctx.fillStyle = '#e8f3ff'; ctx.fillText(f.stageLabel, cw * 0.5, 74);
    ctx.textAlign = 'left';
    screenMetrics.top = { bottomY: 104, height: ch };
    return;
  }

  const colon = (Math.floor(time) % 2 === 0) ? ':' : ' ';
  ctx.fillText(`T-minus 00${colon}10${colon}00`, cw * 0.5, 16);
  const cycleT = 3.0, msg = TICKER_MSGS[Math.floor(time / cycleT) % TICKER_MSGS.length];
  let alpha = 1;
  if (!prefersReduced) {
    const tInCycle = time % cycleT;
    if (tInCycle < 0.5) alpha = tInCycle / 0.5;
    else if (tInCycle > 2.5) alpha = (3.0 - tInCycle) / 0.5;
  }
  ctx.font = `500 24px ${FONT}`; ctx.fillStyle = `rgba(232, 243, 255, ${Math.max(0, Math.min(1, alpha))})`;
  ctx.fillText(msg, cw * 0.5, 74);
  ctx.textAlign = 'left';
  screenMetrics.top = { bottomY: 104, height: ch };
}

function drawCo(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  const mx = Math.round(cw * 0.06), my = Math.round(ch * 0.08);
  ctx.font = `600 28px ${FONT}`; ctx.fillStyle = '#9fd8ff'; ctx.textBaseline = 'top';
  ctx.fillText('Mission log', mx, my);

  const sel = state.loadout ? state.loadout.selection : null;
  const suitName = sel && sel.suit ? (getItem('suit', sel.suit)?.name || 'Standard suit') : 'None';
  const packName = sel && sel.backpack ? (getItem('backpack', sel.backpack)?.name || 'Small pack') : 'None';
  const helmName = sel && sel.helmet ? (getItem('helmet', sel.helmet)?.name || 'Clear visor') : 'None';
  const defaultLines = [
    { text: 'Crew: 1 astronaut', t: 0.0 }, { text: state.summary.weight.label, t: 0.7 },
    { text: `Suit: ${suitName}`, t: 1.4 }, { text: `Pack: ${packName}`, t: 2.1 },
    { text: `Helmet: ${helmName}`, t: 2.8 }, { text: 'Launch button armed', t: 3.5 },
  ];

  const visibleLines = [];
  if (!state.launchFrame) {
    for (let i = 0; i < defaultLines.length; i++) {
      if (prefersReduced || time >= defaultLines[i].t) visibleLines.push(defaultLines[i].text);
    }
  }
  for (let i = 0; i < state.extraLogs.length; i++) {
    visibleLines.push(state.extraLogs[i]);
  }

  const displayLines = visibleLines.slice(-6);
  ctx.font = `500 24px ${FONT}`; ctx.fillStyle = '#e8f3ff';
  let lineY = my + 44;
  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], mx, lineY); lineY += 32;
  }

  // Radar
  const rcx = cw * 0.78, rcy = ch * 0.72, rr = 46;
  ctx.strokeStyle = '#12305a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(rcx, rcy, rr * 0.5, 0, Math.PI * 2); ctx.stroke();
  const sweep = prefersReduced ? 0.7 : (time * 1.5) % (Math.PI * 2);
  ctx.strokeStyle = '#3fd0ff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(rcx, rcy); ctx.lineTo(rcx + Math.cos(sweep) * rr, rcy + Math.sin(sweep) * rr); ctx.stroke();
  ctx.fillStyle = 'rgba(52, 211, 153, 0.65)';
  ctx.beginPath(); ctx.arc(rcx - 16, rcy + 14, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(rcx + 18, rcy - 18, 3, 0, Math.PI * 2); ctx.fill();
  screenMetrics.co = { bottomY: Math.round(rcy + rr), height: ch };
}

if (typeof window !== 'undefined') {
  window.__screenFitCheck = function() {
    const keys = ['main', 'left', 'right', 'top', 'co'];
    const rows = keys.map((k) => {
      const m = screenMetrics[k];
      const maxLimit = Math.round(m.height * 0.95);
      return {
        screen: k,
        lastTextBottomY: m.bottomY,
        canvasHeight: m.height,
        marginLimit: maxLimit,
        fits: m.bottomY <= maxLimit,
      };
    });
    console.table(rows);
    return rows;
  };
}

export function createScreens({ anchors, getLoadout, renderer }) {
  if (!anchors) throw new Error('Anchors required for createScreens');

  let timeSec = 0, lastRedraw8Fps = -1, lastRedraw4Fps = -1, lastLoadoutFetch = -1;
  const state = {
    loadout: null, summary: summarizeLoadout(null),
    extraLogs: [], launchFrame: null, launchMission: null,
  };

  const prefersReduced = (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  );

  const screenKeys = ['main', 'left', 'right', 'top', 'co'];
  for (let i = 0; i < screenKeys.length; i++) {
    const sc = anchors[screenKeys[i]];
    if (sc?.texture) {
      sc.texture.generateMipmaps = true;
      sc.texture.minFilter = THREE.LinearMipmapLinearFilter;
      sc.texture.magFilter = THREE.LinearFilter;
      sc.texture.colorSpace = THREE.SRGBColorSpace;
      if (renderer?.capabilities) sc.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      sc.texture.needsUpdate = true;
    }
  }

  function fetchLoadout() {
    if (typeof getLoadout === 'function') state.loadout = getLoadout();
    state.summary = summarizeLoadout(state.loadout ? state.loadout.totals : null);
  }

  function update(delta, forceRedraw = false) {
    timeSec += delta;
    if (timeSec - lastLoadoutFetch >= 1.0) {
      lastLoadoutFetch = timeSec;
      fetchLoadout();
    }
    if (forceRedraw || timeSec - lastRedraw8Fps >= 0.12) {
      lastRedraw8Fps = timeSec;
      const draws = [[anchors.main, drawMain], [anchors.left, drawLeft], [anchors.right, drawRight], [anchors.co, drawCo]];
      for (let i = 0; i < draws.length; i++) {
        const a = draws[i][0], fn = draws[i][1];
        if (a) {
          fn(a.ctx, a.canvas.width, a.canvas.height, state, timeSec, prefersReduced);
          a.texture.needsUpdate = true;
        }
      }
    }
    if (forceRedraw || timeSec - lastRedraw4Fps >= 0.24) {
      lastRedraw4Fps = timeSec;
      if (anchors.top) {
        drawTop(anchors.top.ctx, anchors.top.canvas.width, anchors.top.canvas.height, state, timeSec, prefersReduced);
        anchors.top.texture.needsUpdate = true;
      }
    }
  }

  function reset() {
    timeSec = 0; lastRedraw8Fps = -1; lastRedraw4Fps = -1; lastLoadoutFetch = -1;
    state.extraLogs = []; state.launchFrame = null; state.launchMission = null;
    fetchLoadout();
    update(0, true);
  }

  fetchLoadout();

  return {
    update,
    reset,
    setLogLine: (t) => { if (t) { state.extraLogs.push(t); if (state.extraLogs.length > 30) state.extraLogs.shift(); } },
    setLaunchFrame: (frame, mission) => { state.launchFrame = frame; state.launchMission = mission; },
    clearLaunchMode: () => { state.launchFrame = null; state.launchMission = null; },
  };
}

export default createScreens;
