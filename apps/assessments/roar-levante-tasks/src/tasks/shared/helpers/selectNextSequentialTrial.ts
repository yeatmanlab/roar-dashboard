import { taskStore } from '../../../taskStore';

// selects the next trial in a block of sequential trials
export function selectNextSequentialTrial(nextTrials: StimulusType[]): void {
  if (nextTrials.length === 0) {
    // increment the current story for ToM if we've reached the end of the block
    if (taskStore().task === 'theory-of-mind') {
      taskStore('currentStoryGroup', taskStore().currentStoryGroup + 1);
    }

    return;
  }

  const allSequentialTrials = taskStore().sequentialTrials;

  const nextStim = nextTrials[0];
  taskStore('nextStimulus', nextStim);
  const newSequentialTrials = allSequentialTrials.filter((trial: StimulusType) => trial.itemId !== nextStim.itemId);
  taskStore('sequentialTrials', newSequentialTrials);
}
