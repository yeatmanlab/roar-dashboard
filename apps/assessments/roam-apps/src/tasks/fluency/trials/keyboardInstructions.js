import store from 'store2'; //storing session data
import { jsPsych } from '../../taskSetup';
import jsPsychSurveyHtmlForm from '@jspsych/plugin-survey-html-form';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import i18next from 'i18next';
import { isMobile } from '../helpers';

//keyboard instructions without practice
const keyboardInstructionsDesktop = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.instructionsFluencyKeyboard;
  },
  prompt: () => {
    let pressAnyKey = ``;
    if (
      store.session.get('config').responseMode === 'production' &&
      !isMobile &&
      !store.session.get('responseModality')
    ) {
      pressAnyKey = `<div class="key-button"> ${i18next.t('navigation.continueButtonText', {
        input: `${i18next.t('terms.anyKey')}`,
        action: `${i18next.t('terms.continue')}`,
      })} </div>`;
    }
    return (
      `
      <div class="jspsych-content-modified instructions-bg">
        <h2 class="title">${i18next.t('instructions.text1')}</h2>
        <div class="row">
            <div class="instruction-boxes fade-in-1"  style="width: 50vw;" id="panel1">
            <img src="${mediaAssets.images.keyboardExample}" alt="arrow keys" style="margin-top: 5vh;">
            </div>  
            <div class="no-box" style="flex-basis: 120%;" id="panel3">
              <ol>
                <li>${i18next.t('instructions.fluency.text2')}</li>
                <li style="margin-top: 0.5vh">${i18next.t('instructions.fluency.text4')}</li>
                <li style="margin-top: 0.5vh">${i18next.t('instructions.fluency.text6')}</li>
              </ol>
            </div>  
            </div>
        </div>` + pressAnyKey
    );
  },
  keyboard_choices: () => {
    if (
      store.session.get('config').responseMode === 'production' &&
      !isMobile &&
      !store.session.get('responseModality')
    ) {
      return 'ALL_KEYS';
    }
    return [];
  },
  button_choices: () => {
    if (
      store.session.get('config').responseMode === 'production' &&
      !isMobile &&
      !store.session.get('responseModality')
    ) {
      return [];
    }
    return [''];
  },
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
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

//keyboard instructions without practice
const keyboardInstructionsMobile = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.instructionsFluencyKeyboard;
  },
  prompt: () => {
    return `
      <div class="jspsych-content-modified instructions-bg">
        <h2 class="title">${i18next.t('instructions.text1')}</h2>
        <div class="row">
            <div class="instruction-boxes fade-in-1"  style="width: 50vw;" id="panel1">
            <img src="${mediaAssets.images.keyboardExample}" alt="arrow keys" style="margin-top: 5vh;">
            </div>  
            <div class="no-box" style="flex-basis: 120%;" id="panel3">
              <ol>
                <li>${i18next.t('instructions.core-math.text17')}</li>
                <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text18')}</li>
                <li style="margin-top: 0.5vh">${i18next.t('instructions.core-math.text19')}</li>
              </ol>
            </div>  
            </div>
        </div>`;
  },
  keyboard_choices: () => {
    return [];
  },
  button_choices: () => {
    return [''];
  },
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
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

export const keyboardInstructions = () => {
  let timelineObj = [keyboardInstructionsDesktop];

  if (isMobile) {
    timelineObj = [keyboardInstructionsMobile];
  }

  return {
    timeline: timelineObj,
  };
};
