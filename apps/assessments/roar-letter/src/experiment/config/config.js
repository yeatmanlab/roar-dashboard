import store from 'store2';
import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import _isUndefined from 'lodash/isUndefined';
import i18next from 'i18next';
import { getAgeData } from '@bdelab/roar-utils';
import { LETTER_TASK_IDS, LETTER_SCORING_VERSION } from '@roar-platform/assessment-schema/roar-letter';
import { getUserDataTimeline } from '../trials/getUserData';
import { enterFullscreen } from '../trials/fullScreen';
import { corpusLetterAll, corpusTypePhonics } from './corpus';

import { finishRun, writeTrial, addInteraction, updateUser } from '@roar-platform/assessment-sdk/compat/firekit';
import { jsPsych } from '../jsPsych';
import { initializeClowder } from '../experimentSetup';

const makePid = () => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

const initStore = () => {
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
  store.session.set('phonicsEarlyStop', false);

  // running computations
  store.session.set('subtaskCorrect', 0);
  store.session.set('totalCorrect', 0);
  store.session.set('totalPercentCorrect', 0);
  store.session.set('correctItems', []);
  store.session.set('incorrectItems', []);
  store.session.set('lowerCorrectItems', []);
  store.session.set('lowerIncorrectItems', []);
  store.session.set('upperCorrectItems', []);
  store.session.set('upperIncorrectItems', []);
  store.session.set('phonemeCorrectItems', []);
  store.session.set('phonemeIncorrectItems', []);
  store.session.set('phonicsGroup-cvc', null);
  store.session.set('phonicsGroup-digraph', null);
  store.session.set('phonicsGroup-i-blend', null);
  store.session.set('phonicsGroup-f-blend', null);
  store.session.set('phonicsGroup-r-ctrl', null);
  store.session.set('phonicsGroup-r-tri', null);
  store.session.set('phonicsGroup-silent-e', null);
  store.session.set('phonicsGroup-tri-blend', null);
  store.session.set('phonicsGroup-vt', null);

  // working copy of the three corpuses (items are removed as they are used)
  store.session.set('corpusLetterAll', corpusLetterAll);
  store.session.set('currentCatIndex', -1);
  store.session.set('breakNumber', 0);
  store.session.set('nItemsBeforeBreak', null);
  store.session.set('nItemsBeforeBreakPhoneme', null);
  store.session.set('currentCat', null);
  store.session.set('previousItem', null);
  store.session.set('previousAnswer', null);

  // this should be the last set before return
  store.session.set('initialized', true);
  initializeClowder();
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
    letter: [2],
    phoneme: [2],
    phonics: [2],
  };

  return stimulusCountMap[practiceType];
};

// get list of blocks for Phonics
export const getStimulusCountPhonics = () => {
  let countList;

  switch (corpusTypePhonics) {
    case 'corpusPhonicsSetA':
    case 'corpusPhonicsSetB':
    case 'corpusPhonicsSetC':
      countList = [9, 9, 9, 9, 9, 9, 9, 9];
      break;

    case 'corpusPhonicsAll':
      countList = [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15];
      break;

    default:
      console.log('Unexpected corpusTypePhonics:', corpusTypePhonics);
      return [];
  }

  // compute and store total for later
  const phonicsTrialsTotal = countList.reduce((a, b) => a + b, 0);
  store.session.set('phonicsTrialsTotal', phonicsTrialsTotal);

  // console.log( "corpusTypePhonics:" + corpusTypePhonics + " countList:" + countList );

  return countList;
};

