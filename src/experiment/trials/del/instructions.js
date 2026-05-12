/* eslint-disable no-underscore-dangle */
import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import store from 'store2';
import i18next from 'i18next';
import { mediaAssets, paValidityEvaluator } from '../../experiment';
import { updateProgressBarForDELStart, updateProgressBarForEnd } from '../../experimentHelpers';
import '../../i18n';

// deletion (DEL) introduction, instruction, and end blocks
const delIntro1 = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.chSquirrel007,
  on_start: () => {
    paValidityEvaluator.markAsCompleted();
    paValidityEvaluator.startNewBlockValidation('DEL');
    updateProgressBarForDELStart();
    store.session.set('incorrectCounter', 0);
    store.session.set('trialNumBlock', 0);
  },
  prompt: () => `
      <div>
        <h1>${i18next.t('del.instructions.intro1.text1')}</h1>
        <br>
        <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.slide01}" alt="canvas 1">
        <p> ${i18next.t('del.instructions.intro1.text2')} </p>
      </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
};

const delIntro2 = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.chSeaotter001,
  prompt: () => `
      <div>
        <h1> ${i18next.t('del.instructions.intro2.text1')} </h1>
        <br>
        <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.slide31}" alt="canvas 1">
      </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
};

const delIntro3 = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.chSeaotter002,
  prompt: () => `
      <div>
        <h2>${i18next.t('del.instructions.intro3.text1')}</h2>
        <br>
        <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.slide36}" alt="canvas 1">  
      </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
  on_finish: () => {
    store.session.set('keepBlock', true);
    store.session.set('currentCorpusIndex', 0);
    if (!store.session('config').isAdaptive) {
      const corpus = store.session.get('corpus');
      store.session.set('currentStimulus', corpus.practice_DEL[store.session('currentCorpusIndex')]);
    }
    store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
  },
};

// non-story version of DEL introduction
const delIntroNS = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.dELPracticeNs,
  on_start: () => {
    paValidityEvaluator.markAsCompleted();
    paValidityEvaluator.startNewBlockValidation('DEL');
    updateProgressBarForDELStart();
    store.session.set('incorrectCounter', 0);
    store.session.set('trialNumBlock', 0);
  },
  prompt: () => `
      <div>
        <h1>${i18next.t('del.instructions.introNS.text1')}</h1>
        <p>${i18next.t('del.instructions.introNS.text2')}</p>
        <p>${i18next.t('del.instructions.introNS.text3')}</p>
        <h2>${i18next.t('del.instructions.introNS.text4')}</h2>
        <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.audioIcon}" alt="canvas 1">
      </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
  on_finish: () => {
    store.session.set('keepBlock', true);
    store.session.set('currentCorpusIndex', 0);
    if (!store.session('config').isAdaptive) {
      const corpus = store.session.get('corpus');
      store.session.set('currentStimulus', corpus.practice_DEL[store.session('currentCorpusIndex')]);
    }
    store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
  },
};

export const delBreak = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => {
    if (store.session.get('config').story) {
      return mediaAssets.audio.chSeaotter004;
    }
    return mediaAssets.audio.breakNs;
  },
  prompt: () => {
    if (store.session.get('config').story) {
      return `
        <div>
          <h1>${i18next.t('del.instructions.break.text1')}</h1>
          <br>
          <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.otterMoreCrabs}" alt="canvas 1">
        </div>`;
    }
    return `
      <div>
        <h1> ${i18next.t('del.instructions.break.text2')} </h1>
        <p> ${i18next.t('del.instructions.break.text3')} </p>
        <p> ${i18next.t('del.instructions.break.text4')} </p>
        <br>
        <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.audioIcon}" alt="canvas 1">
      </div>`;
  },
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
};

export const delEnd = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => {
    if (store.session.get('config').story) {
      return mediaAssets.audio.chMonkey009;
    }
    return mediaAssets.audio.dELEndNs;
  },
  on_start: () => {
    updateProgressBarForEnd();
  },
  prompt: () => {
    if (store.session.get('config').story) {
      return `
        <div>
          <h1> ${i18next.t('del.instructions.end.text1')} </h1>
          <br>
          <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.characters}" alt="canvas 1">
        </div>`;
    }
    return `
      <div>
        <h1> ${i18next.t('del.instructions.end.text2')} </h1>
        <p> ${i18next.t('del.instructions.end.text3')} </p>
        <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.audioIcon}" alt="canvas 1">
      </div>`;
  },
  trial_ends_after_audio: true,
  response_allowed_while_playing: false,
  choices: [],
};

export const delIntroductionTrials = {
  timeline: [delIntro1, delIntro2, delIntro3],
};

export const delIntroductionTrialsNS = {
  timeline: [delIntroNS],
};
