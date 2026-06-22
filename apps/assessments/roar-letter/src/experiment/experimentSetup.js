/* eslint-disable import/no-cycle */
import store from 'store2';
import i18next from 'i18next';
import { getDevice } from '@bdelab/roar-utils';
import { Cat, Clowder, StopAfterNItems, prepareClowderCorpus } from '@bdelab/jscat';

// English
import enLetterCatCorpus from '../stimuli/en/letter_foundational_composite.csv';
import enCALetterCatCorpus from '../stimuli/en-ca/letterCatCorpus.csv';
import esLetterCatCorpus from '../stimuli/es/letterCatCorpus.csv';
import itLetterCatCorpus from '../stimuli/it/letterCatCorpus.csv';

// IRT hyperparameters
import irtHyperparameters from '../stimuli/en/letter_irt_hyperparameters.csv';

const catOrderMap = {
  0: 'letterNamePractice',
  1: 'letterNameLower',
  2: 'letterNameUpper',
  3: 'letterPhonemePractice',
  4: 'letterPhoneme',
};

const catToSubTaskMap = {
  letterNamePractice: 'LetterPractice',
  letterNameLower: 'LowercaseNames',
  letterNameUpper: 'UppercaseNames',
  letterPhonemePractice: 'PhonemePractice',
  letterPhoneme: 'Phonemes',
};

export const isTouchScreen = getDevice() === 'mobile';

// eslint-disable-next-line import/no-mutable-exports
export let clowder;

// eslint-disable-next-line import/no-mutable-exports
export let cat;

