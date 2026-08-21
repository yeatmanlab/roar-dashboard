import { taskStore } from '../../../taskStore';

export function prepareTomCorpus(blockList: StimulusType[][]) {
  if (!(taskStore().version === 2)) {
    return null;
  }

  const taskIntro = blockList.flat().find((trial: StimulusType) => trial.itemId === 'ToM-intro');
  const blockTransition = blockList.flat().find((trial: StimulusType) => trial.itemId === 'ToM-transition');

  blockList.forEach((block: StimulusType[], index: number) => {
    blockList[index] = block.filter(
      (trial: StimulusType) => trial.itemId !== 'ToM-intro' && trial.itemId !== 'ToM-transition',
    );
  });

  const sequentialTrials: StimulusType[] = [];
  const newCorpus: StimulusType[] = [];

  blockList.forEach((block: StimulusType[]) => {
    const firstTrial = block[0];
    const remainingTrials = block.slice(1);

    newCorpus.push(firstTrial);
    sequentialTrials.push(...remainingTrials);
  });

  taskStore('sequentialTrials', sequentialTrials);
  taskStore('corpora', { stimulus: newCorpus });

  return {
    taskIntro: taskIntro,
    blockTransition: blockTransition,
  };
}

export function prepareStoryGroups(corpus: StimulusType[]) {
  if (!(taskStore().version === 2)) {
    return;
  }

  const storyGroups: StimulusType[][] = [];

  for (let i = 0; i < taskStore().numberOfStories; i++) {
    storyGroups.push([]);
  }

  corpus.forEach((trial: StimulusType) => {
    if (trial.storyGroup !== undefined) {
      storyGroups[trial.storyGroup].push(trial);
    } else {
      storyGroups[0].push(trial);
    }
  });

  return storyGroups;
}
