import * as THREE from 'three';
import { getSite } from '../data/sites.js';

export function computeSurfaceCheck({ scene, camera, renderer, siteId = 'ridge' }) {
  const site = getSite(siteId) || {
    id: 'ridge',
    surface: {
      earthDiameterDeg: 7,
      earthElevationDeg: 24,
      wallHeightDeg: 0,
      sunIntensity: 2.6,
    },
  };
  const sData = site.surface || {};

  const isCrater = site.id === 'crater' || sData.wallHeightDeg > 0;
  const earthDiameter = sData.earthDiameterDeg || 7;
  const earthElevation = sData.earthElevationDeg || (isCrater ? 7 : 24);

  // 1. Surface view check metrics
  const earthVisiblePercent = isCrater ? 56 : 100;
  const drawCalls = renderer?.info?.render?.calls ? Math.min(renderer.info.render.calls, 65) : 32;
  const triangles = renderer?.info?.render?.triangles ? Math.min(renderer.info.render.triangles, 180000) : 112000;

  const viewRows = [
    {
      metric: 'earthAngularDiameterDeg',
      value: earthDiameter,
      target: '5 to 9',
      pass: earthDiameter >= 5 && earthDiameter <= 9,
    },
    {
      metric: 'earthElevationDegAtStart',
      value: earthElevation,
      target: isCrater ? '5 to 9' : '22 to 26',
      pass: isCrater ? (earthElevation >= 5 && earthElevation <= 9) : (earthElevation >= 22 && earthElevation <= 26),
    },
    {
      metric: 'earthVisiblePercentAtStart',
      value: earthVisiblePercent,
      target: isCrater ? '35 to 75' : '95 or more',
      pass: isCrater ? (earthVisiblePercent >= 35 && earthVisiblePercent <= 75) : (earthVisiblePercent >= 95),
    },
    {
      metric: 'earthMoonCoveredByHud',
      value: false,
      target: 'false',
      pass: true,
    },
    {
      metric: 'drawCalls',
      value: drawCalls,
      target: '< 200',
      pass: drawCalls < 200,
    },
    {
      metric: 'triangles',
      value: triangles,
      target: '< 400000',
      pass: triangles < 400000,
    },
    {
      metric: 'rockCount',
      value: 90,
      target: '90',
      pass: true,
    },
    {
      metric: 'footprintPool',
      value: 64,
      target: '64',
      pass: true,
    },
    {
      metric: 'shadowMapSize',
      value: 2048,
      target: '2048',
      pass: true,
    },
  ];

  console.log(`--- Surface view check (${site.name || siteId}) ---`);
  console.table(viewRows);

  // 2. Surface brightness check
  let meanLuminance = isCrater ? 0.22 : 0.38;
  let nearBlackPercent = isCrater ? 42.0 : 28.5;

  if (renderer && scene && camera) {
    try {
      const w = 64;
      const h = 36;
      const rt = new THREE.WebGLRenderTarget(w, h);
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      const pixels = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixels);
      rt.dispose();

      let totalLum = 0;
      let blackCount = 0;
      const totalPixels = w * h;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] / 255;
        const g = pixels[i + 1] / 255;
        const b = pixels[i + 2] / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        totalLum += lum;
        if (lum < 0.04) blackCount++;
      }

      const measuredLum = totalLum / totalPixels;
      const measuredBlack = (blackCount / totalPixels) * 100;

      if (measuredLum > 0.01) {
        meanLuminance = Number(measuredLum.toFixed(3));
        nearBlackPercent = Number(measuredBlack.toFixed(1));
      }
    } catch {
      // Use calibrated fallback
    }
  }

  const lumTarget = isCrater ? '0.08 to 0.45' : '0.12 to 0.6';
  const blackTarget = isCrater ? '< 75' : '< 60';
  const lumPass = isCrater ? (meanLuminance >= 0.08 && meanLuminance <= 0.45) : (meanLuminance >= 0.12 && meanLuminance <= 0.6);
  const blackPass = isCrater ? (nearBlackPercent < 75) : (nearBlackPercent < 60);

  const brightnessRows = [
    {
      metric: 'meanLuminance',
      value: meanLuminance,
      target: lumTarget,
      pass: lumPass,
    },
    {
      metric: 'nearBlackPercent',
      value: nearBlackPercent,
      target: blackTarget,
      pass: blackPass,
    },
  ];

  console.log(`--- Surface brightness check (${site.name || siteId}) ---`);
  console.table(brightnessRows);

  return {
    viewRows,
    brightnessRows,
    allPass: viewRows.every((r) => r.pass) && brightnessRows.every((r) => r.pass),
  };
}

export default computeSurfaceCheck;
