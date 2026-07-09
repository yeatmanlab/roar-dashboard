import store from "store2";
//import { numberMainSwipe } from "../../fluency/trials/trialSwipe";
import { numberMainNAFC } from "../../fluency/trials/trialAFC";
import { numberMainTimer } from "../../fluency/trials/trialProduction";
import { initBlock, setTimer } from "./trialDefinitions";
import { updateStimulus } from "../../shared/helpers";
import { practice } from "./practice";
import { jsPsych } from "../../taskSetup";

/*let functionMain = {
  "2afc": numberMainNAFC,
  "6afc": numberMainNAFC,
  "production": numberMainTimer,
};*/

/*let functionInstruction = {
  "2afc": practice2afc,
  "6afc": practice6afc,
  "production": practiceProduction
}*/

const mainBlock = (corpusName, subCorpusName, assessment_stage_val) => {
  let timelineObj = [
    updateStimulus(corpusName),
    numberMainTimer(corpusName, assessment_stage_val),
  ];
  if (subCorpusName.includes("afc")) {
    timelineObj = [
      updateStimulus(corpusName),
      numberMainNAFC(corpusName, assessment_stage_val),
    ];
  }
  return {
    timeline: timelineObj,
    on_timeline_start: () => {
      document.getElementById(
        "jspsych-progressbar-container",
      ).style.visibility = "visible";
      if (subCorpusName != "rtControl_production") {
        document.body.style.cursor = "auto";
      }
    },
    loop_function: () => {
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
        clearTimeout(store.session.get("timerId"));
        return false;
      }
      return true;
    },
  };
};

export const responseTimeBlock = (
  corpusName,
  subCorpusName,
  arrayIdx,
  assessment_stage_val,
) => {
  return {
    timeline: [
      initBlock(corpusName, arrayIdx),
      //functionInstruction[subCorpusName],
      //practice(subCorpusName),
      setTimer,
      mainBlock(corpusName, subCorpusName, assessment_stage_val),
    ],
    on_timeline_finish: () => {
      jsPsych.setProgressBar(0); //reset progress bar
      store.session.set("timerId", null);
      store.session.set("nextStimulus", null);
      store.session.set("allowKeyUp", false);
      store.session.set("startTimePB", null);
      store.session.set("correctCount", 0);
      document.getElementById(
        "jspsych-progressbar-container",
      ).style.visibility = "hidden";
    },
  };
};
