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
  combineMediaAssets,
  filterMedia,
  prepareMultiBlockCat,
  checkFallbackCriteria,
  isEnglish,
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
import { downexInstructions } from './trials/downexInstructions';

export default function buildMentalRotationCatTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  const { heavyInstructions } = taskStore();
  const { semThreshold } = taskStore();

  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);

  const ifRealTrialResponse = {
    timeline: [getAudioResponse(mediaAssets)],
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

  const polygonInstructBlock = {
    timeline: [polygonInstructions],
    conditional_function: () => {
      return taskStore().currentCatBlock === 1 && isEnglish(taskStore().language);
    },
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

    return {
      timeline: [
        polygonInstructBlock,
        threeDimInstructBlock,
        ...trials.map((trial) => {
          return {
            timeline: [{ ...fixationOnly, stimulus: '' }, afcStimulusTemplate(trialConfig, trial)],
          };
        }),
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
      timeline.push(practiceTransition(heavyInstructions ? () => 'mentalRotationInstruct5Downex' : undefined));

      // push in starting block
      corpora.start.forEach((trial: StimulusType) => {
        timeline.push({ ...fixationOnly, stimulus: '' });
        timeline.push(afcStimulusTemplate(trialConfig, trial));
        timeline.push(ifRealTrialResponse);
      });
    } else {
      timeline.push(practiceTransition(() => 'generalYourTurn'));
    }

    const numOfTrials = block.length / 3;
    const fallBackIndex = 4;
    for (let i = 0; i < numOfTrials; i++) {
      if (i <= fallBackIndex && index === 0) {
        timeline.push(fallbackInstructions);
      }
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
