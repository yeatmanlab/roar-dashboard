import _shuffle from 'lodash/shuffle';
import { taskStore } from '../../../taskStore';
import { cat } from '../../taskSetup';
import { jsPsych } from '../../taskSetup';

// separates trials from corpus into blocks depending on for heavy/light instructions and CAT
export function prepareCorpus(
  corpus: StimulusType[],
  randomStartBlock = true,
  downexCorpus?: StimulusType[],
  fillInSdsDifficulty: boolean = false,
) {
  const excludedTrialTypes = ['3D', 'polygon'];
  // limit random starting items so that their difficulty is less than 0
  const maxTrialDifficulty = 0;
  const cat: boolean = taskStore().runCat;
  let corpora;

  let heavyInstructionPracticeTrials: StimulusType[] = [];
  let downexTestTrials: StimulusType[] = [];

  if (downexCorpus) {
    heavyInstructionPracticeTrials = downexCorpus.filter(
      (trial) => trial.trialType === 'instructions' || trial.assessmentStage === 'practice_response',
    );
    downexTestTrials = downexCorpus.filter((trial) => !heavyInstructionPracticeTrials.includes(trial));
  }

  const lightInstructionPracticeTrials: StimulusType[] = corpus.filter(
    (trial) => trial.trialType === 'instructions' || trial.assessmentStage === 'practice_response',
  );
  const testTrials: StimulusType[] = corpus.filter((trial) => !lightInstructionPracticeTrials.includes(trial));

  const corpusParts = {
    ipHeavy: heavyInstructionPracticeTrials,
    ipLight: lightInstructionPracticeTrials,
    test: testTrials,
    downexTest: downexTestTrials,
  };

  // something same 1 trials inherit difficulty from the corresponding something same 2 trial
  if (fillInSdsDifficulty) {
    corpusParts.test.forEach((trial, index) => {
      if (trial.trialType === 'something-same-1') {
        const nextTrial = corpusParts.test[index + 1];
        if (nextTrial.trialType === 'something-same-2') {
          trial.difficulty = nextTrial.difficulty;
        }
      }
    });
  }

  // separate out normed/unnormed trials
  const unnormedTrials: StimulusType[] = corpusParts.test.filter(
    (trial) => trial.difficulty == null || isNaN(Number(trial.difficulty)),
  );
  const normedTrials: StimulusType[] = corpusParts.test.filter((trial) => !unnormedTrials.includes(trial));

  // determine start items
  const possibleStartItems: StimulusType[] = normedTrials.filter(
    (trial) =>
      !excludedTrialTypes.includes(trial.trialType) &&
      ((taskStore().task == 'egma-math' && trial.block_index === 0) || taskStore().task !== 'egma-math') &&
      Number(trial.difficulty) <= maxTrialDifficulty,
  );
  const startItems: StimulusType[] = selectNItems(possibleStartItems, 5);

  // put cat portion of corpus into taskStore
  const catCorpus: StimulusType[] = randomStartBlock
    ? normedTrials.filter((trial) => !startItems.includes(trial))
    : normedTrials;

  const downexUnnormedTrials: StimulusType[] = downexTestTrials.filter(
    (trial) => trial.difficulty == null || isNaN(Number(trial.difficulty)),
  );

  const downexCatCorpus: StimulusType[] = downexTestTrials.filter((trial) => !downexUnnormedTrials.includes(trial));

  corpora = {
    ipHeavy: corpusParts.ipHeavy, // downex instruction/practice trials
    ipLight: corpusParts.ipLight, // older kid instruction/practice
    start: startItems, // 5 random items to be used in starting block (all under a certain max difficulty)
    unnormed: unnormedTrials, // all items without IRT parameters
    downexUnnormed: downexUnnormedTrials,
    cat: catCorpus, // all normed items for CAT
    downexCat: downexCatCorpus,
  };

  if (cat) {
    // if cat is running, put only normed trials into taskStore
    const newCorpora = {
      downex: downexTestTrials,
      stimulus: catCorpus,
    };
    taskStore('corpora', newCorpora);
  } else {
    // if cat is not running, put entire test portion of corpus into taskStore but leave out instruction/practice
    const newCorpora = {
      practice: downexTestTrials,
      stimulus: corpusParts.test,
    };
    taskStore('corpora', newCorpora);
  }

  return corpora;
}

export function selectNItems(corpus: StimulusType[], n: number) {
  const finalTrials: StimulusType[] = [];

  // randomize order of items
  const shuffledTrials = _shuffle(corpus);

  // get the last n items
  for (let i = n; i > 0; i--) {
    const trial = shuffledTrials.pop();

    if (trial !== undefined) {
      finalTrials.push(trial);
    }
  }
  return finalTrials;
}

// separates cat corpus into blocks
export function prepareMultiBlockCat(corpus: StimulusType[], sequentialBlocks = true) {
  const blockList: StimulusType[][] = []; // a list of blocks, each containing trials

  if (sequentialBlocks) {
    // sort by block index before batching
    corpus.sort((a, b) => {
      return Number(a.block_index) - Number(b.block_index);
    });
  }

  let currBlock = -1; // start at -1 so it is guaranteed to be less than first block

  corpus.forEach((trial: StimulusType) => {
    const prevBlock = currBlock;
    currBlock = Number(trial.block_index);

    if (currBlock != undefined) {
      if (currBlock !== prevBlock) {
        blockList.push([trial]);
      } else {
        blockList[blockList.length - 1].push(trial);
      }
    }
  });

  return blockList;
}

export function updateTheta(item: StimulusType, correct: boolean) {
  const runCat = taskStore().runCat;
  if (runCat) {
    // update theta for CAT
    const zeta = {
      a: 1, // item discrimination (default value of 1)
      b: item.difficulty, // item difficulty (from corpus)
      c: item.chanceLevel, // probability of correct answer from guessing
      d: 1, // max probability of correct response (default 1)
    };

    if (!Number.isNaN(zeta.b) && zeta.b !== null && item.assessmentStage !== 'practice_response') {
      const answer = correct ? 1 : 0;
      cat.updateAbilityEstimate(zeta, answer);
    }
  }

  jsPsych.data.addDataToLastTrial({
    thetaEstimate: cat.theta,
  });
}
