import jsPsychAudioKeyboardResponse from "@jspsych/plugin-audio-keyboard-response";
import { mediaAssets } from "../../..";
import store from "store2"; //storing session data

const blackScreen = {
  type: jsPsychAudioKeyboardResponse,
  stimulus: () => mediaAssets.audio.neutralSoundCut,
  prompt: () => {
    return `<div class="blackBG"></div>`;
  },
  trial_duration: () => 500,
  response_ends_trial: () => false,
};

//add black screen
export const ifTimeoutFlash = {
  timeline: [blackScreen],
  conditional_function: () => {
    if (store.session.get("timeOut")) {
      return true;
    }
    return false;
  },
};
