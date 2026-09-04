import { taskStore } from '../../../taskStore';

export function setupSds(corpus: StimulusType[]) {
  // these trials are run sequentially (not selected in a CAT) - every trial in a group except the first one
  const sequentialTrials: StimulusType[] = [];
  const sequentialTrialTypes: string[] = ['second_response', 'third_response', 'fourth_response'];
  const newCorpus: StimulusType[] = [];

  corpus.forEach((trial) => {
    if (trial.trialType === 'something-same-2' || sequentialTrialTypes.includes(trial.assessmentStage)) {
      sequentialTrials.push(trial);
    } else if (trial.trialType === 'test-dimensions') {
      trial.difficulty = NaN;
      newCorpus.push(trial);
    } else {
      newCorpus.push(trial);
    }
  });

  taskStore('sequentialTrials', sequentialTrials);
  return newCorpus;
}
