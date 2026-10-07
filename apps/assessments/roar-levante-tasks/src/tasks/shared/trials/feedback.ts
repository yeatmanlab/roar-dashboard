import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { mediaAssets } from '../../..';
import { taskStore } from '../../../taskStore';
import { camelize, PageAudioHandler } from '../helpers';

// isPractice parameter is for tasks that don't have a corpus (e.g. memory game)
export const feedback = (isPractice = false, promptOnIncorrect?: string) => {
  // Guards against the chained prompt audio bleeding into the next trial when
  // the user clicks Continue before the first feedback audio finishes playing.
  // stopAndDisconnectNode() in on_finish calls stop(), which fires onended.
  let trialFinished = false;

  return {
    timeline: [
      {
        type: jsPsychHtmlMultiResponse,
        stimulus: () => {
          const t = taskStore().translations;
          const isCorrect = taskStore().isCorrect;
          const imageUrl = isCorrect ? mediaAssets.images['smilingFace@2x'] : mediaAssets.images['sadFace@2x'];

          return `<div class="lev-stimulus-container">
                            <div class="lev-row-container instruction">
                                <p>${isCorrect ? t.feedbackCorrect : t.feedbackNotQuiteRight}</p>
                            </div>
                            <div class="lev-stim-content">
                                <img src=${imageUrl} alt="Image not loading: ${imageUrl}. Please continue the task."'/>
                            </div>

                            ${
                              isCorrect || !promptOnIncorrect
                                ? ''
                                : `<div class="lev-row-container instruction"'>
                                <p>${taskStore().translations[camelize(promptOnIncorrect)]}</p>
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
          trialFinished = false;
          const isCorrect = taskStore().isCorrect;
          const feedbackAudio = isCorrect ? mediaAssets.audio.feedbackCorrect : mediaAssets.audio.feedbackNotQuiteRight;

          const audioConfig: AudioConfigType = {
            restrictRepetition: {
              enabled: false,
              maxRepetitions: 2,
            },
            onEnded: () => {
              if (!trialFinished && promptOnIncorrect && !isCorrect) {
                PageAudioHandler.playAudio(
                  mediaAssets.audio[camelize(promptOnIncorrect)] || mediaAssets.audio.nullAudio,
                );
              }
            },
          };

          PageAudioHandler.stopAndDisconnectNode();
          PageAudioHandler.playAudio(feedbackAudio || mediaAssets.audio.nullAudio, audioConfig);
        },
        on_finish: () => {
          trialFinished = true;
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
