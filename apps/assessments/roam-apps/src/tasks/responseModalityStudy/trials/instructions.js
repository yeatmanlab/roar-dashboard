import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../../.."; //media files
import i18next from "i18next";
import "../../../i18n/i18n";
import store from "store2";

const problemInstruction = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.nullAudio;
  },
  prompt: () => {
    return `
        <div class="jspsych-content-modified instructions-bg">
          <h2 class="title">${i18next.t("instructions.fluency.text1")}</h2>
          <p class="instructions-text">${i18next.t(
            "responseModalityStudy.instructions.text1",
          )}</p>
          <div class="row">
            <div class="instruction-boxes fade-in-1" id="panel1">
              <div class="box-title">${i18next.t(
                "responseModalityStudy.instructions.text2",
              )}</div>
              <div class="item-stimulus" style="min-height: 11rem;">4 - 1 =</div>
              <div class="text-image">
                <img class="clipart" src=${
                  mediaAssets.images.paperPencilRed
                } alt="paper and pencil"/>
                <p>${i18next.t("responseModalityStudy.instructions.text3")}</p>
              </div>
              
            </div>  
            <div class="instruction-boxes fade-in-1" id="panel2">
              <div class="box-title">${i18next.t(
                "responseModalityStudy.instructions.text4",
              )}</div>
              <div style="min-height: 11rem;">
                  <span class="equation stacked" style="left: 0%; transform: translateX(0%);">
                      <span class="number">32</span>
                      <span class="operator">+</span>
                      <span class="number">15</span>
                      <span class="equals">=</span>
                  </span>
              </div>    
              <div class="text-image">
                <img class="clipart" src=${
                  mediaAssets.images.paperPencilGreen
                } alt="paper and pencil"/>
                <p>${i18next.t("responseModalityStudy.instructions.text5")}</p>
              </div>
            </div>
          </div>
        </div>
        `;
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    /*`<div class="key-button"> ${i18next.t("navigation.continueButtonTextClick", {
          input: `${i18next.t("terms.here")}`,
          action: `${i18next.t("terms.continue")}`,
        })} </div>`,*/
    `<img class="go-button" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  on_start: () => {
    document.body.style.cursor = "auto";
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
  },
};

const responseModeInstruction = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.nullAudio;
  },
  prompt: () => {
    return `
        <div class="jspsych-content-modified instructions-bg">
          <h2 class="title">${i18next.t("instructions.fluency.text1")}</h2>
          <p class="instructions-text">${i18next.t(
            "responseModalityStudy.instructions.text6",
          )}</p>
          <div class="row">
            <div class="instruction-boxes fade-in-1" id="panel1">
              <div class="box-title">${i18next.t(
                "responseModalityStudy.instructions.text7",
              )}</div>
              <div style="min-height: 13rem">
                <div class="item-stimulus">1 + 1 =</div>
                <div class="nafc-btn-layout">
                    <div class="disabled-btn" style="min-width: calc(20%);"><button>2</button></div>
                    <div class="disabled-btn" style="min-width: calc(20%);"><button>1</button></div>
                </div>
              </div>  
              <p>${i18next.t("responseModalityStudy.instructions.text8")}</p>
            </div>  
            <div class="instruction-boxes fade-in-1" id="panel2">
              <div class="box-title">${i18next.t(
                "responseModalityStudy.instructions.text9",
              )}</div>
              <div class="item-stimulus" style="min-height: 13rem">1 + 1 = <span class="spacing"><input readonly type="text" class="item-textbox" style="pointer-events: none;"></span></div>
              <p>${i18next.t("responseModalityStudy.instructions.text10")}</p>
            </div>
          </div>
        </div>
        `;
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    /*`<div class="key-button"> ${i18next.t("navigation.continueButtonTextClick", {
          input: `${i18next.t("terms.here")}`,
          action: `${i18next.t("terms.continue")}`,
        })} </div>`,*/
    `<img class="go-button" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  on_start: () => {
    document.body.style.cursor = "auto";
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
  },
};

export const practiceInstruction = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    return mediaAssets.audio.responseModalityStudyInstructions;
  },
  prompt: () => {
    return `
        <div class="tiger-gif-container">
          <div class="speechbubble">
            <h1 class="header">${i18next.t(
              "responseModalityStudy.instructions.text1",
            )} </h1>
            <p class="text"> ${i18next.t(
              "responseModalityStudy.instructions.text2",
            )} </p>
            <p class="text"> ${i18next.t(
              "responseModalityStudy.instructions.text3",
            )} </p>
          </div>
          <img class="roam-tiger" src=${
            mediaAssets.images[store.session.get("displayImage")]
          } alt="tiger"/>
          
        </div>
      `;
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    /*`<div class="key-button"> ${i18next.t("navigation.continueButtonTextClick", {
          input: `${i18next.t("terms.here")}`,
          action: `${i18next.t("terms.continue")}`,
        })} </div>`,*/
    `<img class="go-button" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  on_start: () => {
    document.body.style.cursor = "auto";
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
  },
};

export const instructions = {
  timeline: [
    //problemInstruction,
    //responseModeInstruction
    practiceInstruction,
  ],
};
