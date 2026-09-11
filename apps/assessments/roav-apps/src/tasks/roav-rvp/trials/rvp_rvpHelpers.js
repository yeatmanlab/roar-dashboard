import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { sessionGet } from '../../shared/helpers/sessionHelpers';
import { RVP_SESSION_KEYS as SK } from '../helpers/rvp_sessionKeys';
import { AssessmentStage } from '../../shared/helpers/namingHelpers';
import { jsPsych } from '../../shared/helpers/taskSetup';

const tagTrial = 'save-config-block-stim';

export const t_saveConfigBlockStim = () => ({
  type: jsPsychCallFunction,
  func: () => {},
  on_finish: () => {
    const configsStim = sessionGet(SK.CONFIGS_STIM);
    const configBlock = sessionGet(SK.CONFIG_BLOCK);
    const mapsStim = sessionGet(SK.MAPS_STIM);
    jsPsych.data.addDataToLastTrial({
      save_trial: true,
      assessment_stage: AssessmentStage.DATA,
      correct: true,
      type_trial: tagTrial,
      id_trial: tagTrial,
      pid: sessionGet(SK.CONFIG).pid,
      configs_stim: configsStim,
      config_block: configBlock,
      maps_stim: mapsStim,
    });
  },
});
