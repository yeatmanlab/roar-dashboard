// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';
import store from 'store2';
import i18next from 'i18next';
import {
  ValidityEvaluator,
  createEvaluateValidity,
  createPreloadTrials,
  generateAssetObject,
} from '@bdelab/roar-utils';
import webpAssets from '../../webpAssets.json';
// setup
import { initRoarJsPsych, initRoarTimeline, getStimulusCountPhonics, getPracticeCount } from './config/config';
import { updateEngagementFlags } from '@roar-platform/assessment-sdk/compat/firekit';
import { jsPsych } from './jsPsych';
import { initializeCat } from './experimentSetup';
import { buildBlock } from './trials/stimulus';

// trials
import { ifLetterNameTest, ifRealTrialResponse, isEarlyStopReached } from './trials/stimulusLetterName';
import { setupLetterTextSoundPseudoTrial, setupPhonicsPracticeTrial } from './trials/setupLetterFixation';

import { exitFullscreen } from './trials/fullScreen';
import { subTaskComplete, subTaskInitPhonicsPractice, subTaskInitTextSoundPseudo } from './trials/subTask';

import { ifPracticeCorrect, ifPracticeIncorrect, createPracticeTrials } from './trials/practice';
import {
  letterIntroAndInstructions,
  letterPracticeDone,
  letterTransition,
  soundIntroAndInstructions,
  soundPracticeDone,
  endTrial,
  storyBreakList,
  phonicsIntroAndInstructions,
  phonicsYoureReady,
  phonicsAllDone,
  createStory,
} from './trials/storySupport';

import { startAppTimer, clearAppTimer, isMaxTimeoutReached } from './trials/appTimer';

// English

import enLetterNameLower from '../stimuli/en/letterNameLower.csv';
import enLetterNameUpper from '../stimuli/en/letterNameUpper.csv';
import enLetterNamePractice from '../stimuli/en/letterNamePractice.csv';
import enLetterPhoneme from '../stimuli/en/letterPhoneme.csv';
import enLetterPhonemePractice from '../stimuli/en/letterPhonemePractice.csv';
// import enLetterTextSoundPseudo from '../stimuli/en/textSoundPseudo.csv';
import enLetterTextSoundPseudo from '../stimuli/en/roar-phonics-2025-08-01-v3.csv';
import enStoryLion from '../stimuli/en/storyLion.csv';
import enStoryLionAge12 from '../stimuli/en/storyLionAge12.csv';
import enStoryPhonics from '../stimuli/en/storyPhonics.csv';
import enPracticePhonics from '../stimuli/en/practicePhonics.csv';

// Spanish

import esLetterNameLower from '../stimuli/es/letterNameLower.csv';
import esLetterNameUpper from '../stimuli/es/letterNameUpper.csv';
import esLetterNamePractice from '../stimuli/es/letterNamePractice.csv';
import esLetterPhoneme from '../stimuli/es/letterPhoneme.csv';
import esLetterPhonemePractice from '../stimuli/es/letterPhonemePractice.csv';
import esLetterTextSoundPseudo from '../stimuli/es/textSoundPseudo.csv';
import esStoryLion from '../stimuli/es/storyLion.csv';

// Italian

import itLetterNameLower from '../stimuli/it/letterNameLower.csv';
import itLetterNameUpper from '../stimuli/it/letterNameUpper.csv';
import itLetterNamePractice from '../stimuli/it/letterNamePractice.csv';
import itLetterPhoneme from '../stimuli/it/letterPhoneme.csv';
import itLetterPhonemePractice from '../stimuli/it/letterPhonemePractice.csv';
import itLetterTextSoundPseudo from '../stimuli/it/textSoundPseudo.csv';
import itStoryLion from '../stimuli/it/storyLion.csv';

// English Canada

