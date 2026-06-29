// setup
import 'regenerator-runtime/runtime';
import { jsPsych } from '../taskSetup';
import { initTrialSaving, initTimeline, createPreloadTrials, batchMediaAssets } from '../shared/helpers';
import { initializeCat } from '../taskSetup';
// trials
import { dataQualityScreen } from '../shared/trials/dataQuality';
import {
  setupStimulus,
  exitFullscreen,
  taskFinished,
  getAudioResponse,
  enterFullscreen,
  practiceTransition,
  feedback,
} from '../shared/trials';
import { afcMatch } from './trials/afcMatch';
import { stimulus } from './trials/stimulus';
import { legacyStimulus } from './trials/legacyStimulus';
import { taskStore } from '../../taskStore';
import { setTrialBlock } from './helpers/setTrialBlock';
import { batchTrials, getLeftoverAssets } from '../shared/helpers/batchPreloading';

export default function buildSameDifferentTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  const heavy: boolean = taskStore().heavyInstructions;

  let corpus: StimulusType[] = taskStore().corpora.stimulus;

  if (!heavy && taskStore().version === 2) {
    corpus = corpus.filter((trial) => {
      return !(trial.trialType.includes('something-same') && !(trial.assessmentStage === 'practice_response'));
    });

    taskStore('corpora', {
      practice: taskStore().corpora.practice,
      stimulus: corpus,
    });
  }

  // organize corpus into batches for preloading
  const batchSize = 25;
  const batchedCorpus = batchTrials(corpus, batchSize);
  const batchedMediaAssets = batchMediaAssets(mediaAssets, batchedCorpus, ['image', 'answer', 'distractors']);

  const initialMediaAssets = getLeftoverAssets(batchedMediaAssets, mediaAssets);
  initialMediaAssets.images = {}; // all sds images used in the task are specifed in corpus

  const initialPreload = createPreloadTrials(initialMediaAssets).default;

  initTrialSaving(config);

  const initialTimeline = initTimeline(config, enterFullscreen);
  const timeline = [initialPreload, initialTimeline];

  const buttonNoise = {
    timeline: [getAudioResponse(mediaAssets)],

    conditional_function: () => {
      const trialType = taskStore().nextStimulus.trialType;
      const assessmentStage = taskStore().nextStimulus.assessmentStage;

      if (
        (trialType === 'something-same-2' || trialType.includes('match')) &&
        assessmentStage !== 'practice_response'
      ) {
        return true;
      }
      return false;
    },
  };

  const feedbackBlock = {
    timeline: [feedback(true, 'feedbackCorrect', 'feedbackNotQuiteRight')],
    conditional_function: () => {
      return (
        taskStore().nextStimulus.assessmentStage === 'practice_response' &&
        !taskStore().nextStimulus.trialType.includes('something-same-1') &&
        taskStore().version === 2
      );
    },
  };

  const stimulusBlock = {
    timeline: [taskStore().version === 2 ? stimulus() : legacyStimulus(), feedbackBlock],
  };

  const afcBlock = {
    timeline: [afcMatch(), feedbackBlock],
  };

  const dataQualityBlock = {
    timeline: [dataQualityScreen],
    conditional_function: () => {
      return taskStore().numIncorrect >= taskStore().maxIncorrect && heavy;
    },
  };

  // create list of numbers of trials per block
  const { blockCountList, blockOperations } = setTrialBlock(false);

  const totalRealTrials = blockCountList.reduce((acc, total) => acc + total, 0);
  taskStore('totalTestTrials', totalRealTrials);

  // counter for the next block to preload
  let currPreloadBatch = 0;

  // function to preload assets in batches at the beginning of each task block
  function preloadBlock() {
    timeline.push(createPreloadTrials(batchedMediaAssets[currPreloadBatch]).default);
    currPreloadBatch++;
  }

  // functions to add trials to blocks of each type
  const updateTestDimensions = () => {
    timeline.push({ ...setupStimulus, stimulus: '' });
    timeline.push(stimulusBlock);
  };

  const setupTrialDuration = taskStore().version === 2 ? 0 : 350;

  const updateSomethingSame = () => {
    timeline.push({ ...setupStimulus, stimulus: '', trial_duration: setupTrialDuration });
    timeline.push(stimulusBlock);
    timeline.push(buttonNoise);
    timeline.push(dataQualityBlock);
  };

  const updateMatching = () => {
    timeline.push({ ...setupStimulus, stimulus: '', trial_duration: setupTrialDuration });
    timeline.push(afcBlock);
    timeline.push(buttonNoise);
    timeline.push(dataQualityBlock);
  };

  // map of block operation functions
  const blockFunctions = {
    updateTestDimensions,
    updateSomethingSame,
    updateMatching,
  };

  let trialCount = 0;

  // add trials to timeline according to block structure defined in blockOperations
  blockCountList.forEach((count, index) => {
    // push in trials
    for (let i = 0; i < count; i += 1) {
      // preload assets
      if (trialCount % batchSize === 0) {
        preloadBlock();
      }

      blockFunctions[blockOperations[index] as keyof typeof blockFunctions]();
      trialCount++;
    }
  });

  initializeCat();

  timeline.push(taskFinished());
  timeline.push(exitFullscreen);
  return { jsPsych, timeline };
}
