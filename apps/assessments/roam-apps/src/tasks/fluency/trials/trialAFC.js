/*
Defines the jspsych object for the task trial (practice or main). Includes the object which will control sound after response is given in main task.
Data of each trial will be saved in jspsych data on finish of trial. Some session data variables are updated.
*/

/* eslint-disable no-plusplus */
/* eslint-disable prefer-const */
/* eslint-disable arrow-body-style */
import store from "store2"; //storing session data
import { jsPsych } from "../../taskSetup";
import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../../..";
import { shuffle } from "../../shared/helpers/shuffleArray";
import { updateProgressBar } from "../../shared/helpers";
import { roamValidityEvaluator } from "../timeline";
import i18next from "i18next";
import { dashToCamelCase } from "../../shared/helpers";
import { validityEvaluator } from "../timeline";
import { pushSkill } from "./trialDefinitions";
import { isMobile } from "../helpers";

const itemToHtml = (stimulus) => {
  if (store.session.get("config").taskName === "fluency-calf") {
    //default is production response mode
    return `<p class="item-stimulus" id="stimulus_val">
        <span class="equation stacked" id="stimulus-val">
          <span class="number">${stimulus.operand1}</span>
          <span class="operator">${stimulus.operator}</span>
          <span class="number">${stimulus.operand2}</span>
          <span class="equals">=</span><span class="textbox"></span>
        </span>
        </p>`;
  } else {
    return `<p class="item-stimulus" id="stimulus-val">
        ${stimulus.item_raw}
      </p>`;
  }
};

export const numberMainNAFC = (corpusName, assessment_stage_val) => {
  let stim = {
    type: jsPsychAudioMultiResponse,
    response_allowed_while_playing: true,
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    stimulus: mediaAssets.audio.nullAudio,
    prompt: () => {
      return itemToHtml(store.session.get("nextStimulus"));
    },
    prompt_above_buttons: true,
    button_choices: () => store.session.get("nextStimulus").choices,
    button_html: () => {
      return "<button>%choice%</button>";
    },
    on_load: () => {
      document
        .getElementById("jspsych-audio-multi-response-btngroup")
        .classList.add(`nafc-btn-layout`);

      //disable on load to prevent double clicking
      let buttons = document.querySelectorAll(
        ".jspsych-audio-multi-response-button",
      );

      buttons.forEach((btn) => {
        btn.classList.add("disabled-btn-practice");
      });

      // Re-enable after 250ms
      setTimeout(() => {
        buttons.forEach((btn) => {
          btn.classList.remove("disabled-btn-practice");
        });
      }, 250);
    },
    on_finish: (data) => {
      const stimulus = store.session.get("nextStimulus");

      // check response and record it
      let response_val = stimulus.choices[data.button_response];
      let correct = data.button_response === stimulus.correctResponseNum;

      if (correct) {
        store.session.transact("correctCount", (oldVal) => oldVal + 1); //increment count
        store.session.set("dataCorrect", 1); // if response = 1 then the participant got it correct
      } else {
        store.session.set("dataCorrect", 0); // if response = 0 then the participant got it wrong
      }

      let save_trial = !store.session.get("timeOut");
      let subCorpusName = store.session.get("subCorpusName");

      let subtask;
      if (store.session.get("responseModality")) {
        subtask = "FC";
        if (subCorpusName.includes("rtControl")) {
          subtask = subCorpusName;
        }
        jsPsych.data.addDataToLastTrial({
          subtask: subtask,
        });
      } else {
        //subtask for operation
        subtask = store.session.get("operatorMap")[stimulus.operator];

        jsPsych.data.addDataToLastTrial({
          subtask: subtask,
        });
      }

      jsPsych.data.addDataToLastTrial({
        save_trial: save_trial,
        pid: store.session.get("config").pid,
        corpus_name: subCorpusName,
        trial_num_block: store.session.get("indexTracking") + 1,
        item_id: stimulus.itemID,
        order_id: stimulus.orderID,
        vector_id: stimulus.vectorID,
        position_id: stimulus.positionID,
        theoretical_difficulty: stimulus.difficulty,
        item: stimulus.item_raw,
        operation: stimulus.operator,
        choices: stimulus.choices,
        correct_response_num: stimulus.correctResponseNum,
        choice_index: data.button_response,
        response: response_val,
        correct: store.session.get("dataCorrect"),
        target: stimulus.target,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        item_grade_level: "K,1,2,3,4,5,6,7,8,9,10,11,12",
        skill: stimulus.skill,
        //group: store.session.get("config").group,
        response_key_list: null,
        response_time_list: null,
        is_mobile: isMobile,
      });

      if (corpusName !== "practice") {
        // progress bar
        updateProgressBar();

        if (save_trial) {
          if (!store.session.get("responseModality")) {
            if (correct) {
              store.session.transact("totalCorrect", (oldVal) => oldVal + 1);
            }
            store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);

            //add skills
            pushSkill(correct, stimulus.skill, subtask);
          } else {
            if (subCorpusName === "rtControl_2afc") {
              store.session.transact(
                "trialNumTotalControl2afc",
                (oldVal) => oldVal + 1,
              );
            } else if (subCorpusName === "rtControl_6afc") {
              store.session.transact(
                "trialNumTotalControl6afc",
                (oldVal) => oldVal + 1,
              );
            } else {
              store.session.transact(
                "trialNumTotalAFC",
                (oldVal) => oldVal + 1,
              );
              if (correct) {
                store.session.transact("totalCorrect", (oldVal) => oldVal + 1);
              }
              store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);
            }
          }
        }

        // feed response to fluencyValidityEvaluator for evaluation per trial
        if (store.session.get("evaluateValidity")) {
          validityEvaluator.addResponseData(
            data.rt,
            response_val,
            store.session.get("dataCorrect"),
          );
        }
      }
    },
  };
  return stim;
};

