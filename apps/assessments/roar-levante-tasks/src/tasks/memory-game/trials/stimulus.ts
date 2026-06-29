import jsPsychCorsiBlocks from '@jspsych-contrib/plugin-corsi-blocks';
import { createGrid, generateRandomSequence, enableBlock, disableBlock } from '../helpers/grid';
import { jsPsych } from '../../taskSetup';
import _isEqual from 'lodash/isEqual';
import { finishExperiment } from '../../shared/trials';
import { mediaAssets } from '../../..';
import { getMemoryGameType } from '../helpers/getMemoryGameType';
import { getMemoryGamePrompt } from '../helpers/getMemoryGamePrompt';
import {
  addExperimenterButtons,
  setupReplayAudio,
  PageAudioHandler,
  PageStateHandler,
  getParticipantUtilityButtonsHtml,
  setupFullscreenButton,
} from '../../shared/helpers';
import { taskStore } from '../../../taskStore';

type CorsiBlocksArgs = {
  mode: 'display' | 'input';
  reverse?: boolean;
  isPractice?: boolean;
  resetSeq?: boolean;
  customSeqLength?: number;
  animation?: 'pulse' | 'cursor';
  prompt?: string; // a custom audio cue/text prompt for the trial
};

const x = 20;
const y = 20;
const blockSpacing = 0.5;
let grid: { x: number; y: number }[];
let sequenceLength = 2;
let generatedSequence: number[] | null;
let selectedCoordinates: [number, number][] = [];
let numCorrect = 0;
const HIGHLIGHT_COLOR = '#8CAEDF';
const INCORRECT_COLOR = '#f00';

// edit this list to change the audio cues/prompts for downex practice trials (in reverse order)
const downexPracticeAudioCues = [
  'memoryGameInstruct9Downex',
  'memoryGameInstruct7Downex',
  'memoryGameInstruct9Downex',
  'memoryGameInstruct7Downex',
  'memoryGameInstruct8Downex',
  'memoryGameInstruct7Downex',
  'memoryGameInstruct5Downex',
  'memoryGameInstruct4Downex',
  'memoryGameInstruct3Downex',
  'memoryGameInstruct2Downex',
];

// play audio cue
export function setUpAudio(
  contentWrapper: HTMLDivElement,
  prompt: HTMLParagraphElement,
  cue: string,
  mode?: 'display' | 'input',
) {
  // add replay + fullscreen participant controls
  if (mode === 'input') {
    const wrap = document.createElement('div');
    wrap.innerHTML = getParticipantUtilityButtonsHtml('replay-btn-revisited');
    const participantContainer = wrap.firstElementChild as HTMLElement;
    contentWrapper.insertBefore(participantContainer, prompt);
    const replayButton = participantContainer.querySelector('#replay-btn-revisited') as HTMLButtonElement;
    replayButton.disabled = true;
    addExperimenterButtons();
    setupFullscreenButton();
  }

  const audioFile = mediaAssets.audio[cue];
  const audioConfig: AudioConfigType = {
    restrictRepetition: {
      enabled: true,
      maxRepetitions: 2,
    },
    onEnded: () => {
      // set up replay button audio after the first audio has played
      if (cue) {
        const pageStateHandler = new PageStateHandler(cue, true);
        setupReplayAudio(pageStateHandler);
      }
    },
  };

  PageAudioHandler.playAudio(audioFile, audioConfig);
}

