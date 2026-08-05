import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { mediaAssets } from '../../..';
import {
  addExperimenterButtons,
  getParticipantUtilityButtonsHtml,
  PageStateHandler,
  PageAudioHandler,
  setupReplayAudio,
  enableOkButton,
  setupFullscreenButton,
} from '../../shared/helpers';
import { jsPsych } from '../../taskSetup';
import { taskStore } from '../../../taskStore';

const replayButtonHtmlId = 'replay-btn-revisited';

const audioConfig: AudioConfigType = {
  restrictRepetition: {
    enabled: true,
    maxRepetitions: 2,
  },
  onEnded: enableOkButton,
};

// Switch to HTMLMultiResponse when we have video with audio
export const videoInstructionsFit = {
  type: jsPsychHtmlMultiResponse,
  data: () => {
    return {
      // save_trial: true,
      assessment_stage: 'instructions',
    };
  },
  stimulus: () => {
    const videoSrc = mediaAssets.video.mentalRotationExampleFit;

    return `
      <div class="lev-stimulus-container">
        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
        <video class="instruction-video" autoplay>
          <source src=${videoSrc} type="video/mp4"/>
          Video not loading: ${videoSrc}. Please continue the task.
        </video>
      </div>
    `;
  },
  prompt_above_buttons: true,
  button_choices: ['Continue'],
  button_html: () => {
    const t = taskStore().translations;
    return `<button class="primary" disabled>${t.continueButtonText}</button>`;
  },
  keyboard_choices: 'NO_KEYS',
  on_load: () => {
    // const wrapper = document.getElementById('jspsych-audio-multi-response-prompt');
    // wrapper.style.display = 'flex';
    // wrapper.style.justifyContent = 'center';
    PageAudioHandler.playAudio(mediaAssets.audio.mentalRotationTrainingInstruct3, audioConfig);

    const pageStateHandler = new PageStateHandler('mental-rotation-training-instruct3', true);
    setupReplayAudio(pageStateHandler);
    addExperimenterButtons();
    setupFullscreenButton();
  },
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode();

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
    });
  },
};

export const videoInstructionsMisfit = {
  type: jsPsychHtmlMultiResponse,
  data: () => {
    return {
      assessment_stage: 'instructions',
    };
  },
  stimulus: () => {
    const videoSrc = mediaAssets.video.mentalRotationExampleMisfit;

    return `
      <div class="lev-stimulus-container">
        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
        <video class="instruction-video" autoplay>
          <source src=${videoSrc} type="video/mp4"/>
          Video not loading: ${videoSrc}. Please continue the task.
        </video>
      </div>
    `;
  },
  prompt_above_buttons: true,
  button_choices: ['Continue'],
  button_html: () => {
    const t = taskStore().translations;
    return `<button class="primary" id="ok-button" disabled>${t.continueButtonText}</button>`;
  },
  keyboard_choices: 'NO_KEYS',
  on_load: () => {
    PageAudioHandler.playAudio(mediaAssets.audio.mentalRotationTrainingInstruct2, audioConfig);

    const pageStateHandler = new PageStateHandler('mental-rotation-training-instruct2', true);
    setupReplayAudio(pageStateHandler);
    addExperimenterButtons();
    setupFullscreenButton();
  },
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode();

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
    });
  },
};

export const imageInstructions = {
  type: jsPsychHtmlMultiResponse,
  data: () => {
    return {
      assessment_stage: 'instructions',
    };
  },
  stimulus: () => {
    const imageSrc = mediaAssets.images.mentalRotationExample;

    return `
      <div class="lev-stimulus-container">
        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
        <img 
          src=${imageSrc} 
          class="instruction-video" 
          alt="Image not loading: ${imageSrc}. Please continue the task."
        />
      </div>
    `;
  },
  prompt_above_buttons: true,
  button_choices: ['Continue'],
  button_html: () => {
    const t = taskStore().translations;
    return `<button class="primary" disabled>${t.continueButtonText}</button>`;
  },
  keyboard_choices: 'NO_KEYS',
  on_load: () => {
    PageAudioHandler.playAudio(mediaAssets.audio.mentalRotationInstruct1, audioConfig);

    const pageStateHandler = new PageStateHandler('mental-rotation-instruct1', true);
    setupReplayAudio(pageStateHandler);
    addExperimenterButtons();
    setupFullscreenButton();
  },
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode();

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
    });
  },
};

export const threeDimInstructions = {
  type: jsPsychHtmlMultiResponse,
  data: () => {
    return {
      assessment_stage: 'instructions',
    };
  },
  stimulus: () => {
    const t = taskStore().translations;
    const prompt = taskStore().heavyInstructions ? t.mentalRotationInstruct3DDownex : t.mentalRotationInstruct3D;

    return `
      <div class="lev-stimulus-container">
        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
        <div class="lev-row-container instruction">
          <p>${prompt}</p>
        </div>
      </div>
    `;
  },
  prompt_above_buttons: true,
  button_choices: ['Continue'],
  post_trial_gap: 350,
  button_html: () => {
    const t = taskStore().translations;
    return `<button class="primary" disabled>${t.continueButtonText}</button>`;
  },
  keyboard_choices: 'NO_KEYS',
  trial_ends_after_audio: false,
  response_allowed_while_playing: false,
  on_load: () => {
    const prompt = taskStore().heavyInstructions ? 'mentalRotationInstruct3DDownex' : 'mentalRotationInstruct3D';

    PageAudioHandler.playAudio(mediaAssets.audio[prompt], audioConfig);
    const pageStateHandler = new PageStateHandler(prompt, true);
    setupReplayAudio(pageStateHandler);
    addExperimenterButtons();
    setupFullscreenButton();
  },
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode();

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
    });
  },
};

export const polygonInstructions = {
  type: jsPsychHtmlMultiResponse,
  data: () => {
    return {
      assessment_stage: 'instructions',
    };
  },
  stimulus: () => {
    const t = taskStore().translations;
    const prompt = t.mentalRotationInstructPolygonDownex;

    return `
      <div class="lev-stimulus-container">
        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
        <div class="lev-row-container instruction">
          <p>${prompt}</p>
        </div>
      </div>
    `;
  },
  prompt_above_buttons: true,
  button_choices: ['Continue'],
  post_trial_gap: 350,
  button_html: () => {
    const t = taskStore().translations;
    return `<button class="primary" disabled>${t.continueButtonText}</button>`;
  },
  keyboard_choices: 'NO_KEYS',
  trial_ends_after_audio: false,
  response_allowed_while_playing: false,
  on_load: () => {
    const prompt = 'mentalRotationInstructPolygonDownex';

    PageAudioHandler.playAudio(mediaAssets.audio[prompt], audioConfig);
    const pageStateHandler = new PageStateHandler(prompt, true);
    setupReplayAudio(pageStateHandler);
    addExperimenterButtons();
    setupFullscreenButton();
  },
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode();

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
    });
  },
};
