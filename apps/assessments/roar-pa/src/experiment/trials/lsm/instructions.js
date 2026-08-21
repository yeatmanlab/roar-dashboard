import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import store from 'store2';
import i18next from 'i18next';
import { mediaAssets, paValidityEvaluator } from '../../experiment';
import { updateProgressBarForLSMStart } from '../../experimentHelpers';
import '../../i18n';

// last sound matching (LSM) introduction, instruction, and end blocks
const lsmIntro1 = {
  type: jsPsychAudioButtonResponse,
  on_start: () => {
    paValidityEvaluator.markAsCompleted();
    paValidityEvaluator.startNewBlockValidation('LSM');
    updateProgressBarForLSMStart();
    store.session.set('incorrectCounter', 0);
    store.session.set('trialNumBlock', 0);
  },
  stimulus: () => mediaAssets.audio.chMonkey008,
  prompt: () => `
      <div>
        <h1> ${i18next.t('lsm.instructions.intro1.text1')} </h1>
        <br>
        <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.slide35}" alt="canvas 1">
        <p> ${i18next.t('lsm.instructions.intro1.text2')} </p>
      </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
};

const lsmIntro2 = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.chRabbit001,
  prompt: () => `
        <div>
          <h1> ${i18next.t('lsm.instructions.intro2.text1')} </h1>
          <br>
          <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.bunny}" alt="canvas 1">
        </div>`,
  trial_ends_after_audio: true,
  choices: [],
  response_allowed_while_playing: false,
};

const lsmIntro3 = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.chRabbit002,
  prompt: () => `
        <div>
          <h2> ${i18next.t('lsm.instructions.intro3.text1')}</h2>
          <br>
          <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.slide34}" alt="canvas 1">
        </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
  on_finish: () => {
    store.session.set('keepBlock', true);
    store.session.set('currentCorpusIndex', 0);
    if (!store.session('config').isAdaptive) {
      const corpus = store.session.get('corpus');
      store.session.set('currentStimulus', corpus.practice_LSM[store.session('currentCorpusIndex')]);
    }
    store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
  },
};

// non-story version of LSM introduction
const lsmIntroNS = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.lSPracticeNs,
  on_start: () => {
    paValidityEvaluator.markAsCompleted();
    paValidityEvaluator.startNewBlockValidation('LSM');
    updateProgressBarForLSMStart();
    store.session.set('incorrectCounter', 0);
    store.session.set('trialNumBlock', 0);
  },
  prompt: () => `
        <div>
          <h1> ${i18next.t('lsm.instructions.introNS.text1')} </h1>
          <p> ${i18next.t('lsm.instructions.introNS.text2')} </p>
          <p> ${i18next.t('lsm.instructions.introNS.text3')} </p>
          <h2> ${i18next.t('lsm.instructions.introNS.text4')} </h2>
          <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.audioIcon}" alt="canvas 1">
        </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
  on_finish: () => {
    store.session.set('keepBlock', true);
    store.session.set('currentCorpusIndex', 0);
    if (!store.session('config').isAdaptive) {
      const corpus = store.session.get('corpus');
      store.session.set('currentStimulus', corpus.practice_LSM[store.session('currentCorpusIndex')]);
    }
    store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
  },
};

export const lsmBreak = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => {
    if (store.session.get('config').story) {
      return mediaAssets.audio.chRabbit004;
    }
    return mediaAssets.audio.breakNs;
  },
  prompt: () => {
    if (store.session.get('config').story) {
      return `
          <div>
            <h1> ${i18next.t('lsm.instructions.break.text1')} </h1>
            <br>
            <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.rabbitCarrots}" alt="canvas 1">
          </div>`;
    }
    return `
        <div>
          <h1> ${i18next.t('lsm.instructions.break.text2')} </h1>
          <p> ${i18next.t('lsm.instructions.break.text3')} </p>
          <p> ${i18next.t('lsm.instructions.break.text4')} </p>
          <br>
          <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.audioIcon}" alt="canvas 1">
        </div>`;
  },
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
};

export const lsmEnd = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => {
    if (store.session.get('config').story) {
      return mediaAssets.audio.chRabbit005;
    }
    return mediaAssets.audio.lSEndNs;
  },
  prompt: () => {
    if (store.session.get('config').story) {
      return `
          <div>
            <h1> ${i18next.t('lsm.instructions.end.text1')} </h1>
            <br>
            <img draggable="false" class="instructionCanvas" src="${
              mediaAssets.images.rabbitSittingOnCarrots
            }" alt="canvas 1">
          </div>`;
    }
    return `
        <div>
          <h1> ${i18next.t('lsm.instructions.end.text2')} </h1>
          <p> ${i18next.t('lsm.instructions.end.text3')} </p>
          <p> ${i18next.t('lsm.instructions.end.text4')} </p>
          <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.audioIcon}" alt="canvas 1">
        </div>`;
  },
  trial_ends_after_audio: true,
  choices: [],
  response_allowed_while_playing: false,
};

export const lsmIntroductionTrials = {
  timeline: [lsmIntro1, lsmIntro2, lsmIntro3],
};

export const lsmIntroductionTrialsNS = {
  timeline: [lsmIntroNS],
};
