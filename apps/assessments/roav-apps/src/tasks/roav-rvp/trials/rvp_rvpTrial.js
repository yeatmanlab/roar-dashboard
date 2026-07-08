/* eslint-disable no-underscore-dangle */
import jsPsychAudioKeyboardResponse from '@jspsych/plugin-audio-keyboard-response';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { jsPsych } from '../../shared/helpers/taskSetup';
import { mediaAssets } from '../../shared/helpers/mediaAssets';
import {
  AssessmentStage,
  fillTextKeyValuesDef,
  ModeGame,
  TypeKey,
  TAG_REQ_DEF,
  ModeAdaptStim,
} from '../../shared/helpers/namingHelpers';
import { getValidityEvaluator } from '../../shared/trials/validityHelpers';
import {
  updateModeInputInfoOnPointerEvent,
  createHelperMouseMoveRecord,
  resetModeInputLast,
} from '../../shared/trials/inputModeHelpers';
import {
  t_enterLandscape,
  createHelperOrientation,
  t_trialEnterFullscreenConditional,
  createHelperFullscreenConditional,
} from '../../shared/trials/screenHelpers';
import { sessionChangeValNum, sessionGet, sessionSet } from '../../shared/helpers/sessionHelpers';
import { RVP_SESSION_KEYS as SK } from '../helpers/rvp_sessionKeys';
import { createSvgCross, createSvgLineHor, htmlImgSvgPositioned, svgStrToSrc } from '../../shared/trials/svgHelpers';
import { hasAudio } from '../../shared/helpers/audioHelpers';
import { enableTrialByModeGame } from '../../shared/trials/flowHelpers';
import { DURATIONS } from '../../shared/helpers/constants';
import { UnitSize, degToPxFromWidth } from '../../shared/helpers/unitsHelper';
import { indsRandomNoRepeat } from '../../shared/helpers/orderHelpers';
import {
  calcDataCat,
  getTransf,
  getParamsItem,
  TYPE_CAT_COMB,
  updateAbilityEstimate,
  updateAbilityEstimateComb,
} from './rvp_catHelpers';
import { RVP } from '../helpers/rvp_constants';

export const SubtypeTrialRvp = {
  REG: 'reg',
  EXTRA: 'extra',
};

const tagTrial = 'rvp';

export const TypeStimRvp = {
  OPTO: 'opto',
  PSEUDO: 'pseudo',
};

export const ModeSelStim = {
  RANDOM: 'random',
  FIXED: 'fixed',
  NAME: 'name',
};

const StageTrial = {
  MARK_FIX: 'mark-fix',
  STIM: 'stim',
  MARK_TARG: 'mark-targ',
  RESP: 'resp',
  GAP_AND_FEEDBACK: 'gapAndFeedback',
};

// in % of width
const WIDTH_RESP_TOTAL_MAX = 0.75;
const WIDTH_GAP_BTN_RESP = 0.012;

// in % of height
const HEIGHT_BTN_RESP_BOTTOM = 0.2;

// in % of the button size
const SIZE_IMG_BTN = 0.6;

const metaparamsRvpDef = {
  enabled: true,
  adaptive: false,
  subtypeTrial: SubtypeTrialRvp.REG,
  typeStim: TypeStimRvp.OPTO,
  modeSelStim: ModeSelStim.RANDOM,
  modeAdaptStim: ModeAdaptStim.NONE,
  numStim: 4,
  indsStim: null, // within array of stim in the mapStim
  namesStim: null,
  srcsStim: null,
  srcMarkFix: null, // filled in from params
  srcMarkTarg: null, // filled in from params
  posTarg: 0, // within array of indsStim / namesStim / srcsStim

  clrBg: '#ffffff',
  durationMarkFix: 600,
  durationStim: 350, // 480, // 240, // 120000,    // 240,
  durationMarkTarg: 200, // this is delay after showing target when response is disabled
  durationGap: 1200,
  durationResp: RVP.DURATION_RESP_TEST_MAX,
  durationWarnTimeout: 3000,

  vdCm: 100, // 50
  widthScreenCm: 30, // 30 cm is ~ 13.6 in; chromebooks are 11.6 or 13.3 in (?)
  widthScreenPx: undefined, // important: keep undefined, important for correct composing // 1920

  _distStim: 0.58,
  _unitDistStim: UnitSize.DEG,
  distStim: undefined,

  _sizeMarkFix: 0.45,
  _widthStrokeMarkFix: 0.072,
  _unitSizeMarkFix: UnitSize.DEG, // applies to all distance measurements for fixation
  sizeMarkFix: undefined,
  widthStrokeMarkFix: undefined,

  _sizeStim: 0.5,
  _unitSizeStim: UnitSize.DEG,
  sizeStim: undefined,

  _lengthMarkTarg: 0.5,
  _widthStrokeMarkTarg: 0.07,
  _distMarkTargStim: 0.2,
  _unitSizeMarkTarg: UnitSize.DEG,
  clrMarkTarg: 'rgba(30, 49, 255, 0.66)',
  lengthMarkTarg: undefined,
  widthStrokeMarkTarg: undefined,
  distMarkTargStim: undefined,
};

