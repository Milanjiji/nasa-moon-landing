import * as THREE from 'three';
import { summarizeLoadout, levelColor } from '../game/loadoutSummary.js';
import { getItem } from '../data/gear.js';

const FONT = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const TICKER_MSGS = [
  'All systems nominal',
  'Crew strapped in',
  'Weather clear at the launch site',
  'Waiting for launch command',
];

function initBorder(ctx, cw, ch) {
  ctx.fillStyle = '#07122a';
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = '#3fd0ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, cw - 3, ch - 3);
}

function drawMain(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  const mx = Math.round(cw * 0.06);
  let curY = Math.round(ch * 0.06);

  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.textBaseline = 'top';
  ctx.fillText('Mission overview', mx, curY);
  curY += 40;

  if (!state.loadout || !state.loadout.selection) {
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText('No gear loaded', mx, curY + 60);
    return;
  }

  const cats = [
    ['suit', 'Suit'], ['helmet', 'Helmet'], ['gloves', 'Gloves'],
    ['boots', 'Boots'], ['backpack', 'Life support pack'],
  ];
  ctx.font = `500 28px ${FONT}`;
  for (let i = 0; i < cats.length; i++) {
    const itemId = state.loadout.selection[cats[i][0]];
    const item = itemId ? getItem(cats[i][0], itemId) : null;
    ctx.fillStyle = '#9fd8ff';
    ctx.textAlign = 'left';
    ctx.fillText(cats[i][1], mx, curY);
    ctx.fillStyle = item ? '#e8f3ff' : '#9fd8ff';
    ctx.textAlign = 'right';
    ctx.fillText(item ? item.name : 'Not chosen', cw - mx, curY);
    curY += 34;
  }
  ctx.textAlign = 'left';

  curY += 6;
  const summary = state.summary;
  ctx.fillStyle = '#e8f3ff';
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(summary.weight.label, mx, curY);
  curY += 34;

  const barW = cw - mx * 2;
  const barH = 16;
  ctx.fillStyle = '#12305a';
  ctx.fillRect(mx, curY, barW, barH);
  let barColor = '#4f86c6';
  if (summary.weight.ratio >= 1.0) barColor = '#ff5b5b';
  else if (summary.weight.ratio >= 0.85) barColor = '#ffb020';
  ctx.fillStyle = barColor;
  ctx.fillRect(mx, curY, Math.max(0, Math.min(barW, Math.round(barW * summary.weight.ratio))), barH);
  curY += barH + 20;

  const checkItems = [
    { label: 'Suit sealed', level: 'good' },
    { label: summary.radiation.label, level: summary.radiation.level },
    { label: summary.air.label, level: summary.air.level },
    { label: summary.mobility.label, level: summary.mobility.level },
    { label: 'Comms link online', level: 'good' },
  ];

  ctx.font = `500 28px ${FONT}`;
  let allDone = prefersReduced;
  let anyBad = false;
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
        ctx.fillStyle = '#9fd8ff';
        ctx.fillText('... ' + ci.label, mx, curY);
      }
      curY += 34;
    }
  }

  if (prefersReduced || time >= (0.8 + 4 * 0.9 + 0.4)) allDone = true;
  if (allDone) {
    curY += 8;
    ctx.font = `600 28px ${FONT}`;
    ctx.fillStyle = anyBad ? '#ffb020' : '#34d399';
    ctx.fillText(anyBad ? 'Check warnings before launch' : 'All systems nominal', mx, curY);
  }
}

function drawLeft(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  const mx = Math.round(cw * 0.06);
  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.textBaseline = 'top';
  ctx.fillText('Life support', mx, Math.round(ch * 0.08));

  const summary = state.summary;
  const easeProgress = prefersReduced ? 1 : Math.min(1, time / 1.5);
  const easeVal = 1 - (1 - easeProgress) * (1 - easeProgress);

  const gauges = [
    { title: 'Air supply', data: summary.air, cx: cw * 0.28, cy: ch * 0.42 },
    { title: 'Radiation', data: summary.radiation, cx: cw * 0.72, cy: ch * 0.42 },
  ];
  const radius = cw * 0.16;
  const startAng = 0.75 * Math.PI;
  const sweepAng = 1.5 * Math.PI;

  for (let g = 0; g < gauges.length; g++) {
    const { title, data, cx, cy } = gauges[g];
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#12305a';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAng, startAng + sweepAng);
    ctx.stroke();

    const dispRatio = data.ratio * easeVal;
    ctx.strokeStyle = levelColor(data.level);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAng, startAng + sweepAng * dispRatio);
    ctx.stroke();

    const needleAng = startAng + sweepAng * dispRatio;
    ctx.strokeStyle = '#e8f3ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAng) * (radius - 4), cy + Math.sin(needleAng) * (radius - 4));
    ctx.stroke();

    ctx.fillStyle = '#e8f3ff';
    ctx.textAlign = 'center';
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(`${data.value} / ${data.max}`, cx, cy - 14);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(title, cx, cy + radius + 18);
  }
  ctx.textAlign = 'left';

  const barY = ch * 0.80;
  ctx.fillStyle = '#e8f3ff';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(summary.mobility.label, mx, barY);

  const barW = cw - mx * 2;
  const barH = 14;
  ctx.fillStyle = '#12305a';
  ctx.fillRect(mx, barY + 32, barW, barH);
  ctx.fillStyle = levelColor(summary.mobility.level);
  ctx.fillRect(mx, barY + 32, Math.round(barW * summary.mobility.ratio * easeVal), barH);
}

