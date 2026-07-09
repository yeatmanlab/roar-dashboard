import { initBlock } from "./trialDefinitions";
import { updateStimulus } from "../../shared/helpers";
import {
  numberMainTimer,
  practiceFeedbackCorrect,
  practiceFeedbackIncorrect,
} from "./trialProduction";
import {
  numberMainNAFC,
  practiceFeedbackIncorrectAFC,
  practiceFeedbackCorrectAFC,
} from "./trialAFC";
import store from "store2"; //storing session data
import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../../.."; //media files
import i18next from "i18next";
import "../../../i18n/i18n";
import { camelize } from "@bdelab/roar-utils";
import { isMobile } from "../helpers";

const practiceIntro = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (store.session.get("responseModality")) {
      return mediaAssets.audio[
        camelize("afc-practice-intro-" + store.session.get("config").taskName)
      ];
    }
    return mediaAssets.audio[
      camelize(
        store.session.get("config").responseMode.replace(/\d+/g, "") +
          "-practice-intro-" +
          store.session.get("config").taskName,
      )
    ];
  },
  prompt: () => {
    let imageName = mediaAssets.images.paperPencilGreen;
    let instructionText =
      "instructions.fluency." +
      store.session.get("config").taskName +
      "-" +
      store.session.get("config").labId;
    if (store.session.get("config").taskName === "fluency-arf") {
      imageName = mediaAssets.images.paperPencilRed;
      instructionText =
        "instructions.fluency." + store.session.get("config").taskName;
    }
    let pressAnyKey = "";
    if (
      store.session.get("config").responseMode === "production" &&
      !isMobile &&
      !store.session.get("responseModality")
    ) {
      pressAnyKey = `<div class="key-button"> ${i18next.t(
        "instructions.fluency.text16",
      )} </div>`;
    }

    return (
      `
          <div class="tiger-gif-container">
            <div class="speechbubble">
              <h1 class="header">${i18next.t(
                "instructions.fluency.text15",
              )} </h1>
              <div class="text-image">
                <img class="clipart-paper" src=${imageName} alt="paper and pencil"/>
                <p class="text"> ${i18next.t(instructionText)} </p>
              </div>
            </div>
            <img class="roam-tiger" src=${
              mediaAssets.images[store.session.get("displayImage")]
            } alt="tiger"/>
          </div>
        ` + pressAnyKey
    );
  },
  keyboard_choices: () => {
    if (
      store.session.get("config").responseMode === "production" &&
      !isMobile &&
      !store.session.get("responseModality")
    ) {
      return "ALL_KEYS";
    }
    return [];
  },
  button_choices: () => {
    if (
      store.session.get("config").responseMode === "production" &&
      !isMobile &&
      !store.session.get("responseModality")
    ) {
      return [];
    }
    return [""];
  },
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  on_start: () => {
    if (
      store.session.get("config").responseMode != "production" ||
      store.session.get("responseModality")
    ) {
      document.body.style.cursor = "auto";
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    }
  },
  on_load: () => {
    //disable button to prevent double clicks
    const btn = document.getElementById("go-button-id");
    if (btn) {
      btn.style.pointerEvents = "none";
      setTimeout(() => {
        btn.style.pointerEvents = "auto";
      }, 1000);
    }
  },
};

const incorrectLoop = (corpusName, assessment_stage_val, responseMode) => {
  let timelineObj = [
    practiceFeedbackIncorrect(corpusName, assessment_stage_val),
  ];
  if (responseMode.includes("afc")) {
    timelineObj = [
      practiceFeedbackIncorrectAFC(corpusName, assessment_stage_val),
    ];
  }
  return {
    timeline: timelineObj,
    on_timeline_start: () => {
      store.session.transact("indexTracking", (oldVal) => oldVal + 1);
    },
    loop_function: () => {
      store.session.transact("practiceIncorrectCount", (oldVal) => oldVal + 1);
      if (store.session.get("config")?.responseMode.includes("afc")) {
        return false;
      } else {
        if (
          store.session.get("dataCorrect") === 1 ||
          store.session.get("practiceIncorrectCount") > 1
        ) {
          return false;
        }
        return true;
      }
    },
  };
};

const ifIncorrect = (corpusName, assessment_stage_val, responseMode) => {
  return {
    timeline: [incorrectLoop(corpusName, assessment_stage_val, responseMode)],
    conditional_function: () => {
      if (store.session.get("dataCorrect") === 0) {
        return true;
      }
      return false;
    },
  };
};

const ifCorrect = (responseMode) => {
  let timelineObj = [practiceFeedbackCorrect()];
  if (responseMode.includes("afc")) {
    timelineObj = [practiceFeedbackCorrectAFC];
  }
  return {
    timeline: timelineObj,
    conditional_function: () => {
      if (store.session.get("config")?.responseMode.includes("afc")) {
        if (
          store.session.get("dataCorrect") === 1 &&
          store.session.get("practiceIncorrectCount") < 1
        ) {
          return true;
        }
        return false;
      } else {
        if (
          store.session.get("dataCorrect") === 1 &&
          store.session.get("practiceIncorrectCount") < 2
        ) {
          return true;
        }
        return false;
      }
    },
  };
};

const practiceFeedbackLoop = (
  corpusName,
  assessment_stage_val,
  responseMode,
) => {
  return {
    timeline: [
      ifIncorrect(corpusName, assessment_stage_val, responseMode),
      ifCorrect(responseMode),
    ],
  };
};

const numberPracticeLoop = (corpusName, assessment_stage_val, responseMode) => {
  let timelineObj = [
    initBlock(corpusName, responseMode),
    updateStimulus(corpusName),
    numberMainTimer(corpusName, assessment_stage_val),
    practiceFeedbackLoop(corpusName, assessment_stage_val, responseMode),
  ];
  if (responseMode.includes("afc")) {
    timelineObj = [
      initBlock(corpusName, responseMode),
      updateStimulus(corpusName),
      numberMainNAFC(corpusName, assessment_stage_val),
      practiceFeedbackLoop(corpusName, assessment_stage_val, responseMode),
    ];
  }
  return {
    timeline: timelineObj,
    loop_function: function () {
      store.session.set("practiceIncorrectCount", 0);
      if (store.session.get("currentCorpus").length === 0) {
        store.session.set("indexTracking", -1);
        store.session.set("correctCount", 0);
        return false;
      }
      return true;
    },
  };
};

export const runPractice = (corpusName, assessment_stage_val, responseMode) => {
  return {
    timeline: [
      practiceIntro,
      numberPracticeLoop(corpusName, assessment_stage_val, responseMode),
    ],
    conditional_function: () => {
      /*if(store.session.get("responseModality")){
                return false;
            }*/
      return true;
    },
  };
};
