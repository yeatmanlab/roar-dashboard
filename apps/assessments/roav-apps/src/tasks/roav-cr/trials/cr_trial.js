/* eslint-disable no-underscore-dangle */
import jsPsychAudioKeyboardResponse from "@jspsych/plugin-audio-keyboard-response";
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { summary } from "../../shared/trials/summaryHelpers";
import { jsPsych } from "../../shared/helpers/taskSetup";
import { quest } from "../../shared/trials/questHelpers";
import { mediaAssets } from "../../shared/helpers/mediaAssets";
import {
  AssessmentStage,
  fillTextKeyValuesDef,
  ModeGame,
  TypeKey,
  TAG_REQ_DEF,
} from "../../shared/helpers/namingHelpers";
import {
  sessionGet,
  sessionSet,
  sessionChangeValNum,
} from "../../shared/helpers/sessionHelpers";
import { CR_SESSION_KEYS as SK } from "../helpers/cr_sessionKeys";
import { htmlImgSvgPositioned } from "../../shared/trials/svgHelpers";
import { UnitSize, degToPxFromWidth } from "../../shared/helpers/unitsHelper";
import {
  elemRandom,
  elemRandomExcl,
  elemsRandom,
  indRandom,
  indRandomExcl,
  indsRandomNoRepeatExcl,
} from "../../shared/helpers/orderHelpers";
// import { shouldIgnoreOnError } from "@sentry/browser/types/helpers";
import { CR } from "../helpers/cr_constants";
import { DURATIONS, SCREEN } from "../../shared/helpers/constants";
import { enableTrialByModeGame } from "../../shared/trials/flowHelpers";
import {
  createHelperMouseMoveRecord,
  updateModeInputInfoOnPointerEvent,
  resetModeInputLast,
} from "../../shared/trials/inputModeHelpers";
import {
  createHelperOrientation,
  createHelperFullscreenConditional,
  // t_trialEnterFullscreenConditional,
  t_enterLandscape,
  t_trialEnterFullscreenConditional,
} from "../../shared/trials/screenHelpers";
import { getValidityEvaluator } from "../../shared/trials/validityHelpers";
import { hasAudio } from "../../shared/helpers/audioHelpers";
import {
  et_videoStart,
  t_et_videoRecordSave,
  t_et_videoRecordStart,
} from "../../et/et_videoHelpers";
import {
  et_etCreateLayout,
  et_etInit,
  et_etStart,
  et_etStop,
  et_etRemoveLayout,
  et_etCreateDecor,
  et_etRemoveDecor,
  et_TypeModel,
  et_def_onResultsFaceMesh,
} from "../../et/et_etHelpers";
import {
  et_paramsSnapsotDef,
  et_stateResetSnapshots,
  et_TypeSaveSnapshots,
  state,
  t_et_stateSave,
} from "../../et/et_state";

const tagTrial = "cr";

export const StageTrial = {
  FIX: "fix",
  STIM_PRE: "pre-stim",
  STIM: "stim",
  RESP: "resp",
  GAP_AND_FEEDBACK: "gap-and-feedback",
  PREVIEW: "preview",
};

// let timeOut
export const TypeTask = {
  SHAPE_IDENT: "shape-ident",
  SHAPE_COMPARE_REF: "shape-compare-ref",
  SHAPE_COMPARE_LR: "shape-compare-lr",

  ORIENT_COMPARE_REF: "orient-compare-ref",
  ORIENT_COMPARE_LR: "orient-compare-lr",
  ORIENT_IDENT: "orient-ident",
};

export const TypeSide = {
  LEFT: "left",
  RIGHT: "right",
  BOTH: "both",
  RANDOM: "random",
};

export const TypeSame = {
  SAME: "same",
  DIFF: "diff",
  RANDOM: "random",
};

export const TypeOrient = {
  DIR_4: "dir-4",
  DIR_2_HOR: "dir-2-hor",
  DIR_2_VERT: "dir-2-vert",
  DIR_2_ANGLE: "dir-2-angle",
};

const INDS_STIM = {
  NONE: -100,
  FLANK: -2,
  FIX: -1,
};

const INDS_LOC = {
  L: 0,
  R: 1,
  T: 2,
  B: 3,
  M: 4,
};

// TODO: temporary
export const mapTaskToInstrResp = {
  [TypeTask.SHAPE_IDENT]: "\nbuttons with matching shapes",
  [TypeTask.ORIENT_IDENT]: "buttons or keys\n△  ▽  ◁   ▷  matching direction",
  [TypeTask.ORIENT_COMPARE_REF]: "buttons or keys\n△  same     ▽  different",
  [TypeTask.SHAPE_COMPARE_REF]: "buttons or keys\n△  same     ▽  different",
  // [TypeTask.ORIENT_COMPARE_LR]: "buttons or keys\n▷  same     ◁  different",
  // [TypeTask.SHAPE_COMPARE_LR]: "buttons or keys\n▷  same     ◁  different",
  [TypeTask.ORIENT_COMPARE_LR]: "buttons or keys\n△  same     ▽  different",
  [TypeTask.SHAPE_COMPARE_LR]: "buttons or keys\n△  same     ▽  different",
};

export const metaparamsCrDef = {
  typeTask: TypeTask.SHAPE_IDENT,

  _sideTarg: TypeSide.RANDOM,
  sideTarg: undefined,
  _same: TypeSame.RANDOM,
  same: undefined,

  // typeOrient: TypeOrient.DIR,

  // TODO: all of numbers should come from CONFIG!
  // TODO: also - in defaults for CR as a fallback
  durationFix: 1000, // 600 in RVP
  durationGapStimRef: 250, // only for REF
  durationTargPre: 0, //  - (2 * 1000 / 30),     // TODO: in config, SOA, negative for flankers appearing before
  durationStim: 150, // 350 in RVP
  durationGap: 2000, // 1200 in RVP
  durationResp: CR.DURATION_RESP_TEST_MAX,
  durationRespWarnTimeout: CR.DURATION_RESP_WARN_TIMEOUT,

  ratio: 0.3, // TODO: should be coordinated with QUEST

  // TODO: copied from RVP
  _sizeMarkFix: 0.5, // TODO: potentially put into config
  _widthStrokeMarkFix: 0.05,
  _unitSizeMarkFix: UnitSize.DEG, // applies to all distance measurements for fixation
  sizeMarkFix: undefined,
  widthStrokeMarkFix: undefined,

  // TODO: should be in config
  sizeStim: undefined,
  _sizeStim: 0.75,
  _unitSizeStim: UnitSize.DEG,

  eccentTarg: undefined,
  _eccentTarg: 6,
  _unitEccentTarg: UnitSize.DEG,

  showFlankHor: true,
  showFlankVert: true,

  nameMarkFix: "cross",
  srcMarkFix: null,

  namesStim: null,
  srcsStim: null, // derived

  _sameFlank: false,
  _nameFlank: null,
  _srcFlank: null,

  // SHAPE
  indTarg: undefined,
  indsFlank: undefined,
  indTargRef: undefined,
  indTargL: undefined,
  indTargR: undefined,
  indsFlankL: undefined, // unlikely to be specified
  indsFlankR: undefined, // unlikely to be specified

  // ORIENT
  anglesTarg: undefined,
  anglesFlank: undefined,
  indFlank: undefined,
  rotTarg: undefined,
  rotsFlank: undefined, // unlikely to be specified
  rotTargRef: undefined,
  rotTargL: undefined,
  rotTargR: undefined,
  rotsFlankL: undefined, // unlikely to be specified
  rotsFlankR: undefined, // unlikely to be specified

  // DIST TARG FLANK
  ratioMax: undefined,
  ratioMin: undefined,
  distFlankMin: undefined, // in % of stimuli size

  vdCm: 50, // TODO: set to predefined constant if not specified
  widthScreenCm: null, // TODO: should be 30,  ALSO: should be a common constant for ROAV      // 30 cm is ~ 13.6 in; chromebooks are 11.6 or 13.3 in (?)
  widthScreenPx: null, // important: keep undefined, important for correct composing // 1920

  indC: undefined,
  rotC: undefined,
  indsL: undefined,
  indsR: undefined,
  rotsL: undefined,
  rotsR: undefined,

  btnsRespCompareHor: true,
};

