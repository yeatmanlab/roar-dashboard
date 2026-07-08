import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { t_feedbackAudioVisual } from "../../shared/trials/feedbackAudioVisual";
import { sessionGet, sessionSet } from "../../shared/helpers/sessionHelpers";
import { CR_SESSION_KEYS as SK } from "../helpers/cr_sessionKeys";
import { TAG_REQ_DEF } from "../../shared/helpers/namingHelpers";
// import {
//   createArrIndsRepeat,
//   shuffleArr,
// } from "../../shared/helpers/orderHelpers";
import { wrapAsJsPsychTrial } from "../../shared/helpers/jspsychHelpers";
import { t_cr, TypeSame, TypeSide, TypeTask } from "./cr_trial";
import {
  createArrIndsRepeat,
  shuffleArr,
} from "../../shared/helpers/orderHelpers";

const paramsSetParamsBlockCrDef = {
  metaparams: {},
  info: {},
};

const setParamsBlockCr = (paramsIn) => {
  const params = { ...paramsSetParamsBlockCrDef, ...paramsIn };
  sessionSet(SK.CR_METAPARAMS_BLOCK, params.metaparams);
  sessionSet(SK.CR_INFO_BLOCK, params.info);
  sessionSet(SK.DATA_CORRECT, undefined);
};

export const t_setParamsBlockCr = (paramsIn) => ({
  timeline: [wrapAsJsPsychTrial(() => setParamsBlockCr(paramsIn))],
  conditional_function: () => sessionGet(SK.ENABLE_TRIALS),
});

const paramsCreateBlockCrDef = {
  typeTask: TypeTask.ORIENT_IDENT,
  numStim: 5,
  numTrial: 40,
  nameBlock: undefined,
  tagReqCr: TAG_REQ_DEF,
  arrMetaparams: undefined,
  playFeedbackAv: false,
  tagReqFeedbackAv: TAG_REQ_DEF,
  paramsFeedbackAv: undefined,

  balanceInd: true,
  balanceSide: true,
  balanceSame: true,

  resetBlock: true,
  resetGlobal: false,
};

const resetIndsCntsCorr = (resetBlock, resetGlobal) => {
  if (resetBlock) {
    sessionSet(SK.IND_TRIAL, 0);
    sessionSet(SK.CNT_TRIAL, 0);
    sessionSet(SK.CNT_CORR, 0);
  }
  if (resetGlobal) {
    sessionSet(SK.IND_TRIAL_GLOBAL, 0);
    sessionSet(SK.CNT_TRIAL_GLOBAL, 0);
    sessionSet(SK.CNT_CORR_GLOBAL, 0);
  }
};

const calcArrInd = (numTrial, numStim) => {
  const numRepeat = Math.floor(numTrial / numStim);
  const posMax = numStim - 1;
  let arrInd = createArrIndsRepeat(numRepeat, posMax);
  arrInd = shuffleArr(arrInd);
  return arrInd;
};

// TODO:  numTrial should be EVEN - at least leave a comment, or
//        implement callback
const calcArrSide = (numTrial) => {
  const numRepeat = Math.floor(numTrial / 2);
  let arrInd = createArrIndsRepeat(numRepeat, 1);
  arrInd = shuffleArr(arrInd);
  const arrSide = arrInd.map((ind) =>
    ind === 0 ? TypeSide.LEFT : TypeSide.RIGHT,
  );
  return arrSide;
};

// TODO:  numTrial should be EVEN - at least leave a comment, or
//        implement callback
const calcArrSame = (numTrial) => {
  const numRepeat = Math.floor(numTrial / 2);
  let arrInd = createArrIndsRepeat(numRepeat, 1);
  arrInd = shuffleArr(arrInd);
  const arrSame = arrInd.map((ind) =>
    ind === 0 ? TypeSame.SAME : TypeSame.DIFF,
  );
  return arrSame;
};

// TODO: numTrial better be numStim * (numStim - 1)
const calcArrIndPairDiff = (numTrial, numStim) => {
  let arrIndPair = [];
  const numComb = numStim * (numStim - 1);
  const numRepeat = Math.floor(numTrial / numComb);
  for (let iRepeat = 0; iRepeat < numRepeat; iRepeat += 1) {
    for (let i = 0; i < numStim; i += 1)
      for (let j = 0; j < numStim; j += 1) {
        if (i !== j) {
          arrIndPair.push([i, j]);
        }
      }
  }
  arrIndPair = shuffleArr(arrIndPair);
  return arrIndPair;
};

// TODO: numTrial better be divisible by numStim
const calcArrIndPairSame = (numTrial, numStim) => {
  const arrIndPair = [];
  const numRepeat = Math.floor(numTrial / numStim);
  let arrInd = createArrIndsRepeat(numRepeat, numStim - 1);
  arrInd = shuffleArr(arrInd);
  for (let i = 0; i < arrInd.length; i += 1) {
    arrIndPair.push([arrInd[i], arrInd[i]]);
  }
  return arrIndPair;
};

