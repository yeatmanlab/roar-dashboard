import {
  initTimeline,
  initTrialSaving,
  createPreloadTrials,
  checkFallbackCriteria,
  PageAudioHandler,
} from '../shared/helpers';
// setup
import { jsPsych } from '../taskSetup';
import { initializeCat } from '../taskSetup';
// trials
import {
  enterFullscreen,
  exitFullscreen,
  feedback,
  repeatInstructionsMessage,
  taskFinished,
  ifNotFullscreen,
} from '../shared/trials';
import { getCorsiBlocks } from './trials/stimulus';
import {
  readyToPlay,
  reverseOrderPrompt,
  reverseOrderInstructions,
  defaultInstructions,
  downexInstructions,
} from './trials/instructions';
import { taskStore } from '../../taskStore';
import { mediaAssets } from '../..';

const generatePracticeTrialTimeline = (reverse: boolean, tryAgainText: string, repetitions: number) => {
  const basicBlock = [
    getCorsiBlocks({ mode: 'display', isPractice: true, reverse }),
    getCorsiBlocks({ mode: 'input', isPractice: true, reverse }),
    feedback(true, 'feedbackCorrect', tryAgainText, true),
  ];

  const finalTimeline = [];
  for (let i = 0; i < repetitions; i += 1) {
    finalTimeline.push(...basicBlock);
  }
  return finalTimeline;
};

const getSecondRoundPracticeTrials = (reverse: boolean, tryAgainText: string) => {
  return {
    timeline: [
      ...generatePracticeTrialTimeline(reverse, tryAgainText, 2),
      getCorsiBlocks({ mode: 'display', isPractice: true, reverse }),
      getCorsiBlocks({ mode: 'input', isPractice: true, reverse }),
      {
        timeline: [feedback(true, 'feedbackCorrect', tryAgainText, true)],
        conditional_function: () => {
          return taskStore().isCorrect;
        },
      },
    ],
    conditional_function: () => {
      return !taskStore().isCorrect;
    },
  };
};

