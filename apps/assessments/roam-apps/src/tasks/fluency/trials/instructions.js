import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..'; //media files
import i18next from 'i18next';
import '../../../i18n/i18n';
import store from 'store2'; //storing session data
import { afcInstructions } from './afcInstructions';
import { keyboardInstructions } from './keyboardInstructions';
import { keyboardPractice } from './keyboardPractice';
import { keyboardPracticeSplit } from './keyboardPracticeSplit';
import { isMobile } from '../helpers';

const skipInstructions = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.instructionsFluencySkip;
  },
  prompt: () => {
    let pressAnyKey = '';
    if (store.session.get('config').responseMode === 'production' && !isMobile) {
      pressAnyKey = `<div class="key-button"> ${i18next.t('navigation.continueButtonText', {
        input: `${i18next.t('terms.anyKey')}`,
        action: `${i18next.t('terms.continue')}`,
      })} </div>`;
    }
    let text = 'instructions.fluency.text14';
    if (isMobile) {
      text = 'instructions.fluency.text17';
    }
    return (
      `
      <div class="tiger-gif-container">
        <div class="speechbubble">
         <h3 class="header">${i18next.t('instructions.fluency.text13')} </h3>
         <p class="text"> ${i18next.t(text)} </p>
        </div>
        <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
      </div>
    ` + pressAnyKey
    );
  },
  keyboard_choices: () => {
    if (store.session.get('config').responseMode === 'production' && !isMobile) {
      return 'ALL_KEYS';
    }
    return [];
  },
  button_choices: () => {
    if (store.session.get('config').responseMode === 'production' && !isMobile) {
      return [];
    }
    return [''];
  },
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  on_start: () => {
    if (store.session.get('config').responseMode != 'production') {
      document.body.style.cursor = 'auto';
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    }
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

export const instructions = (responseMode) => {
  if (responseMode === 'production') {
    if (
      store.session.get('keyboardInstruction') === 'noPractice' &&
      !isMobile &&
      !store.session.get('responseModality')
    ) {
      if (store.session.get('responseModality')) {
        return {
          timeline: [keyboardInstructions()],
        };
      } else {
        return {
          timeline: [keyboardInstructions(), skipInstructions],
        };
      }
    } else {
      if (store.session.get('responseModality') && store.session.get('config').taskName === 'fluency-calf') {
        if (store.session.get('isK2') && !isMobile) {
          return {
            timeline: [keyboardPracticeSplit],
          };
        } else {
          return {
            timeline: [keyboardPractice],
          };
        }
      } else if (store.session.get('responseModality') && store.session.get('config').taskName === 'fluency-arf') {
        return {
          timeline: [keyboardInstructions()],
        };
      } else {
        if (store.session.get('isK2') && !isMobile) {
          return {
            timeline: [keyboardPracticeSplit, skipInstructions],
          };
        } else {
          return {
            timeline: [keyboardPractice, skipInstructions],
          };
        }
      }
    }
  }
  return {
    timeline: [afcInstructions(responseMode)],
  };
};

export const rtControlKeyboardPractice = () => {
  if (store.session.get('isK2') && !isMobile) {
    return {
      timeline: [keyboardPracticeSplit],
    };
  } else {
    return {
      timeline: [keyboardPractice],
    };
  }
};
