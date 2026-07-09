import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import store from "store2";
import { mediaAssets } from "../../..";
import { updateProgressBar } from "../../shared/helpers";
import { jsPsych } from "../../taskSetup";
import i18next from "i18next";
import { isMobile } from "../../fluency/helpers";

export const symComp = (assessment_stage_val) => {
  return {
    type: jsPsychAudioMultiResponse,
    response_allowed_while_playing: true,
    data: {
      assessment_stage: assessment_stage_val,
    },
    stimulus: mediaAssets.audio.nullAudio,
    prompt_above_buttons: false,
    button_choices: () => store.session.get("nextStimulus").choices,
    button_html: () => {
      return "<button>%choice%</button>";
    },
    on_load: () => {
      document
        .getElementById("jspsych-audio-multi-response-btngroup")
        .classList.add(`num-comp-btn-layout`);

      //disable on load to prevent double clicking
      let buttons = document.querySelectorAll(
        ".jspsych-audio-multi-response-button",
      );

      buttons.forEach((btn) => {
        btn.classList.add("disabled-btn-color");
      });

      // Re-enable after 250ms
      setTimeout(() => {
        buttons.forEach((btn) => {
          btn.classList.remove("disabled-btn-color");
        });
      }, 250);
    },
    on_finish: (data) => {
      const stimulus = store.session.get("nextStimulus");

      // check response and record it
      let response_val = stimulus.choices[data.button_response];
      let correct = data.button_response === stimulus.correctResponseNum;

      if (correct) {
        store.session.set("dataCorrect", 1); // if response = 1 then the participant got it correct
      } else {
        store.session.set("dataCorrect", 0); // if response = 0 then the participant got it wrong
      }

      let save_trial = !store.session.get("timeOut");

      let subCorpusName = store.session.get("subCorpusName");

      jsPsych.data.addDataToLastTrial({
        subtask: "symbolicComp",
        save_trial: save_trial,
        pid: store.session.get("config").pid,
        corpus_name: subCorpusName,
        trial_num_block: store.session.get("indexTracking") + 1,
        item_id: stimulus.itemID,
        order_id: stimulus.orderID,
        theoretical_difficulty: stimulus.difficulty,
        choices: stimulus.choices,
        correct_response_num: stimulus.correctResponseNum,
        choice_index: data.button_response,
        response: response_val,
        correct: store.session.get("dataCorrect"),
        target: stimulus.target,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        bin_description: stimulus.bin_description,
        distance: stimulus.distance,
        is_mobile: isMobile,
      });

      // progress bar
      updateProgressBar();

      /*if (save_trial) {
                if (correct) {
                    store.session.transact("totalCorrect", (oldVal) => oldVal + 1);
                }
                store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);
            }*/
    },
  };
};

export const practiceFeedbackIncorrect = (corpusName, assessment_stage_val) => {
  let stim = {
    type: jsPsychAudioMultiResponse,
    response_allowed_while_playing: true,
    data: {
      assessment_stage: assessment_stage_val,
    },
    stimulus: () => {
      if (store.session.get("grade") < 2) {
        return mediaAssets.audio[
          "symCompFeedbackIncorrect" +
            store.session.get("nextStimulus").itemID +
            "K"
        ];
      } else {
        return mediaAssets.audio[
          "symCompFeedbackIncorrect" + store.session.get("nextStimulus").itemID
        ];
      }
    },
    prompt_above_buttons: false,
    button_choices: () => store.session.get("nextStimulus").choices,
    button_html: () => {
      return "<button>%choice%</button>";
    },

    on_load: () => {
      document
        .getElementById("jspsych-audio-multi-response-btngroup")
        .classList.add(`num-comp-btn-layout`);

      //disable on load to prevent double clicking
      let buttons = document.querySelectorAll(
        ".jspsych-audio-multi-response-button",
      );

      buttons.forEach((button) => {
        if (
          parseInt(button.textContent.trim()) ===
          store.session.get("nextStimulus").target
        ) {
          button.classList.add("glowingButton");
        } else {
          button.classList.add("disabled-btn-practice");
        }
      });

      let stimulus = store.session.get("nextStimulus");

      let feedbackType = "magpiPilot.symbolicComp.practice.incorrect";
      if (store.session.get("grade") < 2) {
        feedbackType = "magpiPilot.symbolicComp.practice.incorrectK";
      }

      let practiceFeedbackHTML = `
          <p class="feedback">
            <span class="gray">
              ${i18next.t(feedbackType, {
                target: stimulus.target,
                distractor: stimulus.distractor_list[0],
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
        store.session.set("dataCorrect", 1); // if response = 1 then the participant got it correct
      } else {
        store.session.set("dataCorrect", 0); // if response = 0 then the participant got it wrong
      }

      let save_trial = true;

      let subCorpusName = store.session.get("subCorpusName");

      jsPsych.data.addDataToLastTrial({
        subtask: "symbolicComp",
        save_trial: save_trial,
        pid: store.session.get("config").pid,
        corpus_name: subCorpusName,
        trial_num_block: store.session.get("indexTracking") + 1,
        item_id: stimulus.itemID,
        order_id: stimulus.orderID,
        theoretical_difficulty: stimulus.difficulty,
        choices: stimulus.choices,
        correct_response_num: stimulus.correctResponseNum,
        choice_index: data.button_response,
        response: response_val,
        correct: store.session.get("dataCorrect"),
        target: stimulus.target,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        bin_description: stimulus.bin_description,
        distance: stimulus.distance,
        is_mobile: isMobile,
      });
    },
  };
  return stim;
};

export const practiceFeedbackCorrect = {
  type: jsPsychAudioMultiResponse,
  response_ends_trial: false,
  trial_ends_after_audio: true,
  response_allowed_while_playing: false,
  stimulus: () => {
    if (store.session.get("grade") < 2) {
      return mediaAssets.audio[
        "symCompFeedbackCorrect" +
          store.session.get("nextStimulus").itemID +
          "K"
      ];
    } else {
      return mediaAssets.audio[
        "symCompFeedbackCorrect" + store.session.get("nextStimulus").itemID
      ];
    }
  },
  prompt_above_buttons: false,
  button_choices: () => store.session.get("nextStimulus").choices,
  button_html: () => {
    return "<button>%choice%</button>";
  },
  on_load: () => {
    document
      .getElementById("jspsych-audio-multi-response-btngroup")
      .classList.add(`num-comp-btn-layout`);

    //disable on load to prevent double clicking
    let buttons = document.querySelectorAll(
      ".jspsych-audio-multi-response-button",
    );

    buttons.forEach((button) => {
      if (
        parseInt(button.textContent.trim()) ===
        store.session.get("nextStimulus").target
      ) {
        button.classList.add("glowingButton");
      } else {
        button.classList.add("disabled-btn-practice");
      }
    });

    let stimulus = store.session.get("nextStimulus");

    let feedbackType = "magpiPilot.symbolicComp.practice.correct";
    if (store.session.get("grade") < 2) {
      feedbackType = "magpiPilot.symbolicComp.practice.correctK";
    }

    let practiceFeedbackHTML = `
            <p class="feedback">
                <span class="gray">
                ${i18next.t(feedbackType, {
                  target: stimulus.target,
                  distractor: stimulus.distractor_list[0],
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
};
