import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { deviceType, primaryInput } from 'detect-it';
import { getDeviceInfo } from '@bdelab/roar-utils';
import { mediaAssets } from '../helpers/mediaAssets';
import { jsPsych } from '../helpers/taskSetup';
import { AssessmentStage, fillTextKeyValuesDef } from '../helpers/namingHelpers';
import { sessionGet, sessionSet } from '../helpers/sessionHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';
import { FPS_STANDARD } from '../helpers/constants';
import { scrollToTop } from '../helpers/layoutHelpers';

const DURATION_ESTIMATE = 1000; // ms

const estimateFps = () => {
  const fpsDefault = FPS_STANDARD.FPS_60;
  const fpsStandard = [
    FPS_STANDARD.FPS_30,
    FPS_STANDARD.FPS_60,
    FPS_STANDARD.FPS_75,
    FPS_STANDARD.FPS_90,
    FPS_STANDARD.FPS_120,
  ];
  const fpsDelta = 10;

  let cntFrame = 0;
  const durationMs = DURATION_ESTIMATE;

  return new Promise((resolve) => {
    let startTs = null;

    function loop(ts) {
      if (startTs === null) {
        startTs = ts;
      }
      cntFrame += 1;

      if (ts - startTs < durationMs) {
        requestAnimationFrame(loop);
      } else {
        const elapsedSec = (ts - startTs) / 1000;
        const fpsRaw = cntFrame / elapsedSec;
        const fpsRound = fpsStandard.find((std) => Math.abs(fpsRaw - std) <= fpsDelta);
        const fps = fpsRound ?? fpsDefault;
        resolve({
          fps,
          fpsRaw,
        });
      }
    }
    requestAnimationFrame(loop);
  });
};

const paramsDef = () => ({
  keyImgBg: ['', '', 'bg'],
});

export const t_collectDataMonitor = (paramsIn = {}) => {
  let params;

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => {
          params = {
            ...fillTextKeyValuesDef(paramsDef()),
            ...fillTextKeyValuesDef(paramsIn),
          };
        },
      },
      {
        type: jsPsychHtmlKeyboardResponse,

        // eslint-disable-next-line arrow-body-style
        stimulus: () => {
          if (mediaAssets.images[params.keyImgBg]) {
            return `
              <div class = "roav-container-viewport-adaptive">
                <img src="${mediaAssets.images[params.keyImgBg]}" alt= "background" class="roav-img-fullscreen"> 
              </div>
            `;
          }
          return '';
        },
        choices: 'NO_KEYS',
        response_ends_trial: false,
        on_load: () => {
          scrollToTop();
          // safeguard for Safari
          let infoDevice = null;
          try {
            infoDevice = getDeviceInfo();
          } catch (_) {
            /* empty */
          }

          estimateFps().then(({ fps, fpsRaw }) => {
            sessionSet(SK.FPS, fps);

            const widthWindowFS = Math.max(window.innerWidth, window.innerHeight);
            const heightWindowFS = Math.min(window.innerWidth, window.innerHeight);

            sessionSet(SK.WIDTH_WINDOW_FS, widthWindowFS);
            sessionSet(SK.HEIGHT_WINDOW_FS, heightWindowFS);
            document.documentElement.style.setProperty('--width-fs', `${widthWindowFS}px`);
            document.documentElement.style.setProperty('--height-fs', `${heightWindowFS}px`);

            const data = {
              save_trial: true,
              assessment_stage: AssessmentStage.DATA,
              correct: true,
              type_trial: 'collect-data-monitor',
              id_trial: 'collect-data-monitor',
              pid: sessionGet(SK.CONFIG).pid,
              fps,
              fps_raw: fpsRaw,
              screen_width: window.screen.width,
              screen_height: window.screen.height,
              window_inner_width: widthWindowFS,
              window_inner_height: heightWindowFS,
              device_pixel_ratio: window.devicePixelRatio,
              user_agent: infoDevice?.userAgent ?? '',
              platform: infoDevice?.platform ?? '',
              mobile: infoDevice?.mobile ?? '',
              engine: infoDevice?.engine ?? '',
              engine_version: infoDevice?.engineVersion ?? '',
              browser: infoDevice?.browser ?? '',
              browser_version: infoDevice?.browserVersion ?? '',
              device_type: deviceType ?? '',
              primary_input: primaryInput ?? '',
            };

            jsPsych.finishTrial(data);
          });
        },
      },
    ],
  };
};