export const infoCrDef = (tagReq) => ({
  tagReq: tagReq,
  stageAssessment: AssessmentStage.NONE,
  nameCorpus: sessionGet(SK.NAME_CORPUS) ?? "none",
  nameBlock: "none",
  idTrial: undefined,

  evaluateValidity: true,

  showImgBg: false,
  keyImgBg: ["", "", "bg"],

  includeTrialResp: true,

  animateMarkFix: false,
  animateStimTarg: false,
  animateStimRef: false,
  animateStimFlank: false,
  animateBtnResp: false,
  disableBtnsRespNonTarg: false,

  keyImgBtnSameVert: ["", "", "button-same-vert"],
  keyImgBtnDiffVert: ["", "", "button-diff-vert"],
  keyImgBtnSameHor: ["", "", "button-same-hor-arrows"], // button-same-hor-2
  keyImgBtnDiffHor: ["", "", "button-diff-hor-arrows"], // button-diff-hor-2

  keyFeedbackToneCorrect: ["feedback-tone", "", "correct", ModeGame.ALL],
  keyFeedbackToneIncorrect: ["feedback-tone", "", "incorrect", ModeGame.ALL],
  playFeedbackTone: true,

  keyAudioFix: [tagTrial, tagReq, StageTrial.FIX],
  keyAudioStim: [tagTrial, tagReq, StageTrial.STIM],
  keyAudioResp: [tagTrial, tagReq, StageTrial.RESP],

  playAudio: false,

  showLog: false,
  showProgressBar: true,

  showWarnTimeout: true,

  modeGameTrial: ModeGame.ALL,

  // EYE-TRACKING related
  showGaze: true, // TODO: should be false in production
  showEyes: false,
  paramsDecor: null, // will be merged with defaults by ET layout

  saveSnapshotsResp: false,
  recordVideoResp: true,
});

