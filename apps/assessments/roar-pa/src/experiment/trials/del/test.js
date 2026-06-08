import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import i18next from 'i18next';
import store from 'store2';
import { camelize } from '@bdelab/roar-utils';
import { mediaAssets } from '../../experiment';
import {
  breakTrialConditionalFunction,
  saveTrialData,
  stoppingRule,
  testLoopFunction,
  updateProgressBar,
} from '../../experimentHelpers';
import { delBreak } from './instructions';
import '../../i18n';
import { getStimulus, prompt2 } from '../test';
import { jsPsych } from '../../jsPsych';

let source;

export const delTestTrials = {
  timeline: [
    {
      type: jsPsychAudioButtonResponse,
      stimulus: () => getStimulus(0, 'del'), // mediaAssets.audio[camelize(store.session('currentStimulus').quest)],
      prompt: () => prompt2(),
      choices: [],
      trial_ends_after_audio: true,
      response_allowed_while_playing: false,
    },
    {
      type: jsPsychHtmlMultiResponse,
      on_load: () => {
        const replayBtn = document.getElementById('replay');

        async function replayAudio() {
          const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

          // Returns a promise of the AudioBuffer of the preloaded file path.
          const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(
            mediaAssets.audio[camelize(store.session('currentStimulus').quest)],
          );

          source = jsPsychAudioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(jsPsychAudioCtx.destination);
          source.start(0);

          replayBtn.disabled = 'disabled';
          replayBtn.style.color = 'rgba(255, 255, 255, 0)';
          replayBtn.style.background = 'rgba(255, 255, 255, 0)';
          replayBtn.style.border = 'rgba(255, 255, 255, 0)';
        }

        replayBtn.addEventListener('click', replayAudio);
      },
      stimulus: () => ``,
      prompt: () => `
            <button class = "jspsych-btn" id="replay">${i18next.t('del.test.text1')}</button>
            <div id="jspsych-audio-button-response-stimulus" style="position: fixed; bottom: 55%">
                <img draggable="false" class="testImageUp" src="${mediaAssets.images.listenGirl}" alt="stim">
            </div>`,
      button_choices: () => [
        mediaAssets.images[store.session('currentStimulus').arrayShow[0]],
        mediaAssets.images[store.session('currentStimulus').arrayShow[1]],
        mediaAssets.images[store.session('currentStimulus').arrayShow[2]],
      ],
      button_html: '<img draggable="false" class="testImageDown"  src="%choice%" alt="response" />',
      data: {
        save_trial: true,
        assessment_stage: 'test_response',
        start_time: () => new Date(store.session.get('config').startTime).toLocaleString('PST'),
        start_time_unix: () => new Date(store.session.get('config').startTime).getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      on_finish: (data) => {
        // pause audio
        if (source) {
          source.stop();
        }
        saveTrialData(data, 'button');
        if (!store.session('config').isAdaptive) {
          const corpus = store.session.get('corpus');
          store.session.set('currentStimulus', corpus.test_DEL[store.session('currentCorpusIndex')]);
        }
        store.session.transact('currentCorpusIndex', (oldVal) => oldVal + 1);
        updateProgressBar();
      },
    },
    {
      type: jsPsychAudioButtonResponse,
      stimulus: () => {
        const reward_sound = ['reward7_60', 'reward13_60', 'reward9_60'];
        store.session.set('reward_sound', reward_sound[Math.floor(Math.random() * reward_sound.length)]);
        return mediaAssets.audio[camelize(store.session('reward_sound'))];
      },
      prompt: () => {
        let rewardPic = [];
        if (store.session.get('config').story) {
          rewardPic = ['crabsPlus3', 'crabsPlus2', 'crabPlus1'];
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
      timeline: [delBreak],
      conditional_function: () => breakTrialConditionalFunction('del'),
    },
  ],
  loop_function: () => testLoopFunction('del'),
};
