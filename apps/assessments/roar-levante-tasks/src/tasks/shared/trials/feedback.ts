import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { mediaAssets } from '../../..';
import { PageAudioHandler } from '../helpers';
import { taskStore } from '../../../taskStore';
import { enableOkButton } from '../helpers/enableButtons';

// isPractice parameter is for tasks that don't have a corpus (e.g. memory game)
export const feedback = (
  isPractice = false,
  correctFeedbackAudioKey: string,
  inCorrectFeedbackAudioKey: string,
  showPrompt: boolean = false,
) => {
  return {
    timeline: [
      {
        type: jsPsychHtmlMultiResponse,
        stimulus: () => {
          const t = taskStore().translations;
          const isCorrect = taskStore().isCorrect;
          const imageUrl = isCorrect ? mediaAssets.images['smilingFace@2x'] : mediaAssets.images['sadFace@2x'];
          let promptOnIncorrect; // prompt displayed at bottom if incorrect, differs by task

          switch (taskStore().task) {
            case 'same-different-selection':
              promptOnIncorrect = t.sds2matchPrompt1;
              break;
            case 'memory-game':
              if (inCorrectFeedbackAudioKey.toUpperCase().includes('BACKWARD')) {
                promptOnIncorrect = t.memoryGameBackwardPrompt;
              } else {
                promptOnIncorrect = t.memoryGameForwardPrompt;
              }
              break;
            case 'egma-math':
              promptOnIncorrect = t.numberLineSliderPrompt1;
              break;
            default:
              promptOnIncorrect = '';
          }

          return `<div class="lev-stimulus-container">
                            <div class="lev-row-container instruction">
                                <p>${isCorrect ? t.feedbackCorrect : t.feedbackNotQuiteRight}</p>
                            </div>
                            <div class="lev-stim-content">
                                <img src=${imageUrl} alt="Image not loading: ${imageUrl}. Please continue the task."'/>
                            </div>
                    
                            ${
                              isCorrect || !showPrompt
                                ? ''
                                : `<div class="lev-row-container instruction"'>
                                <p>${promptOnIncorrect}</p>
                              </div>`
                            }
                        </div>`;
        },
        button_choices: ['Continue'],
        keyboard_choices: 'NO_KEYS',
        prompt_above_buttons: true,
        button_html: () => {
          const t = taskStore().translations;
          return `<button class="primary">${t.continueButtonText}</button>`;
        },
        on_load: () => {
          const isCorrect = taskStore().isCorrect;
          const stimulusPath = isCorrect
            ? mediaAssets.audio[correctFeedbackAudioKey]
            : mediaAssets.audio[inCorrectFeedbackAudioKey];

          const audioConfig: AudioConfigType = {
            restrictRepetition: {
              enabled: false,
              maxRepetitions: 2,
            },
          };

          PageAudioHandler.stopAndDisconnectNode();
          PageAudioHandler.playAudio(stimulusPath || mediaAssets.audio.nullAudio, audioConfig);
        },
        on_finish: () => {
          PageAudioHandler.stopAndDisconnectNode();
        },
      },
    ],
    conditional_function: () => {
      return (
        taskStore().nextStimulus?.notes === 'practice' ||
        taskStore().nextStimulus?.trialType === 'practice' ||
        isPractice
      );
    },
  };
};