export const practiceFeedbackIncorrectAFC = (
  corpusName,
  assessment_stage_val,
) => {
  let stim = {
    type: jsPsychAudioMultiResponse,
    response_allowed_while_playing: true,
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    stimulus: () => {
      return mediaAssets.audio[
        dashToCamelCase(
          "afc-" + store.session.get("nextStimulus").audio + "-incorrect",
        )
      ];
    },
    prompt: () => {
      let currentItem = store.session.get("nextStimulus");
      if (store.session.get("config").taskName === "fluency-calf") {
        return `<p class="item-stimulus" id="stimulus_val">
                    <span class="equation-feedback stacked" id="stimulus-val">
                      <span class="number">${currentItem.operand1}</span>
                      <span class="operator">${currentItem.operator}</span>
                      <span class="number">${currentItem.operand2}</span>
                      <span class="equals">=</span><span class="textbox"></span>
                    </span>
                </p>`;
      }
      return `<p class="item-stimulus" id="stimulus_val">${currentItem.item_raw}</p>`;
    },
    prompt_above_buttons: true,
    button_choices: () => store.session.get("nextStimulus").choices,
    button_html: () => {
      return "<button>%choice%</button>";
    },
    on_load: () => {
      document
        .getElementById("jspsych-audio-multi-response-btngroup")
        .classList.add(`nafc-btn-layout`);

      let buttons = document.querySelectorAll(
        ".jspsych-audio-multi-response-button",
      );

      buttons.forEach((button) => {
        if (
          button.textContent.trim() === store.session.get("nextStimulus").target
        ) {
          button.classList.add("glowingButton");
        } else {
          button.classList.add("disabled-btn-practice");
        }
      });

      let practiceFeedbackHTML = `
          <p class="feedback">
            <span class="red">
              ${i18next.t("practice.feedbackIncorrect1")}
            </span>
            <span class="gray">
              ${i18next.t("practice.feedbackIncorrect3", {
                target: store.session.get("nextStimulus").target,
              })}
            </span><br>
            <span class="gray">
              ${i18next.t("practice.feedbackIncorrect5", {
                target: store.session.get("nextStimulus").target,
              })}
            </span>
            </p>`;

      // Select the target div
      const targetDiv = document.getElementById(
        "jspsych-audio-multi-response-btngroup",
      );

      // Insert the HTML content after the target div
      targetDiv.insertAdjacentHTML("afterend", practiceFeedbackHTML);
    },
    on_finish: (data) => {
      const stimulus = store.session.get("nextStimulus");

      // check response and record it
      let response_val = stimulus.choices[data.button_response];
      let correct = data.button_response === stimulus.correctResponseNum;

      if (correct) {
        store.session.transact("correctCount", (oldVal) => oldVal + 1); //increment count
        store.session.set("dataCorrect", 1); // if response = 1 then the participant got it correct
      } else {
        store.session.set("dataCorrect", 0); // if response = 0 then the participant got it wrong
      }

      let save_trial = !store.session.get("timeOut");
      let subCorpusName = store.session.get("subCorpusName");

      if (store.session.get("responseModality")) {
        let subtask = "FC";
        if (subCorpusName.includes("rtControl")) {
          subtask = subCorpusName;
        }
        jsPsych.data.addDataToLastTrial({
          subtask: subtask,
        });
      } else {
        //subtask for operation
        let subtask = store.session.get("operatorMap")[stimulus.operator];

        jsPsych.data.addDataToLastTrial({
          subtask: subtask,
        });
      }

      jsPsych.data.addDataToLastTrial({
        save_trial: save_trial,
        pid: store.session.get("config").pid,
        corpus_name: subCorpusName,
        trial_num_block: store.session.get("indexTracking") + 1,
        item_id: stimulus.itemID,
        order_id: stimulus.orderID,
        vector_id: stimulus.vectorID,
        position_id: stimulus.positionID,
        theoretical_difficulty: stimulus.difficulty,
        item: stimulus.item_raw,
        operation: stimulus.operator,
        choices: stimulus.choices,
        correct_response_num: stimulus.correctResponseNum,
        choice_index: data.button_response,
        response: response_val,
        correct: store.session.get("dataCorrect"),
        target: stimulus.target,
        distractors: stimulus.distractor_list,
        item_grade_level: "K,1,2,3,4,5,6,7,8,9,10,11,12",
        skill: stimulus.skill,
        //group: store.session.get("config").group,
        response_key_list: null,
        response_time_list: null,
        is_mobile: isMobile,
      });
    },
  };
  return stim;
};

