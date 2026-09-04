import {
  convertItemToString,
  validateLayoutConfig,
  prepareChoices,
  DEFAULT_LAYOUT_CONFIG,
  mapDistractorsToString,
  fractionToMathML,
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
  const stimItem = convertItemToString(stimulus.item);
  defaultConfig.isPracticeTrial = stimulus.assessmentStage === 'practice_response';
  defaultConfig.isInstructionTrial = stimulus.trialType === 'instructions';
  defaultConfig.showStimImage = false;
  defaultConfig.stimText = {
    value: stimItem,
    displayValue: undefined,
  };
  defaultConfig.classOverrides.buttonClassList = ['secondary--wide'];
  defaultConfig.isStaggered = true;
  const mappedDistractors = mapDistractorsToString(distractors);
  defaultConfig.prompt.enabled = true;
  defaultConfig.isImageButtonResponse = false;
  defaultConfig.response = {
    target: '',
    displayValues: mappedDistractors,
    values: mappedDistractors,
    targetIndex: 0,
  };

  const messages = validateLayoutConfig(defaultConfig, mediaAssets, translations, stimulus);

  return {
    itemConfig: defaultConfig,
    errorMessages: messages,
  };
};