const prepareStim = (params) => {
  const mapsStim = sessionGet(SK.MAPS_STIM);
  const mapStim = mapsStim[params.typeStim];
  const namesStimAll = mapStim.map((s) => s.name);
  const srcsStimAll = mapStim.map((s) => s.src);
  /* eslint-disable no-param-reassign */

  if (params.modeSelStim === ModeSelStim.RANDOM) {
    params.indsStim = indsRandomNoRepeat(params.numStim, mapStim.length);
  }
  if (params.modeSelStim === ModeSelStim.NAME) {
    params.indsStim = params.namesStim.map((name) => namesStimAll.indexOf(name));
  }

  if (params.indsStim) {
    params.namesStim = params.indsStim.map((i) => namesStimAll[i]);
    params.srcsStim = params.indsStim.map((i) => srcsStimAll[i]);
  }
  /* eslint-enable no-param-reassign */
};

const metaparamsToParams = (metaparams) => {
  const params = { ...metaparams };

  switch (params._unitDistStim) {
    case UnitSize.PX:
      params.distStim = params._distStim;
      break;
    case UnitSize.DEG:
      params.distStim = degToPxFromWidth(
        params._distStim,
        params.vdCm,
        params.widthScreenCm,
        params.widthScreenPx,
      );
      break;
    default:
      params.distStim = undefined;
  }

  switch (params._unitSizeStim) {
    case UnitSize.PX:
      params.sizeStim = params._sizeStim;
      break;
    case UnitSize.DEG:
      params.sizeStim = degToPxFromWidth(
        params._sizeStim,
        params.vdCm,
        params.widthScreenCm,
        params.widthScreenPx,
      );
      break;
    default:
      params.sizeStim = undefined;
  }

  switch (params._unitSizeMarkFix) {
    case UnitSize.PX:
      params.sizeMarkFix = params._sizeMarkFix;
      params.widthStrokeMarkFix = params._widthStrokeMarkFix;
      break;
    case UnitSize.DEG:
      params.sizeMarkFix = degToPxFromWidth(
        params._sizeMarkFix,
        params.vdCm,
        params.widthScreenCm,
        params.widthScreenPx,
      );
      params.widthStrokeMarkFix = degToPxFromWidth(
        params._widthStrokeMarkFix,
        params.vdCm,
        params.widthScreenCm,
        params.widthScreenPx,
      );
      break;
    default:
      params.sizeMarkFix = undefined;
      params.widthStrokeMarkFix = undefined;
  }

  switch (params._unitSizeMarkTarg) {
    case UnitSize.PX:
      params.lengthMarkTarg = params._lengthMarkTarg;
      params.widthStrokeMarkTarg = params._widthStrokeMarkTarg;
      params.distMarkTargStim = params._distMarkTargStim;
      break;
    case UnitSize.DEG:
      params.lengthMarkTarg = degToPxFromWidth(
        params._lengthMarkTarg,
        params.vdCm,
        params.widthScreenCm,
        params.widthScreenPx,
      );
      params.widthStrokeMarkTarg = degToPxFromWidth(
        params._widthStrokeMarkTarg,
        params.vdCm,
        params.widthScreenCm,
        params.widthScreenPx,
      );
      params.distMarkTargStim = degToPxFromWidth(
        params._distMarkTargStim,
        params.vdCm,
        params.widthScreenCm,
        params.widthScreenPx,
      );
      break;
    default:
      params.lengthMarkTarg = undefined;
      params.widthStrokeMarkTarg = undefined;
      params.distMarkTargStim = undefined;
  }

  return params;
};

const indStimToEcc = (indStim, numStim, distStim) => {
  const cntHalf = numStim / 2;
  return indStim < cntHalf ? (indStim - cntHalf) * distStim : (indStim - cntHalf + 1) * distStim;
};

