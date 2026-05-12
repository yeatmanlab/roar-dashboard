import store from 'store2';
import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import { camelize } from '@bdelab/roar-utils';
import { getTestTrials } from '../test';
import { practiceStoppingRule, saveTrialData } from '../../experimentHelpers';
import { mediaAssets } from '../../experiment';

export const delPracticeTrials = {
  timeline: [
    ...getTestTrials('del'),
    {
      type: jsPsychAudioButtonResponse,
      stimulus: () => mediaAssets.audio[camelize(store.session('currentStimulus').quest)],
      prompt: () => `<div id="jspsych-audio-button-response-stimulus" style="position: fixed; bottom: 55%">
            <img draggable="false" class="testImageUp"
                 src="${mediaAssets.images.listenGirl}" alt="stim">
        </div>`,
      choices: () => [
        mediaAssets.images[store.session('currentStimulus').arrayShow[0]],
        mediaAssets.images[store.session('currentStimulus').arrayShow[1]],
        mediaAssets.images[store.session('currentStimulus').arrayShow[2]],
      ],
      button_html: [
        '<img draggable="false" class="testImageDown" src="%choice%" alt="response" />',
        '<img draggable="false" class="testImageDown" src="%choice%" alt="response" />',
        '<img draggable="false" class="testImageDown" src="%choice%" alt="response" />',
      ],
      data: {
        assessment_stage: 'practice_response',
        start_time: () => new Date(store.session.get('config').startTime).toLocaleString('PST'),
        start_time_unix: () => new Date(store.session.get('config').startTime).getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        save_trial: true,
      },
      on_finish: (data) => {
        saveTrialData(data);
      },
    },
    {
      type: jsPsychAudioButtonResponse,
      stimulus: () => mediaAssets.audio[camelize(store.session('feedbackAudio'))],
      prompt: () => `
            <div id="jspsych-html-multi-response-stimulus">
              <img draggable="false" class="testImageCenter" src="${store.session('feedbackImage')}" alt="reward">
            </div>
            <img draggable="false" class="reward_feedback" src="${
              store.session('response') === 1 ? mediaAssets.images.sunglassesEmoji : mediaAssets.images.thinkingEmoji
            }" alt="reward">`,
      choices: [],
      trial_ends_after_audio: true,
      response_allowed_while_playing: false,
    },
  ],
  loop_function: function () {
    return practiceStoppingRule('practice_DEL');
  },
};
