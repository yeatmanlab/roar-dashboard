import jsPsychFullScreen from '@jspsych/plugin-fullscreen'; // plugin for going into fullscreen
import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response';
import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import i18next from 'i18next';
import '../../../i18n/i18n';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { jsPsych } from '../helpers/taskSetup';
import { mediaAssets } from '../helpers/mediaAssets';
import { sessionGet } from '../helpers/sessionHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';
import { wrapAsJsPsychTrial } from '../helpers/jspsychHelpers';
import { AssessmentStage } from '../helpers/namingHelpers';

const sentryFeedback = document.querySelector('#sentry-feedback');
const DURATION_ENTER_FULL_SCREEN = 250;
const SCALE_REQUEST_FULLSCREEN = 0.85;

let touchGuardsInstalled = false;
let touchGuardsMeta = null;
let touchGuardsMetaCreated = false;
let touchGuardsMetaPrevContent = null;

const gestureEvents = ['gesturestart', 'gesturechange', 'gestureend'];
const blockGesture = (e) => e.preventDefault();
const blockTouchMove = (e) => {
  if (e.touches.length > 1) e.preventDefault();
};

export const installTouchGuards = () => {
  if (touchGuardsInstalled) return;
  touchGuardsInstalled = true;

  let meta = document.querySelector('meta[name="viewport"]');
  touchGuardsMetaCreated = !meta;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }

  touchGuardsMeta = meta;
  touchGuardsMetaPrevContent = meta.getAttribute('content');

  meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

  gestureEvents.forEach((evt) => {
    document.addEventListener(evt, blockGesture, { passive: false });
  });

  document.addEventListener('touchmove', blockTouchMove, { passive: false });
};

export const uninstallTouchGuards = () => {
  if (!touchGuardsInstalled) return;

  gestureEvents.forEach((evt) => {
    document.removeEventListener(evt, blockGesture);
  });
  document.removeEventListener('touchmove', blockTouchMove);

  if (touchGuardsMeta) {
    if (touchGuardsMetaCreated) {
      touchGuardsMeta.remove();
    } else if (touchGuardsMetaPrevContent == null) {
      touchGuardsMeta.removeAttribute('content');
    } else {
      touchGuardsMeta.setAttribute('content', touchGuardsMetaPrevContent);
    }
  }

  touchGuardsInstalled = false;
  touchGuardsMeta = null;
  touchGuardsMetaCreated = false;
  touchGuardsMetaPrevContent = null;
};

export const t_installTouchGuards = () =>
  wrapAsJsPsychTrial(() => {
    installTouchGuards();
  });

export const t_uninstallTouchGuards = () =>
  wrapAsJsPsychTrial(() => {
    uninstallTouchGuards();
  });

// mirrors jsPsych 7's logic for not going in full screen
const isFullscreenBlockedByJsPsych = () => typeof Element !== 'undefined' && 'ALLOW_KEYBOARD_INPUT' in Element;

const isFullscreen = () =>
  Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);

const onFullscreenStart = () => {
  document.body.style.cursor = 'default';
  if (sentryFeedback) {
    sentryFeedback.style.display = 'none';
  }
};

const enterFullscreenCompat = () => {
  const element = document.documentElement;

  if (element.requestFullscreen) {
    const p = element.requestFullscreen();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return;
  }
  if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
    return;
  }
  if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
};

const unlockAudioContext = () => {
  const ctx = jsPsych.pluginAPI.audioContext();
  if (ctx) {
    if (ctx.state !== 'running') {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch (_) {
      /* empty */
    }
  }

  const a = new Audio(mediaAssets.audio.roavMpNullAudioAll);
  a.playsInline = true;
  const playPromise = a.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        a.pause();
        a.currentTime = 0;
      })
      .catch(() => {});
  }
};

const t_enterFullscreenPlugin = (unlockAudio) => ({
  type: jsPsychFullScreen,
  fullscreen_mode: true,
  message: () => {
    const html = `
          <div class="roav-card-sys">
            <div>
              <img src="${mediaAssets.images.roavMpTechIconFullscreenAll}" class="roav-card-sys-img">
            </div>
            <br>
            <br>
            <div>
              <h1>${i18next.t('enter-full-screen.prompt')}</h1>
            </div>
            <br>
            <br>
          </div>`;
    return html;
  },
  delay_after: 0,
  button_label: () => `${i18next.t('enter-full-screen.label-button')}`,
  on_start: () => onFullscreenStart(),
  on_load: () => {
    const btn = document.getElementById('jspsych-fullscreen-btn');
    btn?.classList.add('roav-button-sys-large');

    if (unlockAudio) {
      btn?.addEventListener(
        'click',
        (e) => {
          if (!e.isTrusted) return;
          document.addEventListener('fullscreenchange', unlockAudioContext, {
            once: true,
          });
          document.addEventListener('webkitfullscreenchange', unlockAudioContext, { once: true });
          unlockAudioContext();
        },
        { capture: true, once: true },
      );
    }
  },
});

