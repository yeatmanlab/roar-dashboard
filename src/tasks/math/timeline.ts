import 'regenerator-runtime/runtime';
import store from 'store2';
// setup
import {
  initTrialSaving,
  initTimeline,
  createPreloadTrials,
  prepareCorpus,
  prepareMultiBlockCat,
  getRealTrials,
} from '../shared/helpers';
import { jsPsych, initializeCat } from '../taskSetup';
import { slider } from './trials/sliderStimulus';
import {
  afcStimulusTemplate,
  enterFullscreen,
  exitFullscreen,
  getAudioResponse,
  setupStimulus,
  fixationOnly,
  setupStimulusFromBlock,
  taskFinished,
  practiceTransition,
  feedback,
  setupDownex,
} from '../shared/trials';
import { getLayoutConfig } from './helpers/config';
import { taskStore } from '../../taskStore';

export default function buildMathTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  const preloadTrials = createPreloadTrials(mediaAssets).default;

  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);

  const ifRealTrialResponse = (trial?: StimulusType) => {
    return {
      timeline: [getAudioResponse(mediaAssets)],

      conditional_function: () => {
        const stim = trial || taskStore().nextStimulus;
        if (stim.assessmentStage === 'practice_response' || stim.trialType === 'instructions') {
          return false;
        }

        const trialsSkipped = taskStore().trialsSkipped;
        if (trialsSkipped > 0) {
          return false;
        }

        return true;
      },
    };
  };

  const timeline = [preloadTrials, initialTimeline];

  let corpus: StimulusType[] = taskStore().corpora.stimulus;
  const downexCorpus: StimulusType[] = taskStore().corpora.downex;
  const translations: Record<string, string> = taskStore().translations;
  const validationErrorMap: Record<string, string> = {};

  const { runCat, heavyInstructions } = taskStore();

  taskStore('totalTrials', corpus.length);

  const layoutConfigMap: Record<string, LayoutConfigType> = {};
  let i = 0;
  for (const c of [...downexCorpus, ...corpus]) {
    const { itemConfig, errorMessages } = getLayoutConfig(c, translations, mediaAssets, i);
    layoutConfigMap[c.itemId] = itemConfig;
    if (errorMessages.length) {
      validationErrorMap[c.itemId] = errorMessages.join('; ');
    }
    i += 1;
  }

  if (Object.keys(validationErrorMap).length) {
    console.error('The following errors were found');
    console.table(validationErrorMap);
    throw new Error('Something went wrong. Please look in the console for error details');
  }

  const terminateCat = runCat;

  const trialConfig = {
    trialType: 'audio',
    responseAllowed: true,
    promptAboveButtons: true,
    task: config.task,
    layoutConfigMap,
    terminateCat: terminateCat,
  };

  const feedbackBlock = (trial?: StimulusType) => {
    return {
      timeline: [feedback(true, 'feedbackCorrect', 'feedbackNotQuiteRight', false)],
      conditional_function: () => {
        return (
          (trial || taskStore().nextStimulus).assessmentStage === 'practice_response' &&
          (trial || taskStore().nextStimulus).trialType === 'Number Line Slider'
        );
      },
    };
  };

  const setupBlock = {
    timeline: [{ ...setupStimulus, stimulus: '' }],
    conditional_function: () => {
      const trialsSkipped = taskStore().trialsSkipped;

      if (trialsSkipped > 0) {
        taskStore('trialsSkipped', trialsSkipped - 1);
        taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
        return false;
      } else {
        return true;
      }
    },
  };

  const interBlockGap = {
    timeline: [{ ...fixationOnly, stimulus: '', post_trial_gap: 350 }],
    conditional_function: () => {
      return taskStore().trialsSkipped === 1;
    },
  };

  const afcStimulusBlock = (trial?: StimulusType) => {
    return {
      timeline: [afcStimulusTemplate(trialConfig, trial)],
      conditional_function: () => {
        const trialsSkipped = taskStore().trialsSkipped;
        if (trialsSkipped > 0) {
          return false;
        }

        return !(trial || taskStore().nextStimulus).trialType?.includes('Number Line');
      },
    };
  };

  const sliderBlock = (trial?: StimulusType) => {
    return {
      timeline: [slider(layoutConfigMap, terminateCat, trial), feedbackBlock(trial)],
      conditional_function: () => {
        const trialsSkipped = taskStore().trialsSkipped;

        if (trialsSkipped > 0) {
          return false;
        }

        return (trial || taskStore().nextStimulus).trialType?.includes('Number Line');
      },
    };
  };

  const sliderPractice: StimulusType[] = corpus.filter((trial) => {
    return trial.trialType === 'Number Line Slider' && trial.assessmentStage === 'practice_response';
  });

  // this block repeats all slider practice trials
  const repeatSliderPracticeBlock = () => {
    let trials: any[] = [];
    sliderPractice.forEach((trial, index) => {
      trials.push(slider(layoutConfigMap, terminateCat, trial));
      if (index < sliderPractice.length - 1) {
        trials.push({
          ...feedback(true, 'feedbackCorrect', 'feedbackNotQuiteRight'),
          conditional_function: () => {
            return true;
          },
          post_trial_gap: 350,
        });
      }
    });

    return {
      timeline: [...trials],
      conditional_function: () => {
        return (
          !taskStore().isCorrect &&
          !taskStore().testPhase &&
          (taskStore().nextStimulus.trialType === 'Number Line Slider' || runCat) &&
          taskStore().nextStimulus.assessmentStage === 'test_response'
        );
      },
    };
  };

  const stimulusBlock = (trial?: StimulusType) => {
    return {
      timeline: [afcStimulusBlock(trial), sliderBlock(trial), ifRealTrialResponse(trial)],
      conditional_function: () => {
        if (taskStore().skipCurrentTrial) {
          taskStore('skipCurrentTrial', false);
          return false;
        }
        const stim = trial || taskStore().nextStimulus;
        const skipBlockTrialType = store.page.get('skipCurrentBlock');
        if (stim.trialType === skipBlockTrialType && !runCat) {
          return false;
        } else {
          return true;
        }
      },
    };
  };

  if (runCat) {
    // puts the CAT portion of the corpus into taskStore and removes instructions
    const allCorpusParts = prepareCorpus(corpus, true, downexCorpus);
    const olderKidInstructionPractice: StimulusType[] = allCorpusParts.ipLight;
    const olderKidInstructions: StimulusType[] = olderKidInstructionPractice.filter(
      (trial: StimulusType) => trial.trialType == 'instructions',
    );
    let olderKidPractice: StimulusType[] = olderKidInstructionPractice.filter(
      (trial: StimulusType) => trial.assessmentStage == 'practice_response',
    );

    let olderKidBlocks: StimulusType[][] = prepareMultiBlockCat(taskStore().corpora.stimulus);
    taskStore('corpora', { stimulus: olderKidBlocks, downex: taskStore().corpora.downex });
    taskStore('totalTestTrials', 0); // add to this while building out each block

    // don't repeat instructions
    const usedIds: string[] = [];

    // first add downex trials to the timeline
    if (heavyInstructions) {
      const downexInstructionPractice: StimulusType[] = allCorpusParts.ipHeavy;
      const downexInstructions: StimulusType[] = downexInstructionPractice.filter(
        (trial) => trial.trialType == 'instructions',
      );
      let downexPractice: StimulusType[] = downexInstructionPractice.filter(
        (trial) => trial.assessmentStage == 'practice_response',
      );

      let downexBlock: StimulusType[] = allCorpusParts.downexCat;

      // remove items from first block that are already in subsequent blocks
      const nonDownexIds: string[] = [];
      olderKidBlocks.flat().map((trial) => nonDownexIds.push(trial.itemId as string));

      downexBlock = downexBlock.filter((trial: StimulusType) => {
        return !nonDownexIds.includes(trial.itemId as string);
      });

      // filter practice trials to only include appropriate trial types if downward extension
      const excludedDownexPracticeTypes = [
        'Addition',
        'Number Comparison',
        'Number Identification',
        'Counting',
        'Counting AFC',
      ];

      downexPractice = downexPractice.filter((trial) => !excludedDownexPracticeTypes.includes(trial.trialType));

      const allowedIds = ['math-instructions1-heavy', 'math-intro1-heavy'];

      downexInstructions.forEach((trial) => {
        if (allowedIds.includes(trial.itemId)) {
          timeline.push({ ...fixationOnly, stimulus: '' });
          timeline.push(afcStimulusTemplate(trialConfig, trial));
        }
      });

      downexPractice.forEach((trial) => {
        timeline.push({ ...fixationOnly, stimulus: '' });
        timeline.push(stimulusBlock(trial));
      });

      timeline.push(practiceTransition());

      const numOfTrials = Math.floor(downexBlock.length / 2);
      taskStore.transact('totalTestTrials', (oldVal: number) => (oldVal += numOfTrials));
      for (let j = 0; j < numOfTrials; j++) {
        timeline.push({ ...setupDownex, stimulus: '' }); // select only from the current block
        timeline.push(stimulusBlock());
      }
    }

    const numOfBlocks = olderKidBlocks.length;
    const trialProportionsPerBlock = [4, 6, 6]; // divide by these numbers to get trials per block
    for (let i = 0; i < numOfBlocks; i++) {
      // push in block-specific instructions
      const blockInstructions = olderKidInstructions.filter((trial) => {
        let allowedIDs: string[]; // CAT only uses particular instructions from corpus

        switch (i) {
          case 0:
            allowedIDs = heavyInstructions ? ['math-intro2'] : ['math-instructions1', 'math-intro1'];
            break;
          case 1:
            allowedIDs = ['math-intro2'];
            break;
          case 2:
            allowedIDs = ['math-intro2', 'number-line-instruct1'];
            break;
          default:
            allowedIDs = [];
        }

        const include = allowedIDs.includes(trial.itemId) && !usedIds.includes(trial.itemId);

        if (include) {
          usedIds.push(trial.itemId);
        }

        return include;
      });

      blockInstructions.forEach((trial) => {
        timeline.push({ ...fixationOnly, stimulus: '' });
        timeline.push(afcStimulusTemplate(trialConfig, trial));
      });

      // push in block-specific practice trials
      const blockPractice = olderKidPractice.filter((trial) => {
        return i === Number(trial.block_index);
      });

      blockPractice.forEach((trial) => {
        timeline.push({ ...fixationOnly, stimulus: '' });
        timeline.push(stimulusBlock(trial));

        if (trial.trialType === 'Number Line Slider') {
          timeline.push(feedbackBlock());
        }
      });

      // final slider block
      if (i === 2) {
        timeline.push(repeatSliderPracticeBlock());
      }

      // practice transition screen
      timeline.push(practiceTransition());

      // push in random items at start of first block (after practice trials)
      if (i === 0) {
        allCorpusParts.start.forEach((trial) => timeline.push(stimulusBlock(trial)));
      }

      const numOfTrials = Math.floor(olderKidBlocks[i].length / trialProportionsPerBlock[i]);
      taskStore.transact('totalTestTrials', (oldVal: number) => (oldVal += numOfTrials));
      for (let j = 0; j < numOfTrials; j++) {
        timeline.push({ ...setupStimulusFromBlock(i), stimulus: '' }); // select only from the current block
        timeline.push(stimulusBlock());
      }

      allCorpusParts.unnormed.forEach((trial) => {
        if (i === Number(trial.block_index)) {
          timeline.push({ ...fixationOnly, stimulus: '' });
          timeline.push(stimulusBlock(trial));
        }
      });
    }
  } else {
    taskStore('totalTestTrials', getRealTrials(corpus));

    // if cat is not running, remove difficulty field from all items
    corpus.forEach((trial) => (trial.difficulty = NaN));

    const newCorpora = {
      downex: taskStore().corpora.downex,
      stimulus: heavyInstructions ? downexCorpus : corpus,
    };
    taskStore('corpora', newCorpora);

    const numOfTrials = heavyInstructions ? taskStore().totalDownexTrials : taskStore().totalTrials;
    for (let i = 0; i < numOfTrials; i++) {
      timeline.push(setupBlock);
      timeline.push(repeatSliderPracticeBlock());
      timeline.push(practiceTransition());
      timeline.push(interBlockGap);
      timeline.push(stimulusBlock());
    }
  }

  initializeCat();

  timeline.push(taskFinished());
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
