import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../../.."; //media files
import i18next from "i18next";
import "../../../i18n/i18n";
import store from "store2"; //storing session data
import { startTimer } from "../helpers/updateCountDown";
import { isMobile } from "./trialHelpers";

const mouseInstructions = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.coreMathResponse;
  },
  prompt: () => {
    let mouseImage = mediaAssets.images.coreMathResponseK4;
    if (store.session.get("grade") > 4) {
      mouseImage = mediaAssets.images.coreMathResponse;
    }
    let responseMode = isMobile
      ? "instructions.core-math.finger"
      : "instructions.core-math.mouse";
    return `
      <div class="jspsych-content-modified">
        <h2 class="title">${i18next.t("instructions.text1")}</h2>
        <p class="instructions-text">${i18next.t(
          "instructions.core-math.text2",
          {
            mode: `${i18next.t(responseMode)}`,
          },
        )}</p>
        <img class="img-border" src="${mouseImage}" style=""alt="response">
      </div>
      `;
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
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

const audioInstructions = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.coreMathSpeaker;
  },
  prompt: () => {
    return `
      <div class="jspsych-content-modified">
        <h2 class="title">${i18next.t("instructions.text1")}</h2>
        <p class="instructions-text">${i18next.t(
          "instructions.core-math.text6",
        )}</p>
        <img class="img-border" src="${
          mediaAssets.images.coreMathSpeaker
        }" alt="response">
      </div>
      `;
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
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

const timeInstructions = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.coreMathTime;
  },
  prompt: () => {
    let diameter = 2 * Math.round(window.innerWidth * 0.04);
    if (store.session.get("grade") > 4) {
      return `
        <div class="jspsych-content-modified">
          <h2 class="title">${i18next.t("instructions.text1")}</h2>
          <p class="instructions-text">${i18next.t(
            "instructions.core-math.text8",
          )}</p>
          <div class="row">
                <div class="instruction-boxes fade-in-1"  style="width: 60vw;" id="panel1">
                <div style="overflow: hidden;">
                  <canvas id="canvas-timer" width="${diameter}" height="${diameter}" class="canvas-timer-instr"></canvas>
                </div>
                  <div class="item-stimulus" style="font-size: 2rem; margin-top: 5vh">${i18next.t(
                    "terms.mathProblem",
                  )}</div>
                    <div class="nafc-btn-layout" style="line-height: 5rem;">
                        <div class="disabled-btn"><button style="font-size: 2rem;">6</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">1</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">3</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">5</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">2</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">4</button></div>
                  </div>
                </div>  
              </div>
          <p class="instructions-text">${i18next.t(
            "instructions.core-math.text9",
          )}</p>
        </div>
        `;
    } else {
      return `
        <div class="jspsych-content-modified">
          <h2 class="title">${i18next.t("instructions.text1")}</h2>
          <p class="instructions-text">${i18next.t(
            "instructions.core-math.text8",
          )}</p>
          <div class="row">
                <div class="instruction-boxes fade-in-1"  style="width: 60vw;" id="panel1">
                <div style="overflow: hidden;">
                  <canvas id="canvas-timer" width="${diameter}" height="${diameter}" class="canvas-timer-instr"></canvas>
                  <img class="icon" draggable="false" src="${
                    mediaAssets.images.iconSpeaker
                  }" alt="replay"/>
                </div>
                  <div class="item-stimulus" style="font-size: 2rem; margin-top: 5vh">${i18next.t(
                    "terms.mathProblem",
                  )}</div>
                    <div class="nafc-btn-layout" style="line-height: 5rem;">
                        <div class="disabled-btn"><button style="font-size: 2rem;">6</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">1</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">3</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">5</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">2</button></div>
                        <div class="disabled-btn"><button style="font-size: 2rem;">4</button></div>
                  </div>
                </div>  
              </div>
          <p class="instructions-text">${i18next.t(
            "instructions.core-math.text9",
          )}</p>
        </div>
        `;
    }
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  on_load: () => {
    let countdownTime = 30;
    startTimer(countdownTime);
    let intervalId = setInterval(() => {
      clearInterval(store.session.get("intervalId"));
      startTimer(countdownTime);
    }, countdownTime * 1000);
    store.session.set("intervalId2", intervalId);

    //disable button to prevent double clicks
    const btn = document.getElementById("go-button-id");
    if (btn) {
      btn.style.pointerEvents = "none";
      setTimeout(() => {
        btn.style.pointerEvents = "auto";
      }, 1000);
    }
  },
  on_finish: () => {
    //stop the function that updates the countdown timer
    clearInterval(store.session.get("intervalId"));
    clearInterval(store.session.get("intervalId2"));
  },
};

const pencilPaper = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.coreMathPencilPaper;
  },
  prompt: () => {
    return `
        <div class="jspsych-content-modified">
            <h2 class="title">${i18next.t("instructions.text1")}</h2>
            <p class="instructions-text">${i18next.t(
              "instructions.core-math.text10-" +
                store.session.get("config").labId,
            )}</p>
            <div class="row">
            <div class="single-box">
                <img src="${
                  mediaAssets.images.paperAndPencil
                }" alt="arrow keys">
            </div>
            </div>
        </div>
        `;
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
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

const preTaskCheck = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    if (store.session.get("isK2")) {
      return mediaAssets.audio.coreMathPretaskCheckK2;
    } else {
      return mediaAssets.audio.coreMathPretaskCheck;
    }
  },
  prompt: () => {
    if (store.session.get("isK2")) {
      return `
         <div class = "jspsych-content-modified">
            <img src="${
              mediaAssets.images.coreMathIntro
            }" alt= "background" class="imageBG"> 
            <div class="tiger-gif-container">
              <div class="speechbubble">
                <div class="text-image">
                  <div>
                    <h1 class="header">${i18next.t("postPractice.text5")} </h1>
                    <p class="text"> ${i18next.t(
                      "instructions.core-math.text11",
                    )} </p>
                    <p class="text"> ${i18next.t(
                      "instructions.core-math.text13",
                    )} </p>
                  </div>
                  <img class="clipart" src=${
                    mediaAssets.images.coreMathNoShadow
                  } alt="tiger"/>
  
                </div>
              </div>
              
            </div>
          </div>
        `;
    } else {
      return `
         <div class = "jspsych-content-modified">
            <img src="${
              mediaAssets.images.coreMathIntro
            }" alt= "background" class="imageBG"> 
            <div class="tiger-gif-container">
              <div class="speechbubble">
                <h1 class="header">${i18next.t("postPractice.text5")} </h1>
                <p class="text"> ${i18next.t(
                  "instructions.core-math.text12",
                )} </p>
                <p class="text"> ${i18next.t(
                  "instructions.core-math.text13",
                )} </p>
              </div>
              
            </div>
          </div>
        `;
    }
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    `<img class="go-button" id="go-button-id" src=${mediaAssets.images.goButtonRectangle} alt="button"/>`,
  on_start: () => {
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
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

const ifAudioInstructions = {
  timeline: [audioInstructions],
  conditional_function: () => {
    if (store.session.get("grade") > 4) {
      return false;
    }
    return true;
  },
};

const ifTimeInstructions = {
  timeline: [timeInstructions],
  conditional_function: () => {
    //set the timer only for the default usermode
    if (store.session.get("config").userMode === "default") {
      return true;
    }
    return false;
  },
};

export const instructions = {
  timeline: [
    mouseInstructions,
    ifAudioInstructions,
    ifTimeInstructions,
    pencilPaper,
    preTaskCheck,
  ],
};
