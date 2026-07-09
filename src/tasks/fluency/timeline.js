/*
Defines and orders the full timeline.
*/

import "regenerator-runtime/runtime"; //async function
import store from "store2"; //storing session data
// setup
import { initTrialSaving, initTimeline } from "../shared/helpers";
import { jsPsych } from "../taskSetup"; //initialised jspsych object
//import { preloadTrials } from "./helperFunctions"; //jspsych object for preloading media, function for initialising Cat class
import {
  intro,
  postPracticeReminder,
  preMainIntro,
  postRTControl,
} from "./trials/introduction";
import { ValidityEvaluator, createEvaluateValidity } from "@bdelab/roar-utils"; // for validity
import { exitFullscreen } from "../shared/trials"; //jspsych object for exiting full screen
import { numberMainOuterLoop } from "./trials/runCorpusTimeline";
import { runPractice } from "./trials/practiceBlock";
import { instructions, rtControlKeyboardPractice } from "./trials/instructions";
import { preloadTrials } from "../..";
import { navigationInstruction } from "../shared/trials/navigation";
import { endScreen } from "./trials/gameBreak";
//import { groupMapping } from "../taskSetup";
import { isMobile } from "./helpers";
import { responseTimeBlock } from "../responseModalityStudy/trials/responseTimeBlock";
import { practice } from "../responseModalityStudy/trials/practice";
import { reInitStore } from "./trials/trialDefinitions";
import {
  magpiPilotTimeline,
  introARF,
} from "../magpi/trials/symCompInstructions";
// eslint-disable-next-line import/no-mutable-exports
export let validityEvaluator;

//calls the initializatin functions, builds the timeline
export default function buildFluencyTimeline(config) {
  // jspsych object for preloading media assets into the browser
  //const preloadTrials = createPreloadTrials(mediaAssets).default;

  // initialising session data, writing data to firestore, event listener for errors
  initTrialSaving(config);

  // enter full screen, get user data (consent, survey, lab id, pid)
  const initialTimeline = initTimeline(config);

  const evaluateValidity = createEvaluateValidity({
    responseTimeLowThreshold: 500,
    accuracyThreshold: 0.6,
    minResponsesRequired: 3,
    includedReliabilityFlags: ["responseTimeTooFast"],
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

  //navigation instruction, only for afc and not response modality study
  if (
    (config.responseMode.includes("afc") &&
      !store.session.get("responseModality")) ||
    isMobile ||
    store.session.get("responseModality")
  ) {
    timeline.push(navigationInstruction);
  }
  if (store.session.get("responseModality")) {
    let taskOrder = store.session.get("taskOrder");

    timeline.push(intro(taskOrder[0]));

    //if ARF then run the rt control first
    if (config.taskName === "fluency-arf") {
      let blockOrder = store.session.get("blockOrderRT");
      for (let i = 0; i < blockOrder.length; i++) {
        if (blockOrder[i] === "rtControl_production") {
          timeline.push(rtControlKeyboardPractice());
        }
        timeline.push(practice(blockOrder[i], i));
        timeline.push(
          responseTimeBlock("stimulus", blockOrder[i], i, "test_response"),
        );
      }
      timeline.push(postRTControl(taskOrder[0]));
      //increment task index and reset progress bar
      timeline.push(reInitStore());
    }
    //run the 2 blocks
    for (let i = 0; i < taskOrder.length; i++) {
      //instructions
      timeline.push(instructions(taskOrder[i]));
      //practice
      timeline.push(runPractice("practice", "practice_response", taskOrder[i]));
      //pre-task reminder
      timeline.push(postPracticeReminder(taskOrder[i]));
      timeline.push(preMainIntro);
      //main task
      timeline.push(
        numberMainOuterLoop("stimulus", "test_response", taskOrder[i]),
      );
      timeline.push(endScreen(taskOrder[i], i));
      //increment task index and reset progress bar
      timeline.push(reInitStore());
    }
  } else if (store.session.get("magpiPilot")) {
    timeline.push(magpiPilotTimeline());
    timeline.push(reInitStore());
    timeline.push(introARF);
    timeline.push(instructions(config.responseMode));
    timeline.push(
      runPractice("practice", "practice_response", config.responseMode),
    );
    timeline.push(postPracticeReminder(config.responseMode));
    timeline.push(preMainIntro);
    timeline.push(
      numberMainOuterLoop("stimulus", "test_response", config.responseMode),
    );
    timeline.push(endScreen(config.responseMode, 0));
  } else {
    //introduction
    timeline.push(intro(config.responseMode));
    //instructions
    timeline.push(instructions(config.responseMode));
    //practice
    timeline.push(
      runPractice("practice", "practice_response", config.responseMode),
    );
    //more instructions
    timeline.push(postPracticeReminder(config.responseMode));
    timeline.push(preMainIntro);
    //main task
    timeline.push(
      numberMainOuterLoop("stimulus", "test_response", config.responseMode),
    );
    //end screen
    /*if (store.session.get("responseModality")) {
      let endText =
        groupMapping[config.group][config.taskName][config.responseMode].endText;
      if (endText === undefined) {
        timeline.push(surveyTimeline(config));
      } else {
        timeline.push(endScreen);
      }
    } else {*/
    timeline.push(endScreen(config.responseMode, 0));
    //}
  }

  timeline.push(exitFullscreen);

  return { jsPsych, timeline };
}
