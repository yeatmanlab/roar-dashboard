import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { mediaAssets } from '../../..';
import { isTouchScreen } from '../../taskSetup';
import { StimulusType, StimulusSideType, InputKey, getCorrectInputSide, getStimulusLayout } from '../helpers/utils';
import {
  addExperimenterButtons,
  PageStateHandler,
  setupReplayAudio,
  PageAudioHandler,
  setupFullscreenButton,
  getParticipantUtilityButtonsHtml,
  addKeyHelpers,
} from '../../shared/helpers';
import { jsPsych } from '../../taskSetup';
import { taskStore } from '../../../taskStore';
import { setupHafMultiResponseTouchRouting } from '../helpers/touchResponseRouting';

/**
 * Builds a practice trial for the Instruction sections.
 * @param {*} stimulusType
 * @param {*} promptText
 * @param {*} promptAudioAsset
 * @param {*} stimulusSideType
 */
export function buildInstructionPracticeTrial(
  stimulusType,
  promptText,
  promptAudioAsset,
  stimulusSideType,
  audioAssetKey,
) {
  if (!promptAudioAsset) {
    // throw new Error(`Missing prompt audio for instruction practice trial`);
    console.error(`buildInstructionPracticeTrial: Missing prompt audio`);
  }
  if (!promptText) {
    // throw new Error(`Missing prompt text for instruction practice trial`);
    console.error(`buildInstructionPracticeTrial: Missing prompt text`);
  }
  const hfV2 = taskStore().version === 2;
  const replayButtonHtmlId = 'replay-btn-revisited';
  const validAnswer = getCorrectInputSide(stimulusType, stimulusSideType);

  let cleanupListeners = []; // Event listener cleanup functions

  const trial = {
    type: jsPsychHtmlMultiResponse,
    stimulus: () => {
      return getStimulusLayout(
        mediaAssets.images[stimulusType],
        stimulusSideType === StimulusSideType.Left,
        promptText,
        replayButtonHtmlId,
      );
    },
    prompt_above_buttons: true,
    on_start: () => {
      taskStore('stimulus', stimulusType);
      taskStore('stimulusSide', stimulusSideType);
    },
    on_load: () => {
      document.getElementById('jspsych-html-multi-response-stimulus').classList.add('haf-parent-container');
      document.getElementById('jspsych-html-multi-response-btngroup').classList.add('haf-parent-container');
      document.getElementById('jspsych-html-multi-response-btngroup').classList.add('lev-response-row');
      document.getElementById('jspsych-html-multi-response-btngroup').classList.add('linear-4');

      //TODO: use alt tag to query the proper button directly
      const buttons = document.querySelectorAll('.secondary--green');
      if (buttons.length !== 2) {
        console.error(`There are ${buttons.length} instead of 2 wrappers in the practice trials`);
      }

      const audioConfig = {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
        onEnded: () => {
          // Enable buttons and add event listeners AFTER audio finishes
          buttons[validAnswer].style.animation = 'pulse 2s infinite';

          buttons.forEach((button, i) => {
            button.disabled = false;
            addKeyHelpers(button, i);
          });

          if (hfV2) {
            setupHafMultiResponseTouchRouting();
          }

          // Add keyboard listener manually (only on non-touch devices)
          if (!isTouchScreen) {
            const onKeydown = (event) => {
              if (event.key === 'ArrowLeft') {
                buttons[0].click();
              } else if (event.key === 'ArrowRight') {
                buttons[1].click();
              }
            };

            window.addEventListener('keydown', onKeydown);
            cleanupListeners.push(() => {
              window.removeEventListener('keydown', onKeydown);
            });
          }
        },
      };

      PageAudioHandler.playAudio(promptAudioAsset, audioConfig);
      const pageStateHandler = new PageStateHandler(audioAssetKey);
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();
    },
    button_choices: [StimulusSideType.Left, StimulusSideType.Right],
    keyboard_choices: 'NO_KEYS', // Disable jsPsych keyboard handling - we'll handle it manually
    button_html: [
      `
    <div class='response-container--small'>
      <button class='secondary--green' disabled></button>
    </div>`,
      `<div class='response-container--small'>
      <button class='secondary--green' disabled></button>
    </div>`,
    ],
    on_finish: (data) => {
      PageAudioHandler.stopAndDisconnectNode();

      // Clean up event listeners
      cleanupListeners.forEach((cleanup) => cleanup());

      let response;
      if (data.button_response === 0 || data.button_response === 1) {
        response = data.button_response;
      } else if (data.keyboard_response === InputKey.ArrowLeft || data.keyboard_response === InputKey.ArrowRight) {
        response = data.keyboard_response === InputKey.ArrowLeft ? 0 : 1;
      } else {
        const errorMessage = `Invalid response: ${data.button_response} or ${data.keyboard_response} in ${data}`;
        console.error(errorMessage);
      }

      if (response === validAnswer) {
        taskStore('isCorrect', true);
      } else {
        taskStore('isCorrect', false);
      }

      jsPsych.data.addDataToLastTrial({
        audioButtonPresses: PageAudioHandler.replayPresses,
        assessment_stage: 'practice_response',
      });
    },
    // TODO handle stimulus presentation timeout and other parameters
  };
  return trial;
}