function drawRight(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  const mx = Math.round(cw * 0.06);
  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.textBaseline = 'top';
  ctx.fillText('Route', mx, Math.round(ch * 0.08));

  // Earth
  const ex = cw * 0.20;
  const ey = ch * 0.65;
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(ex, ey, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ex, ey, 44.5, 0.5 * Math.PI, 1.1 * Math.PI);
  ctx.stroke();

  // Moon
  const mxPos = cw * 0.80;
  const myPos = ch * 0.32;
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(mxPos, myPos, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#64748b';
  const craters = [[mxPos - 8, myPos - 6, 6], [mxPos + 10, myPos + 4, 8], [mxPos - 2, myPos + 12, 5]];
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(craters[i][0], craters[i][1], craters[i][2], 0, Math.PI * 2); ctx.fill();
  }

  // Path
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = '#3fd0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ex + 18, ey - 20);
  ctx.quadraticCurveTo(cw * 0.44, ch * 0.34, mxPos - 20, myPos + 12);
  ctx.stroke();
  ctx.setLineDash([]);

  // Ship dot & ring
  const shipX = ex + 20;
  const shipY = ey - 22;
  ctx.fillStyle = '#3fd0ff';
  ctx.beginPath();
  ctx.arc(shipX, shipY, 5, 0, Math.PI * 2);
  ctx.fill();

  const pulse = prefersReduced ? 0.3 : (time % 1.5) / 1.5;
  ctx.strokeStyle = `rgba(63, 208, 255, ${prefersReduced ? 0.7 : Math.max(0, 1 - pulse)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(shipX, shipY, 6 + pulse * 14, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `500 24px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText('Distance about 384,400 km', mx, ch * 0.86);
  ctx.fillText('Waiting for launch', mx, ch * 0.86 + 30);
}

function drawTop(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.textBaseline = 'top';
  ctx.fillText('Mission clock', Math.round(cw * 0.05), 14);

  const colon = (Math.floor(time) % 2 === 0) ? ':' : ' ';
  ctx.textAlign = 'center';
  ctx.font = `700 46px ${FONT}`;
  ctx.fillStyle = '#e8f3ff';
  ctx.fillText(`T-minus 00${colon}10${colon}00`, cw * 0.5, 16);

  const cycleT = 3.0;
  const msg = TICKER_MSGS[Math.floor(time / cycleT) % TICKER_MSGS.length];
  let alpha = 1;
  if (!prefersReduced) {
    const tInCycle = time % cycleT;
    if (tInCycle < 0.5) alpha = tInCycle / 0.5;
    else if (tInCycle > 2.5) alpha = (3.0 - tInCycle) / 0.5;
  }
  ctx.font = `500 24px ${FONT}`;
  ctx.fillStyle = `rgba(232, 243, 255, ${Math.max(0, Math.min(1, alpha))})`;
  ctx.fillText(msg, cw * 0.5, 74);
  ctx.textAlign = 'left';
}