import enCaLetterNameLower from '../stimuli/en-ca/letterNameLower.csv';
import enCaLetterNameUpper from '../stimuli/en-ca/letterNameUpper.csv';
import enCaLetterNamePractice from '../stimuli/en-ca/letterNamePractice.csv';
import enCaLetterPhoneme from '../stimuli/en-ca/letterPhoneme.csv';
import enCaLetterPhonemePractice from '../stimuli/en-ca/letterPhonemePractice.csv';
import enCaLetterTextSoundPseudo from '../stimuli/en-ca/textSoundPseudo.csv';
import enCaStoryLion from '../stimuli/en-ca/storyLion.csv';
import enCaStoryLionAge12 from '../stimuli/en-ca/storyLionAge12.csv';
import enCaStoryPhonics from '../stimuli/en-ca/storyPhonics.csv';
import enCaPracticePhonics from '../stimuli/en-ca/practicePhonics.csv';

const esStoryLionAge12 = esStoryLion;
const itStoryLionAge12 = itStoryLion;

// eslint-disable-next-line import/no-mutable-exports
export let letterValidityEvaluator;
// eslint-disable-next-line import/no-mutable-exports
export let mediaAssets;
// eslint-disable-next-line import/no-mutable-exports
export let preloadTrials;

const bucketURI = 'https://storage.googleapis.com/roar-ak';

