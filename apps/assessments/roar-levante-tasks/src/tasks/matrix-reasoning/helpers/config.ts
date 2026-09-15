import {
  convertItemToString,
  validateLayoutConfig,
  prepareChoices,
  DEFAULT_LAYOUT_CONFIG,
  mapDistractorsToString,
} from '../../shared/helpers';

type GetConfigReturnType = {
  itemConfig: LayoutConfigType;
  errorMessages: string[];
};

export const getLayoutConfig = (
  stimulus: StimulusType,
  translations: Record<string, string>,
  mediaAssets: MediaAssetsType,
  trialNumber: number,
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
    defaultConfig.classOverrides.buttonClassList = ['image-matrix'];
    const mappedDistractors = mapDistractorsToString(distractors);
    const prepChoices = prepareChoices(answer.toString(), mappedDistractors, 'yes', trialType);
    defaultConfig.isImageButtonResponse = true;
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
