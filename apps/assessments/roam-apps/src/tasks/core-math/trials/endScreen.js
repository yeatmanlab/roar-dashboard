import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../../..";
import i18next from "i18next";
import "../../../i18n/i18n";
import store from "store2";

export const endScreen = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => {
    let audioFile = "coreMathEndScreen";
    if (store.session.get("isK2")) {
      audioFile = audioFile + "K2";
    }
    return mediaAssets.audio[audioFile];
  },
  prompt: () => {
    if (store.session.get("isK2")) {
      return `
       <div class = "jspsych-content-modified">
          <img src="${
            mediaAssets.images.coreMathEndScreenK2
          }" alt= "background" class="imageBG"> 
          <div class="tiger-gif-container" style="justify-content: start;">
            <div class="speechbubble">
              <h1 class="header">${i18next.t("gameBreak.endScreen.text5")} </h1>
              <p class="text"> ${i18next.t("gameBreak.endScreen.text6")} </p>
              <p class="text"> ${i18next.t("gameBreak.endScreen.text7")} </p>
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
              <h1 class="header">${i18next.t("gameBreak.endScreen.text4")} </h1>
              <p class="text"> ${i18next.t(
                "gameBreak.endScreen.text1",
              )} ${i18next.t("gameBreak.endScreen.text2")} </p>
              <p class="text"> ${i18next.t("gameBreak.endScreen.text7")} </p>
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
    document.body.style.cursor = "auto";
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