const htmlStimsMarks = (params, info, stageTrial) => {
  const showStim = info.flagShowStim || stageTrial === StageTrial.STIM;
  const showMarkTarg = info.flagShowMarkTarg || stageTrial === StageTrial.MARK_TARG || stageTrial === StageTrial.RESP;
  const showMarkFix = info.flagShowMarkFix !== false; // (info.flagShowMarkFix === false) ? false : (stageTrial !== StageTrial.GAP_AND_FEEDBACK);

  const classMarkFix =
    info.animateMarkFix && (stageTrial === StageTrial.MARK_FIX || info.flagShowMarkFix)
      ? 'roav-rvp-animation-mark-fix'
      : '';

  let classStimNotTarg = '';
  let classStimTarg = '';
  if (showStim) {
    classStimTarg = info.animateStimTarg ? 'roav-rvp-animation-stim-targ' : '';
    if (info.muteStim) {
      classStimTarg += ' roav-muted-20';
      classStimNotTarg += ' roav-muted-20';
    }
  }

  const classMarkTarg =
    info.animateMarkTarg && (stageTrial === StageTrial.MARK_TARG || info.flagShowMarkTarg)
      ? 'roav-rvp-animation-mark-targ'
      : '';

  let cntStim = 0;
  let html = ``;

  html += htmlImgSvgPositioned(
    showMarkFix,
    params.srcMarkFix,
    params.sizeMarkFix,
    params.sizeMarkFix,
    0,
    0,
    0,
    classMarkFix,
  );

  for (let iStim = 0; iStim < params.numStim; iStim += 1) {
    const classStim = cntStim === params.posTarg ? classStimTarg : classStimNotTarg;
    html += htmlImgSvgPositioned(
      showStim,
      params.srcsStim[iStim],
      params.sizeStim,
      params.sizeStim,
      indStimToEcc(iStim, params.numStim, params.distStim),
      0,
      0,
      classStim,
    );
    cntStim += 1;
  }

  html += htmlImgSvgPositioned(
    showMarkTarg,
    params.srcMarkTarg,
    params.lengthMarkTarg,
    params.widthStrokeMarkTarg,
    indStimToEcc(params.posTarg, params.numStim, params.distStim),
    params.distMarkTargStim + params.sizeStim / 2,
    0,
    classMarkTarg,
  );

  return `
    <div style="position: absolute; inset: 0; margin: 0;">
      ${html}
    </div>  `;
};

const htmlBtnsResp = (params, info, stageTrial) => {
  const mapsStim = sessionGet(SK.MAPS_STIM);
  const numStimMax = Math.max(...Object.values(mapsStim).map((arr) => arr.length));

  const widthScreen = sessionGet(SK.WIDTH_WINDOW_FS);
  const heightScreen = sessionGet(SK.HEIGHT_WINDOW_FS);

  const gap = WIDTH_GAP_BTN_RESP * widthScreen;
  const widthRespTotalMax = WIDTH_RESP_TOTAL_MAX * widthScreen;
  const sizeBtn = (widthRespTotalMax - (numStimMax - 1) * gap) / numStimMax;

  const mapStim = mapsStim[params.typeStim];
  const srcsStim = mapStim.map((s) => s.src);
  const numStim = srcsStim.length;
  const widthRespTotal = sizeBtn * numStim + gap * (numStim - 1);

  const showResp = info.flagShowResp || stageTrial === StageTrial.RESP;
  const classBtnNotTarg = '';
  const classBtnTarg = info.animateBtnResp ? 'roav-rvp-animation-button-resp' : '';
  const classImgNotTarg = '';
  const classImgTarg = '';

  let html = ``;
  for (let iStim = 0; iStim < numStim; iStim += 1) {
    const indStimTarg = params.indsStim[params.posTarg];
    const classBtn = iStim === indStimTarg ? classBtnTarg : classBtnNotTarg;
    const classImg = iStim === indStimTarg ? classImgTarg : classImgNotTarg;

    html += `
      <button
        type="button"
        class="roav-rvp-btn-resp ${classBtn}"
        id="resp-${iStim}"
        style="
          visibility: ${showResp ? 'visible' : 'hidden'};
          width: ${sizeBtn}px;
          height: ${sizeBtn}px;
        ">
        <img
          src="${srcsStim[iStim]}"
          class="roav-rvp-img-btn-resp ${classImg}"
          width=${sizeBtn * SIZE_IMG_BTN}
          height=${sizeBtn * SIZE_IMG_BTN}
        />
      </button>
    `;
  }
  return `
    <div
      class = "roav-rvp-btns-resp-wrap"
      style="
        left: ${(widthScreen - widthRespTotal) / 2}px;
        bottom: ${heightScreen * HEIGHT_BTN_RESP_BOTTOM}px;
        width: ${widthRespTotal}px;
        gap: ${gap}px;
      ">
      ${html}
    </div>
  `;
};

const htmlCardStimResp = () => {
  const paddingHor = 0.03;
  const paddingVert = 0.05;
  const widthScreen = sessionGet(SK.WIDTH_WINDOW_FS);
  const heightScreen = sessionGet(SK.HEIGHT_WINDOW_FS);
  const widthBox = (WIDTH_RESP_TOTAL_MAX + 2 * paddingHor) * widthScreen;
  const heightBox = (1 - 2 * HEIGHT_BTN_RESP_BOTTOM + 2 * paddingVert) * heightScreen;
  const leftBox = (widthScreen - widthBox) / 2;
  const topBox = (heightScreen - heightBox) / 2;

  return `
    <div class="roav-rvp-card-stim-resp"
      style="
        left: ${leftBox}px; 
        top: ${topBox}px;
        width: ${widthBox}px;
        height: ${heightBox}px">
    </div>`;
};

