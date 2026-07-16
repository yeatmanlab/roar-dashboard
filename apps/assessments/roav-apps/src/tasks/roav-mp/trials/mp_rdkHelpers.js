import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { t_feedbackAudioVisual } from '../../shared/trials/feedbackAudioVisual';
import { t_rdk } from './mp_rdk';
import { sessionGet, sessionSet } from '../../shared/helpers/sessionHelpers';
import { SubtypeTrial, ModeSeq } from '../../shared/helpers/namingHelpers';
import { COHERENCE } from '../helpers/mp_constants';
import { MP_SESSION_KEYS as SK } from '../helpers/mp_sessionKeys';

// parameters for t_setParamsBlockRdk are expected in following format
// {
//   metaparams: {},
//   info: {},
//   reset: true,
// };

export const t_setParamsBlockRdk = (paramsIn) => {
  const reset = paramsIn.reset ?? true;

  return {
    timeline: [
      {
        type: jsPsychCallFunction,
        func: () => {
          sessionSet(SK.RDK_METAPARAMS_BLOCK, paramsIn.metaparams);
          sessionSet(SK.RDK_INFO_BLOCK, paramsIn.info);
          if (reset) {
            sessionSet(SK.IND_TRIAL, 0);
            sessionSet(SK.RDK_RESPONSE_LAST, null);
            sessionSet(SK.DATA_CORRECT, undefined);
          }
        },
      },
    ],
    conditional_function: () => sessionGet(SK.ENABLE_TRIALS),
  };
};

const paramsDefCreateBlockRdk = {
  playFeedbackAv: false,
  modeSeq: ModeSeq.RANDOM,
  arrMetaparams: [
    { _subtype_trial: SubtypeTrial.CONST, coherence: COHERENCE.COH_96 },
    {},
    {},
    { _subtype_trial: SubtypeTrial.CONST, coherence: COHERENCE.COH_48 },
    {},
    {},
    { _subtype_trial: SubtypeTrial.CONST, coherence: COHERENCE.COH_24 },
    {},
    {},
    { _subtype_trial: SubtypeTrial.CATCH, coherence: COHERENCE.CATCH },
    { _subtype_trial: SubtypeTrial.CONST, coherence: COHERENCE.COH_12 },
    {},
    {},
    { _subtype_trial: SubtypeTrial.CONST, coherence: COHERENCE.COH_06 },
    {},
    {},
    { _subtype_trial: SubtypeTrial.CATCH, coherence: COHERENCE.CATCH },
  ],
};

export const t_createBlockRdk = (paramsIn) => {
  const params = { ...paramsDefCreateBlockRdk, ...paramsIn };
  if (!params.arrMetaparams) {
    params.modeSeq = ModeSeq.RANDOM;
    params.arrMetaparams = paramsDefCreateBlockRdk.arrMetaparams;
  }
  params.paramsFeedbackAv ??= {};
  const arrTrials = [];

  const { arrMetaparams } = params; // let arrMetaparams = params.arrMetaparams;

  for (let iTrial = 0; iTrial < arrMetaparams.length; iTrial += 1) {
    arrTrials.push(t_rdk({ metaparams: arrMetaparams[iTrial] }));
    if (params.playFeedbackAv) {
      arrTrials.push(t_feedbackAudioVisual(params.paramsFeedbackAv));
    }
  }

  return {
    timeline: arrTrials,
    conditional_function: () => {
      const modeSeqIn = paramsIn.modeSeq ?? paramsDefCreateBlockRdk.modeSeq;
      const modeSeq = sessionGet(SK.MODE_SEQ);
      const enableTrials = sessionGet(SK.ENABLE_TRIALS);
      return enableTrials && (modeSeqIn === modeSeq || modeSeqIn === ModeSeq.ALL);
    },
  };
};
