import store from 'store2'; //storing session data
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import i18next from 'i18next';
import { isMobile } from '../helpers';

//instructions for afc
export const afcInstructions = (responseMode) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      if (responseMode === '2afc') {
        return mediaAssets.audio.instructionsFluency2afc;
      } else {
        return mediaAssets.audio.instructionsFluency6afc;
      }
    },
    prompt: () => {
      let mouseImage = mediaAssets.images.coreMathResponse; //6afc
      if (responseMode === '2afc') {
        mouseImage = mediaAssets.images.instructions2afc;
      }

      /*let responseMode = isMobile
        ? "instructions.core-math.finger"
        : "instructions.core-math.mouse";*/

      let text1 = 'instructions.fluency.text18';
      if (store.session.get('config').taskName === 'fluency-calf') {
        text1 = 'instructions.fluency.text19';
      }
      let text2 = 'instructions.fluency.text20';
      if (isMobile) {
        text2 = 'instructions.fluency.text21';
      }
      return `
      <div class="jspsych-content-modified">
        <h2 class="title">${i18next.t('instructions.text1')}</h2>
        <p class="instructions-text">${i18next.t(text1)} ${i18next.t(text2)}</p>
        <img class="img-border" src="${mouseImage}" alt="response">
      </div>
      `;
    },
    keyboard_choices: () => [],
    button_choices: () => [''],
    button_html: () =>
      `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
    on_start: () => {
      document.body.style.cursor = 'auto';
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    },
    on_load: () => {
      //disable button to prevent double clicks
      const btn = document.getElementById('go-button-id');
      if (btn) {
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
          btn.style.pointerEvents = 'auto';
        }, 1000);
      }
    },
  };
};
