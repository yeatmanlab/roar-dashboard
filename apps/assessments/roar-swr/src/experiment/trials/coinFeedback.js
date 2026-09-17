import jsPsychAudioKeyboardResponse from '@jspsych/plugin-audio-keyboard-response';
import store from 'store2';
import { mediaAssets } from '../experiment';

/* coin tracking trial */
const coinTrackingFeedback = {
  type: jsPsychAudioKeyboardResponse,
  stimulus: () => mediaAssets.audio.fairyCoin,
  prompt: () =>
    `<div class = "stimulus_div"><img class = "coin_feedback" src="${mediaAssets.images.coinBag}" alt="gold"></div>`,
  choices: 'NO_KEYS',
  trial_duration: 2000,
};

export const ifCoinTracking = {
  timeline: [coinTrackingFeedback],
  conditional_function: () => {
    if (
      store.session.get('config').userMode === 'presentationExp' ||
      store.session.get('config').userMode === 'presentationExpShort' ||
      store.session.get('config').userMode === 'presentationExp2Conditions'
    ) {
      return store.session.get('trialNumBlock') === 1;
    }
    const coinTrackingIndex = store.session('coinTrackingIndex');
    if (store.session('currentTrialCorrect') && coinTrackingIndex >= 10) {
      store.session.set('coinTrackingIndex', 0);
      return true;
    }
    store.session.set('coinTrackingIndex', coinTrackingIndex + 1);
    return false;
  },
};
