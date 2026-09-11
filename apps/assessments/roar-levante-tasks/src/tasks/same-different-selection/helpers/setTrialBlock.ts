import { taskStore } from '../../../taskStore';

function compareTrialTypes(trialType1: string, trialType2: string) {
  return (
    trialType1 === trialType2 ||
    (trialType1.includes('match') && trialType2.includes('match')) ||
    (trialType1.includes('something-same') && trialType2.includes('something-same'))
  );
}

function getBlockOperations(trialType: string) {
  if (trialType.includes('match')) {
    return 'updateMatching';
  } else if (trialType.includes('something-same')) {
    return 'updateSomethingSame';
  } else {
    return 'updateTestDimensions';
  }
}

export function setTrialBlock(cat: boolean) {
  // create list of numbers of trials per block
  const blockCountList: number[] = [];
  const blockOperations: string[] = [];
  let currentTrialType = 'test-dimensions';
  let currentBlockCount = 0;

  if (cat) {
    taskStore().corpora.stimulus.forEach((block: StimulusType[]) => {
      blockCountList.push(block.length);
    });
  } else {
    taskStore().corpora.stimulus.forEach((trial: StimulusType) => {
      if (!compareTrialTypes(trial.trialType, currentTrialType) && trial.trialType !== 'instructions') {
        blockCountList.push(currentBlockCount);
        blockOperations.push(getBlockOperations(currentTrialType));

        currentTrialType = trial.trialType;
        currentBlockCount = 0;
      }

      currentBlockCount++;
    });

    blockCountList.push(currentBlockCount);
    blockOperations.push(getBlockOperations(currentTrialType));
  }

  return { blockCountList, blockOperations };
}
