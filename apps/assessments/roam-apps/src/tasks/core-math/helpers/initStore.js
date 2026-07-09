import store from "store2"; //storing browser data
import i18next from "i18next";
import { getLanguage } from "@bdelab/roar-utils";

export const initStoreCoreMath = () => {
  if (store.session.has("initialized") && store.local("initialized")) {
    return store.session;
  }

  //changes the character based on the lab
  /*store.session.set("displayImage", "tiger");
  if (store.session.get("config").labId === "numberLab") {
    store.session.set(
      "displayImage",
      camelize(store.session.get("config").taskName + "-display"),
    );
  }*/

  let config = store.session.get("config");

  store.session.set("magpiPilot", false);
  if (config.recruitment === "magpiPilot") {
    store.session.set("magpiPilot", true);

    let grade = store.session.get("grade");
    if (grade < 3 || grade === "undefined") {
      store.session.set("blockOrderNumLine", {
        stimulus: ["block0", "block1"],
      });
    } else {
      store.session.set("blockOrderNumLine", {
        stimulus: ["block0", "block1", "block2"],
      });
    }
    store.session.set("arrayIdx", 0);

    store.session.set("numberLineTimeLimit", 15000); //in ms
    store.session.set("numberLineCountdownTime", 5); //in sec
    store.session.set("numberLineCountdownAppears", 10000); //in ms
    store.session.set("blockType", null);
    //slider step size
    store.session.set("blockStepInstruction", {
      20: 0.02,
      100: 0.1,
      1: 0.001,
      2: 0.002,
    });
    //for practice feedback
    store.session.set("perError", null);
  }

  // clear any timers if they exist in the browser
  if (store.session.get("timerId")) {
    clearTimeout(store.session.get("timerId"));
  }
  store.session.set("timerId", null);

  if (store.session.get("timerForceId")) {
    clearTimeout(store.session.get("timerForceId"));
  }
  store.session.set("timerForceId", null);

  if (store.session.get("timerIdCountdown")) {
    clearTimeout(store.session.get("timerIdCountdown"));
  }
  store.session.set("timerIdCountdown", null);

  if (store.session.get("intervalId")) {
    clearInterval(store.session.get("intervalId"));
  }
  store.session.set("intervalId", null);

  if (store.session.get("intervalId2")) {
    clearInterval(store.session.get("intervalId2"));
  }
  store.session.set("intervalId2", null);

  //allows for keypress for the next trial without keyup occuring first if time out occurs
  store.session.set("allowKeyUp", false);

  // warning message for double response items
  store.session.set("warningVisible", false);

  //for showing replay button
  store.session.set("replayButton", true);

  // for storing next stimulus
  store.session.set("nextStimulus", null);

  // reset response modality to false
  store.session.set("responseModality", false);

  store.session.set("trialNumTotal", 0); // counter for trials in experiment
  store.session.set("dataCorrect", null);
  store.session.set("thetaEstimateRaw", null);
  store.session.set("thetaEstimate", null);
  store.session.set("bonusPerCorrectCutoff", 0.9);
  store.session.set("bonusIdx", 0);
  store.session.set("bonusSkills", []);
  store.session.set("endBlock", false);
  store.session.set("endGame", false);
  store.session.set("keyboardInstructionDone", false);
  store.session.set("fractionInstructionDone", false);

  store.session.set("skillScores", {});
  store.session.set("gradeEstimateObject", {});

  //controls for whether lower items should be implemented
  store.session.set("corpusToRun", null);
  store.session.set("currentCorpusName", null);
  store.session.set("corpusNamesMap", ["check", "lower", "remaining"]);
  store.session.set("corpusComplete", true);

  store.session.set("timeOut", false); // initialise the time out variable, gets updated in stimulusNumber.js

  // working copy of the three corpuses (items are removed as they are used)
  store.session.set("currentCorpus", ""); //initialise current corpus as empty string, gets updated in stimulusNumber.js
  store.session.set("finalCorpus", "");

  // index for keeping track of trials for timer
  store.session.set("indexTracking", -1); //gets updated in stimulusNumber.js
  store.session.set("indexTrackingPractice", -1);

  //controls stopping condition
  store.session.set("responseTracker", []);
  store.session.set("responseWindowSize", 6);
  //separately store the "check item" responses
  store.session.set("checkResponseTracker", []);

  //if 4 out of 5 past responses are incorrect then end the game (i.e. sum<=1)
  store.session.set("stopCriterion", 1);

  //break screen frequency
  store.session.set("breakCount", 0);

  //decimal key
  let lng = getLanguage(i18next.language);
  if (lng === "pt") {
    store.session.set("switchDecimal", true);
    store.session.set("decimalCode", "Comma");
    store.session.set("decimalKey", ",");
  } else {
    store.session.set("switchDecimal", false);
    store.session.set("decimalCode", "Period");
    store.session.set("decimalKey", ".");
  }

  // this should be the last set before return
  store.session.set("initialized", true);

  return store.session;
};
