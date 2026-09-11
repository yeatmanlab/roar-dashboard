import jsPsychHtmlMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { mediaAssets } from '../../..';
import {
  PageStateHandler,
  prepareChoices,
  getParticipantUtilityButtonsHtml,
  setupReplayAudio,
  PageAudioHandler,
  camelize,
  enableOkButton,
  disableOkButton,
  selectNextSequentialTrial,
  addExperimenterButtons,
  setupFullscreenButton,
  updateTheta,
} from '../../shared/helpers';
import { finishExperiment } from '../../shared/trials';
import { isTouchScreen, jsPsych } from '../../taskSetup';
import Cypress from 'cypress';
import { taskStore } from '../../../taskStore';
import { shouldTerminateCat } from '../../shared/helpers/shouldTerminateCat';
import { displayDebugInfo } from '../../shared/helpers/displayDebugInfo';

const replayButtonHtmlId = 'replay-btn-revisited';
let incorrectPracticeResponses: string[] = [];
let startTime: number;
let selection: string | null = null;
let selectionIdx: number | null = null;
let currentTrialId: string = ''; // used to prevent audio from overlapping between trials

const SELECT_CLASS_NAME = 'info-shadow';

export const generateImageChoices = (choices: string[]) => {
  return choices.map((choice) => {
    const imageUrl = mediaAssets.images[camelize(choice)];
    return `<img src=${imageUrl} alt=${choice} />`;
  });
};

function enableBtns(btnElements: HTMLButtonElement[]) {
  btnElements.forEach((btn) => btn.removeAttribute('disabled'));
}

function getTestDimensionsHtml(stim: StimulusType) {
  const prompt =
    typeof stim.audioFile === 'string'
      ? camelize(stim.audioFile)
      : stim.audioFile.map((file) => camelize(file)).join(' ');

  const t = taskStore().translations;

  return `
        <div class="lev-stimulus-container">
          ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
          <div class="lev-row-container instruction">
            <p>${t[prompt]}</p>
          </div>
        </div>`;
}

function getSomethingSameHtml(stim: StimulusType) {
  const t = taskStore().translations;

  const leftImageSrc: string = stim.trialType == 'something-same-1' ? stim.image[0] : (stim.image as string);

  const leftPromptHtml = stim.trialType === 'something-same-2' ? `<p>${t[camelize(stim.audioFile[0])]}</p>` : '';
  const rightPromptHtml =
    stim.trialType === 'something-same-2'
      ? `<p>${t[camelize(stim.audioFile[1])]}</p>`
      : `<p>${t[camelize(stim.audioFile as string)]}</p>`;

  const leftImageHtml = `
    <button class='image-medium no-pointer-events' style="${
      stim.trialType == 'something-same-1' ? 'visibility: hidden;' : ''
    }">
      <img src=${mediaAssets.images[camelize(leftImageSrc)]} alt=${leftImageSrc} />
    </button>
  `;

  // randomize choices if there is an answer
  const randomize = stim.answer ? 'yes' : 'no';
  const { choices } = prepareChoices(stim.answer as string, stim.distractors as string[], randomize);
  const images: string[] =
    stim.trialType == 'something-same-1'
      ? (stim.image as string[]).map((image) => {
          return `<img src=${mediaAssets.images[camelize(image)]} alt=${image} />`;
        })
      : generateImageChoices(choices);

  const rightImageHtml = `
    ${images
      .map((image) => {
        return `<button class='image-medium ${
          stim.trialType === 'something-same-1' ? 'no-pointer-events' : ''
        }' style='margin: 0 4px'>
                  ${image}
                </button>`;
      })
      .join('')}
  `;

  return `
    <div class="lev-stimulus-container-wide">
      ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
      <div class="horizontal-wrapper">
        ${
          stim.trialType === 'something-same-2'
            ? `<div class="lev-row-container instruction-half-screen" id="left-prompt">`
            : `<div class="lev-row-container instruction-half-screen" style="visibility: hidden;">`
        }
          ${leftPromptHtml}
        </div>
        <div class="lev-row-container instruction-half-screen" id="right-prompt">
          <p>${rightPromptHtml}</p>
        </div>
      </div>
      <div class="horizontal-wrapper">
        <div class="lev-stim-content">
          ${leftImageHtml}
        </div>
        <div class="lev-stim-content" id="img-button-container">
          ${rightImageHtml}
        </div>
      </div>
      <div class="horizontal-wrapper" id="ok-button-container">
        <div class="lev-response-row multi-4">
        </div>
      </div>
    </div>
  `;
}