export const practiceFeedbackCorrectAFC = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    let audioFile = store.session.get("nextStimulus").audio;
    return mediaAssets.audio.instructionsFluencyCorrect;
  },
  prompt: () => {
    let currentItem = store.session.get("nextStimulus");
    if (store.session.get("config").taskName === "fluency-calf") {
      return `<p class="item-stimulus" id="stimulus_val">
            <span class="equation-feedback stacked" id="stimulus-val">
              <span class="number">${currentItem.operand1}</span>
              <span class="operator">${currentItem.operator}</span>
              <span class="number">${currentItem.operand2}</span>
              <span class="equals">=</span><span class="textbox"></span>
            </span>
          </p>`;
    }
    return `<p class="item-stimulus" id="stimulus_val">${currentItem.item_raw}</p>`;
  },
  prompt_above_buttons: true,
  button_choices: () => store.session.get("nextStimulus").choices,
  button_html: () => {
    return "<button>%choice%</button>";
  },
  response_ends_trial: false,
  trial_ends_after_audio: true,
  response_allowed_while_playing: false,
  on_load: () => {
    document
      .getElementById("jspsych-audio-multi-response-btngroup")
      .classList.add(`nafc-btn-layout`);

    let buttons = document.querySelectorAll(
      ".jspsych-audio-multi-response-button",
    );

    buttons.forEach((button) => {
      if (
        button.textContent.trim() === store.session.get("nextStimulus").target
      ) {
        button.classList.add("glowingButton");
      } else {
        button.classList.add("disabled-btn-practice");
      }
    });

    let practiceFeedbackHTML = `
          <p class="feedback">
            <span class="green">
              ${i18next.t("practice.feedbackCorrect")}
            </span>
          </p>`;

    // Select the target div
    const targetDiv = document.getElementById(
      "jspsych-audio-multi-response-btngroup",
    );

    // Insert the HTML content after the target div
    targetDiv.insertAdjacentHTML("afterend", practiceFeedbackHTML);
  },
};