const t_enterFullscreenCompat = (unlockAudio) => ({
  type: jsPsychHtmlButtonResponse,
  stimulus: () => {
    const html = `
          <div class="roav-card-sys">
            <div>
              <img src="${mediaAssets.images.roavMpTechIconFullscreenAll}" class="roav-card-sys-img">
            </div>
            <div>
              <h2>${i18next.t('enter-full-screen.prompt')}</h2>
            </div>
          </div>`;
    return html;
  },
  choices: [i18next.t('enter-full-screen.label-button')],
  on_start: () => onFullscreenStart(),
  response_allowed_while_playing: true,
  on_load: () => {
    const btnWrap = document.getElementById('jspsych-html-button-response-button-0');
    btnWrap?.classList.add('roav-button-sys-large');

    btnWrap?.addEventListener(
      'click',
      (e) => {
        if (unlockAudio) {
          if (!e.isTrusted) return;
          document.addEventListener('fullscreenchange', unlockAudioContext, {
            once: true,
          });
          document.addEventListener('webkitfullscreenchange', unlockAudioContext, {
            once: true,
          });

          unlockAudioContext();
        }
        enterFullscreenCompat();
      },
      { capture: true, once: true },
    );
  },
});

export const t_enterFullscreen = (unlockAudio) => ({
  timeline: [
    {
      timeline: [t_enterFullscreenPlugin(unlockAudio)],
      conditional_function: () => !isFullscreenBlockedByJsPsych(),
    },
    {
      timeline: [t_enterFullscreenCompat(unlockAudio)],
      conditional_function: () => isFullscreenBlockedByJsPsych(),
    },
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '',
      choices: 'NO_KEYS',
      trial_duration: DURATION_ENTER_FULL_SCREEN,
    },
    {
      type: jsPsychCallFunction,
      func: () => {},
      on_finish: () => {
        jsPsych.data.addDataToLastTrial({
          save_trial: true,
          assessment_stage: AssessmentStage.DATA,
          correct: isFullscreen(),
          type_trial: 'enter-full-screen',
          id_trial: 'enter-full-screen',
          pid: sessionGet(SK.CONFIG).pid,
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          window_inner_width: window.innerWidth,
          window_inner_height: window.innerHeight,
        });
      },
    },
  ],
});

const resizeDetectedConditional = (widthFsIn, heightFsIn, scaleWidthIn, scaleHeightIn) => {
  const widthFs = widthFsIn ?? sessionGet(SK.WIDTH_WINDOW_FS);
  const heightFs = heightFsIn ?? sessionGet(SK.HEIGHT_WINDOW_FS);
  const scaleWidth = scaleWidthIn ?? SCALE_REQUEST_FULLSCREEN;
  const scaleHeight = scaleHeightIn ?? SCALE_REQUEST_FULLSCREEN;

  const width = Math.max(window.innerWidth, window.innerHeight);
  const height = Math.min(window.innerWidth, window.innerHeight);
  return width < scaleWidth * widthFs || height < scaleHeight * heightFs;
};

export const t_trialEnterFullscreenConditional = (widthFsIn, heightFsIn, scaleWidthIn, scaleHeightIn) => ({
  timeline: [t_enterFullscreen(false)],
  conditional_function: () => resizeDetectedConditional(widthFsIn, heightFsIn, scaleWidthIn, scaleHeightIn),
});

export const t_exitFullscreen = () => ({
  type: jsPsychFullScreen,
  fullscreen_mode: false,
  delay_after: 0,
});

// LANDSCAPE HELPERS
export const isOrientationLandscape = () => {
  const mql = window.matchMedia?.('(orientation: landscape)');
  return mql ? mql.matches : true; // window.innerWidth > window.innerHeight;
};

