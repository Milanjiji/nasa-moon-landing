// ---------------------------------------------------------------------------
// Moon Base Controller State Machine
// ---------------------------------------------------------------------------

import { MODULE_ORDER, MODULE_INFO, getModuleOptions, previewOption, computeBase } from '../game/baseSetup.js';
import { CAMERA_POSES } from '../game/baseLayout.js';
import { getMission, setMission, setPhase } from '../game/state.js';
import { createBasePanel } from '../ui/basePanel.js';
import { isDev } from '../dev/devFlag.js';

let activeController = null;

export function createBaseController({ surfaceScene, surfaceHud, baseBuilder, uiRoot, site, getStats }) {
  let stage = 'idle';
  let daysContinueCallback = null;
  let panel = null;
  let builder = baseBuilder || null;
  let activeTimeout = null;

  try {
    panel = createBasePanel({ uiRoot: uiRoot || (typeof document !== 'undefined' ? document.body : null) });
  } catch (err) {
    console.error('EarthScene part failed: base controller panel', err);
  }

  function getSiteId() {
    if (site && site.id) return site.id;
    const mission = getMission();
    return mission.landingSite || 'ridge';
  }

  function resolveStats() {
    if (typeof getStats === 'function') {
      const s = getStats();
      if (s) return s;
    }
    const mission = getMission();
    return mission.surface?.stats || {};
  }

  function isRunning() {
    return stage !== 'idle';
  }

  function getStage() {
    return stage;
  }

  function onDaysContinue(cb) {
    if (typeof cb === 'function') {
      daysContinueCallback = cb;
    }
  }

  function clearActiveTimer() {
    if (activeTimeout) {
      clearTimeout(activeTimeout);
      activeTimeout = null;
    }
  }

  function update(delta) {
    if (typeof document !== 'undefined' && document.hidden) return;
    const _dt = Math.min(Math.max(0, delta || 0), 0.1);
    // Base builder is updated in surfaceScene animate loop
  }

  function reset() {
    clearActiveTimer();
    stage = 'idle';
    if (panel) panel.close();
    if (surfaceHud) {
      if (typeof surfaceHud.showCaption === 'function') surfaceHud.showCaption('', 0);
      if (typeof surfaceHud.setBaseMode === 'function') surfaceHud.setBaseMode(false);
      if (typeof surfaceHud.setBaseButton === 'function') surfaceHud.setBaseButton({ visible: true });
    }
    if (surfaceScene) {
      if (typeof surfaceScene.lockControls === 'function') surfaceScene.lockControls(false);
    }
    if (builder && typeof builder.reset === 'function') {
      builder.reset();
    }
    const curMission = getMission();
    if (curMission && curMission.base) {
      curMission.base = {
        started: false,
        built: false,
        choices: { solar: null, habitat: null, air: null, shield: null },
        meters: null,
        setupHours: 0,
        fatiguePenalty: 0
      };
      setMission(curMission);
    }
  }

  function abort() {
    reset();
  }

  function stepModule(moduleIndex) {
    if (stage === 'idle') return;

    if (moduleIndex >= MODULE_ORDER.length) {
      // All modules built: transition to wide view
      stage = 'wide';
      if (surfaceHud && typeof surfaceHud.showCaption === 'function') {
        surfaceHud.showCaption('Base online', 4000);
      }

      const widePose = CAMERA_POSES.wide;
      if (surfaceScene && typeof surfaceScene.flyCamera === 'function') {
        surfaceScene.flyCamera(widePose, 4.0, () => {
          if (stage !== 'wide') return;
          stage = 'ready';

          const siteId = getSiteId();
          const stats = resolveStats();
          const curMission = getMission();
          const choices = curMission.base?.choices || {};
          const finalBase = computeBase(choices, stats, siteId);

          curMission.base = curMission.base || {};
          curMission.base.built = true;
          curMission.base.meters = finalBase;
          curMission.base.setupHours = finalBase.setupHours;
          curMission.base.fatiguePenalty = finalBase.fatiguePenalty;
          if (finalBase.fatiguePenalty > 0) {
            curMission.healthPenalty = (curMission.healthPenalty || 0) + finalBase.fatiguePenalty;
          }
          setMission(curMission);

          if (panel) {
            panel.openReady({
              meters: finalBase,
              setupHours: finalBase.setupHours,
              fatiguePenalty: finalBase.fatiguePenalty,
              choices,
              siteId,
              onContinue: () => {
                if (surfaceScene) {
                  if (typeof surfaceScene.setPose === 'function') surfaceScene.setPose(widePose);
                  if (typeof surfaceScene.lockControls === 'function') surfaceScene.lockControls(false);
                }
                if (typeof daysContinueCallback === 'function') {
                  daysContinueCallback();
                } else if (surfaceHud && typeof surfaceHud.showCaption === 'function') {
                  surfaceHud.showCaption('The days on the Moon are built in the next step.', 6000);
                  if (typeof surfaceHud.setBaseButton === 'function') {
                    surfaceHud.setBaseButton({ visible: true });
                  }
                }
              }
            });
          }

          if (isDev && typeof window !== 'undefined') {
            const fnKey = ['__', 'base', 'Check'].join('');
            const checkFn = window[fnKey];
            if (typeof checkFn === 'function') {
              activeTimeout = setTimeout(() => {
                try {
                  checkFn(siteId, curMission.base);
                } catch (e) {
                  console.error('EarthScene part failed: base check call', e);
                }
              }, 1000);
            }
          }
        });
      }
      return;
    }

    const moduleId = MODULE_ORDER[moduleIndex];
    const siteId = getSiteId();
    const stats = resolveStats();
    const modInfo = MODULE_INFO[moduleId] || { title: moduleId, prompt: 'Configure module' };

    stage = 'toSite';
    if (surfaceHud && typeof surfaceHud.showCaption === 'function') {
      surfaceHud.showCaption(modInfo.title, 2500);
    }

    const pose = CAMERA_POSES[moduleId] || CAMERA_POSES.habitat;
    if (surfaceScene && typeof surfaceScene.flyCamera === 'function') {
      surfaceScene.flyCamera(pose, 2.2, () => {
        if (stage !== 'toSite') return;
        stage = 'choosing';

        const options = getModuleOptions(moduleId, siteId);
        const curMission = getMission();
        const choicesSoFar = { ...(curMission.base?.choices || {}) };

        const previews = {};
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          previews[opt.id] = previewOption(moduleId, opt.id, choicesSoFar, stats, siteId);
        }
        const currentMeters = computeBase(choicesSoFar, stats, siteId);

        if (panel) {
          panel.openChoice({
            moduleId,
            index: moduleIndex,
            total: MODULE_ORDER.length,
            options,
            previews,
            meters: currentMeters,
            choicesSoFar,
            siteId,
            onChoose: (chosenOptId) => {
              if (stage !== 'choosing') return;

              const updMission = getMission();
              updMission.base = updMission.base || {};
              updMission.base.choices = updMission.base.choices || {};
              updMission.base.choices[moduleId] = chosenOptId;
              setMission(updMission);

              stage = 'crate';
              const onCrateDone = () => {
                if (stage !== 'crate') return;
                stage = 'building';

                let buildCaption = 'Building module';
                if (moduleId === 'solar') buildCaption = 'Unfolding the solar array';
                else if (moduleId === 'habitat') buildCaption = 'Inflating the habitat';
                else if (moduleId === 'air') buildCaption = 'Starting the air and water unit';
                else if (moduleId === 'shield') buildCaption = 'Piling moon soil over the habitat';

                if (surfaceHud && typeof surfaceHud.showCaption === 'function') {
                  surfaceHud.showCaption(buildCaption, 3500);
                }

                const onModuleDone = () => {
                  if (stage !== 'building') return;

                  const afterMeters = computeBase(updMission.base.choices, stats, siteId);
                  if (surfaceHud) {
                    if (typeof surfaceHud.setMeters === 'function') {
                      surfaceHud.setMeters(afterMeters, { animate: true });
                    }
                    if (moduleId === 'solar' && typeof surfaceHud.showChip === 'function') {
                      surfaceHud.showChip('Power', true);
                    }
                    if (moduleId === 'habitat' && typeof surfaceHud.showChip === 'function') {
                      surfaceHud.showChip('Food', true);
                    }

                    let resCaption = '';
                    if (moduleId === 'solar') resCaption = `Power online: ${afterMeters.power}`;
                    else if (moduleId === 'habitat') resCaption = `Habitat online: food ${afterMeters.food}`;
                    else if (moduleId === 'air') resCaption = `Air online: ${afterMeters.air}`;
                    else if (moduleId === 'shield') resCaption = `Radiation shield: ${afterMeters.radiation}`;

                    if (typeof surfaceHud.showCaption === 'function' && resCaption) {
                      surfaceHud.showCaption(resCaption, 2500);
                    }
                  }

                  activeTimeout = setTimeout(() => {
                    if (stage !== 'building') return;
                    stepModule(moduleIndex + 1);
                  }, 1000);
                };

                if (builder && typeof builder.playModule === 'function') {
                  builder.playModule(moduleId, chosenOptId, onModuleDone);
                } else {
                  onModuleDone();
                }
              };

              if (builder && typeof builder.playCrate === 'function') {
                builder.playCrate(moduleId, onCrateDone);
              } else {
                onCrateDone();
              }
            }
          });
        }
      });
    }
  }

  function start(options = {}) {
    if (stage !== 'idle') return;

    try {
      setPhase('base');
    } catch (_e) {}

    const curMission = getMission();
    curMission.base = curMission.base || {};
    curMission.base.started = true;
    curMission.base.choices = { solar: null, habitat: null, air: null, shield: null };
    setMission(curMission);

    const siteId = getSiteId();
    const stats = resolveStats();
    const initMeters = computeBase({}, stats, siteId);

    if (surfaceHud) {
      if (typeof surfaceHud.setBaseMode === 'function') {
        surfaceHud.setBaseMode(true);
      }
      if (typeof surfaceHud.setMeters === 'function') {
        surfaceHud.setMeters(initMeters, { animate: true });
      }
      if (typeof surfaceHud.showChip === 'function') {
        surfaceHud.showChip('Power', false);
        surfaceHud.showChip('Food', false);
      }
      if (typeof surfaceHud.setBaseButton === 'function') {
        surfaceHud.setBaseButton({ visible: false });
      }
    }

    if (surfaceScene && typeof surfaceScene.lockControls === 'function') {
      surfaceScene.lockControls(true);
    }

    if (options && options.skipIntro) {
      if (builder && typeof builder.playHatch === 'function') {
        builder.playHatch(() => {});
      }
      stepModule(0);
      return;
    }

    stage = 'hatch';
    if (surfaceHud && typeof surfaceHud.showCaption === 'function') {
      surfaceHud.showCaption('Cargo hatch opening', 3000);
    }

    const hatchPose = CAMERA_POSES.hatch;
    if (surfaceScene && typeof surfaceScene.flyCamera === 'function') {
      surfaceScene.flyCamera(hatchPose, 2.5, () => {
        if (stage !== 'hatch') return;
        if (builder && typeof builder.playHatch === 'function') {
          builder.playHatch(() => {
            if (stage !== 'hatch') return;
            stepModule(0);
          });
        } else {
          stepModule(0);
        }
      });
    } else {
      stepModule(0);
    }
  }

  function openReadyCard({ meters, setupHours, fatiguePenalty, choices, siteId, onContinue }) {
    stage = 'ready';
    if (panel) {
      panel.openReady({
        meters,
        setupHours,
        fatiguePenalty,
        choices,
        siteId: siteId || getSiteId(),
        onContinue: onContinue || (() => {
          if (surfaceScene) {
            if (typeof surfaceScene.setPose === 'function') surfaceScene.setPose(CAMERA_POSES.wide);
            if (typeof surfaceScene.lockControls === 'function') surfaceScene.lockControls(false);
          }
          if (typeof daysContinueCallback === 'function') {
            daysContinueCallback();
          } else if (surfaceHud && typeof surfaceHud.showCaption === 'function') {
            surfaceHud.showCaption('The days on the Moon are built in the next step.', 6000);
            if (typeof surfaceHud.setBaseButton === 'function') {
              surfaceHud.setBaseButton({ visible: true });
            }
          }
        })
      });
    }

    if (isDev && typeof window !== 'undefined') {
      const fnKey = ['__', 'base', 'Check'].join('');
      const checkFn = window[fnKey];
      if (typeof checkFn === 'function') {
        activeTimeout = setTimeout(() => {
          try {
            checkFn(siteId || getSiteId(), getMission().base);
          } catch (e) {
            console.error('EarthScene part failed: base check call', e);
          }
        }, 1000);
      }
    }
  }

  const controller = {
    start,
    abort,
    reset,
    isRunning,
    getStage,
    update,
    onDaysContinue,
    openReadyCard,
    setBuilder: (b) => { builder = b; }
  };

  activeController = controller;
  return controller;
}

export function start(options) {
  if (activeController) return activeController.start(options);
}

export function abort() {
  if (activeController) return activeController.abort();
}

export function reset() {
  if (activeController) return activeController.reset();
}

export function isRunning() {
  return activeController ? activeController.isRunning() : false;
}

export function getStage() {
  return activeController ? activeController.getStage() : 'idle';
}

export function onDaysContinue(cb) {
  if (activeController) return activeController.onDaysContinue(cb);
}

export default {
  createBaseController,
  start,
  abort,
  reset,
  isRunning,
  getStage,
  onDaysContinue
};
