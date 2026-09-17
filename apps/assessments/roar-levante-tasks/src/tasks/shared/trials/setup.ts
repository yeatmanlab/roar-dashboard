import jsPsychHTMLMultiResponse from '@jspsych-contrib/plugin-html-multi-response';
import { getStimulus, shouldUseClowder } from '../helpers';
import { taskStore } from '../../../taskStore';
import { cat } from '../../taskSetup';

// choosing the next stimulus from the corpus occurs during the fixation trial
// prior to the actual display of the stimulus, where user response is collected
// the array allows us to use the same structure for all corpuses

const fixationTrial = (corpusType?: string, blockNum?: number) => {
  return {
    type: jsPsychHTMLMultiResponse,
    stimulus: `<div id='lev-fixation-container'><p>+</p></div>`,
    prompt: '',
    choices: 'NO_KEYS',
    trial_duration: 350,
    data: {
      task: 'fixation',
    },
    on_finish: () => {
      if (corpusType && !shouldUseClowder()) {
        if (blockNum != undefined) {
          getStimulus(corpusType, blockNum);
        } else {
          getStimulus(corpusType);
        }
      }
    },
  };
};

function assignNextBlock() {
  const thresholds: number[] = taskStore().blockThresholds;
  const nextBlockThreshold = thresholds.shift();

  let nextBlock = taskStore().currentCatBlock;
  if (nextBlockThreshold && cat.theta >= nextBlockThreshold) {
    nextBlock++;
  }

  taskStore('currentCatBlock', nextBlock);
  taskStore('blockThresholds', thresholds);
}

function selectFromCurrentCatBlock() {
  const currentCatBlock = taskStore().currentCatBlock;
  getStimulus('stimulus', currentCatBlock);
}

function selectFromStoryGroup() {
  const currentStoryGroup = taskStore().currentStoryGroup;

  getStimulus('stimulus', undefined, currentStoryGroup, true);
}

export const setupPractice = fixationTrial('practice');
export const setupStimulus = fixationTrial('stimulus');
export const setupStimulusFromStoryGroup = { ...fixationTrial(), on_finish: selectFromStoryGroup, stimulus: '' };
export const setupDownex = fixationTrial('downex');
export const setupStimulusFromBlock = (blockNum: number) => fixationTrial('stimulus', blockNum);
export const setupStimulusFromCurrentCatBlock = {
  ...fixationTrial(),
  on_finish: selectFromCurrentCatBlock,
  stimulus: '',
};
export const fixationOnly = fixationTrial();
export const setupNextBlock = { ...fixationTrial(), on_finish: assignNextBlock, stimulus: '' };
