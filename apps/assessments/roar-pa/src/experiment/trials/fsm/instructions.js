import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import store from 'store2';
import i18next from 'i18next';
import { mediaAssets } from '../../experiment';
import '../../i18n';

const setupRecommendation = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.click,
  prompt: () => `
      <div>
        <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.audioAdjust}" alt="canvas 1">
      </div>`,
  response_ends_trial: false,
  trial_duration: 3000,
  choices: [],
  response_allowed_while_playing: false,
};

const intro = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.chMonkey001,
  prompt: () => `
      <div>
        <h1>${i18next.t('fsm.instructions.intro.text1')}</h1>
        <br>
        <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.characters}" alt="canvas 1">
      </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
};

// first sound matching (FSM) introduction, instruction, and end blocks
const fsmIntro1 = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.chMonkey002,
  prompt: () => `
            <div>
            <h1> ${i18next.t('fsm.instructions.intro1.text1')} </h1>
        <br>
        <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.slide20}" alt="canvas 1">
        </div>
    `,
  trial_ends_after_audio: true,
  choices: [],
  response_allowed_while_playing: false,
};

const fsmIntro2 = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.chMonkey003,
  prompt: () => `
      <div>
        <h2>${i18next.t('fsm.instructions.intro2.text1')}  </h2>
        <br>
        <img draggable="false" class="instructionCanvas" src="${mediaAssets.images.slide33}" alt="canvas 1">
      </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
  on_finish: () => {
    if (!store.session('config').isAdaptive) {
      const corpus = store.session.get('corpus');
      store.session.set('currentStimulus', corpus.practice_FSM[store.session('currentCorpusIndex')]);
    }
    store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
  },
};

// non-story version of general introduction to the activity
const introNS = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.introductionNs,
  prompt: () => `
        <div>
          <h1> ${i18next.t('fsm.instructions.introNS.text1')} </h1>
          <p> ${i18next.t('fsm.instructions.introNS.text2')} </p>
          <p> ${i18next.t('fsm.instructions.introNS.text3')} </p>
          <p> ${i18next.t('fsm.instructions.introNS.text4')} </p>
        </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
};

// non-story version of FSM introduction
const fsmIntroNS = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => mediaAssets.audio.fSPracticeNs,
  prompt: () => `
      <div>
        <h1> ${i18next.t('fsm.instructions.fsmIntroNS.text1')} </h1>
        <p> ${i18next.t('fsm.instructions.fsmIntroNS.text2')} </p>
        <p> ${i18next.t('fsm.instructions.fsmIntroNS.text3')} </p>
        <h2> ${i18next.t('fsm.instructions.fsmIntroNS.text4')} </h2>
        <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.audioIcon}" alt="canvas 1">
      </div>`,
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
  on_finish: () => {
    if (!store.session('config').isAdaptive) {
      const corpus = store.session.get('corpus');
      store.session.set('currentStimulus', corpus.practice_FSM[store.session('currentCorpusIndex')]);
    }
    store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
  },
};

export const fsmBreak = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => {
    if (store.session.get('config').story) {
      return mediaAssets.audio.chMonkey005;
    }
    return mediaAssets.audio.breakNs;
  },
  prompt: () => {
    if (store.session.get('config').story) {
      return `
        <div>
          <h1> ${i18next.t('fsm.instructions.break.text1')} </h1>
          <br>
          <img draggable="false" class="instructionCanvas" src="${
            mediaAssets.images.standingMonkeyBananas
          }" alt="canvas 1">
        </div>`;
    }
    return `
      <div>
        <h1> ${i18next.t('fsm.instructions.break.text2')} </h1>
        <p> ${i18next.t('fsm.instructions.break.text3')} </p>
        <p> ${i18next.t('fsm.instructions.break.text4')} </p>
        <br>
        <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.audioIcon}" alt="canvas 1">
      </div>`;
  },
  choices: () => [mediaAssets.images.go],
  button_html: '<img class="continue" draggable="false" src="%choice%" />',
};

export const fsmEnd = {
  type: jsPsychAudioButtonResponse,
  stimulus: () => {
    if (store.session.get('config').story) {
      return mediaAssets.audio.chMonkey006;
    }
    return mediaAssets.audio.fSEndNs;
  },
  prompt: () => {
    if (store.session.get('config').story) {
      return `
        <div>
          <h1> ${i18next.t('fsm.instructions.end.text1')} </h1>
          <br>
          <img draggable="false" class="instructionCanvas" src="${
            mediaAssets.images.monkeyStandingMoreBananas
          }" alt="canvas 1">
        </div>`;
    }
    return `
      <div>
        <h1> ${i18next.t('fsm.instructions.end.text2')} </h1>
        <p> ${i18next.t('fsm.instructions.end.text3')}</p>
        <p> ${i18next.t('fsm.instructions.end.text4')}</p>
        <img draggable="false" class="instructionCanvasNS" src="${mediaAssets.images.audioIcon}" alt="canvas 1">
      </div>`;
  },
  trial_ends_after_audio: true,
  choices: [],
  response_allowed_while_playing: false,
};

export const fsmIntroductionTrials = {
  timeline: [setupRecommendation, intro, fsmIntro1, fsmIntro2],
};

export const fsmIntroductionTrialsNS = {
  timeline: [introNS, fsmIntroNS],
};
