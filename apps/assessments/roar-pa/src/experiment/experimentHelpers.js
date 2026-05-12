import jsPsychCallFunction from '@jspsych/plugin-call-function';
import store from 'store2';
import i18next from 'i18next';
import { Clowder, StopAfterNItems, prepareClowderCorpus } from '@bdelab/jscat';
import _clamp from 'lodash/clamp';
import _mapValues from 'lodash/mapValues';
import _omitBy from 'lodash/omitBy';
import { camelize } from '@bdelab/roar-utils';
import { jsPsych } from './jsPsych';
import { mediaAssets, paValidityEvaluator } from './experiment';
import './i18n';
import irtHyperparameters from './config/corpus/en/irt_hyperparameters.csv';

const catOrderMap = {
  0: 'practiceFSM',
  1: 'fsm',
  2: 'practiceLSM',
  3: 'lsm',
  4: 'practiceDEL',
  5: 'del',
};

let clowder;

const hyperMap = irtHyperparameters.reduce((acc, row) => {
  const key = row.trial_type.toLowerCase();
  acc[key] = {
    minTheta: Number(row['theta.min']),
    maxTheta: Number(row['theta.max']),
    priorPar: [Number(row['theta.mean']), Number(row['theta.sd'])],
    transformationScale: Number(row['transformation.scale']),
    transformationShift: Number(row['transformation.shift']),
  };
  return acc;
}, {});

const makeFinite = (num) => _clamp(num, Number.MIN_VALUE, Number.MAX_VALUE);

export const initClowder = (config) => {
  // Build hyperparameter map from CSV

  // Define the `cats` configuration
  const catsConfig = {
    practiceFSM: {
      method: config.abilityMethod,
      itemSelect: 'fixed',
      priorDist: 'norm',
      randomSeed: 'seed-fsm-practice',
    },
    fsm: {
      method: config.abilityMethod,
      itemSelect: config.itemSelect,
      priorDist: 'norm',
      ...hyperMap.fsm,
      randomSeed: 'seed-fsm',
    },
    practiceLSM: {
      method: config.abilityMethod,
      itemSelect: 'fixed',
      priorDist: 'norm',
      randomSeed: 'seed-lsm-practice',
    },
    lsm: {
      method: config.abilityMethod,
      itemSelect: config.itemSelect,
      priorDist: 'norm',
      ...hyperMap.lsm,
      randomSeed: 'seed-lsm',
    },
    practiceDEL: {
      method: config.abilityMethod,
      itemSelect: 'fixed',
      priorDist: 'norm',
      randomSeed: 'seed-del-practice',
    },
    del: {
      method: config.abilityMethod,
      itemSelect: config.itemSelect,
      priorDist: 'norm',
      ...hyperMap.del,
      randomSeed: 'seed-del',
    },
    composite: {
      method: config.abilityMethod,
      itemSelect: config.itemSelect,
      priorDist: 'norm',
      ...hyperMap.composite,
      randomSeed: 'seed-composite',
    },
  };

  let earlyStopping;
  const { numTestItems } = config;

  // If the number of test items is specified, use early stopping
  if (numTestItems) {
    earlyStopping = new StopAfterNItems({
      requiredItems: {
        fsm: numTestItems,
        lsm: numTestItems,
        del: numTestItems,
      },
      logicalOperation: 'only',
    });
  }

  const corpus = store.session.get('corpus');
  const combinedCorpus = [
    ...corpus.practice_DEL,
    ...corpus.practice_FSM,
    ...corpus.practice_LSM,
    ...corpus.test_DEL,
    ...corpus.test_FSM,
    ...corpus.test_LSM,
  ];

  const clowderCorpus = prepareClowderCorpus(
    combinedCorpus,
    ['practiceFSM', 'practiceLSM', 'practiceDEL', 'fsm', 'lsm', 'del', 'composite'],
    '.',
  );

  store.session.set('corpusClowder', clowderCorpus);

  clowder = new Clowder({
    cats: catsConfig,
    corpus: clowderCorpus,
    randomSeed: store.session.get('config').randomSeed,
    earlyStopping: earlyStopping,
  });
};

export const moveToNextBlock = () => {
  const catIndex = (store.session.get('currentCatIndex') ?? -1) + 1;
  store.session.set('currentCatIndex', catIndex);
};