export const initConfig = async (gameParams, userParams, displayElement) => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);

  const {
    userMode,
    itemSelectMethod,
    nItems,
    nItemsPhoneme,
    nItemsBeforeBreak,
    nItemsBeforeBreakPhoneme,
    assessmentPid,
    labId,
    userMetadata = {},
    testingOnly,
    consent,
    audioFeedback,
    language = i18next.language,
    grade,
    ageMonths,
    birthYear,
    birthMonth,
    age,
    skipInstructions,
    recruitment,
    story,
    task,
    phonicsSet,
    phonicsCorpus,
    minTheta,
    maxTheta,
    initialTheta,
    method,
    maxTime, // maximum time for real trials in minutes
    logicalOperation = 'only',
    randomSeed,
    nStartItems,
    startSelectMethod,
    scoringVersion,
    taskId,
  } = cleanParams;

  if (language !== 'en') i18next.changeLanguage(language);
  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);

  const config = {
    userMode: userMode,
    itemSelectMethod: itemSelectMethod ?? 'random',
    nItems: nItems,
    nItemsPhoneme: nItemsPhoneme,
    pid: assessmentPid,
    nItemsBeforeBreak: nItemsBeforeBreak,
    nItemsBeforeBreakPhoneme: nItemsBeforeBreakPhoneme,
    labId,
    recruitment: recruitment || 'pilot',
    story: story ?? false,
    task: task ?? LETTER_TASK_IDS.EN,
    phonicsSet: phonicsSet ?? 'all',
    phonicsCorpus: phonicsCorpus ?? 'letter-Corpus',
    userMetadata: { ...userMetadata, grade, ...ageData },
    testingOnly,
    consent: consent ?? true,
    audioFeedback: audioFeedback || 'neutral',
    language,
    skipInstructions: skipInstructions ?? false,
    totalTrialsPractice: 5,
    countSlowPractice: 2,
    nRandom: 5,
    maxTime: maxTime, // null defaults to no time limit
    timing: {
      stimulusTimePracticeOnly: stimulusTimeOptions[0], // null as default for practice trial only
      stimulusTime: stimulusTimeOptions[1],
      fixationTime: fixationTimeOptions[0],
      trialTimePracticeOnly: trialTimeOptions[0],
      trialTime: trialTimeOptions[0],
    },
    startTime: new Date(),
    displayElement: displayElement || null,
    minTheta: minTheta || -8,
    maxTheta: maxTheta || 8,
    initialTheta: initialTheta || 0,
    method: method ?? 'eap',
    logicalOperation: logicalOperation ?? 'only',
    randomSeed,
    nStartItems,
    startSelectMethod,
    scoringVersion: scoringVersion ?? LETTER_SCORING_VERSION.V1,
    taskId: taskId ?? LETTER_TASK_IDS.EN,
  };

  if (config.pid) {
    try {
      await updateUser({
        assessmentPid: config.pid,
        ...userMetadata,
      });
    } catch (err) {
      console.warn('[roar-letter] updateUser skipped (not yet implemented in SDK):', err.message);
    }
  }

  return config;
};

export const initRoarJsPsych = (config, computedScoreCallback) => {
  if (config.displayElement) {
    jsPsych.opts.display_element = config.displayElement;
  }

  // Extend jsPsych's on_finish and on_data_update lifecycle functions to mark the
  // run as completed and write data to Firestore, respectively.
  const extend = (fn, code) =>
    function () {
      fn.apply(fn, arguments);

      code.apply(fn, arguments);
    };

  jsPsych.opts.on_finish = extend(jsPsych.opts.on_finish, () => {
    finishRun();
  });

  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    const updatedData = { ...data }; // Clone the data object
    if (updatedData.save_trial) {
      if (updatedData.corpusId === 'textSoundPseudo') {
        updatedData.phonicsCorpus = 'roar-phonics-2025-08-01-v3.csv';
      }
      writeTrial(updatedData, computedScoreCallback);
    }
  });
  jsPsych.opts.on_interaction_data_update = function (data) {
    addInteraction(data);
  };

  initStore(config);
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
        await updateUser({
          assessmentPid: config.pid,
          labId: config.labId,
          ...config.userMetadata,
        });
      } catch (err) {
        console.warn('[roar-letter] updateUser skipped (not yet implemented in SDK):', err.message);
      }
    },
  };
  return beginningTimeline;
};