const htmlLog = (showLog) => {
  if (!showLog) {
    return '';
  }
  return `
    <div id="id-log" style="
      position: fixed; top: 0; right: 0;
      width: 220px; height: 100%;
      z-index: 1000; 
      white-space: pre-wrap;
      overflow-y: auto;
      text-align: left;
      border: 2px solid #000000;
      background-color: #edf8fd;
    ">
    </div>`;
};

const isValidTestTrial = (params, info) => {
  const isValid = info.stageAssessment === AssessmentStage.TEST && params.subtypeTrial !== SubtypeTrialRvp.EXTRA;
  return isValid;
};

const calcIndTrialTestAbs = (params, info, includeExtra = true) => {
  const isTest = info.stageAssessment === AssessmentStage.TEST;
  if (!isTest) {
    return -1;
  }
  const isExtra = params.subtypeTrial === SubtypeTrialRvp.EXTRA;

  const indBlock = sessionGet(SK.IND_BLOCK);
  const indTrial = sessionGet(SK.IND_TRIAL);
  const configBlock = sessionGet(SK.CONFIG_BLOCK);
  const numTrialExtra = includeExtra ? configBlock.numTrialExtra : 0;
  const indTrialAbs =
    indBlock * (configBlock.numTrialBlock + numTrialExtra) + indTrial + (!isExtra ? numTrialExtra : 0);
  return indTrialAbs;
};

const calcNumTrialTestTotal = (includeExtra = true) => {
  const configBlock = sessionGet(SK.CONFIG_BLOCK);
  const numTrialExtra = includeExtra ? configBlock.numTrialExtra : 0;
  const numTrialTotalAbs = (configBlock.numTrialBlock + numTrialExtra) * configBlock.arrMetaparams.length;
  return numTrialTotalAbs;
};

const htmlProgressBar = (params, info) => {
  if (!info.showProgressBar) {
    return '';
  }
  if (info.stageAssessment !== AssessmentStage.TEST) {
    return '';
  }

  const indTrialTestAbs = calcIndTrialTestAbs(params, info);
  const numTrialTestTotal = calcNumTrialTestTotal(params, info);
  const percentComplete = (100 * Math.max(indTrialTestAbs, 0)) / numTrialTestTotal;

  return `
    <div class="roav-progress-bar-wrap">
      <div id="id-progress-bar"
        class="roav-progress-bar" 
        style="width:${percentComplete}%">      
      </div>
    </div>`;
};

const htmlLayout = (params, info, stageTrial) => {
  const htmlStimsMarksCur = htmlStimsMarks(params, info, stageTrial);
  const htmlBtnsRespCur = htmlBtnsResp(params, info, stageTrial);
  const htmlProgressBarCur = htmlProgressBar(params, info);
  const widthFS = sessionGet(SK.WIDTH_WINDOW_FS);
  const heightFS = sessionGet(SK.HEIGHT_WINDOW_FS);

  let htmlImgBg = '';
  let htmlCard = '';
  if (info.showImgBg) {
    htmlImgBg = `
        <img src="${mediaAssets.images[info.keyImgBg]}"
        class = "roav-rvp-img-bg" />`;
    htmlCard = htmlCardStimResp();
  }

  const html = `
      ${htmlLog(info.showLog)}
      <div>
        <div class="roav-rvp-img-bg-wrap"
          style="width:${widthFS}px; height:${heightFS}px">
          ${htmlImgBg}
        </div>
        ${htmlProgressBarCur}
        ${htmlCard}
        
        <div class="roav-rvp-stim-resp-wrap" id="id-stim-resp-wrap"
          style="width:${widthFS}px; height:${heightFS}px">

          <div class="roav-rvp-stim-wrap">
            ${htmlStimsMarksCur}
          </div>
          
          <div class="roav-rvp-resp-wrap">
            ${htmlBtnsRespCur}
          </div>

        </div>
      </div>`;
  return html;
};

