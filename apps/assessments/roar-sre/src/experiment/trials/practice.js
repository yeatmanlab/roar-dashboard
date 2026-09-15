import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import i18next from 'i18next';
import { AssessmentStage, PRACTICE_DOMAIN } from '@roar-platform/assessment-schema';
import { jsPsych } from '../jsPsych';
import '../i18n';
import { isMobile } from '../experimentHelpers';
import { mediaAssets } from '../experiment';

export const practiceIntro = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => mediaAssets.audio.practiceInstruction,
  prompt: () => `
    <div class="jspsych-content-modified" id="sre-background">
      <h2>${i18next.t('practice.intro.text1')}</h2>
      <p>${i18next.t('practice.intro.text2')}</p>
      <div class="row">
        <div class="instruction-boxes">
          <p> 
          ${i18next.t(isMobile ? 'practice.intro.text3Mobile' : 'practice.intro.text3')} 
          </p>
          <img src="${mediaAssets.images.practiceLeft}" alt="arrow keys">
        </div>
        <div class="instruction-boxes">
          <p> 
          ${i18next.t(isMobile ? 'practice.intro.text4Mobile' : 'practice.intro.text4')} 
          </p>
          <img src="${mediaAssets.images.practiceRight}" alt="arrow keys">
        </div>
      </div>
      <p> <b>${i18next.t('practice.intro.text5')}</b> </p> 
      <div class="button">${i18next.t('practice.intro.text6')}</div>
    </div>`,
  keyboard_choices: () => (isMobile ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isMobile ? ['HERE'] : []),
  button_html: () => `<button class="button">${i18next.t('practice.intro.text6Mobile')}</button>`,
  on_finish: () => {
    store.session.set('indexTracking', -1);
  },
};

// practice trials (4 sentences)
export const practiceTrial = {
  type: jsPsychHtmlMultiResponse,
  stimulus: () => {
    // Why is this happening here?
    store.session.transact('indexTracking', (oldVal) => oldVal + 1);
    return `
      <div class=stimulus_div>
        <p class='stimulus' translate='no'>${
          store.session('practiceCorpus')[store.session('indexTracking')].sentence
        }</p>
      </div>`;
  },
  prompt: () => {
    if (!isMobile) {
      return `
        <div> 
          <img class="lower" src="${mediaAssets.images.roarSreKeyboard}" alt="arrow keys"> 
        </div>`;
    }
    return '';
  },
  keyboard_choices: () => (isMobile ? 'NO_KEYS' : ['ArrowLeft', 'ArrowRight']),
  button_choices: () =>
    isMobile ? [i18next.t('terms.false')[0].toUpperCase(), i18next.t('terms.true')[0].toUpperCase()] : [],
  button_html: () =>
    isMobile
      ? [
          `<button class="mobile-stimulus-btn"><img src=${mediaAssets.images.leftArrowBlankShort} alt=${i18next.t(
            'terms.false',
          )}/><span>${i18next.t('terms.false')[0].toLocaleUpperCase()}</span></button>`,
          `<button class="mobile-stimulus-btn"><img src=${mediaAssets.images.rightArrowBlankShort} alt=${i18next.t(
            'terms.true',
          )}/><span>${i18next.t('terms.true')[0].toLocaleUpperCase()}</span></button>`,
        ]
      : [],
  on_load: () => {
    if (isMobile) {
      // Cannot change properties by setting css class so doing this instead
      document.body.style.display = 'flex';
      document.body.style.justifyContent = 'center';
      document.body.style.alignContent = 'center';

      const jsPsychContentWrapper = document.querySelector('.jspsych-content-wrapper');
      jsPsychContentWrapper.classList.add('mobile-stimulus-wrap');

      const jsPsychContent = document.getElementById('jspsych-content');
      jsPsychContent.classList.add('mobile-stimulus-jspsych-content');
    }
  },
  data: {
    // Here is where we specify that we should save the trial to Firestore
    assessment_stage: AssessmentStage.PRACTICE,
    corpusId: PRACTICE_DOMAIN,
    save_trial: true,
  },
  on_finish: (data) => {
    if (data.keyboard_response) {
      data.correct = jsPsych.pluginAPI.compareKeys(
        data.keyboard_response,
        store.session('practiceCorpus')[store.session('indexTracking')].correct_response,
      );
      store.session.set('arrowResponse', data.keyboard_response);
    } else {
      data.correct =
        (store.session('practiceCorpus')[store.session('indexTracking')].correct_response === 'arrowleft' &&
          data.button_response === 0) ||
        (store.session('practiceCorpus')[store.session('indexTracking')].correct_response === 'arrowright' &&
          data.button_response === 1);
    }
    if (data.correct) {
      store.session.set('dataCorrect', 1); // if response = 1 then the participant got it correct
      store.session.set('feedbackResponse', i18next.t('feedbackTranslations.correct'));
    } else {
      store.session.set('dataCorrect', 0); // if response = 0 then the participant got it incorrect
      store.session.set('feedbackResponse', i18next.t('feedbackTranslations.incorrect'));
    }

    const isLeftResponse = data.keyboard_response === 'arrowleft' || data.button_response === 0;
    store.session.set('responseLR', isLeftResponse ? 'left' : 'right');
    store.session.set('answerRP', isLeftResponse ? 'false' : 'true');
    store.session.set('responseColor', isLeftResponse ? 'orange' : 'blue');

    const isLeftAnswer =
      store.session('practiceCorpus')[store.session('indexTracking')].correct_response === 'arrowleft';
    store.session.set('correctLR', isLeftAnswer ? 'left' : 'right');
    store.session.set('correctRP', isLeftAnswer ? 'false' : 'true');
    store.session.set('answerColor', isLeftAnswer ? 'orange' : 'blue');

    jsPsych.data.addDataToLastTrial({
      pid: store.session.get('config').pid,
      subtask: PRACTICE_DOMAIN,
      corpusId: PRACTICE_DOMAIN,
      correct: store.session('dataCorrect'),
      trialNumBlock: store.session('indexTracking'),
      item: store.session('practiceCorpus')[store.session('indexTracking')].sentence,
      truefalse: store.session('practiceCorpus')[store.session('indexTracking')].answer,
      story: store.session.get('config').story,
    });
  },
};

