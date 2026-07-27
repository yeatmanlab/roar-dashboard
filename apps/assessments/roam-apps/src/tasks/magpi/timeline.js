import 'regenerator-runtime/runtime'; //async function
// setup
import { initTrialSaving, initTimeline } from '../shared/helpers';
import { jsPsych } from '../taskSetup'; //initialised jspsych object
import { updateEngagementFlags } from '@roar-platform/assessment-sdk/compat/firekit';
import { ValidityEvaluator, createEvaluateValidity } from '@bdelab/roar-utils'; // for validity
import { exitFullscreen } from '../shared/trials'; //jspsych object for exiting full screen
import { preloadTrials } from '../..';
import { symCompBlock } from './trials/symCompBlock'; // Import the number comparison block
import { numberLineOuterLoop } from './trials/numberLineBlock';

export let validityEvaluator;

//calls the initializatioon functions, builds the timeline
export default function buildTimeline(config) {
  // initialising session data, writing data to firestore, event listener for errors
  initTrialSaving(config);

  // enter full screen, get user data (consent, survey, lab id, pid)
  const initialTimeline = initTimeline(config);

  //come back and decide what threshold should be
  const evaluateValidity = createEvaluateValidity({
    responseTimeLowThreshold: 250,
    accuracyThreshold: 0.6,
    minResponsesRequired: 3,
    includedReliabilityFlags: ['responseTimeTooFast'],
  });

  const handleEngagementFlags = (flags, reliable) => {
    return updateEngagementFlags(flags, reliable);
  };

  validityEvaluator = new ValidityEvaluator({
    evaluateValidity: evaluateValidity,
    handleEngagementFlags: handleEngagementFlags,
  });

  //preload media, enter full screen and get user data
  const timeline = [preloadTrials];
  timeline.push(initialTimeline);

  // navigation instruction
  //timeline.push(navigationInstruction);

  timeline.push(symCompBlock('symbolicComp', 'test'));

  timeline.push(numberLineOuterLoop('numberLine', 'test'));

  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