const safeGetCatIndex = () => {
  let catIndex = store.session.get('currentCatIndex');

  // eslint-disable-next-line eqeqeq
  if (catIndex == undefined) {
    store.session.set('currentCatIndex', 0);
    catIndex = 0;
  }

  return catIndex;
};

const isPracticeCat = (catName) => catName.includes('practice');

export const setNextStimulus = (ignorePreviousItem = false) => {
  const catIndex = safeGetCatIndex();
  const catName = catOrderMap[catIndex];
  const previousItem = ignorePreviousItem ? undefined : store.session.get('previousItem');
  const previousAnswer = ignorePreviousItem ? undefined : store.session.get('previousAnswer');

  const isPractice = isPracticeCat(catName);
  const catToSelect = isPractice ? catName : 'composite';

  const catsToUpdate = ['practiceFSM', 'fsm', 'practiceLSM', 'lsm', 'practiceDEL', 'del'];

  if (!isPractice) {
    catsToUpdate.push('composite');
  }

  const catToEvaluateEarlyStopping = isPractice ? catToSelect : catName;

  const nextStimulus = clowder.updateCatAndGetNextItem({
    catToSelect,
    corpusToSelectFrom: catName,
    catToEvaluateEarlyStopping,
    catsToUpdate,
    items: previousItem ?? undefined,
    answers: previousAnswer ?? undefined,
    randomlySelectUnvalidated: false,
  });

  if (nextStimulus === undefined) {
    store.session.remove('currentStimulus');
    moveToNextBlock();
  } else {
    store.session.set('currentStimulus', nextStimulus);
  }
};

const sentryFeedback = document.querySelector('#sentry-feedback');

export const saveTrialData = (data, source) => {
  let response;

  if (source === 'button') {
    response = store.session('currentStimulus').arrayShow[data.button_response];
  } else {
    response = store.session('currentStimulus').arrayShow[data.response];
  }

  store.session.set('feedbackImage', mediaAssets.images[response]);
  store.session.transact('trialNumBlock', (oldVal) => oldVal + 1);

  if (store.session('currentStimulus').task === 'test') {
    store.session.transact('trialNumTotal', (oldVal) => oldVal + 1);
  }

  if (response === store.session('currentStimulus').goal) {
    store.session.set('previousAnswer', 1);
    store.session.set('previousItem', store.session.get('currentStimulus'));
    store.session.set('feedbackAudio', store.session('currentStimulus').feedback_conf);
    store.session.set('response', 1);
    store.session.set('incorrectCounter', 0);
  } else {
    store.session.set('response', 0);
    store.session.set('previousAnswer', 0);
    store.session.set('previousItem', store.session('currentStimulus'));
    if (response === store.session('currentStimulus').foil1) {
      store.session.set('feedbackAudio', store.session('currentStimulus').feedback_foil1);
    } else {
      store.session.set('feedbackAudio', store.session('currentStimulus').feedback_foil2);
    }
    store.session.transact('incorrectCounter', (oldVal) => oldVal + 1);
  }

  paValidityEvaluator.addResponseData(data.rt, data.response, store.session('response'));

  const trialData = {
    subtask: store.session('currentStimulus').trial_type,
    trialNumBlock: store.session('trialNumBlock'),
    trialNumTotal: store.session('trialNumTotal'),
    corpusId: store.session('currentStimulus').task,
    stim: store.session('currentStimulus').stimulus,
    goal: store.session('currentStimulus').goal,
    itemId: store.session('currentStimulus').itemId,
    correct: store.session('response'),
    response,
    pid: store.session.get('config').pid,
    itemSelect: store.session('config').isAdaptive ? store.session('itemSelect') : 'fixed',
  };

  let adaptiveTrialData = {};

  if (store.session('config').isAdaptive) {
    const catIndex = safeGetCatIndex();
    const catName = catOrderMap[catIndex];
    const isPractice = isPracticeCat(catName);
    const ignorePreviousItem = isPractice && store.session('response') === 0;

    const zetas = store.session('currentStimulus')?.zetas ?? [];
    const catParameterPairs = [];
    zetas.forEach(({ cats, zeta }) => {
      for (const cat of cats) {
        catParameterPairs.push([cat, zeta]);
      }
    });
    const itemParameters = Object.fromEntries(catParameterPairs);

    setNextStimulus(ignorePreviousItem);

    const { transformationScale, transformationShift } = hyperMap.composite;
    const thetaRaw = clowder.theta.composite;
    const thetaSERaw = clowder.seMeasurement.composite;
    const thetaScaled = thetaRaw * transformationScale + transformationShift;
    const thetaSEScaled = thetaSERaw * Math.abs(transformationScale);

    const thetas = _omitBy(
      {
        ...clowder.theta,
        composite: thetaRaw,
        scaled: thetaScaled,
      },
      (value, key) => isPracticeCat(key),
    );

    const thetaSEs = _mapValues(
      _omitBy(
        {
          ...clowder.seMeasurement,
          composite: thetaSERaw,
          scaled: thetaSEScaled,
        },
        (value, key) => isPracticeCat(key),
      ),
      makeFinite,
    );

    store.session.set('thetas', thetas);
    store.session.set('thetaSEs', thetaSEs);

    adaptiveTrialData = {
      thetas,
      thetaSEs,
    };

    if (!isPractice) {
      adaptiveTrialData.itemParameters = itemParameters;
      adaptiveTrialData.thetaEstimate = thetas[catName];
      adaptiveTrialData.thetaSE = thetaSEs[catName];
      adaptiveTrialData.thetaEstimateRaw = thetaRaw;
      adaptiveTrialData.thetaSERaw = makeFinite(thetaSERaw);
    }
  }

  jsPsych.data.addDataToLastTrial({
    ...trialData,
    ...adaptiveTrialData,
  });
};