const feedbackStimulus = () => {
  if (store.session('dataCorrect') === 1) {
    return mediaAssets.audio[`feedback${store.session('indexTracking')}Correct`];
  }
  return mediaAssets.audio[`feedback${store.session('indexTracking')}Incorrect`];
};

export const practiceFeedback = {
  type: jsPsychAudioMultiResponse,
  response_allowed_while_playing: () => store.session.get('config').skipInstructions,
  stimulus: () => feedbackStimulus(),
  prompt: () => `
    <div class="stimulus_div">
      <p id=${isMobile ? 'mobile-stimulus-text' : ''} class="feedback" translate='no'>
        <span class=${store.session('responseColor')}>${store.session('feedbackResponse')} ${i18next.t(
          isMobile ? 'practice.feedback.text1Mobile' : 'practice.feedback.text1',
          {
            arrow: store.session('responseLR') === 'left' ? i18next.t('terms.left') : i18next.t('terms.right'),
            type: store.session('answerRP') === 'true' ? i18next.t('terms.true') : i18next.t('terms.false'),
          },
        )}</span>
        <br></br> 
        "${store.session('practiceCorpus')[store.session('indexTracking')].sentence}"
        <span class=${store.session('answerColor')}> ${i18next.t(
          isMobile ? 'practice.feedback.text2Mobile' : 'practice.feedback.text2',
          {
            arrow: store.session('correctLR') === 'left' ? i18next.t('terms.left') : i18next.t('terms.right'),
            type: store.session('correctRP') === 'true' ? i18next.t('terms.true') : i18next.t('terms.false'),
          },
        )}</span>
      </p>
    </div>
    ${
      isMobile
        ? ''
        : `<img class="lower" src= "${
            store.session('correctRP') === 'false' ? mediaAssets.images.falseFlashKey : mediaAssets.images.trueFlashKey
          }" alt="arrow keys">`
    }`,
  keyboard_choices: () => {
    if (isMobile) {
      return 'NO_KEYS';
    }
    return store.session('correctRP') === 'false' ? ['ArrowLeft'] : ['ArrowRight'];
  },
  button_choices: () => (isMobile ? ['ArrowLeft', 'ArrowRight'] : []),
  button_html: () =>
    isMobile
      ? [
          `<button class="mobile-practice-feedback ${
            store.session('correctRP') === 'false' ? '' : 'mobile-disable-button'
          }">
          <img src=${
            store.session('correctRP') === 'false'
              ? mediaAssets.images.falseFlashKeySplit
              : mediaAssets.images.falseStaticKeySplit
          } alt="feedback arrow"/>
        </button>`,

          `<button class="mobile-practice-feedback ${
            store.session('correctRP') === 'true' ? '' : 'mobile-disable-button'
          }">
        <img src=${
          store.session('correctRP') === 'true'
            ? mediaAssets.images.trueFlashKeySplit
            : mediaAssets.images.trueStaticKeySplit
        } alt="feedback arrow"/>
      </button>`,
        ]
      : '',
  prompt_above_buttons: () => isMobile,
  on_load: () => {
    // Effectively making it so the incorrect button cannot recieve it's click events
    const btnWrappers = document.querySelectorAll('.jspsych-audio-multi-response-button');

    btnWrappers.forEach((btn, i) => {
      const isFalse = store.session('correctRP') === 'false';

      if (i === 0 && !isFalse) {
        btn.classList.add('mobile-disable-button');
      } else if (i === 1 && isFalse) {
        btn.classList.add('mobile-disable-button');
      }
    });
  },
};
