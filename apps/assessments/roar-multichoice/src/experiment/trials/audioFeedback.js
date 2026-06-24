 
import jsPsychAudioKeyboardResponse from '@jspsych/plugin-audio-keyboard-response';
import store from 'store2';
import { mediaAssets } from '../experimentSetup';

export const audioResponse = {
  type: jsPsychAudioKeyboardResponse,
  stimulus: () => {
    if (store.session.get('config').audioFeedback === 'binary' && store.session('currentTrialCorrect')) {
      return mediaAssets.audio.coin;
    }

    if (store.session.get('config').audioFeedback === 'binary' && !store.session('currentTrialCorrect')) {
      return mediaAssets.audio.fail;
    }

    // neutral case
    return mediaAssets.audio.select;
  },
  choices: 'NO_KEYS',
  trial_ends_after_audio: true,
  prompt: '',
};

export const audioResponseNeutral = {
  type: jsPsychAudioKeyboardResponse,
  stimulus: () => {
    // neutral case
    return mediaAssets.audio.select;
  },
  choices: 'NO_KEYS',
  trial_ends_after_audio: true,
  prompt: '',
};
