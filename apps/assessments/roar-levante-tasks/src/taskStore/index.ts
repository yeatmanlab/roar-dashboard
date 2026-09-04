import store from 'store2';
import { stringToBoolean, isEnglish } from '../tasks/shared/helpers';
import { InputCapability } from '../utils/detectInput';

/**
 * @typedef {Object} TaskStore
 * @property {string} itemSelect - Identifier for the selected item, default is 'mfi'. Options include: ['mfi', 'random'].
 * @property {number} trialNumSubtask - Counter for trials in the current subtask, starting at 0.
 * @property {number} testTrialCount - Counter for test trials run, starting at 0.
 * @property {number} numIncorrect - Counter for incorrect responses, starting at 0.
 * @property {number} totalCorrect - Counter for total correct trials, starting at 0.
 * @property {Array} correctItems - List of correct items, starting as an empty array.
 * @property {string} audioFeedback - Audio feedback to use, default is 'neutral'.
 * @property {boolean} skipInstructions - Whether to skip instructions, default is true.
 * @property {string} corpusId - Name of the corpus file.
 * @property {string} buttonLayout - Layout of the buttons, default is 'default'.
 * @property {string} task - Name of the task, default is 'egma-math'.
 * @property {number} maxIncorrect - Maximum number of incorrect trials, default is 3.
 * @property {boolean} keyHelpers - Whether to use keyboard helpers, default is true.
 * @property {boolean} runCat - Whether to run task adaptively as a CAT, default is false
 * @property {boolean} heavyInstructions - Whether to start with heavy instructions for younger kids
 * @property {boolean} storeItemId - Whether to store the item ID, default is false.
 * @property {boolean} isRoarApp - Whether the app is running in ROAR mode, default is false.
 * @property {boolean} maxTimeReached - Whether the max time has been reached, default is false.
 * @property {number} maxTime - Time limit set for the task.
 * @property {number} startTime - Time at which the task started.
 * @property {boolean} taskComplete - Whether the task has ended - if true, the user should return to dashboard.
 * @property {Object} assetsPerTask - Object containing list of assets belonging to each task.
 * @property {boolean} demoMode - Whether the task is running in demo mode (no interaction with Firestore), default is false.
 * @property {boolean} debug - Shows theta estimate on the screen for cat debugging when enabled.
 * @property {boolean} experimenterButtons - When true, experimenter utility controls (pause, exit) are available.
 * @property {number} currentCatBlock - The current block number to select trials from in a CAT.
 * @property {number[]} blockThresholds - Array of theta thresholds.
 * @property {number} totalTrialCount - Total number of trials, including practice and instructions.
 * ------- Added after config is parsed -------
 * @property {number} totalTrials - Total number trials, including practice and instructions.
 * @property {number} totalTestTrials - Total number of test trials in the experiment timeline.
 * @property {Object} corpora - Object containing the corpus data (stimulus).
 * @property {Object} translations - Object containing the translations.
 * @property {Object} nextStimulus - Object containing the next stimulus.
 * @property {boolean} testPhase - True if not running practice/instruction trial
 * @property {any} taskTimer - The timer ID for the task, stored here so the task can be paused.
 * @property {number} taskTimerPausedMs - Cumulative ms excluded from max-time while experimenter pause is active.
 * @property {number|null} taskTimerPauseBeganAt - Wall time when the current experimenter pause began, or null.
 * @property {boolean} isPaused - Whether the task is paused, default is false.
 * ------- AFC and SDS only -------
 * @property {string} target - Target item.
 * @property {Array} choices - List of choices.
 * ------- AFC only -------
 * @property {boolean} skipCurrentTrial - Whether to skip the current trial, default is false.
 * @property {number} correctResponseIdx - Index of the correct response, starting at 0.
 * @property {number} incorrectPracticeResponses - Number of incorrect responses to the current practice trial.
 * ------- Math only -------
 * @property {Array} nonFractionSelections - List of non-fraction selections.
 * @property {number} trialsSkipped - Number of trials that have been skipped while jumping to the next block.
 * ------- H&F only -------
 * @property {string} stimulus - Name of the stimulus, default is 'heart'.
 * @property {string} stimulusSide - Side of the stimulus, default is 'left'.
 * @property {number} stimulusPosition - Position of the stimulus, default is 0.
 * ------- Memory Game only -------
 * @property {number} numOfBlocks - Number of blocks in the memory game, default is 4.
 * @property {number} blockSize - Size of each block in the memory game, default is 50.
 * @property {number} gridSize - Size of the grid in the memory game, default is 2x2.
 * @property {Object} displayPromptDurations - The durations of the display prompts, default is an empty object.
 * ------- H&F & Memory Game only -------
 * @property {boolean} isCorrect - Whether the response to the previous trial was correct, default is false.
 * @property {boolean} story - Whether the task should be run with story mode, defaults to grade-based but can be override by setting it to true/false
 * ------- H&F only -------
 * @property {Object} inputCapability - Object containing the input capability of the user's device.
 * --------- ToM only ---------
 * @property {Array} previousChoices - Array containing previously randomized order of choices for the current block.
 * @property {number} currentStoryGroup - The current story group to select trials from in the ToM CAT.
 * ------- SDS only -------
 * @property {StimulusType[]} sequentialTrials - Should be run sequentially in blocks by trial number in an SDS CAT.
 * @property {number} version - A version number for the task, default is 1. Can be used as a feature flag.
 * -------- ROAR Clowder only -------
 * @property {string} previousItem - The previous item of the task. Default is undefined
 * @property {string} previousAnswer - The previous answer of the task. Default is undefined
 * @property {number} scoringVersion - The norming version to use for scoring and enables CAT functionality. Default is undefined.
 * @property {Object} irtEstimates - Map of CAT and updated zeta values. Used to add to trial and run metadata.
 * @property {string} randomSeed - The random seed to use for the task. Default is undefined.
 */

