import store from "store2";
import { jsPsych } from "../../taskSetup";
import jsPsychSurveyHtmlForm from "@jspsych/plugin-survey-html-form";
import jsPsychHtmlKeyboardResponse from "@jspsych/plugin-html-keyboard-response";
import { mediaAssets } from "../../..";
import i18next from "i18next";
import { validityEvaluator } from "../timeline";
import { startTimer } from "../helpers/updateCountDown";
import { catIRT } from "../timeline";
import { SimpleKeyboard } from "simple-keyboard";
//import "simple-keyboard/build/css/index.css";
import { isMobile } from "./trialHelpers";
import {
  addResponse,
  endGame,
  updateSkillScores,
  scaleTheta,
} from "./trialHelpers";
import { scaleContentToFitMobile } from "./scaleContent";
import { updateGradeEstimateObject } from "./gradeEstimateHelpers";

let rt = [];
let key = [];
let textboxVal = [];
let startTime;

const storeKeyRT = (keyName) => {
  const endTime = performance.now();
  const response_time = Math.round(endTime - startTime);
  if (keyName === "{enter}") {
    key.push("Enter");
  } else if (keyName === "{bksp}") {
    key.push("Backspace");
  } else {
    key.push(keyName);
  }
  rt.push(response_time);
};

// Shows a textbox for responding, takes in keyboard input.
const desktopKeyboard = (corpusName, assessment_stage_val) => {
  let stim = {
    type: jsPsychSurveyHtmlForm,
    html: () => {
      let currentItem = store.session.get("nextStimulus");
      let questionHTML = `<p>` + currentItem.item + `</p>`;
      let responseHTML = ``;
      let submitButton = ``;
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
      if (currentItem.response_format[0] === "single") {
        responseHTML =
          `<div class="response-horizontal">
              <input type="text" name="question_input_0" id="question_input_key_0" class="response-box" style="text-align:center; width:` +
          currentItem.textbox_width +
          `vw;">
            </div>`;
      } else if (currentItem.response_format[0] === "fraction") {
        responseHTML =
          `<input type="text" name="question_input_0" id="question_input_key_0" class="response-box" style="text-align:center; width:` +
          currentItem.textbox_width +
          `vw;">
              <hr>
              <input type="text" name="question_input_1" id="question_input_key_1" class="response-box" style="text-align:center; width:` +
          currentItem.textbox_width +
          `vw;">`;
      } else {
        //For items which require a text value before the textbox such as x=
        for (let i = 0; i < currentItem.response_format.length; i++) {
          if (
            i == 1 &&
            currentItem.response_format[0] == "leadIn" &&
            currentItem.response_format[1] == "leadOut"
          ) {
            responseHTML += `<p>,</p>`;
          }
          if (currentItem.response_format[i] == "leadIn") {
            responseHTML +=
              `<p>` +
              currentItem.lead[i] +
              `</p>
              <input type="text" name="question_input_` +
              i +
              `" id="question_input_key_` +
              i +
              `" class="response-box" style="text-align:center; width:` +
              currentItem.textbox_width +
              `vw;">`;
          } else {
            responseHTML +=
              `<input type="text" name="question_input_` +
              i +
              `" id="question_input_key_` +
              i +
              `" class="response-box" style="text-align:center; width:` +
              currentItem.textbox_width +
              `vw;">
              <p>` +
              currentItem.lead[i] +
              `</p>`;
          }
        }
        responseHTML =
          `<div class="response-horizontal">` + responseHTML + `</div>`;
      }

      //add submit button if there's more than 1 textbox
      if (
        currentItem.response_format.length > 1 ||
        currentItem.response_format[0] === "fraction"
      ) {
        submitButton = `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`;
      }

      //to set the dimensions of the timer in pixels (make sure it is even)
      let diameter = 2 * Math.round(window.innerWidth * 0.05); //hard code timer to be 10% width of screen

      return (
        `<canvas id="canvas-timer" width="${diameter}" height="${diameter}" class="canvas-timer"></canvas>
        <div class=item-stimulus-long>` +
        questionHTML +
        responseHTML +
        `<p class="warning-text" id="warning">${i18next.t("warning")}</p>
        </div>` +
        submitButton
      );
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = [];
      startTime = performance.now(); //get initial time
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
      document.getElementById("question_input_key_0").focus();

      let currentItem = store.session.get("nextStimulus");
      let responseFormat = currentItem.response_format;

      // Track which textbox is currently focused
      let currentTextbox = "textbox1";
      if (responseFormat.length > 1) {
        document
          .getElementById("question_input_key_0")
          .addEventListener("focus", function () {
            currentTextbox = "textbox1";
          });
        document
          .getElementById("question_input_key_1")
          .addEventListener("focus", function () {
            currentTextbox = "textbox2";
          });
      }

      //store the textbox value at each keypress
      document
        .getElementById("question_input_key_0")
        .addEventListener("input", function () {
          textboxVal[0] = this.value;
        });
      if (responseFormat.length > 1 || responseFormat[0] === "fraction") {
        document
          .getElementById("question_input_key_1")
          .addEventListener("input", function () {
            textboxVal[1] = this.value;
          });
      }
      //set the timer only for the default usermode
      if (store.session.get("config").userMode === "default") {
        //set time out for when countdown appears
        let countdownTime = store.session.get("nextStimulus").countdown_time;
        const timerIdCountdown = setTimeout(() => {
          startTimer(countdownTime);
        }, store.session.get("nextStimulus").countDownAppears);
        store.session.set("timerIdCountdown", timerIdCountdown);
      }

      //disable advance button to prevent double clicks
      const btn = document.getElementById("go-button-id");
      if (btn) {
        btn.style.pointerEvents = "none";
        setTimeout(() => {
          btn.style.pointerEvents = "auto";
        }, 1000);
      }

      //hide the survey form submit button
      const submit_button = document.getElementById(
        "jspsych-survey-html-form-next",
      );
      submit_button.classList.add("hide-submit");

      const preventKeyDown = (event) => {
        event.preventDefault();
      };

      const storeKeyPress = (event) => {
        if (responseFormat[0] === "fraction" && event.code === "ArrowUp") {
          //to switch between response boxes in fraction problems
          storeKeyRT(event.key);
          event.preventDefault();
          let element = document.getElementById("question_input_key_0");
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
        } else if (
          responseFormat[0] === "fraction" &&
          event.code === "ArrowDown"
        ) {
          //to switch between response boxes in fraction problems
          storeKeyRT(event.key);
          event.preventDefault();
          let element = document.getElementById("question_input_key_1");
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
        } else if (
          responseFormat.length == 2 &&
          currentTextbox === "textbox1" &&
          event.code === "ArrowRight"
        ) {
          //to switch to right side box if 2 inputs x=, y=)
          storeKeyRT(event.key);
          event.preventDefault();
          let element = document.getElementById("question_input_key_1");
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
        } else if (
          responseFormat.length == 2 &&
          currentTextbox === "textbox2" &&
          event.code === "ArrowLeft"
        ) {
          //to switch to left side box if 2 inputs x=, y=)
          storeKeyRT(event.key);
          event.preventDefault();
          let element = document.getElementById("question_input_key_0");
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
        } else if (
          event.code === "Enter" &&
          !store.session.get("warningVisible") &&
          (responseFormat.length > 1 || responseFormat[0] === "fraction")
        ) {
          storeKeyRT(event.key);
          let textEmpty0 =
            document.getElementById("question_input_key_0").value.trim() === "";
          let textEmpty1 =
            document.getElementById("question_input_key_1").value.trim() === "";
          if (textEmpty0 != textEmpty1) {
            event.preventDefault();
            document.getElementById("warning").style.visibility = "visible";
            store.session.set("warningVisible", true);
          }
        } else if (
          (!event.code.includes("Digit") || !isFinite(event.key)) &&
          event.code !== "Backspace" &&
          event.code !== "Enter" &&
          !(event.code === "Minus" && event.key === "-") &&
          !(
            event.code === store.session.get("decimalCode") &&
            event.key === store.session.get("decimalKey")
          )
        ) {
          //only allows numbers, backspace, minus, decimal key, and enter
          event.preventDefault();
        } else {
          storeKeyRT(event.key);
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

      if (responseFormat.length > 1 || responseFormat[0] === "fraction") {
        document
          .getElementById("go-button-id")
          .addEventListener("click", function () {
            //show warning if one textbox is empty
            if (!store.session.get("warningVisible")) {
              let textEmpty0 =
                document.getElementById("question_input_key_0").value.trim() ===
                "";
              let textEmpty1 =
                document.getElementById("question_input_key_1").value.trim() ===
                "";
              if (textEmpty0 != textEmpty1) {
                document.getElementById("warning").style.visibility = "visible";
                store.session.set("warningVisible", true);
              } else {
                //so that key press is allowed at the start of next trial
                store.session.set("allowKeyUp", true);
                jsPsych.finishTrial();
              }
            } else {
              //so that key press is allowed at the start of next trial
              store.session.set("allowKeyUp", true);
              jsPsych.finishTrial();
            }
          });
      }
    },
    on_finish: (data) => {
      // stop the function that updates the countdown timer
      clearInterval(store.session.get("intervalId"));
      clearTimeout(store.session.get("timerId"));
      clearTimeout(store.session.get("timerIdCountdown"));

      store.session.set("warningVisible", false);

      const stimulus = store.session.get("nextStimulus");
      const switchDecimal = store.session.get("switchDecimal");
      const decimalKey = store.session.get("decimalKey");

      const normalize = (val) => {
        if (val === null || val === "") return null;
        if (switchDecimal && typeof val === "string") {
          val = val.replace(decimalKey, ".");
        }
        return Number(val);
      };

      const hasDecimalResponse = textboxVal.some(
        (val) => typeof val === "string" && val.includes(decimalKey),
      );

      const targets = stimulus.target.map(normalize);
      const responses = textboxVal.map(normalize);

      let correctCount = 0;
      //multiple textboxes
      if (textboxVal.length != 0) {
        for (let i = 0; i < textboxVal.length; i++) {
          if (responses[i] === targets[i]) {
            correctCount++;
          }
        }

        //handles switched order for items requiring 2 "x" values
        if (stimulus.lead_raw.length === 2) {
          if (
            stimulus.lead_raw[1] === i18next.t("terms.problem2x") &&
            responses[0] === targets[1] &&
            responses[1] === targets[0]
          ) {
            correctCount = 2;
          }
        }

        if (stimulus.response_format[0] === "fraction") {
          //handles fractions in which a decimal point was written in either numerator or denominator
          if (hasDecimalResponse) {
            correctCount = 0;
          } else if (
            //handles fractions that are not simplified only for problems that don't say simplify
            !stimulus.item_raw.includes(
              i18next.t("terms.simplifiedFraction"),
            ) &&
            correctCount === 0
          ) {
            if (responses[0] * targets[1] === targets[0] * responses[1]) {
              correctCount = 2;
            }
          }
        }
      }

      //all trials are saved, but timeout trials are marked incorrect
      let correct =
        correctCount === stimulus.target.length && !store.session.get("timeOut")
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
        corpus_name: "textboxResponse",
        trial_num_total: store.session.get("trialNumTotal") + 1,
        trial_num_block: store.session.get("indexTracking") + 1,
        item_id: stimulus.itemID,
        problem_id: stimulus.problemID,
        problem_version: stimulus.version,
        item_grade_level: stimulus.cc_grade_level,
        theoretical_difficulty: stimulus.cc_grade_level,
        choices: null,
        correct_response_num: null,
        choice_index: null,
        response: responses,
        correct: store.session.get("dataCorrect"),
        thetaEstimateRaw: catIRT.theta,
        thetaEstimate: store.session.get("thetaEstimate"),
        thetaSE:
          catIRT.seMeasurement === Infinity
            ? Number.MAX_VALUE
            : catIRT.seMeasurement,
        item: stimulus.item_raw,
        target: stimulus.target,
        response_key_list: key,
        response_time_list: rt,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        is_mobile: isMobile,
      });

      // update trial count
      if (corpusName === "stimulus") {
        store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);

        // feed response to fluencyValidityEvaluator for evaluation per trial
        validityEvaluator.addResponseData(
          data.rt,
          responses.length == 0 ? "" : responses.toString(),
          store.session.get("dataCorrect"),
        );
      }
    },
  };
  return stim;
};

