import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../../.."; //media files
import i18next from "i18next";
import "../../../i18n/i18n";

export const endScreen = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => mediaAssets.audio.responseModalityStudyEndScreen1,
  prompt: () => {
    return `
        <div class="tiger-gif-container">
          <div class="speechbubble">
            <h1 class="header">${i18next.t("postPractice.text1")} </h1>
            <p class="text"> ${i18next.t(
              "responseModalityStudy.endScreen.text1",
            )} </p>
          </div>
          <img class="roam-tiger" src=${mediaAssets.images.tiger} alt="tiger"/>
          
        </div>
      `;
  },
  keyboard_choices: () => [],
  button_choices: () => [""],
  button_html: () =>
    `<img class="go-button" src=${mediaAssets.images.goButtonRectangleYellow} alt="button"/>`,
  on_start: () => {
    document.body.style.cursor = "auto";
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    document.getElementById("jspsych-progressbar-container").style.visibility =
      "hidden";
  },
};
