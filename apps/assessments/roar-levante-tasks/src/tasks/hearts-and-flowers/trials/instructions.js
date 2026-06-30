import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { mediaAssets } from '../../..';
import { InputKey, getInputInstructPrompt } from '../helpers/utils';
import {
  addExperimenterButtons,
  setupReplayAudio,
  getParticipantUtilityButtonsHtml,
  PageStateHandler,
  PageAudioHandler,
  addKeyHelpers,
  setupFullscreenButton,
} from '../../shared/helpers';
import { jsPsych } from '../../taskSetup';
import { taskStore } from '../../../taskStore';
import { disableOkButton } from '../../shared/helpers/disableOkButton';
import { enableOkButton } from '../../shared/helpers/enableButtons';
import { setupHafMultiResponseTouchRouting } from '../helpers/touchResponseRouting';

let continueTrialConfig;
let cleanupInstructionInputListeners = [];
let earlySkipInstructions = false;

function isHfV2() {
  return taskStore().version === 2;
}

// These are the instruction "trials" they are full screen with no stimulus
export function getHeartInstructions() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, () => 'heartInstruct1');
}

export function getFlowerInstructions() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, () => 'flowerInstruct1');
}

export function getTimeToPractice() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, () => 'heartsAndFlowersPracticeTime');
}

export function getKeepUp() {
  return buildInstructionTrial(mediaAssets.images.keepupSq, () => 'heartsAndFlowersInstruct1');
}

export function getKeepGoing() {
  return buildInstructionTrial(mediaAssets.images.rocketSq, () => 'heartsAndFlowersInstruct2');
}

export function getTimeToPlay() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, () => 'heartsAndFlowersPlayTime');
}

export function getMixedInstructions() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, () => 'heartsAndFlowersInstruct3');
}

export function getGoingFasterInstructions() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, () => 'heartsAndFlowersInstruct4');
}

export function getEndGame() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, () => 'heartsAndFlowersEnd');
}

export function getInputInstructions() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, getInputInstructPrompt);
}

export function getLeftButtonDemo() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, getInputInstructPrompt, true, 'left');
}

export function getRightButtonDemo() {
  return buildInstructionTrial(mediaAssets.images.animalBodySq, getInputInstructPrompt, true, 'right');
}

