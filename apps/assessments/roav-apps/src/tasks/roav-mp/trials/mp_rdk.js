/* eslint-disable no-underscore-dangle */
import jsPsychAudioKeyboardResponse from '@jspsych/plugin-audio-keyboard-response';
import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import jsPsychRdk from '@jspsych-contrib/plugin-rdk';
import { summary } from '../../shared/trials/summaryHelpers';
import { jsPsych } from '../../shared/helpers/taskSetup';
import { quest } from '../../shared/trials/questHelpers';
import { mediaAssets } from '../../shared/helpers/mediaAssets';
import {
  AssessmentStage,
  fillTextKeyValuesDef,
  ModeGame,
  SubtypeTrial,
  TypeKey,
} from '../../shared/helpers/namingHelpers';
import { getValidityEvaluator } from '../../shared/trials/validityHelpers';
import {
  updateModeInputInfoOnKeyEvent,
  updateModeInputInfoOnPointerEvent,
  createHelperMouseMoveRecord,
  resetModeInputLast,
} from '../../shared/trials/inputModeHelpers';
import { fitTextHorElPx, startReflowLayout, stopReflowLayout } from '../../shared/helpers/layoutHelpers';

import {
  createHelperOrientation,
  t_enterLandscape,
  t_trialEnterFullscreenConditional,
} from '../../shared/trials/screenHelpers';
import { sessionGet, sessionSet } from '../../shared/helpers/sessionHelpers';
import { MP_SESSION_KEYS as SK } from '../helpers/mp_sessionKeys';
import { FPS_STANDARD, DURATIONS } from '../../shared/helpers/constants';
import { createHelperAudioCustom } from '../../shared/helpers/audioHelpers';
import { enableTrialByModeGame } from '../../shared/trials/flowHelpers';
import { UnitSize, UnitLocation, UnitSpeed, UnitTime } from '../../shared/helpers/unitsHelper';

const tagTrial = 'rdk';

export const DirRdk = {
  LEFT: 'left',
  RIGHT: 'right',
  RANDOM: 'random',
};

export const DOT_LIFE_DEFAULT = 200; // ms
const SIZE_FONT_BANNER_MIN = 0.5; // % fullscreen width
const SIZE_FONT_BANNER_MAX = 3.5;

const CM_IN_INCH = 2.54;
const RIGHT_DEG = 0;
const LEFT_DEG = 180;

const metaparamsDef = {
  coherence: 0.5,
  coherent_direction: 0,
  _coherent_direction: DirRdk.RANDOM,
  dot_color: '#000000',
  background_color: '#ffffff',
  trial_duration: 10000,
  response_ends_trial: true,
  post_trial_gap: 1000,
  number_of_dots: 150,
  RDK_type: 3,
  aperture_type: 1, // circle
  aperture_center_x: undefined,
  aperture_center_y: undefined,
  _aperture_center_x: 0.5,
  _aperture_center_y: 0.5,
  _aperture_center_unit: UnitLocation.PERCENT,
  aperture_width: undefined,
  aperture_height: undefined,
  _aperture_width: 70, // alt: 14
  _aperture_height: 70, // alt: 14
  _aperture_size_unit: UnitSize.PERCENT_HEIGHT, // alt: "deg"
  choices: [TypeKey.ARROW_LEFT, TypeKey.ARROW_RIGHT],
  correct_choice: [TypeKey.ARROW_RIGHT],
  fixation_cross: false,
  _fixation_cross_color: '#000000',
  _fixation_cross_size: 1, // 1 from the paper - but somehow it is 1/2 of cross in RDK
  _fixation_cross_size_unit: UnitSize.DEG,
  fixation_cross_width: undefined,
  fixation_cross_height: undefined,
  fixation_cross_thickness: 5,
  dot_radius: undefined, // 3.4, matching 5 pixels from Elle's paper
  _dot_radius: 0.15, // 0.15 degrees at 14 inch monitor
  _dot_radius_unit: UnitSize.DEG,
  move_distance: undefined,
  _move_distance: 8, // 8 degrees at 14 inch monitor, 60 Hz frame rate
  _move_distance_unit: UnitSpeed.DEG_PER_SEC,
  dot_life: undefined, // 12 frames
  _dot_life: DOT_LIFE_DEFAULT,
  _dot_life_unit: UnitTime.MS,
  reinsert_type: 1, // 1 = from opposite end
  border: false,
  border_color: undefined,

  // additional parameters NOT for plugin
  _fps: FPS_STANDARD.FPS_60,
  _viewing_dist_cm: 56,
  _screen_diag_cm: 14 * CM_IN_INCH,
  _screen_height: 1080, // in CSS px
  _screen_width: 1920,
  fps: undefined,
  screen_height: undefined,
  screen_width: undefined,
  window_inner_height: undefined,
  window_inner_width: undefined,
  device_pixel_ratio: undefined,

  _subtype_trial: SubtypeTrial.QUEST,
  _fixation_duration_pre: 500, // paper: pre 500, inter-trial: 1000
};