const calcArrIndSide = (numTrial, numStim) => {
  const arrIndSide = [];
  const arrInd = calcArrInd(numTrial, numStim);
  const arrSide = calcArrSide(arrInd.length);
  for (let i = 0; i < Math.min(arrInd.length, arrSide.length); i += 1) {
    arrIndSide.push([arrInd[i], arrSide[i]]);
  }
  return arrIndSide;
};

const calcArrIndPair = (numTrialTotal, numStim) => {
  const numTrialHalf = Math.floor(numTrialTotal / 2);
  const arrIndPairSame = calcArrIndPairSame(numTrialHalf, numStim);
  const arrIndPairDiff = calcArrIndPairDiff(numTrialHalf, numStim);
  const arrIndPair = shuffleArr([...arrIndPairSame, ...arrIndPairDiff]);
  return arrIndPair;
};

export const t_createBlockCr = (paramsIn) => {
  const params = { ...paramsCreateBlockCrDef, ...paramsIn };
  params.paramsFeedbackAv ??= {};

  const arrTrials = [];

  // TODO: logic of balancing presented stimuli

  let { arrMetaparams } = params;

  if (!arrMetaparams) {
    arrMetaparams = [];

    if (params.typeTask === TypeTask.SHAPE_IDENT) {
      if (params.balanceSide && params.balanceInd) {
        const arrIndSide = calcArrIndSide(params.numTrial, params.numStim);
        if (arrIndSide.length !== params.numTrial) {
          // eslint-disable-next-line no-console
          console.log(
            `numTrial = ${params.numTrial} arrIndSide = ${arrIndSide.length}`,
          );
        } else {
          for (let iTrial = 0; iTrial < params.numTrial; iTrial += 1) {
            arrMetaparams.push({
              indTarg: arrIndSide[iTrial][0],
              _sideTarg: arrIndSide[iTrial][1],
            });
          }
        }
      }
      if (arrMetaparams.length === 0 && params.balanceSide) {
        const arrSide = calcArrSide(params.numTrial);
        if (arrSide.length !== params.numTrial) {
          // eslint-disable-next-line no-console
          console.log(
            `numTrial = ${params.numTrial} arrSide = ${arrSide.length}`,
          );
        } else {
          for (let iTrial = 0; iTrial < params.numTrial; iTrial += 1) {
            arrMetaparams.push({
              _sideTarg: arrSide[iTrial],
            });
          }
        }
      }
    } else if (params.typeTask === TypeTask.SHAPE_COMPARE_LR) {
      if (params.balanceSame && params.balanceInd) {
        const arrIndPair = calcArrIndPair(params.numTrial, params.numStim);
        if (arrIndPair.length !== params.numTrial) {
          // eslint-disable-next-line no-console
          console.log(
            `numTrial = ${params.numTrial} arrIndPairs = ${arrIndPair.length}`,
          );
        } else {
          for (let iTrial = 0; iTrial < params.numTrial; iTrial += 1) {
            const indTargL = arrIndPair[iTrial][0];
            const indTargR = arrIndPair[iTrial][1];
            arrMetaparams.push({
              indTargL: indTargL,
              indTargR: indTargR,
              _same: indTargL === indTargR ? TypeSame.SAME : TypeSame.DIFF,
            });
          }
        }
      }
      if (arrMetaparams.length === 0 && params.balanceSame) {
        const arrSame = calcArrSame(params.numTrial);
        if (arrSame.length !== params.numTrial) {
          // eslint-disable-next-line no-console
          console.log(
            `numTrial = ${params.numTrial} arrSame = ${arrSame.length}`,
          );
        } else {
          for (let iTrial = 0; iTrial < params.numTrial; iTrial += 1) {
            arrMetaparams.push({
              _same: arrSame[iTrial],
            });
          }
        }
      }
    }
    // fallback
    if (arrMetaparams.length === 0) {
      for (let iTrial = 0; iTrial < params.numTrial; iTrial += 1) {
        arrMetaparams.push({});
      }
    }
  }

  arrTrials.push({
    type: jsPsychCallFunction,
    func: () => {
      resetIndsCntsCorr(params.resetBlock, params.resetGlobal);
      sessionSet(SK.NUM_TRIAL, arrMetaparams.length);
    },
  });

  let info = {};
  if (params.nameBlock) {
    info = {
      nameBlock: params.nameBlock,
    };
  }

  for (let iTrial = 0; iTrial < arrMetaparams.length; iTrial += 1) {
    arrTrials.push(
      t_cr(
        {
          metaparams: arrMetaparams[iTrial],
          info,
        },
        params.tagReqCr,
      ),
    );
    if (params.playFeedbackAv) {
      arrTrials.push(
        t_feedbackAudioVisual(params.paramsFeedbackAv, params.tagReqFeedbackAv),
      );
    }
  }

  return {
    timeline: arrTrials,
    conditional_function: () => sessionGet(SK.ENABLE_TRIALS),
  };
};