export const addEventListenersOrientation = (callbackOnOrientationChange) => {
  const mql = window.matchMedia?.('(orientation: landscape)') ?? null;
  if (mql) {
    if (mql.addEventListener) mql.addEventListener('change', callbackOnOrientationChange);
  }
  window.addEventListener('orientationchange', callbackOnOrientationChange);

  return mql;
};

export const removeEventListenersOrientation = (mql, callbackOnOrientationChange) => {
  if (callbackOnOrientationChange) {
    window.removeEventListener('orientationchange', callbackOnOrientationChange);
    if (mql) {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', callbackOnOrientationChange);
      }
    }
  }
};

// eslint-disable-next-line no-unused-vars
const paramsDefEnterLandscape = {
  on_finish_ext: null,
};

export const t_enterLandscape = (params = {}) => {
  let mql = null;
  let callbackOnOrientationChange = null;

  return {
    timeline: [
      {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: () => {
          const html = `
                  <div class="roav-card-sys">
                    <div>
                      <img src="${mediaAssets.images.roavMpTechIconLandscapeAll}" class="roav-card-sys-img">
                    </div>
                    <div>
                      <h2>${i18next.t('enter-landscape.prompt')}</h2>
                    </div>
                  </div>`;
          return html;
        },
        choices: 'NO_KEYS',
        response_ends_trial: false,
        on_load: () => {
          if (isOrientationLandscape()) {
            jsPsych.finishTrial();
            return;
          }
          callbackOnOrientationChange = () => {
            if (!isOrientationLandscape()) return;
            removeEventListenersOrientation(mql, callbackOnOrientationChange);
            jsPsych.finishTrial();
          };
          mql = addEventListenersOrientation(callbackOnOrientationChange);
        },
        on_finish: () => {
          removeEventListenersOrientation(mql, callbackOnOrientationChange);
          jsPsych.data.addDataToLastTrial({
            save_trial: true,
            assessment_stage: AssessmentStage.DATA,
            correct: isOrientationLandscape(),
            type_trial: 'enter-landscape',
            id_trial: 'enter-landscape',
            pid: sessionGet(SK.CONFIG).pid,
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            window_inner_width: window.innerWidth,
            window_inner_height: window.innerHeight,
          });
          if (params.on_finish_ext && typeof params.on_finish_ext === 'function') {
            params.on_finish_ext();
          }
        },
      },
    ],
    conditional_function: () => !isOrientationLandscape(),
  };
};

export const createHelperOrientation = (onOrientationChange) => {
  let mqlOrientation = null;
  let rotationDetected = false;
  let callbackOnOrientChange = null;

  const startEventListeners = () => {
    rotationDetected = false;
    mqlOrientation = addEventListenersOrientation(callbackOnOrientChange);
  };

  const removeEventListeners = () => {
    removeEventListenersOrientation(mqlOrientation, callbackOnOrientChange);
    callbackOnOrientChange = null;
    mqlOrientation = null;
  };

  callbackOnOrientChange = () => {
    if (rotationDetected) {
      return;
    }
    if (!isOrientationLandscape()) {
      rotationDetected = true;
      removeEventListeners();
      onOrientationChange();
    }
  };

  return {
    startEventListeners,
    removeEventListeners,
    rotationDetected: () => rotationDetected,
  };
};

export const createHelperFullscreenConditional = (
  funcOnResize,
  widthFs,
  heightFs,
  scaleWidth = SCALE_REQUEST_FULLSCREEN,
  scaleHeight = SCALE_REQUEST_FULLSCREEN,
) => {
  let resizeDetected = false;
  let callbackOnResize = null;

  const removeEventListeners = () => {
    window.removeEventListener('resize', callbackOnResize);
    document.removeEventListener('fullscreenchange', callbackOnResize);
    document.removeEventListener('webkitfullscreenchange', callbackOnResize);
    callbackOnResize = null;
  };

  const startEventListeners = () => {
    resizeDetected = false;
    callbackOnResize = () => {
      if (resizeDetected) return;
      resizeDetected = resizeDetectedConditional(widthFs, heightFs, scaleWidth, scaleHeight);
      if (resizeDetected) {
        removeEventListeners();
        funcOnResize();
      }
    };
    window.addEventListener('resize', callbackOnResize);
    document.addEventListener('fullscreenchange', callbackOnResize);
    document.addEventListener('webkitfullscreenchange', callbackOnResize);
  };

  return {
    startEventListeners,
    removeEventListeners,
    resizeDetected: () => resizeDetected,
  };
};