const infoDef = (tagReq) => ({
  tagReq: tagReq,
  stageAssessment: AssessmentStage.NONE,
  nameCorpus: sessionGet(SK.NAME_CORPUS) ?? 'none',
  nameBlock: 'none',
  indTrial: undefined, // within block
  idTrial: undefined,
  evaluateValidity: true,

  showImgOverlay: false,

  keyImgBtnLeft: [tagTrial, '', 'button-left'],
  keyImgBtnRight: [tagTrial, '', 'button-right'],
  keyImgBgOverlay: [tagTrial, '', 'bg-overlay'],

  showBtnLeft: true,
  showBtnRight: true,
  animateBtnRight: false,
  animateBtnLeft: false,
  enableBtnRight: true,
  enableBtnLeft: true,

  keyFeedbackToneCorrect: ['feedback-tone', '', 'correct', ModeGame.ALL],
  keyFeedbackToneIncorrect: ['feedback-tone', '', 'incorrect', ModeGame.ALL],
  playFeedbackTone: true,

  keyAudio: [tagTrial, tagReq, ''],
  playAudio: false,

  textBanner: [tagTrial, tagReq, 'text2'], // text2 to be able to add text before and after to audio and make banner shorter
  showTextBanner: sessionGet(SK.MODE_GAME) !== ModeGame.GAME,
  showLog: false,

  modeGameTrial: ModeGame.ALL,

  animateFade: true,
  durationAnimateFade: 1000, // before trial ends, in ms

  gapColorSameAsBorder: false,
});

const paramsDummy = {
  choices: [TypeKey.DUMMY, TypeKey.DUMMY],
  correct_choice: [TypeKey.DUMMY],
  number_of_dots: 1,
  coherence: 0,
  coherent_direction: 0,
  trial_duration: 10,
  response_ends_trial: true,
};

const degToPx = (deg, viewingDistCm, displayDiagCm, displayWidthPx, displayHeightPx) => {
  const lenCm = 2 * viewingDistCm * Math.tan((deg * Math.PI) / 180 / 2);
  const displayDiagPx = Math.sqrt(displayWidthPx * displayWidthPx + displayHeightPx * displayHeightPx);
  const lenPx = (lenCm * displayDiagPx) / displayDiagCm;
  return lenPx;
};

