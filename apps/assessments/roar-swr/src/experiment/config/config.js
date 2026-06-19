import store from 'store2';
import Ajv from 'ajv/dist/2020';
import addErrors from 'ajv-errors';
import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import _isUndefined from 'lodash/isUndefined';
import parameterSchema from '../../../parameters.json';
import { getAgeData, getGrade } from '@bdelab/roar-utils';
import i18next from 'i18next';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { SWR_LANGUAGES } from '@roar-platform/assessment-schema/roar-swr';
import { writeTrial, finishRun, addInteraction, updateUser } from '@roar-platform/assessment-sdk/compat/firekit';
import { getUserDataTimeline } from '../trials/getUserData';
import { enterFullscreen } from '../trials/fullScreen';
import { processCSV, getCorpusForPresentationExp } from './corpus';
import { RoarScores } from '../scores';
import { jsPsych } from '../jsPsych';
import { shuffle, createBlocks } from '../helperFunctions';

const ajv = new Ajv({ allErrors: true });
addErrors(ajv);
const validateParams = ajv.compile(parameterSchema);

const makePid = () => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

const initStore = (config) => {
  const corpora = processCSV(config.userMode);
  if (store.session.has('initialized') && store.local('initialized')) {
    return store.session;
  }
  if (
    config.userMode === 'fullAdaptive' ||
    config.userMode === 'testAdaptive' ||
    config.userMode === 'shortAdaptive' ||
    config.userMode === 'longAdaptive'
  ) {
    store.session.set('itemSelect', 'mfi');
  } else {
    store.session.set('itemSelect', 'random');
  }
  store.session.set('practiceIndex', 0);
  // Counting variables
  store.session.set('currentBlockIndex', 0);
  store.session.set('stimulusCountList', config.stimulusCountList);
  store.session.set('trialNumBlock', 1); // counter for trials in block
  store.session.set('trialNumTotal', 1); // counter for trials in experiment
  store.session.set('demoCounter', 0);
  store.session.set('nextStimulus', null);
  store.session.set('response', '');

  // variables to track current state of the experiment
  store.session.set('currentTrialCorrect', true); // return true or false
  store.session.set('coinTrackingIndex', 0);

  store.session.set('initialized', true);

  store.session.set('corpusAll', corpora.corpusAll);
  store.session.set('corpusPractice', corpora.corpusPractice);
  store.session.set('corpusOriginal', corpora.corpusOriginal);
  store.session.set('corpusNew', corpora.corpusNew);
  store.session.set('corpusNewEasy', corpora.corpusNewEasy);
  const [corpusExperiment, presentationTimeOption] = getCorpusForPresentationExp(
    config.userMode,
    corpora.corpusExperimental,
  );
  store.session.set('corpusExperiment', corpusExperiment);
  store.session.set('presentationTimeOption', presentationTimeOption);
  store.session.set('presentationTime', config.timing.stimulusTime);

  return store.session;
};

export const setRandomUserMode = (mode) => {
  if (mode === 'test') {
    return Math.random() < 0.5 ? 'testAdaptive' : 'testRandom';
  }
  if (mode === 'full') {
    return Math.random() < 0.5 ? 'fullAdaptive' : 'fullRandom';
  }
  return mode;
};

const getStoryOption = (opt, grade) => {
  let story;
  if (opt === 'grade-based') {
    if (getGrade(grade) >= 6) {
      story = false;
    } else {
      story = true;
    }
  } else if (!opt) {
    story = true;
  } else {
    story = opt?.toLocaleLowerCase() === 'true';
  }
  return story;
};

const stimulusRuleLists = {
  fullRandom: ['random', 'random', 'random'],
  shortRandom: ['random', 'random', 'random'],
  shortRandom80: ['random', 'random', 'random'],
  fullAdaptive: ['mfi', 'mfi', 'mfi'],
  shortAdaptive: ['mfi', 'mfi', 'mfi'],
  shortAdaptiveEasyBlock: ['random', 'mfi', 'mfi', 'mfi'],
  longAdaptive: ['mfi', 'mfi', 'mfi'],
  fullItemBank: ['random', 'random', 'random'],
  demo: ['demo'],
  testAdaptive: ['mfi', 'mfi', 'mfi'],
  testRandom: ['mfi', 'mfi', 'mfi'],
  presentationExp: Array.from({ length: 20 }, () => 'random'),
  presentationExpShort: Array.from({ length: 8 }, () => 'random'),
  presentationExp2Conditions: Array.from({ length: 4 }, () => 'random'),
};

// Stimulus timing options in milliseconds
const stimulusTimeOptions = [null, 350, 160, 72, 36];
// Fixation presentation time options in milliseconds
const fixationTimeOptions = [1000, 2000, 25000];
// Trial completion time options in milliseconds
const trialTimeOptions = [null, 5000, 8000, 100000];

const divideTrial2Block = (n1, n2, nBlock) => {
  const n = parseInt(n1, 10) + parseInt(n2, 10);
  return [Math.floor(n / nBlock), Math.floor(n / nBlock), n - 2 * Math.floor(n / nBlock)];
};

const getAudioFeedbackConfig = (audioFeedbackOption) => {
  // this function will let randomAudioFeedback control audioFeedback
  if (audioFeedbackOption === 'random') {
    return Math.random() < 0.5 ? 'neutral' : 'binary';
  }
  if (audioFeedbackOption === 'neutral') {
    return 'neutral';
  }
  return 'binary';
};

