import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import store from 'store2';
import i18next from 'i18next';
import { mediaAssets } from '../../experiment';
import '../../i18n';
import { readyStoreForTestTrials } from '../../experimentHelpers';

export const lsmReady = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => {
    if (store.session.get('config').story) {
      return mediaAssets.audio.chRabbit003;
    }
    return mediaAssets.audio.lSReadyNs;
  },
  prompt: () => {
    if (store.session.get('config').story) {
      return `
          <div>
            <h1> ${i18next.t('lsm.ready.text1')}</h1>
            <br>
            <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.carrots}" alt="canvas 1">
          </div>`;
    }
    return `
        <div>
          <h1> ${i18next.t('lsm.ready.text2')} </h1>
          <p> ${i18next.t('lsm.ready.text3')} </p>
          <p>  ${i18next.t('lsm.ready.text4')}</p>
          <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.audioIcons}" alt="canvas 1">
        </div>`;
  },
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
  on_finish: () => {
    readyStoreForTestTrials('test_LSM');
  },
};