export const metaparamsToParams = (metaparams) => {
  const params = { ...metaparams };

  params.widthScreenPx = sessionGet(SK.WIDTH_WINDOW_FS) ?? window.innerWidth;

  if (!params.widthScreenCm) {
    const widthScreenCm = sessionGet(SK.WIDTH_SCREEN_CM);
    if (widthScreenCm) {
      params.widthScreenCm = widthScreenCm;
    } else {
      params.widthScreenCm = SCREEN.WIDTH_CM_DEF;
    }
  }

  if (params._same === TypeSame.RANDOM) {
    params.same = Math.random() < 0.5 ? TypeSame.SAME : TypeSame.DIFF;
  } else {
    params.same = params._same;
  }

  if (
    params.typeTask === TypeTask.ORIENT_COMPARE_LR ||
    params.typeTask === TypeTask.SHAPE_COMPARE_LR
  ) {
    params._sideTarg = TypeSide.BOTH;
    params.sideTarg = TypeSide.BOTH;
  } else {
    // eslint-disable-next-line no-lonely-if
    if (params._sideTarg === TypeSide.RANDOM) {
      params.sideTarg = Math.random() < 0.5 ? TypeSide.LEFT : TypeSide.RIGHT;
    } else {
      params.sideTarg = params._sideTarg;
    }
  }

  switch (params._unitEccentTarg) {
    case UnitSize.PX:
      params.eccentTarg = params._eccentTarg;
      break;
    case UnitSize.DEG:
      params.eccentTarg = degToPxFromWidth(
        params._eccentTarg,
        params.vdCm,
        params.widthScreenCm,
        params.widthScreenPx,
      );
      break;
    default:
      params.sizeStim = undefined;
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

  return params;
};

const srcStimByName = (nameStim) => {
  const mapStim = sessionGet(SK.MAP_STIM);
  const srcStim = mapStim.find((s) => s.name === nameStim)?.src;
  return srcStim;
};

/* eslint-disable no-param-reassign */
const prepareStimSrcs = (params) => {
  params.srcsStim = [];
  for (let iStim = 0; iStim < params.namesStim.length; iStim += 1) {
    params.srcsStim.push(srcStimByName(params.namesStim[iStim]));
  }
  params.srcMarkFix = srcStimByName(params.nameMarkFix);
  if (params._sameFlank === true) {
    params._srcFlank = srcStimByName(params._nameFlank);
  }
};
/* eslint-enable no-param-reassign */

/* eslint-disable no-param-reassign */
const indsFlankFilter = (indsFlank, showFlankHor, showFlankVert) => {
  if (!showFlankHor) {
    indsFlank[INDS_LOC.L] = INDS_STIM.NONE;
    indsFlank[INDS_LOC.R] = INDS_STIM.NONE;
  }
  if (!showFlankVert) {
    indsFlank[INDS_LOC.T] = INDS_STIM.NONE;
    indsFlank[INDS_LOC.B] = INDS_STIM.NONE;
  }
};

const indsCombine = (indTarg, indsFlank, indsLR) => {
  indsLR[INDS_LOC.M] = indTarg;
  for (let i = 0; i < 4; i += 1) {
    indsLR[i] = indsFlank[i];
  }
};

const rotsCombine = (rotTarg, rotsFlank, rotsLR) => {
  rotsLR[INDS_LOC.M] = rotTarg;
  for (let i = 0; i < 4; i += 1) {
    rotsLR[i] = rotsFlank[i];
  }
};
/* eslint-enable no-param-reassign */

const mapIndLocToOffset = () => {
  const offsets = [undefined, undefined, undefined, undefined, undefined];
  offsets[INDS_LOC.M] = [0, 0];
  offsets[INDS_LOC.L] = [-1, 0];
  offsets[INDS_LOC.R] = [1, 0];
  offsets[INDS_LOC.T] = [0, -1];
  offsets[INDS_LOC.B] = [0, 1];
  return offsets;
};

const mapIndLocToRot = () => {
  const rots = [undefined, undefined, undefined, undefined, undefined];
  rots[INDS_LOC.M] = undefined;
  rots[INDS_LOC.L] = 270;
  rots[INDS_LOC.R] = 90;
  rots[INDS_LOC.T] = 0;
  rots[INDS_LOC.B] = 180;
  return rots;
};

const mapIndLocToKey = () => {
  const keys = [undefined, undefined, undefined, undefined, undefined];
  keys[INDS_LOC.M] = undefined;
  keys[INDS_LOC.L] = TypeKey.ARROW_LEFT;
  keys[INDS_LOC.R] = TypeKey.ARROW_RIGHT;
  keys[INDS_LOC.T] = TypeKey.ARROW_UP;
  keys[INDS_LOC.B] = TypeKey.ARROW_DOWN;
  return keys;
};

/* eslint-disable no-param-reassign */
const prepareStimInds = (params) => {
  params.rotC = 0;
  params.indC = INDS_STIM.NONE;
  params.rotsL = [0, 0, 0, 0, 0];
  params.rotsR = [0, 0, 0, 0, 0];
  params.indsL = [
    INDS_STIM.NONE,
    INDS_STIM.NONE,
    INDS_STIM.NONE,
    INDS_STIM.NONE,
    INDS_STIM.NONE,
  ];
  params.indsR = [
    INDS_STIM.NONE,
    INDS_STIM.NONE,
    INDS_STIM.NONE,
    INDS_STIM.NONE,
    INDS_STIM.NONE,
  ];

  const numStim = params.namesStim.length;

  if (params.typeTask === TypeTask.SHAPE_IDENT) {
    params.indC = INDS_STIM.FIX;

    params.indTarg ??= indRandom(numStim);
    if (params._sameFlank === true) {
      params.indsFlank ??= Array(4).fill(INDS_STIM.FLANK);
    } else {
      params.indsFlank ??= indsRandomNoRepeatExcl(4, numStim, [params.indTarg]);
    }
    indsFlankFilter(
      params.indsFlank,
      params.showFlankHor,
      params.showFlankVert,
    );
    if (params.sideTarg === TypeSide.LEFT) {
      indsCombine(params.indTarg, params.indsFlank, params.indsL);
    } else if (params.sideTarg === TypeSide.RIGHT) {
      indsCombine(params.indTarg, params.indsFlank, params.indsR);
    }
  } else if (params.typeTask === TypeTask.SHAPE_COMPARE_REF) {
    params.indTarg ??= indRandom(numStim);
    if (params.indRef === undefined) {
      if (params.same === TypeSame.SAME) {
        params.indRef = params.indTarg;
      } else {
        params.indRef = indRandomExcl(numStim, [params.indTarg]);
      }
    }
    params.indC = params.indRef;
    if (params._sameFlank === true) {
      params.indsFlank ??= Array(4).fill(INDS_STIM.FLANK);
    } else {
      params.indsFlank ??= indsRandomNoRepeatExcl(4, numStim, [
        params.indTarg,
        params.indRef,
      ]);
    }
    indsFlankFilter(
      params.indsFlank,
      params.showFlankHor,
      params.showFlankVert,
    );
    if (params.sideTarg === TypeSide.LEFT) {
      indsCombine(params.indTarg, params.indsFlank, params.indsL);
    } else if (params.sideTarg === TypeSide.RIGHT) {
      indsCombine(params.indTarg, params.indsFlank, params.indsR);
    }
  } else if (params.typeTask === TypeTask.SHAPE_COMPARE_LR) {
    params.indC = INDS_STIM.FIX;
    params.indTargL ??= indRandom(numStim);
    if (params.indTargR === undefined) {
      if (params.same === TypeSame.SAME) {
        params.indTargR = params.indTargL;
      } else {
        params.indTargR = indRandomExcl(numStim, [params.indTargL]);
      }
    }
    if (params._sameFlank === true) {
      params.indsFlankL ??= Array(4).fill(INDS_STIM.FLANK);
      params.indsFlankR ??= Array(4).fill(INDS_STIM.FLANK);
      indsFlankFilter(
        params.indsFlankL,
        params.showFlankHor,
        params.showFlankVert,
      );
      indsFlankFilter(
        params.indsFlankR,
        params.showFlankHor,
        params.showFlankVert,
      );
    } else {
      // eslint-disable-next-line no-lonely-if
      if (!params.indsFlankL || !params.indsFlankR) {
        if (params.showFlankHor && params.showFlankVert) {
          params.indsFlankL = indsRandomNoRepeatExcl(4, numStim, [
            params.indTargL,
            params.indTargR,
          ]);
          params.indsFlankR = indsRandomNoRepeatExcl(4, numStim, [
            params.indTargL,
            params.indTargR,
          ]);
          indsFlankFilter(
            params.indsFlankL,
            params.showFlankHor,
            params.showFlankVert,
          );
          indsFlankFilter(
            params.indsFlankR,
            params.showFlankHor,
            params.showFlankVert,
          );
        } else {
          params.indsFlankL = Array(4).fill(INDS_STIM.NONE);
          params.indsFlankR = Array(4).fill(INDS_STIM.NONE);
          const indsFlank = indsRandomNoRepeatExcl(4, numStim, [
            params.indTargL,
            params.indTargR,
          ]);
          /* eslint-disable prefer-destructuring */
          if (params.showFlankHor) {
            params.indsFlankL[INDS_LOC.L] = indsFlank[0];
            params.indsFlankL[INDS_LOC.R] = indsFlank[1];
            params.indsFlankR[INDS_LOC.L] = indsFlank[2];
            params.indsFlankR[INDS_LOC.R] = indsFlank[3];
          } else if (params.showFlankVert) {
            params.indsFlankL[INDS_LOC.T] = indsFlank[0];
            params.indsFlankL[INDS_LOC.B] = indsFlank[1];
            params.indsFlankR[INDS_LOC.T] = indsFlank[2];
            params.indsFlankR[INDS_LOC.B] = indsFlank[3];
          }
          /* eslint-enable prefer-destructuring */
        }
      }
    }
    indsCombine(params.indTargL, params.indsFlankL, params.indsL);
    indsCombine(params.indTargR, params.indsFlankR, params.indsR);
  }
  if (
    params.typeTask === TypeTask.ORIENT_IDENT ||
    params.typeTask === TypeTask.ORIENT_COMPARE_REF ||
    params.typeTask === TypeTask.ORIENT_COMPARE_LR
  ) {
    params.anglesFlank ??= [0, 90, 180, 270];
    params.indTarg ??= 0;
    params.indFlank ??= 1;
    const indsLR = [
      params.indFlank,
      params.indFlank,
      params.indFlank,
      params.indFlank,
      params.indTarg,
    ];
    indsFlankFilter(indsLR, params.showFlankHor, params.showFlankVert);

    if (params.typeTask === TypeTask.ORIENT_IDENT) {
      params.anglesTarg ??= [0, 90, 180, 270];
      params.rotTarg ??= elemRandom(params.anglesTarg);
      params.rotsFlank ??= elemsRandom(4, params.anglesFlank);
      params.indC = INDS_STIM.FIX;
      if (params.sideTarg === TypeSide.LEFT) {
        params.indsL = indsLR;
        rotsCombine(params.rotTarg, params.rotsFlank, params.rotsL);
      } else if (params.sideTarg === TypeSide.RIGHT) {
        params.indsR = indsLR;
        rotsCombine(params.rotTarg, params.rotsFlank, params.rotsR);
      }
    } else if (params.typeTask === TypeTask.ORIENT_COMPARE_REF) {
      params.anglesTarg ??= [0, 180];
      params.rotTarg ??= elemRandom(params.anglesTarg);
      params.rotsFlank ??= elemsRandom(4, params.anglesFlank);
      if (params.rotRef === undefined) {
        if (params.same === TypeSame.SAME) {
          params.rotRef = params.rotTarg;
        } else {
          params.rotRef = elemRandomExcl(params.anglesTarg, [params.rotTarg]);
        }
      }
      params.indC = params.indTarg;
      params.rotC = params.rotRef;
      if (params.sideTarg === TypeSide.LEFT) {
        params.indsL = indsLR;
        rotsCombine(params.rotTarg, params.rotsFlank, params.rotsL);
      } else if (params.sideTarg === TypeSide.RIGHT) {
        params.indsR = indsLR;
        rotsCombine(params.rotTarg, params.rotsFlank, params.rotsR);
      }
    } else if (params.typeTask === TypeTask.ORIENT_COMPARE_LR) {
      params.anglesTarg ??= [0, 180];
      params.rotTargL ??= elemRandom(params.anglesTarg);
      if (params.rotTargR === undefined) {
        if (params.same === TypeSame.SAME) {
          params.rotTargR = params.rotTargL;
        } else {
          params.rotTargR = elemRandomExcl(params.anglesTarg, [
            params.rotTargL,
          ]);
        }
      }
      params.rotsFlankL ??= elemsRandom(4, params.anglesFlank);
      params.rotsFlankR ??= elemsRandom(4, params.anglesFlank);
      params.indC = INDS_STIM.FIX;
      params.indsL = indsLR;
      params.indsR = indsLR;
      rotsCombine(params.rotTargL, params.rotsFlankL, params.rotsL);
      rotsCombine(params.rotTargR, params.rotsFlankR, params.rotsR);
    }
  }
};
/* eslint-enable no-param-reassign */

/* eslint-disable no-param-reassign */
// TODO: think about it!
const prepareRatioMinMax = (params) => {
  params.distFlankMin ??= CR.DIST_FLANK_MIN;
  params.ratioMin ??=
    (params.distFlankMin * params.sizeStim) / params.eccentTarg;

  if (!params.ratioMax) {
    if (!params.showFlankHor) {
      params.ratioMax = CR.RATIO_MAX_100;
      return;
    }
    if (
      params.typeTask === TypeTask.SHAPE_COMPARE_REF ||
      params.typeTask === TypeTask.ORIENT_COMPARE_REF
    ) {
      params.ratioMax = CR.RATIO_MAX_050;
      return;
    }
    params.ratioMax = CR.RATIO_MAX_075;
  }
};
/* eslint-enable no-param-reassign */

export const prepareParams = (metaparams) => {
  const params = metaparamsToParams(metaparams);
  prepareStimSrcs(params);
  prepareStimInds(params);
  prepareRatioMinMax(params);
  return params;
};

// TODO: temporary, for playground only
/*
const htmlInstrResp = (params, info, stageTrial) => {
  if (stageTrial !== StageTrial.RESP) {
    return "";
  } 
  const textInstrResp = `Response: ${mapTaskToInstrResp[params.typeTask]}`;
  return `
    <div style=" 
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 10vh;
      white-space: pre;
      border-bottom: 1px solid #ccc; 
      padding-bottom: 10px; 
      font-weight: bold;
      background-color:white;
      z-index: 10">
      ${textInstrResp}
    </div>`;
}
*/

export const htmlStimFix = (params, info, stageTrial) => {
  const showStim =
    stageTrial === StageTrial.STIM ||
    stageTrial === StageTrial.STIM_PRE ||
    stageTrial === StageTrial.PREVIEW;
  const showMarkFix = true;

  const classMarkFix =
    info.animateMarkFix && stageTrial === StageTrial.FIX
      ? "roav-cr-animation-mark-fix"
      : "";

  const classStim = "";
  let classStimTarg = "";
  let classStimRef = "";

  const tasksCompare = [
    TypeTask.SHAPE_COMPARE_LR,
    TypeTask.SHAPE_COMPARE_REF,
    TypeTask.ORIENT_COMPARE_LR,
    TypeTask.ORIENT_COMPARE_REF,
  ];

  // TODO: decide whether we want an outline here
  if (showStim) {
    const isTaskCompare = tasksCompare.includes(params.typeTask);
    const classAnim = isTaskCompare
      ? `roav-cr-animation-stim-targ-outline-${params.same}`
      : `roav-cr-animation-stim-targ-outline`;
    classStimTarg = info.animateStimTarg ? classAnim : "";
    classStimRef = info.animateStimRef ? classAnim : "";
  }

  // TODO: make magic number into constant - maybe dependent on typeTrial
  // TODO: deal with preview!!! yOrigin = 0 for preview
  const heightScreen = sessionGet(SK.HEIGHT_WINDOW_FS);
  let yShiftOrigin = 0;
  if (
    stageTrial !== StageTrial.PREVIEW
    /* && params.typeTask !== TypeTask.SHAPE_IDENT */
  ) {
    yShiftOrigin = -0.1 * heightScreen;
  }

  let html = "";
  if (showStim && params.indC >= 0) {
    html += htmlImgSvgPositioned(
      showMarkFix,
      params.srcsStim[params.indC],
      params.sizeStim,
      params.sizeStim,
      0,
      yShiftOrigin,
      params.rotC,
      classStimRef,
    );
  } else {
    html += htmlImgSvgPositioned(
      showMarkFix,
      params.srcMarkFix,
      params.sizeMarkFix,
      params.sizeMarkFix,
      0,
      yShiftOrigin,
      0,
      classMarkFix,
    );
  }

  const distFlank = params.eccentTarg * params.ratio;
  const offsets = mapIndLocToOffset();

  // eslint-disable-next-line arrow-body-style
  const disableStimPreLoc = (iLoc) => {
    return (
      stageTrial === StageTrial.STIM_PRE &&
      ((params.durationTargPre < 0 && iLoc === INDS_LOC.M) ||
        (params.durationTargPre > 0 && iLoc !== INDS_LOC.M))
    );
  };

  for (let iLoc = 0; iLoc < 5; iLoc += 1) {
    const indStim = params.indsR[iLoc];

    const disableStimPre = disableStimPreLoc(iLoc);
    const showStimLoc =
      showStim &&
      !disableStimPre &&
      (indStim >= 0 || indStim === INDS_STIM.FLANK);
    const srcStimLoc =
      indStim === INDS_STIM.FLANK ? params._srcFlank : params.srcsStim[indStim];

    html += htmlImgSvgPositioned(
      showStimLoc,
      srcStimLoc,
      params.sizeStim,
      params.sizeStim,
      params.eccentTarg + distFlank * offsets[iLoc][0],
      yShiftOrigin + distFlank * offsets[iLoc][1],
      params.rotsR[iLoc],
      iLoc === INDS_LOC.M ? classStimTarg : classStim,
    );
  }
  for (let iLoc = 0; iLoc < 5; iLoc += 1) {
    const indStim = params.indsL[iLoc];
    const disableStimPre = disableStimPreLoc(iLoc);
    const showStimLoc =
      showStim &&
      !disableStimPre &&
      (indStim >= 0 || indStim === INDS_STIM.FLANK);
    const srcStimLoc =
      indStim === INDS_STIM.FLANK ? params._srcFlank : params.srcsStim[indStim];

    html += htmlImgSvgPositioned(
      showStimLoc,
      srcStimLoc,
      params.sizeStim,
      params.sizeStim,
      -params.eccentTarg + distFlank * offsets[iLoc][0],
      yShiftOrigin + distFlank * offsets[iLoc][1],
      params.rotsL[iLoc],
      iLoc === INDS_LOC.M ? classStimTarg : classStim,
    );
  }

  return `
    <div style="position: absolute; inset: 0; margin: 0;">
      ${html}
    </div>  `;
};

const BTN_RESP_DIST_BOTTOM = 0.2; // in % of screen height
const BTN_RESP_HEIGHT = 0.1; // in % of screen height
const BTN_RESP_WIDTH_GAP = 0.2; // in % HEIGHT_BTN_RESP
const SIZE_IMG_BTN = 0.6; // in % of the button size

const htmlBtnsRespIdentShape = (params, info, stageTrial) => {
  if (params.typeTask !== TypeTask.SHAPE_IDENT) {
    return "";
  }
  const numStim = params.namesStim.length;

  const widthScreen = sessionGet(SK.WIDTH_WINDOW_FS);
  const heightScreen = sessionGet(SK.HEIGHT_WINDOW_FS);

  const sizeBtn = BTN_RESP_HEIGHT * heightScreen;
  const gap = BTN_RESP_WIDTH_GAP * sizeBtn;

  const widthRespTotal = sizeBtn * numStim + gap * (numStim - 1);

  const showResp = stageTrial === StageTrial.RESP;
  const classBtnNotTarg = "";

  const classBtnTarg = info.animateBtnResp
    ? "roav-cr-animation-button-resp"
    : "";
  const classImgNotTarg = "";
  const classImgTarg = "";

  let html = ``;
  for (let iStim = 0; iStim < numStim; iStim += 1) {
    const classBtn = iStim === params.indTarg ? classBtnTarg : classBtnNotTarg;
    const classImg = iStim === params.indTarg ? classImgTarg : classImgNotTarg;

    html += `
      <button
        type="button"
        draggable="false" 
        class="roav-cr-btn-resp ${classBtn}"
        id="resp-${iStim}"
        style="
          visibility: ${showResp ? "visible" : "hidden"};
          width: ${sizeBtn}px;
          height: ${sizeBtn}px;
        ">
        <img
          src="${params.srcsStim[iStim]}"
          class="roav-cr-img-btn-resp ${classImg}"
          width=${sizeBtn * SIZE_IMG_BTN}
          height=${sizeBtn * SIZE_IMG_BTN}
        />
      </button>
    `;
  }
  return `
    <div
      class = "roav-cr-btns-resp-wrap"
      style="
        left: ${(widthScreen - widthRespTotal) / 2}px;
        bottom: ${heightScreen * BTN_RESP_DIST_BOTTOM}px;
        width: ${widthRespTotal}px;
        gap: ${gap}px;
      ">
      ${html}
    </div>
  `;
};

const htmlBtnsRespIdentOrient = (params, info, stageTrial) => {
  if (params.typeTask !== TypeTask.ORIENT_IDENT) {
    return "";
  }
  const widthScreen = sessionGet(SK.WIDTH_WINDOW_FS);
  const heightScreen = sessionGet(SK.HEIGHT_WINDOW_FS);

  const sizeBtn = BTN_RESP_HEIGHT * heightScreen;
  // TODO: 0.55 is a magic number
  const gap = 0.6 * BTN_RESP_WIDTH_GAP * sizeBtn;

  const showResp = stageTrial === StageTrial.RESP;
  const classBtnNotTarg = "";

  const classBtnTarg = info.animateBtnResp
    ? "roav-cr-animation-button-resp"
    : "";
  const classImgNotTarg = "";
  const classImgTarg = "";

  let html = ``;

  const offsets = mapIndLocToOffset();
  const rots = mapIndLocToRot();

  const xMid = widthScreen / 2;
  // TODO: 0.65 is a magic number - meaning that the top of the top button is at 0.65
  const yMid = heightScreen * 0.6 + 1.5 * sizeBtn + gap;
  const step = sizeBtn + gap;

  for (let iLoc = 0; iLoc < 4; iLoc += 1) {
    const classBtn =
      rots[iLoc] === params.rotTarg ? classBtnTarg : classBtnNotTarg;
    const classImg =
      rots[iLoc] === params.rotTarg ? classImgTarg : classImgNotTarg;

    html += `
      <button
        type="button"
        draggable="false" 
        class="roav-cr-btn-resp ${classBtn}"
        id="resp-${rots[iLoc]}"
        style="
          position: absolute;
          visibility: ${showResp ? "visible" : "hidden"};
          left: ${xMid + offsets[iLoc][0] * step - sizeBtn / 2}px;
          top: ${yMid + offsets[iLoc][1] * step - sizeBtn / 2}px;
          width: ${sizeBtn}px;
          height: ${sizeBtn}px;
        ">
        <img
          src="${params.srcsStim[params.indTarg]}"
          class="roav-cr-img-btn-resp ${classImg}"
          width=${sizeBtn * SIZE_IMG_BTN}
          height=${sizeBtn * SIZE_IMG_BTN}
          style="transform: rotate(${rots[iLoc]}deg);"          
        />
      </button>
    `;
  }
  return `<div style="position: absolute; inset: 0;">${html}</div>`;
};

// TODO: if REF is selected, add gap between fixation and reference trial, so that reference is not obscured
const htmlBtnsRespCompareHor = (params, info, stageTrial) => {
  const showResp = stageTrial === StageTrial.RESP;
  // const widthScreen = sessionGet(SK.WIDTH_WINDOW_FS);
  const heightScreen = sessionGet(SK.HEIGHT_WINDOW_FS);

  // TODO: make magic numbers into constants
  const heightBtn = 0.125 * heightScreen;
  const topBtnSame = 0.65 * heightScreen;
  const gap = 0.03 * heightScreen;
  const topBtnDiff = topBtnSame + heightBtn + gap;

  const srcSame = mediaAssets.images[info.keyImgBtnSameHor];
  const srcDiff = mediaAssets.images[info.keyImgBtnDiffHor];
  const htmlVis = `visibility: ${showResp ? "visible" : "hidden"};`;

  const htmlBtnRespCompareRef = (typeSame) => {
    let htmlPos = "";
    let src = null;
    if (typeSame === TypeSame.SAME) {
      htmlPos = `top: ${topBtnSame}px`;
      src = srcSame;
    } else if (typeSame === TypeSame.DIFF) {
      htmlPos = `top: ${topBtnDiff}px`;
      src = srcDiff;
    }

    const classBtnResp =
      info.animateBtnResp && showResp && typeSame === params.same
        ? `roav-cr-animation-button-resp-${params.same}`
        : "";

    return `
      <button type="button" class="roav-cr-btn-resp-compare-tb ${classBtnResp}" 
      draggable="false" 
      id="resp-${typeSame}"
      style="${htmlPos}; ${htmlVis}">
      <img src="${src}" 
        draggable="false"
        style="
          display:block;
          height:${heightBtn}px;
          width:auto;"/>
    </button>`;
  };

  let html = "";
  html += htmlBtnRespCompareRef(TypeSame.SAME);
  html += htmlBtnRespCompareRef(TypeSame.DIFF);
  return html;
};

// eslint-disable-next-line no-unused-vars
const htmlBtnsRespCompareVert = (params, info, stageTrial) => {
  const showResp = stageTrial === StageTrial.RESP;
  const widthScreen = sessionGet(SK.WIDTH_WINDOW_FS);
  // const heightScreen = sessionGet(SK.HEIGHT_WINDOW_FS);

  // TODO: make magic numbers into constants
  const widthBtn = 0.1 * widthScreen;
  const widthMarginHor = 0.03 * widthScreen;

  const srcSame = mediaAssets.images[info.keyImgBtnSameVert];
  const srcDiff = mediaAssets.images[info.keyImgBtnDiffVert];
  const htmlVis = `visibility: ${showResp ? "visible" : "hidden"};`;

  const htmlBtnRespCompareLR = (typeSame) => {
    let htmlPos = "";
    let src = null;
    if (typeSame === TypeSame.DIFF) {
      htmlPos = `left: ${widthMarginHor}px`;
      src = srcDiff;
    } else if (typeSame === TypeSame.SAME) {
      htmlPos = `right: ${widthMarginHor}px`;
      src = srcSame;
    }

    return `
    <button type="button" class="roav-cr-btn-resp-compare-lr" 
      draggable="false" 
      id="resp-${typeSame}"
      style="${htmlPos}; ${htmlVis}">
      <img src="${src}" 
        draggable="false";          
        style="
          display:block;
          width:${widthBtn}px;
          height:auto;"/>
    </button>`;
  };

  let html = "";
  html += htmlBtnRespCompareLR(TypeSame.SAME);
  html += htmlBtnRespCompareLR(TypeSame.DIFF);
  return html;
};

const htmlBtnsResp = (params, info, stageTrial) => {
  if (params.typeTask === TypeTask.SHAPE_IDENT) {
    return htmlBtnsRespIdentShape(params, info, stageTrial);
  }
  if (params.typeTask === TypeTask.ORIENT_IDENT) {
    return htmlBtnsRespIdentOrient(params, info, stageTrial);
  }
  return params.btnsRespCompareHor
    ? htmlBtnsRespCompareHor(params, info, stageTrial)
    : htmlBtnsRespCompareVert(params, info, stageTrial);
  /*
  if (
    params.typeTask === TypeTask.SHAPE_COMPARE_LR ||
    params.typeTask === TypeTask.ORIENT_COMPARE_LR
  ) {
    return htmlBtnsRespCompareHor(params, info, stageTrial);
  }
  if (
    params.typeTask === TypeTask.SHAPE_COMPARE_REF ||
    params.typeTask === TypeTask.ORIENT_COMPARE_REF
  ) {
    return htmlBtnsRespCompareHor(params, info, stageTrial);
  }
  return "";
  */
};

const calcIndTrialTestAbs = (params, info) => {
  if (info.stageAssessment !== AssessmentStage.TEST) {
    return -1;
  }
  return sessionGet(SK.IND_TRIAL_GLOBAL);
};

const calcNumTrialTestTotal = () => {
  const config = sessionGet(SK.CONFIG);
  const configBlock = sessionGet(SK.CONFIG_BLOCK);
  const arrParamsPart = configBlock.subvars[config.subvar];
  let numTotal = 0;
  for (let iPart = 0; iPart < arrParamsPart.length; iPart += 1) {
    numTotal += arrParamsPart[iPart].numTrial ?? 0;
    numTotal += arrParamsPart[iPart].numTrialNoflank ?? 0;
  }
  return numTotal;
};

const htmlProgressBar = (params, info) => {
  if (!info.showProgressBar) {
    return "";
  }
  if (info.stageAssessment !== AssessmentStage.TEST) {
    return "";
  }

  const indTrialTestAbs = calcIndTrialTestAbs(params, info);
  const numTrialTestTotal = calcNumTrialTestTotal();
  const percentComplete =
    (100 * Math.max(indTrialTestAbs, 0)) / numTrialTestTotal;

  return `
    <div class="roav-progress-bar-wrap">
      <div id="id-progress-bar"
        class="roav-progress-bar" 
        style="width:${percentComplete}%">      
      </div>
    </div>`;
};

const htmlLog = (showLog) => {
  if (!showLog) {
    return "";
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

const htmlLayout = (params, info, stageTrial) => {
  const htmlStimsFixCur = htmlStimFix(params, info, stageTrial);
  const htmlBtnsRespCur = htmlBtnsResp(params, info, stageTrial);

  const htmlProgressBarCur = htmlProgressBar(params, info);
  const widthFS = sessionGet(SK.WIDTH_WINDOW_FS);
  const heightFS = sessionGet(SK.HEIGHT_WINDOW_FS);

  // TODO: temporary
  const htmlInstrRespCur = ""; // htmlInstrResp(params, info, stageTrial);

  const html = `
      ${htmlInstrRespCur}
      ${htmlLog(info.showLog)}
      <div>
        ${htmlProgressBarCur}
        
        <div class="roav-cr-stim-resp-wrap" id="id-stim-resp-wrap"
          style="width:${widthFS}px; height:${heightFS}px">

          <div class="roav-cr-stim-wrap">
            ${htmlStimsFixCur}
          </div>
          
          <div class="roav-cr-resp-wrap">
            ${htmlBtnsRespCur}
          </div>

        </div>
      </div>`;
  return html;
};

const isValidTestTrial = (params, info) => {
  const isValid = info.stageAssessment === AssessmentStage.TEST;
  return isValid;
};

export const t_cr = (paramsTrialIn = {}, tagReq = TAG_REQ_DEF) => {
  let metaparams = null;
  let info = null;
  let params = null;

  let valResp = null;

  let timeRespStart = -1;
  let timeRespEnd = -1;

  let helperOrient = null;
  let helperFullscreenConditional = null;
  const helperMouseMoveRecord = createHelperMouseMoveRecord();

  let timeoutWarnTimeout = null;

  const trialEtStart = () => ({
    type: jsPsychCallFunction,
    func: () => {
      et_stateResetSnapshots();
      const configEt = sessionGet(SK.CONFIG_ET);
      state.collectSnapshots = configEt.collectSnapshotsCr;
      state.paramsSnapshot = {
        ...et_paramsSnapsotDef,
        ...configEt.paramsSnapshotCr,
      };

      et_videoStart();
      et_etCreateLayout({
        showGaze: info.showGaze,
        showEyes: info.showEyes,
        paramsDecor: info.paramsDecor,
      });

      const typeModel = configEt.typeModelCr;
      if (typeModel === et_TypeModel.NONE) {
        et_etInit(et_def_onResultsFaceMesh, null);
      } else if (typeModel === et_TypeModel.AT_CROPS_BBS) {
        et_etInit();
      } else {
        // eslint-disable-next-line no-console
        console.log(`Undefined eye-tracking model: ${typeModel}`);
      }
      et_etStart();
    },
  });

  const trialEtStop = () => ({
    type: jsPsychCallFunction,
    func: () => {
      et_etStop();
      et_etRemoveLayout();
    },
  });

  /*
  const trialEtStop = () => ({
  type: jsPsychCallFunction,
  async: true,
  func: async (done) => {
    et_etStop();
    et_etRemoveLayout();
    await et_videoRecordStop();
    if (sessionGet(SK.VIDEO_RECORD)) {
      await et_videoRecordSave(`cr-${info.idTrial}_${state.timeStartVideoRecord}.webm`);
    }
    done();
  },
  });
*/

  const questPreTrial = () => {
    if (Object.keys(quest).length === 0) {
      return;
    }

    if (info.stageAssessment === AssessmentStage.TEST) {
      // TODO: do we want to save alerts? Like in MP
      quest.clearAlerts();
      if (!quest.isQuestTrialFirst) {
        const intensityNew = quest.quantile(0.5);
        let ratioNew = 10 ** intensityNew / 100.0;
        if (ratioNew < params.ratioMin) {
          quest.addAlert(`cr: ratio ${ratioNew} < min ${params.ratioMin}`);
          ratioNew = params.ratioMin;
        } else if (ratioNew > params.ratioMax) {
          quest.addAlert(`cr: ratio ${ratioNew} > max ${params.ratioMax}`);
          ratioNew = params.ratioMax;
        }
        params.ratio = ratioNew;
      } else {
        quest.isQuestTrialFirst = false;
      }
    }
  };

  const questPostTrial = (correct) => {
    if (Object.keys(quest).length === 0) {
      return;
    }
    if (helperOrient?.rotationDetected()) {
      return;
    }
    if (info.stageAssessment === AssessmentStage.TEST) {
      const ratio = params.ratio * 100.0;
      const intensity = Math.log10(ratio);
      quest.update(intensity, correct ? 1 : 0);
    }
  };

  const screenSetupOnLoadDef = (keyTrialEnd, trackResize = false) => {
    const onScreenChange = () => {
      jsPsych.pluginAPI.pressKey(keyTrialEnd);
    };
    helperOrient = createHelperOrientation(onScreenChange);
    helperOrient.startEventListeners();

    if (trackResize) {
      helperFullscreenConditional =
        createHelperFullscreenConditional(onScreenChange);
      helperFullscreenConditional.startEventListeners();
    }
  };

  const trialPrepareAll = () => ({
    type: jsPsychCallFunction,
    func: () => {
      valResp = null;
      params = prepareParams(metaparams);
      questPreTrial();
      timeRespStart = -1;
      timeRespEnd = -1;
    },
  });

  const writeLog = () => {
    const log = "LOG";
    const elLog = document.getElementById("id-log");
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
      const elStimRespWrap = document.getElementById("id-stim-resp-wrap");
      const timeStartWarnTimeout =
        params.durationResp - params.durationRespWarnTimeout;
      if (elStimRespWrap && timeStartWarnTimeout > 0) {
        timeoutWarnTimeout = window.setTimeout(() => {
          elStimRespWrap.classList.add("roav-cr-warn-timeout");
        }, timeStartWarnTimeout);
      }
    }
  };

  const clearWarnTimeout = () => {
    if (timeoutWarnTimeout !== null) {
      window.clearTimeout(timeoutWarnTimeout);
      timeoutWarnTimeout = null;
    }
    const elStimRespWrap = document.getElementById("id-stim-resp-wrap");
    if (elStimRespWrap) {
      elStimRespWrap.classList.remove("roav-cr-warn-timeout");
    }
  };

  const saveSummaryPostTrial = (correctCur, valRespCur, rtCur) => {
    if (
      Object.keys(quest).length !== 0 &&
      summary &&
      typeof summary.addInfo === "function"
    ) {
      const quest_updated = true;
      const quest_int_sd = quest ? quest.sd() : 0;
      const quest_int_quantile = quest ? quest.quantile() : 0;
      const quest_int_mean = quest ? quest.mean() : 0;

      const infoSummary = {
        type_trial: "cr-trial",
        correct: correctCur,
        response: valRespCur,
        rt: rtCur,
        subtype_trial: "quest",
        quest: {
          int_quantile: quest_int_quantile,
          int_mean: quest_int_mean,
          int_sd: quest_int_sd,
          val_sample: params.ratio,
          val_mean: 10 ** quest_int_mean / 100.0,
          val_quantile: 10 ** quest_int_quantile / 100.0,
          val_low: 10 ** (quest_int_mean - quest_int_sd) / 100.0,
          val_high: 10 ** (quest_int_mean + quest_int_sd) / 100.0,
          updated: quest_updated, // TODO: what is meaning / use of updated
        },
      };
      summary.addInfo(infoSummary);
    }
  };

  // TODO: check for rotation?????????????
  // eslint-disable-next-line arrow-body-style
  const trialFix = () => {
    return {
      type: jsPsychAudioMultiResponse,
      trial_duration: () =>
        hasAudio(info.keyAudioFix)
          ? DURATIONS.WAIT_FOR_RESPONSE
          : params.durationFix,
      stimulus: () =>
        mediaAssets.audio[info.keyAudioFix] ??
        mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => htmlLayout(params, info, StageTrial.FIX),
      response_ends_trial: true,
      trial_ends_after_audio: () => hasAudio(info.keyAudioFix),
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [""],
      button_html: () => "",
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

  // TODO: check for rotation?????????????
  // eslint-disable-next-line arrow-body-style
  const trialGapStimRef = () => {
    return {
      type: jsPsychAudioMultiResponse,
      trial_duration: () => params.durationGapStimRef,
      stimulus: () => mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => "",
      response_ends_trial: true,
      trial_ends_after_audio: () => false,
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [""],
      button_html: () => "",
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
  const trialStimPre = () => {
    return {
      type: jsPsychAudioMultiResponse,
      trial_duration: () => Math.abs(params.durationTargPre),
      stimulus: () => mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => htmlLayout(params, info, StageTrial.STIM_PRE),
      response_ends_trial: true,
      trial_ends_after_audio: () => false,
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [""],
      button_html: () => "",
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
      trial_duration: () =>
        hasAudio(info.keyAudioStim)
          ? DURATIONS.WAIT_FOR_RESPONSE
          : params.durationStim,
      stimulus: () =>
        mediaAssets.audio[info.keyAudioStim] ??
        mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => htmlLayout(params, info, StageTrial.STIM),
      response_ends_trial: true,
      trial_ends_after_audio: () => hasAudio(info.keyAudioStim),
      keyboard_choices: () => [TypeKey.DUMMY],
      button_choices: () => [""],
      button_html: () => "",
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
      // TODO: check why trial_duration is different than others
      trial_duration: () => params.durationResp,
      stimulus: () =>
        mediaAssets.audio[info.keyAudioResp] ??
        mediaAssets.audio.roavMpNullAudioAll,
      prompt: () => htmlLayout(params, info, StageTrial.RESP),
      response_ends_trial: true,
      trial_ends_after_audio: () => false,
      keyboard_choices: () => {
        if (params.typeTask === TypeTask.SHAPE_IDENT) {
          return [TypeKey.DUMMY];
        }
        if (params.typeTask === TypeTask.ORIENT_IDENT) {
          return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
        }
        // if (
        //   params.typeTask === TypeTask.SHAPE_COMPARE_LR ||
        //   params.typeTask === TypeTask.ORIENT_COMPARE_LR
        // ) {
        //   return ["ArrowLeft", "ArrowRight"];
        // }
        return ["ArrowUp", "ArrowDown"];
      },
      button_choices: () => [""],
      button_html: () => "",
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

        // TODO: move to a separate function
        if (params.typeTask === TypeTask.SHAPE_IDENT) {
          const numStim = params.namesStim.length;
          for (let iStim = 0; iStim < numStim; iStim += 1) {
            if (!info.disableBtnsRespNonTarg || iStim === params.indTarg) {
              const btn = document.getElementById(`resp-${iStim}`);
              btn.addEventListener("pointerdown", (e) => {
                updateModeInputInfoOnPointerEvent(e.pointerType);
              });
              // eslint-disable-next-line no-loop-func
              btn.addEventListener("click", () => {
                if (valResp !== null) {
                  // TODOD: see how valResp is initialized
                  return;
                }
                timeRespEnd = performance.now();
                valResp = iStim;
                jsPsych.pluginAPI.pressKey(TypeKey.DUMMY);
              });
            }
          }
        } else if (params.typeTask === TypeTask.ORIENT_IDENT) {
          const rots = mapIndLocToRot();
          const keys = mapIndLocToKey();
          for (let iLoc = 0; iLoc < 4; iLoc += 1) {
            const btn = document.getElementById(`resp-${rots[iLoc]}`);
            btn.addEventListener("pointerdown", (e) => {
              updateModeInputInfoOnPointerEvent(e.pointerType);
            });
            btn.addEventListener("click", () => {
              jsPsych.pluginAPI.pressKey(keys[iLoc]);
            });
          }
        } else {
          const setCallbacksBtnsSameDiff = (keySame, keyDiff) => {
            const btnSame = document.getElementById(`resp-${TypeSame.SAME}`);
            btnSame.addEventListener("pointerdown", (e) => {
              updateModeInputInfoOnPointerEvent(e.pointerType);
            });
            if (!info.disableBtnsRespNonTarg || params.same === TypeSame.SAME) {
              btnSame.addEventListener("click", () => {
                jsPsych.pluginAPI.pressKey(keySame);
              });
            }
            const btnDiff = document.getElementById(`resp-${TypeSame.DIFF}`);
            btnDiff.addEventListener("pointerdown", (e) => {
              updateModeInputInfoOnPointerEvent(e.pointerType);
            });
            if (!info.disableBtnsRespNonTarg || params.same === TypeSame.DIFF) {
              btnDiff.addEventListener("click", () => {
                jsPsych.pluginAPI.pressKey(keyDiff);
              });
            }
          };
          if (params.btnsRespCompareHor) {
            setCallbacksBtnsSameDiff(TypeKey.ARROW_UP, TypeKey.ARROW_DOWN);
          } else {
            setCallbacksBtnsSameDiff(TypeKey.ARROW_RIGHT, TypeKey.ARROW_LEFT);
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

        // alert(JSON.stringify(data));

        if (
          params.typeTask !== TypeTask.SHAPE_IDENT &&
          data.keyboard_response
        ) {
          valResp = data.keyboard_response;
        }

        const timeOut =
          valResp === null && !rotationDetected && !resizeDetected;
        let rt;
        if (rotationDetected || resizeDetected) {
          rt = -1;
        } else if (params.typeTask === TypeTask.SHAPE_IDENT) {
          rt =
            timeRespStart > 0 && timeRespEnd > 0
              ? timeRespEnd - timeRespStart
              : -1;
        } else {
          rt = data.rt;
        }

        let correct = !timeOut && !rotationDetected && !resizeDetected;
        if (correct) {
          if (params.typeTask === TypeTask.SHAPE_IDENT) {
            correct = valResp === params.indTarg;
          } else if (params.typeTask === TypeTask.ORIENT_IDENT) {
            const rots = mapIndLocToRot();
            const keys = mapIndLocToKey();
            const keyResp = valResp;
            const iLocCorr = rots.indexOf(params.rotTarg);
            correct =
              iLocCorr >= 0 &&
              keyResp.toLowerCase() === keys[iLocCorr].toLowerCase();
          } else {
            correct =
              (params.same === TypeSame.SAME &&
                valResp.toLowerCase() === TypeKey.ARROW_UP.toLowerCase()) ||
              (params.same === TypeSame.DIFF &&
                valResp.toLowerCase() === TypeKey.ARROW_DOWN.toLowerCase());
          }

          // else if (
          //   params.typeTask === TypeTask.SHAPE_COMPARE_LR ||
          //   params.typeTask === TypeTask.ORIENT_COMPARE_LR
          // ) {
          //   const valRespLower = valResp.toLowerCase();
          //   correct =
          //     (params.same === TypeSame.SAME &&
          //       valRespLower === TypeKey.ARROW_RIGHT.toLowerCase()) ||
          //     (params.same === TypeSame.DIFF &&
          //       valRespLower === TypeKey.ARROW_LEFT.toLowerCase());
          // } else if (
          //   params.typeTask === TypeTask.SHAPE_COMPARE_REF ||
          //   params.typeTask === TypeTask.ORIENT_COMPARE_REF
          // ) {
          //   const valRespLower = valResp.toLowerCase();
          //   correct =
          //     (params.same === TypeSame.SAME &&
          //       valRespLower === TypeKey.ARROW_UP.toLowerCase()) ||
          //     (params.same === TypeSame.DIFF &&
          //       valRespLower === TypeKey.ARROW_DOWN.toLowerCase());
          // }
        }

        /* eslint-disable no-param-reassign */
        data.correct = correct;
        data.response = valResp;
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
            validityEvaluator.addResponseData(
              rtEvaluator,
              data.response ?? "",
              correct ? 1 : 0,
            );
          }
        }

        // TODO: what is quest_updated?????
        // It is as in t_rdk, but it is NOT updated if not TEST for example...
        // not sure what it is
        const questInitialized = Object.keys(quest).length !== 0;
        const quest_updated = true;
        const quest_int_sd = questInitialized ? quest.sd() : 0;
        const quest_int_quantile = questInitialized ? quest.quantile() : 0;
        const quest_int_mean = questInitialized ? quest.mean() : 0;

        // TODO: saveSummary... is TEMPORARY AND duplicates quest calculations
        saveSummaryPostTrial(correct, valResp, data.rt);
        questPostTrial(correct);

        const paramsSave = { ...params }; // save space in db; params are saved as config
        paramsSave.srcMarkFix = "";
        paramsSave.srcsStim = [];

        jsPsych.data.addDataToLastTrial({
          save_trial: true,
          correct: correct,
          ratio: params.ratio,
          mode_game: sessionGet(SK.MODE_GAME),
          assessment_stage: `${info.stageAssessment}_response`,
          type_trial: tagTrial,
          id_trial: info.idTrial,
          ind_trial_block: sessionGet(SK.IND_TRIAL),
          ind_trial_global: sessionGet(SK.IND_TRIAL_GLOBAL),
          ind_block: sessionGet(SK.IND_BLOCK),
          num_trial_block: sessionGet(SK.NUM_TRIAL),
          name_corpus: info.nameCorpus,
          name_block: info.nameBlock,
          pid: sessionGet(SK.CONFIG).pid,
          type_task: params.typeTask,
          time_out: timeOut,
          rotation_detected: rotationDetected,
          resize_detected: resizeDetected,
          cnt_corr_block: sessionGet(SK.CNT_CORR),
          cnt_corr_global: sessionGet(SK.CNT_CORR_GLOBAL),
          num_stim: params.namesStim.length,
          mode_input: sessionGet(SK.MODE_INPUT_LAST),
          times_pointer_move: helperMouseMoveRecord?.timesPointerMove(),
          time_pointer_move_first:
            helperMouseMoveRecord?.timePointerMoveFirst(),
          time_pointer_move_last: helperMouseMoveRecord?.timePointerMoveLast(),
          info_trial: info,
          params_trial: paramsSave,
          quest_updated: quest_updated,
          quest_int_quantile: quest_int_quantile,
          quest_int_mean: quest_int_mean,
          quest_int_sd: quest_int_sd,
          quest_alerts: questInitialized ? quest.getAlerts() : "",
          quest_val_sample: params.ratio,
          quest_val_mean: 10 ** quest_int_mean / 100.0,
          quest_val_quantile: 10 ** quest_int_quantile / 100.0,
          quest_val_low: 10 ** (quest_int_mean - quest_int_sd) / 100.0,
          quest_val_high: 10 ** (quest_int_mean + quest_int_sd) / 100.0,
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
      info.playFeedbackTone
        ? Math.max(DURATIONS.FEEDBACK_MAX, params.durationGap)
        : params.durationGap,
    response_allowed_while_playing: false,
    trial_ends_after_audio: false,
    on_start: (/* trial */) => {},
    on_load: () => {
      screenSetupOnLoadDef(TypeKey.DUMMY);
    },
    on_finish: () => {
      helperOrient.removeEventListeners();
    },
  });

  // TODO: uncomment t_trialEnterFullscreenConditional
  // TODO: if REF - see whether trialGapRef checks orientation / resize (and whether it is needed at all)
  return {
    timeline: [
      t_trialEnterFullscreenConditional(),
      t_enterLandscape(),
      trialPrepareAll(),
      {
        type: jsPsychCallFunction,
        func: () => et_etCreateDecor(info.paramsDecor),
      },
      {
        timeline: [trialEtStart()],
        conditional_function: () =>
          sessionGet(SK.VIDEO_ENABLED) && sessionGet(SK.ET_ENABLE),
      },
      t_et_videoRecordStart(),
      {
        timeline: [trialFix()],
        conditional_function: () =>
          params.durationFix > 0 && !helperOrient?.rotationDetected(),
      },
      {
        timeline: [trialGapStimRef()],
        conditional_function: () =>
          params.durationGapStimRef > 0 &&
          !helperOrient?.rotationDetected() &&
          (params.typeTask === TypeTask.SHAPE_COMPARE_REF ||
            params.typeTask === TypeTask.ORIENT_COMPARE_REF),
      },
      {
        timeline: [trialStimPre()],
        conditional_function: () =>
          params.durationTargPre !== 0 && !helperOrient?.rotationDetected(),
      },
      {
        timeline: [trialStim()],
        conditional_function: () =>
          params.durationStim > 0 && !helperOrient?.rotationDetected(),
      },
      {
        timeline: [trialEtStop()],
        conditional_function: () => sessionGet(SK.VIDEO_ENABLED),
      },
      {
        timeline: [trialGapStimRef()],
        conditional_function: () =>
          params.durationGapStimRef > 0 &&
          !helperOrient?.rotationDetected() &&
          (params.typeTask === TypeTask.SHAPE_COMPARE_REF ||
            params.typeTask === TypeTask.ORIENT_COMPARE_REF),
      },
      t_trialEnterFullscreenConditional(),
      t_enterLandscape(),
      {
        timeline: [trialResp()],
        conditional_function: () => params.durationResp > 0, // = 0 for instructions only
      },
      t_et_stateSave({
        idTrialSaveOrFn: () => info.idTrial,
        saveCal: false,
        typeSaveSnapshots: et_TypeSaveSnapshots.MIN,
        requestUpload: false,
      }),
      t_et_videoRecordSave(() => info.idTrial),
      // TODO: put back full screen!
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
      {
        type: jsPsychCallFunction,
        func: () => et_etRemoveDecor(),
      },
    ],
    on_timeline_start: () => {
      const infoBlock = sessionGet(SK.CR_INFO_BLOCK);
      const metaparamsBlock = sessionGet(SK.CR_METAPARAMS_BLOCK);

      info = {
        ...fillTextKeyValuesDef(infoCrDef(tagReq)),
        ...fillTextKeyValuesDef(infoBlock),
        ...fillTextKeyValuesDef(paramsTrialIn.info),
      };

      const indTrial = sessionGet(SK.IND_TRIAL);
      info.indTrial ??= indTrial;

      metaparams = {
        ...metaparamsCrDef,
        ...metaparamsBlock,
        ...paramsTrialIn.metaparams,
      };

      info.idTrial ??= `${info.nameBlock}-trial-${indTrial}`;
    },
    on_timeline_end: () => {},
    conditional_function: () => {
      const modeGameTrial = paramsTrialIn?.info?.modeGameTrial ?? ModeGame.ALL;
      return enableTrialByModeGame(modeGameTrial);
    },
  };
};