export type TaskStoreDataType = {
  audioFeedback: string;
  skipInstructions: boolean;
  corpusId?: string;
  corpus: string;
  stimulusBlocks: number;
  buttonLayout: string;
  task: string; // FIXME: tighten to task name strings
  maxIncorrect: number;
  keyHelpers: boolean;
  storeItemId: boolean;
  isRoarApp: boolean;
  userMetadata: {
    age: number;
    grade: string;
  } & Record<string, any>;
  inferenceNumStories?: number; // FIXME: Remove
  numberOfStories: number;
  cat: boolean;
  heavyInstructions: boolean;
  semThreshold: number;
  startingTheta: number;
  language?: string;
  storyOption?: string;
  maxTime?: number;
  demoMode: boolean;
  experimenterButtons: boolean;
  debug: boolean;
  version: number;
  currentCatBlock?: number;
  blockThresholds?: number[];
  displayPromptDurations: Record<string, number>;
  inputCapability?: InputCapability;
  taskTimer: any;
  taskTimerPausedMs?: number;
  taskTimerPauseBeganAt?: number | null;
  isPaused: boolean;
  scoringVersion?: number;
  randomSeed?: string;
};

/**
 * Store for managing task state. For all tasks.
 *
 * @type {import('store2').StoreAPI & (() => TaskStore)}
 */
export const taskStore = store.page.namespace('taskStore');

export const setTaskStore = (config: TaskStoreDataType) => {
  let story = true;
  const storyOption = config.storyOption ? config.storyOption.toLowerCase() : '';

  if (storyOption === 'true' || storyOption === 'false') {
    story = stringToBoolean(storyOption);
  } else if (storyOption === 'grade-based' && config.userMetadata.grade) {
    const grade = Number(config.userMetadata.grade);
    // If not a number, assume it's pk, tk, k, or invalid string (in which all cases default to show story)
    story = Number.isNaN(grade) || grade < 5;
  }
  const effectiveHeavyInstructions = config.heavyInstructions || config.userMetadata.age <= 4;

  taskStore({
    itemSelect: 'mfi',
    trialNumSubtask: 0,
    testTrialCount: 0,
    totalTrialCount: 0,
    numIncorrect: 0,
    // For ROAR syntax (TROG)
    totalCorrect: 0,
    correctItems: [],
    // -----
    audioFeedback: config.audioFeedback,
    skipInstructions: config.skipInstructions,
    corpusId: config.corpusId,
    corpus: config.corpus,
    buttonLayout: config.buttonLayout,
    task: config.task,
    maxIncorrect: config.maxIncorrect,
    keyHelpers: config.keyHelpers,
    runCat: config.cat,
    heavyInstructions: effectiveHeavyInstructions && isEnglish(config.language),
    semThreshold: config.semThreshold,
    startingTheta: config.startingTheta,
    storeItemId: config.storeItemId,
    isRoarApp: config.isRoarApp,
    numOfBlocks: config.userMetadata.age > 4 ? 9 : 4,
    blockSize: config.userMetadata.age > 4 ? 30 : 50,
    stimulusBlocks: config.stimulusBlocks,
    gridSize: config.userMetadata.age > 4 ? 3 : 2,
    maxTimeReached: false,
    taskComplete: false,
    stimulus: 'heart',
    stimulusSide: 'left',
    stimulusPosition: 0,
    isCorrect: false,
    inferenceNumStories: config.inferenceNumStories,
    numberOfStories: config.numberOfStories,
    testPhase: false,
    story,
    maxTime: config.maxTime,
    demoMode: config.demoMode,
    experimenterButtons: config.experimenterButtons && effectiveHeavyInstructions,
    debug: config.debug,
    version: config.version || 1,
    currentStoryGroup: 0,
    taskTimer: null,
    taskTimerPausedMs: 0,
    taskTimerPauseBeganAt: null,
    isPaused: false,
    previousItem: undefined,
    previousAnswer: undefined,
    nextStimulus: undefined,
    scoringVersion: config.scoringVersion,
    irtEstimates: {},
    randomSeed: config.randomSeed ?? null,
  });
};

// Leaving this for ROAR fork / documentation

// STATE
// audioFeedback: audioFeedback || 'neutral',
// skipInstructions: skipInstructions ?? true,
// comes from getCorpus after parsing the corpus
// corpora
// For ROAR. The name of the corpus file.
// corpusId: corpusId,
// buttonLayout: buttonLayout || 'default',
// task: taskName ?? 'egma-math',
// maxIncorrect: maxIncorrect ?? 3,
// keyHelpers: keyHelpers ?? true,
// storeItemId: storeItemId,
// isRoarApp: isRoarApp(firekit)

// DONT NEED STATE FOR THESE
// userMetadata: { ...userMetadata, age },
// startTime: new Date(),
// firekit,
// displayElement: displayElement || null,
// sequentialPractice: sequentialPractice ?? true,
// sequentialStimulus: sequentialStimulus ?? true,
// // name of the csv files in the storage bucket
// corpus: corpus,
// numberOfTrials: numberOfTrials ?? 300,
// stimulusBlocks: stimulusBlocks ?? 3,
// numOfPracticeTrials: numOfPracticeTrials ?? 2,
// language: language ?? i18next.language,
// maxTime: maxTime || 100,
