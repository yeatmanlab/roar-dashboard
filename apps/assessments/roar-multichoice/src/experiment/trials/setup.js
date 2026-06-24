/* eslint-disable arrow-body-style */
import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import { setNextStimulus } from '../experimentSetup';

// choosing the next stimulus from the corpus occurs during the fixation trial
// prior to the actual display of the stimulus, where user response is collected
// the array allows us to use the same structure for all corpuses
const setupSurveyData = [
  {
    onFinish: () => {
      setNextStimulus();
    },
  },
  {
    onFinish: () => {
      setNextStimulus();
    },
  },
];

const setupSurveyTrials = setupSurveyData.map((trial, i) => {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function () {
      return `<div class='stimulus_div'>
                <p class='stimulus'> </p>
              </div>`;
    },
    prompt: '',
    choices: 'NO_KEYS',
    trial_duration: 10, // store.session.get("config").timing.fixationTime, //TODO fix

    data: {
      task: 'fixation',
    },
    on_finish: trial.onFinish,
  };
});

// for these variables, the index corresponds to trial parameter in the map(),
// i comes from the for loop that adds these to the timeline
export const setupSurveyPracticeTrial = setupSurveyTrials[0];
export const setupSurveyMainTrial = setupSurveyTrials[1];