//TODO: It may seem silly to keep and export these two functions below, but in case we want to
// refactor the feedback trials to NOT dynamically change their prompt and side it will help
// minimize the impact on the calling code.

/**stimulusType, promptText, promptAudioAsset, stimulusSideType
 * Builds a feedback trial for cases where the feedback prompt may change only depending on
 * whether the answer was correct or incorrect.
 */
export function buildStimulusInvariantPracticeFeedback(
  feedbackPromptIncorrectKey,
  feedbackPromptCorrectKey,
  onFinishTimelineCallback = undefined,
) {
  return buildPracticeFeedback(
    feedbackPromptIncorrectKey,
    feedbackPromptCorrectKey,
    feedbackPromptIncorrectKey,
    feedbackPromptCorrectKey,
    onFinishTimelineCallback,
  );
}

/**
 * Builds a feedback trial for cases where the feedback prompt may change depending on
 * the stimulus type and whether the answer was correct or incorrect.
 */
export function buildMixedPracticeFeedback(
  heartFeedbackPromptIncorrectKey,
  heartfeedbackPromptCorrectKey,
  flowerFeedbackPromptIncorrectKey,
  flowerfeedbackPromptCorrectKey,
  onFinishTimelineCallback = undefined,
) {
  return buildPracticeFeedback(
    heartFeedbackPromptIncorrectKey,
    heartfeedbackPromptCorrectKey,
    flowerFeedbackPromptIncorrectKey,
    flowerfeedbackPromptCorrectKey,
    onFinishTimelineCallback,
  );
}

/**
 * Builds a feedback trial for instructions practice trials and practice trials.
 */
