import store from 'store2';
import Ajv from 'ajv/dist/2020';
import addErrors from 'ajv-errors';
import _omitBy from 'lodash/omitBy';
import _isNull from 'lodash/isNull';
import _isUndefined from 'lodash/isUndefined';
import { getAgeData, getGrade } from '@bdelab/roar-utils';
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import i18next from 'i18next';
import { SRE_LANGUAGES, SRE_SCORING_VERSION, SRE_SUBTASK_DOMAINS } from '@roar-platform/assessment-schema/roar-sre';
import { writeTrial, finishRun, addInteraction, updateUser } from '@roar-platform/assessment-sdk/compat/firekit';
import { wireScoreAdapter } from '../../sdk/sre-firekit-facade';
import { getUserDataTimeline } from '../trials/getUserData';
import { jsPsych } from '../jsPsych';
import { corpus } from './loadCorpus';
import { shuffle } from '../experimentHelpers';
import { enterFullscreen } from '../trials/fullScreen';
import { sreValidityEvaluator } from '../experiment';
import parameterSchema from '../../../parameters.json';

const ajv = new Ajv({ allErrors: true });
addErrors(ajv);
const validateParams = ajv.compile(parameterSchema);

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
    return Math.random() < 0.5
      ? shuffle([SRE_SUBTASK_DOMAINS.LAB, SRE_SUBTASK_DOMAINS.AI_V1_P1])
      : shuffle([SRE_SUBTASK_DOMAINS.LAB, SRE_SUBTASK_DOMAINS.AI_V1_P2]);
  }
  if (userMode === '3min1Block') {
    return [shuffle([SRE_SUBTASK_DOMAINS.LAB, SRE_SUBTASK_DOMAINS.AI_V1_P1, SRE_SUBTASK_DOMAINS.AI_V1_P2])[0]]; // randomly select 1 out of 3 existing forms
  }
  if (userMode === '2BlocksV2') {
    return [
      shuffle([SRE_SUBTASK_DOMAINS.LAB, SRE_SUBTASK_DOMAINS.AI_V1_P1, SRE_SUBTASK_DOMAINS.AI_V1_P2])[0],
      SRE_SUBTASK_DOMAINS.AI_V2,
    ];
  }
  if (userMode === '3minBlock90sBlock') {
    return [
      shuffle([SRE_SUBTASK_DOMAINS.LAB, SRE_SUBTASK_DOMAINS.AI_V1_P1, SRE_SUBTASK_DOMAINS.AI_V1_P2])[0],
      Object.keys(corpus.fixedForms)[Math.floor(Math.random() * Object.keys(corpus.fixedForms).length)],
    ];
  }
  if (userMode === '90s2Blocks') {
    return shuffle([SRE_SUBTASK_DOMAINS.TEST1, SRE_SUBTASK_DOMAINS.TEST2]);
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
    return shuffle([SRE_SUBTASK_DOMAINS.TEST1, SRE_SUBTASK_DOMAINS.TEST2]);
  }
  return [SRE_SUBTASK_DOMAINS.LAB, SRE_SUBTASK_DOMAINS.AI];
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

export const initConfig = async (gameParams, userParams, displayElement, useParameterValidation) => {
  const cleanParams = _omitBy(_omitBy({ ...gameParams, ...userParams }, _isNull), _isUndefined);

  // Derive taskId and default scoring version from the lng param via schema constants
  const lng = cleanParams.lng ?? cleanParams.language ?? 'en';
  const languageEntry = SRE_LANGUAGES[lng] ?? SRE_LANGUAGES.en;
  const taskId = languageEntry.taskId;
  const defaultScoringVersion = languageEntry.defaultScoringVersion ?? null;

  const {
    userMode,
    assessmentPid,
    labId,
    recruitment,
    userMetadata,
    urlParams,
    consent,
    storyOption,
    language = lng,
    skipInstructions,
    grade,
    birthMonth,
    birthYear,
    age,
    ageMonths,
    timerLength,
    scoringVersion = defaultScoringVersion,
  } = cleanParams;

  const is90s2BlocksFixedForms = lng === 'en' && userMode === '90s2BlocksFixedForms';
  const scoringVersionParsed = Number.isNaN(parseInt(scoringVersion, 10))
    ? is90s2BlocksFixedForms
      ? SRE_SCORING_VERSION.V4
      : defaultScoringVersion
    : scoringVersion;

  if (language !== 'en') i18next.changeLanguage(language);

  const ageData = getAgeData(birthMonth, birthYear, age, ageMonths);

  const config = {
    taskId,
    pid: assessmentPid,
    labId,
    userMode: userMode || selectDefaultMode(language),
    recruitment: recruitment || 'pilot',
    storyOption,
    story: getStoryOption(storyOption, grade),
    userMetadata: { ...userMetadata, grade, ...ageData },
    startTime: new Date(),
    urlParams: urlParams,
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

  // updateTaskParams is deprecated and will be removed in a future version.
  // Task parameters are now recorded via the assessment-sdk run metadata.
  console.warn('[roar-sre] updateTaskParams is deprecated and has no effect.', updatedGameParams);

  if (config.useParameterValidation) {
    // Exclude the internal control flag — it is not a game parameter and is not in the schema.
    const { useParameterValidation: _useParameterValidation, ...paramsToValidate } = gameParams;
    const valid = validateParams(paramsToValidate);
    if (!valid) {
      console.warn(
        '[roar-sre] Parameter validation warnings:\n' + validateParams.errors.map((e) => e.message).join('\n'),
      );
    }
  }

  if (config.pid) {
    try {
      await updateUser({ assessmentPid: config.pid, ...userMetadata });
    } catch (err) {
      console.error('[roar-sre] updateUser failed (non-fatal):', err);
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
    finishRun().catch((err) => console.error('[roar-sre] finishRun failed:', err));
    sreValidityEvaluator.markAsCompleted();
    if (config.experimentFinished) {
      config.experimentFinished();
    }
  });

  const computedScoreCallback = wireScoreAdapter();

  jsPsych.opts.on_data_update = extend(jsPsych.opts.on_data_update, (data) => {
    if (data.save_trial) {
      writeTrial(data, computedScoreCallback).catch((err) => console.error('[roar-sre] writeTrial failed:', err));
    }
  });
  jsPsych.opts.on_interaction_data_update = function (data) {
    addInteraction(data);
  };

  initStore(config);
};

export const initRoarTimeline = () => {
  const beginningTimeline = [
    enterFullscreen,
    ...getUserDataTimeline,
    {
      type: jsPsychCallFunction,
      async: true,
      func: async (done) => {
        const cfg = store.session.get('config');
        cfg.pid = cfg.pid || makePid();
        try {
          await updateUser({ assessmentPid: cfg.pid, labId: cfg.labId, ...cfg.userMetadata });
        } catch (err) {
          console.error('[roar-sre] updateUser failed (non-fatal):', err);
        }
        done();
      },
    },
  ];

  return beginningTimeline;
};
