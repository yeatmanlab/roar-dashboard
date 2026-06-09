 
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import i18next from 'i18next';
import '../i18n';
import { isTouchScreen } from '../experimentSetup';
import { mediaAssets } from '../experiment';
import { jsPsych } from '../jsPsych';

let count = 0;

const feedbackStimulus = () => {
  // const jsPsych = jsPsychStore.getJsPsych()

  const previousTrialData = jsPsych.data.get().last(2).values()[0];

  let isCorrect;

  if (previousTrialData.keyboard_response) {
    isCorrect = previousTrialData.keyboard_response === previousTrialData.correctResponse.toLowerCase();
  } else if (previousTrialData.correctResponse === 'ArrowLeft' && previousTrialData.button_response === 0) {
    isCorrect = true;
  } else if (previousTrialData.correctResponse === 'ArrowRight' && previousTrialData.button_response === 1) {
    isCorrect = true;
  } else {
    isCorrect = false;
  }

  count += 1;

  if (isCorrect) {
    if (store.session.get('config').story) {
      return mediaAssets.audio[`feedback${count}Correct`];
    }
    return mediaAssets.audio[`feedback${count}CorrectNs`];
  }
  if (store.session.get('config').story) {
    return mediaAssets.audio[`feedback${count}Wrong`];
  }
  return mediaAssets.audio[`feedback${count}WrongNs`];
};

// Might need to adjust this in the future for other languages
function getFeedbackTranslation(directionRes, typewordRes, sentenceNum) {
  const res = {};

  res.direction = directionRes ? i18next.t('terms.left') : i18next.t('terms.right');

  if (i18next.language === 'en' || i18next.language === 'de') {
    res.typeWord = typewordRes ? i18next.t('terms.real') : i18next.t('terms.made-up');
  } else if (sentenceNum === 1) {
    res.typeWord = typewordRes ? i18next.t('terms.real-plural') : i18next.t('terms.made-up-plural');
  } else {
    res.typeWord = typewordRes ? i18next.t('terms.real-singular') : i18next.t('terms.made-up-singular');
  }

  return res;
}

export const practiceFeedback = {
  type: jsPsychAudioMultiResponse,
  response_allowed_while_playing: () => store.session.get('config').skipInstructions,
  prompt_above_buttons: true,
  stimulus: () => feedbackStimulus(),
  prompt: () => `
  <div class = stimulus_div>
    <p class="feedback">
      <span class=${store.session('responseColor')}>${i18next.t(
        'practiceFeedbackTrial.paragraph1',
        getFeedbackTranslation(store.session('responseLR') === 'left', store.session('answerRP') === 'real', 1),
      )}</span>
      <br></br>
      <span translate = "no">${jsPsych.timelineVariable('stimulus')}</span>
      <span class=${store.session('answerColor')}>${i18next.t(
        'practiceFeedbackTrial.paragraph2',
        getFeedbackTranslation(store.session('correctLR') === 'left', store.session('correctRP') === 'real', 2),
      )}</span>
    </p>
  </div>
  ${
    !isTouchScreen
      ? `<img class="lower" src="${
          store.session('correctRP') === 'made-up'
            ? `${mediaAssets.images.arrowkeyLexLeft}`
            : `${mediaAssets.images.arrowkeyLexRight}`
        }" alt="arrow keys">`
      : ''
  }`,
  keyboard_choices: () => (store.session('correctRP') === 'made-up' ? ['ArrowLeft'] : ['ArrowRight']),
  button_choices: () => {
    if (isTouchScreen) {
      return store.session('correctRP') === 'made-up' ? ['Left'] : ['Right'];
    }
    return [];
  },
  button_html: () => `
  <button style="background-color: transparent;">
    <img class='lower' src=${
      store.session('correctRP') === 'made-up'
        ? `${mediaAssets.images.arrowkeyLexLeft}`
        : `${mediaAssets.images.arrowkeyLexRight}`
    } alt="Arrow choices"/>
  </button>`,
};