function buildInstructionTrial(mascotImage, getPromptKey, showResponseButton = false, buttonSide = null) {
  if (!mascotImage) {
    console.error(`buildInstructionTrial: Missing mascot image`);
  }
  if (!getPromptKey()) {
    console.error(`buildInstructionTrial: Missing prompt audio or text`);
  }

  const replayButtonHtmlId = 'replay-btn-revisited';

  const trial = {
    type: jsPsychHtmlMultiResponse,
    stimulus: () => {
      // set the continue trial config based on the input capability
      continueTrialConfig = {
        type: taskStore().inputCapability?.touch || !isHfV2() ? 'button' : 'bottomText',
        text: taskStore().inputCapability?.touch || !isHfV2() ? 'continueButtonText' : 'heartsAndFlowersPressAnyKey',
      };

      return `
        <div class="lev-stimulus-container">
            ${getParticipantUtilityButtonsHtml('replay-btn-revisited')}
            <div id="instruction-text" class="lev-row-container instruction-small">
              <p>${taskStore().translations[showResponseButton ? getPromptKey(true) : getPromptKey()]}</p>
            </div>
            ${
              taskStore().story
                ? `
                  <div class="lev-stim-content-x-3">
                    <img src=${mascotImage} alt='Instruction graphic'/>
                  </div>
                `
                : ''
            }
            ${
              continueTrialConfig.type === 'bottomText'
                ? `<div class="lev-row-container header" ${showResponseButton ? 'style="display: none;"' : ''}><p>${
                    taskStore().translations[continueTrialConfig.text]
                  }</p></div>`
                : ''
            }
        </div>
        `;
    },
    prompt_above_buttons: true,
    keyboard_choices: 'NO_KEYS',
    button_choices: () =>
      continueTrialConfig.type === 'button' ? [taskStore().translations[continueTrialConfig.text]] : undefined,
    button_html: () =>
      continueTrialConfig.type === 'button' ? [`<button class="primary" disabled>%choice%</button>`] : undefined,
    on_load: () => {
      let responseButtons;
      let onButtonPress;
      earlySkipInstructions = false;

      if (showResponseButton) {
        if (continueTrialConfig.type === 'button') {
          disableOkButton();
          const okButton = document.querySelector('.primary');
          okButton.style.display = 'none';
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('lev-response-row');
        buttonContainer.classList.add('linear-4');
        buttonContainer.innerHTML = `
          <div class='response-container--small'>
            <button class='secondary--green' ${
              buttonSide === 'right' ? 'style="visibility: hidden" disabled' : ''
            }></button>
          </div>
          <div class='response-container--small'>
            <button class='secondary--green' ${
              buttonSide === 'left' ? 'style="visibility: hidden" disabled' : ''
            }></button>
          </div>`;

        const stimContainer = document.querySelector('.lev-stimulus-container');
        stimContainer.appendChild(buttonContainer);

        responseButtons = buttonContainer.querySelectorAll('.secondary--green');

        onButtonPress = (button, i, event) => {
          if (
            (i === 0 && event.key === 'ArrowLeft') ||
            (i === 1 && event.key === 'ArrowRight') ||
            event.type === 'touchend'
          ) {
            cleanupInstructionInputListeners?.forEach((listenerCleanup) => {
              listenerCleanup?.();
            });
            cleanupInstructionInputListeners = [];

            PageAudioHandler.playAudio(mediaAssets.audio.coin);
            button.classList.add('info-shadow');
            setTimeout(() => {
              button.classList.remove('info-shadow');
            }, 2000);

            button.style.animation = 'none';
            buttonContainer.style.visibility = 'hidden';
            setTimeout(() => {
              jsPsych.finishTrial();
            }, 2000);
          }
        };

        // Trigger toast for button demos
        if (isHfV2()) {
          setupHafMultiResponseTouchRouting('.secondary--green', true);
        }
        // Allow instructions to be skipped for ROAR apps (except for the speed up one)
      } else if (
        taskStore().isRoarApp &&
        getPromptKey() !== 'heartsAndFlowersInstruct2' &&
        getPromptKey() !== 'heartsAndFlowersInstruct4'
      ) {
        let inputMethod = taskStore().inputCapability?.touch ? 'touchend' : 'keydown';
        if (taskStore().inputCapability?.touch) {
          enableOkButton();
        }

        const onAnyKeyPress = () => {
          earlySkipInstructions = true;
          PageAudioHandler.audioSource.onended = null;
          PageAudioHandler.stopAndDisconnectNode();
          jsPsych.finishTrial();
        };

        window.addEventListener(inputMethod, onAnyKeyPress);
        cleanupInstructionInputListeners.push(() => {
          window.removeEventListener(inputMethod, onAnyKeyPress);
        });
      }

      const audioConfig = {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
        onEnded: () => {
          if (!showResponseButton) {
            if (continueTrialConfig.type === 'bottomText') {
              const audioUri = mediaAssets.audio[continueTrialConfig.text];

              // Levante - spacebar only; ROAR - any key
              const onAnyKeyPress = (event) => {
                if (!taskStore().isRoarApp && event.key !== ' ') {
                  return;
                }

                // Prevent duplicate trial finishes if instructions were already skipped for ROAR apps
                if (!earlySkipInstructions) {
                  jsPsych.finishTrial();
                }

                PageAudioHandler.stopAndDisconnectNode();
              };

              window.addEventListener('keydown', onAnyKeyPress);
              cleanupInstructionInputListeners.push(() => {
                window.removeEventListener('keydown', onAnyKeyPress);
              });

              PageAudioHandler.playAudio(audioUri);
            } else {
              if (!earlySkipInstructions) {
                enableOkButton();
              }
            }

            return;
          }

          const displayedButtonIndex = buttonSide === 'left' ? 0 : 1;
          const displayedButton = responseButtons[displayedButtonIndex];
          displayedButton.dataset.hafActive = '1';
          displayedButton.style.animation = 'pulse 1s infinite';
          addKeyHelpers(displayedButton, displayedButtonIndex);

          if (taskStore().inputCapability?.touch) {
            const buttonPressListener = (event) => {
              onButtonPress(displayedButton, displayedButtonIndex, event);
            };

            displayedButton.addEventListener('touchend', buttonPressListener);
            cleanupInstructionInputListeners.push(() => {
              displayedButton.removeEventListener('touchend', buttonPressListener);
            });
          } else {
            const onWindowKeydown = (event) => {
              onButtonPress(displayedButton, displayedButtonIndex, event);
            };

            window.addEventListener('keydown', onWindowKeydown);
            cleanupInstructionInputListeners.push(() => {
              window.removeEventListener('keydown', onWindowKeydown);
            });
          }
        },
      };

      const promptAudioKey = showResponseButton ? getPromptKey(true) : getPromptKey(false);
      PageAudioHandler.playAudio(mediaAssets.audio[promptAudioKey] || mediaAssets.audio.inputAudioCue, audioConfig);

      const pageStateHandler = new PageStateHandler(promptAudioKey);
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();
    },
    on_finish: () => {
      cleanupInstructionInputListeners?.forEach((listenerCleanup) => {
        listenerCleanup?.();
      });
      cleanupInstructionInputListeners = [];

      PageAudioHandler.stopAndDisconnectNode();

      if (getPromptKey() === 'heartsAndFlowersEnd') {
        taskStore('taskComplete', true);
      }

      jsPsych.data.addDataToLastTrial({
        audioButtonPresses: PageAudioHandler.replayPresses,
        assessment_stage: 'instructions',
      });
    },
  };
  return trial;
}
