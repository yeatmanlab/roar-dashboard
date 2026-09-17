import jsPsychAudioButtonResponse from '@jspsych/plugin-audio-button-response';
import store from 'store2';
import { camelize } from '@bdelab/roar-utils';
import { mediaAssets } from '../experiment';
import { setNextStimulus } from '../experimentHelpers';

const prompt1 = (cuelocation) => `
      <div id="jspsych-audio-button-response-stimulus" style="position: fixed; bottom: 55%">
        <div>
          <img draggable="false" class="testImageUp ${cuelocation === 0 ? 'highlight' : ''}" src="${
            mediaAssets.images[store.session('currentStimulus').stimulus]
          }" alt="stim">
        </div>
      </div>
      <div id="jspsych-audio-button-response-btngroup">
        <div class="jspsych-audio-button-response-button" id="jspsych-audio-button-response-button-0" data-choice="0">
          <img draggable="false" class="testImageDown ${cuelocation === 1 ? 'highlight' : ''}" src="${
            mediaAssets.images[store.session('currentStimulus').arrayShow[0]]
          }" alt="test">
        </div>
        <div class="jspsych-audio-button-response-button" id="jspsych-audio-button-response-button-1" data-choice="1">
          <img draggable="false" class="testImageDown ${cuelocation === 2 ? 'highlight' : ''}" src="${
            mediaAssets.images[store.session('currentStimulus').arrayShow[1]]
          }" alt="test">
        </div>
        <div class="jspsych-audio-button-response-button" id="jspsych-audio-button-response-button-2" data-choice="2">
          <img draggable="false" class="testImageDown ${cuelocation === 3 ? 'highlight' : ''}" src="${
            mediaAssets.images[store.session('currentStimulus').arrayShow[2]]
          }" alt="test">
        </div>
      </div>`;

export const prompt2 = () => `
      <div id="jspsych-html-multi-response-stimulus">
        <div>
          <img draggable="false" class="imageUnderInstruction" src="${mediaAssets.images.listenGirl}" alt="stim">
        </div>
      </div>`;

const prompt3 = (cuelocation) => `
      <div id="jspsych-audio-button-response-stimulus" style="position: fixed; bottom: 55%">
        <div>
          <img draggable="false" class="testImageUp ${cuelocation === 0 ? 'highlight' : ''}" src="${
            mediaAssets.images.listenGirl
          }" alt="stim">
        </div>
      </div>
      <div id="jspsych-audio-button-response-btngroup" style = "position: fixed; bottom: 25%">
        <div class="jspsych-audio-button-response-button" id="jspsych-audio-button-response-button-0" data-choice="0">
          <img draggable="false" class="testImageDown ${cuelocation === 1 ? 'highlight' : ''}" src="${
            mediaAssets.images[store.session('currentStimulus').arrayShow[0]]
          }" alt="test">
        </div>
        <div class="jspsych-audio-button-response-button" id="jspsych-audio-button-response-button-1" data-choice="1">
          <img draggable="false" class="testImageDown ${cuelocation === 2 ? 'highlight' : ''}" src="${
            mediaAssets.images[store.session('currentStimulus').arrayShow[1]]
          }" alt="test">
        </div>
        <div class="jspsych-audio-button-response-button" id="jspsych-audio-button-response-button-2" data-choice="2">
          <img draggable="false" class="testImageDown ${cuelocation === 3 ? 'highlight' : ''}" src="${
            mediaAssets.images[store.session('currentStimulus').arrayShow[2]]
          }" alt="test">
        </div>
      </div>`;

export const getStimulus = (index, subskill) => {
  const { trialNumBlock, config } = store.session();
  const stimulusRefetchRequired = config.isAdaptive && trialNumBlock === 0;
  if (index === 0) {
    if (stimulusRefetchRequired) {
      setNextStimulus(true);
    }
    switch (subskill) {
      case 'practice':
        return mediaAssets.audio[camelize(store.session('currentStimulus').instr)];
      case 'del':
        return mediaAssets.audio[camelize(store.session('currentStimulus').quest)];
      default:
        return mediaAssets.audio[camelize(store.session('currentStimulus').stimulus)];
    }
  } else {
    return mediaAssets.audio[camelize(store.session('currentStimulus').arrayShow[index - 1])];
  }
};

const getPrompt = (index, subskill) => {
  if (subskill === 'del') {
    if (index === 0) {
      return prompt2();
    }
    return prompt3(index);
  }
  return prompt1(index);
};

export const getTestTrials = (trialMode) => {
  // Phoneme is a 3AFC assessment. If including the stimulus, there are four stimulus indexes.
  const stimulusIndexes = [0, 1, 2, 3];
  const trials = stimulusIndexes.map((stimulusIndex) => ({
    type: jsPsychAudioButtonResponse,
    stimulus: () => getStimulus(stimulusIndex, trialMode),
    prompt: () => getPrompt(stimulusIndex, trialMode),
    choices: [],
    response_allowed_while_playing: false,
    trial_ends_after_audio: false,
    trial_duration: () => {
      if (trialMode === 'practice' && stimulusIndex === 0) return 6000;
      if (trialMode === 'del' && stimulusIndex === 0) return 4000;
      return 1100;
    },
    on_finish: () => {
      if (store.session('config').isAdaptive) {
        store.session.set('previousAnswer', store.session('response'));
        store.session.set('previousItem', store.session('currentStimulus'));
      }
    },
  }));

  return trials;
};
