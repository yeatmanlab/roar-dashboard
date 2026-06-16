// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';
import i18next from 'i18next';
import {
  ValidityEvaluator,
  createEvaluateValidity,
  generateAssetObject,
  createPreloadTrials,
} from '@bdelab/roar-utils';
import { jsPsych } from './jsPsych';
import { initRoarJsPsych, initRoarTimeline } from './config/config';
import { intro, postPracticeTrials } from './trials/introduction';
import { halfwayScreen, endTrials } from './trials/gameBreak';
import { ifStudentTrials } from './trials/characterSelect';
import { testSentenceTrial } from './trials/sentence';
import { practiceIntro, practiceTrial, practiceFeedback } from './trials/practice';
import assets from '../../webpAssets.json';

const bucketURI = 'https://storage.googleapis.com/roar-sre';
 
export let sreValidityEvaluator;
 
export let mediaAssets;
 
export let preloadTrials;

export function buildExperiment(firekit, config) {
  // 'https://storage.googleapis.com/roar-sre';

  mediaAssets = generateAssetObject(assets, bucketURI, i18next.language);
  preloadTrials = createPreloadTrials(assets, bucketURI, i18next.language).default;
  preloadTrials.message = i18next.t('loading');
  initRoarJsPsych(config);
  const initialTimeline = initRoarTimeline(firekit);

  const sreEvaluateValidity = createEvaluateValidity({
    responseTimeLowThreshold: 1000,
    responseTimeHighThreshold: 20000,
    accuracyThreshold: 0.6,
    minResponsesRequired: 10,
    includedReliabilityFlags: ['incomplete', 'responseTimeTooFast'],
  });

  const sreHandleEngagementFlags = (flags, reliable) => {
    if (config.firekit.run.started) {
      return config.firekit.updateEngagementFlags(flags, reliable);
    }
    return null;
  };

  sreValidityEvaluator = new ValidityEvaluator({
    evaluateValidity: sreEvaluateValidity,
    handleEngagementFlags: sreHandleEngagementFlags,
  });
  // add back
  const timeline = [preloadTrials, ...initialTimeline];

  const pushTrialsToTimeline = (blockOrder) => {
    // practice trials (set number of practice trials)
    const practiceProcedure = {
      timeline: [practiceTrial, practiceFeedback],
      repetitions: 4, // repetitions defaults to 4
    };

    // pushing introduction and practice trials
    timeline.push(intro);
    timeline.push(ifStudentTrials);
    timeline.push(practiceIntro);
    timeline.push(practiceProcedure);
    timeline.push(postPracticeTrials);
    for (let i = 0; i < blockOrder.length; i += 1) {
      timeline.push(testSentenceTrial(blockOrder[i], i + 1, config.timerLengthList[i]));
      if (i < blockOrder.length - 1) {
        timeline.push(halfwayScreen);
      }
    }

    timeline.push(endTrials);
  };

  pushTrialsToTimeline(config.blockOrder);

  return { jsPsych, timeline };
}
