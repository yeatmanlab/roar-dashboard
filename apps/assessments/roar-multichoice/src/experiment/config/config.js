import store from 'store2';
import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import _isUndefined from 'lodash/isUndefined';
import i18next from 'i18next';
import { getAgeData } from '@bdelab/roar-utils';
import { writeTrial, finishRun, addInteraction, updateUser } from '@roar-platform/assessment-sdk/compat/firekit';
import { getUserDataTimeline } from '../trials/getUserData';
import { enterFullscreen } from '../trials/fullScreen';
import { corpora } from './corpus';
import { jsPsych } from '../jsPsych';
import { initializeClowder } from '../experimentSetup';

const makePid = () => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

const initStore = async () => {
  if (store.session.has('initialized') && store.local('initialized')) {
    return store.session;
  }

  // Counting variables
  store.session.set('practiceIndex', 0);
  store.session.set('currentBlockIndex', 0); // counter for breaks within subtask
  store.session.set('subTaskName', ''); // init to "" so getNextSubTask will work

  store.session.set('trialNumSubtask', 0); // counter for trials in subtask
  store.session.set('trialNumTotal', 0); // counter for trials in experiment

  // variables related to stimulus and response
  store.session.set('nextStimulus', null);
  store.session.set('response', '');

  // variables to track current state of the experiment
  store.session.set('currentTrialCorrect', true); // return true or false
  store.session.set('coinTrackingIndex', 0);
  store.session.set('maxTimeReached', false);

  store.session.set('itemGroupCounter', 0);
  store.session.set('coreRemaining', 0);
  store.session.set('newRemaining', 0);
  store.session.set('spareRemaining', 0);
  store.session.set('secondaryRemaining', 0);

  // running computations
  store.session.set('subtaskCorrect', 0);
  store.session.set('totalCorrect', 0);
  store.session.set('totalPercentCorrect', 0);
  store.session.set('itemsCompleted', 0);
  store.session.set('correctItems', []);
  store.session.set('incorrectItems', []);

  store.session.set('previousItem', null);
  store.session.set('previousAnswer', null);

  // working copy of the all corpuses (items are removed as they are used)
  store.session.set('corpora', corpora);

  // Divide items into groups BEFORE initializing clowder
  divideItemsIntoGroups();

  // this should be the last set before return
  store.session.set('initialized', true);
  await initializeClowder();

  return store.session;
};

// Stimulus timing options in milliseconds
const stimulusTimeOptions = [null, 350, 1000, 2000];
// Fixation presentation time options in milliseconds
const fixationTimeOptions = [1000, 2000, 25000];
// Trial completion time options in milliseconds
const trialTimeOptions = [null, 5000, 8000, 100000];

// get size of pratice blocks
export const getPracticeCount = (practiceType) => {
  const stimulusCountMap = {
    // this table is indexed by practiceType and returns a list with the number of trials in each block
    // userMode: [block1, block2, ...blockN]
    practice: store.session.get('config').task === 'cva' ? [3] : [2],
    stimulus: [5, 5, 5],
  };

  return stimulusCountMap[practiceType];
};

// This is based on stimulusCountMap. It does not need to be 3.
function divideByThree(num) {
  // Minimum number of trials, also random. Can change to whatever.

  if (num < 9) num = 9;
  const baseFraction = Math.floor(num / 3);
  const remainder = num % 3;

  // Create an array filled with the base fraction
  const fractions = [baseFraction, baseFraction, baseFraction];

  // Distribute the remainder among the first few fractions
  for (let i = 0; i < remainder; i += 1) {
    fractions[i] += 1;
  }

  return fractions;
}

// Divide the trials into blocks of size n or n+1
// remainder is evenly distributed across intial blocks
function divideBlockSize(num, numPerBlock) {
  if (num < numPerBlock) num = numPerBlock;
  const numBlocks = Math.floor(num / numPerBlock);
  const remainder = num % numPerBlock;

  const fractions = [];
  // Create an array filled with the base fraction
  for (let i = 0; i < numBlocks; i += 1) {
    fractions[i] = numPerBlock;
  }

  // Distribute the remainder among the first few fractions
  for (let i = 0; i < remainder; i += 1) {
    fractions[i] += 1;
  }

  return fractions;
}

