import jsPsychAudioMultiResponse from '@jspsych-contrib/plugin-audio-multi-response';
import { mediaAssets } from '../../..';
import { jsPsych } from '../../taskSetup';
import {
  prepareChoices,
  getParticipantUtilityButtonsHtml,
  setupReplayAudio,
  PageStateHandler,
  PageAudioHandler,
  camelize,
  enableOkButton,
  disableOkButton,
  shouldTerminateCat,
  selectNextSequentialTrial,
  addExperimenterButtons,
  setupFullscreenButton,
} from '../../shared/helpers';
import { finishExperiment } from '../../shared/trials';
import { taskStore } from '../../../taskStore';
import { updateTheta } from '../../shared/helpers';
import { sdsProgressComponentFilled, sdsProgressComponentEmpty } from '../../shared/helpers/components';
import { displayDebugInfo } from '../../shared/helpers/displayDebugInfo';

let selectedCards: string[] = [];
let selectedCardIdxs: number[] = [];
let previousSelections: string[][] = [];
let startTime: number;

const replayButtonHtmlId = 'replay-btn-revisited';
const SELECT_CLASS_NAME = 'info-shadow';

const generateImageChoices = (choices: string[]) => {
  return choices.map((choice) => {
    const imageUrl = mediaAssets.images[camelize(choice)];
    return `<img src=${imageUrl} alt=${choice} />`;
  });
};

function enableBtns(btnElements: HTMLButtonElement[]) {
  btnElements.forEach((btn) => btn.removeAttribute('disabled'));
}

function cleanAttributes(attributes: string[]) {
  const nonWhiteBackgrounds: string[] = ['gray', 'striped', 'black'];
  // add in the background string if it's not there (white background)
  if (!attributes.some((item) => nonWhiteBackgrounds.includes(item))) {
    attributes.push('white');
  }
  if (!attributes.some((item) => !isNaN(Number(item)))) {
    attributes.splice(3, 0, '1');
  }

  return attributes;
}

// First check amongst the selections if they all share one trait
// Second check if any previous selections used those EXACT same selections
// At least one selection must be different from previous selections
// (also, ignore any specified dimension -- some blocks now don't vary particular dimensions)
function compareSelections(selections: string[], previousSelections: string[][], ignoreDims: string[]) {
  const dimensionIndices = {
    size: 0,
    color: 1,
    shape: 2,
    number: 3,
    bgcolor: 4,
  };
  // Check if all selections share at least one common trait (ignoring specified dimensions)
  function sharedTrait(selections: string[], ignoreDims: string[]) {
    const sets: Record<string, Set<string>> = {};
    // Initialize sets for each non-ignored dimension
    for (const [dim, index] of Object.entries(dimensionIndices)) {
      if (!ignoreDims.includes(dim)) {
        sets[dim] = new Set();
      }
    }
    // Populate sets with values from selections
    for (const sel of selections) {
      const attributes = cleanAttributes(sel.split('-'));
      for (const [dim, set] of Object.entries(sets)) {
        const index = dimensionIndices[dim as keyof typeof dimensionIndices];
        if (attributes[index] !== undefined) {
          set.add(attributes[index]);
        }
      }
    }
    // Check if any non-ignored dimension has all the same values
    return Object.values(sets).some((set) => set.size === 1);
  }
  // Check if any selection is different from all previous selections
  function hasNewSelection(selections: string[], previousSelections: string[][]) {
    // If there are no previous selections, every current selection is considered new
    if (!previousSelections || previousSelections.length === 0) {
      return true;
    }
    let hasNewSelection = true;
    previousSelections.forEach((item: string[]) => {
      // check that most recent selection does not have the same cards as a previous selection (even in reverse)
      if (
        (selections[0] === item[0] && selections[1] === item[1]) ||
        (selections[1] === item[0] && selections[0] === item[1])
      ) {
        hasNewSelection = false;
      }
    });
    return hasNewSelection;
  }
  // Perform checks
  const traitShared = sharedTrait(selections, ignoreDims);
  const containsNew = hasNewSelection(selections, previousSelections);
  return traitShared && containsNew;
}

function getIgnoreDims(stim: StimulusType) {
  if (stim.trialType === 'something-same-2') {
    return ['number', 'bgcolor'];
  } else if (stim.trialType === '2-match') {
    return ['number', 'bgcolor'];
  } else {
    return ['size'];
  }
}

