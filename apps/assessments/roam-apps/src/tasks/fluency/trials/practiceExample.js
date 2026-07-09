import store from "store2"; //storing session data
import { jsPsych } from "../../taskSetup";
import jsPsychSurveyHtmlForm from "@jspsych/plugin-survey-html-form";
import jsPsychAudioKeyboardResponse from "@jspsych/plugin-audio-keyboard-response";
import { mediaAssets } from "../../..";
import i18next from "i18next";

let source1, source2;
let rt = [];
let key = [];
let startTime;

const practiceStimulus = {
  type: jsPsychSurveyHtmlForm,
  html: () => {
    return `
<div class="instructions-kids">
    <h2 class="title">${i18next.t("instructions.text1")}</h2>
    <div class="instructions-container">
    <div class="gif-container fade-in-1">
        <p class="instructions-text">${i18next.t(
          "instructions.fluency.text8",
        )}</p>
        <img src="${mediaAssets.images.keyboardExample}" alt="arrow keys">
        
    </div>
    <div class="practice-container">
        <p class="practice-text">${i18next.t("instructions.fluency.text9")}</p>
        <input type="text" name="practice_number" id="practice_number" class="textbox">
    </div>
    </div>
</div>

`;
  },
  on_start: () => {
    //initialise variables for trial
    rt = [];
    key = [];
    startTime = performance.now(); //get initial time
  },
  data: {
    // Here is where we specify that we should save the trial to Firestore
    assessment_stage: "practice_response",
  },
  on_load: () => {
    document.getElementById("practice_number").focus();

    async function replayAudio(audioFile) {
      const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

      // Returns a promise of the AudioBuffer of the preloaded file path.
      const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(audioFile);

      source2 = jsPsychAudioCtx.createBufferSource();
      source2.buffer = audioBuffer;
      source2.connect(jsPsychAudioCtx.destination);
      source2.start(0);
    }
    replayAudio(mediaAssets.audio.instructionsFluencyExample);

    //hide the survey form submit button
    const submit_button = document.getElementById(
      "jspsych-survey-html-form-next",
    );
    submit_button.classList.add("hide-submit");

    document
      .getElementById("jspsych-survey-html-form")
      .addEventListener("keydown", (event) => {
        //only permit numbers, backspace and enter key
        if (
          (!event.code.includes("Digit") || !isFinite(event.key)) &&
          event.code !== "Backspace" &&
          event.code !== "Enter"
        ) {
          event.preventDefault();
        }
        const endTime = performance.now();
        const response_time = Math.round(endTime - startTime);
        const name = event.code;
        key.push(name);
        rt.push(response_time);
      });
  },
  on_finish: (data) => {
    if (source2) {
      source2.stop();
    }

    let response_val;
    if (data.response) {
      response_val = data.response.practice_number;
    }
    store.session.set("response", response_val);

    let correct = response_val === "10"; //when csv is stored in bucket, targets are in string format

    if (correct) {
      //store.session.transact("correctCount", (oldVal) => oldVal + 1); //increment count
      store.session.set("practiceFeedback", 1); // if response = 1 then the participant got it correct
    } else {
      store.session.set("practiceFeedback", 0); // if response = 0 then the participant got it wrong
    }

    jsPsych.data.addDataToLastTrial({
      save_trial: true,
      corpusName: "example",
      pid: store.session.get("config").pid,
      trialNumBlock: store.session.get("keyboardPracticeCounter") + 1,
      target: "10",
      correct: store.session.get("practiceFeedback"),
      response: response_val,
      respTime: rt,
      keyPress: key,
    });
  },
};

