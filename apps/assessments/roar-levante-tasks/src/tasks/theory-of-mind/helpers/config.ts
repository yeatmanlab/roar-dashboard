import {
  convertItemToString,
  validateLayoutConfig,
  prepareChoices,
  DEFAULT_LAYOUT_CONFIG,
  mapDistractorsToString,
} from '../../shared/helpers';
import { taskStore } from '../../../taskStore';

type GetConfigReturnType = {
  itemConfig: LayoutConfigType;
  errorMessages: string[];
};

const fillerTrialIds = ['ToM-intro', 'ToM-transition'];

export const getLayoutConfig = (
  stimulus: StimulusType,
  translations: Record<string, string>,
  mediaAssets: MediaAssetsType,
): GetConfigReturnType => {
  const { answer, distractors, trialType } = stimulus;
  const defaultConfig: LayoutConfigType = JSON.parse(JSON.stringify(DEFAULT_LAYOUT_CONFIG));
  defaultConfig.isPracticeTrial = stimulus.assessmentStage === 'practice_response';
  defaultConfig.isInstructionTrial = stimulus.trialType === 'instructions';
  defaultConfig.stimText = {
    value: convertItemToString(stimulus.item),
    displayValue: undefined,
  };
  defaultConfig.classOverrides.promptClassList = ['lev-row-container', 'instruction-small'];
  if (!defaultConfig.isInstructionTrial) {
    const mappedDistractors = mapDistractorsToString(distractors);
    const prepChoices = prepareChoices(answer.toString(), mappedDistractors, stimulus.randomize, trialType);
    defaultConfig.isStaggered = true;
    defaultConfig.isImageButtonResponse = true;
    defaultConfig.response = {
      target: prepChoices.target,
      displayValues: prepChoices.choices,
      values: prepChoices.originalChoices,
      targetIndex: prepChoices.correctResponseIdx,
    };
  } else {
    defaultConfig.classOverrides.buttonClassList = ['primary'];
    defaultConfig.disableOkButton = true;
  }

  defaultConfig.blockedTrials = taskStore().version === 2 && !fillerTrialIds.includes(stimulus.itemId);

  const messages = validateLayoutConfig(defaultConfig, mediaAssets, translations, stimulus);

  return {
    itemConfig: defaultConfig,
    errorMessages: messages,
  };
};
