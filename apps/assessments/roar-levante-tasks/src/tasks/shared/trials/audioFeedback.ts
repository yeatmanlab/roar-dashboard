import jsPsychAudioKeyboardResponse from '@jspsych/plugin-audio-keyboard-response';
import { taskStore } from '../../../taskStore';

export function getAudioResponse(mediaAssets: MediaAssetsType) {
  return {
    type: jsPsychAudioKeyboardResponse,
    stimulus: () => {
      if (taskStore().audioFeedback === 'binary' && taskStore().isCorrect) {
        return mediaAssets.audio.coin;
      }

      if (taskStore().audioFeedback === 'binary' && !taskStore().isCorrect) {
        return mediaAssets.audio.fail;
      }

      // neutral case
      return mediaAssets.audio.select;
    },
    choices: 'NO_KEYS',
    trial_ends_after_audio: true,
    post_trial_gap: 500,
    prompt: '',
  };
}
