import store from 'store2';
import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import _isUndefined from 'lodash/isUndefined';
import { getAgeData, getGrade } from '@bdelab/roar-utils';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import i18next from 'i18next';
import { getUserDataTimeline } from '../trials/getUserData';
import { jsPsych } from '../jsPsych';
import { RoarScores } from '../scores';
import { corpus } from './loadCorpus';
import { shuffle } from '../experimentHelpers';
import { enterFullscreen } from '../trials/fullScreen';
import { sreValidityEvaluator } from '../experiment';
import parameterSchema from '../../../parameters.json';

// Add this function to create random pid used for demo version later // TO DO: Make a random ID for the demo mode
const makePid = () => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 16; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const initStore = () => {
  if (store.session.has('initialized') && store.local('initialized')) {
    return store.session;
  }
  store.session.set('practiceIndex', 0);
  // Counting variables
  store.session.set('currentBlockIndex', 0);
  store.session.set('trialNumBlock', 0); // counter for trials in block
  store.session.set('trialNumTotal', 0); // counter for trials in experiment
  store.session.set('demoCounter', 0);
  store.session.set('nextStimulus', null);
  store.session.set('response', '');
  store.session.set('dataCorrect', '');
  store.session.set('keyResponse', '');
  store.session.set('gradeKeyResponse', []);
  store.session.set('currentCorpus', []);
  store.session.set('timeOut', false);
  store.session.set('practiceCorpus', corpus.practice);

  // variables to track current state of the experiment
  store.session.set('currentTrialCorrect', true); // return true or false
  store.session.set('coinTrackingIndex', 0);

  store.session.set('initialized', true);

  return store.session;
};

export const getStoryOption = (opt, grade) => {
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

function getBlockOrder(userMode, corpus, language) {
  if (userMode === '3minParallelAIFormV1') {
    // this mode is parallel mode version 1: student will be randomly assigned a parallel AI form + a lab form
    // block order is randomized
    return Math.random() < 0.5 ? shuffle(['lab', 'aiV1P1']) : shuffle(['lab', 'aiV1P2']);
  }
  if (userMode === '3min1Block') {
    return [shuffle(['lab', 'aiV1P1', 'aiV1P2'])[0]]; // randomly select 1 out of 3 existing forms
  }
  if (userMode === '2BlocksV2') {
    return [shuffle(['lab', 'aiV1P1', 'aiV1P2'])[0], 'aiV2'];
  }
  if (userMode === '3minBlock90sBlock') {
    return [
      shuffle(['lab', 'aiV1P1', 'aiV1P2'])[0],
      Object.keys(corpus.fixedForms)[Math.floor(Math.random() * Object.keys(corpus.fixedForms).length)],
    ];
  }
  if (userMode === '90s2Blocks') {
    return shuffle(['test1', 'test2']);
  }
  if (userMode === '90s2BlocksFixedForms') {
    // randomly select 2 forms from all fixed ordered forms
    const forms = Object.keys(corpus.fixedForms)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);
    return forms;
  }

  // this mode is default mode: student will be assigned a lab form and an unordered AI form
  // For non-English languages that only have test1 and test2, use those instead
  if (language === 'pt' || language === 'de') {
    return shuffle(['test1', 'test2']);
  }
  return ['lab', 'ai'];
}

function getTimerOption(userMode) {
  if (userMode === '3min1Block') {
    return [180000]; // randomly select 1 out of 3 existing forms
  }
  if (userMode === '2BlocksV2' || userMode === '3minBlock90sBlock') {
    return [180000, 90000];
  }
  if (userMode === '90s2Blocks' || userMode === '90s2BlocksFixedForms') {
    return [90000, 90000];
  }
  // this mode is default mode: 3min and 3 min
  return [180000, 180000];
}

function selectDefaultMode(language) {
  if (language === 'es' || language === 'pt' || language === 'de') {
    return '90s2Blocks';
  }
  return '3minBlock90sBlock';
}

export const initConfig = async (firekit, gameParams, userParams, displayElement, useParameterValidation) => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);
  const defaultScoringVersion = i18next.language === 'es' ? 1 : 3;

  const {
    userMode,
    assessmentPid,
    labId,
    recruitment,
    userMetadata,
    urlParams,
    consent,
    storyOption,
    language = i18next.language,
    skipInstructions,
    grade,
    birthMonth,
    birthYear,
    age,
    ageMonths,
    timerLength,
    scoringVersion = defaultScoringVersion,
  } = cleanParams;

  const is90s2BlocksFixedForms = i18next.language === 'en' && userMode === '90s2BlocksFixedForms';
  const scoringVersionParsed = Number.isNaN(parseInt(scoringVersion, 10))
    ? is90s2BlocksFixedForms
      ? 4
      : defaultScoringVersion
    : scoringVersion;

  if (language !== 'en') i18next.changeLanguage(language);

  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);

  const config = {
    taskId: firekit.task.taskId,
    pid: assessmentPid,
    labId,
    userMode: userMode || selectDefaultMode(language),
    recruitment: recruitment || 'pilot',
    storyOption,
    story: getStoryOption(storyOption, grade),
    userMetadata: { ...userMetadata, grade, ...ageData },
    startTime: new Date(),
    urlParams: urlParams,
    firekit,
    language,
    skipInstructions: skipInstructions ?? true,
    consent: consent ?? true,
    displayElement: displayElement || null,
    blockOrder: getBlockOrder(userMode || selectDefaultMode(language), corpus, language),
    timerLength: timerLength ?? 180000,
    timerLengthList: getTimerOption(userMode || selectDefaultMode(language)),
    useParameterValidation: useParameterValidation ?? true,
    scoringVersion: scoringVersionParsed,
  };

  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [key, config[key] ?? value]),
  );

  await config.firekit.updateTaskParams(updatedGameParams);

  if (config.useParameterValidation) {
    await config.firekit.validateParameters(parameterSchema);
  }

  if (config.pid !== null) {
    await config.firekit.updateUser({ assessmentPid: config.pid, ...userMetadata });
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
    config.firekit.finishRun();
    sreValidityEvaluator.markAsCompleted();
    if (config.experimentFinished) {
      config.experimentFinished();
    }
  });

  const roarScores = new RoarScores();
  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    if (data.save_trial) {
      config.firekit.writeTrial(data, roarScores.computedScoreCallback.bind(roarScores));
    }
  });
  jsPsych.opts.on_interaction_data_update = function (data) {
    config.firekit.addInteraction(data);
  };

  initStore(config);
};

export const initRoarTimeline = (firekit) => {
  const beginningTimeline = [
    enterFullscreen,
    ...getUserDataTimeline,
    {
      type: jsPsychCallFunction,
      func: () => {
        const config = store.session.get('config');
        config.pid = config.pid || makePid();
        firekit.updateUser({ assessmentPid: config.pid, labId: config.labId, ...config.userMetadata });
      },
    },
  ];

  return beginningTimeline;
};
