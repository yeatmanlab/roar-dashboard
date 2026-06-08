import store from 'store2';
// Import necessary for async in the top level of the experiment script
import 'regenerator-runtime/runtime';
import i18next from 'i18next';
import { updateEngagementFlags } from '@yeatmanlab/assessment-sdk/compat/firekit';
import {
  generateAssetObject,
  createPreloadTrials,
  createEvaluateValidity,
  ValidityEvaluator,
} from '@bdelab/roar-utils';
import webpAssets from '../../webpAssets.json';
import { initStore, initRoarJsPsych, initRoarTimeline } from './config/config';
import { jsPsych } from './jsPsych';

import { fsmIntroductionTrials, fsmIntroductionTrialsNS, fsmEnd } from './trials/fsm/instructions';
import { audioSetup, initClowder, standardizeItemKey } from './experimentHelpers';
import { fsmTestTrials } from './trials/fsm/test';
import { fsmReady } from './trials/fsm/ready';
import { lsmReady } from './trials/lsm/ready';
import { lsmTestTrials } from './trials/lsm/test';
import { lsmEnd, lsmIntroductionTrials, lsmIntroductionTrialsNS } from './trials/lsm/instructions';
import { delReady } from './trials/del/ready';
import { delTestTrials } from './trials/del/test';
import { delIntroductionTrials, delIntroductionTrialsNS, delEnd } from './trials/del/instructions';
import { delPracticeTrials } from './trials/del/practice';
import { exitFullscreen } from './trials/fullScreen';
import { writePracticeTrials } from './trials/practice';
import enPractice from './config/corpus/en/practice.csv';
import enTest from './config/corpus/en/test.csv';
import enTestCat from './config/corpus/en/test-cat.csv';
import enPracticeCat from './config/corpus/en/practice-cat.csv';
import esPractice from './config/corpus/es/practice.csv';
import esTest from './config/corpus/es/test.csv';
import dePractice from './config/corpus/de/practice.csv';
import deTest from './config/corpus/de/test.csv';
import { processCSV } from './config/corpus';

export let mediaAssets;
export let preloadTrials;

export let audioCache;
export let paValidityEvaluator;

