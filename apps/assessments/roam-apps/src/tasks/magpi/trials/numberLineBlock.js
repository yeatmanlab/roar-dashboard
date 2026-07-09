import { updateStimulus } from "../../shared/helpers";
import { numberLineSlider } from "./numberLineSlider";
import { ifPractice, ifDemo } from "./numberLineInstruction";
import { ifTimeoutFlash } from "../../shared/trials/blackScreen";
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import store from "store2";

const numberLineBlock = (corpusName, assessment_stage_val) => {
  return {
    timeline: [
      updateStimulus(corpusName),
      numberLineSlider(assessment_stage_val),
      ifTimeoutFlash,
    ],
    loop_function: () => {
      store.session.set("timeOut", false);
      if (store.session.get("currentCorpus").length === 0) {
        store.session.set("indexTracking", -1);
        return false;
      }
      return true;
    },
  };
};

const initBlock = (corpusName) => {
  return {
    type: jsPsychCallFunction,
    func: () => {
      store.session.set("indexTracking", -1);
      let arrayIdx = store.session.get("arrayIdx");
      let block = store.session.get("blockOrderNumLine")["stimulus"][arrayIdx];
      let currentCorpus =
        store.session.get("corpusAll")[corpusName]["stimulus"][block];

      store.session.set("currentCorpus", currentCorpus);
      store.session.set("subCorpusName", corpusName + "_" + block);
      if (currentCorpus && currentCorpus.length > 0) {
        store.session.set("blockType", currentCorpus[0].upper);
      }
    },
  };
};

export const numberLineOuterLoop = (corpusName, assessment_stage_val) => {
  return {
    timeline: [
      initBlock(corpusName),
      ifPractice(),
      ifDemo(),
      numberLineBlock(corpusName, assessment_stage_val),
    ],
    loop_function: () => {
      store.session.transact("arrayIdx", (oldVal) => oldVal + 1);
      if (
        store.session.get("arrayIdx") ===
        store.session.get("blockOrderNumLine")["stimulus"].length
      ) {
        return false;
      }
      return true;
    },
  };
};
