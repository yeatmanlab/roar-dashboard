import store from 'store2';
import Papa from 'papaparse';
import { createPreloadTrials, generateAssetObject, getDevice } from '@bdelab/roar-utils';
import assets from '../../assets.json';
import { Clowder, prepareClowderCorpus, StopAfterNItems } from '@bdelab/jscat';
import { clampPositive } from './helperFunctions';

const bucketURI = 'https://storage.googleapis.com/roar-survey';

export const mediaAssets = generateAssetObject(assets, bucketURI);
export const preloadTrials = createPreloadTrials(assets, bucketURI).default;
export const isTouchScreen = getDevice() === 'mobile';

export let clowder;

const loadHyperparameters = async (task) => {
  return new Promise((resolve, reject) => {
    const filename = task === 'cva' ? 'roar_cva_hyperparameters' : 'roar_morphology_hyperparameters';
    const url = `https://storage.googleapis.com/roar-survey/en/CSV/${filename}.csv`;
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const hyperParams = results.data.reduce((acc, row) => {
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
        resolve(hyperParams);
      },
      error: (err) => {
        reject(new Error(`Failed to load hyperparameters: ${err.message}`));
      },
    });
  });
};

export const initializeClowder = async () => {
  const task = store.session.get('config').task;
  const randomSeed = store.session.get('config').randomSeed;
  const isAdaptive = store.session.get('config').isAdaptive;
  const nStartItems = store.session.get('config').nStartItems;
  const startItemSelect = store.session.get('config').startItemSelect;

  // Load hyperparameters for CVA and morphology (only for adaptive mode)
  let hyperParams = {};
  if (isAdaptive) {
    try {
      hyperParams = await loadHyperparameters(task);
      store.session.set('hyperParams', hyperParams);
    } catch (err) {
      console.warn(`Failed to load hyperparameters: ${err.message}. Proceeding with unscaled thetas.`);
    }
  }

  // Base configuration for all cats
  const baseConfig = {
    method: 'EAP',
    itemSelect: store.session('itemSelect'),
    randomSeed: 'seed-cat',
  };

  // Define task-specific cat configurations
  let catsConfig;

  if (isAdaptive && task === 'morphology') {
    // Morphology: core, new, composite_comprehension
    catsConfig = {
      practice: {
        ...baseConfig,
        nStartItems: nStartItems || 3,
        itemSelect: 'fixed',
        priorDist: 'norm',
        ...(hyperParams.morphology ? hyperParams.morphology : {}),
        randomSeed: randomSeed ? `${randomSeed}-practice` : randomSeed,
      },
      core: {
        ...baseConfig,
        nStartItems: nStartItems || 3,
        priorDist: 'norm',
        startSelect: startItemSelect,
        ...(hyperParams.morphology ? hyperParams.morphology : {}),
        randomSeed: randomSeed ? `${randomSeed}-core` : randomSeed,
      },
      new: {
        ...baseConfig,
        nStartItems: nStartItems || 3,
        priorDist: 'norm',
        startSelect: startItemSelect,
        ...(hyperParams.morphology ? hyperParams.morphology : {}),
        randomSeed: randomSeed ? `${randomSeed}-new` : randomSeed,
      },
      composite_comprehension: {
        ...baseConfig,
        nStartItems: nStartItems || 3,
        priorDist: 'norm',
        startSelect: startItemSelect,
        ...(hyperParams.composite_comprehension ? hyperParams.composite_comprehension : {}),
        randomSeed: randomSeed ? `${randomSeed}-composite` : randomSeed,
      },
    };
  } else if (isAdaptive && task === 'cva') {
    // CVA: core, secondary, composite, composite_comprehension
    catsConfig = {
      practice: {
        ...baseConfig,
        nStartItems: nStartItems || 3,
        itemSelect: 'fixed',
        priorDist: 'norm',
        ...(hyperParams.cva ? hyperParams.cva : {}),
        randomSeed: randomSeed ? `${randomSeed}-practice` : randomSeed,
      },
      core: {
        ...baseConfig,
        nStartItems: nStartItems || 3,
        startSelect: startItemSelect,
        priorDist: 'norm',
        ...(hyperParams.cva ? hyperParams.cva : {}),
        randomSeed: randomSeed ? `${randomSeed}-core` : randomSeed,
      },
      secondary: {
        ...baseConfig,
        nStartItems: nStartItems || 3,
        startSelect: startItemSelect,
        priorDist: 'norm',
        ...(hyperParams.cva ? hyperParams.cva : {}),
        randomSeed: randomSeed ? `${randomSeed}-secondary` : randomSeed,
      },
      composite_comprehension: {
        ...baseConfig,
        nStartItems: nStartItems || 3,
        priorDist: 'norm',
        startSelect: startItemSelect,
        ...(hyperParams.composite_comprehension ? hyperParams.composite_comprehension : {}),
        randomSeed: randomSeed ? `${randomSeed}-composite-comprehension` : randomSeed,
      },
    };
  } else {
    // Default configuration for other tasks
    catsConfig = {
      practice: {
        ...baseConfig,
        nStartItems: nStartItems || 0,
        randomSeed: randomSeed ? `${randomSeed}-practice` : randomSeed,
      },
      total: {
        ...baseConfig,
        nStartItems: nStartItems || 0,
        randomSeed: randomSeed ? `${randomSeed}-total` : randomSeed,
      },
      core: {
        ...baseConfig,
        nStartItems: nStartItems || 0,
        randomSeed: randomSeed ? `${randomSeed}-core` : randomSeed,
      },
      new: {
        ...baseConfig,
        nStartItems: nStartItems || 0,
        randomSeed: randomSeed ? `${randomSeed}-new` : randomSeed,
      },
      spare: {
        ...baseConfig,
        nStartItems: nStartItems || 0,
        randomSeed: randomSeed ? `${randomSeed}-spare` : randomSeed,
      },
      secondary: {
        ...baseConfig,
        nStartItems: nStartItems || 0,
        randomSeed: randomSeed ? `${randomSeed}-secondary` : randomSeed,
      },
      composite_comprehension: {
        ...baseConfig,
        nStartItems: nStartItems || 0,
        randomSeed: randomSeed ? `${randomSeed}-composite` : randomSeed,
      },
    };
  }

  // if (store.session.get('config').earlyStopping) {

  // USE EXAMPLE IN CASE OF EARLY STOPPING

  // let earlyStoppingCats = null;

  // earlyStoppingCats = new StopAfterNItems({
  //   requiredItems: {
  //     letterNameLower: store.session.get('config').nItems ?? 5,
  //     letterNameUpper: store.session.get('config').nItems ?? 5,
  //     letterPhoneme: store.session.get('config').nItems ?? 15,
  //   },
  //   logicalOperation: store.session.get('config').logicalOperation ?? 'only',
  // });

  // USE IN CASE OF SEPARATE CATS

  // const corpusLetterNameLower = encorpusLetterNameLower.map((row) => ({
  //   stimulus: row.target,
  //   zetas: [
  //     {
  //       cats: ['letterNameLower'],
  //       zeta: {
  //         a: row.a,
  //         b: row.b,
  //         c: row.c,
  //         d: row.d,
  //       },
  //     },
  //   ],
  //   ..._omit(row, ['a', 'b', 'c', 'd']),
  // }));

  const corpus = store.session.get('corpora');

  const combinedCorpus = [
    ...corpus.practice,
    ...corpus.stimulus,
    ...corpus.secondaryGroup,
    ...corpus.newGroup,
    ...corpus.spareGroup,
  ];

  const clowderCorpus = prepareClowderCorpus(
    combinedCorpus,
    ['total', 'core', 'new', 'spare', 'practice', 'secondary', 'composite_comprehension'],
    '.',
  );

  let earlyStoppingCats = null;
  if (isAdaptive) {
    const config = store.session.get('config');

    if (task === 'cva') {
      const nItemsCore = config.nItemsCore || 25;
      const nItemsSecondary = config.nItemsSecondary || 0;
      earlyStoppingCats = new StopAfterNItems({
        requiredItems: {
          core: nItemsCore,
          secondary: nItemsSecondary,
        },
        logicalOperation: 'only',
      });
    } else if (task === 'morphology') {
      // For morphology, stop after 25 core items (consistent with CVA)
      const nItemsCore = config.nItemsCore || 25;
      earlyStoppingCats = new StopAfterNItems({
        requiredItems: {
          core: nItemsCore,
        },
        logicalOperation: 'only',
      });
    }
  }

  clowder = new Clowder({
    cats: catsConfig, // [spare, new, core, total] cats
    corpus: clowderCorpus,
    randomSeed: store.session.get('config').randomSeed ?? 'random-seed',
    earlyStopping: earlyStoppingCats,
  });

  store.session.set('clowder', clowder);
};