const feedbackIncorrect = {
  type: jsPsychSurveyHtmlForm,
  html: () => {
    return `
<div class="instructions-kids">
    <h2 class="title">${i18next.t("instructions.text1")}</h2>
    <div class="instructions-container">
    <div class="gif-container fade-in-1">
        <p class="instructions-text">${i18next.t(
          "instructions.fluency.text8",
        )}</p>
        <img src="${mediaAssets.images.keyboardExample}" alt="arrow keys">
        
    </div>
    <div class="practice-container">
        <p class="practice-text">${i18next.t("instructions.fluency.text9")}</p>
        <input type="text" name="practice_number" id="practice_number" class="textbox">
        <p class="feedback">
            <span class="red">
            ${i18next.t("instructions.fluency.text12")}
            </span>
        </p>
    </div>
    </div>
</div>

`;
  },
  on_start: () => {
    //initialise variables for trial
    rt = [];
    key = [];
    startTime = performance.now(); //get initial time
  },
  data: {
    // Here is where we specify that we should save the trial to Firestore
    assessment_stage: "practice_response",
  },
  on_load: () => {
    document.getElementById("practice_number").focus();

    async function replayAudio(audioFile) {
      const jsPsychAudioCtx = jsPsych.pluginAPI.audioContext();

      // Returns a promise of the AudioBuffer of the preloaded file path.
      const audioBuffer = await jsPsych.pluginAPI.getAudioBuffer(audioFile);

      source1 = jsPsychAudioCtx.createBufferSource();
      source1.buffer = audioBuffer;
      source1.connect(jsPsychAudioCtx.destination);
      source1.start(0);
    }
    replayAudio(mediaAssets.audio.practiceFluencyIncorrect);

    //hide the survey form submit button
    const submit_button = document.getElementById(
      "jspsych-survey-html-form-next",
    );
    submit_button.classList.add("hide-submit");

    document
      .getElementById("jspsych-survey-html-form")
      .addEventListener("keydown", (event) => {
        //only permit numbers, backspace and enter key
        if (
          (!event.code.includes("Digit") || !isFinite(event.key)) &&
          event.code !== "Backspace" &&
          event.code !== "Enter"
        ) {
          event.preventDefault();
        }
        const endTime = performance.now();
        const response_time = Math.round(endTime - startTime);
        const name = event.code;
        key.push(name);
        rt.push(response_time);
      });
  },
  on_finish: (data) => {
    if (source1) {
      source1.stop();
    }

    let response_val;
    if (data.response) {
      response_val = data.response.practice_number;
    }
    store.session.set("response", response_val);
    let correct = response_val === "10"; //when csv is stored in bucket, targets are in string format

    if (correct) {
      //store.session.transact("correctCount", (oldVal) => oldVal + 1); //increment count
      store.session.set("practiceFeedback", 1); // if response = 1 then the participant got it correct
    } else {
      store.session.set("practiceFeedback", 0); // if response = 0 then the participant got it wrong
    }

    jsPsych.data.addDataToLastTrial({
      save_trial: true,
      corpusName: "example",
      pid: store.session.get("config").pid,
      trialNumBlock: store.session.get("keyboardPracticeCounter") + 1,
      target: "10",
      correct: store.session.get("practiceFeedback"),
      response: response_val,
      respTime: rt,
      keyPress: key,
    });
  },
};

const feedbackCorrect = {
  type: jsPsychAudioKeyboardResponse,
  stimulus: () => {
    return mediaAssets.audio.instructionsFluencyCorrect;
  },
  choices: () => ["Enter"],
  prompt: () => {
    return `
        <div class="instructions-kids">
            <h2 class="title">${i18next.t("instructions.text1")}</h2>
            <div class="instructions-container">
            <div class="gif-container fade-in-1">
                <p class="instructions-text">${i18next.t(
                  "instructions.fluency.text8",
                )}</p>
                <img src="${
                  mediaAssets.images.keyboardExample
                }" alt="arrow keys">
                
            </div>
            <div class="practice-container">
                <p class="practice-text">${i18next.t(
                  "instructions.fluency.text9",
                )}</p>
                <input type="text" name="practice_number" id="practice_number" class="textbox">
                <p class="feedback">
                  <span class="green">
                  ${i18next.t("instructions.fluency.text10")}
                  </span>
              </p>
            </div>
            </div>
        </div>`;
  },
  on_load: () => {
    document.getElementById("practice_number").value =
      store.session.get("response");
    //document.getElementById("practice_number").focus();
  },
  response_ends_trial: true,
  trial_ends_after_audio: true,
};

const incorrectLoop = {
  timeline: [feedbackIncorrect],
  loop_function: () => {
    if (store.session.get("practiceFeedback") !== 1) {
      store.session.transact("keyboardPracticeCounter", (oldVal) => oldVal + 1);
      if (
        store.session.get("keyboardPracticeCounter") ===
        store.session.get("config").stopCriterion
      ) {
        return false;
      }
    }
    if (store.session.get("practiceFeedback") === 1) {
      return false;
    }
    return true;
  },
};

const ifIncorrect = {
  timeline: [incorrectLoop],
  conditional_function: () => {
    if (store.session.get("practiceFeedback") !== 1) {
      store.session.transact("keyboardPracticeCounter", (oldVal) => oldVal + 1);
      return true;
    } else {
      return false;
    }
  },
};

const ifCorrect = {
  timeline: [feedbackCorrect],
  conditional_function: () => {
    if (store.session.get("practiceFeedback") === 1) {
      return true;
    }
    return false;
  },
};

export const instructionExample = {
  timeline: [practiceStimulus, ifIncorrect, ifCorrect],
  on_timeline_finish: () => {
    store.session.set("keyboardPracticeCounter", 0);
  },
};
