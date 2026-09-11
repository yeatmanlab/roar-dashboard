import 'regenerator-runtime/runtime';
// setup
import {
  initTrialSaving,
  initTimeline,
  createPreloadTrials,
  getRealTrials,
  batchTrials,
  batchMediaAssets,
  shouldUseClowder,
  CLOWDER_SELECTION_CONFIG,
  createValidityEvaluator,
} from '../shared/helpers';
import {
  jsPsych,
  initializeCat,
  initializeClowder,
  cat,
  setNextStimulus,
  moveToNextBlock,
  seenCatItemsCount,
} from '../taskSetup';
// trials
import {
  afcStimulusTemplate,
  exitFullscreen,
  fixationOnly,
  setupStimulus,
  taskFinished,
  enterFullscreen,
  practiceTransition,
} from '../shared/trials';
import { getLayoutConfig } from './helpers/config';
import { prepareCorpus, selectNItems } from '../shared/helpers/prepareCat';
import { taskStore } from '../../taskStore';
import { preloadSharedAudio } from '../shared/helpers/preloadSharedAudio';
import type { ValidityEvaluator } from '../shared/types/catTypes';

let trogValidityEvaluator: ValidityEvaluator | null = null;

export default async function buildTROGTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  const preloadTrials = createPreloadTrials(mediaAssets).default;
  taskStore('currentCatBlock', 0);

  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);
  const timeline = [];
  const corpus: StimulusType[] = taskStore().corpora.stimulus;
  const translations: Record<string, string> = taskStore().translations;
  const validationErrorMap: Record<string, string> = {};
  const { runCat } = taskStore();
  const { semThreshold } = taskStore();

  const layoutConfigMap: Record<string, LayoutConfigType> = {};
  for (const c of corpus) {
    const { itemConfig, errorMessages } = getLayoutConfig(c, translations, mediaAssets);
    layoutConfigMap[c.itemId] = itemConfig;
    if (errorMessages.length) {
      validationErrorMap[c.itemId] = errorMessages.join('; ');
    }
  }

  if (Object.keys(validationErrorMap).length) {
    console.error('The following errors were found');
    console.table(validationErrorMap);
    throw new Error('Something went wrong. Please look in the console for error details');
  }

  // organize media assets into batches for preloading
  const batchSize = 25;
  const batchedCorpus = batchTrials(corpus, batchSize);
  const batchedMediaAssets = batchMediaAssets(mediaAssets, batchedCorpus, ['answer', 'distractors']);

  // counter for next batch to preload (skipping the initial preload)
  let currPreloadBatch = 0;

  if (taskStore().isRoarApp) {
    timeline.push(initialTimeline, preloadTrials);
  } else {
    const initialPreload = runCat ? preloadTrials : preloadSharedAudio();
    timeline.push(initialPreload, initialTimeline);
  }

  // does not matter if trial has properties that don't belong to that type
  const trialConfig = {
    trialType: 'audio',
    responseAllowed: true,
    promptAboveButtons: true,
    task: config.task,
    layoutConfig: {
      showPrompt: false,
    },
    layoutConfigMap,
    terminateCat: false,
  };

  const stimulusBlock = {
    timeline: [afcStimulusTemplate(trialConfig, undefined)],
    // true = execute normally, false = skip
    conditional_function: () => {
      if (taskStore().skipCurrentTrial) {
        taskStore('skipCurrentTrial', false);
        return false;
      }
      if (runCat && cat._seMeasurement < semThreshold) {
        return false;
      }
      return true;
    },
  };

  function preloadBatch() {
    timeline.push(createPreloadTrials(batchedMediaAssets[currPreloadBatch]).default);
    currPreloadBatch++;
  }

  if (runCat) {
    // seperate out corpus to get cat/non-cat blocks
    const corpora = prepareCorpus(corpus);

    // instruction block (non-cat)
    corpora.ipLight.forEach((trial: StimulusType) => {
      timeline.push({ ...fixationOnly, stimulus: '' });
      timeline.push(afcStimulusTemplate(trialConfig, trial));
    });

    // push in practice transition
    if (corpora.ipLight.filter((trial) => trial.assessmentStage === 'practice_response').length > 0) {
      timeline.push(practiceTransition());
    }

    // push in starting block
    corpora.start.forEach((trial: StimulusType) => {
      timeline.push({ ...fixationOnly, stimulus: '' });
      timeline.push(afcStimulusTemplate(trialConfig, trial));
    });

    // cat block
    const numOfCatTrials = corpora.cat.length;
    taskStore('totalTestTrials', numOfCatTrials);
    for (let i = 0; i < numOfCatTrials; i++) {
      timeline.push({ ...setupStimulus, stimulus: '' });
      timeline.push(stimulusBlock);
    }

    // select up to 5 random items from unnormed portion of corpus
    const unnormedTrials: StimulusType[] = selectNItems(corpora.unnormed, 5);

    // random set of unvalidated items at end
    const unnormedBlock = {
      timeline: unnormedTrials.map((trial) => afcStimulusTemplate(trialConfig, trial)),
    };
    timeline.push(unnormedBlock);
  } else if (shouldUseClowder()) {
    await initializeClowder(config);
    trogValidityEvaluator = createValidityEvaluator(config);

    const instructionTrials = corpus.filter(
      (trial) => trial.trialType?.includes('instruction') || trial.assessmentStage?.includes('instruction'),
    );
    for (const trial of instructionTrials) {
      timeline.push({ ...fixationOnly, stimulus: '' });
      timeline.push(afcStimulusTemplate(trialConfig, trial));
    }

    setNextStimulus({ ignorePreviousItem: true });

    const practiceBlock = {
      timeline: [{ ...setupStimulus, stimulus: '' }, afcStimulusTemplate(trialConfig)],
      // Skip the block entirely if the Clowder cat yielded no item. Without this guard,
      // afcStimulus renders a null stimulus (stim.itemId on null) and nothing appears.
      conditional_function: () => taskStore().nextStimulus != undefined,
      loop_function: () => {
        return taskStore().nextStimulus != undefined;
      },
      on_timeline_finish: () => {
        setNextStimulus();
      },
    };

    timeline.push(practiceBlock);

    // Overwrite conditional with Clowder-specific logic
    timeline.push({ ...setupStimulus, stimulus: '' });
    timeline.push({
      ...practiceTransition(),
      conditional_function: () => {
        // Prevents last practice question from being added to seenItems twice
        setNextStimulus({ ignorePreviousItem: true });
        return taskStore().currentCatBlock > 0;
      },
    });

    const testBlock = {
      timeline: [
        { ...setupStimulus, stimulus: '' },
        afcStimulusTemplate({ ...trialConfig, validityEvaluator: trogValidityEvaluator }),
      ],
      // Same guard as the practice block: don't render when the cat selection is empty.
      conditional_function: () => taskStore().nextStimulus != undefined,
      loop_function: () => {
        setNextStimulus();
        return taskStore().nextStimulus != undefined;
      },
      on_timeline_finish: () => {
        const { task, scoringVersion, currentCatBlock } = taskStore();
        const { catOrderMap } = CLOWDER_SELECTION_CONFIG[task][scoringVersion];
        const currentCat = catOrderMap[currentCatBlock];
        const seenCount = seenCatItemsCount[currentCat] || 0;
        if (currentCat === 'composite' && seenCount > 0 && seenCount % 5 === 0) {
          moveToNextBlock(2);
          return;
        }
        if (currentCat === 'new') {
          moveToNextBlock(1);
        }
      },
    };

    timeline.push(testBlock);
  } else {
    const numOfTrials = taskStore().totalTrials;
    taskStore('totalTestTrials', getRealTrials(corpus));
    for (let i = 0; i < numOfTrials; i++) {
      if (!taskStore().isRoarApp && i % batchSize === 0) {
        preloadBatch();
      }
      timeline.push({ ...setupStimulus, stimulus: '' });
      if (taskStore().isRoarApp) timeline.push(practiceTransition()); // Levante does not have practice trials
      timeline.push(stimulusBlock);
    }
  }

  initializeCat();

  // final screens
  timeline.push(taskFinished());
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
