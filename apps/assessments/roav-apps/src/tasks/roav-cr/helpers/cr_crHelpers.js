import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { sessionGet } from '../../shared/helpers/sessionHelpers';
import { CR_SESSION_KEYS as SK } from './cr_sessionKeys';
import { AssessmentStage } from '../../shared/helpers/namingHelpers';
import { jsPsych } from '../../shared/helpers/taskSetup';

const tagTrial = 'save-config-block-stim-quest-et';

export const t_saveConfigAll = () => ({
  type: jsPsychCallFunction,
  func: () => {},
  on_finish: () => {
    jsPsych.data.addDataToLastTrial({
      save_trial: true,
      assessment_stage: AssessmentStage.DATA,
      correct: true,
      type_trial: tagTrial,
      id_trial: tagTrial,
      pid: sessionGet(SK.CONFIG).pid,
      config_stim: sessionGet(SK.CONFIG_STIM),
      config_block: sessionGet(SK.CONFIG_BLOCK),
      config_quest: sessionGet(SK.CONFIG_QUEST),
      config_et: sessionGet(SK.CONFIG_ET),
      subvar: sessionGet(SK.CONFIG).subvar,
    });
  },
});