export function buildExperiment(config) {
  initStore(config);
  processCSV(config);
  initClowder(config);

  const bucketURI = 'https://storage.googleapis.com/roar-pa';

  mediaAssets = { audio: {}, images: {}, video: {} };
  preloadTrials = createPreloadTrials(webpAssets, bucketURI);
  const generateAssets = generateAssetObject(webpAssets, bucketURI, i18next.language);

  function flattenedArray(array) {
    return Object.assign(
      {},
      ...(function _flatten(o) {
        return [].concat(...Object.keys(o).map((k) => (typeof o[k] === 'object' ? _flatten(o[k]) : { [k]: o[k] })));
      })(array),
    );
  }

  function processMediaUrls(media, column, type_of_media) {
    return media
      .filter((m) => m !== undefined && m[column[0]].startsWith('http'))
      .map((item) => {
        const returnObject = {};
        column.forEach((prop) => {
          if (item[prop]) {
            if (item[prop].split('/').pop().split('.')[0].startsWith('ns')) {
              const key = standardizeItemKey(item[prop].split('/').pop().split('.')[0].replace(/_-/, '_'));

              returnObject[key] = item[prop];
            } else {
              const key = standardizeItemKey(item[prop].split('/').pop().split('.')[0]);

              returnObject[key] = item[prop];
            }
            if (item.trial_type === 'FSM') {
              preloadTrials.fsm[type_of_media] = preloadTrials.fsm[type_of_media].concat(item[prop]);
            } else if (item.trial_type === 'LSM') {
              preloadTrials.lsm[type_of_media] = preloadTrials.lsm[type_of_media].concat(item[prop]);
            } else if (item.trial_type === 'DEL') {
              preloadTrials.del[type_of_media] = preloadTrials.del[type_of_media].concat(item[prop]);
            }
          }
        });
        return returnObject;
      });
  }
  function destructureAssetList(file) {
    const audioArray = processMediaUrls(
      file,
      [
        'stimAudioUrl',
        'goalAudioUrl',
        'foilAudioUrl',
        'foil2AudioUrl',
        'questUrl',
        'instrUrl',
        'feed1Url',
        'feed2Url',
        'feed3Url',
      ],
      'audio',
    );

    const imageArray = processMediaUrls(
      file,
      ['stimImageUrl', 'goalImageUrl', 'foilImageUrl', 'foil2ImageUrl'],
      'images',
    );

    return { audio: flattenedArray(audioArray), images: flattenedArray(imageArray) };
  }

  function addToMediaAssets(files) {
    files.forEach((assetList) => {
      const preloadedAssets = destructureAssetList(assetList);
      ['audio', 'images'].forEach((type) => {
        Object.assign(mediaAssets[type], preloadedAssets[type]);
      });
    });
  }

  function getFiles() {
    let files = [];
    if (i18next.language === 'es') {
      files = [esPractice, esTest];
    } else if (i18next.language === 'de') {
      files = [dePractice, deTest];
    } else if (config.isAdaptive) {
      files = [enPracticeCat, enTestCat];
    } else {
      files = [enPractice, enTest];
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

  // Initialize jsPsych and timeline
  initRoarJsPsych(config);
  const initialTimeline = initRoarTimeline(config);

  const timeline = [preloadTrials.fsm, audioSetup, ...initialTimeline.timeline];
  preloadTrials.fsm.message = i18next.t('loading');
  preloadTrials.lsm.message = i18next.t('loading');
  preloadTrials.del.message = i18next.t('loading');
  const pushTrialsToTimeline = () => {
    // will only push trials with story if story param is true
    if (config.story) {
      timeline.push(fsmIntroductionTrials);
    } else {
      timeline.push(fsmIntroductionTrialsNS);
    }

    const fsmTestingSeries = {
      timeline: [fsmReady, fsmTestTrials, fsmEnd],
      conditional_function: () => store.session('keepBlock'),
    };

    const lsmTestingSeries = {
      timeline: [lsmReady, lsmTestTrials, lsmEnd],
      conditional_function: () => store.session('keepBlock'),
    };

    const delTestingSeries = {
      timeline: [delReady, delTestTrials],
      conditional_function: () => store.session('keepBlock'),
    };

    timeline.push(writePracticeTrials('practice_FSM'));
    timeline.push(fsmTestingSeries);
    timeline.push(preloadTrials.lsm);
    if (config.story) {
      timeline.push(lsmIntroductionTrials);
    } else {
      timeline.push(lsmIntroductionTrialsNS);
    }

    timeline.push(writePracticeTrials('practice_LSM'));
    timeline.push(lsmTestingSeries);

    timeline.push(preloadTrials.del);

    if (i18next.language !== 'es') {
      if (config.story) {
        timeline.push(delIntroductionTrials);
      } else {
        timeline.push(delIntroductionTrialsNS);
      }
      timeline.push(delPracticeTrials);
      timeline.push(delTestingSeries);
    }
    timeline.push(delEnd);
  };

  pushTrialsToTimeline();
  timeline.push(exitFullscreen);

  const paEvaluateValidity = createEvaluateValidity({
    responseTimeLowThreshold: 1000,
    accuracyThreshold: 0.6,
    minResponsesRequired: 1,
    includedReliabilityFlags: ['incomplete'],
  });

  const paHandleEngagementFlags = (flags, reliable) => {
    if (config.runStarted) {
      return updateEngagementFlags(flags, reliable);
    }
    return null;
  };

  paValidityEvaluator = new ValidityEvaluator({
    evaluateValidity: paEvaluateValidity,
    handleEngagementFlags: paHandleEngagementFlags,
  });
  paValidityEvaluator.startNewBlockValidation('FSM');

  return { jsPsych, timeline };
}
