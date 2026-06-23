import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import store from 'store2';
import { camelCase } from 'lodash';
import i18next from 'i18next';
import '../i18n';
import { isMobile } from '../experimentHelpers';
import { mediaAssets } from '../experiment';

export const intro = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (
      !store.session.get('config').story ||
      (store.session.get('config').userMode === 'default' && store.session.get('config').userMetadata.grade >= 6)
    ) {
      return mediaAssets.audio[camelCase(`introductionNs`)];
    }
    return mediaAssets.audio[camelCase(`introduction`)];
  },
  prompt: () => {
    if (
      !store.session.get('config').story ||
      (store.session.get('config').userMode === 'default' && store.session.get('config').userMetadata.grade >= 6)
    ) {
      return `
        <div class = "jspsych-content-modified">
          <div class="container">
            <img src="${mediaAssets.images.academyBackground}" alt= "background" style="width:100%;"> 
          </div>
          <div class="text-block">
            <h3> ${i18next.t('introduction.intro.text1')} </h3>
            <p> ${i18next.t('introduction.intro.text2')} </p> 
            <p> ${i18next.t('introduction.intro.text3')} </p>
          </div>
          ${
            isMobile
              ? ''
              : `<div class="button"> ${i18next.t('navigation.continueButtonText', {
                  input: `${i18next.t('terms.anyKey')}`,
                  action: `${i18next.t('terms.continue')}`,
                })} </div>`
          }
        </div>
        `;
    }
    return `
      <div class = "jspsych-content-modified">
        <div class="container">
          <img src="${mediaAssets.images.academyBackground}" alt= "background" style="width:100%;"> 
        </div>
        <div class="text-block">
          <h3> ${i18next.t('introduction.intro.text4')} </h3>
          <p> ${i18next.t('introduction.intro.text5')}  </p> 
          <p> ${i18next.t('introduction.intro.text6')}  </p> 
          <p> ${i18next.t('introduction.intro.text3')}  </p>
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
    isMobile
      ? `<button class="button"> ${i18next.t('navigation.continueButtonText', {
          input: `${i18next.t('terms.here')}`,
          action: `${i18next.t('terms.continue')}`,
        })} </button>`
      : '',
  on_start: () => {
    document.body.style.cursor = 'none';
  },
};

// trial that introduces instructions to the player before trial
const postPracticeIntro = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => mediaAssets.audio.postPracticeInstruction,
  prompt: () => `
    <div class="jspsych-content-modified" id="sre-background">
      <h3>${i18next.t('practice.postPracticeIntro.text1')}</h3>
      <p>${i18next.t('practice.postPracticeIntro.text2')}</p>
      <p>${i18next.t('practice.postPracticeIntro.text3')}</p>
      <p>${i18next.t('practice.postPracticeIntro.text4')}</p>
      <p>${i18next.t('practice.postPracticeIntro.text5')}</p>
      ${
        isMobile
          ? ''
          : `<div class="button">${i18next.t('navigation.continueButtonText', {
              input: `${i18next.t('terms.anyKey')}`,
              action: `${i18next.t('terms.continue')}`,
            })}</div>`
      }
    </div>`,
  keyboard_choices: () => (isMobile ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isMobile ? ['HERE'] : []),
  button_html: () =>
    isMobile
      ? `<button class="button"> ${i18next.t('navigation.continueButtonText', {
          input: `${i18next.t('terms.here')}`,
          action: `${i18next.t('terms.continue')}`,
        })} </button>`
      : '',
};
// trial that reminds the player what keys to press
const postPracticeReminder = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => mediaAssets.audio.postPracticeReminder,
  prompt: () => `
    <div class="jspsych-content-modified" id="sre-background">
      <h2>${i18next.t('reminderTexts.remember')}</h2>
      <div class="row">
        <div class="column_2_lower" style="background-color:#FFFFFF;">
          <p style="text-align:center;">${i18next.t(
            isMobile ? 'practice.postPracticeReminder.text1Mobile' : 'practice.postPracticeReminder.text1',
          )}</p>
          <img width="70%" src="${mediaAssets.images.falseKey}" alt="arrow keys">
        </div>
        <div class="column_2_lower" style="background-color:#FFFFFF;">
          <p style="text-align:center;">${i18next.t(
            isMobile ? 'practice.postPracticeReminder.text2Mobile' : 'practice.postPracticeReminder.text2',
          )}</p>
          <img width="70%" src="${mediaAssets.images.trueKey}" alt="arrow keys">
        </div>
      </div>
      <p><b>${i18next.t('practice.postPracticeReminder.text3')}</b></p>
      <p><b>${i18next.t('practice.postPracticeReminder.text4')}</b></p>
      ${
        isMobile
          ? ''
          : `<div class="button">${i18next.t('navigation.continueButtonText', {
              input: `${i18next.t('terms.anyKey')}`,
              action: `${i18next.t('terms.begin')}`,
            })} </div>`
      }
    </div>`,
  keyboard_choices: () => (isMobile ? 'NO_KEYS' : 'ALL_KEYS'),
  button_choices: () => (isMobile ? ['HERE'] : []),
  button_html: () =>
    isMobile
      ? `<button class="button"> ${i18next.t('navigation.continueButtonText', {
          input: `${i18next.t('terms.here')}`,
          action: `${i18next.t('terms.begin')}`,
        })} </button>`
      : '',
  on_finish: () => {
    store.session.set('indexTracking', 0);
  },
};

export const postPracticeTrials = {
  timeline: [postPracticeIntro, postPracticeReminder],
};
