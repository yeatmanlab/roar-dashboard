// setup
import { initTrialSaving, initTimeline, createPreloadTrials, getRealTrials, prepareCorpus } from '../shared/helpers';
import { jsPsych, initializeCat } from '../taskSetup';
import { taskStore } from '../../taskStore';
// trials
import {
  afcStimulusTemplate,
  exitFullscreen,
  setupStimulus,
  taskFinished,
  enterFullscreen,
  fixationOnly,
} from '../shared/trials';
import { getLayoutConfig } from './helpers/config';

export default function buildAdultReasoningTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  const preloadTrials = createPreloadTrials(mediaAssets).default;

  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);
  const timeline = [preloadTrials, initialTimeline];
  const corpus: StimulusType[] = taskStore().corpora.stimulus;
  const translations: Record<string, string> = taskStore().translations;
  const validationErrorMap: Record<string, string> = {};

  const cat = taskStore().runCat;

  taskStore('totalTestTrials', getRealTrials(corpus));

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

  const trialConfig = {
    trialType: 'audio',
    responseAllowed: true,
    promptAboveButtons: true,
    task: config.task,
    layoutConfigMap,
    terminateCat: false,
  };

  const stimulusBlock = (trial?: StimulusType) => {
    return {
      timeline: [afcStimulusTemplate(trialConfig, trial)],
    };
  };

  let numOfTrials;

  if (cat) {
    const fullCorpus = prepareCorpus(corpus, false);
    const practice = [...fullCorpus.ipLight, ...fullCorpus.ipHeavy];
    numOfTrials = 8;

    practice.forEach((trial) => {
      timeline.push({ ...fixationOnly, stimulus: `` });
      timeline.push(stimulusBlock(trial));
    });
  } else {
    numOfTrials = taskStore().totalTrials;
  }

  for (let i = 0; i < numOfTrials; i++) {
    timeline.push({ ...setupStimulus, stimulus: `` });
    timeline.push(stimulusBlock());
  }

  initializeCat();

  timeline.push(taskFinished());
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
