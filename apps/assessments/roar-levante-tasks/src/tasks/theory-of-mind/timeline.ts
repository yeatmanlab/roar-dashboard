import 'regenerator-runtime/runtime';
// setup
import {
  initTrialSaving,
  initTimeline,
  createPreloadTrials,
  getRealTrials,
  prepareMultiBlockCat,
  batchMediaAssets,
} from '../shared/helpers';
import { jsPsych, initializeCat } from '../taskSetup';
// trials
import {
  afcStimulusTemplate,
  exitFullscreen,
  setupStimulus,
  setupStimulusFromStoryGroup,
  taskFinished,
  enterFullscreen,
} from '../shared/trials';
import { getLayoutConfig } from './helpers/config';
import { taskStore } from '../../taskStore';
import { preloadSharedAudio } from '../shared/helpers/preloadSharedAudio';
import { prepareTomCorpus, prepareStoryGroups } from './helpers/prepareTomCorpus';

export default function buildTOMTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);
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

  // does not matter if trial has properties that don't belong to that type
  const trialConfig = {
    trialType: 'audio',
    responseAllowed: true,
    promptAboveButtons: true,
    task: config.task,
    layoutConfigMap,
    terminateCat: false,
  };

  const initialPreload = preloadSharedAudio();
  const timeline = [initialPreload, initialTimeline];

  const blockList: StimulusType[][] = prepareMultiBlockCat(corpus, false);
  const fillerTrials = prepareTomCorpus(blockList);
  const storyGroups = prepareStoryGroups(corpus);

  const batchedMediaAssets = batchMediaAssets(
    mediaAssets,
    taskStore().version === 2 && storyGroups !== undefined ? storyGroups : blockList,
    ['item', 'answer', 'distractors'],
    ['audioFile', 'distractors'], // we need to preload audio for the staggered buttons
  );

  let currPreloadBatch = 0;

  // function to preload assets in batches at the beginning of each task block
  function preloadBlock() {
    timeline.push(createPreloadTrials(batchedMediaAssets[currPreloadBatch]).default);
    currPreloadBatch++;
  }

  const stimulusBlock = (trial?: StimulusType) => {
    return {
      timeline: [afcStimulusTemplate(trialConfig, trial)],
      // true = execute normally, false = skip
      conditional_function: () => {
        if (taskStore().skipCurrentTrial) {
          taskStore('skipCurrentTrial', false);
          return false;
        } else {
          return true;
        }
      },
    };
  };

  const stimulusBlockCat = (currentStoryGroup: number) => {
    return {
      timeline: [afcStimulusTemplate(trialConfig)],
      conditional_function: () => {
        return currentStoryGroup === taskStore().currentStoryGroup;
      },
    };
  };

  taskStore('totalTestTrials', getRealTrials(corpus));
  if (taskStore().version === 2) {
    const numberOfStories = taskStore().numberOfStories;
    // We can't know in advance how many trials will be in each story, so we set an arbitrarily high number
    const upperTrialLimitPerStory = 50;

    for (let i = 0; i < numberOfStories; i++) {
      preloadBlock();

      if (i === 0) {
        timeline.push(stimulusBlock(fillerTrials?.taskIntro));
      } else {
        timeline.push(stimulusBlock(fillerTrials?.blockTransition));
      }

      timeline.push({ ...setupStimulusFromStoryGroup, stimulus: '' });

      for (let j = 0; j < upperTrialLimitPerStory; j++) {
        timeline.push(stimulusBlockCat(i));
      }
    }
  } else {
    blockList.forEach((block: StimulusType[]) => {
      preloadBlock();

      for (let i = 0; i < block.length; i++) {
        timeline.push({ ...setupStimulus, stimulus: '' });
        timeline.push(stimulusBlock());
      }
    });
  }

  initializeCat();

  timeline.push(taskFinished());
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
