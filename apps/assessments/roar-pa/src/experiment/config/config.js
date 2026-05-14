import store from 'store2';
import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import i18next from 'i18next';
import _isUndefined from 'lodash/isUndefined';
import { getAgeData, getGrade } from '@bdelab/roar-utils';
import { pa } from '@roar-dashboard/assessment-schema';
import {
  writeTrial,
  finishRun,
  addInteraction,
  updateUser,
} from '@yeatmanlab/assessment-sdk/compat/firekit';
import { getUserDataTimeline } from '../trials/getUserData';
import { jsPsych } from '../jsPsych';
import { RoarScores } from '../scores';
import { paValidityEvaluator } from '../experiment';

// Add this function to create random pid used for demo version later //
const makePid = () => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  // eslint-disable-next-line max-len, no-plusplus
  for (let i = 0; i < 16; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

export const initStore = (config) => {
  store.session.set('currentStimulus', null);
  store.session.set('currentCorpusIndex', 0);
  store.session.set('incorrectCounter', 0);
  store.session.set('trialNumBlock', 0);
  store.session.set('trialNumTotal', 0);
  store.session.set('kResponses', []);
  store.session.set('keepBlock', true);
  store.session.set('userMode', config.userMode);
  store.session.set('numTestItems', config.numTestItems);
  store.session.set('isAdaptive', config.isAdaptive);
  store.session.set('previousItem', null);
  store.session.set('previousAnswer', null);
  store.session.set('currentCatIndex', null);
  store.session.set('itemSelect', config.itemSelect);
  store.session.set('config', config);
  store.session.set('initialized', true);

  return store.session;
};

const getStoryOption = (opt, grade) => {
  let story;
  if (opt === 'grade-based' && grade !== undefined) {
    if (getGrade(grade) >= 6) {
      story = false;
    } else {
      story = true;
    }
    // Note: we use == instead of === in order to compare against both undefined and null
    // eslint-disable-next-line eqeqeq
  } else if (opt == undefined) {
    story = true;
  } else if (opt === true) {
    story = true;
  } else if (opt === false) {
    story = false;
  } else if (typeof opt === 'string' || opt instanceof String) {
    story = opt?.toLocaleLowerCase() === 'true';
  } else {
    story = true;
  }
  return story;
};

export const initConfig = async (gameParams, userParams, displayElement) => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);

  const {
    userMode,
    userMetadata,
    assessmentPid,
    recruitment,
    skipInstructions,
    consent,
    language = i18next.language,
    labId,
    grade,
    story,
    storyOption,
    birthMonth,
    birthYear,
    numTestItems,
    age,
    ageMonths,
    logicalOperation,
    earlyStopping,
    randomSeed,
    isAdaptive = false,
    itemSelect = 'fixed',
    abilityMethod = 'eap',
  } = cleanParams;

  let computedStoryParam;

  if (storyOption) {
    computedStoryParam = getStoryOption(storyOption, grade);
  } else {
    computedStoryParam = getStoryOption(story);
  }

  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);

  if (language !== 'en') i18next.changeLanguage(language);

  const taskId = language === 'en' ? pa.PA_TASK_ID : `${pa.PA_TASK_ID}-${language}`;

  const config = {
    taskId,
    pid: assessmentPid,
    labId,
    userMode: userMode || 'fixed',
    recruitment: recruitment || 'pilot',
    consent: consent ?? true,
    userMetadata: { ...userMetadata, grade, ...ageData },
    startTime: new Date(),
    language,
    runStarted: true,
    skipInstructions: skipInstructions ?? true,
    numTestItems: parseInt(numTestItems, 10),
    story: computedStoryParam,
    displayElement,
    logicalOperation: logicalOperation || null,
    earlyStopping: earlyStopping || false,
    randomSeed: randomSeed || null,
    isAdaptive: isAdaptive || false,
    itemSelect: itemSelect ?? 'fixed',
    abilityMethod: abilityMethod ?? 'eap',
  };

  const updatedGameParams = Object.fromEntries(
    Object.entries(gameParams).map(([key, value]) => [key, config[key] ?? value]),
  );

  // Temporarily reset story to whatever the input value was. This is a
  // temporary solution while the ``story`` parameter is being deprecated.
  updatedGameParams.story = story;

  // updateTaskParams is deprecated and will be removed in a future version.
  console.warn('[roar-pa] updateTaskParams is deprecated and has no effect.');

  if (config.pid) {
    try {
      await updateUser({
        assessmentPid: config.pid,
        ...config.userMetadata,
      });
    } catch (err) {
      console.error('[roar-pa] updateUser failed (non-fatal):', err);
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
      // eslint-disable-next-line prefer-rest-params
      fn.apply(fn, arguments);
      // eslint-disable-next-line prefer-rest-params
      code.apply(fn, arguments);
    };

  jsPsych.opts.on_finish = extend(jsPsych.opts.on_finish, () => {
    paValidityEvaluator.markAsCompleted();
    finishRun().catch((err) => console.error('[roar-pa] finishRun failed:', err));
  });

  const roarScores = new RoarScores();
  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    if (data.save_trial) {
      writeTrial(data, roarScores.computedScoreCallback.bind(roarScores)).catch((err) =>
        console.error('[roar-pa] writeTrial failed:', err),
      );
    }
  });
  jsPsych.opts.on_interaction_data_update = function (data) {
    addInteraction(data);
  };
};

export const initRoarTimeline = (config) => {
  // getLabId,Pid used to be here
  const beginningTimeline = {
    timeline: getUserDataTimeline,
    on_timeline_finish: async () => {
      // eslint-disable-next-line no-param-reassign
      config.pid = config.pid || makePid();
      try {
        await updateUser({
          assessmentPid: config.pid,
          labId: config.labId,
          ...config.userMetadata,
        });
      } catch (err) {
        console.error('[roar-pa] updateUser failed (non-fatal):', err);
      }
    },
  };

  return beginningTimeline;
};
