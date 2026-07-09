import jsPsychAudioMultiResponse from "@jspsych-contrib/plugin-audio-multi-response";
import { mediaAssets } from "../../.."; //media files
import i18next from "i18next";
import "../../../i18n/i18n";

export const intro = {
  type: jsPsychAudioMultiResponse,
  stimulus: () => mediaAssets.audio.responseModalityStudyIntroduction,
  prompt: () => {
    return `
          <div class="tiger-gif-container">
            <div class="speechbubble">
              <h1 class="header">${i18next.t(
                "responseModalityStudy.intro.text1",
              )} </h1>
              <p class="text"> ${i18next.t(
                "responseModalityStudy.intro.text2",
              )} </p>
            </div>
            <img class="roam-tiger" src=${
              mediaAssets.images.tiger
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
