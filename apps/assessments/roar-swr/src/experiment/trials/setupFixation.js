import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response';
import store from 'store2';
import { isTouchScreen, getStimulus } from '../experimentSetup';
import { mediaAssets } from '../experiment';

// set-up screen
const setupFixationData = [
  {
    onFinish: () => {},
  },
  {
    onFinish: () => getStimulus(),
  },
];

// eslint-disable-next-line no-unused-vars
const setupFixationTrials = setupFixationData.map((trial, _i) => ({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: function () {
    return `<div class='stimulus_div'>
                <p class='stimulus'>+</p>
              </div>`;
  },
  prompt: () => {
    if (isTouchScreen) {
      return `<div id='${isTouchScreen ? 'countdown-wrapper' : ''}'>
              <div id='countdown-arrows-wrapper'>
                <div class="countdown-arrows">
                  <img class='btn-arrows' src=${mediaAssets.images.staticLeftKey} alt='left arrow' />
                </div>
                <div class="countdown-arrows">
                  <img class='btn-arrows' src=${mediaAssets.images.staticRightKey} alt='right arrow' />
                </div>
              </div>
           </div>`;
    }

    return `<img class="lower" src="${mediaAssets.images.arrowkeyLex}" alt = "arrow-key">`;
  },
  choices: 'NO_KEYS',
  trial_duration: () => store.session.get('config').timing.fixationTime,
  data: {
    assessment_stage: 'fixation',
  },
  on_finish: trial.onFinish,
}));

export const setupFixationPractice = setupFixationTrials[0];
export const setupFixationTest = setupFixationTrials[1];