// Shows a textbox for responding, takes input from an on-screen keyboard.
const mobileKeyboard = (corpusName, assessment_stage_val) => {
  let stim = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => {
      let currentItem = store.session.get("nextStimulus");
      let questionHTML = `<p>` + currentItem.item + `</p>`;
      let responseHTML = ``;
      //to set the dimensions of the timer in pixels (make sure it is even)
      let diameter = 2 * Math.round(window.innerWidth * 0.05); //hard code timer to be 10% width of screen

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
      if (currentItem.response_format[0] === "single") {
        responseHTML =
          `<div class="response-horizontal">
              <div name="question_input_0" id="question_input_key_0" class="response-box-mobile" style="text-align:center; width:` +
          currentItem.textbox_width +
          `vw;" tabindex="0"></div>
          </div>`;
      } else if (currentItem.response_format[0] === "fraction") {
        responseHTML =
          `<div class="fraction-mobile">
              <div name="question_input_0" id="question_input_key_0" class="response-box-mobile" style="text-align:center; width:` +
          currentItem.textbox_width +
          `vw;" tabindex="0"></div>
              <hr>
              <div name="question_input_1" id="question_input_key_1" class="response-box-mobile" style="text-align:center; width:` +
          currentItem.textbox_width +
          `vw;" tabindex="0"></div>
          </div>
          <p class="warning-text" id="warning">${i18next.t(
            "warning-mobile",
          )}</p>`;
      } else {
        //For items which require a text value before the textbox such as x=
        for (let i = 0; i < currentItem.response_format.length; i++) {
          if (
            i == 1 &&
            currentItem.response_format[0] == "leadIn" &&
            currentItem.response_format[1] == "leadOut"
          ) {
            responseHTML += `<p>,</p>`;
          }
          if (currentItem.response_format[i] == "leadIn") {
            responseHTML +=
              `<p>` +
              currentItem.lead[i] +
              `</p>
              <div name="question_input_` +
              i +
              `" id="question_input_key_` +
              i +
              `" class="response-box-mobile" style="text-align:center; width:` +
              currentItem.textbox_width +
              `vw;" tabindex="0"></div>`;
          } else {
            responseHTML +=
              `<div name="question_input_` +
              i +
              `" id="question_input_key_` +
              i +
              `" class="response-box-mobile" style="text-align:center; width:` +
              currentItem.textbox_width +
              `vw;" tabindex="0"></div>
              <p>` +
              currentItem.lead[i] +
              `</p>`;
          }
        }
        responseHTML =
          `<div class="response-horizontal">` +
          responseHTML +
          `</div><p class="warning-text" id="warning">${i18next.t(
            "warning-mobile",
          )}</p>`;
      }

      return (
        `<canvas id="canvas-timer" width="${diameter}" height="${diameter}" class="canvas-timer"></canvas>
        <div class="containerMobile">
        <div class="item-stimulus-long item-stimulus-simple-keyboard" id="contentWrapper">` +
        questionHTML +
        responseHTML +
        `</div>
        <div class="simple-keyboard" id="simple-keyboard"></div>
        </div>`
      );
    },
    data: {
      // Here is where we specify that we should save the trial to Firestore
      assessment_stage: assessment_stage_val,
    },
    on_start: () => {
      //initialise variables for trial
      rt = [];
      key = [];
      textboxVal = [];
      startTime = performance.now(); //get initial time
      //set the timer only for the default usermode
      if (store.session.get("config").userMode === "default") {
        const timerId = setTimeout(() => {
          store.session.set("timeOut", true);
          jsPsych.finishTrial();
        }, store.session.get("nextStimulus").time_limit);
        store.session.set("timerId", timerId);
      }
    },
    choices: "NO_KEYS",
    response_ends_trials: false,
    on_load: () => {
      let responseFormat = store.session.get("nextStimulus").response_format;
      //focus the first textbox
      let currentIdx = 0;
      let currentInput = document.getElementById("question_input_key_0");
      currentInput.classList.add("focused");

      const decimalKey = store.session.get("decimalKey");

      const keyboard = new SimpleKeyboard({
        layout: {
          default: [
            "1 2 3 4 5 6 7 8 9 0",
            `{bksp} {empty} {empty} ${decimalKey} - {empty} {empty} {enter}`,
          ],
        },
        display: {
          "{bksp}": `${i18next.t(
            "terms.delete",
          )} <span class="big-symbol">\u232B</span>`,
          "{enter}": `${i18next.t(
            "terms.submit",
          )} <span class="big-symbol">\u2713</span>`,
          "{empty}": " ", // Prevents rendering key value
        },
        onChange: (input) => onChange(input),
        onKeyPress: (button) => onKeyPress(button),
      });

      document.querySelectorAll(".response-box-mobile").forEach((el) => {
        el.addEventListener("click", () => {
          if (currentInput) currentInput.classList.remove("focused");
          currentInput = el;
          currentInput.classList.add("focused");
          currentIdx = [
            ...document.querySelectorAll(".response-box-mobile"),
          ].indexOf(currentInput);
        });
      });

      function onChange(input) {
        if (currentIdx >= 0) {
          textboxVal[currentIdx] = document.getElementById(
            "question_input_key_" + currentIdx,
          ).textContent;
        }
      }

      function onKeyPress(button) {
        if (!currentInput) return;
        storeKeyRT(button);
        if (button === "{bksp}") {
          currentInput.textContent = currentInput.textContent.slice(0, -1);
        } else if (button === "{enter}") {
          //show the warning for fraction problems if one textbox is empty
          if (
            !store.session.get("warningVisible") &&
            (responseFormat.length > 1 || responseFormat[0] === "fraction")
          ) {
            let textEmpty0 =
              document
                .getElementById("question_input_key_0")
                .textContent.trim() === "";
            let textEmpty1 =
              document
                .getElementById("question_input_key_1")
                .textContent.trim() === "";
            if (textEmpty0 != textEmpty1) {
              document.getElementById("warning").style.visibility = "visible";
              store.session.set("warningVisible", true);
            } else {
              jsPsych.finishTrial();
            }
          } else {
            jsPsych.finishTrial();
          }
        } else {
          currentInput.textContent += button;
        }
      }

      //set the timer only for the default usermode
      if (store.session.get("config").userMode === "default") {
        //set time out for when countdown appears
        let countdownTime = store.session.get("nextStimulus").countdown_time;
        const timerIdCountdown = setTimeout(() => {
          startTimer(countdownTime);
        }, store.session.get("nextStimulus").countDownAppears);
        store.session.set("timerIdCountdown", timerIdCountdown);
      }

      scaleContentToFitMobile();
      window.addEventListener("resize", scaleContentToFitMobile);
    },
    on_finish: (data) => {
      // stop the function that updates the countdown timer
      clearInterval(store.session.get("intervalId"));
      clearTimeout(store.session.get("timerId"));
      clearTimeout(store.session.get("timerIdCountdown"));
      window.removeEventListener("resize", scaleContentToFitMobile);

      store.session.set("warningVisible", false);

      const stimulus = store.session.get("nextStimulus");
      const switchDecimal = store.session.get("switchDecimal");
      const decimalKey = store.session.get("decimalKey");

      const normalize = (val) => {
        if (val === null || val === "") return null;
        if (switchDecimal && typeof val === "string") {
          val = val.replace(decimalKey, ".");
        }
        return Number(val);
      };

      const hasDecimalResponse = textboxVal.some(
        (val) => typeof val === "string" && val.includes(decimalKey),
      );

      const targets = stimulus.target.map(normalize);
      const responses = textboxVal.map(normalize);
      let correctCount = 0;

      if (textboxVal.length != 0) {
        for (let i = 0; i < textboxVal.length; i++) {
          if (responses[i] === targets[i]) {
            correctCount++;
          }
        }

        //handles switched order for items requiring 2 "x" values
        if (stimulus.lead_raw.length === 2) {
          if (
            stimulus.lead_raw[1] === i18next.t("terms.problem2x") &&
            responses[0] === targets[1] &&
            responses[1] === targets[0]
          ) {
            correctCount = 2;
          }
        }

        if (stimulus.response_format[0] === "fraction") {
          //handles fractions in which a decimal point was written in either numerator or denominator
          if (hasDecimalResponse) {
            correctCount = 0;
          } else if (
            //handles fractions that are not simplified only for problems that don't say simplify
            !stimulus.item_raw.includes(
              i18next.t("terms.simplifiedFraction"),
            ) &&
            correctCount === 0
          ) {
            if (responses[0] * targets[1] === targets[0] * responses[1]) {
              correctCount = 2;
            }
          }
        }
      }

      //all trials are saved, but timeout trials are marked incorrect
      let correct =
        correctCount === stimulus.target.length && !store.session.get("timeOut")
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
        corpus_name: "textboxResponse",
        trial_num_total: store.session.get("trialNumTotal") + 1,
        trial_num_block: store.session.get("indexTracking") + 1,
        item_id: stimulus.itemID,
        problem_id: stimulus.problemID,
        problem_version: stimulus.version,
        item_grade_level: stimulus.cc_grade_level,
        theoretical_difficulty: stimulus.cc_grade_level,
        choices: null,
        correct_response_num: null,
        choice_index: null,
        response: responses,
        correct: store.session.get("dataCorrect"),
        thetaEstimateRaw: catIRT.theta,
        thetaEstimate: store.session.get("thetaEstimate"),
        thetaSE:
          catIRT.seMeasurement === Infinity
            ? Number.MAX_VALUE
            : catIRT.seMeasurement,
        item: stimulus.item_raw,
        target: stimulus.target,
        response_key_list: key,
        response_time_list: rt,
        distractors: stimulus.distractor_list ? stimulus.distractor_list : null,
        is_mobile: isMobile,
      });

      // update trial count
      if (corpusName === "stimulus") {
        store.session.transact("trialNumTotal", (oldVal) => oldVal + 1);

        // feed response to fluencyValidityEvaluator for evaluation per trial
        validityEvaluator.addResponseData(
          data.rt,
          responses.length == 0 ? "" : responses.toString(),
          store.session.get("dataCorrect"),
        );
      }
    },
  };
  return stim;
};

export const textboxResponse = (corpusName, assessment_stage_val) => {
  let timelineObj = [desktopKeyboard(corpusName, assessment_stage_val)];

  if (isMobile) {
    timelineObj = [mobileKeyboard(corpusName, assessment_stage_val)];
  }

  return {
    timeline: timelineObj,
  };
};
