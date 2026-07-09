import jsPsychSurveyText from '@jspsych/plugin-survey-text'; // questions with free response text fields
import { sessionGet, sessionSet } from '../helpers/sessionHelpers';
import { SESSION_KEYS as SK } from '../helpers/sessionKeys';

const LENGTH_PID = 16;

// randomly generates a 16 character string as the pid
export const makePid = (lenPid = LENGTH_PID) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < lenPid; i += 1) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

// get the pid only if it is not already filled
const t_collectPid = {
  timeline: [
    {
      type: jsPsychSurveyText,
      questions: [
        {
          prompt: '<h2>Participant ID:</h2>',
          name: 'pid',
          required: true,
        },
      ],
      on_load: () => {
        document.getElementById('input-0').style.fontSize = '3vh';
      },
      on_finish: (data) => {
        const config = sessionGet(SK.CONFIG);
        config.pid = data.response.pid;
        sessionSet(SK.CONFIG, config);
      },
    },
  ],
  conditional_function: () => {
    const config = sessionGet(SK.CONFIG);
    return !config.pid && config.recruitment !== 'school' && config.recruitment !== 'demo';
  },
};

export const t_collectUserData = (configMain) => ({
  timeline: [t_collectPid],
  on_timeline_finish: async () => {
    const config = sessionGet(SK.CONFIG);
    config.pid = config.pid || makePid();
    await configMain.firekit.updateUser({
      assessmentPid: config.pid,
      labId: config.labId,
      ...config.userMetadata,
    });
  },
});
