import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { mediaAssets } from '../../..';
import { taskStore } from '../../../taskStore';
import {
  addExperimenterButtons,
  camelize,
  disableOkButton,
  PageAudioHandler,
  getParticipantUtilityButtonsHtml,
  setupFullscreenButton,
  enableOkButton,
} from '../../shared/helpers';
import { animate } from '../helpers/animate';
import { jsPsych } from '../../taskSetup';
import { pulseOkButton } from '../../shared/helpers/pulseOkButton';

const replayButtonHtmlId = 'replay-btn-revisited';
let cycleId = 0; // disable audio if the trial has changed since the loop started - prevent overlapping audio

const downexData = [
  {
    audio: ['mental-rotation-instruct1-part1-downex', 'mental-rotation-instruct1-part2-downex'],
    choices: ['Rp-000-silh', 'Rn-000-silh'],
    image: 'Rp-000-gray',
    animations: [
      {
        item: 'stim-image',
        animation: 'pulse',
      },
    ],
    eventOrder: ['audio', 'animation', 'audio'],
  },
  {
    audio: ['mental-rotation-instruct2-downex', 'mental-rotation-instruct3-downex'],
    choices: ['Rp-000-silh', 'Rn-000-silh'],
    image: 'Rp-000-gray',
    animations: [
      {
        item: 'distractor',
        animation: 'pulse',
      },
      {
        item: 'distractor',
        animation: 'drag',
      },
    ],
    eventOrder: ['audio', 'animation', 'animation', 'audio'],
  },
  {
    audio: ['mental-rotation-instruct2-downex', 'mental-rotation-instruct4-downex'],
    choices: ['Rp-000-silh', 'Rn-000-silh'],
    image: 'Rp-000-gray',
    animations: [
      {
        item: 'target',
        animation: 'pulse',
      },
      {
        item: 'target',
        animation: 'drag',
      },
    ],
    eventOrder: ['audio', 'animation', 'animation', 'audio'],
  },
];

let startTime: number;

export const downexInstructions = downexData.map((data: any) => {
  return {
    type: jsPsychHtmlMultiResponse,
    stimulus: () => {
      const t = taskStore().translations;
      const stimImage = mediaAssets.images[camelize(data.image)];
      const itemText = data.audio.map((file: string) => t[camelize(file)]).join(' ');

      return `<div class="lev-stimulus-container">
                  ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
                  <div class="lev-row-container instruction-small">
                      <p>${itemText}</p>
                  </div>

                  <div id="stim-container" class="lev-stim-content"">
                    <img
                        id="stim-image"
                        src=${stimImage}
                        alt="Image not loading: ${data.image}. Please continue the task."
                    />
                  </div>

                  <div id="choices-container" class="lev-response-row multi-4" style="gap: 16px; margin-top: 16px">
                    <button id="target" class="image-large no-pointer-events" disabled>
                      <img src=${mediaAssets.images[camelize(data.choices[0])]} alt=${data.choices[0]} />
                    </button>
                    <button id="distractor" class="image-large no-pointer-events" disabled>
                      <img src=${mediaAssets.images[camelize(data.choices[1])]} alt=${data.choices[1]} />
                    </button>
                  </div>
              </div>`;
    },
    prompt_above_buttons: true,
    button_choices: ['Next'],
    button_html: () => {
      const t = taskStore().translations;
      return [`<button class="primary" disabled>${t.continueButtonText}</button>`];
    },
    keyboard_choices: () => 'NO_KEYS',
    on_load: async () => {
      startTime = performance.now();

      addExperimenterButtons();
      setupFullscreenButton();

      const replayButton = document.getElementById(replayButtonHtmlId);
      if (replayButton) {
        replayButton.addEventListener('click', () => {
          animateAndPlayAudio();
        });
      }

      function animateAndPlayAudio() {
        cycleId++;
        const thisCycleId = cycleId;

        // replay button and ok button should be disabled while animations are happening
        if (replayButton) {
          (replayButton as HTMLButtonElement).disabled = true;
        }

        disableOkButton();

        // Preserve stim-container height before animation
        const stimContainer = document.getElementById('stim-container');
        const stimImage = document.getElementById('stim-image');
        if (stimContainer && stimImage) {
          const imageHeight = stimImage.offsetHeight;
          stimContainer.style.minHeight = `${imageHeight}px`;
        }

        // create copies of the trial data to avoid mutating the original data
        const trialAudio = [...data.audio];
        const trialAnimations = [...data.animations];
        const trialEventOrder = [...data.eventOrder];

        // reset stim image to its original position
        if (stimImage) {
          stimImage.style.position = '';
          stimImage.style.left = '';
          stimImage.style.top = '';
          stimImage.style.zIndex = '';
        }

        // reset target source
        const target: HTMLImageElement | null = document.getElementById('target')?.children[0] as HTMLImageElement;
        if (target) {
          target.src = mediaAssets.images[camelize(data.choices[0])];
        }

        const audioConfig: AudioConfigType = {
          restrictRepetition: {
            enabled: false,
            maxRepetitions: 2,
          },
          onEnded: () => {
            triggerNextEvent();
          },
        };

        function triggerNextEvent() {
          if (thisCycleId !== cycleId || taskStore().isPaused) {
            return;
          }

          if (trialEventOrder.length === 0) {
            enableOkButton();
            pulseOkButton(3000, taskStore().totalTrialCount);
            if (replayButton) {
              (replayButton as HTMLButtonElement).disabled = false;
            }
            return;
          }

          const event = trialEventOrder.shift();
          if (event === 'audio') {
            PageAudioHandler.playAudio(mediaAssets.audio[camelize(trialAudio.shift())], audioConfig);
          } else if (event === 'animation') {
            const animationObject = trialAnimations.shift();
            animate(animationObject.animation, animationObject.item);
            setTimeout(triggerNextEvent, 2000);
          }
        }

        triggerNextEvent();
      }

      animateAndPlayAudio();
    },
    on_finish: () => {
      PageAudioHandler.stopAndDisconnectNode();
      cycleId++;

      jsPsych.data.addDataToLastTrial({
        audioButtonPresses: PageAudioHandler.replayPresses,
        assessment_stage: 'instructions',
      });
    },
  };
});
