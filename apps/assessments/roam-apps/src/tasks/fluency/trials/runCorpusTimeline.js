/*
Defines the timeline for practice trials and main trials.
*/

import { initBlock, ifTimeoutFlash } from "./trialDefinitions";
import { updateStimulus } from "../../shared/helpers";
import { numberMainTimer } from "./trialProduction";
import { numberMainNAFC } from "./trialAFC";
//import { numberMainSwipe } from "./trialSwipe";
import { jsPsych } from "../../taskSetup";
import store from "store2"; //storing session data

export const numberMainOuterLoop = (
  corpusName,
  assessment_stage_val,
  responseMode,
) => {
  return {
    timeline: [
      initBlock(corpusName, responseMode),
      numberMainLoop(corpusName, assessment_stage_val, responseMode),
    ],
    loop_function: () => {
      store.session.transact("arrayIdx", (oldVal) => oldVal + 1);

      if (
        store.session.get("arrayIdx") <
        store.session.get("timerDuration").length
      ) {
        //end task because 0 correct within the last block
        if (store.session.get("correctCount") === 0) {
          store.session.set("arrayIdx", 0);
          return false;
        } else {
          store.session.set("correctCount", 0);
          return true;
        }
      } else {
        //end task because all blocks are complete
        store.session.set("arrayIdx", 0);
        return false;
      }
    },
  };
};

const numberMainLoop = (corpusName, assessment_stage_val, responseMode) => {
  let timelineObj = [
    updateStimulus(corpusName),
    numberMainTimer(corpusName, assessment_stage_val),
    ifTimeoutFlash,
  ];
  if (responseMode.includes("afc")) {
    timelineObj = [
      updateStimulus(corpusName),
      numberMainNAFC(corpusName, assessment_stage_val),
      ifTimeoutFlash,
    ];
  }
  return {
    timeline: timelineObj,
    on_timeline_start: () => {
      document.getElementById(
        "jspsych-progressbar-container",
      ).style.visibility = "visible";
      if (responseMode === "production") {
        document.body.style.cursor = "none";
      }
    },
    loop_function: function () {
      if (
        store.session.get("timeOut") ||
        store.session.get("currentCorpus").length === 0
      ) {
        // repeat until either max trials is reached or if timer is complete
        store.session.set("indexTracking", -1);
        if (store.session.get("timeOut") === true) {
          store.session.set("allowKeyUp", true);
          store.session.set("timeOut", false);
        }
        store.session.set("timeForceOut", false);
        clearTimeout(store.session.get("timerId"));
        clearTimeout(store.session.get("timerForceId"));
        return false;
      }
      return true;
    },
  };
};
