import { updateStimulus } from "./trialHelpers";
import { ifTimeoutFlash } from "../../shared/trials/blackScreen";
import store from "store2"; // storing session data
import { multiChoice } from "./multiChoice";
import { multiChoiceImage } from "./multiChoiceImage";
import { selectDuck } from "./selectDuck";
import { giveNClick } from "./giveNClick";
import { numberLine } from "./numberLine";
import { textboxResponse } from "./textboxResponse";
import { fractionInstruction } from "./fractionInstruction";
import { keyboardInstruction } from "./keyboardInstruction";
import { ifBreakScreen } from "./breakScreen";

//////dynamic timeline method with trial mapping
const trialMapping = {
  multiChoice: multiChoice,
  multiChoiceImage: multiChoiceImage,
  selectDuck: selectDuck,
  giveN: giveNClick,
  numberLine: numberLine,
  textboxResponse: textboxResponse,
  fractionInstruction: fractionInstruction,
  keyboardInstruction: keyboardInstruction,
};

export const getTrial = (corpusName, assessment_stage_val, trialType) => {
  return {
    timeline: [
      updateStimulus(corpusName),
      trialMapping[trialType](corpusName, assessment_stage_val),
      ifTimeoutFlash,
      ifBreakScreen,
    ],
    on_timeline_finish: () => {
      if (!trialType.includes("Instruction")) {
        if (store.session.get("timeOut") === true) {
          store.session.set("allowKeyUp", true);
          store.session.set("timeOut", false);
        }
      }
      //if the end of current corpus is reached
      if (store.session.get("currentCorpus").length === 0) {
        store.session.set("corpusComplete", true);
      }
    },
    conditional_function: () => {
      if (store.session.get("endGame")) {
        //reset so that bonus problems get separate indexing
        store.session.set("indexTracking", -1);
        return false;
      }
      // if the current items are from the lower starting point but we don't need to run them, then skip
      if (
        store.session.get("corpusToRun") !==
        store.session.get("currentCorpusName")
      ) {
        return false;
      }
      return true;
    },
  };
};