export function buildExperiment(config, computedScoreCallback) {
  // Add media assest here

  // TODO: Check back here in Letter task breaks
  preloadTrials = createPreloadTrials(webpAssets, bucketURI).default;
  preloadTrials.message = i18next.t('loading');
  mediaAssets = { audio: {}, images: {}, video: {} };
  const generateAssets = generateAssetObject(webpAssets, bucketURI, i18next.language);

  function destructureAssetList(file) {
    return {
      audio: file.map((audio) => audio.audioUrl),
      images: file.map((image) => image.imageUrl),
      video: file.map((video) => video.videoUrl),
    };
  }

  function addToMediaAssets(files) {
    files.forEach((assetList) => {
      const preloadedAssets = destructureAssetList(assetList);

      ['audio', 'images', 'video'].forEach((type) => {
        if (preloadedAssets[type]) {
          preloadedAssets[type]
            .filter((f) => f !== undefined && typeof f === 'string' && f.startsWith('http'))
            .forEach((asset) => {
              const fileName = asset.split('/').pop().split('.')[0];
              mediaAssets[type][fileName] = asset;
            });
        }
      });
    });
  }

  function getFiles() {
    let files = [];
    if (i18next.language === 'es') {
      files = [
        esLetterNameLower,
        esLetterNamePractice,
        esLetterNameUpper,
        esLetterPhoneme,
        esLetterPhonemePractice,
        esLetterTextSoundPseudo,
        esStoryLion,
        esStoryLionAge12,
      ];
    } else if (i18next.language === 'it') {
      files = [
        itLetterNameLower,
        itLetterNamePractice,
        itLetterNameUpper,
        itLetterPhoneme,
        itLetterPhonemePractice,
        itLetterTextSoundPseudo,
        itStoryLion,
        itStoryLionAge12,
      ];
    } else if (i18next.language === 'en-CA') {
      files = [
        enCaLetterNameLower,
        enCaLetterNamePractice,
        enCaLetterNameUpper,
        enCaLetterPhoneme,
        enCaLetterPhonemePractice,
        enCaLetterTextSoundPseudo,
        enCaStoryLion,
        enCaStoryLionAge12,
        enCaStoryPhonics,
        enCaPracticePhonics,
      ];
    } else {
      files = [
        enLetterNameLower,
        enLetterNamePractice,
        enLetterNameUpper,
        enLetterPhoneme,
        enLetterPhonemePractice,
        enLetterTextSoundPseudo,
        enStoryLion,
        enStoryLionAge12,
        enStoryPhonics,
        enPracticePhonics,
      ];
    }
    return files;
  }

  addToMediaAssets(getFiles());

  function addGenerateAssetsToMedia() {
    ['audio', 'images', 'video'].forEach((type) => {
      if (generateAssets[type]) {
        Object.entries(generateAssets[type]).forEach(([fileName, asset]) => {
          mediaAssets[type][fileName] = asset;
        });
      }
    });
  }

  addGenerateAssetsToMedia();

  function addToPreloadTrial() {
    ['audio', 'images', 'video'].forEach((type) => {
      preloadTrials[type] = preloadTrials[type].concat(Object.values(mediaAssets[type]));
    });
  }

  addToPreloadTrial();

  // Initialize jsPsych and timeline
  initRoarJsPsych(config, computedScoreCallback);
  const initialTimeline = initRoarTimeline(config);
  const letterEvaluateValidity = createEvaluateValidity({
    responseTimeThreshold: 600,
    accuracyThreshold: 0.6,
    minResponsesRequired: 5,
    includedReliabilityFlags: [],
  });

  const letterHandleEngagementFlags = (flags, reliable) => {
    return updateEngagementFlags(flags, reliable);
  };

  letterValidityEvaluator = new ValidityEvaluator({
    evaluateValidity: letterEvaluateValidity,
    handleEngagementFlags: letterHandleEngagementFlags,
  });

  createStory();
  createPracticeTrials();

  const timeline = [preloadTrials, ...initialTimeline.timeline];

  // this function adds all the trials in a subtask (and the mid-subtask breaks) to the timeline
  // fixationBlock:  an array of fixation trials (to fetch next stimulus) configured in stimulusLetterName.js
  // stimulusCounts: an array of numbers, each entry defines the number of trials before a mid-subtask break

  let pushSubTaskToTimeline;

  if (config.task === 'phonics') {
    let breakNum = 0;
    pushSubTaskToTimeline = (subTaskInitBlock, fixationBlock, stimulusCounts) => {
      // begin the subtask
      timeline.push(subTaskInitBlock);

      // loop through the list of trials per block within the subtest
      for (let i = 0; i < stimulusCounts.length; i += 1) {
        // add trials to the block (this is the core procedure for each trial)
        const letterBlock = {
          timeline: [fixationBlock, ifLetterNameTest, ifPracticeCorrect, ifPracticeIncorrect, ifRealTrialResponse],
          conditional_function: () => {
            // check for app timeout
            if (isMaxTimeoutReached() || isEarlyStopReached()) {
              return false;
            }

            if (stimulusCounts[i] === 0) {
              return false;
            }
            store.session.set('currentBlockIndex', i);
            return true;
          },
          repetitions: stimulusCounts[i],
        };

        timeline.push(letterBlock);
        // add breaks
        if (i + 1 !== stimulusCounts.length) {
          //  // no break on the last block of the subtask
          //   timeline.push(letterBlock);
          // } else {
          // add stimulus and break
          timeline.push(storyBreakList[breakNum]);
          breakNum += 1;
          if (breakNum === storyBreakList.length) {
            breakNum = 0;
          }
        }
      }

      // end of the subtask
      timeline.push(subTaskComplete);
    };
  }

  initializeCat();

  // start the timer that limits the runtime of the app
  timeline.push(startAppTimer);

  if (config.task === 'phonics') {
    // phonics (previously called TextSoundPseudo)

    // intro
    timeline.push(phonicsIntroAndInstructions);

    // phonics practice
    pushSubTaskToTimeline(subTaskInitPhonicsPractice, setupPhonicsPracticeTrial, getPracticeCount('phonics'));

    timeline.push(phonicsYoureReady);

    // main test
    pushSubTaskToTimeline(subTaskInitTextSoundPseudo, setupLetterTextSoundPseudoTrial, getStimulusCountPhonics());

    timeline.push(phonicsAllDone);
  } else {
    // Letter
    timeline.push(buildBlock(letterIntroAndInstructions));
    timeline.push(buildBlock(letterPracticeDone));
    timeline.push(buildBlock(letterTransition));
    timeline.push(buildBlock(soundIntroAndInstructions));
    timeline.push(buildBlock(soundPracticeDone));
    timeline.push(endTrial);
  }

  // cleanup
  timeline.push(clearAppTimer);
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
