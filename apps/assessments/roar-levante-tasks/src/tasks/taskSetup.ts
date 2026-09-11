//@ts-ignore
import { getDevice } from '@bdelab/roar-utils';
import { Cat, Clowder, StopAfterNItems, prepareClowderCorpus } from '@bdelab/jscat';
import { initJsPsych } from 'jspsych';
import '../i18n/i18n';
import { taskStore } from '../taskStore';
import { Logger } from '../utils';
import { ClowderThetaEstimates } from './shared/types/catTypes';
import {
  CLOWDER_CONFIG,
  CLOWDER_SELECTION_CONFIG,
  CLOWDER_IRT_HYPERPARAMS,
  CLOWDER_EARLY_STOPPING_RULES,
  CLOWDER_CORPUS_PARAMS,
  createScaleTheta,
  getIrtHyperparameters,
} from './shared/helpers/clowderSetup';

export const isTouchScreen = getDevice() === 'mobile';

export let cat: any;

export let clowder: any;

export let scaleTheta: (thetaRaw: number, thetaSERaw: number, cat?: string) => ClowderThetaEstimates;

export const seenCatItemsCount: Record<string, number> = {};

const { runCat } = taskStore();

export const initializeCat = () => {
  cat = new Cat({
    method: 'MLE',
    minTheta: -6,
    maxTheta: 6,
    theta: taskStore().startingTheta || 0,
    itemSelect: taskStore().itemSelect,
  });
};

export const initializeClowder = async (config: Record<string, any>) => {
  if (!config) {
    throw new Error('Config is not found');
  }

  const { task, scoringVersion, corpora, randomSeed } = taskStore();

  const clowderConfig = CLOWDER_CONFIG[task]?.[scoringVersion];
  const clowderSelectionConfig = CLOWDER_SELECTION_CONFIG[task]?.[scoringVersion];

  if (!clowderConfig) {
    throw new Error('Clowder config is not found');
  }

  for (const corpusToSelectFrom of Object.values(clowderSelectionConfig.catOrderMap)) {
    seenCatItemsCount[corpusToSelectFrom] = 0;
  }

  const { csvUrl } = CLOWDER_IRT_HYPERPARAMS[task]?.[scoringVersion] ?? {};

  if (!csvUrl) {
    throw new Error('IRT hyperparameters CSV URL is not found');
  }

  const irtHyperparams = await getIrtHyperparameters(csvUrl);

  scaleTheta = createScaleTheta(irtHyperparams);

  const baseConfig = {
    theta: taskStore().startingTheta,
    // Defaults to what letter uses
    method: clowderConfig.method?.toLowerCase() ?? 'eap',
  };

  const practiceConfig = {
    ...baseConfig,
    priorDist: clowderConfig.priorDist,
    // Fixed after ordering by cat zetas
    itemSelect: 'fixed',
  };

  const blockConfigs = Object.fromEntries(
    clowderSelectionConfig.catsToUpdate.map((catName) => [
      catName,
      {
        ...baseConfig,
        ...clowderConfig,
        // When catName (trial_type) is not found in irtHyperparams, use composite for params other than scale & transformation
        ...(irtHyperparams[catName] ? irtHyperparams[catName] : irtHyperparams['composite']),
        // Pass randomSeed if we want to show the same randomized order of items.
        randomSeed,
      },
    ]),
  );

  const catConfig = {
    practice: practiceConfig,
    ...blockConfigs,
  };

  const earlyStoppingCats = new StopAfterNItems({
    ...CLOWDER_EARLY_STOPPING_RULES[task][scoringVersion],
  });

  const { catNames, delimiter } = CLOWDER_CORPUS_PARAMS[task][scoringVersion];
  const clowderCorpus = await prepareClowderCorpus(corpora.stimulus, catNames, delimiter);

  clowder = new Clowder({
    cats: catConfig,
    corpus: clowderCorpus,
    earlyStopping: earlyStoppingCats,
    randomSeed,
  });
};

export const moveToNextBlock = (customIndex?: number) => {
  const { currentCatBlock, task, scoringVersion } = taskStore();
  const { catOrderMap } = CLOWDER_SELECTION_CONFIG[task][scoringVersion];

  if (customIndex != undefined && customIndex >= 0) {
    if (!catOrderMap[customIndex]) {
      throw new Error('Cannot set to block not in catOrderMap');
    }

    taskStore('currentCatBlock', customIndex);
    return;
  }

  // Default to moving to the next block
  taskStore('currentCatBlock', (currentCatBlock ?? -1) + 1);
};

export const setNextStimulus = ({ ignorePreviousItem = false, additionalItemsToRemove = [] } = {}) => {
  const { task, currentCatBlock, scoringVersion, previousItem, previousAnswer } = taskStore();
  const { catOrderMap, catsToUpdate: taskCatsToUpdate } = CLOWDER_SELECTION_CONFIG[task][scoringVersion];

  const safeCatBlock = currentCatBlock ?? 0;
  const corpusToSelectFrom = catOrderMap[safeCatBlock];
  const catsToUpdate = corpusToSelectFrom.includes('practice') ? [corpusToSelectFrom] : taskCatsToUpdate;

  const nextStimulus = clowder.updateCatAndGetNextItem({
    catToSelect: corpusToSelectFrom, // The Cat instance to use for selecting the next stimulus.
    corpusToSelectFrom, // The "block" to use for selecting the next stimulus. If not provided, `catToSelect` will be used.
    catsToUpdate, // A single Cat or array of Cats for which to update ability estimates.
    items: ignorePreviousItem ? undefined : previousItem,
    answers: ignorePreviousItem ? undefined : previousAnswer,
    additionalItemsToRemove,
    randomlySelectUnvalidated: false,
  });

  if (nextStimulus == undefined) {
    // store2 considered undefined values as no change, so we need to use null
    taskStore('nextStimulus', null);
    moveToNextBlock();
  } else {
    seenCatItemsCount[corpusToSelectFrom] += 1;
    taskStore('nextStimulus', nextStimulus);
  }
};

export const jsPsych = initJsPsych({
  on_data_update: function (data: Record<string, any>) {
    // Removing stimulus from data to avoid sending large html files to Levante
    const { stimulus, task, ...rest } = data;
    const logger = Logger.getInstance();
    // Avoid logging fixation trials
    if (task !== 'fixation') {
      logger.capture('JsPsych Data Update', rest);
    }
  },
});

window.initJsPsych = jsPsych;