// separate incoming stimulus into separate corpus based on itemGroup
const divideItemsIntoGroups = () => {
  const corpus = store.session.get('corpora');

  // split corpus into stimulus ("core"), new, and spare
  corpus.stimulus = corpus.stimulus.filter((item) => {
    const itemGroup = item.itemGroup || 'core'; // Default to "core" if no itemGroup
    if (itemGroup === 'new') {
      corpus.newGroup.push(item); // Move to new group
      return false; // Remove from stimulus
    } else if (itemGroup === 'spare') {
      corpus.spareGroup.push(item); // Move to spare group
      return false; // Remove from stimulus
    } else if (itemGroup === 'secondary') {
      corpus.secondaryGroup.push(item); // Move to secondary group
      return false; // Remove from stimulus
    }
    return true; // Keep other items in stimulus (core items)
  });

  // Store the updated corpus back in session storage
  // Keep all items in corpus - early stopping will handle when to stop
  const coreCount = corpus.stimulus.length;
  const secondaryCount = corpus.secondaryGroup.length;

  // Save the modified corpus back to session storage (with all items)
  store.session.set('corpora', corpus);

  store.session.set('coreRemaining', coreCount);
  store.session.set('newRemaining', corpus.newGroup.length);
  store.session.set('spareRemaining', corpus.spareGroup.length);
  store.session.set('practiceRemaining', corpus.practice.length);
  store.session.set('secondaryRemaining', secondaryCount);
};

// get size of blocks
export const getStimulusCount = (userMode) => {
  const { numberOfTrials } = store.session.get('config');
  const maxNumberOfTrials = store.session.get('maxStimulusTrials');

  let countList;

  // divide stimuli into groups if needed
  if (userMode === 'groupRandom') {
    divideItemsIntoGroups();
  } else if (numberOfTrials) {
    // note: we don't currently handle using numberOfTrials with groupRandom
    if (numberOfTrials > maxNumberOfTrials) {
      countList = divideByThree(maxNumberOfTrials);
    } else {
      countList = divideByThree(numberOfTrials);
    }

    store.session.set('stimulusCountList', countList);

    return countList;
  }

  const getFullRandomBlocksArray = () => {
    const { stimulus } = store.session.get('corpora');
    return divideByThree(stimulus.length);
  };

  const getGroupRandomBlocksArray = (_taskId, blockSize) => {
    const { nItemsCore, nItemsSecondary } = store.session.get('config');
    const { stimulus } = store.session.get('corpora');
    const { newGroup } = store.session.get('corpora');
    const { spareGroup } = store.session.get('corpora');
    const { secondaryGroup } = store.session.get('corpora');

    // Use actual corpus lengths if limits are null (non-adaptive tasks)
    const coreCount = nItemsCore !== null ? Math.min(stimulus.length, nItemsCore) : stimulus.length;
    const secondaryCount =
      nItemsSecondary !== null ? Math.min(secondaryGroup.length, nItemsSecondary) : secondaryGroup.length;
    const totalCount = coreCount + newGroup.length + spareGroup.length + secondaryCount;

    return divideBlockSize(totalCount, blockSize);
  };

  const stimulusCountMap = {
    // this table is indexed by userMode and returns a list with the number of trials in each block
    // userMode: [block1, block2, ...blockN]
    // The sum of the blocks cannot exceed the number of items in the corpus, else stimuli will be undefined
    fullAdaptive: getFullRandomBlocksArray(store.session.get('config').task),
    fullRandom: getFullRandomBlocksArray(store.session.get('config').task),
    groupRandom: getGroupRandomBlocksArray(store.session.get('config').task, 9),
    testRandom: [7, 7, 6],
    demo: [3, 3, 3], // 9 letters with 2 breaks
  };
  store.session.set('stimulusCountList', stimulusCountMap[userMode]);
  return stimulusCountMap[userMode];
};

const setItemSelect = (algorithm) => {
  if (algorithm === 'adaptive') {
    store.session.set('itemSelect', 'mfi');
    return 'mfi';
  }
  if (algorithm === 'closest') {
    store.session.set('itemSelect', 'closest');
    return 'closest';
  }
  store.session.set('itemSelect', 'random');
  return 'random';
};

