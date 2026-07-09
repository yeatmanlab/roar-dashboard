/*
Defines the jspsych object for the task trial (practice or main). Includes the object which will control sound after response is given in main task.
Data of each trial will be saved in jspsych data on finish of trial. Some session data variables are updated.
*/

/* eslint-disable no-plusplus */
/* eslint-disable prefer-const */
/* eslint-disable arrow-body-style */
import store from "store2"; //storing session data
import { jsPsych } from "../../taskSetup";
import jsPsychSurveyHtmlForm from "@jspsych/plugin-survey-html-form";
import jsPsychAudioKeyboardResponse from "@jspsych/plugin-audio-keyboard-response";
import { mediaAssets } from "../../..";
import { updateProgressBar } from "../../shared/helpers";
import i18next from "i18next";
import { validityEvaluator } from "../timeline";
import { dashToCamelCase } from "../../shared/helpers";
import { pushSkill } from "./trialDefinitions";
import { isMobile } from "../helpers";

let rt = [];
let key = [];
let startTime;
let textboxVal;

const itemToHtml = (stimulus) => {
  if (store.session.get("config").taskName === "fluency-calf") {
    //default is production response mode
    return `<span class="equation stacked" id="stimulus-val">
          <span class="number">${stimulus.operand1}</span>
          <span class="operator">${stimulus.operator}</span>
          <span class="number">${stimulus.operand2}</span>
          <span class="equals">=</span><span class="textbox">
            <input type="text" name="question_input" id="question_input_key" class="item-textbox" style="text-align:right">
          </span>
        </span>`;
  } else {
    if (stimulus.item_raw.length < 3 && store.session.get("responseModality")) {
      return `<div class="item-stimulus" id="stimulus-val"><div class="spacing-below">${stimulus.item_raw}</div></div><div><input type="text" name="question_input" id="question_input_key" class="item-textbox" style="text-align:center"></div>`;
    } else {
      return `<p class="item-stimulus" id="stimulus-val">
          ${stimulus.item_raw}
          <span class="spacing">
            <input type="text" name="question_input" id="question_input_key" class="item-textbox" style="text-align:center">
          </span>
        </p>`;
    }
  }
};

