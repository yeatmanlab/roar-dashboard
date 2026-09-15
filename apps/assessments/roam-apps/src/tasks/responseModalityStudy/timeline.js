/*
Defines and orders the full timeline.
*/

import 'regenerator-runtime/runtime'; //async function
import store from 'store2'; //storing session data
// setup
import { initTrialSaving, initTimeline } from '../shared/helpers';
import { jsPsych } from '../taskSetup'; //initialised jspsych object
import { preloadTrials } from '../..';
import { responseTimeBlock } from './trials/responseTimeBlock';
import { intro } from './trials/introduction';
import { instructions } from './trials/instructions';
import { endScreen } from './trials/endScreen';
import { exitFullscreen } from '../shared/trials';
import { navigationInstruction } from '../shared/trials/navigation';

//calls the initializatin functions, builds the timeline
export default function buildResponseModalityTimeline(config) {
  // jspsych object for preloading media assets into the browser
  //const preloadTrials = createPreloadTrials(mediaAssets).default;

  // initialising session data, writing data to firestore, event listener for errors
  initTrialSaving(config);

  // enter full screen, get user data (consent, survey, lab id, pid)
  const initialTimeline = initTimeline(config);

  //preload media, enter full screen and get user data
  const timeline = [preloadTrials];
  timeline.push(initialTimeline);
  timeline.push(navigationInstruction);
  timeline.push(intro);
  timeline.push(instructions);

  // add the response time block, randomise the order of 2afc, 6afc, and production.
  let blockOrder = store.session.get('blockOrder').stimulus;
  for (let i = 0; i < blockOrder.length; i++) {
    timeline.push(responseTimeBlock('stimulus', blockOrder[i], i, 'test'));
  }

  timeline.push(endScreen); // End Task
  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