export default function buildMemoryTimeline(config: Record<string, any>) {
  const { heavyInstructions } = taskStore();

  initTrialSaving(config);
  const preloadTrials = createPreloadTrials(mediaAssets).default;
  const initialTimeline = initTimeline(config, enterFullscreen);

  const corsiBlocksPractice = {
    timeline: [...generatePracticeTrialTimeline(false, 'memoryGameForwardTryAgain', 3)],
  };

  const corsiBlocksPracticeReverse = {
    timeline: [...generatePracticeTrialTimeline(true, 'memoryGameBackwardTryAgain', 3)],
  };

  const forwardTrial = () => {
    return {
      timeline: [getCorsiBlocks({ mode: 'display' }), getCorsiBlocks({ mode: 'input' })],
      conditional_function: () => {
        return taskStore().numIncorrect < taskStore().maxIncorrect;
      },
    };
  };

  const corsiBlocksStimulus = {
    timeline: [forwardTrial()],
    repetitions: 16,
  };

  // last forward trial by itself in order to reset sequence length back to 2 for backward phase
  const forwardTrialResetSeq = {
    timeline: [getCorsiBlocks({ mode: 'display' }), getCorsiBlocks({ mode: 'input', resetSeq: true })],
    conditional_function: () => {
      const result = taskStore().numIncorrect < taskStore().maxIncorrect;

      taskStore('numIncorrect', 0); // reset to 0 here so that reverse block isn't skipped

      return result;
    },
  };

  const corsiBlocksReverse = {
    timeline: [getCorsiBlocks({ mode: 'display', reverse: true }), getCorsiBlocks({ mode: 'input', reverse: true })],
    repetitions: 21,
  };

  const totalRealTrials = corsiBlocksStimulus.repetitions + corsiBlocksReverse.repetitions;
  taskStore('totalTestTrials', totalRealTrials);

  const downexFeedbackCorrect = {
    timeline: [feedback(true, 'feedbackCorrect', 'memoryGameForwardTryAgain', true)],
    conditional_function: () => {
      return taskStore().isCorrect;
    },
  };

  const downexFeedbackIncorrect = (reverse: boolean, prompt: string) => {
    return {
      timeline: [getCorsiBlocks({ reverse, mode: 'input', isPractice: true, animation: 'pulse', prompt })],
      conditional_function: () => {
        return !taskStore().isCorrect;
      },
    };
  };

  const downexPracticeTrial = (reverse: boolean, seqlength: number, animation?: 'pulse' | 'cursor') => {
    return {
      timeline: [
        getCorsiBlocks({ reverse, mode: 'display', isPractice: true, customSeqLength: seqlength }),
        getCorsiBlocks({ reverse, mode: 'input', isPractice: true, animation }),
        downexFeedbackCorrect,
        downexFeedbackIncorrect(reverse, reverse ? 'memoryGameInstruct11Downex' : 'memoryGameFeedbackIncorrectDownex'),
      ],
    };
  };

  const downexInstructionsTimeline = {
    timeline: [
      downexInstructions[0],
      downexPracticeTrial(false, 1, 'cursor'),
      downexPracticeTrial(false, 1),
      downexInstructions[1],
      downexPracticeTrial(false, 2, 'cursor'),
      downexPracticeTrial(false, 2),
      downexPracticeTrial(false, 2),
      downexInstructions[2],
      downexInstructions[3],
      downexInstructions[4],
    ],
  };

  let fellBack = false;
  const fallbackBlock = {
    timeline: [repeatInstructionsMessage, ...downexInstructionsTimeline.timeline.slice(1)],
    conditional_function: () => {
      const run = checkFallbackCriteria(true) && !fellBack;
      if (run) {
        fellBack = true;
        taskStore('heavyInstructions', true);
        taskStore('gridSize', 2);
        taskStore('numOfBlocks', 4);
        taskStore('blockSize', 50);
      }

      return run;
    },
  };

  const firstFourTestTrials = {
    timeline: [forwardTrial(), fallbackBlock],
    repetitions: 4,
  };

  const downexCorsiBlocksPracticeReverse = {
    timeline: [downexPracticeTrial(true, 2, 'cursor'), downexPracticeTrial(true, 2), downexPracticeTrial(true, 2)],
  };

  const defaultCorsiBlocksPracticeReverse = {
    timeline: [
      reverseOrderPrompt,
      corsiBlocksPracticeReverse,
      getSecondRoundPracticeTrials(true, 'memoryGameBackwardTryAgain'),
    ],
  };

  const defaultInstructionsTimeline = {
    timeline: [
      ...defaultInstructions,
      corsiBlocksPractice,
      getSecondRoundPracticeTrials(false, 'memoryGameForwardTryAgain'),
      readyToPlay,
    ],
  };

  const timeline: any[] = [
    preloadTrials,
    initialTimeline,
    heavyInstructions ? downexInstructionsTimeline : defaultInstructionsTimeline,
    ifNotFullscreen,
    firstFourTestTrials, // check for fallback criteria during first 4 trials
    ifNotFullscreen,
    corsiBlocksStimulus,
    forwardTrialResetSeq,
    reverseOrderInstructions,
    ifNotFullscreen,
    heavyInstructions ? downexCorsiBlocksPracticeReverse : defaultCorsiBlocksPracticeReverse,
    readyToPlay,
    ifNotFullscreen,
    corsiBlocksReverse,
    taskFinished(),
  ];

  /**
   * Old timeline
   * const timeline: any[] = [
      preloadTrials,
      initialTimeline,
      ...instructions,
      ifNotFullscreen,
      corsiBlocksPractice,
      getSecondRoundPracticeTrials(false, 'memoryGameForwardTryAgain'),
      readyToPlay,
      ifNotFullscreen,
      corsiBlocksStimulus,
      forwardTrialResetSeq,
      reverseOrderInstructions,
      reverseOrderPrompt,
      ifNotFullscreen,
      corsiBlocksPracticeReverse,
      getSecondRoundPracticeTrials(true, 'memoryGameBackwardTryAgain'),
      readyToPlay,
      ifNotFullscreen,
      corsiBlocksReverse,
      taskFinished(),
    ];
   */

  initializeCat();

  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