export const practiceStoppingRule = (whichBlock) => {
  const { isAdaptive } = store.session('config');
  if (store.session('currentCorpusIndex') === 1) {
    // They are on the first practice item
    if (store.session('response') === 1) {
      // They got it right and aren't on the third attempt
      // Move to the next practice item
      if (!isAdaptive) {
        const corpus = store.session.get('corpus');
        store.session.set('currentStimulus', corpus[whichBlock][store.session('currentCorpusIndex')]);
      }
      store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
    } else if (store.session('trialNumBlock') === 2) {
      // They are on the second attempt, irrespective of whether they got it right or wrong
      store.session.set('incorrectCounter', 0);
      store.session.set('keepBlock', false);
      if (isAdaptive) {
        setNextStimulus();
      } else {
        const corpus = store.session.get('corpus');
        store.session.set('currentStimulus', corpus[whichBlock][store.session('currentCorpusIndex')]);
      }
      store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
    }

    return true;
  }

  // They are on the second practice item
  if (store.session('response') === 1) {
    // They got it right
    store.session.set('keepBlock', true);
    return false;
  }

  const keepLooping = store.session('incorrectCounter') !== 2;

  if (!keepLooping && isAdaptive) {
    // If we are using IRT scoring, do not skip the test block even if the
    // participant gets both practice items wrong
    setNextStimulus();
    store.session.set('keepBlock', true);
  }

  return keepLooping;
};

export const stoppingRule = () => {
  const kResponses = store.session('kResponses');
  kResponses.push(store.session('response'));

  if (kResponses.length > 6) {
    kResponses.shift();
  }
  store.session.set('kResponses', kResponses);
  // Stopping Rule:
  const sumCorrect = kResponses.reduce((a, b) => a + b, 0);
  if (store.session('trialNumBlock') >= 6) {
    if (store.session('incorrectCounter') === 3 || sumCorrect <= 2) {
      store.session.set('incorrectCounter', 0);
      store.session.set('kResponses', []);
      moveToNextBlock();
      jsPsych.endCurrentTimeline();
    }
  }
};

export const audioSetup = {
  type: jsPsychCallFunction,
  async: true,
  func: (done) => {
    const displayElement = document.getElementById('jspsych-content');

    displayElement.innerHTML = `<h1> ${i18next.t('audioSetup')} </h1> 
      <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.goBlink}" alt="canvas 1">`;

    function initAudioFiles() {
      jsPsych.pluginAPI.audioContext();
      done();
    }

    document.addEventListener('click', initAudioFiles, { once: true });

    // Hide sentry feedback report button
    if (sentryFeedback) {
      sentryFeedback.style.display = 'none';
    }
  },
};

export const waitFor = (conditionFunction) => {
  const poll = (resolve) => {
    if (conditionFunction()) resolve();
    // eslint-disable-next-line no-unused-vars
    else setTimeout((_) => poll(resolve), 400);
  };

  return new Promise(poll);
};

