import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { jsPsych } from '../helpers/taskSetup';
import { AssessmentStage } from '../helpers/namingHelpers';
import { sessionGet } from '../helpers/sessionHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';

export const t_saveConfig = () => ({
  type: jsPsychCallFunction,
  func: () => {},
  on_finish: () => {
    const config = sessionGet(SK.CONFIG);
    const configCopy = { ...config };
    configCopy.firekit = {};

    const tagTrial = 'save-config';

    jsPsych.data.addDataToLastTrial({
      save_trial: true,
      assessment_stage: AssessmentStage.DATA,
      correct: true,
      type_trial: tagTrial,
      id_trial: tagTrial,
      pid: sessionGet(SK.CONFIG).pid,
      mode_game: sessionGet(SK.MODE_GAME),
      config: configCopy,
    });
  },
});
