import store from "store2";
import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { jsPsych } from "../../taskSetup";
import { mediaAssets } from "../../..";
import { validityEvaluator } from "../timeline";
import { camelize } from "@bdelab/roar-utils";
import { startTimer } from "../helpers/updateCountDown";
import { catIRT } from "../timeline";
import {
  addResponse,
  endGame,
  updateSkillScores,
  scaleTheta,
} from "./trialHelpers";
import { scaleJsPsychContentToFit } from "./scaleContent";
import { updateGradeEstimateObject } from "./gradeEstimateHelpers";
import { isMobile } from "./trialHelpers";

let source;
let audioFile;

//Displays a multiple choice question, with images as options that are displayed in 2 rows
export const multiChoiceImage = (corpusName, assessment_stage_val) => {
  let stim = {
    type: jsPsychAudioMultiResponse,
    response_allowed_while_playing: true,
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    stimulus: () => {
      if (
        store.session.get("replayButton") &&
        store.session.get("nextStimulus").audio_file !== ""
      ) {
        audioFile = store.session.get("nextStimulus").audio_file;
      } else {
        audioFile = "nullAudio";
      }
      return mediaAssets.audio[audioFile];
    },
    prompt: () => {
      let currentItem = store.session.get("nextStimulus");
      let questionHTML = `<p>` + currentItem.item + `</p>`;
      let replayButton = ``;
      if (
        store.session.get("replayButton") &&
        store.session.get("nextStimulus").audio_file !== ""
      ) {
        replayButton = `<img id="replay" draggable="false" src="${mediaAssets.images.iconSpeaker}" alt="replay"/>`;
      }
      //position the image after the item, if an image is part of the question
      if (currentItem.addImage) {
        questionHTML +=
          `<img src="${
            mediaAssets.images[
              "coreMathProblem" +
                currentItem.problemID +
                "Version" +
                currentItem.version
            ]
          }" style="height:` +
          currentItem.image_height +
          `vh;">`;
      }

      questionHTML = `<div class=question-box>` + questionHTML + `</div>`;

      //to set the dimensions of the timer in pixels (make sure it is even)
      let diameter = 2 * Math.round(window.innerWidth * 0.05); //hard code timer to be 10% width of screen

      return (
        `<canvas id="canvas-timer" width="${diameter}" height="${diameter}" class="canvas-timer"></canvas>` +
        replayButton +
        `<div class=item-stimulus-long>` +
        questionHTML +
        `</div>`
      );
    },
    prompt_above_buttons: true,
    button_choices: () => {
      let choices = store.session.get("nextStimulus").choices;
      let choice_images = [];
      for (var i = 0; i < choices.length; i++) {
        choice_images.push(mediaAssets.images[camelize(choices[i])]);
      }
      return choice_images;
    },
    button_html: () => {
      return `<img draggable="false" style="height:${
        store.session.get("nextStimulus").image_height
      }vh;" src="%choice%" alt="response"/>`;
    },
    on_start: () => {
      //set the timer only for the default usermode
      if (store.session.get("config").userMode === "default") {
        const timerId = setTimeout(() => {
          store.session.set("timeOut", true);
          jsPsych.finishTrial();
        }, store.session.get("nextStimulus").time_limit);
        store.session.set("timerId", timerId);
      }
    },
    on_load: () => {
      //add the button design
      if (store.session.get("nextStimulus").choices.length < 6) {
        document
          .getElementById("jspsych-audio-multi-response-btngroup")
          .classList.add(`nafc-btn-layout`);
      } else {
        document
          .getElementById("jspsych-audio-multi-response-btngroup")
          .classList.add(`grid-layout`);
      }

      //set the timer only for the default usermode
      if (store.session.get("config").userMode === "default") {
        // set timeout for showing the countdown
        let countdownTime = store.session.get("nextStimulus").countdown_time;
        const timerIdCountdown = setTimeout(() => {
          startTimer(countdownTime);
        }, store.session.get("nextStimulus").countDownAppears);
        store.session.set("timerIdCountdown", timerIdCountdown);
      }

      //setup replay button
      async function replayAudio() {
        // pause audio
        if (source) {
          source.stop();
        }

        const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

        // Returns a promise of the AudioBuffer of the preloaded file path.
        const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(
          mediaAssets.audio[audioFile],
        );

        source = jsPsychAudioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(jsPsychAudioCtx.destination);
        source.start(0);
      }

      if (
        store.session.get("replayButton") &
        (store.session.get("nextStimulus").audio_file !== "")
      ) {
        const replayBtn = document.getElementById("replay");
        replayBtn.addEventListener("click", replayAudio);
      }

      //disable on load to prevent double clicking
      let buttons = document.querySelectorAll(
        ".jspsych-audio-multi-response-button",
      );

      buttons.forEach((btn) => {
        btn.classList.add("disabled-btn-color");
      });

      // Re-enable after 1 second
      setTimeout(() => {
        buttons.forEach((btn) => {
          btn.classList.remove("disabled-btn-color");
        });
      }, 1000);

      //scale content to fit the screen
      scaleJsPsychContentToFit();
      window.addEventListener("resize", scaleJsPsychContentToFit);
    },
    on_finish: (data) => {
      // stop the function that updates the countdown timer
      clearInterval(store.session.get("intervalId"));
      clearTimeout(store.session.get("timerId"));
      clearTimeout(store.session.get("timerIdCountdown"));
      window.removeEventListener("resize", scaleJsPsychContentToFit);

      // pause audio
      if (source) {
        source.stop();
      }

      //all trials are saved, but timeout trials are marked incorrect
      const stimulus = store.session.get("nextStimulus");
      let response_val = stimulus.choices[data.button_response];
      let correct =
        data.button_response === stimulus.correctResponseNum &&
        !store.session.get("timeOut")
          ? 1
          : 0;
      // for adding response to tracker
      store.session.set("dataCorrect", correct);

      //update grade estimate object
      let zetaGrade = {
        a: stimulus.a,
        b: stimulus.b_grade,
        c: stimulus.c,
        d: stimulus.d,
      };
      let gradeEstimateObject = store.session.get("gradeEstimateObject");
      updateGradeEstimateObject(
        gradeEstimateObject,
        "composite",
        zetaGrade,
        correct,
        stimulus.b_grade,
      );
      updateGradeEstimateObject(
        gradeEstimateObject,
        stimulus.skill_category_camel,
        zetaGrade,
        correct,
        stimulus.b_grade,
      );
      store.session.set("gradeEstimateObject", gradeEstimateObject);

      //update cat to get theta estimate
      if (stimulus.b !== null && !Number.isNaN(stimulus.b)) {
        let zetaIRT = {
          a: stimulus.a,
          b: stimulus.b,
          c: stimulus.c,
          d: stimulus.d,
        };
        catIRT.updateAbilityEstimate(zetaIRT, correct);
        store.session.set("thetaEstimateRaw", catIRT.theta);
        store.session.set("thetaEstimate", scaleTheta(catIRT.theta));
      }

      //add response to tracker
      addResponse(correct, store.session.get("responseWindowSize"));

      //check if game will end with this trial, updates grade estimates if game end is true
      endGame(
        store.session.get("responseTracker"),
        store.session.get("stopCriterion"),
        store.session.get("responseWindowSize"),
      );

      //update subskill scores
      updateSkillScores(correct, stimulus);

      jsPsych.data.addDataToLastTrial({
        save_trial: true,
        time_out: store.session.get("timeOut"),
        pid: store.session.get("config").pid,
        subtask: stimulus.skill_category_camel,
        skill: stimulus.skill,
        skill_category: stimulus.skill_category,
        corpus_name: "multiChoiceImage",
        trial_num_total: store.session.get("trialNumTotal") + 1,
        trial_num_block: store.session.get("indexTracking") + 1,
        item_id: stimulus.itemID,
        problem_id: stimulus.problemID,
        problem_version: stimulus.version,
        item_grade_level: stimulus.cc_grade_level,
        theoretical_difficulty: stimulus.cc_grade_level,
        choices: stimulus.choices,
        correct_response_num: stimulus.correctResponseNum,
        choice_index: data.button_response,
        response: response_val,
        correct: store.session.get("dataCorrect"),
        thetaEstimateRaw: catIRT.theta,
        thetaEstimate: store.session.get("thetaEstimate"),
        thetaSE:
          catIRT.seMeasurement === Infinity
            ? Number.MAX_VALUE
            : catIRT.seMeasurement,
        item: stimulus.item_raw,
        target: stimulus.target[0],
        response_key_list: null,
        response_time_list: null,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        is_mobile: isMobile,
      });

      // update trial count
      if (corpusName === "stimulus") {
        store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);

        // feed response to fluencyValidityEvaluator for evaluation per trial
        validityEvaluator.addResponseData(
          data.rt,
          response_val == null ? response_val : response_val.toString(),
          store.session.get("dataCorrect"),
        );
      }

      //if the very next trial is textboxResponse, key press should be allowed
      store.session.set("allowKeyUp", true);
    },
  };
  return stim;
};