export const afcMatch = (trial?: StimulusType) => {
  return {
    type: jsPsychAudioMultiResponse,
    data: () => {
      const stim = trial || taskStore().nextStimulus;
      let isPracticeTrial = stim.assessmentStage === 'practice_response';
      return {
        save_trial: stim.trialType !== 'instructions',
        assessment_stage: stim.assessmentStage,
        // not for firekit
        isPracticeTrial: isPracticeTrial,
      };
    },
    stimulus: () => {
      return mediaAssets.audio.nullAudio;
    },
    prompt: () => {
      const stimulus = trial || taskStore().nextStimulus;
      const prompt = camelize(stimulus.audioFile);

      const t = taskStore().translations;
      return `<div class="lev-stimulus-container">
        ${getParticipantUtilityButtonsHtml(replayButtonHtmlId)}
        <div class="lev-row-container instruction">
          <p id="afc-match-prompt">${t[prompt]}</p>
        </div>
      </div>`;
    },
    prompt_above_buttons: true,
    button_choices: () => {
      const stim = trial || taskStore().nextStimulus;
      if (stim.assessmentStage === 'instructions') {
        return ['OK'];
      } else {
        const randomize = !!stim.answser ? 'yes' : 'no';
        // Randomize choices if there is an answer
        const { choices } = prepareChoices(stim.answer, stim.distractors, randomize);
        return generateImageChoices(choices);
      }
    },
    button_html: () => {
      const stim = trial || taskStore().nextStimulus;
      const buttonClass = stim.assessmentStage === 'instructions' ? 'primary' : 'image-medium';
      return `<button class="${buttonClass}">%choice%</button>`;
    },
    on_load: () => {
      // create img elements and arrange in grid as cards
      // on click they will be selected
      // can select multiple cards and deselect them
      startTime = performance.now();
      const stim = trial || taskStore().nextStimulus;
      const isPractice = stim.assessmentStage === 'practice_response';
      const audioFile = stim.audioFile;

      const audioConfig: AudioConfigType = {
        restrictRepetition: {
          enabled: false,
          maxRepetitions: 2,
        },
      };
      PageAudioHandler.playAudio(mediaAssets.audio[camelize(audioFile)], audioConfig);

      const pageStateHandler = new PageStateHandler(audioFile, true);
      setupReplayAudio(pageStateHandler);
      addExperimenterButtons();
      setupFullscreenButton();

      const buttonContainer = document.getElementById('jspsych-audio-multi-response-btngroup') as HTMLDivElement;
      const responseBtns = Array.from(buttonContainer.children)
        .map((btnDiv) => btnDiv.firstChild as HTMLButtonElement)
        .filter((btn) => !!btn);

      let numberOfErrors = 0;

      if (stim.trialType !== 'instructions') {
        if (taskStore().version === 2) {
          // insert progress indicator
          const numbers = {
            first_response: 1,
            second_response: 2,
            third_response: 3,
            fourth_response: 4,
          };
          const currentResponse = numbers[stim.assessmentStage as keyof typeof numbers];
          const maxResponses = Number(stim.trialType[0]);

          if (currentResponse !== undefined) {
            const progressContainer = document.createElement('div');
            progressContainer.className = 'sds-progress-container';
            progressContainer.innerHTML = `
              ${sdsProgressComponentFilled.repeat(currentResponse)} ${sdsProgressComponentEmpty.repeat(
                maxResponses - currentResponse,
              )}
            `;
            progressContainer.style.marginTop = '32px';

            buttonContainer.parentNode?.insertBefore(progressContainer, buttonContainer.nextSibling);
          }

          // Add primary OK button under the other buttons
          const okButton = document.createElement('button');
          okButton.className = 'primary';
          okButton.textContent = 'OK';
          okButton.style.marginTop = '16px';
          okButton.disabled = true;
          okButton.addEventListener('click', () => {
            if (!isPractice || compareSelections(selectedCards, previousSelections, getIgnoreDims(stim))) {
              numberOfErrors = 0;
              jsPsych.finishTrial();
            } else {
              const prompt = document.getElementById('afc-match-prompt') as HTMLParagraphElement;
              prompt.textContent = `${taskStore().translations.feedbackNotQuiteRight} ${
                taskStore().translations[camelize(audioFile)]
              }`;

              numberOfErrors++;
              const numberOfErrorsThisCall = numberOfErrors;

              const audioConfig: AudioConfigType = {
                restrictRepetition: {
                  enabled: false,
                  maxRepetitions: 2,
                },
                onEnded: () => {
                  if (numberOfErrorsThisCall === numberOfErrors) {
                    // don't overlap audio
                    PageAudioHandler.playAudio(mediaAssets.audio[camelize(audioFile)]);
                  }
                },
              };

              PageAudioHandler.stopAndDisconnectNode();
              PageAudioHandler.playAudio(mediaAssets.audio.feedbackNotQuiteRight, audioConfig);

              responseBtns.forEach((btn) => btn.classList.remove(SELECT_CLASS_NAME));
              selectedCards = [];
              disableOkButton();

              if (numberOfErrors >= 2) {
                let animationStarted = false;
                const selections = responseBtns.map(
                  (btn) => ((btn as HTMLButtonElement)?.firstChild as HTMLImageElement)?.alt,
                );

                for (let i = 0; i < selections.length; i++) {
                  if (animationStarted) {
                    break;
                  }

                  const firstSelection = selections[i];

                  for (let j = i + 1; j < selections.length; j++) {
                    const secondSelection = selections[j];
                    if (
                      compareSelections([firstSelection, secondSelection], previousSelections, ['number', 'bgcolor'])
                    ) {
                      responseBtns[i].style.animation = 'pulse 2s infinite';
                      responseBtns[j].style.animation = 'pulse 2s infinite';
                      animationStarted = true;
                      break;
                    }
                  }
                }
              }
            }
          });
          buttonContainer.parentNode?.insertBefore(okButton, buttonContainer.nextSibling);
        }

        if (responseBtns.length === 5) {
          // 3 x 2 button layout
          buttonContainer.classList.add('lev-response-row-inline', 'grid-3x2');
        } else {
          // linear button layout
          buttonContainer.classList.add('lev-response-row', 'multi-4');
        }
        responseBtns.forEach((card, i) =>
          card.addEventListener('click', async (e) => {
            const answer = ((card as HTMLButtonElement)?.firstChild as HTMLImageElement)?.alt;

            if (!card) {
              return;
            }

            if (card.classList.contains(SELECT_CLASS_NAME)) {
              card.classList.remove(SELECT_CLASS_NAME);
              selectedCards.splice(selectedCards.indexOf(answer), 1);
              selectedCardIdxs.splice(selectedCardIdxs.indexOf(i), 1);
            } else {
              card.classList.add(SELECT_CLASS_NAME);
              selectedCards.push(answer);
              selectedCardIdxs.push(i);
            }

            if (taskStore().version === 2) {
              if (selectedCards.length === stim.requiredSelections) {
                enableOkButton();
              } else {
                disableOkButton();
              }
            } else {
              const requiredSelections = stim.requiredSelections;

              if (selectedCards.length === requiredSelections) {
                setTimeout(() => jsPsych.finishTrial(), 500);
              }
            }

            setTimeout(() => enableBtns(responseBtns), 500);
          }),
        );
      }

      displayDebugInfo(stim);
    },
    response_ends_trial: () => {
      return (trial || taskStore().nextStimulus).trialType === 'instructions' && taskStore().version === 2;
    },
    on_finish: () => {
      const stim = trial || taskStore().nextStimulus;
      const cat = taskStore().runCat;

      const endTime = performance.now();
      const calculatedRt = endTime - startTime;

      PageAudioHandler.stopAndDisconnectNode();

      // save data
      jsPsych.data.addDataToLastTrial({
        corpusTrialType: stim.trialType,
        answer: stim.answer || null,
        response: selectedCards,
        distractors: stim.distractors,
        item: stim.item,
        rt: Math.round(calculatedRt),
        audioButtonPresses: PageAudioHandler.replayPresses,
        responseLocation: selectedCardIdxs,
        itemUid: stim.itemUid,
        audioFile: stim.audioFile,
        corpus: taskStore().corpus,
      });

      if (taskStore().storeItemId) {
        jsPsych.data.addDataToLastTrial({
          itemId: stim.itemId,
        });
      }

      if (stim.audioFile.split('-')[2] === 'prompt1') {
        // Prompt 1 is the start and prompt 2 trials are when the selections
        // Must be different from previous selections
        previousSelections = [];
      }

      const isCorrect = compareSelections(selectedCards, previousSelections, getIgnoreDims(stim));

      // update task store
      taskStore('isCorrect', isCorrect);

      if (isCorrect === false) {
        taskStore.transact('numIncorrect', (oldVal: number) => oldVal + 1);
      } else {
        taskStore('numIncorrect', 0);
      }

      jsPsych.data.addDataToLastTrial({
        correct: isCorrect,
      });
      previousSelections.push(selectedCards);
      selectedCards = [];
      selectedCardIdxs = [];

      if (stim.assessmentStage === 'test_response') {
        taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
      }

      // if heavy instructions is true, show data quality screen before ending
      if (taskStore().numIncorrect >= taskStore().maxIncorrect && !taskStore().heavyInstructions && !cat) {
        finishExperiment();
      }

      if (cat) {
        shouldTerminateCat();
        updateTheta(stim, isCorrect);

        const allSequentialTrials = taskStore().sequentialTrials;
        const nextTrials = allSequentialTrials.filter((trial: StimulusType) => {
          return trial.trialNumber === stim.trialNumber && trial.trialType === stim.trialType;
        });

        selectNextSequentialTrial(nextTrials);
      }
    },
  };
};
