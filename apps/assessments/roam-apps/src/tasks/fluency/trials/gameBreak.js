/*
Defines jspsych objects for correct and incorrect practice trial feeback.
*/

import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import i18next from 'i18next';
import '../../../i18n/i18n';
import store from 'store2'; //storing session data
import { isMobile } from '../helpers';
import { jsPsych } from '../../taskSetup';

export const endScreen = (responseMode, idx) => {
  return {
    type: jsPsychAudioMultiResponse,
    stimulus: () => {
      if (store.session.get('responseModality')) {
        /*let config = store.session.get("config");
        let endAudio =
          groupMapping[config?.group][config?.taskName][config?.responseMode]
            .endAudio;
        return mediaAssets.audio[camelize(endAudio)];*/
        if (idx < 1) {
          if (responseMode.includes('afc')) {
            return mediaAssets.audio.responseModalityEndScreenProduction;
          } else {
            return mediaAssets.audio.responseModalityEndScreenAfc;
          }
        } else {
          return mediaAssets.audio.afcGameEnd;
        }
      }
      return mediaAssets.audio[store.session.get('config').responseMode.replace(/\d+/g, '') + 'GameEnd'];
    },
    prompt: () => {
      let config = store.session.get('config');
      let pressAnyKey = '';
      /*if (store.session.get("responseModality")) {
        let endText =
          groupMapping[config.group][config.taskName][config.responseMode]
            .endText;
        if (endText !== undefined) {
          if (config.responseMode === "production") {
            pressAnyKey = `<div class="key-button"> ${i18next.t(
              "navigation.continueButtonText",
              {
                input: `${i18next.t("terms.anyKey")}`,
                action: `${i18next.t("terms.continue")}`,
              },
            )} </div>`;
          }
          return (
            `
            <div class="tiger-gif-container">
              <div class="speechbubble">
              <h1 class="header">${i18next.t("postPractice.text1")} </h1>
              <p class="text"> ${i18next.t(endText)} </p>
              </div>
              <img class="roam-tiger" src=${
                mediaAssets.images[store.session.get("displayImage")]
              } alt="tiger"/>
            </div>` + pressAnyKey
          );
        }
      }*/
      if (store.session.get('responseModality') && idx < 1) {
        let mode = 'responseModalityStudy.endScreen.text10';
        if (responseMode === 'production') {
          mode = isMobile ? 'responseModalityStudy.endScreen.text12' : 'responseModalityStudy.endScreen.text11';
        }
        let text = `${i18next.t('responseModalityStudy.endScreen.text9', {
          mode: `${i18next.t(mode)}`,
        })}`;
        return `
            <div class="tiger-gif-container">
              <div class="speechbubble">
              <h1 class="header">${i18next.t('responseModalityStudy.endScreen.text8')} </h1>
              <p class="text"> ${i18next.t(text)} </p>
              </div>
              <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
            </div>`;
      }
      if (config.responseMode === 'production' && !isMobile && !store.session.get('responseModality')) {
        pressAnyKey = `<div class="key-button"> ${i18next.t('gameBreak.endScreen.text3')} </div>`;
        return (
          `
          <div class="tiger-gif-container">
            <div class="speechbubble">
            <h1 class="header">${i18next.t('gameBreak.endScreen.text1')} </h1>
            <p class="text"> ${i18next.t('gameBreak.endScreen.text2')} </p>
            </div>
            <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
          </div>` + pressAnyKey
        );
      }
      return `
          <div class="tiger-gif-container">
            <div class="speechbubble">
            <h1 class="header">${i18next.t('gameBreak.endScreen.text1')} </h1>
            <p class="text"> ${i18next.t('gameBreak.endScreen.text2')} </p>
            <p class="text"> ${i18next.t('gameBreak.endScreen.text7')} </p>
            </div>
            <img class="roam-tiger" src=${mediaAssets.images[store.session.get('displayImage')]} alt="tiger"/>
          </div>`;
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
    on_start: () => {
      if (store.session.get('config').responseMode != 'production' || store.session.get('responseModality')) {
        document.body.style.cursor = 'auto';
        document.body.scrollTop = 0; // For Safari
        document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
      }
    },
    on_load: () => {
      //hide progress bar
      document.getElementById('jspsych-progressbar-container').style.visibility = 'hidden';

      //disable button to prevent double clicks
      const btn = document.getElementById('go-button-id');
      jsPsych.setProgressBar(0); //reset progress bar
      if (btn) {
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
          btn.style.pointerEvents = 'auto';
        }, 1000);
      }
    },
  };
};