export const getStimulusCount = (userMode, numAdaptive, numNew, numValidated) => {
  const blockAdaptive = divideTrial2Block(numAdaptive, numNew, 3);
  const stimulusCountMap = {
    fullAdaptive: [82, 82, 82],
    fullRandom: [57, 57, 56],
    shortRandom: [40, 40, 40],
    shortRandom80: [27, 27, 26],
    shortAdaptive: blockAdaptive,
    longAdaptive: blockAdaptive,
    fullItemBank: divideTrial2Block(numValidated, numNew, 3),
    shortAdaptiveEasyBlock: [10, blockAdaptive[0], blockAdaptive[1], blockAdaptive[2]],
    demo: [60],
    testAdaptive: [6, 4, 4],
    testRandom: [6, 4, 4],
    presentationExp: createBlocks(520, 20),
    presentationExpShort: createBlocks(208, 8),
    presentationExp2Conditions: createBlocks(120, 4),
  };

  return stimulusCountMap[userMode];
};

export const adjustNumNewItems = (userMode) => {
  if (userMode === 'shortAdaptive') return 0;
  if (userMode === 'fullItemBank') return 0;
  return 0;
};

export const initConfig = async (gameParams, userParams, displayElement, useParameterValidation) => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);

  // Derive taskId from the lng param via schema constants
  const lng = cleanParams.lng ?? 'en';
  const languageEntry = SWR_LANGUAGES[lng] ?? SWR_LANGUAGES.en;
  const taskId = languageEntry.taskId;
  const defaultScoringVersion = languageEntry.defaultScoringVersion ?? 6;

  const {
    userMode = 'shortAdaptive',
    assessmentPid,
    labId,
    recruitment,
    storyOption,
    userMetadata = {},
    consent,
    audioFeedbackOption,
    language = lng,
    numAdaptive = ['shortAdaptive', 'shortAdaptiveEasyBlock'].includes(userMode) ? 84 : 150,
    numNew = 0, // save for later: adjustNumNewItems(userMode)
    numValidated = userMode === 'fullItemBank' ? 246 : 84,
    skipInstructions,
    addNoResponse,
    grade,
    birthMonth,
    birthYear,
    age,
    ageMonths,
    scoringVersion = defaultScoringVersion,
  } = cleanParams;

  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);
  const parsedScoringVersion = Number.isNaN(parseInt(scoringVersion, 10))
    ? defaultScoringVersion
    : parseInt(scoringVersion, 10);

  if (language !== 'en') i18next.changeLanguage(language);

  const config = {
    taskId,
    userMode,
    pid: assessmentPid,
    labId,
    recruitment: recruitment || 'pilot',
    userMetadata: { ...userMetadata, grade, ...ageData },
    audioFeedbackOption,
    audioFeedback: getAudioFeedbackConfig(audioFeedbackOption),
    story: getStoryOption(storyOption, grade),
    consent: consent ?? true,
    skipInstructions: skipInstructions ?? true,
    numAdaptive,
    numNew,
    numValidated,
    adaptive2new: Math.floor(numAdaptive / numNew),
    stimulusRuleList: stimulusRuleLists[userMode],
    stimulusCountList: getStimulusCount(userMode, numAdaptive, numNew, numValidated),
    totalTrialsPractice: 5,
    countSlowPractice: 2,
    nRandom: 5,
    indexArray: shuffle(
      Array(parseInt(numNew, 10))
        .fill(0)
        .concat(Array(parseInt(numValidated, 10)).fill(1)),
    ),
    timing: {
      stimulusTimePracticeOnly: stimulusTimeOptions[0], // null as default for practice trial only
      stimulusTime: stimulusTimeOptions[1],
      fixationTime: fixationTimeOptions[0],
      trialTimePracticeOnly: trialTimeOptions[0],
      trialTime: trialTimeOptions[0],
    },
    startTime: new Date(),
    runStarted: true,
    addNoResponse: addNoResponse ?? false,
    displayElement: displayElement || null,
    useParameterValidation: useParameterValidation ?? true,
    scoringVersion: parsedScoringVersion,
  };

  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [key, config[key] ?? value]),
  );

  // updateTaskParams is deprecated and will be removed in a future version.
  // Task parameters are now recorded via the assessment-sdk run metadata.
  console.warn('[roar-swr] updateTaskParams is deprecated and has no effect.', updatedGameParams);

  if (config.useParameterValidation) {
    // Exclude the internal control flag — it is not a game parameter and is not in the schema.
    const { useParameterValidation: _useParameterValidation, ...paramsToValidate } = gameParams;
    const valid = validateParams(paramsToValidate);
    if (!valid) {
      console.warn(
        '[roar-swr] Parameter validation warnings:\n' + validateParams.errors.map((e) => e.message).join('\n'),
      );
    }
  }

  if (config.pid) {
    try {
      await updateUser({ assessmentPid: config.pid, ...userMetadata });
    } catch (err) {
      console.error('[roar-swr] updateUser failed (non-fatal):', err);
    }
  }
  return config;
};

export const initRoarJsPsych = (config) => {
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
    finishRun().catch((err) => console.error('[roar-swr] finishRun failed:', err));
  });

  const roarScores = new RoarScores();
  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    if (data.save_trial) {
      writeTrial(data, roarScores.computedScoreCallback.bind(roarScores)).catch((err) =>
        console.error('[roar-swr] writeTrial failed:', err),
      );
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
  const beginningTimeline = [
    enterFullscreen,
    ...getUserDataTimeline,
    {
      type: jsPsychCallFunction,
      async: true,
      func: async (done) => {
        config.pid = config.pid || makePid();
        try {
          await updateUser({
            assessmentPid: config.pid,
            labId: config.labId,
            ...config.userMetadata,
          });
        } catch (err) {
          console.error('[roar-swr] updateUser failed (non-fatal):', err);
        }
        done();
      },
    },
  ];
  return beginningTimeline;
};
