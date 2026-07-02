import store from 'store2';
import { taskStore } from '../../../taskStore';
import { getStimulus } from './getStimulus';

function skipBlock() {
  const skipBlockTrialType = store.page.get('skipCurrentBlock');
  taskStore('trialsSkipped', 0);
  while (taskStore().nextStimulus.trialType === skipBlockTrialType) {
    // do not call getStimulus if there are no remaining stimuli
    if (taskStore().corpora.stimulus.length === 0) {
      break;
    }

    getStimulus('stimulus');

    const trialsSkipped = taskStore().trialsSkipped;
    taskStore('trialsSkipped', trialsSkipped + 1);
  }
}

export const setSkipCurrentBlock = (skipTrialType: string) => {
  if (!!store.page.get('failedPrimaryTrials') && taskStore().numIncorrect >= 1 && !taskStore().heavyInstructions) {
    taskStore('numIncorrect', 0);
    store.page.set('skipCurrentBlock', skipTrialType);
    skipBlock();
  } else if (taskStore().numIncorrect >= taskStore().maxIncorrect) {
    taskStore('numIncorrect', 0);
    store.page.set('skipCurrentBlock', skipTrialType);
    store.page.set('failedPrimaryTrials', true);
    skipBlock();
  }
};