export function handleButtonFeedback(
  btn: HTMLButtonElement,
  cards: HTMLButtonElement[],
  isKeyBoardResponse: boolean,
  responsevalue: number,
  correctAudio: string,
) {
  const choice = btn?.parentElement?.id || '';
  const answer = taskStore().correctResponseIdx.toString();

  const isCorrectChoice = choice.includes(answer);
  let feedbackAudio;
  if (isCorrectChoice) {
    btn.classList.add('success-shadow');
    feedbackAudio = mediaAssets.audio[correctAudio];
  } else {
    btn.classList.add('error-shadow');
    feedbackAudio = mediaAssets.audio.feedbackTryAgain;
    // renable buttons
    setTimeout(() => enableBtns(cards), 500);
    incorrectPracticeResponses.push(choice);
  }

  function finishTrial() {
    jsPsych.finishTrial({
      response: choice,
      incorrectPracticeResponses,
      button_response: !isKeyBoardResponse ? responsevalue : null,
      keyboard_response: isKeyBoardResponse ? responsevalue : null,
    });
  }

  const correctAudioConfig: AudioConfigType = {
    restrictRepetition: {
      enabled: false,
      maxRepetitions: 2,
    },
    onEnded: finishTrial,
  };

  const incorrectAudioConfig: AudioConfigType = {
    restrictRepetition: {
      enabled: false,
      maxRepetitions: 2,
    },
  };

  PageAudioHandler.stopAndDisconnectNode(); // disconnect first to avoid overlap
  isCorrectChoice
    ? PageAudioHandler.playAudio(feedbackAudio, correctAudioConfig)
    : PageAudioHandler.playAudio(feedbackAudio, incorrectAudioConfig);
}

