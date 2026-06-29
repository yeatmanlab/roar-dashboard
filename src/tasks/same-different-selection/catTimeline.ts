import { taskStore } from '../../taskStore';
import { setupSds } from './helpers/prepareSdsCorpus';
import {
  createPreloadTrials,
  initTimeline,
  initTrialSaving,
  prepareCorpus,
  prepareMultiBlockCat,
} from '../shared/helpers';
import { stimulus } from './trials/stimulus';
import { afcMatch } from './trials/afcMatch';
import {
  enterFullscreen,
  exitFullscreen,
  feedback,
  fixationOnly,
  getAudioResponse,
  setupStimulusFromBlock,
  taskFinished,
} from '../shared/trials';
import { setTrialBlock } from './helpers/setTrialBlock';
import { initializeCat, jsPsych } from '../taskSetup';
import { legacyStimulus } from './trials/legacyStimulus';

export default function buildSameDifferentTimelineCat(config: Record<string, any>, mediaAssets: MediaAssetsType) {
  const preloadTrials = createPreloadTrials(mediaAssets).default;
  const heavy: boolean = taskStore().heavyInstructions;

  const corpus: StimulusType[] = taskStore().corpora.stimulus;
  const preparedCorpus = prepareCorpus(corpus, false, undefined, true);

  const catCorpus = setupSds(taskStore().corpora.stimulus);
  const allBlocks = prepareMultiBlockCat(catCorpus);

  const newCorpora = {
    downex: taskStore().corpora.downex,
    stimulus: allBlocks,
  };
  taskStore('corpora', newCorpora); // puts all blocks into taskStore

  initTrialSaving(config);
  const initialTimeline = initTimeline(config, enterFullscreen);

  const buttonNoise = {
    timeline: [getAudioResponse(mediaAssets)],

    conditional_function: () => {
      const trialType = taskStore().nextStimulus.trialType;
      const assessmentStage = taskStore().nextStimulus.assessmentStage;

      if (
        (trialType === 'something-same-2' || trialType.includes('match')) &&
        assessmentStage !== 'practice_response'
      ) {
        return true;
      }
      return false;
    },
  };

  // used for instruction and practice trials
  const ipBlock = (trial: StimulusType) => {
    let trialGenerator;
    if (trial.trialType.includes('match')) {
      trialGenerator = afcMatch;
    } else if (taskStore().version === 2) {
      trialGenerator = stimulus;
    } else {
      trialGenerator = legacyStimulus;
    }

    const practice = trial.assessmentStage === 'practice_response';
    const timeline =
      practice && !trial.trialType.includes('something-same-1')
        ? [{ ...fixationOnly, stimulus: '' }, trialGenerator(trial), feedbackBlock]
        : [{ ...fixationOnly, stimulus: '' }, trialGenerator(trial)];

    return {
      timeline: timeline,
    };
  };

  const feedbackBlock = {
    timeline: [feedback(true, 'feedbackCorrect', 'feedbackNotQuiteRight')],
    conditional_function: () => {
      return taskStore().version === 2;
    },
  };

  // returns timeline object containing the appropriate trials - only runs if they match what is in taskStore
  function runCatTrials(trialNum: number, trialType: 'stimulus' | 'afc') {
    const timeline = [];
    for (let i = 0; i < trialNum; i++) {
      if (trialType === 'stimulus') {
        timeline.push(taskStore().version === 2 ? stimulus() : legacyStimulus());
        timeline.push(buttonNoise);
      } else {
        timeline.push(afcMatch());
        timeline.push(buttonNoise);
      }
    }

    return {
      timeline: timeline,
      conditional_function: () => {
        const stimulus = taskStore().nextStimulus;

        if (trialType === 'stimulus') {
          return (
            (stimulus.trialType === 'test-dimensions' && trialNum === 1) ||
            (stimulus.trialType.includes('something-same') && trialNum === 2)
          );
        } else {
          return stimulus.trialType === trialNum + '-match';
        }
      },
    };
  }

  const timeline = [preloadTrials, initialTimeline];

  // all instructions + practice trials
  let instructionPractice: StimulusType[] = preparedCorpus.ipLight;

  let fiveBlockIntroTrial: StimulusType;
  let fiveBlockIntro: any;
  if (taskStore().version === 2) {
    // separate this out so that it is inserted at the right place in the timeline
    fiveBlockIntroTrial = instructionPractice.find((trial) => trial.itemId === 'sds-instruct5') as StimulusType;
    instructionPractice = instructionPractice.filter((trial) => trial.itemId !== 'sds-instruct5');

    fiveBlockIntro = {
      timeline: [ipBlock(fiveBlockIntroTrial)],
      conditional_function: () => {
        return taskStore().nextStimulus.trialType === '4-match';
      },
    };
  }

  // returns practice + instruction trials for a given block
  function getPracticeInstructions(blockNum: number): StimulusType[] {
    return instructionPractice.filter((trial) => {
      if (Number.isNaN(trial.block_index)) return;

      return trial.block_index === blockNum;
    });
  }

  // create list of numbers of trials per block
  const blockCountList = setTrialBlock(true).blockCountList;

  const totalRealTrials = blockCountList.reduce((acc, total) => acc + total, 0);
  taskStore('totalTestTrials', totalRealTrials);

  blockCountList.forEach((count, index) => {
    const currentBlockInstructionPractice = getPracticeInstructions(index);

    currentBlockInstructionPractice.forEach((trial) => {
      timeline.push(ipBlock(trial));
    });

    // only younger kids get something-same blocks
    if (!heavy && index === 1 && taskStore().version === 2) {
      return;
    }

    const numOfTrials = index === 0 ? count : count / 2; // change this based on simulation results?
    for (let i = 0; i < numOfTrials; i++) {
      timeline.push({ ...setupStimulusFromBlock(index), stimulus: '' });

      if (index === 0) {
        timeline.push(runCatTrials(1, 'stimulus'));
      }
      if (index === 1) {
        timeline.push(runCatTrials(2, 'stimulus'));
      }
      if (index === 2) {
        if (taskStore().version === 2) {
          timeline.push(fiveBlockIntro);
        }
        timeline.push(runCatTrials(2, 'afc'));
        timeline.push(runCatTrials(3, 'afc'));
        timeline.push(runCatTrials(4, 'afc'));
      }
    }
  });

  initializeCat();

  timeline.push(taskFinished());
  timeline.push(exitFullscreen);
  return { jsPsych, timeline };
}
