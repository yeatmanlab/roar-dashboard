// Used in Math and Matrix-reasoning so far
import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import _isUndefined from 'lodash/isUndefined';
import _toNumber from 'lodash/toNumber';
import i18next from 'i18next';
import { isRoarApp } from './isRoarApp';
import { camelize } from './camelize';
import { RoarAppkit } from '@bdelab/roar-firekit';
import { TaskStoreDataType } from '../../../taskStore';
import { getAge } from './getAge';
import { parseNumberParam } from './parseParam';
import { CLOWDER_CONFIG } from './clowderSetup';

export const DEFAULT_LAYOUT_CONFIG: LayoutConfigType = {
  playAudioOnLoad: true,
  staggered: {
    enabled: false,
    trialTypes: [],
  },
  classOverrides: {
    buttonContainerClassList: ['lev-response-row', 'multi-4'],
    buttonClassList: ['image'],
    promptClassList: ['lev-row-container', 'instruction'],
    stimulusContainerClassList: ['lev-stim-content-x-3'],
  },
  prompt: {
    enabled: true,
    aboveStimulus: true,
  },
  equalSizeStim: false,
  disableButtonsWhenAudioPlaying: false,
  isPracticeTrial: false,
  isInstructionTrial: false,
  randomizeChoiceOrder: false,
  isStaggered: false,
  isImageButtonResponse: false,
  showStimImage: true,
  response: {
    target: '',
    displayValues: ['OK'],
    values: ['OK'],
    targetIndex: 0,
  },
  inCorrectTrialConfig: {
    onIncorrectTrial: 'end',
  },
  disableOkButton: false,
};

const defaultCorpus: Record<string, string> = {
  egmaMath: 'math-item-bank',
  matrixReasoning: 'matrix-reasoning-item-bank',
  mentalRotation: 'mental-rotation-item-bank',
  sameDifferentSelection: 'same-different-selection-item-bank',
  trog: 'roar-syntax-item-2026-05-14-v3',
  theoryOfMind: 'theory-of-mind-item-bank',
  vocab: 'vocab-item-bank',
  roarInference: 'inference-2026-05-14-v3',
  adultReasoning: 'adult-reasoning-item-bank',
  hostileAttribution: 'hostile-attribution-item-bank',
  childSurvey: 'child-survey-item-bank',
};

export const setSharedConfig = async (
  firekit: RoarAppkit,
  gameParams: GameParamsType,
  userParams: UserParamsType,
): Promise<TaskStoreDataType> => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);

  const {
    userMetadata = {},
    birthMonth,
    birthYear,
    audioFeedback,
    language,
    skipInstructions,
    sequentialPractice,
    sequentialStimulus,
    corpus,
    buttonLayout,
    numberOfTrials,
    taskName,
    stimulusBlocks,
    numOfPracticeTrials,
    maxIncorrect,
    keyHelpers,
    age,
    maxTime, // maximum app duration in minutes
    storeItemId,
    cat,
    heavyInstructions,
    experimenterButtons,
    inferenceNumStories,
    numberOfStories,
    semThreshold,
    startingTheta,
    storyOption,
    grade,
    demoMode,
    debug,
    version,
    taskVersion, // deprecated; use `version` — kept for backward compatibility
    isPaused,
    scoringVersion,
    randomSeed,
  } = cleanParams;

  const numScoringVersion = Number(scoringVersion);

  const config = {
    userMetadata: { ...userMetadata, grade, age: Number(age) || getAge(Number(birthMonth), Number(birthYear)) },
    audioFeedback: audioFeedback || 'neutral',
    skipInstructions: !!skipInstructions, // Not used in any task
    startTime: new Date(),
    firekit,
    sequentialPractice: sequentialPractice ?? true,
    sequentialStimulus: sequentialStimulus ?? true,
    // name of the csv files in the storage bucket
    corpus: corpus,
    buttonLayout: buttonLayout || 'default',
    numberOfTrials: numberOfTrials ?? 300,
    task: taskName ?? 'egma-math',
    stimulusBlocks: Number(stimulusBlocks) || 1,
    numOfPracticeTrials: Number(numOfPracticeTrials) || 2,
    maxIncorrect: Number(maxIncorrect) || 3,
    keyHelpers: !!keyHelpers,
    language: language ?? i18next.language,
    maxTime: Number(maxTime) || 100,
    storeItemId: !!storeItemId,
    isRoarApp: isRoarApp(firekit),

    cat: !!cat, // defaults to false
    heavyInstructions: !!heavyInstructions,
    experimenterButtons: !!experimenterButtons,
    inferenceNumStories: parseNumberParam(inferenceNumStories, 33),
    numberOfStories: Number(numberOfStories) || 3,
    semThreshold: Number(semThreshold),
    startingTheta: Number(startingTheta),
    storyOption,
    demoMode: false,
    debug: !!debug,
    version: Number((version ?? taskVersion) || 1),
    displayPromptDurations: {},
    taskTimer: null,
    isPaused: false,
    // Default to normed for clowder tasks. Pass scoringVersion=0 to use unnormed
    scoringVersion:
      scoringVersion != null && !isNaN(numScoringVersion) ? numScoringVersion : CLOWDER_CONFIG[taskName] ? 1 : 0,
    randomSeed,
  };

  // default corpus if nothing is passed in
  if (!config.corpus) {
    config.corpus = defaultCorpus[camelize(taskName)];
  }

  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [key, config[key as keyof typeof config] ?? value]),
  );

  await config.firekit.updateTaskParams(updatedGameParams);

  return config;
};