export const updateProgressBar = (num) => {
  const numItems = store.session.get('numItems');
  let nTestItemsTotal;
  if (store.session('config')?.numTestItems) {
    nTestItemsTotal = store.session('config').numTestItems * 3;
  } else {
    nTestItemsTotal = numItems.numItemsFSM + numItems.numItemsLSM + numItems.numItemsDEL;
  }
  if (num) {
    jsPsych.setProgressBar(num / (nTestItemsTotal + 1));
  } else {
    const curr_progress_bar_value = jsPsych.getProgressBarCompleted();
    jsPsych.setProgressBar(curr_progress_bar_value + 1 / (nTestItemsTotal + 1));
  }
};

export const updateProgressBarForLSMStart = () => {
  const numItems = store.session.get('numItems');
  if (!store.session('config')?.numTestItems) {
    updateProgressBar(numItems.numItemsFSM);
  } else {
    updateProgressBar(store.session('config').numTestItems);
  }
};

export const updateProgressBarForDELStart = () => {
  const numItems = store.session.get('numItems');
  if (!store.session('config')?.numTestItems) {
    updateProgressBar(numItems.numItemsFSM + numItems.numItemsLSM);
  } else {
    updateProgressBar(store.session('config').numTestItems * 2);
  }
};

export const updateProgressBarForEnd = () => {
  const numItems = store.session.get('numItems');
  if (!store.session('config')?.numTestItems) {
    updateProgressBar(numItems.numItemsFSM + numItems.numItemsLSM + numItems.numItemsDEL + 1); // change this for english 19, dynamically for other languages
  } else {
    updateProgressBar(store.session('config').numTestItems * 3 + 1);
  }
};

export const readyStoreForTestTrials = (subskillCorpus) => {
  const allowedSubskillCorpora = ['test_FSM', 'test_LSM', 'test_DEL'];
  if (!allowedSubskillCorpora.includes(subskillCorpus)) {
    throw new Error(`Invalid subskill corpus: ${subskillCorpus}. Expected one of ${allowedSubskillCorpora.join(', ')}`);
  }
  store.session.set('currentCorpusIndex', 0);
  store.session.set('incorrectCounter', 0);
  store.session.set('trialNumBlock', 0);
  if (!store.session('config').isAdaptive) {
    const corpus = store.session.get('corpus');
    store.session.set('currentStimulus', corpus[subskillCorpus][store.session('currentCorpusIndex')]);
  }
  store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
};

export const breakTrialConditionalFunction = (subskill) => {
  const allowedSubskills = ['del', 'lsm', 'fsm'];
  if (!allowedSubskills.includes(subskill)) {
    throw new Error(`Invalid subskill: ${subskill}. Expected one of ${allowedSubskills.join(', ')}`);
  }

  const numItems = store.session.get('numItems');
  let set;
  if (!store.session('config').numTestItems) {
    set = numItems[`numItems${subskill.toUpperCase()}`];
  } else {
    set = store.session('config')?.numTestItems;
  }
  const conditional = set % 2 === 0 ? set / 2 : Math.floor(set / 2) + 1;
  return store.session('trialNumBlock') === conditional;
};

export const testLoopFunction = (subskill) => {
  const allowedSubskills = ['del', 'lsm', 'fsm'];
  if (!allowedSubskills.includes(subskill)) {
    throw new Error(`Invalid subskill: ${subskill}. Expected one of ${allowedSubskills.join(', ')}`);
  }

  if (store.session('config').isAdaptive) {
    // eslint-disable-next-line eqeqeq
    return store.session('currentStimulus') != undefined;
  }

  const numItems = store.session.get('numItems');
  const maxNumber = store.session('config').numTestItems ?? numItems[`numItems${subskill.toUpperCase()}`];
  if (store.session('trialNumBlock') < maxNumber) {
    return true;
  }
  return false;
};

export const standardizeItemComponent = (component) => {
  if (i18next.language === 'de') {
    return component ? camelize(component) : null;
  }

  return component;
};

export const standardizeItemKey = (key) => {
  // handle special characters if running in German
  if (i18next.language === 'de' && key) {
    let processedKey = camelize(key);

    processedKey = processedKey.replace('u%CC%88', 'ü');
    processedKey = processedKey.replace('a%CC%88', 'ä');
    processedKey = processedKey.replace('o%CC%88', 'ö');

    return processedKey;
  }

  return key;
};
