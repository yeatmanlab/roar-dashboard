import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { merge } from 'lodash';
import { t_feedbackAudioVisual } from '../../shared/trials/feedbackAudioVisual';
import { SubtypeTrialRvp, t_rvp } from './rvp_rvpTrial';
import { sessionGet, sessionSet } from '../../shared/helpers/sessionHelpers';
import { RVP_SESSION_KEYS as SK } from '../helpers/rvp_sessionKeys';
import { AssessmentStage, ModeAdaptBlock, ModeGame, TAG_REQ_DEF } from '../../shared/helpers/namingHelpers';
import { createArrIndsRepeat, shuffleArr } from '../../shared/helpers/orderHelpers';
import { wrapAsJsPsychTrial } from '../../shared/helpers/jspsychHelpers';
import { calcThetaFromProbDifficultyMean, calcThetaRaw } from './rvp_catHelpers';
import { t_instructionGeneral } from '../../shared/trials/instructionGeneral';
import { t_setEnableTrials } from '../../shared/trials/flowHelpers';

const calcIndBlockAdapt = (indBlockReq) => {
  if (indBlockReq === 0) {
    return {
      indBlockAdapt: 0,
      cntBlockRepeat: 0,
    };
  }
  const configBlock = sessionGet(SK.CONFIG_BLOCK);
  const { perfAdaptBlock, numRepeatBlockMax } = configBlock;
  const modeAdaptBlock = sessionGet(SK.MODE_ADAPT_BLOCK);
  const arrMetparamsConfig = configBlock.arrMetaparams;

  if (modeAdaptBlock === ModeAdaptBlock.NONE) {
    return {
      indBlockAdapt: indBlockReq,
      cntBlockRepeat: 0,
    };
  }
  const typeStimReq = arrMetparamsConfig[indBlockReq].typeStim;
  const typeStimPrev = arrMetparamsConfig[indBlockReq - 1].typeStim;
  if (typeStimReq !== typeStimPrev) {
    return {
      indBlockAdapt: indBlockReq,
      cntBlockRepeat: 0,
    };
  }

  const indBlockAdapt = sessionGet(SK.IND_BLOCK_ADAPT);
  const cntBlockRepeat = sessionGet(SK.CNT_BLOCK_REPEAT);

  let requestRepeat = false;
  if (modeAdaptBlock === ModeAdaptBlock.ADAPT_ACC) {
    const cntCorr = sessionGet(SK.CNT_CORR);
    const numTrial = sessionGet(SK.NUM_TRIAL);
    const acc = numTrial > 0 ? cntCorr / numTrial : 1;

    requestRepeat = acc < perfAdaptBlock;
  } else if (modeAdaptBlock === ModeAdaptBlock.ADAPT_IRT) {
    const thetaRawCur = calcThetaRaw(typeStimReq);
    const numStimAdaptNext = configBlock.arrMetaparams[indBlockAdapt + 1].numStim;
    const thetaAdvanceMin = calcThetaFromProbDifficultyMean(perfAdaptBlock, typeStimReq, numStimAdaptNext);
    requestRepeat = thetaRawCur < thetaAdvanceMin;
  }

  if (!requestRepeat) {
    return {
      indBlockAdapt: indBlockAdapt + 1,
      cntBlockRepeat: 0,
    };
  }

  if (cntBlockRepeat >= numRepeatBlockMax) {
    return {
      indBlockAdapt: -1,
      cntBlockRepeat: 0,
    };
  }
  return {
    indBlockAdapt: indBlockAdapt,
    cntBlockRepeat: cntBlockRepeat + 1,
  };
};

const paramsSetParamsBlockRvpDef = {
  metaparams: {},
  info: {},
};

const setParamsBlockRvp = (paramsIn) => {
  const params = { ...paramsSetParamsBlockRvpDef, ...paramsIn };
  sessionSet(SK.RVP_METAPARAMS_BLOCK, params.metaparams);
  sessionSet(SK.RVP_INFO_BLOCK, params.info);
  sessionSet(SK.DATA_CORRECT, undefined);
};

export const t_setParamsBlockRvp = (paramsIn) => ({
  timeline: [wrapAsJsPsychTrial(() => setParamsBlockRvp(paramsIn))],
  conditional_function: () => sessionGet(SK.ENABLE_TRIALS),
});