const hyperParams = irtHyperparameters.reduce((acc, row) => {
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

export const initializeClowder = () => {
  const config = store.session.get('config');
  if (!config) {
    throw new Error('config not found');
  }

  const {
    initialTheta,
    itemSelectMethod,
    logicalOperation,
    method,
    nItems,
    nItemsBeforeBreak,
    nItemsBeforeBreakPhoneme,
    nItemsPhoneme,
    userMode,
    randomSeed,
    nStartItems,
    startSelectMethod,
  } = config;

  const baseCatConfig = {
    method: method.toLowerCase(),
    theta: initialTheta,
  };

  const practiceConfig = {
    ...baseCatConfig,
    itemSelect: 'fixed',
  };

  const testConfig = {
    ...baseCatConfig,
    nStartItems,
    startSelect: startSelectMethod,
    itemSelect: itemSelectMethod,
  };

  // Define the `cats` configuration
  const catsConfig = {
    letterNamePractice: {
      ...practiceConfig,
      ...hyperParams.composite,
      randomSeed: randomSeed ? `${randomSeed}-lower-practice` : randomSeed,
    },
    letterNameLower: {
      ...testConfig,
      ...hyperParams.composite,
      randomSeed: randomSeed ? `${randomSeed}-lower` : randomSeed,
    },
    letterNameUpper: {
      ...testConfig,
      ...hyperParams.composite,
      randomSeed: randomSeed ? `${randomSeed}-upper` : randomSeed,
    },
    letterPhonemePractice: {
      ...practiceConfig,
      ...hyperParams.composite,
      randomSeed: randomSeed ? `${randomSeed}-phoneme-practice` : randomSeed,
    },
    letterPhoneme: {
      ...testConfig,
      ...hyperParams.composite,
      randomSeed: randomSeed ? `${randomSeed}-phoneme` : randomSeed,
    },
    composite: {
      ...testConfig,
      ...hyperParams.composite,
      randomSeed: randomSeed ? `${randomSeed}-composite` : randomSeed,
    },
    composite_foundational: {
      ...testConfig,
      ...hyperParams.composite_foundational,
      randomSeed: randomSeed ? `${randomSeed}-composite-foundational` : randomSeed,
    },
  };

  let numItems = nItems;
  let numItemsPhoneme = nItemsPhoneme;
  store.session.set('nItemsBeforeBreak', nItemsBeforeBreak);
  store.session.set('nItemsBeforeBreakPhoneme', nItemsBeforeBreakPhoneme);

  if (userMode === 'fullRandom') {
    numItems = 26;
    numItemsPhoneme = 38;
    store.session.set('nItemsBeforeBreak', 5);
    store.session.set('nItemsBeforeBreakPhoneme', 8);
  } else if (userMode === 'halfRandom') {
    numItems = 13;
    numItemsPhoneme = 19;
    store.session.set('nItemsBeforeBreak', 5);
    store.session.set('nItemsBeforeBreakPhoneme', 5);
  } else if (userMode === 'testRandom') {
    numItems = 6;
    numItemsPhoneme = 6;
    store.session.set('nItemsBeforeBreak', 3);
    store.session.set('nItemsBeforeBreakPhoneme', 3);
  } else if (userMode === 'demo') {
    numItems = 9;
    numItemsPhoneme = 9;
    store.session.set('nItemsBeforeBreak', 3);
    store.session.set('nItemsBeforeBreakPhoneme', 3);
  } else if (userMode && userMode.startsWith('blockConfig(')) {
    const blockConfigMatch = userMode.match(/^blockConfig\(\[([\d,]+)\]\)$/);
    if (blockConfigMatch) {
      numItems = blockConfigMatch[1]
        .split(',')
        .map(Number)
        .reduce((sum, num) => sum + num, 0);
    } else {
      numItems = 26; // Fallback value
    }
    if (i18next.language === 'es') {
      numItemsPhoneme = 62;
      store.session.set('nItemsBeforeBreak', 9);
      store.session.set('nItemsBeforeBreakPhoneme', 13);
    } else if (i18next.language === 'it') {
      numItemsPhoneme = 40;
      store.session.set('nItemsBeforeBreak', 7);
      store.session.set('nItemsBeforeBreakPhoneme', 8);
    } else {
      numItemsPhoneme = 38;
      store.session.set('nItemsBeforeBreak', 5);
      store.session.set('nItemsBeforeBreakPhoneme', 8);
    }
  } else if (userMode === 'shortLetter') {
    numItems = 5;
    numItemsPhoneme = 32;
    store.session.set('nItemsBeforeBreakPhoneme', 8);
  }

  const earlyStoppingCats = new StopAfterNItems({
    requiredItems: {
      letterNameLower: numItems ?? 5,
      letterNameUpper: numItems ?? 5,
      letterPhoneme: numItemsPhoneme ?? 15,
    },
    logicalOperation,
  });

  function corpusToPrepare() {
    if (i18next.language === 'es') {
      return esLetterCatCorpus;
    }
    if (i18next.language === 'it') {
      return itLetterCatCorpus;
    }
    if (i18next.language === 'en-CA') {
      return enCALetterCatCorpus;
    }
    return enLetterCatCorpus;
  }

  const clowderCorpus = prepareClowderCorpus(
    corpusToPrepare(),
    [
      'letterNamePractice',
      'letterNameLower',
      'letterNameUpper',
      'letterPhonemePractice',
      'letterPhoneme',
      'composite',
      'composite_foundational',
    ],
    '.',
  );

  if (store.session.get('config').task !== 'phonics') {
    store.session.set('corpusLetterAll', clowderCorpus);
  }

  clowder = new Clowder({
    cats: catsConfig,
    corpus: clowderCorpus,
    randomSeed: store.session.get('config').randomSeed,
    earlyStopping: earlyStoppingCats,
  });
};

export const scaleTheta = (thetaRaw, thetaSERaw) => {
  const { transformationScale, transformationShift } = hyperParams.composite;
  const thetaScaled = thetaRaw * transformationScale + transformationShift;
  const thetaSEScaled = thetaSERaw * Math.abs(transformationScale);

  return [thetaScaled, thetaSEScaled];
};

export const moveToNextBlock = () => {
  const catIndex = (store.session.get('currentCatIndex') ?? -1) + 1;
  store.session.set('subTaskName', catToSubTaskMap[catOrderMap[catIndex]]);
  store.session.set('currentCatIndex', catIndex);
  store.session.set('correctItems', []);
  store.session.set('incorrectItems', []);
  store.session.set('trialNumSubtask', 0); // counter for trials in subtask
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

const isPracticeCat = (catName) => catName.toLowerCase().includes('practice');

export const setNextStimulus = (ignorePreviousItem = false) => {
  const catIndex = safeGetCatIndex();
  const catName = catOrderMap[catIndex];

  store.session.set('currentCat', catName);
  const previousItem = ignorePreviousItem ? undefined : store.session.get('previousItem');
  const previousAnswer = ignorePreviousItem ? undefined : store.session.get('previousAnswer');

  const isPractice = isPracticeCat(catName);
  const catToSelect = isPractice ? catName : 'composite';

  // Practice trials lack item parameters for composite and composite_foundational,
  // so their theta estimates are never updated. We include them in catsToUpdate anyway
  // because they will be safely skipped during updates due to having NA as their zetas.
  const catsToUpdate = ['letterNameLower', 'letterNameUpper', 'letterPhoneme', 'composite_foundational', 'composite'];

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
    store.session.remove('nextStimulus');
  } else {
    store.session.set('nextStimulus', nextStimulus);
  }
};

export const initializeCat = () => {
  cat = new Cat({
    method: 'MLE',
    itemSelect: store.session.get('config').itemSelectMethod,
  });
};
