import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import { mediaAssets } from '../experimentSetup';
import '../i18n';
import { isPractice } from './subTask';
import { audioResponseNeutral } from './audioFeedback';
import { getPrompt } from '../helperFunctions';
import { practiceCorrect } from './storySupport';

export let practiceIncorrectFeedback, ifPracticeCorrect, ifPracticeIncorrect;

export function createPracticeTrials() {
  practiceIncorrectFeedback = {
    type: jsPsychAudioMultiResponse,
    response_allowed_while_playing: false,
    stimulus: mediaAssets.audio.tryAgain,
    trial_ends_after_audio: false,
    trial_duration: 500000,
    prompt_above_buttons: true,
    prompt: () => getPrompt(),
    button_choices: () => {
      // read the stored choices
      const choices = store.session.get('choices');
      return choices;
    },
    on_load: () => {
      const btnOption = store.session.get('config').buttonLayout;
      document.getElementById('jspsych-audio-multi-response-btngroup').classList.add(`${btnOption}-layout`);

      if (store.session.get('config').task === 'cva') {
        document.getElementById('decorated').style.textDecoration = 'underline';
        document.getElementById('decorated').style.textDecorationThickness = '2px';
      }

      const target = store.session.get('target');

      const buttons = document.querySelectorAll('.feedback-btn');

      buttons.forEach((button) => {
        if (button.textContent.trim() === target) {
          button.classList.add('glowingButton');
        } else {
          button.parentElement.classList.add('disabled-btn');
        }
      });
    },
    button_html: () => `<button class="feedback-btn">%choice%</button>`,
  };

  ifPracticeCorrect = {
    timeline: [audioResponseNeutral, practiceCorrect],
    conditional_function: () => {
      // doesn't apply to real trials
      const subTaskName = store.session('subTaskName');

      if (!isPractice(subTaskName)) {
        return false;
      }

      // check for correct response
      if (store.session.get('correct') === 1) {
        store.session.set('previousAnswer', 1);
        store.session.set('previousItem', store.session.get('nextStimulus'));
        return true;
      }
      store.session.set('previousAnswer', 0);
      store.session.set('previousItem', store.session.get('nextStimulus'));
      return false;
    },
  };

  ifPracticeIncorrect = {
    timeline: [audioResponseNeutral, practiceIncorrectFeedback, audioResponseNeutral, practiceCorrect],
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
