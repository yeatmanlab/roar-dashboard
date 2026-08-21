import { mp_buildTimeline } from './roav-mp/mp_timeline';
import { mp_initConfig } from './roav-mp/helpers/mp_initConfig';
import { mp_initStore } from './roav-mp/helpers/mp_initStore';
import { mp_loadCorpus } from './roav-mp/helpers/mp_loadCorpus';
import mp_assets from './roav-mp/mp_assets.json';

import { rvp_buildTimeline } from './roav-rvp/rvp_timeline';
import { rvp_initConfig } from './roav-rvp/helpers/rvp_initConfig';
import { rvp_initStore } from './roav-rvp/helpers/rvp_initStore';
import { rvp_loadCorpus } from './roav-rvp/helpers/rvp_loadCorpus';
import rvp_assets from './roav-rvp/rvp_assets.json';

export default {
  // if temporary points to the local assets, change back
  roavMp: {
    initConfig: mp_initConfig,
    initStore: mp_initStore,
    loadCorpus: mp_loadCorpus,
    buildTimelineTask: mp_buildTimeline,
    bucketURI: 'https://storage.googleapis.com/roav-mp', // "http://localhost:1234" "https://storage.googleapis.com/roav-mp"
    assets: mp_assets,
    variants: {},
  },
  roavRvp: {
    initConfig: rvp_initConfig,
    initStore: rvp_initStore,
    loadCorpus: rvp_loadCorpus,
    buildTimelineTask: rvp_buildTimeline,
    bucketURI: 'https://storage.googleapis.com/roav-mp/z_RVP', // NOTE: potentially move to roav-rvp
    assets: rvp_assets,
    variants: {},
  },
};
