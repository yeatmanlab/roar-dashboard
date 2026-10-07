import 'regenerator-runtime/runtime';
// setup
import { jsPsych, initializeCat, cat } from '../taskSetup';
import {
  createPreloadTrials,
  initTrialSaving,
  initTimeline,
  batchMediaAssets,
  prepareMultiBlockCat,
  checkFallbackCriteria,
} from '../shared/helpers';
// trials
import { threeDimInstructions, instructions } from './trials/instructions';
import { legacyInstructions } from './trials/legacyInstructions';
import {
  afcStimulusTemplate,
  taskFinished,
  exitFullscreen,
  fixationOnly,
  getAudioResponse,
  enterFullscreen,
  practiceTransition,
  setupStimulusFromCurrentCatBlock,
  setupNextBlock,
  repeatInstructionsMessage,
} from '../shared/trials';
import { getLayoutConfig } from './helpers/config';
import { prepareCorpus } from '../shared/helpers/prepareCat';
import { taskStore } from '../../taskStore';
import { getLeftoverAssets } from '../shared/helpers/batchPreloading';

export default function buildMentalRotationCatTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);

  const ifRealTrialResponse = {
    timeline: [getAudioResponse(mediaAssets)],
  };

  const corpus: StimulusType[] = taskStore().corpora.stimulus;
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

  const corpora = prepareCorpus(corpus);

  // organize media assets into batches for preloading
  const batchedCorpus = prepareMultiBlockCat(corpora.cat);
  const batchedMediaAssets = batchMediaAssets(mediaAssets, batchedCorpus, ['item', 'answer', 'distractors']);

  taskStore('corpora', {
    practice: taskStore().corpora.practice,
    stimulus: batchedCorpus,
  });

  // counter for next batch to preload (skipping the initial preload)
  let currPreloadBatch = 0;
  const initialMedia = getLeftoverAssets(batchedMediaAssets, mediaAssets);

  const initialPreload = createPreloadTrials(initialMedia).default;

  // latest instructions are behind version 2 flag in variant doc
  const selectedInstructions = taskStore().version === 2 ? instructions : legacyInstructions;

  const timeline = [initialPreload, initialTimeline, ...selectedInstructions];

  const trialConfig = {
    trialType: 'audio',
    responseAllowed: true,
    promptAboveButtons: true,
    task: config.task,
    layoutConfig: {
      showPrompt: true,
    },
    layoutConfigMap,
    terminateCat: true, // if running cat, stop if 4 of last 10 trials have been incorrect
  };

  const stimulusBlock = (index: number) => {
    return {
      timeline: [
        { ...setupStimulusFromCurrentCatBlock, stimulus: '' },
        afcStimulusTemplate(trialConfig),
        ifRealTrialResponse,
      ],
      conditional_function: () => {
        if (taskStore().skipBlock === index) {
          return false;
        }
        return true;
      },
    };
  };

  const threeDimInstructBlock = {
    timeline: [threeDimInstructions],
    conditional_function: () => {
      return taskStore().currentCatBlock === 2;
    },
  };

  function preloadBatch() {
    timeline.push(createPreloadTrials(batchedMediaAssets[currPreloadBatch]).default);
    currPreloadBatch++;
  }

  const instructionPractice = corpora.ipLight;

  const presentedInstructions: number[] = [];

  // returns practice + instruction trials for a given block
  function getPracticeInstructions(blockNum: number): StimulusType[] {
    const trials = instructionPractice.filter(
      (trial) => trial.block_index === blockNum && !presentedInstructions.includes(trial.block_index),
    );

    return trials;
  }

  const instructionPracticeBlock = (blockNum: number) => {
    const trials = getPracticeInstructions(blockNum);
    const practiceTransitionPrompt =
      blockNum === 1 && taskStore().version === 2 ? 'mentalRotationInstruct5Downex' : 'generalYourTurn';

    return {
      timeline: [
        threeDimInstructBlock,
        ...trials.map((trial) => {
          return {
            timeline: [{ ...fixationOnly, stimulus: '' }, afcStimulusTemplate(trialConfig, trial)],
          };
        }),
        ...(trials.length > 0 ? [practiceTransition(() => practiceTransitionPrompt)] : []),
      ],
      conditional_function: () => {
        const run = taskStore().currentCatBlock === blockNum - 1 && !presentedInstructions.includes(blockNum);

        if (run) {
          presentedInstructions.push(blockNum);
        }

        return run;
      },
    };
  };

  const firstBlockPractice: StimulusType[] = corpus.filter(
    (trial) => Number(trial.block_index) === 1 && trial.assessmentStage === 'practice_response',
  );

  let fellBack = false;
  const fallbackInstructions = {
    timeline: [
      repeatInstructionsMessage,
      ...instructions,
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

  function addInstructionPractice() {
    batchedCorpus.forEach((block, index) => {
      timeline.push(instructionPracticeBlock(index + 1));
    });
  }

  taskStore('currentCatBlock', 0);

  const numOfCatTrials = corpora.cat.length;
  taskStore('totalTestTrials', numOfCatTrials);
  batchedCorpus.forEach((block, index) => {
    preloadBatch();

    // add in instructions for all blocks each time: only the correct one will run based on currentCatBlock in taskStore
    addInstructionPractice();

    if (index === 0) {
      // push in starting block
      const fallBackIndex = 4;
      corpora.start.forEach((trial: StimulusType, i: number) => {
        timeline.push({ ...fixationOnly, stimulus: '' });
        timeline.push(afcStimulusTemplate(trialConfig, trial));
        timeline.push(ifRealTrialResponse);

        if (i < fallBackIndex) {
          timeline.push(fallbackInstructions);
        }
      });
    }

    const numOfTrials = block.length / 3;
    for (let i = 0; i < numOfTrials; i++) {
      timeline.push(stimulusBlock(index));
    }

    // check the participant's theta and assign next block
    if (index < batchedCorpus.length - 1) {
      timeline.push(setupNextBlock);
    }
  });

  initializeCat();

  timeline.push(taskFinished());
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
