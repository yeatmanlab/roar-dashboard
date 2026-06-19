import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import store from 'store2';
import i18next from 'i18next';
import { camelize } from '@bdelab/roar-utils';
import { getTestTrials } from '../test';
import {
  breakTrialConditionalFunction,
  saveTrialData,
  stoppingRule,
  testLoopFunction,
  updateProgressBar,
} from '../../experimentHelpers';
import { mediaAssets } from '../../experiment';
import { fsmBreak } from './instructions';

export const fsmTestTrials = {
  timeline: [
    ...getTestTrials(),
    {
      type: jsPsychAudioButtonResponse,
      stimulus: () => mediaAssets.audio[camelize(store.session('currentStimulus').quest)],
      prompt: () => `
            <div id="jspsych-audio-button-response-stimulus" style="position: fixed; bottom: 55%">
              <img draggable="false" class="testImageUp" src="${
                mediaAssets.images[store.session('currentStimulus').stimulus]
              }" alt="stim">
            </div>`,
      choices: () => [
        mediaAssets.images[store.session('currentStimulus').arrayShow[0]],
        mediaAssets.images[store.session('currentStimulus').arrayShow[1]],
        mediaAssets.images[store.session('currentStimulus').arrayShow[2]],
      ],
      button_html: '<img draggable="false" class="testImageDown" src="%choice%" alt="response" />',
      data: {
        save_trial: true,
        assessment_stage: 'test',
        start_time: () => new Date(store.session.get('config').startTime).toLocaleString(),
        start_time_unix: () => new Date(store.session.get('config').startTime).getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      on_finish: (data) => {
        saveTrialData(data);
        if (!store.session('config').isAdaptive) {
          const corpus = store.session.get('corpus');
          store.session.set('currentStimulus', corpus.test_FSM[store.session('currentCorpusIndex')]);
        }
        store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
        updateProgressBar();
      },
    },
    {
      type: jsPsychAudioButtonResponse,
      stimulus: () => {
        const reward_sound = ['reward1_60', 'reward2_60', 'reward3_60'];
        store.session.set('reward_sound', reward_sound[Math.floor(Math.random() * reward_sound.length)]);
        return mediaAssets.audio[camelize(store.session('reward_sound'))];
      },
      prompt: () => {
        let rewardPic = [];
        if (store.session.get('config').story) {
          rewardPic = ['bananasPlus3', 'bananasPlus2', 'bananaPlus1'];
        } else {
          rewardPic = ['coins03', 'coins02', 'coins01'];
        }
        return `
            <div id="jspsych-audio-button-response-stimulus">
              <img draggable="false" class="testImageCenter" src="${store.session('feedbackImage')}" alt="reward">
            </div>
            <img draggable="false" class="reward_feedback" src="${
              mediaAssets.images[rewardPic[Math.floor(Math.random() * rewardPic.length)]]
            }" alt="reward">`;
      },
      on_finish: () => {
        if (i18next.language === 'en') {
          stoppingRule(); // if english, use this, if not, don't call it
        }
      },
      choices: [],
      response_allowed_while_playing: false,
      trial_ends_after_audio: true,
    },
    {
      timeline: [fsmBreak],
      conditional_function: () => breakTrialConditionalFunction('fsm'),
    },
  ],
  loop_function: () => testLoopFunction('fsm'),
};
