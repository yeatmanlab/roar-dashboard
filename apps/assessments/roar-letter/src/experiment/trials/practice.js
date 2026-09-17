import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import { mediaAssets } from '../experiment';

import '../i18n';
import { isPractice } from './subTask';
import { practiceCorrectFeedback } from './storySupport';
import { replayAudioStimulus } from '../helperFunctions';

export let practiceIncorrectFeedback;

export let ifPracticeCorrect;

export let ifPracticeIncorrect;

export function createPracticeTrials() {
  // export const tempIntro = {
  //   type: jsPsychAudioMultiResponse,
  //   stimulus: () => mediaAssets.audio.fairyCoin,
  //   prompt: () => `
  //     <div>
  //       <h1 id="intro">Welcome to ROAR-Letter<br>
  //       This demo version will feature 6 lowercase trials,<br> 6 uppercase trials, and 6 sound trials.<br>
  //       </h1>
  //       <img id="roar-lion" src=${mediaAssets.images.rOARLion} alt="ROAR lion"/>
  //     </div>`,
  //   choices: "ANY_KEY",
  //   button_choices: () => ["GO"],
  //   // display letter buttons
  //   button_html: () => '<button class="practiceBtn">GO</button>',
  //   // check and store result
  //   trial_duration: null,
  // };

  practiceIncorrectFeedback = {
    type: jsPsychAudioMultiResponse,
    response_allowed_while_playing: false,
    stimulus: mediaAssets.audio.tryAgain,
    prompt: () => `<img id="replay" draggable="false" src="${mediaAssets.images.iconSpeaker}" alt="replay"/>`,
    trial_ends_after_audio: false,
    trial_duration: 500000,
    post_trial_gap: 100,
    // response_ends_trial: false,
    button_choices: () => {
      // read the stored choices
      const choices = store.session.get('choices');
      return choices;
    },
    on_load: () => {
      const target = store.session.get('target');

      const buttons = document.querySelectorAll('.enable-btn');

      // set up replay button
      document.getElementById('replay').addEventListener('click', replayAudioStimulus);

      buttons.forEach((button) => {
        if (button.textContent.trim() === target) {
          button.parentElement.classList.add('glowingButton');
        } else {
          button.parentElement.classList.add('disabled-btn');
        }
      });
    },
    button_html: () => `<button class="enable-btn">%choice%</button>`,
  };

  ifPracticeCorrect = {
    timeline: [practiceCorrectFeedback],
    conditional_function: () => {
      // doesn't apply to real trials
      const subTaskName = store.session('subTaskName');
      if (!isPractice(subTaskName)) {
        return false;
      }

      // check for correct response
      if (store.session.get('correct') === 1) {
        return true;
      }

      return false;
    },
  };

  ifPracticeIncorrect = {
    timeline: [practiceIncorrectFeedback, practiceCorrectFeedback],
    conditional_function: () => {
      // doesn't apply to real trials
      const subTaskName = store.session('subTaskName');
      if (!isPractice(subTaskName)) {
        return false;
      }

      // check for correct response
      if (store.session.get('correct') === 0) {
        return true;
      }
      return false;
    },
  };
}
