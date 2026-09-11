/*
Defines the jspsych object for the task trial (practice or main). Includes the object which will control sound after response is given in main task.
Data of each trial will be saved in jspsych data on finish of trial. Some session data variables are updated.
*/

/*import store from "store2"; //storing session data
import { jsPsych } from "../../taskSetup";
import jsPsychHtmlSwipeResponse from "@jspsych-contrib/plugin-html-swipe-response";
import { updateProgressBar } from "../helpers/updateProgressBar";
import { validityEvaluator } from "../timeline";

export const numberMainSwipe = (corpusName, assessment_stage_val) => {
  let stim = {
    type: jsPsychHtmlSwipeResponse,
    stimulus: () => {
      return (
        `<div class="item-stimulus">` +
        store.session.get("nextStimulus").item +
        `</div>`
      );
    },
    data: {
      assessment_stage: assessment_stage_val,
    },
    button_choices: () => store.session.get("nextStimulus").choices,
    keyboard_choices: () => ["ArrowLeft", "ArrowRight"],
    button_html: () => {
      return [
        `<button class="item-swipe-btn left" id="response0">
        <span class="button-text-left"><i class="arrow left"></i>%choice%</span>
        </button>`,
        `<button class="item-swipe-btn right" id="response1">
        <span class="button-text-right">%choice%<i class="arrow right"></i></span>
        </button>`,
      ];

      return([
        `<button class="item-swipe-btn">
        <img src="${mediaAssets.images.arrowLeft}" alt="button">
        <span class="button-text-left">%choice%</span>
        </button>`,
        `<button class="item-swipe-btn">
        <img src="${mediaAssets.images.arrowRight}" alt="button">
        <span class="button-text-right">%choice%</span>
        </button>`
      ]);
    },
    swipe_animation_duration: 600,
    on_finish: (data) => {
      const stimulus = store.session.get("nextStimulus");

      let response_val, response;

      if (data.response_source === "keyboard") {
        response = data.keyboard_response;
        if (
          data.keyboard_response === "ArrowLeft" ||
          data.keyboard_response === "arrowleft"
        ) {
          response_val = stimulus.choices[0];
        } else {
          //arrow right
          response_val = stimulus.choices[1];
        }
      } else if (data.response_source == "swipe") {
        response = data.swipe_response;
        if (data.swipe_response === "left") {
          response_val = stimulus.choices[0];
        } else {
          //swipe right
          response_val = stimulus.choices[1];
        }
      } else {
        //button response
        response = data.button_response;
        response_val = stimulus.choices[data.button_response];
      }

      //let correct = parseInt(response_val) === stimulus.target; //when csv is stored locally, targets are in int format
      let correct = response_val === stimulus.target; //when csv is stored in bucket, targets are in string format

      // required for practice feedback
      if (correct) {
        store.session.transact("correctCount", (oldVal) => oldVal + 1); //increment count
        store.session.set("dataCorrect", 1); // if response = 1 then the participant got it correct
      } else {
        store.session.set("dataCorrect", 0); // if response = 0 then the participant got it wrong
      }

      let save_trial = !store.session("timeOut");

      jsPsych.data.addDataToLastTrial({
        save_trial: save_trial,
        pid: store.session.get("config").pid,
        corpus_name: store.session.get("subCorpusName"),
        trial_num_block: store.session("indexTracking") + 1,
        item_id: stimulus.itemID,
        order_id: stimulus.orderID,
        vector_id: stimulus.vectorID,
        position_id: stimulus.positionID,
        theoretical_difficulty: stimulus.difficulty,
        item: stimulus.item_raw,
        operation: stimulus.operator,
        choices: stimulus.choices,
        correct_response_num: stimulus.correctResponseNum,
        choice_index: response,
        response: response_val,
        correct: store.session("dataCorrect"),
        target: stimulus.target,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        item_grade_level: "K,1,2,3,4,5,6,7,8,9,10,11,12",
        //group: store.session.get("config").group,
        response_key_list: null,
        response_time_list: null,
      });

      // progress bar
      if (corpusName !== "practice") {
        if (save_trial) {
          if (correct) {
            store.session.transact("totalCorrect", (oldVal) => oldVal + 1);
          }
          store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);
        }

        updateProgressBar();
        // feed response to fluencyValidityEvaluator for evaluation per trial
        if (store.session.get("evaluateValidity")) {
          validityEvaluator.addResponseData(
            data.rt,
            response_val,
            store.session("dataCorrect"),
          );
        }
      }
    },
  };
  return stim;
};
*/
