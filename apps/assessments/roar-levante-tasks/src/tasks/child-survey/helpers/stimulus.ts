import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { taskStore } from '../../../taskStore';
import {
  camelize,
  equalizeButtonSizes,
  getChildSurveyResponses,
  handleStaggeredButtons,
  PageAudioHandler,
  PageStateHandler,
  addExperimenterButtons,
  getParticipantUtilityButtonsHtml,
  setSentryContext,
  setupReplayAudio,
  setupFullscreenButton,
} from '../../shared/helpers';
import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import { updateProgressBar } from '../../shared/helpers/updateProgressBar';
import { disableStagger } from '../../shared/helpers/staggerButtons';

const replayButtonHtmlId = 'replay-btn-revisited';
let startTime: number;
let selectedButtonIndex: number;

export const surveyItem = ({
  responseAllowed,
  promptAboveButtons,
  task,
  layoutConfigMap,
}: {
  responseAllowed: boolean;
  promptAboveButtons: boolean;
  task: string;
  layoutConfigMap: Record<string, LayoutConfigType>;
}) => {
  return {
    type: jsPsychHtmlMultiResponse,
    data: () => {
      const stim = taskStore().nextStimulus;
      return {
        save_trial: true,
        assessment_stage: stim.assessmentStage,
        isPracticeTrial: false,
      };
    },
    stimulus: () => {
      const stim = taskStore().nextStimulus;
      const t = taskStore().translations;
      const prompt = stim.audioFile;

      return `<div class="lev-stimulus-container">
        <div class="lev-progress-bar">
          <div id="progress-fill" class="progress-fill"></div>
        </div>
        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
        <div class="lev-row-container instruction-small">
            <p>${t[camelize(prompt)]}</p>
        </div>
      </div>`;
    },
    response_ends_trial: false,
    prompt_above_buttons: promptAboveButtons,
    button_choices: () => {
      const stim = taskStore().nextStimulus;
      const itemLayoutConfig: LayoutConfigType = layoutConfigMap?.[stim.itemId];

      return itemLayoutConfig.response.values;
    },
    button_html: () => {
      const stim = taskStore().nextStimulus;
      const itemLayoutConfig: LayoutConfigType = layoutConfigMap?.[stim.itemId];

      return `<button 
                  class='${itemLayoutConfig.classOverrides.buttonClassList.join(' ')}' 
                  ${stim.assessmentStage === 'test_response' ? 'disabled' : ''}>
                  %choice%
                </button>`;
    },
    on_load: async () => {
      startTime = performance.now();

      const stim = taskStore().nextStimulus;
      const itemLayoutConfig: LayoutConfigType = layoutConfigMap?.[stim.itemId];
      const playAudioOnLoad = itemLayoutConfig?.playAudioOnLoad;
      const pageStateHandler = new PageStateHandler(stim.audioFile, playAudioOnLoad);
      const buttonClass = itemLayoutConfig.classOverrides.buttonClassList[0];
      const responseButtonChildren = document.querySelectorAll(`button.${buttonClass}`);
      const buttonContainer = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;

      // update progress bar
      const progress = (taskStore().testTrialCount / taskStore().totalTrials) * 100;
      updateProgressBar(progress);

      equalizeButtonSizes(responseButtonChildren as NodeListOf<HTMLButtonElement>);

      // Setup Sentry Context
      setSentryContext({
        itemId: stim.itemId,
        taskName: stim.task,
        pageContext: 'stimulus',
      });

      // set up replay button
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();

      // enable response buttons immediately after prompt audio finishes so stagger effect can be interrupted
      const audioConfig: AudioConfigType = {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
        onEnded: () => {
          responseButtonChildren.forEach((button) => {
            (button as HTMLButtonElement).disabled = false;
          });
        },
      };

      // play trial audio
      PageAudioHandler.playAudio(mediaAssets.audio[camelize(stim.audioFile)], audioConfig);

      responseButtonChildren.forEach((button) => {
        (button as HTMLButtonElement).addEventListener('click', (event: MouseEvent) => {
          const okButton = document.querySelector('.primary');
          if (!okButton) {
            const okButton = document.createElement('button');
            okButton.className = 'primary';
            okButton.textContent = 'OK';
            okButton.style.marginTop = '16px';
            okButton.addEventListener('click', () => {
              jsPsych.finishTrial();
            });
            buttonContainer.parentNode?.insertBefore(okButton, buttonContainer.nextSibling);
          }
          responseButtonChildren.forEach((button) => {
            setTimeout(() => {
              (button as HTMLButtonElement).disabled = false;
            }, 10);
            (button as HTMLButtonElement).classList.remove('success-shadow');
          });

          (event.target as HTMLButtonElement).classList.add('success-shadow');
          selectedButtonIndex = Array.prototype.indexOf.call(responseButtonChildren, event.target as HTMLButtonElement);
        });
      });

      if (itemLayoutConfig.isStaggered) {
        // Handle the staggered buttons
        let audioKeys: string[] = [
          'child-survey-response1',
          'child-survey-response2',
          'child-survey-response3',
          'child-survey-response4',
        ];
        await handleStaggeredButtons(
          pageStateHandler,
          buttonContainer,
          audioKeys,
          stim.itemId,
          stim.assessmentStage === 'instructions',
        );

        // disable demo buttons
        if (stim.assessmentStage === 'instructions') {
          responseButtonChildren.forEach((button) => {
            (button as HTMLButtonElement).disabled = true;
          });
          // Add primary OK button under the other buttons
          const okButton = document.createElement('button');
          okButton.className = 'primary';
          okButton.textContent = 'OK';
          okButton.style.marginTop = '16px';
          okButton.addEventListener('click', () => {
            jsPsych.finishTrial();
          });
          buttonContainer.parentNode?.insertBefore(okButton, buttonContainer.nextSibling);
        }
      }
      // update the trial number
      taskStore.transact('trialNumSubtask', (oldVal: number) => oldVal + 1);
    },
    on_finish: (data: any) => {
      disableStagger();
      PageAudioHandler.stopAndDisconnectNode();

      let responseValue = null;
      let responseIndex = null;

      const t = taskStore().translations;
      const corpus = taskStore().corpus;
      const stim = taskStore().nextStimulus;
      const itemLayoutConfig: LayoutConfigType = layoutConfigMap?.[stim.itemId];

      if (stim.trialType !== 'instructions') {
        if (itemLayoutConfig) {
          const { response } = itemLayoutConfig;

          if (!response) {
            throw new Error('Choices not defined in the config');
          }
          responseIndex = data.button_response;
          responseValue = response.values[responseIndex];
        }

        jsPsych.data.addDataToLastTrial({
          // specific to this trial
          item: stim.item,
          distractors: stim.distractors,
          corpusTrialType: stim.trialType,
          responseLocation: selectedButtonIndex,
          itemUid: stim.itemUid,
          audioFile: stim.audioFile,
          corpus: corpus,
          audioButtonPresses: PageAudioHandler.replayPresses,
          correct: false, // false because there is no correct answer
          answer: stim.distractors[selectedButtonIndex],
        });

        // corpusId and itemId fields are used by ROAR but not ROAD
        if (taskStore().storeItemId) {
          jsPsych.data.addDataToLastTrial({
            corpusId: taskStore().corpusId,
            itemId: stim.itemId,
          });
        }
      } else {
        jsPsych.data.addDataToLastTrial({
          // false because it's not a real trial
          correct: false,
        });
      }

      if (stim.assessmentStage === 'test_response') {
        taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
      }
    },
  };
};
