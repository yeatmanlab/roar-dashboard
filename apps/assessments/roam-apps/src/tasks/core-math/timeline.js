/*
Defines and orders the full timeline.
*/

import 'regenerator-runtime/runtime'; //async function
// setup
import { initTrialSaving, initTimeline } from '../shared/helpers';
import { jsPsych } from '../taskSetup'; //initialised jspsych object
//import { preloadTrials } from "./helperFunctions"; //jspsych object for preloading media, function for initialising Cat class
import { intro } from './trials/introduction';
import { endScreen } from './trials/endScreen';
import { instructions } from './trials/preGameInstructions';
import { ValidityEvaluator, createEvaluateValidity } from '@bdelab/roar-utils'; // for validity
import { exitFullscreen } from '../shared/trials'; //jspsych object for exiting full screen
import { getTrial } from './trials/getTrial';
import { preloadTrials } from '../..';
import { initBlock } from './trials/trialHelpers';
import { ifBonusBlock } from './trials/getBonus';
import store from 'store2';
import { navigationInstruction } from '../shared/trials/navigation';
import { Cat } from '@bdelab/jscat';
import { numberLineOuterLoop } from '../magpi/trials/numberLineBlock';
import { transitionScreen } from '../magpi/trials/numberLineInstruction';
 
export let validityEvaluator;
 
export let catIRT;

//calls the initializatin functions, builds the timeline
export default function buildTimeline(config) {
  // initialising session data, writing data to firestore, event listener for errors
  initTrialSaving(config);

  // enter full screen, get user data (consent, survey, lab id, pid)
  const initialTimeline = initTimeline(config);

  // initialise CAT for the grade estimate
  /*catGrade = new Cat({
    method: "MLE",
    minTheta: -1,
    maxTheta: 11,
  });*/

  // initialise CAT for the theta score
  let hyperParams = store.session.get('hyperParams');

  catIRT = new Cat({
    method: 'EAP',
    minTheta: hyperParams['min'],
    maxTheta: hyperParams['max'],
    priorDist: hyperParams['distribution'],
    priorPar: [hyperParams['mean'], hyperParams['sd']],
  });

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
  timeline.push(navigationInstruction);

  // add introduction screen
  timeline.push(intro);

  // add instructions screen
  timeline.push(instructions);

  //timeline.push(mainLoop("stimulus", "test_response"));

  let itemType = store.session.get('corpusAll')['itemType'];
  let corpus = store.session.get('corpusAll')['stimulus'];

  //Add main trials based on item type
  for (let i = 0; i < itemType.length; i++) {
    //initialise corpus
    timeline.push(initBlock('stimulus', i));
    for (let j = 0; j < itemType[i].length; j++) {
      timeline.push(getTrial('stimulus', corpus[i][j]['assessment_stage'], itemType[i][j]));
    }
  }

  //Add bonus problems block
  timeline.push(ifBonusBlock('stimulus'));

  if (store.session.get('magpiPilot')) {
    timeline.push(transitionScreen);
    timeline.push(numberLineOuterLoop('numberLine', 'test_response'));
  }

  timeline.push(endScreen); // End Task
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