export const scaleTheta = (thetaRaw, thetaSERaw, thetaComprehensionRaw, thetaSEComprehensionRaw) => {
  const task = store.session.get('config').task;
  const hyperParams = store.session.get('hyperParams') || {};
  const taskHyperParams = hyperParams[task];
  const comprehensionHyperParams = hyperParams.composite_comprehension;

  if (!taskHyperParams) {
    return [thetaRaw, clampPositive(thetaSERaw), thetaComprehensionRaw, clampPositive(thetaSEComprehensionRaw)];
  }

  const { transformationScale, transformationShift } = taskHyperParams;
  const thetaScaled = thetaRaw * transformationScale + transformationShift;
  const thetaSEScaled = thetaSERaw * Math.abs(transformationScale);

  let thetaScaledComprehension = thetaComprehensionRaw;
  let thetaSEScaledComprehension = thetaSEComprehensionRaw;

  if (comprehensionHyperParams) {
    const { transformationScale: comprehensionScale, transformationShift: comprehensionShift } =
      comprehensionHyperParams;
    thetaScaledComprehension = thetaComprehensionRaw * comprehensionScale + comprehensionShift;
    thetaSEScaledComprehension = thetaSEComprehensionRaw * Math.abs(comprehensionScale);
  }

  return [
    thetaScaled,
    clampPositive(thetaSEScaled),
    thetaScaledComprehension,
    clampPositive(thetaSEScaledComprehension),
  ];
};

