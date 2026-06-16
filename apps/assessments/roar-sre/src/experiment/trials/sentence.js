 
import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import i18next from 'i18next';
import { corpus } from '../config/loadCorpus';
import { jsPsych } from '../jsPsych';
import { isMobile } from '../experimentHelpers';
import { sreValidityEvaluator, mediaAssets } from '../experiment';
import '../i18n';

export const testSentenceTrial = (corpusId, blockId, timerLength) => ({
  timeline: [
    {
      type: jsPsychHtmlMultiResponse,
      stimulus: () => {
        // if this is the first trial in this block, we will: 1. set the timer; 2. update the corpus
        if (store.session('indexTracking') === 0) {
          // will end the block by setting timeOut to be true (used for timer)
          const timerId = setTimeout(() => store.session.set('timeOut', true), timerLength);
          store.session.set('timerId', timerId);
          if (corpusId === 'tosrec') {
            store.session.set('currentCorpus', corpus[store.session('tosrecCorpusId')]);
          } else if (corpusId.startsWith('fixedForm')) {
            store.session.set('currentCorpus', corpus.fixedForms[corpusId]);
          } else {
            store.session.set('currentCorpus', corpus[corpusId]);
          }
        }

        return `
            <div class=stimulus_div>
              <p class='stimulus' translate='no'>${
                store.session('currentCorpus')[store.session('indexTracking')].sentence
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
        assessment_stage: 'test_response',
      },
      on_finish: (data) => {
        if (data.keyboard_response) {
          if (data.keyboard_response === 'arrowleft') {
            store.session.set('keyResponse', 'left');
          } else {
            store.session.set('keyResponse', 'right');
          }
        } else if (data.button_response === 0) {
          store.session.set('buttonResponse', 'left');
        } else {
          store.session.set('buttonResponse', 'right');
        }

        if (data.keyboard_response) {
          data.correct = jsPsych.pluginAPI.compareKeys(
            store.session('keyResponse'),
            store.session('currentCorpus')[store.session('indexTracking')].direction,
          );
        } else {
          data.correct =
            (data.button_response === 0 &&
              store.session('currentCorpus')[store.session('indexTracking')].direction === 'left') ||
            (data.button_response === 1 &&
              store.session('currentCorpus')[store.session('indexTracking')].direction === 'right');
        }

        if (data.correct) {
          store.session.set('dataCorrect', 1); // if response = 1 then the participant got it correct
        } else {
          store.session.set('dataCorrect', 0); // if response = 0 then the participant got it wrong
        }

        // feed response to sreValidityEvaluator for evaluation per trial
        sreValidityEvaluator.addResponseData(
          data.rt,
          data.keyboard_response ? data.keyboard_response : data.button_response,
          store.session('dataCorrect'),
        );

        jsPsych.data.addDataToLastTrial({
          save_trial: !store.session('timeOut'),
          pid: store.session.get('config').pid,
          subtask: corpusId,
          blockId: blockId,
          corpusId: corpusId !== 'tosrec' ? corpusId : store.session('tosrecCorpusId'),
          trialNumBlock: store.session('indexTracking') + 1,
          itemId: store.session('currentCorpus')[store.session('indexTracking')].itemId,
          testsetId: store.session('currentCorpus')[store.session('indexTracking')].testsetId,
          item: store.session('currentCorpus')[store.session('indexTracking')].sentence,
          truefalse: store.session('currentCorpus')[store.session('indexTracking')].answer,
          correct: store.session('dataCorrect'),
          story: store.session.get('config').story,
        });
      },
    },
    {
      type: jsPsychAudioMultiResponse,
      stimulus: () => mediaAssets.audio.neutralSoundSub,
      prompt: () => {
        if (isMobile) {
          return `<div class=stimulus_div>
                  <p id="mobile-placeholder-stimulus">Invisible Place holder text</p>
              </div>`;
        }
        return `
            <div>
              <img class="lower" src="${mediaAssets.images.roarSreKeyboard}" alt="arrow keys">
            </div>`;
      },
      keyboard_choices: 'NO_KEYS',
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
      prompt_above_buttons: true,
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

          const wrapperEl = document.getElementById('jspsych-audio-multi-response-btngroup');
          wrapperEl.style.display = 'flex';
          wrapperEl.style.gap = '9rem';
        }
      },
      trial_duration: 200, // 0.2 second
      response_allowed_while_playing: false,
      trial_ends_after_audio: true,
    },
  ],
  loop_function: function () {
    if (store.session('indexTracking') === store.session('currentCorpus').length - 1 || store.session('timeOut')) {
      store.session.set('indexTracking', 0);
      store.session.set('timeOut', false);
      clearTimeout(store.session.get('timerId'));
      return false;
    }

    store.session.transact('indexTracking', (oldVal) => oldVal + 1);
    return true;
  },
});
