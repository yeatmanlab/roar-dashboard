import { taskStore } from '../taskStore';
import { getCorpus, setSharedConfig, getTranslations } from './shared/helpers';
import mathTimeline from './math/timeline';
import matrixTimeline from './matrix-reasoning/timeline';
import mentalRotationTimeline from './mental-rotation/timeline';
// @ts-ignore
import heartsAndFlowersTimeline from './hearts-and-flowers/timeline';
import memoryGameTimeline from './memory-game/timeline';
import sameDifferentSelectionTimeline from './same-different-selection/timeline';
import sameDifferentSelectionTimelineCat from './same-different-selection/catTimeline';
import vocabTimeline from './vocab/timeline';
import tomTimeline from './theory-of-mind/timeline';
import introTimeline from './intro/timeline';
import tROGTimeline from './trog/timeline';
import inferenceTimeline from './roar-inference/timeline';
import adultReasoningTimeline from './adult-reasoning/timeline';
import childSurveyTimeline from './child-survey/timeline';
import buildMentalRotationCatTimeline from './mental-rotation/catTimeline';

// TODO: Abstract to import config from specifc task folder
// Will allow for multiple devs to work on the repo without merge conflicts
export default {
  // Need to change bucket name to match task name (math)
  egmaMath: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: mathTimeline,
    variants: {
      // example
      egmaMathKids: {
        // does not need to have all properties, only what is different from base task
      },
    },
  },
  matrixReasoning: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: matrixTimeline,
    variants: {},
  },
  mentalRotation: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: (config: Record<string, any>, mediaAssets: MediaAssetsType) =>
      taskStore().runCat
        ? buildMentalRotationCatTimeline(config, mediaAssets)
        : mentalRotationTimeline(config, mediaAssets),
    variants: {},
  },
  heartsAndFlowers: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: heartsAndFlowersTimeline,
    variants: {},
  },
  memoryGame: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: memoryGameTimeline,
    variants: {},
  },
  sameDifferentSelection: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: (config: Record<string, any>, mediaAssets: MediaAssetsType) =>
      taskStore().runCat
        ? sameDifferentSelectionTimelineCat(config, mediaAssets)
        : sameDifferentSelectionTimeline(config, mediaAssets),
    variants: {},
  },
  trog: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: tROGTimeline,
    variants: {},
  },
  vocab: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: vocabTimeline,
  },
  theoryOfMind: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: tomTimeline,
    variants: {},
  },
  intro: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: introTimeline,
    variants: {},
  },
  roarInference: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: inferenceTimeline,
    variants: {
      // example
      inferenceKids: {
        // does not need to have all properties, only what is different from base task
      },
    },
  },
  adultReasoning: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: adultReasoningTimeline,
    variants: {},
  },
  hostileAttribution: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: tomTimeline,
    variants: {},
  },
  childSurvey: {
    setConfig: setSharedConfig,
    getCorpus: getCorpus,
    getTranslations: getTranslations,
    buildTaskTimeline: childSurveyTimeline,
    variants: {},
  },
};
