import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { taskStore } from '../../../taskStore';
import { mediaAssets } from '../../..';
import {
  addExperimenterButtons,
  addPracticeButtonListeners,
  camelize,
  PageAudioHandler,
  PageStateHandler,
  getParticipantUtilityButtonsHtml,
  setupReplayAudio,
  setupFullscreenButton,
  popAnimation,
  enableAllButtons,
} from '../../shared/helpers';
import { isTouchScreen, jsPsych } from '../../taskSetup';

const replayButtonHtmlId = 'replay-btn-revisited';
let practiceResponses = [];
let startTime: number;
let cycleId = 0; // disable audio if the trial has changed since the loop started - prevent overlapping audio

export const downexStimulus = (
  layoutConfigMap: Record<string, LayoutConfigType>,
  animate: boolean,
  trial?: StimulusType,
) => {
  return {
    type: jsPsychHtmlMultiResponse,
    data: () => {
      const stim = trial || taskStore().nextStimulus;
      let isPracticeTrial = stim.assessmentStage === 'practice_response';
      return {
        // not camelCase because firekit
        save_trial: true,
        assessment_stage: stim.assessmentStage,
        // not for firekit
        isPracticeTrial: isPracticeTrial,
      };
    },
    stimulus: () => {
      const stim = trial || taskStore().nextStimulus;
      const t = taskStore().translations;
      const imageSrc = mediaAssets.images[camelize(stim.item)];

      let itemText;
      const audioFile = stim.audioFile;
      if (typeof audioFile !== 'string') {
        itemText = audioFile.map((file: string) => t[camelize(file)]).join(' ');
      } else {
        itemText = t[camelize(audioFile)];
      }

      return `<div class="lev-stimulus-container">
                        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
                        <div class="lev-row-container instruction-small">
                            <p>${itemText}</p>
                        </div>
                        <div class="lev-stim-content-x-2">
                        <img
                            src=${imageSrc}
                            alt="Image not loading: ${imageSrc}. Please continue the task."
                        />
                        </div>
                    </div>`;
    },
    prompt_above_buttons: true,
    button_choices: () => {
      const stim = trial || taskStore().nextStimulus;
      const itemLayoutConfig = layoutConfigMap?.[stim.itemId];
      const choices = itemLayoutConfig.response.displayValues;

      return choices.map((choice) => {
        const imageUrl = mediaAssets.images[camelize(choice)];

        return `<img src=${imageUrl} alt=${choice} />`;
      });
    },
    keyboard_choices: () => 'NO_KEYS',
    button_html: () => {
      const stim = trial || taskStore().nextStimulus;
      const itemLayoutConfig = layoutConfigMap?.[stim.itemId];
      const classList = [...itemLayoutConfig.classOverrides.buttonClassList];
      if (stim.assessmentStage === 'practice_response') {
        classList.push('practice-btn');
      }

      return `<button class="${classList.join(' ')}" ${stim.assessmentStage === 'practice_response' ? 'disabled' : ''}>
                      %choice%
                    </button>`;
    },
    on_load: async () => {
      startTime = performance.now();

      const stim = trial || taskStore().nextStimulus;

      // set up replay audio with animations
      const trialAudio = stim.audioFile;

      addExperimenterButtons();
      setupFullscreenButton();

      const replayButton = document.getElementById('replay-btn-revisited');
      if (animate) {
        if (replayButton) {
          replayButton.addEventListener('click', () => {
            animateAndPlayAudio();
          });
        }
      } else {
        const pageStateHandler = new PageStateHandler(trialAudio, true);
        setupReplayAudio(pageStateHandler);
      }

      const stimContainer = document.querySelector('.lev-stim-content-x-2');
      const stimImage = stimContainer?.querySelector('img');
      const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup');
      const buttons = Array.from(buttonContainer?.querySelectorAll('button') || []);

      const itemLayoutConfig = layoutConfigMap?.[stim.itemId];

      // set up practice button listeners
      const incorrectPracticeResponses: Array<string | null> = [];
      taskStore('incorrectPracticeResponses', incorrectPracticeResponses);

      function onCorrect() {
        PageAudioHandler.stopAndDisconnectNode();
        cycleId++;
        PageAudioHandler.playAudio(mediaAssets.audio.feedbackRightOne);
      }

      function onIncorrect() {
        PageAudioHandler.stopAndDisconnectNode();
        cycleId++;

        const rspImages = buttons.map((button) => button.querySelector('img'));
        const targetImageIdx = rspImages.findIndex((image) => image?.alt === stim.answer);

        if (targetImageIdx !== -1) {
          const targetButton = buttons[targetImageIdx];

          targetButton.style.animation = 'none';
          targetButton.offsetHeight; // Force reflow
          targetButton.style.animation = 'pulse 2s 0s 2';
        }

        const audioConfig: AudioConfigType = {
          restrictRepetition: {
            enabled: true,
            maxRepetitions: 2,
          },
        };

        PageAudioHandler.playAudio(mediaAssets.audio.matrixReasoningFeedbackIncorrectDownex, audioConfig);
      }

      addPracticeButtonListeners(
        stim.answer.toString(),
        isTouchScreen,
        itemLayoutConfig.response.values,
        onCorrect,
        onIncorrect,
      );

      async function animateAndPlayAudio() {
        cycleId++;
        const thisCycleId = cycleId;

        // replay button should be disabled while animations are happening
        if (replayButton) {
          (replayButton as HTMLButtonElement).disabled = true;
        }

        // set up animation
        let itemsToAnimate = [buttons, stimImage];

        const audioConfig: AudioConfigType = {
          restrictRepetition: {
            enabled: false,
            maxRepetitions: 2,
          },
        };

        if (typeof trialAudio === 'string') {
          const audioUri = mediaAssets.audio[camelize(trialAudio)] || mediaAssets.audio.nullAudio;
          PageAudioHandler.playAudio(audioUri);
        } else {
          for (const [index, audioFile] of trialAudio.entries()) {
            const audioUri = mediaAssets.audio[camelize(audioFile)] || mediaAssets.audio.nullAudio;

            // make sure the trial has not changed since the loop started
            if (thisCycleId !== cycleId || taskStore().isPaused) {
              break;
            }

            await new Promise<void>((resolve) => {
              const configWithCallback = {
                ...audioConfig,
                onEnded: () => {
                  setTimeout(() => resolve(), 1000);
                },
              };

              if (animate && camelize(audioFile) !== 'sdsYourTurn') {
                itemsToAnimate = popAnimation(itemsToAnimate, 'pulse 2s 0s') as any;
              }
              PageAudioHandler.playAudio(audioUri, configWithCallback);
            });
          }
        }

        if (replayButton) {
          (replayButton as HTMLButtonElement).disabled = false;
        }

        enableAllButtons();
      }

      animateAndPlayAudio();
    },
    on_finish: (data: any) => {
      PageAudioHandler.stopAndDisconnectNode();
      cycleId++;

      const stimulus = trial || taskStore().nextStimulus;
      const itemLayoutConfig = layoutConfigMap?.[stimulus.itemId];
      const { corpus } = taskStore();

      let responseValue = null;
      let target = null;
      let responseIndex = null;

      if (itemLayoutConfig) {
        const { response } = itemLayoutConfig;
        if (!response) {
          throw new Error('Choices not defined in the config');
        }

        responseIndex = data.button_response;
        responseValue = response.values[responseIndex];
        target = response.target;
        data.correct = responseValue === target;
      }

      // update running score and answer lists
      if (data.correct) {
        if (stimulus.assessmentStage !== 'practice_response') {
          // practice trials don't count toward total
          taskStore.transact('totalCorrect', (oldVal: number) => oldVal + 1);
          taskStore('numIncorrect', 0); // reset incorrect trial count
        }
        practiceResponses = [];
      } else {
        // Only increase incorrect trials if response is incorrect not a practice trial
        if (stimulus.assessmentStage !== 'practice_response') {
          taskStore.transact('numIncorrect', (oldVal: number) => oldVal + 1);
        }
      }

      // save data
      jsPsych.data.addDataToLastTrial({
        // specific to this trial
        item: stimulus.item,
        answer: target,
        distractors: stimulus.distractors,
        corpusTrialType: stimulus.trialType,
        responseType: 'mouse',
        responseLocation: responseIndex,
        itemUid: stimulus.itemUid,
        audioFile: stimulus.audioFile,
        corpus: corpus,
        audioButtonPresses: PageAudioHandler.replayPresses,
      });

      // corpusId and itemId fields are used by ROAR but not ROAD
      if (taskStore().storeItemId) {
        jsPsych.data.addDataToLastTrial({
          itemId: stimulus.itemId,
        });
      }

      // Adding this seperately or otherwise it will overide
      // the response value added from practice trials
      if (stimulus.assessmentStage !== 'practice_response') {
        jsPsych.data.addDataToLastTrial({
          response: responseValue,
        });
      }

      if (stimulus.assessmentStage === 'practice_response') {
        const endTime = performance.now();
        const calculatedRt = Math.round(endTime - startTime);
        jsPsych.data.addDataToLastTrial({
          rt: calculatedRt,
        });
      }

      if (stimulus.assessmentStage === 'test_response') {
        taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
      }
    },
    response_ends_trial: () => {
      const stim = trial || taskStore().nextStimulus;

      return stim.assessmentStage !== 'practice_response';
    },
  };
};