function buildPracticeFeedback(
  heartFeedbackPromptIncorrectKey,
  heartfeedbackPromptCorrectKey,
  flowerFeedbackPromptIncorrectKey,
  flowerfeedbackPromptCorrectKey,
  onFinishTimelineCallback,
) {
  const hfV2 = taskStore().version === 2;
  const validAnswerButtonHtmlIdentifier = 'valid-answer-btn';
  const feedbackTexts = {
    IncorrectHeart: taskStore().translations[heartFeedbackPromptIncorrectKey],
    CorrectHeart: taskStore().translations[heartfeedbackPromptCorrectKey],
    IncorrectFlower: taskStore().translations[flowerFeedbackPromptIncorrectKey],
    CorrectFlower: taskStore().translations[flowerfeedbackPromptCorrectKey],
  };
  const feedbackAudio = {
    IncorrectHeart: heartFeedbackPromptIncorrectKey,
    CorrectHeart: heartfeedbackPromptCorrectKey,
    IncorrectFlower: flowerFeedbackPromptIncorrectKey,
    CorrectFlower: flowerfeedbackPromptCorrectKey,
  };
  Object.entries(feedbackTexts).forEach(([key, value]) => {
    if (!value) {
      // throw new Error(`Missing feedback text for ${key}`);
      console.error(`buildPracticeFeedback: Missing feedback text for ${key}`);
    }
  });
  Object.entries(feedbackAudio).forEach(([key, value]) => {
    if (!value) {
      // throw new Error(`Missing feedback audio for ${key}`);
      console.error(`buildPracticeFeedback: Missing feedback audio for ${key}`);
    }
  });

  function getAssetKey() {
    const heartsKey = taskStore().stimulus === StimulusType.Heart ? 'Heart' : 'Flower';
    const correctKey = taskStore().isCorrect === false ? 'Incorrect' : 'Correct';
    return feedbackAudio[`${correctKey}${heartsKey}`];
  }

  const trial = {
    type: jsPsychHtmlMultiResponse,
    stimulus: () => {
      const stimulusType = taskStore().stimulus;
      const incorrect = taskStore().isCorrect === false;
      //TODO: now that the 'correct' feedback layout differs significantly from the 'incorrect' feedback layout, we should consider
      // moving them to separate trials and using conditional trials
      if (!incorrect) {
        const correctPrompt = StimulusType.Heart ? feedbackTexts.CorrectHeart : feedbackTexts.CorrectFlower;
        return `
          <div class='haf-cr-container'>
            <img src='${mediaAssets.images.smilingFace}' />
            <p class='lev-text h4 primary'>${correctPrompt}</p>
          </div>
          ${getParticipantUtilityButtonsHtml('replay-btn-revisited', false)}
        `;
      }
      //no else: user input was incorrect
      const imageSrc = mediaAssets.images[stimulusType];
      const promptText =
        stimulusType === StimulusType.Heart ? feedbackTexts.IncorrectHeart : feedbackTexts.IncorrectFlower;
      return getStimulusLayout(imageSrc, taskStore().stimulusSide === StimulusSideType.Left, promptText, false);
    },
    prompt_above_buttons: true,
    on_load: () => {
      addExperimenterButtons();
      setupFullscreenButton();

      document.getElementById('jspsych-html-multi-response-stimulus').classList.add('haf-parent-container');
      document.getElementById('jspsych-html-multi-response-btngroup').classList.add('haf-parent-container');
      document.getElementById('jspsych-html-multi-response-btngroup').classList.add('lev-response-row');
      document.getElementById('jspsych-html-multi-response-btngroup').classList.add('linear-4');
      const buttons = document.querySelectorAll('.secondary--green');
      buttons.forEach((button, i) => {
        if (button.id === validAnswerButtonHtmlIdentifier) {
          button.style.animation = 'pulse 2s infinite';
        }
        addKeyHelpers(button, i);
      });

      const audioAssetKey = getAssetKey();
      const audioConfig = {
        restrictRepetition: {
          enabled: true,
          maxRepetitions: 2,
        },
        onEnded: () => {
          jsPsych.finishTrial();
        },
      };
      PageAudioHandler.playAudio(mediaAssets.audio[audioAssetKey], audioConfig);
      const pageStateHandler = new PageStateHandler(audioAssetKey);
      setupReplayAudio(pageStateHandler);
    },
    button_choices: [StimulusSideType.Left, StimulusSideType.Right],
    keyboard_choices: 'NO_KEYS',
    button_html: () => {
      if (taskStore().isCorrect === false) {
        const validAnswerPosition = getCorrectInputSide(taskStore().stimulus, taskStore().stimulusSide);
        return validAnswerPosition === 0 // is valid answer on the left?
          ? [
              `
          <div class='response-container--small'>
            <button class='secondary--green' id='${validAnswerButtonHtmlIdentifier}' disabled></button>
          </div>
          `,
              `
          <div class='response-container--small'>
            <button class='secondary--green' disabled></button>
          </div>
          `,
            ]
          : [
              `
          <div class='response-container--small'>
            <button class='secondary--green' disabled></button>
          </div>
          `,
              `
          <div class='response-container--small'>
            <button class='secondary--green' id='${validAnswerButtonHtmlIdentifier}' disabled></button>
          </div>
          `,
            ];
      } else {
        return `<button class='secondary--green' style='display: none;'></button>`;
      }
    },
    on_finish: (data) => {
      PageAudioHandler.stopAndDisconnectNode();

      if (onFinishTimelineCallback) {
        onFinishTimelineCallback(data);
      }
    },
  };
  return trial;
}
