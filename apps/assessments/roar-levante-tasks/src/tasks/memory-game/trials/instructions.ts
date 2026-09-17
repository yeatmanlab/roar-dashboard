import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { jsPsych } from '../../taskSetup';
import { mediaAssets } from '../../..';
import {
  addExperimenterButtons,
  PageStateHandler,
  PageAudioHandler,
  getParticipantUtilityButtonsHtml,
  setupReplayAudio,
  setupFullscreenButton,
  isEnglish,
} from '../../shared/helpers';
import { taskStore } from '../../../taskStore';

let setPromptDurations = false;

const instructionData = [
  // downex instructions
  {
    prompt: 'memoryGameInstruct1',
    image: 'catAvatar',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'memoryGameInstruct6Downex',
    image: 'catAvatar',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'memoryGameInstruct10Downex',
    image: 'catAvatar',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'heartsAndFlowersEncourage2',
    image: 'rocket@2x',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'heartsAndFlowersPlayTime',
    image: 'catAvatar',
    buttonText: 'continueButtonText',
  },
  // older kid instructions
  {
    prompt: 'memoryGameInstruct1',
    image: 'catAvatar',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'memoryGameInstruct2',
    image: 'highlightedBlock',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'memoryGameInstruct3',
    video: 'selectSequence',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'memoryGameInstruct4',
    image: 'catAvatar',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'memoryGameInstruct5',
    image: 'catAvatar',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'memoryGameInstruct6',
    image: 'catAvatar',
    buttonText: 'continueButtonText',
  },
  {
    prompt: 'memoryGameBackwardPrompt',
    video: 'selectSequenceReverse',
    buttonText: 'continueButtonText',
  },
];

const replayButtonHtmlId = 'replay-btn-revisited';

const instructions = instructionData.map((data) => {
  return {
    type: jsPsychHtmlMultiResponse,
    stimulus: () => {
      const t = taskStore().translations;
      const mediaSrc = data.video ? mediaAssets.video[data.video] : mediaAssets.images[data.image as string];
      return `<div class="lev-stimulus-container">
                        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
                        <div class="lev-row-container instruction">
                            <p>${t[data.prompt]}</p>
                        </div>
                        <div class="lev-stim-content-x-3">
                          ${
                            data.video
                              ? `
                              <video class='instruction-video-small' autoplay loop>
                                <source src=${mediaAssets.video[data.video]} type='video/mp4'>
                              </video>
                            `
                              : taskStore().story || data.image !== 'catAvatar'
                                ? `
                                <img
                                  src=${mediaAssets.images[data.image as string]}
                                  alt="Image not loading ${mediaSrc}. Please continue the task."
                                />
                              `
                                : ''
                          }
                        </div>                    
                    </div>`;
    },
    prompt_above_buttons: true,
    button_choices: data.buttonText ? ['Next'] : [],
    button_html: () => {
      const t = taskStore().translations;

      if (data.buttonText) {
        return [
          `<button class="primary">
                  ${t[data.buttonText]}
          </button>`,
        ];
      }
    },
    keyboard_choices: 'NO_KEYS',
    post_trial_gap: 500,
    on_load: async () => {
      const audioConfig: AudioConfigType = {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
        onEnded: () => {
          if (!data.buttonText) {
            jsPsych.finishTrial();
          }
        },
      };

      PageAudioHandler.playAudio(mediaAssets.audio[data.prompt], audioConfig);
      const pageStateHandler = new PageStateHandler(data.prompt, true);
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();

      // hide toast if it is there
      const toast = document.getElementById('lev-toast-default');
      if (toast) {
        toast.classList.remove('show');
      }

      // set the display prompt durations here, since awaiting promise during a display trial is not possible in the jsPsych plugin
      if (!setPromptDurations) {
        setPromptDurations = true;

        const displayPromptDurations = isEnglish(taskStore().language)
          ? {
              memoryGameInstruct7Downex: await PageAudioHandler.getAudioDuration(
                mediaAssets.audio.memoryGameInstruct7Downex,
              ),
              memoryGameDisplay: await PageAudioHandler.getAudioDuration(mediaAssets.audio.memoryGameDisplay),
              memoryGameInstruct2Downex: await PageAudioHandler.getAudioDuration(
                mediaAssets.audio.memoryGameInstruct2Downex,
              ),
              memoryGameInstruct4Downex: await PageAudioHandler.getAudioDuration(
                mediaAssets.audio.memoryGameInstruct4Downex,
              ),
            }
          : {
              memoryGameDisplay: await PageAudioHandler.getAudioDuration(mediaAssets.audio.memoryGameDisplay),
            };

        taskStore('displayPromptDurations', displayPromptDurations);
      }
    },
    on_finish: () => {
      PageAudioHandler.stopAndDisconnectNode();
      jsPsych.data.addDataToLastTrial({
        audioButtonPresses: PageAudioHandler.replayPresses,
        assessment_stage: 'instructions',
      });
    },
  };
});

export const reverseOrderPrompt = instructions.pop();
export const reverseOrderInstructions = instructions.pop();
export const readyToPlay = instructions.pop();

export const defaultInstructions = instructions.slice(5, 9);
export const downexInstructions = instructions.slice(0, 5);
