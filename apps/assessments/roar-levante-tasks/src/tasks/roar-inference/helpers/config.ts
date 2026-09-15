import {
  convertItemToString,
  validateLayoutConfig,
  prepareChoices,
  DEFAULT_LAYOUT_CONFIG,
  mapDistractorsToString,
} from '../../shared/helpers';
import type { LayoutConfigTypeInference } from '../types/inferenceTypes';

type GetConfigReturnType = {
  itemConfig: LayoutConfigTypeInference;
  errorMessages: string[];
};

export const getLayoutConfig = (
  stimulus: StimulusType,
  translations: Record<string, string>,
  mediaAssets: MediaAssetsType,
  trialNumber: number,
): GetConfigReturnType => {
  const { answer, distractors, trialType } = stimulus;
  const defaultConfig: LayoutConfigTypeInference = JSON.parse(JSON.stringify(DEFAULT_LAYOUT_CONFIG));
  defaultConfig.playAudioOnLoad = false;
  defaultConfig.isPracticeTrial = stimulus.assessmentStage === 'practice_response';
  defaultConfig.classOverrides.buttonContainerClassList = ['lev-response-row', 'multi-stack'];
  defaultConfig.isInstructionTrial = stimulus.trialType === 'instructions';
  defaultConfig.prompt.enabled = true;
  defaultConfig.prompt.useStimText = true;
  defaultConfig.stimText = {
    value: stimulus.prompt,
    displayValue: undefined,
  };
  defaultConfig.classOverrides.stimulusContainerClassList = ['inference-scroll'];
  defaultConfig.disableButtonsWhenAudioPlaying = true;
  if (!defaultConfig.isInstructionTrial) {
    const mappedDistractors = mapDistractorsToString(distractors);
    const prepChoices = prepareChoices(answer.toString(), mappedDistractors, 'yes', trialType);
    defaultConfig.isImageButtonResponse = false;
    defaultConfig.classOverrides.buttonClassList = ['roar-inference-btn'];
    defaultConfig.response = {
      target: prepChoices.target,
      displayValues: prepChoices.choices,
      values: prepChoices.originalChoices,
      targetIndex: prepChoices.correctResponseIdx,
    };
  } else {
    defaultConfig.classOverrides.buttonClassList = ['primary'];
  }

  const messages = validateLayoutConfig(defaultConfig, mediaAssets, translations, stimulus);

  return {
    itemConfig: defaultConfig,
    errorMessages: messages,
  };
};
