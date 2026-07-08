/* eslint-disable no-underscore-dangle */
import { ValidityEvaluator, createEvaluateValidity } from '@bdelab/roar-utils';
import { sessionSet } from '../helpers/sessionHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';
import { wrapAsJsPsychTrial } from '../helpers/jspsychHelpers';

const validationFlagsHandler = {
  updateEngagementFlags: null,
};

export const initValidationFlagsHandler = (config) => {
  validationFlagsHandler.updateEngagementFlags = (flags, reliable) => {
    if (config.firekit.run.started) {
      return config.firekit.updateEngagementFlags(flags, reliable);
    }
    return null;
  };
};

let validityEvaluator = null;
export const getValidityEvaluator = () => validityEvaluator;

export const paramsValidityDef = {
  responseTimeLowThreshold: 200,
  accuracyThreshold: 0.5,
  minResponsesRequired: 3,
  includedReliabilityFlags: ['responseTimeTooFast', 'accuracyTooLow'],
};

export const t_createValidityEvaluator = (paramsIn = {}) =>
  wrapAsJsPsychTrial(() => {
    const params = { ...paramsValidityDef, ...paramsIn };
    const evaluateValidity = createEvaluateValidity(params);
    validityEvaluator = new ValidityEvaluator({
      evaluateValidity: evaluateValidity,
      handleEngagementFlags: validationFlagsHandler.updateEngagementFlags,
    });
  });

export const t_startNewBlockValidation = (nameBlock) =>
  wrapAsJsPsychTrial(() => validityEvaluator.startNewBlockValidation(nameBlock));

export const t_markAsCompletedValidation = () =>
  wrapAsJsPsychTrial(() => {
    validityEvaluator.calculateAndUpdateFlags();
    validityEvaluator.markAsCompleted();
  });

export const t_setEnableTrialsByValidation = (passedValidation, flagEnable) =>
  wrapAsJsPsychTrial(() => {
    if (validityEvaluator) {
      const { flags } = validityEvaluator.evaluateValidity({
        responseTimes: validityEvaluator._responseTimes,
        responses: validityEvaluator._responses,
        correct: validityEvaluator._correct,
        completed: validityEvaluator.completed,
      });
      if ((passedValidation && flags.length === 0) || (!passedValidation && flags.length > 0)) {
        sessionSet(SK.ENABLE_TRIALS, flagEnable);
      }
    }
  });

export const t_setEnableTrialsIfValidationPassed = (flagEnable) => t_setEnableTrialsByValidation(true, flagEnable);

export const t_setEnableTrialsIfValidationFailed = (flagEnable) => t_setEnableTrialsByValidation(false, flagEnable);