function drawCo(ctx, cw, ch, state, time, prefersReduced) {
  initBorder(ctx, cw, ch);
  const mx = Math.round(cw * 0.06);
  const my = Math.round(ch * 0.08);

  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.textBaseline = 'top';
  ctx.fillText('Mission log', mx, my);

  const sel = state.loadout ? state.loadout.selection : null;
  const suitName = sel && sel.suit ? (getItem('suit', sel.suit)?.name || 'Standard suit') : 'None';
  const packName = sel && sel.backpack ? (getItem('backpack', sel.backpack)?.name || 'Small pack') : 'None';
  const helmName = sel && sel.helmet ? (getItem('helmet', sel.helmet)?.name || 'Clear visor') : 'None';

  const defaultLines = [
    { text: 'Crew: 1 astronaut', t: 0.0 },
    { text: state.summary.weight.label, t: 0.7 },
    { text: `Suit: ${suitName}`, t: 1.4 },
    { text: `Pack: ${packName}`, t: 2.1 },
    { text: `Helmet: ${helmName}`, t: 2.8 },
    { text: 'Launch button armed', t: 3.5 },
  ];

  const visibleLines = [];
  for (let i = 0; i < defaultLines.length; i++) {
    if (prefersReduced || time >= defaultLines[i].t) {
      visibleLines.push(defaultLines[i].text);
    }
  }
  for (let i = 0; i < state.extraLogs.length; i++) {
    visibleLines.push(state.extraLogs[i]);
  }

  const displayLines = visibleLines.slice(-6);
  ctx.font = `500 24px ${FONT}`;
  ctx.fillStyle = '#e8f3ff';
  let lineY = my + 44;
  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], mx, lineY);
    lineY += 34;
  }

  // Radar
  const rcx = cw * 0.78;
  const rcy = ch * 0.72;
  const rr = 46;
  ctx.strokeStyle = '#12305a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(rcx, rcy, rr * 0.5, 0, Math.PI * 2); ctx.stroke();

  const sweep = prefersReduced ? 0.7 : (time * 1.5) % (Math.PI * 2);
  ctx.strokeStyle = '#3fd0ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rcx, rcy);
  ctx.lineTo(rcx + Math.cos(sweep) * rr, rcy + Math.sin(sweep) * rr);
  ctx.stroke();

  ctx.fillStyle = 'rgba(52, 211, 153, 0.65)';
  ctx.beginPath(); ctx.arc(rcx - 16, rcy + 14, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(rcx + 18, rcy - 18, 3, 0, Math.PI * 2); ctx.fill();
}

export function createScreens({ anchors, getLoadout, renderer }) {
  if (!anchors) throw new Error('Anchors required for createScreens');

  let timeSec = 0;
  let lastRedraw8Fps = -1;
  let lastRedraw4Fps = -1;
  let lastLoadoutFetch = -1;

  const state = {
    loadout: null,
    summary: summarizeLoadout(null),
    extraLogs: [],
  };

  const prefersReduced = (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const screenKeys = ['main', 'left', 'right', 'top', 'co'];
  for (let i = 0; i < screenKeys.length; i++) {
    const sc = anchors[screenKeys[i]];
    if (sc && sc.texture) {
      sc.texture.generateMipmaps = true;
      sc.texture.minFilter = THREE.LinearMipmapLinearFilter;
      sc.texture.magFilter = THREE.LinearFilter;
      sc.texture.colorSpace = THREE.SRGBColorSpace;
      if (renderer && renderer.capabilities) {
        sc.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      }
      sc.texture.needsUpdate = true;
    }
  }

  function fetchLoadout() {
    if (typeof getLoadout === 'function') {
      state.loadout = getLoadout();
    }
    state.summary = summarizeLoadout(state.loadout ? state.loadout.totals : null);
  }

  function setLogLine(text) {
    if (!text) return;
    state.extraLogs.push(text);
    if (state.extraLogs.length > 20) {
      state.extraLogs.shift();
    }
  }

  function update(delta, forceRedraw = false) {
    timeSec += delta;

    if (timeSec - lastLoadoutFetch >= 1.0) {
      lastLoadoutFetch = timeSec;
      fetchLoadout();
    }

    if (forceRedraw || timeSec - lastRedraw8Fps >= 0.12) {
      lastRedraw8Fps = timeSec;
      if (anchors.main) {
        drawMain(anchors.main.ctx, anchors.main.canvas.width, anchors.main.canvas.height, state, timeSec, prefersReduced);
        anchors.main.texture.needsUpdate = true;
      }
      if (anchors.left) {
        drawLeft(anchors.left.ctx, anchors.left.canvas.width, anchors.left.canvas.height, state, timeSec, prefersReduced);
        anchors.left.texture.needsUpdate = true;
      }
      if (anchors.right) {
        drawRight(anchors.right.ctx, anchors.right.canvas.width, anchors.right.canvas.height, state, timeSec, prefersReduced);
        anchors.right.texture.needsUpdate = true;
      }
      if (anchors.co) {
        drawCo(anchors.co.ctx, anchors.co.canvas.width, anchors.co.canvas.height, state, timeSec, prefersReduced);
        anchors.co.texture.needsUpdate = true;
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
    timeSec = 0;
    lastRedraw8Fps = -1;
    lastRedraw4Fps = -1;
    lastLoadoutFetch = -1;
    state.extraLogs = [];
    fetchLoadout();
    update(0, true);
  }

  fetchLoadout();

  return {
    update,
    reset,
    setLogLine,
  };
}

export default createScreens;
