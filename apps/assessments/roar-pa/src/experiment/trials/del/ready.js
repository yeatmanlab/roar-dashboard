import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import store from 'store2';
import i18next from 'i18next';
import { mediaAssets } from '../../experiment';
import { readyStoreForTestTrials } from '../../experimentHelpers';
import '../../i18n';

export const delReady = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => {
    if (store.session.get('config').story) {
      return mediaAssets.audio.chSeaotter003;
    }
    return mediaAssets.audio.dELReadyNs;
  },
  prompt: () => {
    if (store.session.get('config').story) {
      return `
          <div>
            <h1> ${i18next.t('del.ready.text1')}</h1>
            <br>
            <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.crabs}" alt="canvas 1">
          </div>`;
    }
    return `
        <div>
          <h1> ${i18next.t('del.ready.text2')} </h1>
          <p> ${i18next.t('del.ready.text3')} </p>
          <p> ${i18next.t('del.ready.text4')} </p>
          <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.audioIcons}" alt="canvas 1">
        </div>`;
  },
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
  on_finish: () => {
    readyStoreForTestTrials('test_DEL');
  },
};
