import 'regenerator-runtime/runtime'; //async function
// setup
import { initTrialSaving, initTimeline } from '../shared/helpers';
import { jsPsych } from '../taskSetup'; //initialised jspsych object
import { ValidityEvaluator, createEvaluateValidity } from '@bdelab/roar-utils'; // for validity
import { exitFullscreen } from '../shared/trials'; //jspsych object for exiting full screen
import { preloadTrials } from '../..';
import { navigationInstruction } from '../shared/trials/navigation';
import { symCompBlock } from './trials/symCompBlock'; // Import the number comparison block
import { numberLineOuterLoop } from './trials/numberLineBlock';
import store from 'store2';

// eslint-disable-next-line import/no-mutable-exports
export let validityEvaluator;
// eslint-disable-next-line import/no-mutable-exports

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
    if (config.firekit.run.started) {
      return config.firekit.updateEngagementFlags(flags, reliable);
    }
    return null;
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

  timeline.push(symCompBlock('symbolicComp', 'test_response'));

  timeline.push(numberLineOuterLoop('numberLine', 'test_response'));

  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
