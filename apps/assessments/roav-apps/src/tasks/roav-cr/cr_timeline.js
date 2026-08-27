import { jsPsych } from '../shared/helpers/taskSetup';
import 'regenerator-runtime/runtime';
import { mapTrials } from '../shared/trials/mapTrials';
import { cr_mapTrials } from './trials/cr_mapTrials';
import { t_timelineDef } from './trials/cr_timelineDef';
import { setTaskClassCss } from '../shared/helpers/cssHelpers';
import { initValidationFlagsHandler } from '../shared/trials/validityHelpers';
import { cr_clearStoreOnTimelineStart } from './helpers/cr_initStore';
import { et_stateSetFirekit } from '../et/et_state';

export const cr_buildTimeline = (config) => {
  cr_clearStoreOnTimelineStart();
  setTaskClassCss();
  initValidationFlagsHandler(config);
  et_stateSetFirekit(config.firekit);

  const tr = { ...mapTrials, ...cr_mapTrials };

  const timeline = [tr.t_preloadTrials];
  timeline.push(tr.t_collectUserData(config));
  timeline.push(tr.t_saveConfig());
  timeline.push(t_timelineDef());

  //   const nameCorpus = sessionGet(SK.NAME_CORPUS);
  //   const useScript = nameCorpus !== NAME_CORPUS_DEF;

  //  if (useScript) {
  //    timeline.push(t_timelineScript(tr));
  //  } else {
  //    sessionSet(SK.NAME_CORPUS, NAME_CORPUS_DEF);
  //    timeline.push(t_timelineDef());
  //  }
  return { jsPsych, timeline };
};