export const initConfig = async (gameParams, userParams, displayElement) => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);

  const {
    // Setting default userMode to fullAdaptive, which uses mfi item selection rather than random
    userMode,
    assessmentPid,
    labId,
    recruitment,
    userMetadata = {},
    testingOnly,
    consent,
    audioFeedback,
    language = i18next.language,
    skipInstructions,
    birthMonth,
    birthYear,
    age,
    ageMonths,
    practiceCorpus,
    stimulusCorpus,
    sequentialPractice,
    sequentialStimulus,
    buttonLayout,
    numberOfTrials,
    task,
    grade,
    corpusId,
    promptWidth,
    maxTime, // maximum time for real trials in minutes
    nStartItems,
    selectionAlgorithm,
    isAdaptive,
    nItemsCore,
    nItemsSecondary,
    forceSecondaryBehavior,
    startItemSelect,
  } = cleanParams;

  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);

  language !== 'en' && i18next.changeLanguage(language);

  const isCvaGroupRandom = task === 'cva' && (userMode ?? 'groupRandom') === 'groupRandom';

  const config = {
    userMode: userMode ?? 'groupRandom',
    pid: assessmentPid,
    labId,
    recruitment: recruitment || 'pilot',
    userMetadata: { ...userMetadata, grade, ...ageData },
    testingOnly,
    consent: consent ?? true,
    audioFeedback: audioFeedback || 'neutral',
    skipInstructions: skipInstructions ?? true,
    totalTrialsPractice: 5,
    countSlowPractice: 2,
    nRandom: 5,
    timing: {
      stimulusTimePracticeOnly: stimulusTimeOptions[0], // null as default for practice trial only
      stimulusTime: stimulusTimeOptions[1],
      fixationTime: fixationTimeOptions[0],
      trialTimePracticeOnly: trialTimeOptions[0],
      trialTime: trialTimeOptions[0],
    },
    startTime: new Date(),
    displayElement: displayElement || null,
    // name of the csv files in the bucket
    task: task ?? 'morphology',
    practiceCorpus: task === 'cva' ? practiceCorpus || 'cva-practice-cat' : practiceCorpus || 'morphology-practice-cat',

    stimulusCorpus: task === 'cva' ? stimulusCorpus || 'cva-stimulus-cat' : stimulusCorpus || 'morphology-cat',

    sequentialPractice: sequentialPractice ?? true,
    sequentialStimulus: sequentialStimulus ?? false,
    corpusId: corpusId,
    buttonLayout: buttonLayout || 'default',
    numberOfTrials: numberOfTrials || null,
    promptWidth: promptWidth ?? '75',
    maxTime: maxTime, // null defaults to no time limit
    nStartItems,
    selectionAlgorithm: selectionAlgorithm ?? 'random',
    itemSelect: setItemSelect(selectionAlgorithm),
    isAdaptive: isAdaptive ?? isCvaGroupRandom,
    nItemsCore: nItemsCore ?? ((isAdaptive ?? isCvaGroupRandom) ? 25 : null),
    nItemsSecondary: nItemsSecondary ?? ((isAdaptive ?? isCvaGroupRandom) && task === 'cva' ? 5 : null),
    forceSecondaryBehavior,
    startItemSelect,
    runStarted: true,
  };

  // updateTaskParams is not supported in the SDK; log a deprecation warning and continue
  console.warn('[roar-multichoice] updateTaskParams is deprecated and has no effect.');

  if (config.pid !== null) {
    try {
      await updateUser({ assessmentPid: config.pid, ...userMetadata });
    } catch (err) {
      console.error('[roar-multichoice] updateUser failed (non-fatal):', err);
    }
  }

  return config;
};

export const initRoarJsPsych = async (config, computedScoreCallback) => {
  if (config.displayElement) {
    jsPsych.opts.display_element = config.displayElement;
  }

  // Extend jsPsych's on_finish and on_data_update lifecycle functions to mark the
  // run as completed and write data to the backend, respectively.
  const extend = (fn, code) =>
    function () {
      fn.apply(fn, arguments);

      code.apply(fn, arguments);
    };

  jsPsych.opts.on_finish = extend(jsPsych.opts.on_finish, () => {
    finishRun().catch((err) => console.error('[roar-multichoice] finishRun failed:', err));
  });

  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    if (data.save_trial) {
      writeTrial(data, computedScoreCallback).catch((err) =>
        console.error('[roar-multichoice] writeTrial failed:', err),
      );
    }
  });
  jsPsych.opts.on_interaction_data_update = function (data) {
    addInteraction(data);
  };

  await initStore();
};

export const initRoarTimeline = (config) => {
  // If the participant's ID was **not** supplied through the query string, then
  // ask the user to fill out a form with their ID, class and school.

  const initialTimeline = [enterFullscreen, ...getUserDataTimeline];

  const beginningTimeline = {
    timeline: initialTimeline,
    on_timeline_finish: async () => {
      config.pid = config.pid || makePid();
      try {
        await updateUser({ assessmentPid: config.pid, labId: config.labId, ...config.userMetadata });
      } catch (err) {
        console.error('[roar-multichoice] updateUser failed (non-fatal):', err);
      }
    },
  };

  return beginningTimeline;
};