// This function produces both the display and input trials for the corsi blocks
export function getCorsiBlocks({
  mode,
  reverse = false,
  isPractice = false,
  resetSeq = false,
  customSeqLength,
  animation,
  prompt,
}: CorsiBlocksArgs) {
  return {
    type: jsPsychCorsiBlocks,
    sequence: () => {
      // On very first trial, generate initial sequence
      if (mode === 'display') {
        const numOfBlocks: number = Number(taskStore().numOfBlocks);
        // Avoid generating the same sequence twice in a row
        let newSequence = generateRandomSequence({
          numOfBlocks,
          sequenceLength: customSeqLength || sequenceLength,
          previousSequence: generatedSequence,
        });

        while (_isEqual(newSequence, generatedSequence)) {
          newSequence = generateRandomSequence({
            numOfBlocks,
            sequenceLength: customSeqLength || sequenceLength,
            previousSequence: generatedSequence,
          });
        }

        generatedSequence = newSequence;
      }

      if (generatedSequence && mode === 'input' && reverse) {
        return [...generatedSequence].reverse(); // Create a copy before reversing
      } else {
        return generatedSequence;
      }
    },
    blocks: () => {
      if (mode === 'display') {
        const { numOfBlocks, blockSize, gridSize } = taskStore();
        grid = createGrid({ x, y, numOfBlocks, blockSize, gridSize, blockSpacing });
      }
      return grid;
    },
    mode: mode,
    block_size: () => taskStore().blockSize,
    // light gray
    // Must be specified here as well as in the stylesheet. This is because
    // We need it for the initial render (our code) and when jspsych changes the color after highlighting.
    block_color: mode === 'display' ? 'rgba(215, 215, 215, 0.93)' : ' #ffffffcc',
    highlight_color: '#275BDD',
    // Show feedback only for practice
    correct_color: () => HIGHLIGHT_COLOR,
    incorrect_color: () => (isPractice ? INCORRECT_COLOR : HIGHLIGHT_COLOR),
    post_trial_gap: customSeqLength === 1 ? 2000 : 1000,
    data: {
      // not camelCase because firekit
      save_trial: true,
      assessment_stage: isPractice ? 'practice_response' : 'test_response',
      // not for firekit
      isPracticeTrial: isPractice,
      trialMode: mode,
    },
    sequence_block_duration: customSeqLength === 1 ? 2000 : 1000,
    disable_animation: mode === 'input',
    pre_stim_duration: () => {
      if (mode === 'input') {
        return 500;
      }

      let cue;
      const defaultCue = getMemoryGamePrompt(mode, reverse);

      // downex practice trials have custom audio cues
      if (taskStore().heavyInstructions && !reverse && isPractice) {
        cue = downexPracticeAudioCues[downexPracticeAudioCues.length - 1] || defaultCue;
      } else {
        cue = defaultCue;
      }

      // get the pre-assigned prompt duration values from task store
      const displayPromptDurations = taskStore().displayPromptDurations;
      const durationSec = displayPromptDurations[cue as keyof typeof displayPromptDurations];
      const durationMs = durationSec != null && Number.isFinite(durationSec) ? durationSec * 1000 : 3000;

      return durationMs;
    },
    on_load: () => {
      doOnLoad(mode, isPractice, reverse, animation, prompt);
    },
    on_finish: (data: any) => {
      PageAudioHandler.stopAndDisconnectNode();

      jsPsych.data.addDataToLastTrial({
        audioButtonPresses: PageAudioHandler.replayPresses,
      });

      if (resetSeq) {
        sequenceLength = 2;
      }

      const gridSize = taskStore().gridSize;
      const heavyInstructions = taskStore().heavyInstructions;

      // save itemUid for data analysis
      const itemUid =
        'mg_' +
        `${reverse ? 'backward_' : 'forward_'}` +
        gridSize +
        'grid_' +
        'len' +
        (customSeqLength || sequenceLength);

      if (mode === 'input') {
        jsPsych.data.addDataToLastTrial({
          correct: _isEqual(data.response, data.sequence),
          selectedCoordinates: selectedCoordinates,
          corpusTrialType: getMemoryGameType(mode, reverse, gridSize),
          responseLocation: data.response,
          itemUid: itemUid,
          audioFile: reverse ? 'memory-game-backward-prompt' : 'memory-game-input',
        });
        taskStore('isCorrect', data.correct);

        if (data.correct && !isPractice) {
          numCorrect++;

          if (numCorrect === 3 && !customSeqLength) {
            sequenceLength++;
            numCorrect = 0;
          }
        }

        if (!data.correct && !isPractice) {
          taskStore.transact('numIncorrect', (value: number) => value + 1);
          numCorrect = 0;
        }

        if (taskStore().numIncorrect === taskStore().maxIncorrect) {
          if (reverse) {
            finishExperiment();
          } else {
            sequenceLength = 2;
            // update total trials to account for skipped forward block
            taskStore('testTrialCount', 21);
          }
        }

        selectedCoordinates = [];

        const numOfBlocks = taskStore().numOfBlocks;

        if (!isPractice) {
          timeoutIDs.forEach((id) => clearTimeout(id));
          timeoutIDs = [];

          taskStore.transact('testTrialCount', (oldVal: number) => oldVal + 1);
        }
      } else {
        jsPsych.data.addDataToLastTrial({
          correct: false, // default to false for display trials. Firekit requires this field to be non null.
          audioFile: 'memory-game-display',
        });
      }
    },
  };
}

let timeoutIDs: Array<NodeJS.Timeout | number> = [];

