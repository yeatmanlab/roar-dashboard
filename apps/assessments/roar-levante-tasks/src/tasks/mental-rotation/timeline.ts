import 'regenerator-runtime/runtime';
// setup
import { jsPsych, initializeCat, cat } from '../taskSetup';
import {
  createPreloadTrials,
  initTrialSaving,
  initTimeline,
  getRealTrials,
  batchTrials,
  batchMediaAssets,
  checkFallbackCriteria,
} from '../shared/helpers';
// trials
import {
  imageInstructions,
  polygonInstructions,
  threeDimInstructions,
  videoInstructionsFit,
  videoInstructionsMisfit,
} from './trials/instructions';
import {
  afcStimulusTemplate,
  taskFinished,
  exitFullscreen,
  setupStimulus,
  fixationOnly,
  getAudioResponse,
  enterFullscreen,
  repeatInstructionsMessage,
  practiceTransition,
} from '../shared/trials';
import { getLayoutConfig } from './helpers/config';
import { prepareCorpus, selectNItems } from '../shared/helpers/prepareCat';
import { taskStore } from '../../taskStore';
import { getLeftoverAssets } from '../shared/helpers/batchPreloading';
import { downexInstructions } from './trials/downexInstructions';

export default function buildMentalRotationTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  const { runCat, heavyInstructions } = taskStore();
  const { semThreshold } = taskStore();
  let playedThreeDimInstructions = false;
  let playedPolygonInstructions = false;

  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);

  const ifRealTrialResponse = {
    timeline: [getAudioResponse(mediaAssets)],

    conditional_function: () => {
      const stim = taskStore().nextStimulus;
      if (runCat) {
        // this trial is never used after a practice trial when running in cat
        return true;
      }
      if (stim.assessmentStage === 'practice_response') {
        return false;
      }
      return true;
    },
  };

  let corpus: StimulusType[] = taskStore().corpora.stimulus;
  const translations: Record<string, string> = taskStore().translations;
  const validationErrorMap: Record<string, string> = {};

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
  const batchedMediaAssets = batchMediaAssets(mediaAssets, batchedCorpus, ['item', 'answer', 'distractors']);

  // counter for next batch to preload (skipping the initial preload)
  let currPreloadBatch = 0;
  const initialMedia = getLeftoverAssets(batchedMediaAssets, mediaAssets);

  const initialPreload = createPreloadTrials(runCat ? mediaAssets : initialMedia).default;
  const instructions = heavyInstructions
    ? downexInstructions
    : [imageInstructions, videoInstructionsMisfit, videoInstructionsFit];

  const timeline = [initialPreload, initialTimeline, ...instructions];

  const trialConfig = {
    trialType: 'audio',
    responseAllowed: true,
    promptAboveButtons: true,
    task: config.task,
    layoutConfig: {
      showPrompt: true,
    },
    layoutConfigMap,
    terminateCat: runCat, // if running cat, stop if 4 of last 10 trials have been incorrect
  };

  // runs with adaptive algorithm if cat enabled
  const stimulusBlock = {
    timeline: [afcStimulusTemplate(trialConfig), ifRealTrialResponse],
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

  const firstBlockPractice: StimulusType[] = corpus.filter(
    (trial) => Number(trial.block_index) === 1 && trial.assessmentStage === 'practice_response',
  );

  let fellBack = false;
  const fallbackInstructions = {
    timeline: [
      repeatInstructionsMessage,
      ...downexInstructions,
      ...firstBlockPractice.map((trial) => afcStimulusTemplate(trialConfig, trial)),
    ],
    conditional_function: () => {
      const run = checkFallbackCriteria() && !fellBack;
      if (run) {
        fellBack = true;
      }

      return run;
    },
  };

  // put polygon and 3D practice in their own blocks so they run at the right time
  const polygonPractice: StimulusType[] = corpus.filter(
    (trial) => trial.trialType === 'polygon' && trial.assessmentStage === 'practice_response',
  );

  const threeDimPractice: StimulusType[] = corpus.filter(
    (trial) => trial.trialType === '3D' && trial.assessmentStage === 'practice_response',
  );

  corpus = corpus.filter((trial) => !polygonPractice.includes(trial) && !threeDimPractice.includes(trial));

  taskStore('corpora', {
    downex: taskStore().corpora.downex,
    stimulus: corpus,
  });

  const threeDimInstructBlock = {
    timeline: [
      threeDimInstructions,
      ...threeDimPractice.map((trial) => afcStimulusTemplate(trialConfig, trial)),
      { ...fixationOnly, stimulus: '' },
    ],
    conditional_function: () => {
      if (taskStore().nextStimulus.trialType === '3D' && !playedThreeDimInstructions) {
        playedThreeDimInstructions = true;
        return true;
      }

      return false;
    },
  };

  const polygonInstructBlock = {
    timeline: [
      polygonInstructions,
      ...polygonPractice.map((trial) => afcStimulusTemplate(trialConfig, trial)),
      { ...fixationOnly, stimulus: '' },
    ],
    conditional_function: () => {
      if (taskStore().nextStimulus.trialType === 'polygon' && !playedPolygonInstructions && heavyInstructions) {
        playedPolygonInstructions = true;
        return true;
      }

      return false;
    },
  };

  function preloadBatch() {
    timeline.push(createPreloadTrials(batchedMediaAssets[currPreloadBatch]).default);
    currPreloadBatch++;
  }

  function getPracticeTransitionPrompt() {
    return heavyInstructions && taskStore().nextStimulus.trialType === '2D'
      ? 'mentalRotationInstruct5Downex'
      : 'generalYourTurn';
  }

  const numOfTrials = corpus.length;
  taskStore('totalTestTrials', getRealTrials(corpus));
  const numOfInitialPracticeTrials = firstBlockPractice.length;
  const fallbackIndex = numOfInitialPracticeTrials + 4;
  for (let i = 0; i < numOfTrials; i++) {
    if (i % batchSize === 0) {
      preloadBatch();
    }
    if (i <= fallbackIndex) {
      timeline.push(fallbackInstructions);
    }
    timeline.push({ ...setupStimulus, stimulus: '' });
    timeline.push(practiceTransition(getPracticeTransitionPrompt));
    timeline.push(threeDimInstructBlock);
    timeline.push(polygonInstructBlock);
    timeline.push(stimulusBlock);
  }
  initializeCat();

  timeline.push(taskFinished());
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
