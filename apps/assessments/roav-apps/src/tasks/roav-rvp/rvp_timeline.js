import { jsPsych } from '../shared/helpers/taskSetup';
import 'regenerator-runtime/runtime';
import { initValidationFlagsHandler } from '../shared/trials/validityHelpers';
import { rvp_clearStoreOnTimelineStart } from './helpers/rvp_initStore';
import { sessionGet, sessionSet } from '../shared/helpers/sessionHelpers';
import { RVP_SESSION_KEYS as SK } from './helpers/rvp_sessionKeys';

import { mapTrials } from '../shared/trials/mapTrials';
import { rvp_mapTrials } from './trials/rvp_mapTrials';
import { t_timelineScript } from '../shared/helpers/timelineHelpers';
import { t_timelineDef } from './trials/rvp_timelineDef';
import { NAME_CORPUS_DEF } from '../shared/helpers/loadCorpus';
import { setTaskClassCss } from '../shared/helpers/cssHelpers';

const tr = {
  ...mapTrials,
  ...rvp_mapTrials,
};

export const rvp_buildTimeline = (config) => {
  rvp_clearStoreOnTimelineStart();
  setTaskClassCss();
  initValidationFlagsHandler(config);

  const timeline = [tr.t_preloadTrials];
  timeline.push(tr.t_collectUserData(config));
  timeline.push(tr.t_saveConfig());

  const nameCorpus = sessionGet(SK.NAME_CORPUS);
  const useScript = nameCorpus !== NAME_CORPUS_DEF;

  // Timeline can be built from code (t_timelineDef) or from JSON script (t_timelineScript).
  //
  // By default, the code-based timeline is used.
  //
  // If corpusName is passed via URL, corresponding JSON script will be retrieved from
  // Google Cloud and timeline will be composed accordingly.
  //
  // Expected formatting of JSON script can be seen in /corpora/roav-mp-corpus-def-script.json
  //
  // To run current corpus mirrored as script, use /?corpusName=corpus-def-script
  //
  // Additional timelines can be composed from existing trial types in parametric way,
  // saved to Google Cloud and invoked by passing corpusName in the URL.

  if (useScript) {
    timeline.push(t_timelineScript(tr));
  } else {
    sessionSet(SK.NAME_CORPUS, NAME_CORPUS_DEF);
    timeline.push(t_timelineDef());
  }
  return { jsPsych, timeline };
};
