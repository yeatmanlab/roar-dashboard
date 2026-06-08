/* eslint-disable no-param-reassign */
import store from 'store2';
import {
  generateAssetObject,
  createPreloadTrials,
  ValidityEvaluator,
  createEvaluateValidity,
} from '@bdelab/roar-utils';
import { Cat } from '@bdelab/jscat';
import i18next from 'i18next';

// setup
import { initRoarJsPsych, initRoarTimeline } from './config/config';
import { jsPsych } from './jsPsych';
import assets from '../../webpAssets.json';

// trials
import { audioResponse } from './trials/audioFeedback';
import { introductionTrials, postPracticeIntro } from './trials/introduction';
import { practiceFeedback } from './trials/practiceFeedback';
import { midBlockPageList, postBlockPageList, finalPage } from './trials/gameBreak';
import { ifNotFullscreen, exitFullscreen } from './trials/fullScreen';
import { setupFixationTest, setupFixationPractice } from './trials/setupFixation';
import { lexicalityTest, leixcalityPractice } from './trials/stimulus';
import { countdownTrials } from './trials/countdown';
import { ifCoinTracking } from './trials/coinFeedback';

const bucketURI = 'https://storage.googleapis.com/roar-swr';

// eslint-disable-next-line import/no-mutable-exports
export let cat;
// eslint-disable-next-line import/no-mutable-exports
export let cat2;

// eslint-disable-next-line import/no-mutable-exports
export const presentationTimeCats = {};

// eslint-disable-next-line import/no-mutable-exports
export let mediaAssets;
// eslint-disable-next-line import/no-mutable-exports
export let preloadTrials;

// eslint-disable-next-line import/no-mutable-exports
export let swrValidityEvaluator;

export function buildExperiment(firekit, config) {
  const { language } = i18next;
  mediaAssets = generateAssetObject(assets, bucketURI, language);
  preloadTrials = createPreloadTrials(assets, bucketURI, language).default;
  preloadTrials.message = i18next.t('loading');

  // Initialize jsPsych and timeline
  initRoarJsPsych(config);
  const initialTimeline = initRoarTimeline(firekit);

  const catParams = {
    method: 'mle',
    minTheta: -6,
    maxTheta: 6,
    itemSelect: store.session('itemSelect'),
  };

  if (language === 'es') {
    catParams.method = 'eap';
    catParams.priorDist = 'norm';
    catParams.priorPar = [0, 1];
  }

  cat = new Cat({
    ...catParams,
  });

  // Include new items in thetaEstimate
  cat2 = new Cat({
    ...catParams,
  });

  const presentationTimeOption = store.session.get('presentationTimeOption');
  for (let i = 0; i < presentationTimeOption.length; i += 1) {
    const kitten = new Cat({
      ...catParams,
    });
    presentationTimeCats[store.session.get('presentationTimeOption')[i]] = kitten;
  }

  const timeline = [preloadTrials, ...initialTimeline, introductionTrials, ifNotFullscreen, countdownTrials];

  // the core procedure
  const pushPracticeTotimeline = (array) => {
    array.forEach((element) => {
      const block = {
        timeline: [setupFixationPractice, leixcalityPractice, audioResponse, practiceFeedback],
        timeline_variables: [element],
      };
      timeline.push(block);
    });
  };

  const blockPracticeTrials = store.session('corpusPractice').slice(0, config.totalTrialsPractice);

  pushPracticeTotimeline(blockPracticeTrials);
  timeline.push(postPracticeIntro);
  timeline.push(ifNotFullscreen);

  const coreProcedure = {
    timeline: [setupFixationTest, lexicalityTest, audioResponse, ifCoinTracking],
  };

  const pushTrialsTotimeline = (userMode, stimulusCounts) => {
    const presentationExperimentsModes = ['presentationExp', 'presentationExpShort', 'presentationExp2Conditions'];

    const determineRepetitions = (number) => {
      if (number % 2 === 0) {
        return [number / 2, number / 2];
      }
      return [Math.floor(number / 2) + 1, Math.floor(number / 2)];
    };

    for (let i = 0; i < stimulusCounts.length; i += 1) {
      // for each block: add trials
      /* add first half of block */
      const countTrials = determineRepetitions(stimulusCounts[i]);
      const roarMainProcBlock1 = {
        timeline: [coreProcedure],
        conditional_function: () => {
          if (stimulusCounts[i] === 0) {
            return false;
          }
          store.session.set('currentBlockIndex', i);
          return true;
        },
        repetitions: countTrials[0],
      };
      /* add second half of block */
      const roarMainProcBlock2 = {
        timeline: [coreProcedure],
        conditional_function: () => stimulusCounts[i] !== 0,
        repetitions: countTrials[1],
      };

      const roarMainProcBlockGeneral = {
        timeline: [coreProcedure],
        conditional_function: () => {
          if (stimulusCounts[i] === 0) {
            return false;
          }
          store.session.set('currentBlockIndex', i);
          return true;
        },
        repetitions: stimulusCounts[i],
      };

      if (presentationExperimentsModes.includes(userMode)) {
        // presentation experiment
        const totalMainProc = {
          timeline: [countdownTrials, roarMainProcBlockGeneral],
        };
        timeline.push(totalMainProc);
        if (i < stimulusCounts.length - 1) {
          timeline.push(postBlockPageList[2]);
          timeline.push(ifNotFullscreen);
        }
      } else if (userMode === 'shortAdaptiveEasyBlock') {
        // shortAdaptiveEasyBlock
        if (i === 0) {
          // when related to the first block
          const totalMainProc = {
            timeline: [countdownTrials, roarMainProcBlockGeneral],
          };
          timeline.push(totalMainProc);
          timeline.push(postBlockPageList[0]);
          timeline.push(ifNotFullscreen);
        } else {
          // later normal blocks
          const totalMainProc = {
            timeline: [
              countdownTrials,
              roarMainProcBlock1,
              midBlockPageList[i - 1],
              ifNotFullscreen,
              countdownTrials,
              roarMainProcBlock2,
            ],
          };
          timeline.push(totalMainProc);
          if (i < stimulusCounts.length - 1) {
            timeline.push(postBlockPageList[i - 1]);
            timeline.push(ifNotFullscreen);
          }
        }
      } else {
        // normal swr assessment
        const totalMainProc = {
          timeline: [
            countdownTrials,
            roarMainProcBlock1,
            midBlockPageList[i],
            ifNotFullscreen,
            countdownTrials,
            roarMainProcBlock2,
          ],
        };
        timeline.push(totalMainProc);
        if (i < stimulusCounts.length - 1) {
          timeline.push(postBlockPageList[i]);
          timeline.push(ifNotFullscreen);
        }
      }
    }
  };

  pushTrialsTotimeline(config.userMode, config.stimulusCountList);
  timeline.push(finalPage, exitFullscreen);

  const swrEvaluateValidity = createEvaluateValidity({
    responseTimeLowThreshold: 400,
    minResponsesRequired: 40,
    includedReliabilityFlags: ['responseTimeTooFast'],
  });

  const swrHandleEngagementFlags = (flags, reliable) => {
    if (config.firekit.run.started) {
      return config.firekit?.updateEngagementFlags(flags, reliable);
    }
    return null;
  };

  swrValidityEvaluator = new ValidityEvaluator({
    evaluateValidity: swrEvaluateValidity,
    handleEngagementFlags: swrHandleEngagementFlags,
  });

  return { jsPsych, timeline };
}
