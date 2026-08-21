import jsPsychFullScreen from '@jspsych/plugin-fullscreen';
// import jsPsychAudioKeyboardResponse from '@jspsych/plugin-audio-keyboard-response';
import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import store from 'store2';
import { camelCase } from 'lodash';
import i18next from 'i18next';
import '../i18n';
import { isMobile } from '../experimentHelpers';
import { mediaAssets } from '../experiment';

export const halfwayScreen = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (
      !store.session.get('config').story ||
      (store.session.get('config').userMode === 'default' && store.session.get('config').userMetadata.grade >= 6)
    ) {
      return mediaAssets.audio[camelCase(`halfwayNs`)];
    }
    if (store.session.get('config').story) {
      return mediaAssets.audio[camelCase(`${store.session('character')}Halfway`)];
    }
    return '';
  },
  prompt: () => {
    if (
      !store.session.get('config').story ||
      (store.session.get('config').userMode === 'default' && store.session.get('config').userMetadata.grade >= 6)
    ) {
      return `
        <div class="jspsych-content-modified">
            <div class="container">
                <img src="${mediaAssets.images.classroomBackground}" alt= "background" style="width:100%;"> 
            </div>
            <div class="text-block">
                <h3> ${i18next.t('gameBreak.halfwayScreen.text1')} </h3>
                <p> ${i18next.t('gameBreak.halfwayScreen.text2')} </p>
            </div>
            ${
              isMobile
                ? ''
                : `<div class="button"> ${i18next.t('navigation.continueButtonText', {
                    input: `${i18next.t('terms.anyKey')}`,
                    action: `${i18next.t('terms.continue')}`,
                  })} </div>`
            }
        </div>`;
    }

    return `
      <div class="jspsych-content-modified" id="sre-background">
          <div class="row">
              <div class="column_1">
                  <img class="characterleft" src="${
                    mediaAssets.images[camelCase(`${store.session('character')}Talking`)]
                  }" alt="animation of student talking">
              </div>
              <div class= "column_3 halfway-text-block">
                  <div class="middle">
                      <p> ${i18next.t('gameBreak.halfwayScreen.text3')}</p>
                      <p> ${i18next.t('gameBreak.halfwayScreen.text4')}</p>
                  </div>
              </div>
          </div>
          ${
            isMobile
              ? ''
              : `<div class="button"> ${i18next.t('navigation.continueButtonText', {
                  input: `${i18next.t('terms.anyKey')}`,
                  action: `${i18next.t('terms.continue')}`,
                })} </div>`
          }
      </div>`;
  },
  keyboard_choices: () => (isMobile ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isMobile ? ['HERE'] : []),
  button_html: () =>
    `<button class="button"> ${i18next.t('navigation.continueButtonText', {
      input: `${i18next.t('terms.here')}`,
      action: `${i18next.t('terms.continue')}`,
    })} </button>`,
  on_finish: () => {
    store.session.set('indexTracking', 0);
  },
};

const endScreen = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (
      !store.session.get('config').story ||
      (store.session.get('config').userMode === 'default' && store.session.get('config').userMetadata.grade >= 6)
    ) {
      return mediaAssets.audio[camelCase(`endNs`)];
    }
    if (store.session.get('config').story) {
      return mediaAssets.audio[camelCase(`${store.session('character')}End`)];
    }
    return '';
  },
  prompt: () => {
    if (
      !store.session.get('config').story ||
      (store.session.get('config').userMode === 'default' && store.session.get('config').userMetadata.grade >= 6)
    ) {
      return `
        <div class="jspsych-content-modified">
            <div class="container">
                <img src="${mediaAssets.images.academyBackground}" alt= "background" style="width:100%;"> 
            </div>
            <div class="text-block">
                <h3> ${i18next.t('gameBreak.endScreen.text1')} </h3>
                <p> ${i18next.t('gameBreak.endScreen.text2')} </p> 
            </div>
            ${
              isMobile
                ? ''
                : `<div class="button">${i18next.t('navigation.continueButtonText', {
                    input: `${i18next.t('terms.anyKey')}`,
                    action: `${i18next.t('terms.save')}`,
                  })}</div>`
            }
        </div>`;
    }

    return `
      <div class="jspsych-content-modified">
          <div class="class-container">
              <img src="${mediaAssets.images.classroomBackground}" alt= "classroom" style="width:100%;"> 
          </div>
          <div class="upper">
              <div class="select-text-block"> <span style="font-weight:bold; white-space:nowrap">
                  <h3> ${i18next.t('gameBreak.endScreen.text3')} </h3>
                  <p> ${store.session('character_name')} ${i18next.t('gameBreak.endScreen.text4')} </p> 
              </div>
          </div>
          <div class="student" id="end-student">
              <img src="${
                mediaAssets.images[camelCase(`${store.session('character')}Happy`)]
              }" alt= "character is happy"> 
          </div>
          ${
            isMobile
              ? ''
              : `<div class="button">${i18next.t('navigation.continueButtonText', {
                  input: `${i18next.t('terms.anyKey')}`,
                  action: `${i18next.t('terms.save')}`,
                })}</div>`
          }
      </div>`;
  },
  keyboard_choices: () => (isMobile ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isMobile ? ['HERE'] : []),
  button_html: () =>
    `<button class="button"> ${i18next.t('navigation.continueButtonText', {
      input: `${i18next.t('terms.here')}`,
      action: `${i18next.t('terms.save')}`,
    })} </button>`,
  data: {
    save_trial: false,
  },
};

const debriefBlock = {
  type: jsPsychHtmlMultiResponse,
  stimulus: () => `
    <div class="jspsych-content-modified">
        <div class="container">
            <img src="${mediaAssets.images.academyBackground}" alt= "background" style="width:100%;"> </div>
        <div class="demo-text-block">
            <h3>${i18next.t('gameBreak.debrief.text1')}</h3>
            <p>${i18next.t('gameBreak.debrief.text2')}</p>
        </div>
        ${
          isMobile
            ? ''
            : `<div class="button">${i18next.t('navigation.continueButtonText', {
                input: `${i18next.t('terms.anyKey')}`,
                action: `${i18next.t('terms.close')}`,
              })}</div>`
        }
    </div>`,
  keyboard_choices: () => (isMobile ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isMobile ? ['HERE'] : []),
  button_html: () =>
    `<button class="button"> ${i18next.t('navigation.continueButtonText', {
      input: `${i18next.t('terms.here')}`,
      action: `${i18next.t('terms.close')}`,
    })} </button>`,
};

const ifDebriefBlock = {
  timeline: [debriefBlock],
  conditional_function: () => store.session.get('config').userMode === 'demo',
};

const exitFullscreen = {
  type: jsPsychFullScreen,
  fullscreen_mode: false,
  delay_after: 0,
};

export const endTrials = {
  timeline: [endScreen, ifDebriefBlock, exitFullscreen],
};
