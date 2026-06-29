import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { mediaAssets } from '../../..';
import {
  addExperimenterButtons,
  PageStateHandler,
  PageAudioHandler,
  getParticipantUtilityButtonsHtml,
  setupReplayAudio,
  setupFullscreenButton,
  camelize,
  addPracticeButtonListeners,
  disableOkButton,
} from '../../shared/helpers';
import { isTouchScreen, jsPsych } from '../../taskSetup';
import { taskStore } from '../../../taskStore';
import { displaceAnimation, enableAllButtons, popAnimation } from '../../shared/helpers';
import { pulseOkButton } from '../../shared/helpers/pulseOkButton';

let startTime: number;

export const instructionData = [
  {
    prompt: 'matrixReasoningInstruct1',
    image: 'matrixExample', // GIF?
    buttonText: 'continueButtonText',
  },
];
const replayButtonHtmlId = 'replay-btn-revisited';
let cycleId = 0; // disable audio if the trial has changed since the loop started - prevent overlapping audio

export const instructions = instructionData.map((data) => {
  return {
    type: jsPsychHtmlMultiResponse,
    stimulus: () => {
      const t = taskStore().translations;
      const imageSrc = mediaAssets.images[data.image];
      return `<div class="lev-stimulus-container">
                        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
                        <div class="lev-row-container instruction-small">
                            <p>${t[data.prompt]}</p>
                        </div>

                         <div class="lev-stim-content-x-3">
                          <img
                              src=${imageSrc}
                              alt="Image not loading: ${imageSrc}. Please continue the task."
                          />
                        </div>
                    </div>`;
    },
    prompt_above_buttons: true,
    button_choices: ['Next'],
    button_html: () => {
      const t = taskStore().translations;
      return [
        `<button class="primary">
                ${t[data.buttonText]}
            </button>`,
      ];
    },
    keyboard_choices: () => 'NO_KEYS',
    on_load: () => {
      PageAudioHandler.playAudio(mediaAssets.audio[data.prompt]);

      const pageStateHandler = new PageStateHandler(data.prompt, true);
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();
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

const downexData1 = {
  audio: [
    'matrix-reasoning-instruct1-part1-downex',
    'matrix-reasoning-instruct1-part2-downex',
    'matrix-reasoning-instruct1-part3-downex',
    'matrix-reasoning-instruct1-part4-downex',
  ],
  choices: ['orange-square', 'blue-circle', 'green-star', 'black-triangle'],
  image: 'downexItem1',
};

const downexData3 = {
  audio: [
    'matrix-reasoning-prompt1-part1-downex',
    'matrix-reasoning-instruct5-part1-downex',
    'matrix-reasoning-instruct5-part2-downex',
    'matrix-reasoning-prompt1-part2-downex',
  ],
  choices: ['orange-square', 'blue-circle', 'green-star', 'black-triangle'],
  image: ['downexItem7', 'downexItem7Gif1', 'downexItem7Gif2'],
};

const downexData4 = {
  audio: [
    'matrix-reasoning-instruct2-part1-downex',
    'matrix-reasoning-instruct2-part2-downex',
    'matrix-reasoning-instruct2-part3-downex',
    'matrix-reasoning-instruct2-part4-downex',
    'matrix-reasoning-instruct2-part5-downex',
  ],
  choices: ['matrix-example-rsp1', 'matrix-example-rsp2', 'matrix-example-rsp3', 'black-square'],
  image: ['matrixExampleDownex', 'matrixExampleGif1Downex', 'matrixExampleGif2Downex', 'matrixExampleGif3Downex'],
};

const textOnlyDownexInstructionData = [
  {
    audio: 'matrix-reasoning-instruct4-downex',
  },
  {
    audio: 'matrix-reasoning-instruct3-downex',
  },
];

function enableOkBtn() {
  const okButton: HTMLButtonElement | null = document.querySelector('.primary');
  if (okButton != null) {
    okButton.disabled = false;
  }
}

export const downexInstructions1 = {
  type: jsPsychHtmlMultiResponse,
  stimulus: () => {
    const t = taskStore().translations;
    const stimImage = mediaAssets.images[downexData1.image];

    const itemText = downexData1.audio.map((file: string) => t[camelize(file)]).join(' ');

    return `<div class="lev-stimulus-container">
                  ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
                  <div class="lev-row-container instruction-small">
                      <p>${itemText}</p>
                  </div>

                  <div id="stim-container" class="lev-stim-content-x-2">
                    <img
                        src=${stimImage}
                        alt="Image not loading: ${stimImage}. Please continue the task."
                    />
                  </div>

                  <div id="choices-container" class="lev-response-row multi-4" style="gap: 16px; margin-top: 16px">
                    <button id="target" class="image no-pointer-events" disabled>
                      <img src=${mediaAssets.images[camelize(downexData1.choices[0])]} alt=${downexData1.choices[0]} />
                    </button>
                    <button class="image no-pointer-events" disabled>
                      <img src=${mediaAssets.images[camelize(downexData1.choices[1])]} alt=${downexData1.choices[1]} />
                    </button>
                    <button class="image no-pointer-events" disabled>
                      <img src=${mediaAssets.images[camelize(downexData1.choices[2])]} alt=${downexData1.choices[2]} />
                    </button>
                    <button class="image no-pointer-events" disabled>
                      <img src=${mediaAssets.images[camelize(downexData1.choices[3])]} alt=${downexData1.choices[3]} />
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

    // set up replay audio
    const trialAudio = downexData1.audio;

    const replayButton = document.getElementById(replayButtonHtmlId);
    if (replayButton) {
      replayButton.addEventListener('click', () => {
        // clean up from previous animation
        const animatedTarget = document.getElementById('animated-target');
        if (animatedTarget) {
          animatedTarget.remove();
        }

        target?.classList.remove('image-grayed-out');

        animateAndPlayAudio();
      });
    }

    const stimContainer = document.getElementById('stim-container');
    const stimImage = stimContainer?.querySelector('img');
    const buttonContainer = document.getElementById('choices-container');
    const buttons = Array.from(buttonContainer?.querySelectorAll('button') || []);
    const target = document.getElementById('target');

    async function animateAndPlayAudio() {
      cycleId++;
      const thisCycleId = cycleId;

      // replay button should be disabled while animations are happening
      if (replayButton) {
        (replayButton as HTMLButtonElement).disabled = true;
      }

      // reset target button to its original position
      if (target) {
        target.style.position = '';
        target.style.left = '';
        target.style.top = '';
        target.style.zIndex = '';
      }

      disableOkButton();

      // set up animations
      let itemsToAnimate = [target, buttons, stimImage];

      const audioConfig: AudioConfigType = {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
      };

      for (const [index, audioFile] of trialAudio.slice(0, -1).entries()) {
        const audioUri = mediaAssets.audio[camelize(audioFile)] || mediaAssets.audio.nullAudio;
        const delay = index === 2 ? 2 : 0;

        if (thisCycleId !== cycleId || taskStore().isPaused) {
          break;
        }

        await new Promise<void>((resolve) => {
          const configWithCallback = {
            ...audioConfig,
            onEnded: () => {
              setTimeout(() => resolve(), 2000);
            },
          };
          itemsToAnimate = popAnimation(itemsToAnimate, `pulse 2s ${delay}s 2`) as any;
          PageAudioHandler.playAudio(audioUri, configWithCallback);
        });
      }

      const lastAudioUri =
        mediaAssets.audio[camelize(trialAudio[trialAudio.length - 1])] || mediaAssets.audio.nullAudio;

      // animate the target button to the center of stimImage
      if (stimImage && target && !taskStore().isPaused && thisCycleId === cycleId) {
        displaceAnimation(stimImage, target, 'origin', 0.5, 0.5, true);

        const lastAudioConfig: AudioConfigType = {
          restrictRepetition: {
            enabled: false,
            maxRepetitions: 2,
          },
          onEnded: () => {
            enableOkBtn();
            if (replayButton) {
              (replayButton as HTMLButtonElement).disabled = false;
            }
            pulseOkButton(6000, taskStore().totalTrialCount);
          },
        };

        setTimeout(
          () => (!taskStore().isPaused ? PageAudioHandler.playAudio(lastAudioUri, lastAudioConfig) : null),
          5000,
        );
      } else {
        if (replayButton) {
          (replayButton as HTMLButtonElement).disabled = false;
        }
      }
    }

    animateAndPlayAudio();
  },
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode(); // stop ongoing audio
    cycleId++; // stop queued audio

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
      assessment_stage: 'instructions',
    });
  },
};

const textOnlyDownexInstruction = textOnlyDownexInstructionData.map((data) => {
  return {
    type: jsPsychHtmlMultiResponse,
    stimulus: () => {
      const t = taskStore().translations;
      const itemText = t[camelize(data.audio)];

      return `
      <div class="lev-stimulus-container">
        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
        <div class="lev-row-container instruction">
          <p>${itemText}</p>
        </div>
      </div>
    `;
    },
    prompt_above_buttons: true,
    button_choices: ['Next'],
    button_html: () => {
      const t = taskStore().translations;
      return [`<button class="primary" disabled>${t.continueButtonText}</button>`];
    },
    keyboard_choices: () => 'NO_KEYS',
    on_load: () => {
      const audioConfig: AudioConfigType = {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
        onEnded: () => {
          enableOkBtn();
          pulseOkButton(3000, taskStore().totalTrialCount);
        },
      };

      PageAudioHandler.playAudio(mediaAssets.audio[camelize(data.audio)], audioConfig);

      const pageStateHandler = new PageStateHandler(data.audio, true);
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();
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

export const downexInstructions2 = textOnlyDownexInstruction[0];
export const downexInstructions5 = textOnlyDownexInstruction[1];

export const downexInstructions3 = {
  type: jsPsychHtmlMultiResponse,
  stimulus: () => {
    const t = taskStore().translations;

    const itemText = downexData3.audio.map((file: string) => t[camelize(file)]).join(' ');

    return `<div class="lev-stimulus-container">
                  ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
                  <div class="lev-row-container instruction-small">
                      <p>${itemText}</p>
                  </div>

                  <div id="stim-container" class="lev-stim-content-x-2">
                    <img
                        id="stim-image"
                        src=${mediaAssets.images[downexData3.image[0]]}
                        alt="Image not loading: ${mediaAssets.images[downexData3.image[0]]}. Please continue the task."
                    />
                  </div>
              </div>`;
  },
  prompt_above_buttons: true,
  button_choices: () => {
    const choices = downexData3.choices;

    return choices.map((choice) => {
      const imageUrl = mediaAssets.images[camelize(choice)];

      return `<img src=${imageUrl} alt=${choice} />`;
    });
  },
  button_html: () => '<button class="image-matrix practice-btn"; disabled>%choice%</button>',
  keyboard_choices: () => 'NO_KEYS',
  on_load: async () => {
    startTime = performance.now();

    addExperimenterButtons();
    setupFullscreenButton();

    // set up replay audio
    const trialAudio = downexData3.audio;

    const replayButton = document.getElementById(replayButtonHtmlId);
    if (replayButton) {
      replayButton.addEventListener('click', () => {
        animateAndPlayAudio();
      });
    }

    const stimContainer = document.getElementById('stim-container');

    // set up practice button listeners
    const incorrectPracticeResponses: Array<string | null> = [];
    taskStore('incorrectPracticeResponses', incorrectPracticeResponses);
    const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup');
    const buttons = Array.from(buttonContainer?.querySelectorAll('button') || []);
    const rspImages = buttons.map((button) => button.querySelector('img'));
    const targetImageIdx = rspImages.findIndex((image) => image?.alt === downexData3.choices[1]);
    let targetButton: HTMLButtonElement | null;
    if (targetImageIdx !== -1) {
      targetButton = buttons[targetImageIdx];
    }

    function onCorrect() {
      PageAudioHandler.stopAndDisconnectNode();
      cycleId++;

      PageAudioHandler.playAudio(mediaAssets.audio.feedbackRightOne);
    }

    function onIncorrect() {
      PageAudioHandler.stopAndDisconnectNode();
      cycleId++;

      if (targetButton) {
        targetButton.style.animation = 'none';
        targetButton.offsetHeight; // Force reflow
        targetButton.style.animation = 'pulse 2s 0s 2';
      }

      PageAudioHandler.playAudio(mediaAssets.audio.matrixReasoningFeedbackIncorrectDownex);
    }

    addPracticeButtonListeners(downexData3.choices[1], isTouchScreen, downexData3.choices, onCorrect, onIncorrect);

    async function animateAndPlayAudio() {
      cycleId++;
      const thisCycleId = cycleId;

      // replay button should be disabled while animations are happening
      if (replayButton) {
        (replayButton as HTMLButtonElement).disabled = true;
      }

      const audioConfig: AudioConfigType = {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
      };

      // switch the stim image after each audio file to highlight each set of items
      for (const [index, audioFile] of trialAudio.entries()) {
        const audioUri = mediaAssets.audio[camelize(audioFile)];
        const image = index > 2 ? downexData3.image[0] : downexData3.image[index]; // keep the image after the fourth audio file

        if (thisCycleId !== cycleId || taskStore().isPaused) {
          break;
        }

        await new Promise<void>((resolve) => {
          const configWithCallback = {
            ...audioConfig,
            onEnded: () => {
              setTimeout(() => resolve(), 2000);
            },
          };

          if (stimContainer) {
            stimContainer.innerHTML = `<img 
                      id="stim-image"
                      src=${mediaAssets.images[image]} 
                      alt="Image not loading: ${mediaAssets.images[image]}. Please continue the task." 
                    />`;
          }

          if (index === 0) {
            const stimImage = document.getElementById('stim-image');

            if (stimImage) {
              (stimImage as HTMLImageElement).style.animation = 'pulse 2s 0s 2';
            }
          }

          if (index === 3) {
            buttons.forEach((button) => {
              button.style.animation = 'none';
              button.offsetHeight; // Force reflow
              button.style.animation = 'pulse 2s 0s 2';
            });
          }

          PageAudioHandler.playAudio(audioUri, configWithCallback);
        });
      }

      if (replayButton) {
        (replayButton as HTMLButtonElement).disabled = false;
      }

      enableAllButtons();
    }

    animateAndPlayAudio();
  },
  response_ends_trial: false,
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode();
    cycleId++;

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
      assessment_stage: 'practice_response',
    });
  },
};

export const downexInstructions4 = {
  type: jsPsychHtmlMultiResponse,
  stimulus: () => {
    const t = taskStore().translations;

    const itemText = downexData4.audio.map((file: string) => t[camelize(file)]).join(' ');

    return `<div class="lev-stimulus-container">
                  ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
                  <div class="lev-row-container instruction-small">
                      <p>${itemText}</p>
                  </div>

                  <div id="stim-container" class="lev-stim-content-x-3">
                    <img
                        src=${mediaAssets.images[downexData4.image[0]]}
                        alt="Image not loading: ${mediaAssets.images[downexData4.image[0]]}. Please continue the task."
                    />
                  </div>
              </div>`;
  },
  prompt_above_buttons: true,
  button_choices: () => {
    const choices = downexData4.choices;

    return choices.map((choice) => {
      const imageUrl = mediaAssets.images[camelize(choice)];

      return `<img src=${imageUrl} alt=${choice} />`;
    });
  },
  button_html: () => '<button class="image-matrix practice-btn" disabled>%choice%</button>',
  keyboard_choices: () => 'NO_KEYS',
  on_load: async () => {
    startTime = performance.now();

    addExperimenterButtons();
    setupFullscreenButton();

    // set up replay audio
    const trialAudio = downexData4.audio;

    const replayButton = document.getElementById(replayButtonHtmlId);
    if (replayButton) {
      replayButton.addEventListener('click', () => {
        animateAndPlayAudio();
      });
    }

    const stimContainer = document.getElementById('stim-container');

    // set up practice button listeners
    const incorrectPracticeResponses: Array<string | null> = [];
    taskStore('incorrectPracticeResponses', incorrectPracticeResponses);
    const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup');
    const buttons = Array.from(buttonContainer?.querySelectorAll('button') || []);
    const rspImages = buttons.map((button) => button.querySelector('img'));
    const targetImageIdx = rspImages.findIndex((image) => image?.alt === downexData4.choices[2]);
    let targetButton: HTMLButtonElement | null;
    if (targetImageIdx !== -1) {
      targetButton = buttons[targetImageIdx];
    }

    function onCorrect() {
      PageAudioHandler.stopAndDisconnectNode();
      cycleId++;

      PageAudioHandler.playAudio(mediaAssets.audio.feedbackRightOne);
    }

    function onIncorrect() {
      PageAudioHandler.stopAndDisconnectNode();
      cycleId++;

      if (targetButton) {
        targetButton.style.animation = 'none';
        targetButton.offsetHeight; // Force reflow
        targetButton.style.animation = 'pulse 2s 0s 2';
      }

      PageAudioHandler.playAudio(mediaAssets.audio.matrixReasoningFeedbackSmBlueDownex);
    }

    addPracticeButtonListeners(downexData4.choices[2], isTouchScreen, downexData4.choices, onCorrect, onIncorrect);

    async function animateAndPlayAudio() {
      cycleId++;
      const thisCycleId = cycleId;

      // replay button should be disabled while animations are happening
      if (replayButton) {
        (replayButton as HTMLButtonElement).disabled = true;
      }

      const audioConfig: AudioConfigType = {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
      };

      // switch the stim image after each audio file to highlight each set of items
      for (const [index, audioFile] of trialAudio.entries()) {
        const audioUri = mediaAssets.audio[camelize(audioFile)];
        const image = index > 3 ? downexData4.image[0] : downexData4.image[index]; // keep the image after the fourth audio file

        if (thisCycleId !== cycleId || taskStore().isPaused) {
          break;
        }

        await new Promise<void>((resolve) => {
          const configWithCallback = {
            ...audioConfig,
            onEnded: () => {
              setTimeout(() => resolve());
            },
          };
          if (index === 4) {
            buttons.forEach((button) => (button.style.animation = 'pulse 2s 0s 3'));
          }

          if (stimContainer) {
            stimContainer.innerHTML = `<img 
                      src=${mediaAssets.images[image]} 
                      alt="Image not loading: ${mediaAssets.images[image]}. Please continue the task." 
                    />`;
          }

          PageAudioHandler.playAudio(audioUri, configWithCallback);
        });
      }

      if (replayButton) {
        (replayButton as HTMLButtonElement).disabled = false;
      }

      enableAllButtons();
    }

    animateAndPlayAudio();
  },
  response_ends_trial: false,
  on_finish: () => {
    PageAudioHandler.stopAndDisconnectNode();
    cycleId++;

    jsPsych.data.addDataToLastTrial({
      audioButtonPresses: PageAudioHandler.replayPresses,
      assessment_stage: 'practice_response',
    });
  },
};
