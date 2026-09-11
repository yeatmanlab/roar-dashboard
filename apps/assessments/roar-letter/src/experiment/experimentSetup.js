import store from 'store2';
import i18next from 'i18next';
import { getDevice } from '@bdelab/roar-utils';
import { Cat, Clowder, StopAfterNItems, prepareClowderCorpus } from '@bdelab/jscat';
import {
  PHONICS_TASK_IDS,
  LETTER_CAT_NAMES,
  LETTER_SUBTASK_DOMAINS,
  LETTER_LANGUAGE_CODES,
} from '@roar-platform/assessment-schema/roar-letter';
import { COMPOSITE_DOMAIN, COMPOSITE_FOUNDATIONAL_DOMAIN } from '@roar-platform/assessment-schema';

// English
import enLetterCatCorpus from '../stimuli/en/letter_foundational_composite.csv';
import enCALetterCatCorpus from '../stimuli/en-ca/letterCatCorpus.csv';
import esLetterCatCorpus from '../stimuli/es/letterCatCorpus.csv';
import itLetterCatCorpus from '../stimuli/it/letterCatCorpus.csv';

// IRT hyperparameters
import irtHyperparameters from '../stimuli/en/letter_irt_hyperparameters.csv';

const catOrderMap = {
  0: LETTER_CAT_NAMES.LETTER_NAME_PRACTICE,
  1: LETTER_CAT_NAMES.LETTER_NAME_LOWER,
  2: LETTER_CAT_NAMES.LETTER_NAME_UPPER,
  3: LETTER_CAT_NAMES.LETTER_PHONEME_PRACTICE,
  4: LETTER_CAT_NAMES.LETTER_PHONEME,
};

const catToSubTaskMap = {
  [LETTER_CAT_NAMES.LETTER_NAME_PRACTICE]: LETTER_SUBTASK_DOMAINS.LETTER_PRACTICE,
  [LETTER_CAT_NAMES.LETTER_NAME_LOWER]: LETTER_SUBTASK_DOMAINS.LOWERCASE_NAMES,
  [LETTER_CAT_NAMES.LETTER_NAME_UPPER]: LETTER_SUBTASK_DOMAINS.UPPERCASE_NAMES,
  [LETTER_CAT_NAMES.LETTER_PHONEME_PRACTICE]: LETTER_SUBTASK_DOMAINS.PHONEME_PRACTICE,
  [LETTER_CAT_NAMES.LETTER_PHONEME]: LETTER_SUBTASK_DOMAINS.PHONEMES,
};

export const isTouchScreen = getDevice() === 'mobile';

export let clowder;

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
    [LETTER_CAT_NAMES.LETTER_NAME_PRACTICE]: {
      ...practiceConfig,
      ...hyperParams[COMPOSITE_DOMAIN],
      randomSeed: randomSeed ? `${randomSeed}-lower-practice` : randomSeed,
    },
    [LETTER_CAT_NAMES.LETTER_NAME_LOWER]: {
      ...testConfig,
      ...hyperParams[COMPOSITE_DOMAIN],
      randomSeed: randomSeed ? `${randomSeed}-lower` : randomSeed,
    },
    [LETTER_CAT_NAMES.LETTER_NAME_UPPER]: {
      ...testConfig,
      ...hyperParams[COMPOSITE_DOMAIN],
      randomSeed: randomSeed ? `${randomSeed}-upper` : randomSeed,
    },
    [LETTER_CAT_NAMES.LETTER_PHONEME_PRACTICE]: {
      ...practiceConfig,
      ...hyperParams[COMPOSITE_DOMAIN],
      randomSeed: randomSeed ? `${randomSeed}-phoneme-practice` : randomSeed,
    },
    [LETTER_CAT_NAMES.LETTER_PHONEME]: {
      ...testConfig,
      ...hyperParams[COMPOSITE_DOMAIN],
      randomSeed: randomSeed ? `${randomSeed}-phoneme` : randomSeed,
    },
    [COMPOSITE_DOMAIN]: {
      ...testConfig,
      ...hyperParams[COMPOSITE_DOMAIN],
      randomSeed: randomSeed ? `${randomSeed}-composite` : randomSeed,
    },
    [COMPOSITE_FOUNDATIONAL_DOMAIN]: {
      ...testConfig,
      ...hyperParams[COMPOSITE_FOUNDATIONAL_DOMAIN],
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
    if (i18next.language === LETTER_LANGUAGE_CODES.ES) {
      numItemsPhoneme = 62;
      store.session.set('nItemsBeforeBreak', 9);
      store.session.set('nItemsBeforeBreakPhoneme', 13);
    } else if (i18next.language === LETTER_LANGUAGE_CODES.IT) {
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
      [LETTER_CAT_NAMES.LETTER_NAME_LOWER]: numItems ?? 5,
      [LETTER_CAT_NAMES.LETTER_NAME_UPPER]: numItems ?? 5,
      [LETTER_CAT_NAMES.LETTER_PHONEME]: numItemsPhoneme ?? 15,
    },
    logicalOperation,
  });

  function corpusToPrepare() {
    if (i18next.language === LETTER_LANGUAGE_CODES.ES) {
      return esLetterCatCorpus;
    }
    if (i18next.language === LETTER_LANGUAGE_CODES.IT) {
      return itLetterCatCorpus;
    }
    if (i18next.language === LETTER_LANGUAGE_CODES.EN_CA) {
      return enCALetterCatCorpus;
    }
    return enLetterCatCorpus;
  }

  const clowderCorpus = prepareClowderCorpus(
    corpusToPrepare(),
    [
      LETTER_CAT_NAMES.LETTER_NAME_PRACTICE,
      LETTER_CAT_NAMES.LETTER_NAME_LOWER,
      LETTER_CAT_NAMES.LETTER_NAME_UPPER,
      LETTER_CAT_NAMES.LETTER_PHONEME_PRACTICE,
      LETTER_CAT_NAMES.LETTER_PHONEME,
      COMPOSITE_DOMAIN,
      COMPOSITE_FOUNDATIONAL_DOMAIN,
    ],
    '.',
  );

  if (store.session.get('config').task !== PHONICS_TASK_IDS.EN) {
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
  const { transformationScale, transformationShift } = hyperParams[COMPOSITE_DOMAIN];
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
  const catToSelect = isPractice ? catName : COMPOSITE_DOMAIN;

  // Practice trials lack item parameters for composite and composite_foundational,
  // so their theta estimates are never updated. We include them in catsToUpdate anyway
  // because they will be safely skipped during updates due to having NA as their zetas.
  const catsToUpdate = [
    LETTER_CAT_NAMES.LETTER_NAME_LOWER,
    LETTER_CAT_NAMES.LETTER_NAME_UPPER,
    LETTER_CAT_NAMES.LETTER_PHONEME,
    COMPOSITE_FOUNDATIONAL_DOMAIN,
    COMPOSITE_DOMAIN,
  ];

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