export const infoRvpDef = (tagReq) => ({
  tagReq: tagReq,
  stageAssessment: AssessmentStage.NONE,
  nameCorpus: sessionGet(SK.NAME_CORPUS) ?? 'none',
  nameBlock: 'none',
  idTrial: undefined,

  evaluateValidity: true,

  showImgBg: false,
  keyImgBg: ['', '', 'bg'],

  // overrides default flow for instructions
  flagShowStim: undefined,
  flagShowMarkFix: undefined,
  flagShowMarkTarg: undefined,
  flagShowResp: undefined,

  includeTrialResp: true,

  animateStimTarg: false,
  animateMarkFix: false,
  animateMarkTarg: false,
  animateBtnResp: false,
  muteStim: false,
  disableBtnsRespNonTarg: false,

  keyFeedbackToneCorrect: ['feedback-tone', '', 'correct', ModeGame.ALL],
  keyFeedbackToneIncorrect: ['feedback-tone', '', 'incorrect', ModeGame.ALL],
  playFeedbackTone: true,

  keyAudioMarkFix: [tagTrial, tagReq, StageTrial.MARK_FIX],
  keyAudioStim: [tagTrial, tagReq, StageTrial.STIM],
  keyAudioMarkTarg: [tagTrial, tagReq, StageTrial.MARK_TARG],
  keyAudioResp: [tagTrial, tagReq, StageTrial.RESP],

  // right now the text is not displayed, potentially for STAND mode
  textMarkFix: [tagTrial, `${tagReq}.${StageTrial.MARK_FIX}`, 'text'],
  textStim: [tagTrial, `${tagReq}.${StageTrial.STIM}`, 'text'],
  textMarkTarg: [tagTrial, `${tagReq}.${StageTrial.MARK_TARG}`, 'text'],
  textResp: [tagTrial, `${tagReq}.${StageTrial.RESP}`, 'text'],

  playAudio: false,

  showLog: false,
  showProgressBar: true,

  showWarnTimeout: true,

  modeGameTrial: ModeGame.ALL,
});