export const setNextStimulus = () => {
  const itemGroupCounter = store.session.get('itemGroupCounter');
  const coreRemaining = store.session.get('coreRemaining');
  const newRemaining = store.session.get('newRemaining');
  const spareRemaining = store.session.get('spareRemaining');
  const practiceRemaining = store.session.get('practiceRemaining');
  const task = store.session.get('config').task;
  const isAdaptive = store.session.get('config').isAdaptive;
  const grade = store.session.get('config').userMetadata?.grade;
  const forceSecondaryBehavior = store.session.get('config').forceSecondaryBehavior;

  let catToSelect;

  if (practiceRemaining > 0) {
    catToSelect = 'practice';
    store.session.set('practiceRemaining', practiceRemaining - 1);
  } else if (isAdaptive && task === 'cva') {
    // Determine secondary behavior based on forceSecondaryBehavior parameter
    let isSecondary;
    if (forceSecondaryBehavior === true) {
      isSecondary = true;
    } else if (forceSecondaryBehavior === false) {
      isSecondary = false;
    } else {
      // Default: grade-based behavior
      isSecondary = (grade ?? 0) >= 6;
    }

    const secondaryRemaining = store.session.get('secondaryRemaining') ?? 0;

    if (isSecondary) {
      // Secondary: 25 core items, 5 secondary items (1 secondary for every 5 core items)
      catToSelect =
        coreRemaining > 0
          ? itemGroupCounter % 5 === 0 && secondaryRemaining > 0 && itemGroupCounter > 0
            ? 'secondary'
            : 'core'
          : secondaryRemaining > 0
            ? 'secondary'
            : undefined;

      if (catToSelect) {
        if (catToSelect === 'core') {
          store.session.set('coreRemaining', coreRemaining - 1);
          store.session.set('itemGroupCounter', itemGroupCounter + 1);
        } else if (catToSelect === 'secondary') {
          store.session.set('secondaryRemaining', secondaryRemaining - 1);
          store.session.set('itemGroupCounter', itemGroupCounter + 1);
        }
      }
    } else {
      // Elementary: 25 core items only
      catToSelect = coreRemaining > 0 ? 'core' : undefined;

      if (catToSelect) {
        store.session.set('coreRemaining', coreRemaining - 1);
      }
    }
  } else if (isAdaptive && task === 'morphology') {
    // Adaptive morphology: cycle through core and new items
    catToSelect =
      coreRemaining > 0
        ? itemGroupCounter % 4 === 0 && newRemaining > 0 && itemGroupCounter > 0
          ? 'new'
          : 'core'
        : newRemaining > 0
          ? 'new'
          : undefined;

    if (catToSelect) {
      if (catToSelect === 'core') {
        store.session.set('coreRemaining', coreRemaining - 1);
        store.session.set('itemGroupCounter', itemGroupCounter + 1);
      } else if (catToSelect === 'new') {
        store.session.set('newRemaining', newRemaining - 1);
        store.session.set('itemGroupCounter', 0);
      }
    }
  } else {
    // Legacy logic for non-adaptive morphology and other variants
    catToSelect =
      coreRemaining > 0
        ? itemGroupCounter % 4 === 0 && newRemaining > 0 && itemGroupCounter > 0
          ? 'new'
          : 'core'
        : newRemaining > 0
          ? itemGroupCounter % 4 === 0 && spareRemaining > 0 && itemGroupCounter > 0
            ? 'spare'
            : 'new'
          : spareRemaining > 0
            ? 'spare'
            : undefined;

    if (catToSelect) {
      if (catToSelect === 'core') {
        store.session.set('coreRemaining', coreRemaining - 1);
        store.session.set('itemGroupCounter', itemGroupCounter + 1);
      } else if (catToSelect === 'new') {
        store.session.set('newRemaining', newRemaining - 1);
        store.session.set('itemGroupCounter', 0);
      } else if (catToSelect === 'spare') {
        store.session.set('spareRemaining', spareRemaining - 1);
        store.session.set('itemGroupCounter', 0);
      }
      // Update remaining items and reset counters
      store.session.set('itemGroupCounter', itemGroupCounter + 1);
    }
  }

  store.session.set('catName', catToSelect);

  const previousItem = store.session.get('previousItem');
  const previousAnswer = store.session.get('previousAnswer');

  // Determine which cats to update based on task and isAdaptive flag
  let catsToUpdate = [];
  if (isAdaptive && task === 'morphology') {
    catsToUpdate = ['core', 'new', 'composite_comprehension'];
  } else if (isAdaptive && task === 'cva') {
    catsToUpdate = ['core', 'secondary', 'composite_comprehension'];
  } else {
    // Default: update all cats
    catsToUpdate = catToSelect ? [catToSelect] : [];
  }

  const nextStimulus = clowder.updateCatAndGetNextItem({
    catToSelect,
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