const metaparamsToParams = (metaparams, screen_width, screen_height, view_width, view_height, fps) => {
  const params = { ...metaparams };

  if (params.border) {
    const modeGame = sessionGet(SK.MODE_GAME);
    params.border_color = metaparams.border_color;
    if (!params.border_color) {
      const container = jsPsych.getDisplayElement();
      params.border_color = getComputedStyle(container)
        .getPropertyValue(`--roav-mp-rdk-border-color-${modeGame}`)
        .trim();
    }
    params.border_thickness = metaparams.border_thickness;
    if (!params.border_thickness) {
      const widthScreen = window.screen.width;
      const heightScreen = window.screen.height;
      params.border_thickness = 0.5 * Math.sqrt(widthScreen * widthScreen + heightScreen * heightScreen);
    }
  }

  // direction
  switch (params._coherent_direction) {
    case DirRdk.LEFT:
      params.coherent_direction = LEFT_DEG;
      break;
    case DirRdk.RIGHT:
      params.coherent_direction = RIGHT_DEG;
      break;
    default:
      params.coherent_direction = Math.random() < 0.5 ? RIGHT_DEG : LEFT_DEG;
  }
  params.correct_choice = params.coherent_direction === 0 ? [params.choices[1]] : [params.choices[0]];

  // fixation cross_size
  switch (params._fixation_cross_size_unit) {
    case 'px':
      params.fixation_cross_width = params._fixation_cross_size;
      break;
    case 'deg':
      params.fixation_cross_width = degToPx(
        params._fixation_cross_size,
        params._viewing_dist_cm,
        params._screen_diag_cm,
        screen_width,
        screen_height,
      );
      break;
    default:
      params.fixation_cross_width = undefined;
  }
  params.fixation_cross_height = params.fixation_cross_width;

  // aperture_center
  switch (params._aperture_center_unit) {
    case UnitLocation.PX:
      params.aperture_center_x = params._aperture_center_x;
      params.aperture_center_y = params._aperture_center_y;
      break;
    case UnitLocation.PERCENT:
      params.aperture_center_x = params._aperture_center_x * view_width;
      params.aperture_center_y = params._aperture_center_y * view_height;
      break;
    default:
      params.aperture_center_x = undefined;
      params.aperture_center_y = undefined;
  }

  // aperture_width, aperture_height
  let aperture_size;
  let aperture_width;
  let aperture_height;
  switch (params._aperture_size_unit) {
    case UnitSize.PX:
      aperture_size = Math.min(params._aperture_height, params._aperture_width);
      break;
    case UnitSize.PERCENT_HEIGHT:
      aperture_size = (params._aperture_height * screen_height) / 100;
      break;
    case UnitSize.DEG:
      aperture_width = degToPx(
        params._aperture_width,
        params._viewing_dist_cm,
        params._screen_diag_cm,
        screen_width,
        screen_height,
      );
      aperture_height = degToPx(
        params._aperture_height,
        params._viewing_dist_cm,
        params._screen_diag_cm,
        screen_width,
        screen_height,
      );
      aperture_size = Math.min(aperture_height, aperture_width);
      break;
    default:
      aperture_size = undefined;
  }
  params.aperture_width = aperture_size;
  params.aperture_height = aperture_size;

  switch (params._dot_radius_unit) {
    case UnitSize.PX:
      params.dot_radius = params._dot_radius;
      break;
    case UnitSize.PERCENT_HEIGHT:
      params.dot_radius = (params._dot_radius * screen_height) / 100;
      break;
    case UnitSize.DEG:
      params.dot_radius = degToPx(
        params._dot_radius,
        params._viewing_dist_cm,
        params._screen_diag_cm,
        screen_width,
        screen_height,
      );
      break;
    default:
      params.dot_radius = undefined;
  }

  switch (params._move_distance_unit) {
    case UnitSpeed.PX:
      params.move_distance = params._move_distance;
      break;
    case UnitSpeed.PERCENT_HEIGHT_PER_SEC:
      params.move_distance = (params._move_distance * screen_height) / 100 / fps;
      break;
    case UnitSpeed.DEG_PER_SEC:
      params.move_distance =
        degToPx(params._move_distance, params._viewing_dist_cm, params._screen_diag_cm, screen_width, screen_height) /
        fps;
      break;
    default:
      params.move_distance = undefined;
  }

  switch (params._dot_life_unit) {
    case UnitTime.FRAMES:
      params.dot_life = params._dot_life;
      break;
    case UnitTime.MS:
      params.dot_life = (params._dot_life * fps) / 1000.0;
      break;
    default:
      params.dot_life = undefined;
  }

  return params;
};

// t_rdk parameters are expected in following format:
// {
//   metaparams: {},
//   info: {},
// };

