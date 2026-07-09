import store from "store2";
import { multiChoice } from "./multiChoice";
import { multiChoiceImage } from "./multiChoiceImage";
import { selectDuck } from "./selectDuck";
import { giveNClick } from "./giveNClick";
import { numberLine } from "./numberLine";
import { textboxResponse } from "./textboxResponse";
import { keyboardInstruction } from "./keyboardInstruction";
import { fractionInstruction } from "./fractionInstruction";
import { ifBreakScreen } from "./breakScreen";
import { ifTimeoutFlash } from "../../shared/trials/blackScreen";
import { updateStimulus } from "./trialHelpers";
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import { endGame } from "./trialHelpers";

//////dynamic timeline method with conditional functions

// Helper function for conditional trials
const createConditionalTrial = (itemType, timelineFunc) => {
  return (corpusName, assessment_stage_val) => ({
    timeline: [timelineFunc(corpusName, assessment_stage_val)],
    conditional_function: () => {
      return store.session.get("nextStimulus").item_type === itemType;
    },
  });
};

// Define conditional trials using the helper function
const ifMultiChoice = createConditionalTrial("multiChoice", multiChoice);
const ifMultiChoiceImage = createConditionalTrial(
  "multiChoiceImage",
  multiChoiceImage,
);
const ifSelectDuck = createConditionalTrial("selectDuck", selectDuck);
const ifGiveN = createConditionalTrial("giveN", giveNClick);
const ifNumberLine = createConditionalTrial("numberLine", numberLine);
const ifTextboxResponse = createConditionalTrial(
  "textboxResponse",
  textboxResponse,
);
const ifKeyboardInstruction = createConditionalTrial(
  "keyboardInstruction",
  keyboardInstruction,
);
const ifFractionInstruction = createConditionalTrial(
  "fractionInstruction",
  fractionInstruction,
);

export const bonusLoop = (corpusName) => ({
  timeline: [
    updateStimulus(corpusName),
    ifKeyboardInstruction(corpusName, "practice_response"),
    ifFractionInstruction(corpusName, "practice_response"),
    ifMultiChoice(corpusName, "test_response"),
    ifMultiChoiceImage(corpusName, "test_response"),
    ifSelectDuck(corpusName, "test_response"),
    ifGiveN(corpusName, "test_response"),
    ifNumberLine(corpusName, "test_response"),
    ifTextboxResponse(corpusName, "test_response"),
    ifTimeoutFlash,
    ifBreakScreen,
  ],
  on_timeline_finish: () => {
    if (!store.session.get("nextStimulus").item_type.includes("Instruction")) {
      if (store.session.get("timeOut") === true) {
        store.session.set("allowKeyUp", true);
        store.session.set("timeOut", false);
      }
    }
  },
  loop_function: () => {
    if (store.session.get("endBlock")) {
      //reset so that each bonus block gets separate indexing
      store.session.set("indexTracking", -1);
      return false;
    }
    return true;
  },
  conditional_function: () => {
    if (store.session.get("currentCorpus").length !== 0) {
      return true;
    }
    return false;
  },
});

const initBonus = () => {
  return {
    type: jsPsychCallFunction,
    func: () => {
      if (store.session.get("finalCorpus") === "") {
        let corpus = store.session.get("currentCorpus");
        store.session.set("finalCorpus", corpus);
        //only reset at the start of bonus problems section
        store.session.set("endGame", false);
        //set different stop criteria
        store.session.set("responseWindowSize", 3);
        store.session.set("stopCriterion", 1);
      }
      //reset when starting a bonus block
      store.session.set("endBlock", false);
      let corpus = store.session.get("finalCorpus");
      let subCorpus = [];
      let bonusSkills = store.session.get("bonusSkills");
      let firstFraction = -1;
      let firstKeyboard = -1;
      let fractionInstructionIdx = -1;
      let keyboardInstructionIdx = -1;
      for (let i = 0; i < corpus.length; i++) {
        if (
          corpus[i].skill_category_camel ===
          bonusSkills[store.session.get("bonusIdx")]
        ) {
          subCorpus.push(corpus[i]);
          if (
            firstFraction === -1 &&
            corpus[i].response_format === "fraction"
          ) {
            firstFraction = subCorpus.length - 1;
          } else if (
            firstKeyboard === -1 &&
            corpus[i].response_format !== "" &&
            corpus[i].response_format !== "fraction"
          ) {
            firstKeyboard = subCorpus.length - 1;
          }
        }

        // do not repeat instructions if already shown
        if (
          !store.session.get("keyboardInstructionDone") &&
          corpus[i].item_type === "keyboardInstruction"
        ) {
          keyboardInstructionIdx = i;
        }
        if (
          !store.session.get("fractionInstructionDone") &&
          corpus[i].item_type === "fractionInstruction"
        ) {
          fractionInstructionIdx = i;
        }
      }
      //insert the instruction in place if it hasn't been shown and fraction/keyboard problem is there
      if (keyboardInstructionIdx !== -1 && firstKeyboard !== -1) {
        subCorpus.splice(firstKeyboard, 0, corpus[keyboardInstructionIdx]);
      }
      if (fractionInstructionIdx !== -1 && firstFraction !== -1) {
        subCorpus.splice(firstFraction, 0, corpus[fractionInstructionIdx]);
      }

      store.session.set("currentCorpus", subCorpus);
      store.session.transact("bonusIdx", (oldVal) => oldVal + 1);
      //reset the response tracker
      store.session.set("responseTracker", []);
      if (subCorpus.length === 0) {
        //check if game will end to prevent inifinite loop
        endGame(
          store.session.get("responseTracker"),
          store.session.get("stopCriterion"),
          store.session.get("responseWindowSize"),
        );
      }
    },
  };
};

const bonusBlock = (corpusName) => {
  return {
    timeline: [initBonus(), bonusLoop(corpusName)],
    loop_function: () => {
      if (store.session.get("endGame")) {
        return false;
      }
      return true;
    },
  };
};

export const ifBonusBlock = (corpusName) => {
  return {
    timeline: [bonusBlock(corpusName)],
    conditional_function: () => {
      let gradeEstimateObject = store.session.get("gradeEstimateObject");
      let supportCategory = gradeEstimateObject.composite.supportCategory;
      let bonusSkills = store.session.get("bonusSkills");
      //if overall score is pink or yellow and some subskills are >90% correct
      if (
        supportCategory === "Needs Extra Support" ||
        supportCategory === "Developing Skill"
      ) {
        for (let key in gradeEstimateObject) {
          if (key !== "composite") {
            let perCorrect =
              gradeEstimateObject[key].totalAttempted != 0
                ? gradeEstimateObject[key].totalCorrect /
                  gradeEstimateObject[key].totalAttempted
                : 0;
            if (perCorrect >= store.session.get("bonusPerCorrectCutoff")) {
              bonusSkills.push(key);
            }
          }
        }
      }
      if (bonusSkills.length !== 0) {
        // if the current corpus are the lower items, then combine with the remaining items and set as the current corpus
        if (store.session.get("currentCorpusName") === "lower") {
          let currentCorpus = store.session.get("currentCorpus");
          let remainingCorpus = store.session.get("corpusAll")["stimulus"][2];
          let combinedCorpus = [...currentCorpus, ...remainingCorpus];
          store.session.set("currentCorpus", combinedCorpus);
          store.session.set("currentCorpusName", "remaining");
        }
        store.session.set("bonusSkills", bonusSkills);
        return true;
      }
      return false;
    },
  };
};
