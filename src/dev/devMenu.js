import { isDev } from './devFlag.js';
import { getJumpNames } from './devJump.js';
import { parseDevParams } from './presets.js';

export function createDevMenu() {
  if (!isDev || typeof document === 'undefined') return null;

  const names = getJumpNames();
  console.log('Dev jump: add ?jump=<name>&site=ridge&gear=balanced to the URL. Names: ' + names.join(', '));

  const urlParams = parseDevParams(window.location?.search || '');
  let activeJump = urlParams.jump || names[0] || 'earth';

  // Create collapsed tab button
  const tabBtn = document.createElement('button');
  tabBtn.id = 'dev-menu-tab';
  tabBtn.type = 'button';
  tabBtn.setAttribute('aria-label', 'Developer menu');
  tabBtn.textContent = 'Dev';
  tabBtn.style.cssText = 'position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:120;background:#0a1730;color:#38bdf8;border:1px solid #1e3a6a;border-right:none;border-radius:8px 0 0 8px;padding:10px 12px;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;font-size:0.85rem;font-weight:700;letter-spacing:0.5px;cursor:pointer;box-shadow:-4px 0 16px rgba(0,0,0,0.55);transition:background 0.2s,color 0.2s;';

  tabBtn.addEventListener('mouseenter', () => { tabBtn.style.background = '#0f2752'; tabBtn.style.color = '#7dd3fc'; });
  tabBtn.addEventListener('mouseleave', () => { tabBtn.style.background = '#0a1730'; tabBtn.style.color = '#38bdf8'; });

  // Create slide-out menu panel
  const panel = document.createElement('div');
  panel.id = 'dev-menu-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Developer menu');
  panel.setAttribute('aria-hidden', 'true');
  panel.style.cssText = 'position:fixed;right:0;top:50%;transform:translateY(-50%);width:min(90vw,310px);max-height:85vh;overflow-y:auto;background:#07122a;border:1px solid #1e3a6a;border-right:none;border-radius:14px 0 0 14px;padding:16px;box-shadow:-8px 0 32px rgba(0,0,0,0.75);z-index:121;display:none;font-family:\'Space Grotesk\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#e8f3ff;';

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #1e293b;padding-bottom:8px;">
      <span style="font-weight:700;font-size:0.95rem;color:#38bdf8;">Dev tools</span>
      <button type="button" id="dev-menu-close" style="background:transparent;border:1px solid #334155;color:#94a3b8;border-radius:6px;padding:4px 8px;font-size:0.75rem;cursor:pointer;font-family:inherit;">Close</button>
    </div>

    <div style="margin-bottom:12px;">
      <div style="font-size:0.75rem;font-weight:600;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Jump to point</div>
      <div id="dev-jump-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:5px;max-height:160px;overflow-y:auto;padding-right:2px;"></div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;font-size:0.8rem;">
      <label style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#cbd5e1;">Gear preset</span>
        <select id="dev-gear-select" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:3px 6px;font-family:inherit;font-size:0.8rem;">
          <option value="balanced">Balanced (46 kg)</option>
          <option value="light">Light (29 kg)</option>
          <option value="shield">Shield (57 kg)</option>
        </select>
      </label>

      <label style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#cbd5e1;">Landing site</span>
        <select id="dev-site-select" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:3px 6px;font-family:inherit;font-size:0.8rem;">
          <option value="ridge">Sunny ridge</option>
          <option value="crater">Shackleton crater</option>
        </select>
      </label>

      <label style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#cbd5e1;">Storm result</span>
        <select id="dev-storm-select" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:3px 6px;font-family:inherit;font-size:0.8rem;">
          <option value="none">None (shelter)</option>
          <option value="minor">Minor (40 mSv)</option>
          <option value="serious">Serious (80 mSv)</option>
        </select>
      </label>

      <label style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#cbd5e1;">Landing result</span>
        <select id="dev-landing-select" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:3px 6px;font-family:inherit;font-size:0.8rem;">
          <option value="soft">Soft (no damage)</option>
          <option value="rough">Rough (minor)</option>
          <option value="hard">Hard (major)</option>
        </select>
      </label>

      <label style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#cbd5e1;">Base choices</span>
        <select id="dev-base-select" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:3px 6px;font-family:inherit;font-size:0.8rem;">
          <option value="balanced">Balanced (14 h)</option>
          <option value="fast">Fast (9 h)</option>
          <option value="safe">Safe (19 h)</option>
        </select>
      </label>

      <label style="display:flex;align-items:center;gap:6px;margin-top:2px;">
        <input type="checkbox" id="dev-ladder-check" style="accent-color:#38bdf8;" />
        <span style="color:#cbd5e1;">Ladder animation</span>
      </label>
    </div>

    <div style="display:flex;gap:8px;">
      <button type="button" id="dev-menu-go" style="flex:1;background:#0284c7;color:#fff;border:none;border-radius:8px;padding:8px;font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;">Go</button>
      <button type="button" id="dev-menu-normal" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:0.8rem;cursor:pointer;">Normal start</button>
    </div>
  `;

  document.body.appendChild(tabBtn);
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector('#dev-menu-close');
  const jumpButtonsContainer = panel.querySelector('#dev-jump-buttons');
  const gearSelect = panel.querySelector('#dev-gear-select');
  const siteSelect = panel.querySelector('#dev-site-select');
  const stormSelect = panel.querySelector('#dev-storm-select');
  const landingSelect = panel.querySelector('#dev-landing-select');
  const baseSelect = panel.querySelector('#dev-base-select');
  const ladderCheck = panel.querySelector('#dev-ladder-check');
  const goBtn = panel.querySelector('#dev-menu-go');
  const normalBtn = panel.querySelector('#dev-menu-normal');

  // Set initial form states from URL
  if (gearSelect) gearSelect.value = urlParams.gear || 'balanced';
  if (siteSelect) siteSelect.value = urlParams.site || 'ridge';
  if (stormSelect) stormSelect.value = urlParams.storm || 'none';
  if (landingSelect) landingSelect.value = urlParams.landing || 'soft';
  if (baseSelect) baseSelect.value = urlParams.base || 'balanced';
  if (ladderCheck) ladderCheck.checked = Boolean(urlParams.ladder);

  function buildQuery(jumpTarget) {
    const jump = jumpTarget || activeJump || 'earth';
    const gear = gearSelect ? gearSelect.value : 'balanced';
    const site = siteSelect ? siteSelect.value : 'ridge';
    const storm = stormSelect ? stormSelect.value : 'none';
    const landing = landingSelect ? landingSelect.value : 'soft';
    const base = baseSelect ? baseSelect.value : 'balanced';
    const ladder = ladderCheck && ladderCheck.checked ? '1' : '0';

    const searchParams = new URLSearchParams();
    searchParams.set('jump', jump);
    searchParams.set('site', site);
    searchParams.set('gear', gear);
    searchParams.set('storm', storm);
    searchParams.set('landing', landing);
    searchParams.set('base', base);
    if (ladder === '1') {
      searchParams.set('ladder', '1');
    }
    return '?' + searchParams.toString();
  }

  function navigateTo(search) {
    window.location.search = search;
  }

  function renderJumpButtons() {
    if (!jumpButtonsContainer) return;
    jumpButtonsContainer.innerHTML = '';
    for (const name of names) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSel = name === activeJump;
      btn.textContent = name;
      btn.style.cssText = `background:${isSel ? '#0284c7' : '#0f172a'};color:${isSel ? '#ffffff' : '#cbd5e1'};border:1px solid ${isSel ? '#38bdf8' : '#334155'};border-radius:6px;padding:5px 6px;font-size:0.75rem;font-weight:${isSel ? '700' : '500'};cursor:pointer;font-family:inherit;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
      btn.addEventListener('click', () => {
        activeJump = name;
        navigateTo(buildQuery(name));
      });
      jumpButtonsContainer.appendChild(btn);
    }
  }
  renderJumpButtons();

  function openPanel() {
    panel.style.display = 'block';
    panel.setAttribute('aria-hidden', 'false');
    tabBtn.style.display = 'none';
    if (closeBtn) closeBtn.focus();
  }

  function closePanel() {
    panel.style.display = 'none';
    panel.setAttribute('aria-hidden', 'true');
    tabBtn.style.display = 'block';
    tabBtn.focus();
  }

  tabBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openPanel();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePanel();
    });
  }

  if (goBtn) {
    goBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateTo(buildQuery(activeJump));
    });
  }

  if (normalBtn) {
    normalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.search = '';
    });
  }

  // Prevent keys and mouse actions inside panel from propagating to 3D navigation
  panel.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      closePanel();
    }
  });
  panel.addEventListener('keyup', (e) => {
    e.stopPropagation();
  });
  panel.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
  panel.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  panel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  return {
    open: openPanel,
    close: closePanel,
    tabBtn,
    panel,
  };
}

export default createDevMenu;
