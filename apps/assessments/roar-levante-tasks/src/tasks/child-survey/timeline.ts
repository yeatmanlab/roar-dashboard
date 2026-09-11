import { taskStore } from '../../taskStore';
import { getLayoutConfig } from '../child-survey/helpers/config';
import { createPreloadTrials, getRealTrials, initTimeline, initTrialSaving } from '../shared/helpers';
import { enterFullscreen, exitFullscreen, setupStimulus, taskFinished } from '../shared/trials';
import { initializeCat, jsPsych } from '../taskSetup';
import { surveyItem } from './helpers/stimulus';

export default function buildChildSurveyTimeline(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  const preloadTrials = createPreloadTrials(mediaAssets).default;

  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);

  const timeline = [preloadTrials, initialTimeline];

  const corpus: StimulusType[] = taskStore().corpora.stimulus;
  const translations: Record<string, string> = taskStore().translations;
  const validationErrorMap: Record<string, string> = {};

  taskStore('totalTrials', corpus.length);

  const layoutConfigMap: Record<string, LayoutConfigType> = {};
  let i = 0;
  for (const c of corpus) {
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

  const trialConfig = {
    trialType: 'audio',
    responseAllowed: true,
    promptAboveButtons: true,
    task: config.task,
    layoutConfigMap,
    terminateCat: false,
  };

  const stimulusBlock = {
    timeline: [{ ...setupStimulus, stimulus: '' }, surveyItem(trialConfig)],
  };

  taskStore('totalTestTrials', getRealTrials(corpus));

  const numOfTrials = taskStore().totalTrials;
  for (let i = 0; i < numOfTrials; i++) {
    timeline.push(stimulusBlock);
  }

  initializeCat();

  timeline.push(taskFinished());
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