export const numberMainTimerDesktop = (corpusName, assessment_stage_val) => {
  let stim = {
    type: jsPsychSurveyHtmlForm,
    html: () => {
      return itemToHtml(store.session.get("nextStimulus"));
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = null;
      startTime = performance.now(); //get initial time
    },
    on_load: () => {
      document.getElementById("question_input_key").focus();

      document
        .getElementById("question_input_key")
        .addEventListener("input", function () {
          textboxVal = this.value;
        });

      //hide the survey form submit button
      const submit_button = document.getElementById(
        "jspsych-survey-html-form-next",
      );
      submit_button.classList.add("hide-submit");

      const preventKeyDown = (event) => {
        event.preventDefault();
      };
      const storeKeyPress = (event) => {
        //only permit numbers, backspace and enter key
        if (
          (!event.code.includes("Digit") || !isFinite(event.key)) &&
          event.code !== "Backspace" &&
          event.code !== "Enter"
        ) {
          event.preventDefault();
        } else {
          const endTime = performance.now();
          const response_time = Math.round(endTime - startTime);
          const name = event.key;
          key.push(name);
          rt.push(response_time);
        }
      };

      //to prevent long pressing enter key from submitting trial
      function getPromiseFromEvent(item, event) {
        return new Promise((resolve) => {
          const listener = () => {
            item.removeEventListener(event, listener);
            document
              .getElementById("jspsych-survey-html-form")
              .removeEventListener("keydown", preventKeyDown);
            document
              .getElementById("jspsych-survey-html-form")
              .addEventListener("keydown", storeKeyPress);
            resolve();
          };
          item.addEventListener(event, listener);
        });
      }

      async function waitForKeyUp() {
        const form = document.getElementById("jspsych-survey-html-form");
        await getPromiseFromEvent(form, "keyup");
      }

      if (store.session.get("allowKeyUp")) {
        document
          .getElementById("jspsych-survey-html-form")
          .addEventListener("keydown", storeKeyPress);
        store.session.set("allowKeyUp", false);
      } else {
        document
          .getElementById("jspsych-survey-html-form")
          .addEventListener("keydown", preventKeyDown);

        waitForKeyUp();
      }
    },
    on_finish: (data) => {
      const stimulus = store.session.get("nextStimulus");
      let response_val = Number(textboxVal);
      if (textboxVal === null || textboxVal === "") {
        response_val = "";
      }

      store.session.set("response", response_val);

      //let correct = parseInt(response_val) === stimulus.target; //when csv is stored locally, targets are in int format
      let correct = response_val === Number(stimulus.target); //when csv is stored in bucket, targets are in string format
      if (correct) {
        store.session.transact("correctCount", (oldVal) => oldVal + 1); //increment count
        store.session.set("dataCorrect", 1); // if response = 1 then the participant got it correct
      } else {
        store.session.set("dataCorrect", 0); // if response = 0 then the participant got it wrong
      }
      if (corpusName === "stimulus") {
        store.session.set("previousItem", stimulus);
        store.session.set("previousAnswer", store.session.get("dataCorrect"));
      }

      let save_trial = !store.session.get("timeOut");
      let subCorpusName = store.session.get("subCorpusName");

      let subtask;
      if (store.session.get("responseModality")) {
        subtask = "FR";
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
        choices: null,
        correct_response_num: null,
        choice_index: null,
        response: response_val,
        correct: store.session.get("dataCorrect"),
        target: stimulus.target,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        item_grade_level: "K,1,2,3,4,5,6,7,8,9,10,11,12",
        skill: stimulus.skill,
        //group: store.session.get("config").group,
        response_key_list: key,
        response_time_list: rt,
        is_mobile: isMobile,
      });

      // progress bar
      if (corpusName !== "practice") {
        if (save_trial) {
          if (!store.session.get("responseModality")) {
            if (correct) {
              store.session.transact("totalCorrect", (oldVal) => oldVal + 1);
            }
            store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);
            //add skills
            pushSkill(correct, stimulus.skill, subtask);
          } else {
            if (subCorpusName === "rtControl_production") {
              store.session.transact(
                "trialNumTotalControlProduction",
                (oldVal) => oldVal + 1,
              );
            } else {
              store.session.transact(
                "trialNumTotalProduction",
                (oldVal) => oldVal + 1,
              );
              if (correct) {
                store.session.transact("totalCorrect", (oldVal) => oldVal + 1);
              }
              store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);
            }
          }
        }

        updateProgressBar();
        // feed response to fluencyValidityEvaluator for evaluation per trial
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

let source;
export const practiceFeedbackIncorrectDesktop = (
  corpusName,
  assessment_stage_val,
) => {
  let stim = {
    type: jsPsychSurveyHtmlForm,
    html: () => {
      let currentItem = store.session.get("nextStimulus");
      let stimulusFeedback = `<p class="item-stimulus" id="stimulus-val">
              ${currentItem.item_raw}
              <span class="spacing">
                <input type="text" name="question_input" id="question_input_key" class="item-textbox" style="text-align:center">
              </span>
            </p>`;
      if (store.session.get("config").taskName === "fluency-calf") {
        stimulusFeedback = `<span class="equation-feedback stacked" id="stimulus-val">
                <span class="number">${currentItem.operand1}</span>
                <span class="operator">${currentItem.operator}</span>
                <span class="number">${currentItem.operand2}</span>
                <span class="equals">=</span><span class="textbox">
                  <input type="text" name="question_input" id="question_input_key" class="item-textbox" style="text-align:right">
                </span>
              </span>`;
      }

      let practiceFeedbackHTML;
      if (store.session.get("practiceIncorrectCount") === 0) {
        practiceFeedbackHTML = `
          <p class="feedback">
            <span class="gray">
              ${i18next.t("practice.feedbackIncorrect", {
                answer: store.session.get("response"),
              })}
            </span>
          </p>
          <p class="feedback">
            <span class="red">
              ${i18next.t("practice.feedbackIncorrect1")}
            </span>
            <span class="gray">
              ${i18next.t("practice.feedbackIncorrect2")}
            </span>
            
          </p>`;
      } else if (store.session.get("practiceIncorrectCount") === 1) {
        practiceFeedbackHTML = `
          <p class="feedback">
            <span class="gray">
              ${i18next.t("practice.feedbackIncorrect", {
                answer: store.session.get("response"),
              })}
            </span>
          </p>
          <p class="feedback">
            <span class="red">
              ${i18next.t("practice.feedbackIncorrect1")}
            </span>
            <span class="gray">
              ${i18next.t("practice.feedbackIncorrect3", {
                target: currentItem.target,
              })}
            </span><br>
            <span class="gray">
              ${i18next.t("practice.feedbackIncorrect4", {
                target: currentItem.target,
              })}
            </span>
            </p>`;
      }

      return stimulusFeedback + practiceFeedbackHTML;
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = null;
      startTime = performance.now(); //get initial time
    },
    on_load: () => {
      document.getElementById("question_input_key").style.border =
        "1px solid rgb(255,0,0)";
      document.getElementById("question_input_key").focus();

      document
        .getElementById("question_input_key")
        .addEventListener("input", function () {
          textboxVal = this.value;
        });

      async function replayAudio(audioFile) {
        const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

        // Returns a promise of the AudioBuffer of the preloaded file path.
        const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(audioFile);

        source = jsPsychAudioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(jsPsychAudioCtx.destination);
        source.start(0);
      }

      if (store.session.get("practiceIncorrectCount") === 0) {
        replayAudio(mediaAssets.audio.practiceFluencyIncorrect);
      } else if (store.session.get("practiceIncorrectCount") === 1) {
        replayAudio(
          mediaAssets.audio[
            dashToCamelCase(
              "production-" +
                store.session.get("nextStimulus").audio +
                "-incorrect",
            )
          ],
        );
      }

      //hide the survey form submit button
      const submit_button = document.getElementById(
        "jspsych-survey-html-form-next",
      );
      submit_button.classList.add("hide-submit");
      document.getElementById("jspsych-survey-html-form-next").remove();

      const preventKeyDown = (event) => {
        event.preventDefault();
      };
      const storeKeyPress = (event) => {
        //only permit numbers, backspace and enter key
        if (
          (!event.code.includes("Digit") || !isFinite(event.key)) &&
          event.code !== "Backspace" &&
          event.code !== "Enter"
        ) {
          event.preventDefault();
        } else {
          const endTime = performance.now();
          const response_time = Math.round(endTime - startTime);
          const name = event.key;
          key.push(name);
          rt.push(response_time);
        }
      };

      //to prevent long pressing enter key from submitting trial
      function getPromiseFromEvent(item, event) {
        return new Promise((resolve) => {
          const listener = () => {
            item.removeEventListener(event, listener);
            document
              .getElementById("jspsych-survey-html-form")
              .removeEventListener("keydown", preventKeyDown);
            document
              .getElementById("jspsych-survey-html-form")
              .addEventListener("keydown", storeKeyPress);
            resolve();
          };
          item.addEventListener(event, listener);
        });
      }

      async function waitForKeyUp() {
        const form = document.getElementById("jspsych-survey-html-form");
        await getPromiseFromEvent(form, "keyup");
      }

      document
        .getElementById("jspsych-survey-html-form")
        .addEventListener("keydown", preventKeyDown);

      waitForKeyUp();
    },
    on_finish: (data) => {
      if (source) {
        source.stop();
      }
      if (store.session.get("dataCorrect") !== 1) {
        const stimulus = store.session.get("nextStimulus");
        let response_val = Number(textboxVal);
        if (textboxVal === null || textboxVal === "") {
          response_val = "";
        }
        store.session.set("response", response_val);

        //let correct = parseInt(response_val) === stimulus.target; //when csv is stored locally, targets are in int format
        let correct = response_val === Number(stimulus.target); //when csv is stored in bucket, targets are in string format
        if (correct) {
          //store.session.transact("correctCount", (oldVal) => oldVal + 1); //increment count
          store.session.set("dataCorrect", 1); // if response = 1 then the participant got it correct
        } else {
          store.session.set("dataCorrect", 0); // if response = 0 then the participant got it wrong
        }

        let save_trial = !store.session.get("timeOut");
        let subCorpusName = store.session.get("subCorpusName");

        if (store.session.get("responseModality")) {
          let subtask = "FR";
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
          choices: null,
          correct_response_num: null,
          choice_index: null,
          response: response_val,
          correct: store.session.get("dataCorrect"),
          target: stimulus.target,
          distractors: stimulus.distractor_list
            ? stimulus.distractor_list
            : null,
          item_grade_level: "K,1,2,3,4,5,6,7,8,9,10,11,12",
          skill: stimulus.skill,
          //group: store.session.get("config").group,
          response_key_list: key,
          response_time_list: rt,
          is_mobile: isMobile,
        });
      } else {
        store.session.transact("correctCount", (oldVal) => oldVal + 1);
      }
    },
  };
  return stim;
};

export const practiceFeedbackCorrectDesktop = {
  type: jsPsychAudioKeyboardResponse,
  stimulus: () => {
    //let audioFile = store.session.get("nextStimulus").audio;
    return mediaAssets.audio.instructionsFluencyCorrect;
  },
  choices: () => ["Enter"],
  prompt: () => {
    let stimulusFeedback = itemToHtml(store.session.get("nextStimulus"));
    if (store.session.get("config").taskName === "fluency-calf") {
      stimulusFeedback =
        `<span class=equation-feedback stacked>` + stimulusFeedback + `</span>`;
    }
    let practiceFeedbackHTML = `
          <p class="feedback">
            <span class="green">
              ${i18next.t("practice.feedbackCorrect")}
            </span>
          </p>`;
    return stimulusFeedback + practiceFeedbackHTML;
  },
  on_load: () => {
    document.getElementById("question_input_key").value =
      store.session.get("response");
    document.getElementById("question_input_key").style.border =
      "1px solid rgb(0,255,0)";
    store.session.set("allowKeyUp", true); //if we don't press any key here then to allow key press on the next trial
  },
  response_ends_trial: true,
  trial_ends_after_audio: true,
  response_allowed_while_playing: true,
};
