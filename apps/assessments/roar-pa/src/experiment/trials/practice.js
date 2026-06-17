import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import store from 'store2';
import { camelize } from '@bdelab/roar-utils';
import { mediaAssets } from '../experiment';
import { practiceStoppingRule, saveTrialData } from '../experimentHelpers';
import { getTestTrials } from './test';

export const writePracticeTrials = (block) => ({
  timeline: [
    ...getTestTrials('practice'),
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
        assessment_stage: 'practice',
        start_time: () => new Date(store.session.get('config').startTime).toLocaleString(),
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
      choices: [],
      response_allowed_while_playing: false,
      trial_ends_after_audio: true,
      prompt: () => `
            <div id="jspsych-audio-button-response-stimulus">
              <img draggable="false" class = "testImageCenter" src="${store.session('feedbackImage')}" alt="reward">
            </div>
            <img draggable="false" class="reward_feedback" src="${
              store.session('response') === 1 ? mediaAssets.images.sunglassesEmoji : mediaAssets.images.thinkingEmoji
            }" alt="reward">`,
    },
  ],
  loop_function: function () {
    return practiceStoppingRule(block);
  },
});
