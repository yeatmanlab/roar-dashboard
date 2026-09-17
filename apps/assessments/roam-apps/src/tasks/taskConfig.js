import fluencyTimeline from './fluency/timeline';
import { initConfigFluency, initStoreFluency, fetchAndParseCorpusFluency } from './fluency/helpers';
import assetsFluency from './fluency/assets.json';

import coreMathTimeline from './core-math/timeline';
import { initConfigCoreMath, initStoreCoreMath, fetchAndParseCorpusCoreMath } from './core-math/helpers';
import assetsCoreMath from './core-math/assets.json';

import magpiTimeline from './magpi/timeline';
import { initConfigMagpi, initStoreMagpi, fetchAndParseCorpusMagpi } from './magpi/helpers';
import assetsMagpi from './magpi/assets.json';

import responseModalityTimeline from './responseModalityStudy/timeline';
import {
  initConfigResponseModality,
  initStoreResponseModality,
  fetchAndParseCorpusRM,
} from './responseModalityStudy/helpers';
import assetsResponseModality from './responseModalityStudy/assets.json';

export default {
  fluencyArf: {
    initConfig: initConfigFluency,
    initStore: initStoreFluency,
    loadCorpus: fetchAndParseCorpusFluency,
    buildTaskTimeline: fluencyTimeline,
    bucketURI: 'https://storage.googleapis.com/roam-apps',
    assets: assetsFluency,
    variants: {},
  },

  fluencyCalf: {
    initConfig: initConfigFluency,
    initStore: initStoreFluency,
    loadCorpus: fetchAndParseCorpusFluency,
    buildTaskTimeline: fluencyTimeline,
    bucketURI: 'https://storage.googleapis.com/roam-apps',
    assets: assetsFluency,
    variants: {},
  },

  roamAlpaca: {
    initConfig: initConfigCoreMath,
    initStore: initStoreCoreMath,
    loadCorpus: fetchAndParseCorpusCoreMath,
    buildTaskTimeline: coreMathTimeline,
    bucketURI: 'https://storage.googleapis.com/roam-apps',
    assets: assetsCoreMath,
    variants: {},
  },

  roamMagpi: {
    initConfig: initConfigMagpi,
    initStore: initStoreMagpi,
    loadCorpus: fetchAndParseCorpusMagpi,
    buildTaskTimeline: magpiTimeline,
    bucketURI: 'https://storage.googleapis.com/roam-apps',
    assets: assetsMagpi,
    variants: {},
  },

  responseModalityStudy: {
    initConfig: initConfigResponseModality,
    initStore: initStoreResponseModality,
    loadCorpus: fetchAndParseCorpusRM,
    buildTaskTimeline: responseModalityTimeline,
    bucketURI: 'https://storage.googleapis.com/roam-apps',
    assets: assetsResponseModality,
    variants: {},
  },
};
