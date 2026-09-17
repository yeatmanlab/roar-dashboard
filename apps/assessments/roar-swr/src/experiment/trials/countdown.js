import jsPsychAudioKeyboardResponse from '@jspsych/plugin-audio-keyboard-response';
import { isTouchScreen } from '../experimentSetup';
import { mediaAssets } from '../experiment';

const countDownData = [{ count: 3 }, { count: 2 }, { count: 1 }, { count: 0 }];

const countDownTrials = countDownData.map((trial) => ({
  type: jsPsychAudioKeyboardResponse,
  stimulus: () => mediaAssets.audio[`countdown${trial.count}`],
  prompt: () => `
  
    <div class='stimulus_div'>
      <p class='stimulus'>${trial.count}</p>
    </div>
    <div id='${isTouchScreen ? 'countdown-wrapper' : ''}'>
    ${
      isTouchScreen
        ? `<div id='countdown-arrows-wrapper'>
          <div class="countdown-arrows">
            <img class='btn-arrows' src=${mediaAssets.images.staticLeftKey} alt='left arrow' />
          </div>
          <div class="countdown-arrows">
            <img class='btn-arrows' src=${mediaAssets.images.staticRightKey} alt='right arrow' />
          </div>
        </div>`
        : `<img class="lower" src="${mediaAssets.images.arrowkeyLex}" alt="arrow keys">`
    }
  </div>`,
  choices: 'NO_KEYS',
  trial_duration: 1000,
  data: {
    assessment_stage: 'countdown',
  },
}));

export const countdownTrials = {
  timeline: countDownTrials,
};