const paramsCreateBlockRvpDef = {
  playFeedbackAv: false,
  numStim: 4,
  numTrial: 12,
  tagReqRvp: TAG_REQ_DEF,
  tagReqFeedbackAv: TAG_REQ_DEF,
  paramsFeedbackAv: undefined,
  arrMetaparams: undefined,
  nameBlock: undefined,

  resetLocal: true,
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

const calcArrPos = (numTrial, numStim) => {
  const numRepeat = Math.floor(numTrial / numStim);
  const posMax = numStim - 1;
  let arrPos = createArrIndsRepeat(numRepeat, posMax);
  arrPos = shuffleArr(arrPos);
  return arrPos;
};

export const t_createBlockRvp = (paramsIn) => {
  const params = { ...paramsCreateBlockRvpDef, ...paramsIn };
  params.paramsFeedbackAv ??= {};

  const arrTrials = [];

  let { arrMetaparams } = params;

  if (!arrMetaparams) {
    arrMetaparams = [];
    const arrPos = calcArrPos(params.numTrial, params.numStim);
    for (let iTrial = 0; iTrial < arrPos.length; iTrial += 1) {
      arrMetaparams.push({
        numStim: params.numStim,
        posTarg: arrPos[iTrial],
      });
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
      t_rvp(
        {
          metaparams: arrMetaparams[iTrial],
          info,
        },
        params.tagReqRvp,
      ),
    );
    if (params.playFeedbackAv) {
      arrTrials.push(t_feedbackAudioVisual(params.paramsFeedbackAv, params.tagReqFeedbackAv));
    }
  }

  return {
    timeline: arrTrials,
    conditional_function: () => sessionGet(SK.ENABLE_TRIALS),
  };
};

export const t_setIndBlockRvpAdapt = (indBlockReq) => ({
  type: jsPsychCallFunction,
  func: () => {
    const { indBlockAdapt, cntBlockRepeat } = calcIndBlockAdapt(indBlockReq);
    sessionSet(SK.IND_BLOCK, indBlockReq);
    sessionSet(SK.IND_BLOCK_ADAPT, indBlockAdapt);
    sessionSet(SK.CNT_BLOCK_REPEAT, cntBlockRepeat);
  },
});

export const t_setEnableTrialsByExistBlockRvpAdapt = ({ flagBlock, flagEnable }) => ({
  type: jsPsychCallFunction,
  func: () => {
    const indBlockAdapt = sessionGet(SK.IND_BLOCK_ADAPT);
    const enableBlock = indBlockAdapt >= 0;
    if (enableBlock === flagBlock) {
      sessionSet(SK.ENABLE_TRIALS, flagEnable);
    }
  },
});

export const t_setcreateBlockRvpAdaptExtra = () => {
  const configBlock = sessionGet(SK.CONFIG_BLOCK);
  const numTrial = configBlock.numTrialExtra ?? 0;
  const durationStim = configBlock.durationStimExtra ?? 0;

  if (numTrial <= 0) {
    return {
      timeline: [],
    };
  }
  const arrTrials = [];
  for (let iTrial = 0; iTrial < numTrial; iTrial += 1) {
    arrTrials.push(
      t_rvp({
        metaparams: {
          adaptive: true,
          numStim: 2,
          posStim: 0,
        },
      }),
    );
  }

  const setParamsBlock = () => ({
    type: jsPsychCallFunction,
    func: () => {
      const indBlock = sessionGet(SK.IND_BLOCK);
      const indBlockAdapt = sessionGet(SK.IND_BLOCK_ADAPT);
      const metaparamsBlock = configBlock.arrMetaparams[indBlockAdapt];
      setParamsBlockRvp({
        metaparams: {
          ...metaparamsBlock,
          durationStim: durationStim,
          subtypeTrial: SubtypeTrialRvp.EXTRA,
        },
        info: {
          // evaluateValidity: false,
          stageAssessment: AssessmentStage.TEST,
          nameBlock: `block-extra-${indBlock}-${metaparamsBlock.typeStim}-${metaparamsBlock.numStim}`,
          showLog: false,
        },
      });
      const arrMetaparamsTrialAdapt = [];
      for (let iTrial = 0; iTrial < numTrial; iTrial += 1) {
        arrMetaparamsTrialAdapt.push({
          enabled: true,
          numStim: metaparamsBlock.numStim,
          posTarg: Math.floor(Math.random() * metaparamsBlock.numStim),
        });
      }
      sessionSet(SK.RVP_ARR_METAPARAMS_TRIAL, arrMetaparamsTrialAdapt);
      resetIndsCntsCorr(true, indBlock === 0);
      sessionSet(SK.NUM_TRIAL, numTrial);
    },
  });

  return {
    timeline: [setParamsBlock(), ...arrTrials],
    conditional_function: () => {
      const indBlockAdapt = sessionGet(SK.IND_BLOCK_ADAPT);
      return sessionGet(SK.ENABLE_TRIALS) && indBlockAdapt >= 0;
    },
  };
};

export const t_setcreateBlockRvpAdaptTest = () => {
  const configBlock = sessionGet(SK.CONFIG_BLOCK);
  const arrTrials = [];
  const numTrial = configBlock.numTrialBlock;
  for (let iTrial = 0; iTrial < numTrial; iTrial += 1) {
    arrTrials.push(
      t_rvp({
        metaparams: {
          adaptive: true,
          numStim: 2,
          posStim: 0,
        },
      }),
    );
  }

  const setParamsBlock = () => ({
    type: jsPsychCallFunction,
    func: () => {
      const indBlock = sessionGet(SK.IND_BLOCK);
      const indBlockAdapt = sessionGet(SK.IND_BLOCK_ADAPT);
      const metaparamsBlock = configBlock.arrMetaparams[indBlockAdapt];
      const infoBlock = {
        stageAssessment: AssessmentStage.TEST,
        nameBlock: `block-${indBlock}-${metaparamsBlock.typeStim}-${metaparamsBlock.numStim}`,
        showLog: false,
      };
      setParamsBlockRvp({
        metaparams: metaparamsBlock,
        info: infoBlock,
      });
      const arrPos = calcArrPos(configBlock.numTrialBlock, metaparamsBlock.numStim);
      const arrMetaparamsTrialAdapt = [];
      for (let iTrial = 0; iTrial < numTrial; iTrial += 1) {
        arrMetaparamsTrialAdapt.push({
          enabled: iTrial < arrPos.length,
          numStim: metaparamsBlock.numStim,
          posTarg: arrPos[iTrial],
        });
      }
      sessionSet(SK.RVP_ARR_METAPARAMS_TRIAL, arrMetaparamsTrialAdapt);
      resetIndsCntsCorr(true, indBlock === 0);
      sessionSet(SK.NUM_TRIAL, numTrial);
    },
  });

  return {
    timeline: [setParamsBlock(), ...arrTrials],
    conditional_function: () => {
      const indBlockAdapt = sessionGet(SK.IND_BLOCK_ADAPT);
      return indBlockAdapt >= 0 && sessionGet(SK.ENABLE_TRIALS);
    },
  };
};

const paramsSetcreateBlockRvpAdaptDef = {
  indBlockReq: 0,
  paramsInstrBefore: {
    modeGameSkipResponse: ModeGame.ALL,
  },
  tagReqInstrBefore: 'test-keep-going',
  paramsInstrExtra: {
    keyImgCharacter: ['', '', 'warn-fast'],
    modeGameSkipResponse: ModeGame.ALL,
  },
  tagReqInstrExtra: 'test-warn-fast-short',
};

export const t_setcreateBlockRvpAdapt = (paramsIn) => {
  // const params = {...paramsSetcreateBlockRvpAdaptDef, ...paramsIn}
  const params = merge({}, paramsSetcreateBlockRvpAdaptDef, paramsIn);

  const arrTrials = [];

  arrTrials.push(t_setIndBlockRvpAdapt(params.indBlockReq));
  arrTrials.push(
    t_setEnableTrialsByExistBlockRvpAdapt({
      flagBlock: false,
      flagEnable: false,
    }),
  );
  if (params.tagReqInstrBefore) {
    arrTrials.push(t_instructionGeneral(params.paramsInstrBefore, params.tagReqInstrBefore));
  }
  arrTrials.push(t_setcreateBlockRvpAdaptExtra());
  if (params.tagReqInstrExtra) {
    arrTrials.push(t_instructionGeneral(params.paramsInstrExtra, params.tagReqInstrExtra));
  }
  arrTrials.push(t_setcreateBlockRvpAdaptTest());
  arrTrials.push(t_setEnableTrials());
  return {
    timeline: arrTrials,
    conditional_function: () => sessionGet(SK.ENABLE_TRIALS),
  };
};
