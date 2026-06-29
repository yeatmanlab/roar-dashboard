// Used in Math and Matrix-reasoning so far
import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import _isUndefined from 'lodash/isUndefined';
import _toNumber from 'lodash/toNumber';
import i18next from 'i18next';
import { camelize } from './camelize';
import { TaskStoreDataType } from '../../../taskStore';
import { getAge } from './getAge';
import { parseNumberParam } from './parseParam';
import { CLOWDER_CONFIG } from './clowderSetup';
import {
  writeTrial,
  finishRun as sdkFinishRun,
  updateEngagementFlags,
} from '@roar-platform/assessment-sdk/compat/firekit';

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

// Default corpus per task (camelCase task name). Used when variantParams.corpus is absent.
// NOTE: hostileAttribution and childSurvey are not yet seeded in the ROAR backend
// (no task or variant records exist). Selecting either task via ?task= or ?variantId=
// will fail at the backend lookup step until seeds/roar-levante-tasks.seed.ts is extended.
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

  // SDK-backed firekit shim — keeps existing call sites in trialSaving.ts,
  // recordCompletion.ts, and taskReliability.ts unchanged.
  let _runFinished = false;
  const firekitShim = {
    run: {
      started: true,
      get completed() {
        return _runFinished;
      },
    },
    writeTrial,
    finishRun: async (metadata?: Record<string, unknown>) => {
      if (!_runFinished) {
        _runFinished = true;
        await sdkFinishRun(metadata);
      }
    },
    updateEngagementFlags,
    updateTaskParams: async () => {},
  };

  const config = {
    userMetadata: { ...userMetadata, grade, age: Number(age) || getAge(Number(birthMonth), Number(birthYear)) },
    audioFeedback: audioFeedback || 'neutral',
    skipInstructions: !!skipInstructions, // Not used in any task
    startTime: new Date(),
    firekit: firekitShim,
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
    isRoarApp: true,

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

  return config;
};