export const t_rdk = (paramsTrialIn = {}, tagReq = 'def') => {
  let metaparams = null;

  let info = null;

  let paramsMain = null;

  let btnLeft = null;
  let btnRight = null;
  let inputFromBtn = false;

  let elTextBanner = null;

  let imgOverlay = null;
  let imgUnder = null;

  let responded = false;

  let divOverlayFade = null;
  let timeoutDivOverlayFade = null;

  let callbackReflowLayout = null;

  const helperAudioCustom = createHelperAudioCustom();
  const helperMouseMoveRecord = createHelperMouseMoveRecord();
  let helperOrient = null;

  const createImageOverlay = (container) => {
    if (info.showImgOverlay && mediaAssets.images[info.keyImgBgOverlay]) {
      imgOverlay = document.createElement('img');
      imgOverlay.src = mediaAssets.images[info.keyImgBgOverlay];
      imgOverlay.classList.add('roav-img-fixed-size');
      if (info.showImgOverlay && (info.showBtnLeft || info.showBtnRight)) {
        imgOverlay.classList.add('roav-img-muted');
      }
      container.appendChild(imgOverlay);
    }
  };

  const createButtonResponse = (container, leftright, keyPress, animate, enable) => {
    document.documentElement.style.setProperty('--roav-mp-rdk-aperture', `${paramsMain.aperture_width}px`);
    const modeGame = sessionGet(SK.MODE_GAME);
    let imgBtn = null;
    if (leftright === DirRdk.LEFT) {
      imgBtn = mediaAssets.images[info.keyImgBtnLeft];
    } else {
      imgBtn = mediaAssets.images[info.keyImgBtnRight];
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `roav-button roav-button-lr-large-fixed-${modeGame} ${leftright}`;
    const img = document.createElement('img');
    if (animate) {
      const classAttention = modeGame === ModeGame.GAME ? 'roav-button-attention-strong' : 'roav-button-attention';
      img.classList.add(classAttention);
    }
    img.src = imgBtn;
    button.appendChild(img);

    button.disabled = !enable;
    if (enable) {
      button.addEventListener('pointerdown', (e) => {
        inputFromBtn = true;
        updateModeInputInfoOnPointerEvent(e.pointerType);
      });
      button.addEventListener('click', () => {
        if (responded) return;
        responded = true;
        if (btnLeft) btnLeft.disabled = true;
        if (btnRight) btnRight.disabled = true;
        jsPsych.pluginAPI.pressKey(keyPress);
      });
    }
    container.appendChild(button);
    return button;
  };

  const prepareParams = () => {
    if (paramsMain) {
      return;
    }

    const fpsRes = sessionGet(SK.FPS) ?? metaparams._fps;
    const widthWindowFS = sessionGet(SK.WIDTH_WINDOW_FS) ?? window.innerWidth;
    const heightWindowFS = sessionGet(SK.HEIGHT_WINDOW_FS) ?? window.innerHeight;

    const params = metaparamsToParams(
      metaparams,
      widthWindowFS, // for sizes
      heightWindowFS,
      widthWindowFS,
      heightWindowFS, // for positioning - we do not want to scale on resize!
      fpsRes,
    );

    params.fps = fpsRes;
    params.screen_width = window.screen.width;
    params.screen_height = window.screen.height;
    params.window_inner_width = window.innerWidth;
    params.window_inner_height = window.innerHeight;
    params.device_pixel_ratio = window.devicePixelRatio;

    paramsMain = { ...params };
  };

  const fitTextAll = () => {
    const heightWindowFS = sessionGet(SK.HEIGHT_WINDOW_FS) ?? window.innerHeight;
    const sizeTextMin = (SIZE_FONT_BANNER_MIN * heightWindowFS) / 100;
    const sizeTextMax = (SIZE_FONT_BANNER_MAX * heightWindowFS) / 100;

    fitTextHorElPx(
      sizeTextMin,
      sizeTextMax,
      document.getElementById('id-text'),
      document.getElementById('id-text-wrap'),
    );
  };

  const createTextBanner = (container) => {
    const modeGame = sessionGet(SK.MODE_GAME);
    elTextBanner = document.createElement('div');
    elTextBanner.className = `roav-mp-rdk-text-wrap ${modeGame}`;
    elTextBanner.id = 'id-text-wrap';
    elTextBanner.innerHTML = `
        <div class="roav-mp-rdk-text" id="id-text">${info.textBanner}</div>
    `;
    container.appendChild(elTextBanner);
    return elTextBanner;
  };

  const createDivOverlayFade = (container) => {
    divOverlayFade?.remove();
    divOverlayFade = document.createElement('div');
    divOverlayFade.className = 'roav-mp-rdk-div-overlay-fade';
    divOverlayFade.style.opacity = '0.5';
    container.appendChild(divOverlayFade);
  };

  const createLayout = (isMainTrial) => {
    const container = jsPsych.getDisplayElement();
    container.classList.add('roav-container-viewport-fixed');
    const canvas = container?.getElementsByTagName('canvas')[0] ?? null;
    canvas?.classList.add('roav-mp-rdk-canvas');

    if (info.showBtnLeft) {
      btnLeft = createButtonResponse(
        container,
        'left',
        paramsMain.choices[0],
        info.animateBtnLeft && isMainTrial,
        info.enableBtnLeft && isMainTrial,
      );
    }
    if (info.showBtnRight) {
      btnRight = createButtonResponse(
        container,
        'right',
        paramsMain.choices[1],
        info.animateBtnRight && isMainTrial,
        info.enableBtnRight && isMainTrial,
      );
    }
    if (info.showImgOverlay) {
      createImageOverlay(container);
    }
    if (info.showTextBanner && isMainTrial) {
      elTextBanner = createTextBanner(container);
    }
    callbackReflowLayout = startReflowLayout(fitTextAll);
  };

  const removeLayout = () => {
    if (timeoutDivOverlayFade !== null) {
      window.clearTimeout(timeoutDivOverlayFade);
      timeoutDivOverlayFade = null;
    }
    stopReflowLayout(callbackReflowLayout);

    const container = jsPsych.getDisplayElement();
    container?.classList.remove('roav-container-viewport-fixed');
    divOverlayFade?.remove();
    divOverlayFade = null;
    elTextBanner?.remove();
    elTextBanner = null;
    imgOverlay?.remove();
    imgOverlay = null;
    imgUnder?.remove();
    imgUnder = null;
    btnLeft?.remove();
    btnLeft = null;
    btnRight?.remove();
    btnRight = null;
  };

  const questPreTrial = () => {
    if (info.stageAssessment === AssessmentStage.TEST) {
      quest.clearAlerts();
      if (paramsMain._subtype_trial === SubtypeTrial.QUEST) {
        if (!quest.isQuestTrialFirst) {
          const intensityNew = quest.quantile();
          let coherenceNew = 10 ** intensityNew / 100.0;
          if (coherenceNew > 1) {
            quest.addAlert(`rdk: coherence ${coherenceNew}`);
            coherenceNew = 1;
          } else if (coherenceNew < 0) {
            quest.addAlert(`rdk: coherence ${coherenceNew}`);
            coherenceNew = 0;
          }
          paramsMain.coherence = coherenceNew;
        } else {
          quest.isQuestTrialFirst = false;
        }
      }
    }
  };

  const questPostTrial = (correct) => {
    if (helperOrient?.rotationDetected()) {
      return;
    }
    if (info.stageAssessment === AssessmentStage.TEST) {
      const coherence = paramsMain.coherence * 100.0;
      const intensity = Math.log10(coherence);
      quest.update(intensity, correct ? 1 : 0);
    }
  };

  /*
  const trialAudio = () => ({
    timeline: [
      {
        type: jsPsychCallFunction,
        async: true,
        func: (done) => {
          helperAudioCustom = createHelperAudioCustom(
            mediaAssets.audio[info.keyAudio],
          );
          helperAudioCustom.prepareAudioCustom().finally(() => done());
        },
      },
      wrapAsJsPsychTrial(() => helperAudioCustom.startAudioCustom()),
    ],
  });
  */

  const orientSetupOnLoadDef = (keyTrialEnd) => {
    const onOrientChange = () => {
      helperAudioCustom?.abortAudioCustomAndPlugin();
      removeLayout();
      jsPsych.pluginAPI.pressKey(keyTrialEnd);
    };
    helperOrient = createHelperOrientation(onOrientChange);
    helperOrient.startEventListeners();
  };

  const trialPrepareAll = () => ({
    type: jsPsychCallFunction,
    func: () => {
      prepareParams();
      helperAudioCustom.setAssetAudio(mediaAssets.audio[info.keyAudio]);
    },
  });

  const trialFixation = () => {
    const drawFixation = () => {
      const canvas = document.getElementById('id-canvas-fix');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = sessionGet(SK.WIDTH_WINDOW_FS);
      canvas.height = sessionGet(SK.HEIGHT_WINDOW_FS);

      const clrBg = paramsMain.border ? paramsMain.border_color : paramsMain.background_color;
      ctx.fillStyle = clrBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const xCenter = paramsMain.aperture_center_x;
      const yCenter = paramsMain.aperture_center_y;

      if (paramsMain.border) {
        ctx.fillStyle = paramsMain.background_color;
        ctx.beginPath();
        ctx.arc(xCenter, yCenter, paramsMain.aperture_width / 2, 0, 2 * Math.PI);
        ctx.fill();
      }

      const size = paramsMain.fixation_cross_width;
      const thickness = paramsMain.fixation_cross_thickness;

      ctx.strokeStyle = paramsMain._fixation_cross_color;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(xCenter - size / 2, yCenter);
      ctx.lineTo(xCenter + size / 2, yCenter);
      ctx.moveTo(xCenter, yCenter - size / 2);
      ctx.lineTo(xCenter, yCenter + size / 2);
      ctx.stroke();
    };

    return {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: () => '<canvas id="id-canvas-fix"></canvas>',
      choices: [TypeKey.DUMMY],
      trial_duration: () => paramsMain._fixation_duration_pre,
      on_load: () => {
        orientSetupOnLoadDef(TypeKey.DUMMY);

        createLayout(false);
        drawFixation();

        if (btnLeft) btnLeft.disabled = true;
        if (btnRight) btnRight.disabled = true;
      },
      on_finish: () => {
        helperOrient.removeEventListeners();
        removeLayout();
      },
    };
  };

  const trialMain = () => ({
    type: jsPsychRdk,
    ...paramsDummy,
    trial_duration: () => {},
    on_start: (trial) => {
      questPreTrial();

      Object.assign(trial, paramsMain);
      // eslint-disable-next-line no-param-reassign
      trial.post_trial_gap = 0;
      // eslint-disable-next-line no-param-reassign
      trial.trial_duration = Math.max(helperAudioCustom?.durationAudio() ?? 0, paramsMain.trial_duration);
    },
    on_load: () => {
      if (helperOrient?.rotationDetected()) {
        // record to database in case of rotation
        jsPsych.pluginAPI.pressKey(paramsMain.choices[0]);
        return;
      }
      orientSetupOnLoadDef(paramsMain.choices[0]);
      createLayout(true);
      resetModeInputLast();
      helperMouseMoveRecord.startRecord();

      if (info.animateFade) {
        const timeStartAnimateFade = paramsMain.trial_duration - info.durationAnimateFade;
        if (timeStartAnimateFade > 0) {
          if (timeoutDivOverlayFade !== null) {
            window.clearTimeout(timeoutDivOverlayFade);
            timeoutDivOverlayFade = null;
          }
          divOverlayFade?.remove();
          divOverlayFade = null;
          timeoutDivOverlayFade = window.setTimeout(() => {
            const container = jsPsych.getDisplayElement();
            createDivOverlayFade(container);
          }, timeStartAnimateFade);
        }
      }
    },
    on_finish: (data) => {
      const rotationDetected = helperOrient?.rotationDetected();
      helperOrient.removeEventListeners();
      helperAudioCustom?.stopAndClearAudioCustom();

      responded = true;
      const timeOut = (data.response === '' || data.rt === -1) && !rotationDetected;
      const correct = data.correct && !timeOut && !rotationDetected;
      /* eslint-disable no-param-reassign */
      data.correct = correct;
      if (rotationDetected) {
        data.rt = -1;
        data.response = '';
      }
      /* eslint-enable no-param-reassign */

      helperMouseMoveRecord?.stopRecord();

      const responseRdk = {
        response: data.response,
        correct: correct,
        rt: data.rt,
        timeOut: timeOut, // important to keep track of whether it timed out
        rotationDetected: rotationDetected,
      };
      sessionSet(SK.RDK_RESPONSE_LAST, responseRdk);
      sessionSet(SK.DATA_CORRECT, data.correct);

      if (!inputFromBtn && !timeOut && !rotationDetected) {
        updateModeInputInfoOnKeyEvent();
      }

      const quest_updated = true;
      const quest_int_sd = quest ? quest.sd() : 0;
      const quest_int_quantile = quest ? quest.quantile() : 0;
      const quest_int_mean = quest ? quest.mean() : 0;

      if (summary && typeof summary.addInfo === 'function') {
        const infoSummary = {
          ...responseRdk,
          type_trial: 'rdk',
          id_trial: info.idTrial,
          subtype_trial: paramsMain._subtype_trial,
          coherent_direction: data.coherent_direction,
          mode_input: sessionGet(SK.MODE_INPUT_LAST),
          mode_game: sessionGet(SK.MODE_GAME),
          frame_rate: data.frame_rate,
          data: {
            coherence: data.coherence,
          },
          quest: {
            int_quantile: quest_int_quantile,
            int_mean: quest_int_mean,
            int_sd: quest_int_sd,
            val_sample: data.coherence,
            val_mean: 10 ** quest_int_mean / 100.0,
            val_quantile: 10 ** quest_int_quantile / 100.0,
            val_low: 10 ** (quest_int_mean - quest_int_sd) / 100.0,
            val_high: 10 ** (quest_int_mean + quest_int_sd) / 100.0,
            updated: quest_updated,
          },
        };
        summary.addInfo(infoSummary);
      }

      questPostTrial(correct);

      const validityEvaluator = getValidityEvaluator();
      if (validityEvaluator) {
        const rtEvaluator = data.rt > 0 ? data.rt : paramsMain.trial_duration;
        if (info.evaluateValidity) {
          validityEvaluator.addResponseData(rtEvaluator, data.response ?? '', correct ? 1 : 0);
        }
      }
      // eslint-disable-next-line no-param-reassign
      data.frame_rate_array = [];

      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        correct: correct,
        mode_game: sessionGet(SK.MODE_GAME),
        assessment_stage: `${info.stageAssessment}_response`,
        type_trial: 'rdk',
        id_trial: info.idTrial,
        ind_trial: info.indTrial,
        name_corpus: info.nameCorpus,
        name_block: info.nameBlock,
        pid: sessionGet(SK.CONFIG).pid,
        time_out: timeOut,
        rotation_detected: rotationDetected,
        coherence: paramsMain.coherence,
        subtype_trial: paramsMain._subtype_trial,
        mode_input: sessionGet(SK.MODE_INPUT_LAST),
        mode_input_target: sessionGet(SK.MODE_INPUT_TARGET),
        times_pointer_move: helperMouseMoveRecord?.timesPointerMove(),
        time_pointer_move_first: helperMouseMoveRecord?.timePointerMoveFirst(),
        time_pointer_move_last: helperMouseMoveRecord?.timePointerMoveLast(),
        rdk_info_trial: info,
        rdk_params: paramsMain,
        quest_updated: quest_updated,
        quest_int_quantile: quest_int_quantile,
        quest_int_mean: quest_int_mean,
        quest_int_sd: quest_int_sd,
        quest_alerts: quest ? quest.getAlerts() : '',
        quest_val_sample: data.coherence,
        quest_val_mean: 10 ** quest_int_mean / 100.0,
        quest_val_quantile: 10 ** quest_int_quantile / 100.0,
        quest_val_low: 10 ** (quest_int_mean - quest_int_sd) / 100.0,
        quest_val_high: 10 ** (quest_int_mean + quest_int_sd) / 100.0,
      });

      const indTrial = sessionGet(SK.IND_TRIAL);
      sessionSet(SK.IND_TRIAL, indTrial + 1);

      removeLayout();
    },
  });

  const trialGapAndFeedback = () => ({
    type: jsPsychAudioKeyboardResponse,
    stimulus: () => {
      if (info.playFeedbackTone) {
        const dataCorrect = sessionGet(SK.DATA_CORRECT);
        return dataCorrect
          ? mediaAssets.audio[info.keyFeedbackToneCorrect]
          : mediaAssets.audio[info.keyFeedbackToneIncorrect];
      }
      return mediaAssets.audio.roavMpNullAudioAll;
    },
    choices: [TypeKey.DUMMY],
    trial_duration: () =>
      info.playFeedbackTone ? Math.max(DURATIONS.FEEDBACK_MAX, paramsMain.post_trial_gap) : paramsMain.post_trial_gap,
    response_allowed_while_playing: false,
    trial_ends_after_audio: false,
    on_start: (/* trial */) => {
      // helperAudioCustom?.stopAudio();  // @check
      if (paramsMain.post_trial_gap > 0) {
        const modeGame = sessionGet(SK.MODE_GAME);
        const container = jsPsych.getDisplayElement();
        container.classList.add('roav-mp-rdk-container-trial-gap');
        if (paramsMain.border && info.gapColorSameAsBorder) {
          container.classList.add(`border-${modeGame}`);
        }
      }
    },
    on_load: () => {
      orientSetupOnLoadDef(TypeKey.DUMMY);
      createLayout(false);
      if (btnLeft) btnLeft.disabled = true;
      if (btnRight) btnRight.disabled = true;
    },
    on_finish: () => {
      helperOrient.removeEventListeners();
      removeLayout();
      if (paramsMain.post_trial_gap > 0) {
        const container = jsPsych.getDisplayElement();
        container.classList.remove('roav-mp-rdk-container-trial-gap', 'border-game', 'border-stand');
      }
    },
  });

  return {
    timeline: [
      t_trialEnterFullscreenConditional(),
      t_enterLandscape(),
      trialPrepareAll(),
      {
        timeline: [helperAudioCustom.t_startAudioCustom()],
        conditional_function: () => info.playAudio && !helperOrient?.rotationDetected(),
      },
      {
        timeline: [trialFixation()],
        conditional_function: () => metaparams._fixation_duration_pre > 0 && !helperOrient?.rotationDetected(),
      },
      t_trialEnterFullscreenConditional(),
      trialMain(),
      t_trialEnterFullscreenConditional(),
      t_enterLandscape(),
      {
        timeline: [trialGapAndFeedback()],
        conditional_function: () =>
          (metaparams.post_trial_gap > 0 || info.playFeedbackTone) && !helperOrient?.rotationDetected(),
      },
    ],
    on_timeline_start: () => {
      const infoBlock = sessionGet(SK.RDK_INFO_BLOCK);
      const metaparamsBlock = sessionGet(SK.RDK_METAPARAMS_BLOCK);

      info = {
        ...fillTextKeyValuesDef(infoDef(tagReq)),
        ...fillTextKeyValuesDef(infoBlock),
        ...fillTextKeyValuesDef(paramsTrialIn.info),
      };
      const indTrial = sessionGet(SK.IND_TRIAL);
      info.indTrial ??= indTrial;
      info.idTrial ??= `${info.nameBlock}-trial-${indTrial}`;

      const dotlifeConfigMs = sessionGet(SK.CONFIG).dotlife;
      const metaparamsConfig = {
        _dot_life: dotlifeConfigMs,
        _dot_life_unit: 'ms',
      };

      metaparams = {
        ...metaparamsDef,
        ...metaparamsConfig,
        ...metaparamsBlock,
        ...paramsTrialIn.metaparams,
      };
    },
    on_timeline_end: () => {},
    conditional_function: () => {
      const modeGameTrial = paramsTrialIn?.info?.modeGameTrial ?? ModeGame.ALL;
      return enableTrialByModeGame(modeGameTrial);
    },
  };
};
