// Import necessary for async in the top level of the experiment script
// firebase init hosting
// What do you want to use as your public directory? dist
// Configure as a single-page app (rewrite all urls to /index.html)? N
// Set up automatic builds and deploys with GitHub? N
// File dist / index.html already exists.Overwrite ? N
// npm run build:dev
// firebase deploy --only hosting

import 'regenerator-runtime/runtime';
import store from 'store2';
import { ValidityEvaluator, createEvaluateValidity } from '@bdelab/roar-utils';
import { updateEngagementFlags } from '@roar-platform/assessment-sdk/compat/firekit';
import { getPracticeCount, getStimulusCount, initRoarJsPsych, initRoarTimeline } from './config/config';

// setup
import { jsPsych } from './jsPsych';
import { preloadTrials } from './experimentSetup';
// trials

import { ifRealTrialResponse, trialWrapped } from './trials/stimulus';
import { setupSurveyMainTrial, setupSurveyPracticeTrial } from './trials/setup';

import { exitFullscreen } from './trials/fullScreen';
import { subTaskComplete, subTaskInitSurveyMain, subTaskInitSurveyPractice } from './trials/subTask';

import { createPracticeTrials, ifPracticeCorrect, ifPracticeIncorrect } from './trials/practice';
import {
  endTrial,
  storyBreakList,
  surveyIntroAndInstructions,
  surveyPracticeDone,
  createStory,
} from './trials/storySupport';

import { startAppTimer, clearAppTimer, isMaxTimeoutReached } from './trials/appTimer';

export let multichoiceValidityEvaluator;

export async function buildExperiment(config, computedScoreCallback) {
  // Initialize jsPsych and timeline
  await initRoarJsPsych(config, computedScoreCallback);
  const initialTimeline = initRoarTimeline(config);

  const multichoiceEvaluateValidity = createEvaluateValidity({
    responseTimeLowThreshold: 2000,
    accuracyThreshold: 0.5,
    minResponsesRequired: 10,
    includedReliabilityFlags: config.isAdaptive
      ? ['notEnoughResponses', 'accuracyTooLowAndResponseTimeTooFast']
      : [],
    customValidations: [
      {
        flag: 'accuracyTooLowAndResponseTimeTooFast',
        logicalOperation: 'and',
        conditions: [
          (data) => data.existingFlags.includes('accuracyTooLow'),
          (data) => data.existingFlags.includes('responseTimeTooFast'),
        ],
      },
    ],
  });

  const multichoiceHandleEngagementFlags = (flags, reliable) => {
    store.session.set('engagementFlags', flags);
    store.session.set('isReliable', reliable);
    if (config.firekit.run.started) {
      return config.firekit?.updateEngagementFlags(flags, reliable);
    }
    return undefined;
  };

  multichoiceValidityEvaluator = new ValidityEvaluator({
    evaluateValidity: multichoiceEvaluateValidity,
    handleEngagementFlags: multichoiceHandleEngagementFlags,
  });

  createStory();
  createPracticeTrials();

  const timeline = [preloadTrials, ...initialTimeline.timeline];

  // this function adds all the trials in a subtask (and the mid-subtask breaks) to the timeline
  // fixationBlock:  an array of fixation trials (to fetch next stimulus) configured in stimulusLetterName.js
  // stimulusCounts: an array of numbers, each entry defines the number of trials before a mid-subtask break
  let breakNum = 0;

  const pushSubTaskToTimeline = (subTaskInitBlock, fixationBlock, stimulusCounts, trialType) => {
    // begin the subtask
    timeline.push(subTaskInitBlock);

    // Calculate total trials
    const totalTrials = stimulusCounts.reduce((a, b) => a + b, 0);
    let trialCount = 0;

    // loop through the list of trials per block within the subtest
    for (let i = 0; i < stimulusCounts.length; i += 1) {
      // add trials to the block (this is the core procedure for each trial)
      const surveyBlock = {
        timeline: [fixationBlock, trialWrapped(trialType), ifPracticeCorrect, ifPracticeIncorrect, ifRealTrialResponse],
        conditional_function: () => {
          store.session.set('currentBlockIndex', i);
          return true;
        },
        repetitions: stimulusCounts[i],
      };

      // add trials
      timeline.push(surveyBlock);
      trialCount += stimulusCounts[i];

      // add break every 10 items (but not after the last trial)
      if (trialCount % 10 === 0 && trialCount < totalTrials) {
        const conditionalBreak = {
          timeline: [storyBreakList[breakNum]],
          conditional_function: () => {
            // skip breaks after app timer expires or if no more items
            if (isMaxTimeoutReached()) return false;
            const nextStimulus = store.session.get('nextStimulus');
            return nextStimulus != undefined;
          },
        };

        // select the next break
        timeline.push(conditionalBreak);
        breakNum += 1;
        if (breakNum === storyBreakList.length) {
          breakNum = 0;
        }
      }
    }

    // end of the subtask
    timeline.push(subTaskComplete);
  };

  // load configuration
  const currentTask = store.session.get('config').task;

  // survey intro
  timeline.push(surveyIntroAndInstructions[currentTask]);

  // start the timer that limits the runtime of the app
  timeline.push(startAppTimer);

  // practice trials
  pushSubTaskToTimeline(subTaskInitSurveyPractice, setupSurveyPracticeTrial, getPracticeCount('practice'), 'practice'); // Survey Practice Trials

  // practice complete screen
  timeline.push(surveyPracticeDone[currentTask]); // Practice done

  // real trials
  pushSubTaskToTimeline(subTaskInitSurveyMain, setupSurveyMainTrial, getStimulusCount(config.userMode), 'stimulus'); // Survey Trials

  // cleanup
  timeline.push(clearAppTimer);

  // End task - show immediately if items exhausted or time reached
  const conditionalEndTrial = {
    timeline: [endTrial.timeline[0]],
    on_start: () => {
      jsPsych.setProgressBar(1);
    },
  };
  timeline.push(conditionalEndTrial);
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