export const stimulus = (trial?: StimulusType) => {
  return {
    type: jsPsychHtmlMultiResponse,
    data: () => {
      const stim = trial || taskStore().nextStimulus;
      const isPracticeTrial = stim.assessmentStage === 'practice_response';
      return {
        save_trial: stim.assessmentStage !== 'instructions',
        assessment_stage: stim.assessmentStage,
        // not for firekit
        isPracticeTrial: isPracticeTrial,
      };
    },
    stimulus: () => {
      const stim = trial || taskStore().nextStimulus;

      return stim.trialType.includes('something-same') ? getSomethingSameHtml(stim) : getTestDimensionsHtml(stim);
    },
    prompt_above_buttons: true,
    button_choices: () => {
      const stim = trial || taskStore().nextStimulus;
      if (stim.trialType === 'test-dimensions') {
        const randomize = stim.answer ? 'yes' : 'no';
        // Randomize choices if there is an answer
        const { choices } = prepareChoices(stim.answer, stim.distractors, randomize);
        return generateImageChoices(choices);
      } else {
        return ['OK'];
      }
    },
    button_html: () => {
      const stim = trial || taskStore().nextStimulus;
      const buttonClass = stim.trialType === 'test-dimensions' ? 'image-medium' : 'primary';
      const buttonStyle = stim.trialType !== 'test-dimensions' ? 'margin: 16px' : '';

      return `<button class="${buttonClass}" style="${buttonStyle}">%choice%</button>`;
    },
    response_ends_trial: () => {
      const stim = trial || taskStore().nextStimulus;

      return !(
        stim.trialType === 'test-dimensions' ||
        (stim.trialType === 'something-same-2' && stim.assessmentStage === 'practice_response')
      );
    },
    on_load: () => {
      startTime = performance.now();
      const stimulus = trial || taskStore().nextStimulus;
      const audioFile = stimulus.audioFile;
      const trialType = stimulus.trialType;

      currentTrialId = stimulus.itemId;

      if (trialType === 'something-same-2') {
        // something-same-2 trials have multiple audio files
        const audioFiles = audioFile as string[];

        const audioConfig: AudioConfigType = {
          restrictRepetition: {
            enabled: false,
            maxRepetitions: 2,
          },
          onEnded: () => {
            if (currentTrialId !== stimulus.itemId) {
              return;
            }

            if (audioFiles.length) {
              PageAudioHandler.playAudio(mediaAssets.audio[camelize(audioFiles.shift() as string)], audioConfig);
            }
          },
        };

        PageAudioHandler.playAudio(mediaAssets.audio[camelize(audioFiles.shift() as string)], audioConfig);
      } else {
        PageAudioHandler.playAudio(mediaAssets.audio[camelize(audioFile)]);
      }

      const pageStateHandler = new PageStateHandler(audioFile, true);
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();
      const jspsychButtonContainer = document.getElementById('jspsych-html-multi-response-btngroup') as HTMLDivElement;
      jspsychButtonContainer.classList.add('lev-response-row');
      jspsychButtonContainer.classList.add('multi-4');

      if (trialType.includes('something-same')) {
        // widen the jspsych container so that the buttons are not squished
        const jsPsychHtmlMultiResponseContainer = document.getElementById(
          'jspsych-html-multi-response-stimulus',
        ) as HTMLDivElement;
        jsPsychHtmlMultiResponseContainer.style.width = '100%';
        jsPsychHtmlMultiResponseContainer.style.display = 'flex';
        jsPsychHtmlMultiResponseContainer.style.justifyContent = 'center';

        const okButtonContainer = document.getElementById('ok-button-container') as HTMLDivElement;
        okButtonContainer.appendChild(jspsychButtonContainer);
      }

      if (trialType === 'something-same-2') {
        const leftPrompt = document.getElementById('left-prompt') as HTMLParagraphElement;
        const rightPrompt = document.getElementById('right-prompt') as HTMLParagraphElement;

        // equalize prompt box heights
        if (leftPrompt && rightPrompt) {
          const styles = getComputedStyle(rightPrompt);
          const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);

          const contentBoxHeight = rightPrompt.clientHeight - paddingY;
          leftPrompt.style.height = `${contentBoxHeight}px`;
        }

        disableOkButton();

        const responseBtns = Array.from(
          document.getElementById('img-button-container')?.children as any,
        ) as HTMLButtonElement[];
        responseBtns.forEach((card, i) => {
          card.addEventListener('click', () => {
            const answer = ((card as HTMLButtonElement).children[0] as HTMLImageElement)?.alt;

            if (!card) {
              return;
            }

            if (card.classList.contains(SELECT_CLASS_NAME)) {
              card.classList.remove(SELECT_CLASS_NAME);
              selection = null;
              selectionIdx = null;
            } else {
              card.classList.add(SELECT_CLASS_NAME);
              selection = answer;
              selectionIdx = i;

              responseBtns.forEach((card, j) => {
                if (j !== i) {
                  card.classList.remove(SELECT_CLASS_NAME);
                }
              });
            }

            if (selection !== null) {
              enableOkButton();
            } else {
              disableOkButton();
            }

            setTimeout(() => enableBtns(responseBtns), 500);
          });
        });

        let numberOfErrors = 0;

        if (stimulus.assessmentStage === 'practice_response') {
          const okButton = document.querySelector('.primary') as HTMLButtonElement;
          okButton.addEventListener('click', (e) => {
            if (selectionIdx !== taskStore().correctResponseIdx) {
              const rightPrompt = document.getElementById('right-prompt') as HTMLParagraphElement;
              const leftPrompt = document.getElementById('left-prompt') as HTMLParagraphElement;
              rightPrompt.innerHTML = `<p>${taskStore().translations.feedbackNotQuiteRight}</p>`;
              leftPrompt.style.visibility = 'hidden';

              numberOfErrors++;

              const audioConfig: AudioConfigType = {
                restrictRepetition: {
                  enabled: false,
                  maxRepetitions: 2,
                },
              };

              PageAudioHandler.stopAndDisconnectNode();
              PageAudioHandler.playAudio(mediaAssets.audio.feedbackNotQuiteRight, audioConfig);

              responseBtns.forEach((btn) => btn.classList.remove(SELECT_CLASS_NAME));
              selection = null;
              selectionIdx = null;

              if (numberOfErrors >= 2) {
                responseBtns[taskStore().correctResponseIdx].style.animation = 'pulse 2s infinite';
              }
            } else {
              e.stopPropagation(); // prevents jspsych from disabling the buttons in the next trial
              jsPsych.finishTrial();
            }
          });
        }
      }

      // if the task is running in a cypress test, the correct answer should be indicated with 'correct' class
      if (window.Cypress && trialType !== 'something-same-1') {
        const responseBtns = document.querySelectorAll('.image-medium');
        responseBtns.forEach((button) => {
          const imgAlt = button.querySelector('img')?.getAttribute('alt');
          if (imgAlt === taskStore().nextStimulus.answer) {
            button.classList.add('correct');
          }
        });
      }

      if (trialType === 'test-dimensions') {
        // cards should give feedback during test dimensions block
        const practiceBtns = Array.from(jspsychButtonContainer.children)
          .map((btnDiv) => btnDiv.firstChild)
          .filter((btn) => !!btn) as HTMLButtonElement[];

        practiceBtns.forEach((card, i) => {
          const eventType = isTouchScreen ? 'touchend' : 'click';

          card.addEventListener(eventType, (e) => {
            handleButtonFeedback(card, practiceBtns, false, i, 'feedbackGoodJob');
          });
        });
      }

      displayDebugInfo(stimulus);
    },
    on_finish: (data: any) => {
      PageAudioHandler.stopAndDisconnectNode();
      currentTrialId = '';

      const stim = trial || taskStore().nextStimulus;
      const choices = taskStore().choices;
      const endTime = performance.now();
      const cat = taskStore().runCat;

      jsPsych.data.addDataToLastTrial({
        audioButtonPresses: PageAudioHandler.replayPresses,
      });
      // Always need to write correct key because of firekit.
      // TODO: Discuss with ROAR team to remove this check
      if (stim.assessmentStage !== 'instructions') {
        let isCorrect;
        if (stim.trialType === 'test-dimensions') {
          // if no incorrect answers were clicked, that trial is correct
          isCorrect = incorrectPracticeResponses.length === 0;
        } else {
          isCorrect = selectionIdx === taskStore().correctResponseIdx;
        }

        incorrectPracticeResponses = [];

        // don't update task store for something-same-1 trials
        if (stim.trialType !== 'something-same-1') {
          // update task store
          taskStore('isCorrect', isCorrect);
          if (isCorrect === false && stim.assessmentStage !== 'practice_response') {
            taskStore.transact('numIncorrect', (oldVal: number) => oldVal + 1);
          } else {
            taskStore('numIncorrect', 0);
          }
        }

        jsPsych.data.addDataToLastTrial({
          // specific to this trial
          item: stim.item,
          answer: stim.answer,
          correct: isCorrect,
          distractors: stim.distractors,
          corpusTrialType: stim.trialType,
          response: selection,
          responseLocation: selectionIdx,
          itemUid: stim.itemUid,
          audioFile: stim.audioFile,
          corpus: taskStore().corpus,
        });

        if (taskStore().storeItemId) {
          jsPsych.data.addDataToLastTrial({
            itemId: stim.itemId,
          });
        }

        if (stim.trialType === 'test-dimensions' || stim.assessmentStage === 'practice_response') {
          const calculatedRt = Math.round(endTime - startTime);
          jsPsych.data.addDataToLastTrial({
            rt: calculatedRt,
          });
        }

        if (stim.assessmentStage === 'test_response') {
          taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
        }
        // if heavy instructions is true, show data quality screen before ending
        if (taskStore().numIncorrect >= taskStore().maxIncorrect && !taskStore().heavyInstructions && !cat) {
          finishExperiment();
        }

        if (stim.trialType !== 'something-same-1' && stim.trialType !== 'instructions') {
          shouldTerminateCat();
          updateTheta(stim, isCorrect);
        }

        if (cat && !(stim.assessmentStage === 'practice_response')) {
          shouldTerminateCat();
          const allSequentialTrials = taskStore().sequentialTrials;
          const nextTrials = allSequentialTrials.filter((trial: StimulusType) => {
            return trial.trialNumber === stim.trialNumber && trial.block_index === stim.block_index;
          });

          selectNextSequentialTrial(nextTrials);
        }
      }

      if (stim.trialType === 'test-dimensions' || stim.assessmentStage === 'practice_response') {
        const calculatedRt = Math.round(endTime - startTime);

        jsPsych.data.addDataToLastTrial({
          rt: calculatedRt,
        });
      }

      if (stim.assessmentStage === 'test_response') {
        taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
      }
    },
  };
};