function doOnLoad(
  mode: 'display' | 'input',
  isPractice: boolean,
  reverse: boolean,
  animation?: 'pulse' | 'cursor',
  prompt?: string,
) {
  const container = document.getElementById('jspsych-corsi-stimulus') as HTMLDivElement;
  container.id = '';
  container.classList.add('lev-corsi-override');

  const gridSize = taskStore().gridSize;

  container.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  container.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

  const t = taskStore().translations;

  if (!isPractice) {
    const toast = document.getElementById('lev-toast-default');

    // Avoid creating multiple toasts since we are adding it to the body
    // and it will not be removed from the DOM unlike jsPsych trials
    if (mode === 'input' && !toast) {
      const toast = document.createElement('div');
      toast.id = 'lev-toast-default';
      toast.classList.add('lev-toast-default');
      toast.textContent = t.generalEncourage;
      document.body.appendChild(toast);
    }
  }

  const blocks = document.getElementsByClassName('jspsych-corsi-block') as HTMLCollectionOf<HTMLDivElement>;

  let inputSequence: number[] | null;
  if (mode === 'input' && generatedSequence) {
    inputSequence = reverse ? [...generatedSequence].reverse() : generatedSequence; // Create a copy before reversing
  }

  // Track the number of blocks clicked for animation functionality
  let clickCount = 0;

  // Function to update which blocks are disabled based on current response
  const updateBlockStates = () => {
    if (!animation || mode !== 'input' || !inputSequence) {
      return;
    }

    // Determine which block should be selected next based on click count
    if (clickCount < inputSequence.length) {
      const nextBlockIndex = inputSequence[clickCount];

      setTimeout(() => {
        // Disable all blocks except the correct next one
        Array.from(blocks).forEach((element, i) => {
          if (i === nextBlockIndex) {
            // Enable the correct block
            enableBlock(element, animation);
          } else {
            // Disable incorrect blocks
            disableBlock(element);
          }
        });
      }, 1000);
    } else {
      setTimeout(() => {
        // All blocks have been selected, disable all
        Array.from(blocks).forEach((element) => {
          disableBlock(element);
        });
      }, 1000);
    }
  };

  Array.from(blocks).forEach((element, i) => {
    // Cannot just remove the id because the trial code uses that under the hood
    // so must remove css properties manually
    element.style.top = `unset`;
    element.style.left = `unset`;
    element.style.transform = `none`;
    element.style.position = `unset`;
    element.style.width = `unset`;
    element.style.height = `unset`;

    element.classList.add('lev-corsi-block-override');
    element.classList.add(mode);

    if (mode === 'input') {
      // Set up initial block states if animation is enabled
      if (animation && inputSequence && inputSequence.length > 0) {
        const firstBlockIndex = inputSequence[0];
        if (i === firstBlockIndex) {
          enableBlock(element, animation);
        } else {
          disableBlock(element);
        }
      }

      element.addEventListener('click', (event) => {
        selectedCoordinates.push([event.clientX, event.clientY]);

        if (inputSequence !== null) {
          const nextBlockIndex = inputSequence[clickCount];

          const color = isPractice && i !== nextBlockIndex ? INCORRECT_COLOR : HIGHLIGHT_COLOR;
          (event.target as HTMLDivElement).style.backgroundColor = color;

          Array.from(blocks).forEach((element, j) => {
            if (i !== j) {
              element.style.backgroundColor = '#ffffffcc';
            }
          });

          setTimeout(() => {
            (event.target as HTMLDivElement).style.backgroundColor = '#ffffffcc';
          }, 1000);
        }

        clickCount++;

        // Update click count and block states for animation
        if (animation) {
          // Update block states after a short delay to allow the click to process
          setTimeout(() => {
            updateBlockStates();
          }, 50);
        }

        if (!isPractice) {
          // Avoid stacking timeouts
          if (timeoutIDs.length) {
            timeoutIDs.forEach((id) => clearTimeout(id));
            timeoutIDs = [];
          }

          // start a timer for toast notification
          const toastTimer = setTimeout(() => {
            const toast = document.getElementById('lev-toast-default') as HTMLDivElement;
            toast.classList.add('show');
          }, 10000);

          const hideToast = setTimeout(() => {
            const toast = document.getElementById('lev-toast-default') as HTMLDivElement;
            toast.classList.remove('show');
          }, 13000);

          timeoutIDs.push(toastTimer);
          timeoutIDs.push(hideToast);
        }
      });

      if (window.Cypress && generatedSequence !== null) {
        const cypressData = {
          correctAnswer: generatedSequence,
        };

        window.cypressData = cypressData;
      }
    }
  });

  const contentWrapper = document.getElementById('jspsych-content') as HTMLDivElement;
  const corsiBlocksHTML = contentWrapper.children[1] as HTMLDivElement;
  const promptContainer = document.createElement('div');
  promptContainer.classList.add('lev-row-container', 'instruction');
  const promptElement = document.createElement('p');

  const defaultCue = getMemoryGamePrompt(mode, reverse);

  let cue;

  // downex practice trials have custom audio cues
  if (taskStore().heavyInstructions && !reverse && isPractice) {
    cue = prompt || downexPracticeAudioCues.pop() || defaultCue;
  } else {
    cue = defaultCue;
  }

  promptElement.textContent = t[cue];

  if (mode === 'display') {
    promptContainer.style.visibility = 'hidden';
  }

  promptContainer.appendChild(promptElement);
  // Inserting element at the second child position rather than
  // changing the jspsych-content styles to avoid potential issues in the future
  contentWrapper.insertBefore(promptContainer, corsiBlocksHTML);

  setUpAudio(contentWrapper, promptContainer, cue, mode);
}