export const t_rvp = (paramsTrialIn = {}, tagReq = TAG_REQ_DEF) => {
  let metaparams = null;

  let info = null;
  let params = null;

  let indStimResp = -1;
  let indStimTarg = -1;

  let timeRespStart = -1;
  let timeRespEnd = -1;

  let helperOrient = null;
  let helperFullscreenConditional = null;
  const helperMouseMoveRecord = createHelperMouseMoveRecord();

  let timeoutWarnTimeout = null;

  const prepareParams = () => {
    if (params) {
      return;
    }
    metaparams.widthScreenPx = sessionGet(SK.WIDTH_WINDOW_FS) ?? window.innerWidth;
    params = metaparamsToParams(metaparams);
    prepareStim(params);
    if (!params.srcMarkFix) {
      const strSvgMarkFix = createSvgCross(
        params.sizeStim,
        params.sizeStim,
        params.widthStrokeMarkFix,
        params.sizeMarkFix,
        params.sizeMarkFix,
      );
      params.srcMarkFix = svgStrToSrc(strSvgMarkFix);
    }
    if (!params.srcMarkTarg) {
      const strSvgMarkTarg = createSvgLineHor(
        params.lengthMarkTarg,
        params.widthStrokeMarkTarg,
        params.widthStrokeMarkTarg,
        params.lengthMarkTarg,
        params.clrMarkTarg,
      );
      params.srcMarkTarg = svgStrToSrc(strSvgMarkTarg);
    }
  };

  const screenSetupOnLoadDef = (keyTrialEnd, trackResize = false) => {
    const onScreenChange = () => {
      jsPsych.pluginAPI.pressKey(keyTrialEnd);
    };
    helperOrient = createHelperOrientation(onScreenChange);
    helperOrient.startEventListeners();

    if (trackResize) {
      helperFullscreenConditional = createHelperFullscreenConditional(onScreenChange);
      helperFullscreenConditional.startEventListeners();
    }
  };

  const trialPrepareAll = () => ({
    type: jsPsychCallFunction,
    func: () => {
      prepareParams();
      indStimTarg = params.indsStim[params.posTarg];
      timeRespStart = -1;
      timeRespEnd = -1;
    },
  });

  const catPostTrial = (correct) => {
    if (isValidTestTrial(params, info)) {
      updateAbilityEstimate(params.typeStim, params.numStim, params.posTarg, correct);
      updateAbilityEstimateComb(params.typeStim, params.numStim, params.posTarg, correct);

      const dataCat = {
        params_item_cur: getParamsItem(params.typeStim, params.numStim, params.posTarg),
        transf_cur: getTransf(params.typeStim),
        data_cat_cur: calcDataCat(params.typeStim),
        data_cat_comb: calcDataCat(TYPE_CAT_COMB),
      };
      return dataCat;
    }

    return {
      data_cat_cur: null,
      data_cat_comb: null,
    };
  };

  const writeLog = () => {
    const catDataOpto = calcDataCat(TypeStimRvp.OPTO);
    const catDataPseudo = calcDataCat(TypeStimRvp.PSEUDO);
    const catDataComb = calcDataCat(TYPE_CAT_COMB);

    let log = '';
    if (info.tagReq !== TAG_REQ_DEF) {
      log = `\n
        ${tagReq}\n
        ================\n
        MARK_FIX:\n
        ${info.textMarkFix}\n\n
        STIM:\n
        ${info.textStim}\n\n
        MARK_TARG:\n
        ${info.textMarkTarg}\n\n
        RESP:\n
        ${info.textResp}\n\n`;
    }

    log += `

      ======
      duration_stim: ${params.durationStim}

      name_corpus:${info.nameCorpus}
      name_block: ${info.nameBlock}
      id_trial:   ${info.idTrial}

      num_trial:  ${sessionGet(SK.NUM_TRIAL)}
      
      ind_trial:  ${sessionGet(SK.IND_TRIAL)}
      cnt_trial:  ${sessionGet(SK.CNT_TRIAL)}
      cnt_corr:   ${sessionGet(SK.CNT_CORR)}
     
      ind_trial_global: ${sessionGet(SK.IND_TRIAL_GLOBAL)}
      cnt_trial_global: ${sessionGet(SK.CNT_TRIAL_GLOBAL)} 
      cnt_corr_global: ${sessionGet(SK.CNT_CORR_GLOBAL)}
      enable_trials: ${sessionGet(SK.ENABLE_TRIALS)}
    `;

    log += `
      OPTO
      ${JSON.stringify(catDataOpto, null, 2)}\n
      PSEUDO
      ${JSON.stringify(catDataPseudo, null, 2)}\n
      COMB
      ${JSON.stringify(catDataComb, null, 2)}
      `;

    const elLog = document.getElementById('id-log');
    if (elLog) {
      elLog.innerText = log;
    }
  };

  const setWarnTimeout = () => {
    if (timeoutWarnTimeout !== null) {
      window.clearTimeout(timeoutWarnTimeout);
      timeoutWarnTimeout = null;
    }
    if (info.showWarnTimeout && !info.showImgBg) {
      const elStimRespWrap = document.getElementById('id-stim-resp-wrap');
      const timeStartWarnTimeout = params.durationResp - params.durationWarnTimeout;
      if (elStimRespWrap && timeStartWarnTimeout > 0) {
        timeoutWarnTimeout = window.setTimeout(() => {
          elStimRespWrap.classList.add('roav-rvp-warn-timeout');
        }, timeStartWarnTimeout);
      }
    }
  };

  const clearWarnTimeout = () => {
    if (timeoutWarnTimeout !== null) {
      window.clearTimeout(timeoutWarnTimeout);
      timeoutWarnTimeout = null;
    }
    const elStimRespWrap = document.getElementById('id-stim-resp-wrap');
    if (elStimRespWrap) {
      elStimRespWrap.classList.remove('roav-rvp-warn-timeout');
    }
  };

  // eslint-disable-next-line arrow-body-style
  const trialMarkFix = () => {
    return {
      type: jsPsychAudioMultiResponse,
      trial_duration: () => (hasAudio(info.keyAudioMarkFix) ? DURATIONS.WAIT_FOR_RESPONSE : params.durationMarkFix),
      stimulus: () => mediaAssets.audio[info.keyAudioMarkFix] ?? mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => htmlLayout(params, info, StageTrial.MARK_FIX),
      response_ends_trial: true,
      trial_ends_after_audio: () => hasAudio(info.keyAudioMarkFix),
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [''],
      button_html: () => '',
      on_load: () => {
        screenSetupOnLoadDef(TypeKey.DUMMY);
        if (info.showLog) {
          writeLog();
        }
      },
      on_finish: () => {
        helperOrient.removeEventListeners();
      },
    };
  };

  // eslint-disable-next-line arrow-body-style
  const trialStim = () => {
    return {
      type: jsPsychAudioMultiResponse,
      trial_duration: () => (hasAudio(info.keyAudioStim) ? DURATIONS.WAIT_FOR_RESPONSE : params.durationStim),
      stimulus: () => mediaAssets.audio[info.keyAudioStim] ?? mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => htmlLayout(params, info, StageTrial.STIM),
      response_ends_trial: true,
      trial_ends_after_audio: () => hasAudio(info.keyAudioStim),
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [''],
      button_html: () => '',
      on_load: () => {
        screenSetupOnLoadDef(TypeKey.DUMMY);
        if (info.showLog) {
          writeLog();
        }
      },
      on_finish: () => {
        helperOrient.removeEventListeners();
      },
    };
  };

  // eslint-disable-next-line arrow-body-style
  const trialMarkTarg = () => {
    return {
      type: jsPsychAudioMultiResponse,
      trial_duration: () => (hasAudio(info.keyAudioMarkTarg) ? DURATIONS.WAIT_FOR_RESPONSE : params.durationMarkTarg),
      stimulus: () => mediaAssets.audio[info.keyAudioMarkTarg] ?? mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => htmlLayout(params, info, StageTrial.MARK_TARG),
      response_ends_trial: true,
      trial_ends_after_audio: () => hasAudio(info.keyAudioMarkTarg),
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [''],
      button_html: () => '',
      on_load: () => {
        screenSetupOnLoadDef(TypeKey.DUMMY);
        if (info.showLog) {
          writeLog();
        }
      },
      on_finish: () => {
        helperOrient.removeEventListeners();
      },
    };
  };

  // eslint-disable-next-line arrow-body-style
  const trialResp = () => {
    return {
      type: jsPsychAudioMultiResponse,
      trial_duration: () => params.durationResp,
      /* 
        hasAudio(info.keyAudioResp)
          ? DURATIONS.WAIT_FOR_RESPONSE
          : params.durationResp,
      */
      stimulus: () => mediaAssets.audio[info.keyAudioResp] ?? mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => htmlLayout(params, info, StageTrial.RESP),
      response_ends_trial: true,
      trial_ends_after_audio: () => false,
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [''],
      button_html: () => '',
      on_load: () => {
        if (
          !info.includeTrialResp ||
          helperOrient?.rotationDetected() ||
          helperFullscreenConditional?.resizeDetected()
        ) {
          // record to database in case of rotation
          jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
          return;
        }
        timeRespStart = performance.now();
        const mapsStim = sessionGet(SK.MAPS_STIM);
        const mapStim = mapsStim[params.typeStim];
        const numStim = mapStim.length;
        for (let iStim = 0; iStim < numStim; iStim += 1) {
          if (!info.disableBtnsRespNonTarg || iStim === indStimTarg) {
            const btn = document.getElementById(`resp-${iStim}`);
            btn.addEventListener('pointerdown', (e) => {
              updateModeInputInfoOnPointerEvent(e.pointerType);
            });
            // eslint-disable-next-line no-loop-func
            btn.addEventListener('click', () => {
              if (indStimResp >= 0) {
                return;
              }
              timeRespEnd = performance.now();
              indStimResp = iStim;
              jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
            });
          }
        }
        screenSetupOnLoadDef(TypeKey.DUMMY, true);
        resetModeInputLast();
        helperMouseMoveRecord.startRecord();

        setWarnTimeout();

        if (info.showLog) {
          writeLog();
        }
      },
      on_finish: (data) => {
        clearWarnTimeout();
        const rotationDetected = helperOrient?.rotationDetected();
        const resizeDetected = helperFullscreenConditional?.resizeDetected();
        helperOrient?.removeEventListeners();
        helperFullscreenConditional?.removeEventListeners();
        const timeOut = indStimResp < 0 && !rotationDetected && !resizeDetected;
        let rt = timeRespStart > 0 && timeRespEnd > 0 ? timeRespEnd - timeRespStart : -1;
        if (rotationDetected || resizeDetected) {
          rt = -1;
        }

        const correct = indStimResp === indStimTarg && !timeOut && !rotationDetected && !resizeDetected;
        /* eslint-disable no-param-reassign */
        data.correct = correct;
        data.response = indStimResp;
        data.rt = rt;
        /* eslint-enable no-param-reassign */
        helperMouseMoveRecord.stopRecord();

        sessionSet(SK.DATA_CORRECT, data.correct);
        if (correct) {
          sessionChangeValNum(SK.CNT_CORR, 1);
          if (isValidTestTrial(params, info)) {
            sessionChangeValNum(SK.CNT_CORR_GLOBAL, 1);
          }
        }

        const validityEvaluator = getValidityEvaluator();
        if (validityEvaluator && info.evaluateValidity) {
          const rtEvaluator = data.rt;
          if (data.rt > 0) {
            validityEvaluator.addResponseData(rtEvaluator, data.response ?? '', correct ? 1 : 0);
          }
        }
        const dataCat = catPostTrial(correct);

        const paramsSave = { ...params }; // save space in db; params are saved as config
        paramsSave.srcMarkFix = '';
        paramsSave.srcMarkTarg = '';
        paramsSave.srcsStim = [];

        // note:
        //      ind_trial_abs includes extra trials
        //      ind_trial_global, cnt_corr_global do not

        jsPsych.data.addDataToLastTrial({
          save_trial: true,
          correct: correct,
          mode_game: sessionGet(SK.MODE_GAME),
          assessment_stage: `${info.stageAssessment}_response`,
          type_trial: tagTrial,
          subtype_trial: params.subtypeTrial,
          id_trial: info.idTrial,
          ind_trial_block: sessionGet(SK.IND_TRIAL),
          ind_trial_abs: calcIndTrialTestAbs(params, info),
          ind_trial_global: sessionGet(SK.IND_TRIAL_GLOBAL),
          ind_block: sessionGet(SK.IND_BLOCK),
          ind_block_adapt: sessionGet(SK.IND_BLOCK_ADAPT),
          num_trial_block: sessionGet(SK.NUM_TRIAL),
          name_corpus: info.nameCorpus,
          name_block: info.nameBlock,
          pid: sessionGet(SK.CONFIG).pid,
          type_stim: params.typeStim,
          time_out: timeOut,
          rotation_detected: rotationDetected,
          resize_detected: resizeDetected,
          cnt_corr_block: sessionGet(SK.CNT_CORR),
          cnt_corr_global: sessionGet(SK.CNT_CORR_GLOBAL),
          num_stim: params.indsStim.length,
          inds_stim: params.indsStim,
          pos_targ: params.posTarg,
          ind_stim_targ: indStimTarg,
          ind_stim_resp: indStimResp,
          mode_input: sessionGet(SK.MODE_INPUT_LAST),
          ...dataCat,
          times_pointer_move: helperMouseMoveRecord?.timesPointerMove(),
          time_pointer_move_first: helperMouseMoveRecord?.timePointerMoveFirst(),
          time_pointer_move_last: helperMouseMoveRecord?.timePointerMoveLast(),
          cnt_trial_block: sessionGet(SK.CNT_TRIAL),
          cnt_trial_global: sessionGet(SK.CNT_TRIAL_GLOBAL),
          info_trial: info,
          params_trial: paramsSave,
        });

        sessionChangeValNum(SK.IND_TRIAL, 1);
        sessionChangeValNum(SK.CNT_TRIAL, 1);

        if (isValidTestTrial(params, info)) {
          sessionChangeValNum(SK.IND_TRIAL_GLOBAL, 1);
          sessionChangeValNum(SK.CNT_TRIAL_GLOBAL, 1);
        }
      },
    };
  };

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
    prompt: () => htmlLayout(params, info, StageTrial.GAP_AND_FEEDBACK),
    keyboard_choices: () => [TypeKey.DUMMY],
    trial_duration: () =>
      info.playFeedbackTone ? Math.max(DURATIONS.FEEDBACK_MAX, params.durationGap) : params.durationGap,
    response_allowed_while_playing: false,
    trial_ends_after_audio: false,
    on_start: (/* trial */) => {
      const container = jsPsych.getDisplayElement();
      container.classList.add('roav-mp-rvp-container-trial-gap');
    },
    on_load: () => {
      screenSetupOnLoadDef(TypeKey.DUMMY);
    },
    on_finish: () => {
      helperOrient.removeEventListeners();
      const container = jsPsych.getDisplayElement();
      container.classList.remove('roav-mp-rvp-container-trial-gap');
    },
  });

  return {
    timeline: [
      t_trialEnterFullscreenConditional(),
      t_enterLandscape(),
      trialPrepareAll(),
      {
        timeline: [trialMarkFix()],
        conditional_function: () => params.durationMarkFix > 0 && !helperOrient?.rotationDetected(),
      },
      {
        timeline: [trialStim()],
        conditional_function: () => params.durationStim > 0 && !helperOrient?.rotationDetected(),
      },
      t_trialEnterFullscreenConditional(),
      t_enterLandscape(),
      {
        timeline: [trialMarkTarg()],
        conditional_function: () => params.durationMarkTarg > 0 && !helperOrient?.rotationDetected(),
      },
      t_trialEnterFullscreenConditional(),
      t_enterLandscape(),
      {
        timeline: [trialResp()],
        conditional_function: () => params.durationResp > 0, // = 0 for instructions only
      },
      t_trialEnterFullscreenConditional(),
      t_enterLandscape(),
      {
        timeline: [trialGapAndFeedback()],
        conditional_function: () =>
          (params.durationGap > 0 || info.playFeedbackTone) &&
          !helperOrient?.rotationDetected() &&
          !helperFullscreenConditional?.resizeDetected() &&
          info.includeTrialResp,
      },
    ],
    on_timeline_start: () => {
      const infoBlock = sessionGet(SK.RVP_INFO_BLOCK);
      const metaparamsBlock = sessionGet(SK.RVP_METAPARAMS_BLOCK);

      info = {
        ...fillTextKeyValuesDef(infoRvpDef(tagReq)),
        ...fillTextKeyValuesDef(infoBlock),
        ...fillTextKeyValuesDef(paramsTrialIn.info),
      };

      const indTrial = sessionGet(SK.IND_TRIAL);
      info.indTrial ??= indTrial;

      metaparams = {
        ...metaparamsRvpDef,
        ...metaparamsBlock,
        ...paramsTrialIn.metaparams,
      };

      if (metaparams.adaptive) {
        const arrMetaparamsTrialAdapt = sessionGet(SK.RVP_ARR_METAPARAMS_TRIAL);
        const metaparamsAdapt = arrMetaparamsTrialAdapt[indTrial];
        metaparams = { ...metaparams, ...metaparamsAdapt };
      }
      info.idTrial ??= `${info.nameBlock}-trial-${indTrial}`;
    },
    on_timeline_end: () => {},
    conditional_function: () => {
      const modeGameTrial = paramsTrialIn?.info?.modeGameTrial ?? ModeGame.ALL;
      return enableTrialByModeGame(modeGameTrial);
    },
  };
};
